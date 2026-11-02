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
import { haptics } from "@/lib/haptics";
import { generateUuid } from "@/lib/uuid";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
      flex: 1,
      marginHorizontal: 12,
      textAlign: "center",
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
      flexGrow: 1,
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
      minHeight: 48,
      justifyContent: "center",
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
    modalButtonTextConfirm: { color: theme.colors.onError },
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
  const insets = useSafeAreaInsets();
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const mountedRef = useRef(true);
  const activeSendRef = useRef<AbortController | null>(null);
  const deletingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const creationRef = useRef<{ key: string; promise: Promise<Conversation> } | null>(null);
  const messagesEndRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversation = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      let conv: Conversation;
      if (conversationId && conversationId !== "new") {
        conv = await getConversation(conversationId);
      } else {
        const key = sourceId || "general";
        if (!creationRef.current || creationRef.current.key !== key) {
          creationRef.current = {
            key,
            promise: createConversation(sourceId ? { sourceId } : {}),
          };
        }
        conv = await creationRef.current.promise.catch((error) => {
          creationRef.current = null;
          throw error;
        });
      }
      const res = await getMessages(conv.id);
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      setConversation(conv);
      setMessages([...res.items].reverse());
      setLoadError(null);
    } catch (err: any) {
      if (mountedRef.current && requestId === loadRequestRef.current) setLoadError(err);
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current) setLoading(false);
    }
  }, [conversationId, sourceId]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchConversation();
    return () => {
      mountedRef.current = false;
      loadRequestRef.current += 1;
      activeSendRef.current?.abort();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [fetchConversation]);

  useEffect(() => {
    // Keep the newest message in view whenever the list changes.
    if (messages.length > 0 || pending) {
      messagesEndRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, pending]);

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
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /**
   * Delivers a message with the given clientMessageId / Idempotency-Key.
   * Contract 9.10: the very same keys are reused when the user retries a
   * failed send, so the backend can de-duplicate the request.
   */
  const deliverMessage = useCallback(
    async (content: string, clientMessageId: string, idempotencyKey: string) => {
      if (!conversation || activeSendRef.current || deletingRef.current) return;
      const controller = new AbortController();
      activeSendRef.current = controller;
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
          signal: controller.signal,
        });
        if (!mountedRef.current || controller.signal.aborted) return;
        setMessages((prev) => [
          ...prev.filter(
            (message) => message.id !== userMessage.id && message.id !== assistantMessage.id,
          ),
          userMessage,
          assistantMessage,
        ]);
        setPending(null);
        haptics.light();
      } catch {
        if (!mountedRef.current || controller.signal.aborted) return;
        // Keep the bubble (and therefore the typed text) and offer a Retry.
        setPending({ clientMessageId, content, idempotencyKey, status: "failed" });
        setText((draft) => draft || content);
        haptics.error();
      } finally {
        if (activeSendRef.current === controller) {
          activeSendRef.current = null;
          clearTypingTimer();
          if (mountedRef.current) {
            setAwaitingReply(false);
            setSending(false);
          }
        }
      }
    },
    [conversation, clearTypingTimer],
  );

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || activeSendRef.current || deletingRef.current || !conversation) return;
    setText("");
    if (pending?.status === "failed" && pending.content === trimmedText) {
      await deliverMessage(pending.content, pending.clientMessageId, pending.idempotencyKey);
      return;
    }
    // Both ids have to be UUIDs: the backend validates the Idempotency-Key
    // header and the clientMessageId of the message body.
    const clientMessageId = generateUuid();
    const idempotencyKey = generateUuid();
    await deliverMessage(trimmedText, clientMessageId, idempotencyKey);
  }, [text, pending, conversation, deliverMessage]);

  const handleRetry = useCallback(async () => {
    if (!pending || pending.status !== "failed" || sending) return;
    setText((draft) => (draft.trim() === pending.content ? "" : draft));
    await deliverMessage(pending.content, pending.clientMessageId, pending.idempotencyKey);
  }, [pending, sending, deliverMessage]);

  const handleSuggestedTap = useCallback((suggestion: string) => {
    setText(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleExit = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, []);

  const handleDelete = useCallback(async () => {
    if (!conversation || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    activeSendRef.current?.abort();
    activeSendRef.current = null;
    setSending(false);
    clearTypingTimer();
    setAwaitingReply(false);
    setPending((message) => (message ? { ...message, status: "failed" } : null));
    try {
      await deleteConversation(conversation.id);
      if (!mountedRef.current) return;
      setShowDeleteConfirm(false);
      haptics.success();
      router.back();
    } catch (err: any) {
      if (mountedRef.current) setDeleteError(err);
    } finally {
      deletingRef.current = false;
      if (mountedRef.current) setDeleting(false);
    }
  }, [conversation, clearTypingTimer]);

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
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[{ backgroundColor: theme.colors.background }, styles.container]}
    >
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
        <Text numberOfLines={1} style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
          {conversation.title ||
            (conversation.sourceId ? i18n.t("chat.newChatWithSource") : i18n.t("chat.newChat"))}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            Keyboard.dismiss();
            setDeleteError(null);
            setShowDeleteConfirm(true);
          }}
          accessibilityLabel={i18n.t("common.delete")}
        >
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.error, fontSize: 20 }]}
          >
            🗑️
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={messagesEndRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && !pending && (
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

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={[{ color: theme.colors.onSurface }, styles.textInput]}
              placeholder={i18n.t("chat.placeholder")}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={MAX_MESSAGE_CHARS}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              editable
              accessibilityLabel={i18n.t("chat.placeholder")}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!text.trim() || sending || deleting) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!text.trim() || sending || deleting}
              activeOpacity={0.8}
              accessibilityLabel={i18n.t("chat.send")}
              accessibilityRole="button"
            >
              {sending ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onPrimary, fontSize: 20 },
                  ]}
                >
                  ➤
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={[{ color: theme.colors.onSurface }, styles.charCount]}>
            {i18n.t("chat.charLimit", { count: text.length, max: MAX_MESSAGE_CHARS })}
          </Text>
        </View>
      </KeyboardAvoidingView>

      {showDeleteConfirm && (
        <Modal
          visible={showDeleteConfirm}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("chat.deleteTitle")}
              </Text>
              {deleteError ? <ErrorState error={deleteError} /> : null}
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
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => setShowDeleteConfirm(false)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>
                    {i18n.t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t("chat.deleteTitle")}
                  disabled={deleting}
                  onPress={handleDelete}
                  activeOpacity={0.9}
                >
                  {deleting ? (
                    <ActivityIndicator color={theme.colors.onError} />
                  ) : (
                    <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                      {i18n.t("common.delete")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
