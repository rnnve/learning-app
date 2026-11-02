import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  /**
   * When set, the user has to type this exact text before the confirm button
   * becomes active (contract Section 8: type-to-confirm "DELETE").
   */
  requiredConfirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = i18n.t("common.ok"),
  cancelLabel = i18n.t("common.cancel"),
  isDestructive = false,
  requiredConfirmText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    if (!visible) setTypedText("");
  }, [visible]);

  const canConfirm = !requiredConfirmText || typedText === requiredConfirmText;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.title, { color: theme.colors.onSurface }],
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.message, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {message}
          </Text>

          {requiredConfirmText ? (
            <>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.hint, { color: theme.colors.onSurfaceVariant }],
                ]}
              >
                {i18n.t("settings.deleteTypePrompt")}
              </Text>
              <TextInput
                value={typedText}
                onChangeText={setTypedText}
                placeholder={requiredConfirmText}
                placeholderTextColor={theme.colors.outline}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[
                  { color: theme.colors.onSurface },
                  [
                    styles.input,
                    {
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outline,
                      backgroundColor: theme.colors.background,
                    },
                  ],
                ]}
                testID="confirm-dialog-input"
              />
            </>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.button}
              onPress={onCancel}
              testID="confirm-dialog-cancel"
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.cancelText, { color: theme.colors.onSurfaceVariant }],
                ]}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={handleConfirm}
              disabled={!canConfirm}
              accessibilityState={{ disabled: !canConfirm }}
              testID="confirm-dialog-confirm"
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [
                    styles.confirmText,
                    {
                      color: canConfirm
                        ? isDestructive
                          ? theme.colors.error
                          : theme.colors.primary
                        : theme.colors.outline,
                    },
                  ],
                ]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    dialog: {
      width: "100%",
      maxWidth: 340,
      borderRadius: tokens.radii.xl,
      padding: 24,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 20,
    },
    hint: {
      fontSize: 13,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderRadius: tokens.radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      marginBottom: 20,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 16,
    },
    button: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: "600",
    },
    confirmText: {
      fontSize: 16,
      fontWeight: "700",
    },
  });
