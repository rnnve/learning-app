import type { Grounding, Message } from "@/api/types";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SourceRefChip } from "./SourceRefChip";

/**
 * Delivery state of a chat bubble.
 * - `sent`     the server accepted the message (default)
 * - `sending`  optimistic bubble while the request is in flight
 * - `failed`   the request failed; the bubble offers a Retry action
 */
export type ChatBubbleStatus = "sent" | "sending" | "failed";

export const createGROUNDING_COLORS = (
  theme: AppTheme,
): Record<Grounding, { bg: string; text: string }> => ({
  source: { bg: theme.colors.infoContainer, text: theme.colors.onInfoContainer },
  general: { bg: theme.colors.primaryContainer, text: theme.colors.primary },
  mixed: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
  insufficient_source: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
});

export const GROUNDING_LABEL_KEYS: Record<Grounding, string> = {
  source: "chat.groundingSource",
  general: "chat.groundingGeneral",
  mixed: "chat.groundingMixed",
  insufficient_source: "chat.groundingInsufficient",
};

export function groundingLabel(grounding: Grounding): string {
  return i18n.t(GROUNDING_LABEL_KEYS[grounding]);
}

interface ChatBubbleProps {
  message: Message;
  status?: ChatBubbleStatus;
  /** Id of the source the conversation is grounded in (used by citations). */
  sourceId?: string | null;
  /** Called when the user taps Retry on a failed bubble. */
  onRetry?: () => void;
  /** Called when a suggested follow-up chip is tapped. */
  onFollowUpPress?: (suggestion: string) => void;
  style?: ViewStyle;
}

export function ChatBubble({
  message,
  status = "sent",
  sourceId,
  onRetry,
  onFollowUpPress,
  style,
}: ChatBubbleProps) {
  const theme = useTheme();
  const GROUNDING_COLORS = createGROUNDING_COLORS(theme);
  const styles = createStyles(theme);
  const isUser = message.role === "user";
  const isSending = status === "sending";
  const isFailed = status === "failed";

  return (
    <View style={[styles.messageWrapper, style]}>
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.assistantMessage,
          isFailed && styles.failedMessage,
        ]}
        accessibilityLabel={message.content}
      >
        <Text
          style={[
            { color: theme.colors.onSurface },
            isUser ? styles.userMessageText : styles.assistantMessageText,
          ]}
        >
          {message.content}
        </Text>

        {isSending && (
          <View style={styles.statusRow} accessibilityLabel={i18n.t("chat.sending")}>
            <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
            <Text style={[{ color: theme.colors.onSurface }, styles.statusText]}>
              {i18n.t("chat.sending")}
            </Text>
          </View>
        )}

        {isFailed && (
          <View style={styles.statusRow}>
            <Text style={[{ color: theme.colors.onSurface }, styles.failedText]}>
              {i18n.t("chat.failedToSend")}
            </Text>
            {onRetry && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetry}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={i18n.t("chat.retrySend")}
                testID="chat-bubble-retry"
              >
                <Text style={[{ color: theme.colors.onSurface }, styles.retryButtonText]}>
                  {i18n.t("common.retry")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!isUser && message.grounding && (
          <View
            style={[
              styles.groundingBadge,
              { backgroundColor: GROUNDING_COLORS[message.grounding].bg },
            ]}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: GROUNDING_COLORS[message.grounding].text },
              ]}
            >
              {groundingLabel(message.grounding)}
            </Text>
          </View>
        )}

        {!isUser && message.citations && message.citations.length > 0 && (
          <View style={styles.citationsContainer}>
            {message.citations.map((ref) => (
              <SourceRefChip
                key={`${ref.chunkId}-${ref.page ?? "null"}`}
                sourceRef={ref}
                sourceId={sourceId}
              />
            ))}
          </View>
        )}

        {!isUser && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
          <View style={styles.suggestedChips}>
            {message.suggestedFollowUps.map((suggestion) => (
              <TouchableOpacity
                key={`suggestion-${suggestion}`}
                style={styles.suggestedChip}
                onPress={() => onFollowUpPress?.(suggestion)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={[{ color: theme.colors.onSurface }, styles.suggestedChipText]}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    messageWrapper: {
      marginBottom: 12,
    },
    messageBubble: {
      maxWidth: "85%",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: tokens.radii.lg,
    },
    userMessage: {
      alignSelf: "flex-end",
      backgroundColor: theme.colors.primary,
    },
    assistantMessage: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    failedMessage: {
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    userMessageText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.onPrimary,
    },
    assistantMessageText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.onSurface,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
    statusText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    failedText: {
      fontSize: 12,
      color: theme.colors.onErrorContainer,
      flexShrink: 1,
    },
    retryButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.radii.full,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    retryButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.onErrorContainer,
    },
    groundingBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.full,
      marginTop: 8,
    },
    citationsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 8,
    },
    suggestedChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 4,
    },
    suggestedChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: tokens.radii.full,
      borderWidth: 1,
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: theme.colors.outlineVariant,
    },
    suggestedChipText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
    },
  });
