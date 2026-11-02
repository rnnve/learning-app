import {
  createConversation,
  deleteConversation,
  getConversation,
  getMessages,
  sendMessage,
} from "@/api/endpoints/chat";
import type { Conversation, Message } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { ErrorState } from "@/components/ui/ErrorState";
import i18n from "@/i18n";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { generateUuid } from "@/lib/uuid";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: "transparent",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
    },
    messagesContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    typingIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: tokens.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    typingText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
    },
    inputContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: tokens.radii.xl,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      maxHeight: 120,
      minHeight: 48,
      color: theme.colors.onSurface,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.onSurfaceVariant,
    },
    charCount: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
      textAlign: "right",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    emptyIllustration: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      marginBottom: 24,
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
      marginBottom: 8,
    },
    modalText: {
      fontSize: 15,
      lineHeight: 24,
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: tokens.radii.md,
      alignItems: "center",
    },
    modalButtonCancel: {
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    modalButtonConfirm: {
      backgroundColor: theme.colors.error,
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    modalButtonTextCancel: { color: theme.colors.onSurfaceVariant },
    modalButtonTextConfirm: { color: theme.colors.onPrimary },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255,255,255,0.8)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 100,
    },
  });

const MAX_MESSAGE_CHARS = 4000;

/** Contract 9.10: the assistant typing indicator is shown for up to 60 s. */
const TYPING_TIMEOUT_MS = 60_000;

interface PendingMessage {
  clientMessageId: string;
  content: string;
  idempotencyKey: string;
  status: "sending" | "failed";
}

