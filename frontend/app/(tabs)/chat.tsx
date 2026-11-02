import { createConversation, getConversations } from "@/api/endpoints/chat";
import { getSources } from "@/api/endpoints/sources";
import type { Conversation, Source } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import i18n from "@/i18n";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },
    conversationList: {
      flex: 1,
    },
    conversationItem: {
      padding: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      marginBottom: 12,
    },
    conversationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    conversationTitle: {
      fontSize: 16,
      fontWeight: "600",
      flex: 1,
      marginRight: 12,
    },
    conversationMeta: {
      fontSize: 12,
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    sourceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.full,
      fontSize: 11,
      fontWeight: "600",
      backgroundColor: theme.colors.primaryContainer,
      color: theme.colors.primary,
    },
    newChatButton: {
      position: "absolute",
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: tokens.radii.xl,
      padding: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 16,
    },
    sourceItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceVariant,
    },
    sourceItemLast: {
      borderBottomWidth: 0,
    },
    sourceItemContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sourceIcon: {
      width: 40,
      height: 40,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: "center",
      justifyContent: "center",
    },
    sourceInfo: {
      flex: 1,
    },
    sourceTitle: {
      fontSize: 15,
      fontWeight: "600",
    },
    sourceMeta: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    cancelButton: {
      marginTop: 20,
      alignItems: "center",
    },
    cancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
    },
  });

export default function ChatScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [availableSources, setAvailableSources] = useState<Source[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getConversations();
      setConversations(res.items);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await getSources({ limit: 50 });
      setAvailableSources(res.items.filter((s) => s.status === "ready" || s.status === "partial"));
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchSources();
  }, [fetchConversations, fetchSources]);

  const handleNewChat = async (sourceId?: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    haptics.light();
    try {
      const res = await createConversation({
        title: "",
        sourceId: sourceId ?? null,
      });
      router.push(`/chat/${res.id}`);
      setShowNewChatModal(false);
    } catch (err: any) {
      setError(err);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.title, { color: theme.colors.onSurface }],
          ]}
        >
          {i18n.t("navigation.chat")}
        </Text>
      </View>

      <ScrollView
        style={styles.conversationList}
        contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
      >
        {conversations.length > 0 ? (
          conversations.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              style={[
                styles.conversationItem,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
              onPress={() => router.push(`/chat/${conv.id}`)}
              activeOpacity={0.9}
            >
              <View style={styles.conversationHeader}>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [styles.conversationTitle, { color: theme.colors.onSurface }],
                  ]}
                  numberOfLines={1}
                >
                  {conv.title ||
                    (conv.sourceId ? i18n.t("chat.newChatWithSource") : i18n.t("chat.newChat"))}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant, fontSize: 12 },
                  ]}
                >
                  {formatDate(conv.updatedAt, i18n.language as "th" | "en")}
                </Text>
              </View>
              {conv.lastMessagePreview && (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
                  ]}
                  numberOfLines={2}
                >
                  {conv.lastMessagePreview}
                </Text>
              )}
              {conv.sourceId && (
                <View style={styles.conversationMeta}>
                  <View style={styles.sourceBadge}>
                    <Text style={{ color: theme.colors.onSurface }}>📄</Text>
                    <Text style={{ color: theme.colors.onSurface }}>
                      {i18n.t("chat.newChatWithSource")}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : !loading ? (
          <EmptyState
            style={{ flex: 1, marginVertical: 0 }}
            icon="💬"
            title={i18n.t("chat.emptyConversation")}
            description={i18n.t("chat.emptyConversation")}
            actionLabel={i18n.t("chat.newChat")}
            onAction={() => setShowNewChatModal(true)}
          />
        ) : null}
      </ScrollView>

      {loading && conversations.length === 0 && (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.onSurfaceVariant }]}
          >
            {i18n.t("common.loading")}
          </Text>
        </View>
      )}

      {conversations.length > 0 && (
        <TouchableOpacity
          style={[
            styles.newChatButton,
            {
              bottom: 70 + Math.max(insets.bottom, 6),
              backgroundColor: theme.colors.primary,
            },
          ]}
          onPress={() => setShowNewChatModal(true)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("chat.newChat")}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              { fontSize: 28, color: theme.colors.onPrimary },
            ]}
          >
            +
          </Text>
        </TouchableOpacity>
      )}

      {error ? <ErrorState error={error} onRetry={fetchConversations} /> : null}

      <Modal visible={showNewChatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.modalTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("chat.newChat")}
            </Text>
            <View>
              <TouchableOpacity
                style={styles.sourceItem}
                disabled={creating}
                onPress={() => handleNewChat()}
              >
                <View style={styles.sourceItemContent}>
                  <View style={styles.sourceIcon}>
                    <Text style={[{ color: theme.colors.onSurface }, { fontSize: 18 }]}>💬</Text>
                  </View>
                  <View style={styles.sourceInfo}>
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.sourceTitle, { color: theme.colors.onSurface }],
                      ]}
                    >
                      {i18n.t("chat.newChat")}
                    </Text>
                    <Text style={[{ color: theme.colors.onSurface }, styles.sourceMeta]}>
                      {i18n.t("chat.selectSourcePrompt")}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              {availableSources.length > 0 && (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    {
                      marginTop: 16,
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: "600",
                      color: theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {i18n.t("chat.selectSourcePrompt")}
                </Text>
              )}
              {availableSources.map((source, index) => (
                <TouchableOpacity
                  key={source.id}
                  style={[
                    styles.sourceItem,
                    index === availableSources.length - 1 && styles.sourceItemLast,
                  ]}
                  disabled={creating}
                  onPress={() => handleNewChat(source.id)}
                >
                  <View style={styles.sourceItemContent}>
                    <View style={styles.sourceIcon}>
                      <Text style={[{ color: theme.colors.onSurface }, { fontSize: 18 }]}>
                        {source.kind === "images"
                          ? "📷"
                          : source.kind === "pdf"
                            ? "📄"
                            : source.kind === "docx"
                              ? "📝"
                              : "📄"}
                      </Text>
                    </View>
                    <View style={styles.sourceInfo}>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          [styles.sourceTitle, { color: theme.colors.onSurface }],
                        ]}
                        numberOfLines={2}
                      >
                        {source.title}
                      </Text>
                      <Text style={[{ color: theme.colors.onSurface }, styles.sourceMeta]}>
                        {source.pageCount}{" "}
                        {i18n.t("source.pagesCount", { count: source.pageCount })} ·{" "}
                        {formatDate(source.createdAt, i18n.language as "th" | "en")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowNewChatModal(false)}
            >
              <Text style={[{ color: theme.colors.onSurface }, styles.cancelText]}>
                {i18n.t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