export default function ChatConversationScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { isAuthenticated } = useAuth();
  const { conversationId, sourceId } = useLocalSearchParams<{
    conversationId?: string;
    sourceId?: string;
  }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [text, setText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const messagesEndRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversation = useCallback(async () => {
    try {
      let conv: Conversation;
      if (conversationId && conversationId !== "new") {
        conv = await getConversation(conversationId);
      } else if (sourceId) {
        conv = await createConversation({ sourceId });
      } else {
        conv = await createConversation({});
      }
      setConversation(conv);
      const res = await getMessages(conv.id);
      setMessages(res.items.reverse());
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, [conversationId, sourceId]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    // Keep the newest message in view whenever the list changes.
    if (messages.length > 0) {
      messagesEndRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollToEnd({ animated: true });
  }, []);

  const clearTypingTimer = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  /**
   * Delivers a message with the given clientMessageId / Idempotency-Key.
   * Contract 9.10: the very same keys are reused when the user retries a
   * failed send, so the backend can de-duplicate the request.
   */
  const deliverMessage = useCallback(
    async (content: string, clientMessageId: string, idempotencyKey: string) => {
      setSending(true);
      setPending({ clientMessageId, content, idempotencyKey, status: "sending" });
      setAwaitingReply(true);
      clearTypingTimer();
      typingTimerRef.current = setTimeout(() => {
        setAwaitingReply(false);
        typingTimerRef.current = null;
      }, TYPING_TIMEOUT_MS);

      try {
        const { userMessage, assistantMessage } = await sendMessage({
          conversationId: conversation!.id,
          content,
          clientMessageId,
          idempotencyKey,
        });
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setPending(null);
        setText("");
        haptics.light();
      } catch {
        // Keep the bubble (and therefore the typed text) and offer a Retry.
        setPending({ clientMessageId, content, idempotencyKey, status: "failed" });
        haptics.error();
      } finally {
        clearTypingTimer();
        setAwaitingReply(false);
        setSending(false);
      }
    },
    [conversation, clearTypingTimer],
  );

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || sending || !conversation) return;
    // Both ids have to be UUIDs: the backend validates the Idempotency-Key
    // header and the clientMessageId of the message body.
    const clientMessageId = generateUuid();
    const idempotencyKey = generateUuid();
    await deliverMessage(trimmedText, clientMessageId, idempotencyKey);
  }, [text, sending, conversation, deliverMessage]);

  const handleRetry = useCallback(async () => {
    if (!pending || pending.status !== "failed" || sending) return;
    await deliverMessage(pending.content, pending.clientMessageId, pending.idempotencyKey);
  }, [pending, sending, deliverMessage]);

  const handleSuggestedTap = useCallback((suggestion: string) => {
    setText(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleExit = useCallback(() => {
    router.back();
  }, []);

  const handleDelete = useCallback(async () => {
    if (!conversation) return;
    try {
      await deleteConversation(conversation.id);
      haptics.success();
      router.back();
    } catch (err: any) {
      setLoadError(err.message);
    }
    setShowDeleteConfirm(false);
  }, [conversation]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleExit}
            accessibilityLabel={i18n.t("common.close")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.onSurfaceVariant, fontSize: 20 },
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
          <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
            {i18n.t("navigation.chat")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleExit}
            accessibilityLabel={i18n.t("common.close")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.onSurfaceVariant, fontSize: 20 },
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
          <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
            {i18n.t("navigation.chat")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorState error={loadError} onRetry={fetchConversation} />
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleExit}
            accessibilityLabel={i18n.t("common.close")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.onSurfaceVariant, fontSize: 20 },
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
          <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
            {i18n.t("navigation.chat")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.onSurfaceVariant }]}
          >
            {i18n.t("common.error")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleExit}
          accessibilityLabel={i18n.t("common.close")}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              { color: theme.colors.onSurfaceVariant, fontSize: 20 },
            ]}
          >
            ✕
          </Text>
        </TouchableOpacity>
        <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
          {conversation.title ||
            (sourceId ? i18n.t("chat.newChatWithSource") : i18n.t("chat.newChat"))}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setShowDeleteConfirm(true)}
          accessibilityLabel={i18n.t("common.delete")}
        >
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.error, fontSize: 20 }]}
          >
            🗑️
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={messagesEndRef}
        contentContainerStyle={styles.messagesContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[{ color: theme.colors.onSurface }, styles.emptyIllustration]}>💬</Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.emptyTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("chat.emptyConversation")}
            </Text>
            <Text style={[{ color: theme.colors.onSurface }, styles.emptyDesc]}>
              {i18n.t("chat.placeholder")}
            </Text>
          </View>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            sourceId={conversation.sourceId}
            onFollowUpPress={handleSuggestedTap}
          />
        ))}

        {pending && (
          <ChatBubble
            key={pending.clientMessageId}
            message={{
              id: `pending-${pending.clientMessageId}`,
              conversationId: conversation.id,
              role: "user",
              content: pending.content,
              grounding: null,
              citations: [],
              suggestedFollowUps: [],
              clientMessageId: pending.clientMessageId,
              createdAt: new Date().toISOString(),
            }}
            status={pending.status}
            onRetry={handleRetry}
          />
        )}

        {awaitingReply && (
          <View style={styles.typingIndicator} accessibilityLabel={i18n.t("chat.typing")}>
            <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
            <Text style={[{ color: theme.colors.onSurface }, styles.typingText]}>
              {i18n.t("chat.typing")}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={[{ color: theme.colors.onSurface }, styles.textInput]}
            placeholder={i18n.t("chat.placeholder")}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_MESSAGE_CHARS}
            placeholderTextColor={theme.colors.outlineVariant}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable
            accessibilityLabel={i18n.t("chat.placeholder")}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
            accessibilityLabel={i18n.t("chat.send")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.onPrimary, fontSize: 20 },
              ]}
            >
              ➤
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[{ color: theme.colors.onSurface }, styles.charCount]}>
          {i18n.t("chat.charLimit", { count: text.length, max: MAX_MESSAGE_CHARS })}
        </Text>
      </View>

      {showDeleteConfirm && (
        <Modal visible={showDeleteConfirm} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("common.delete")}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalText, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("chat.deleteConfirm")}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setShowDeleteConfirm(false)}
                  activeOpacity={0.9}
                >
                  <Text style={[{ color: theme.colors.onSurface }, styles.modalButtonTextCancel]}>
                    {i18n.t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  onPress={handleDelete}
                  activeOpacity={0.9}
                >
                  <Text style={[{ color: theme.colors.onSurface }, styles.modalButtonTextConfirm]}>
                    {i18n.t("common.delete")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
