import type { FlashcardItem } from "@/api/types";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { SourceRefChip } from "./SourceRefChip";

interface FlashCardProps {
  card: FlashcardItem;
  sourceId?: string | null;
  style?: ViewStyle;
}

export function FlashCard({ card, sourceId, style }: FlashCardProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleFlip = () => {
    haptics.light();
    setIsFlipped(!isFlipped);
  };

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleFlip}
        accessibilityRole="button"
        accessibilityLabel={
          isFlipped ? `ด้านหลังบัตรคำ: ${card.back}` : `ด้านหน้าบัตรคำ: ${card.front}. แตะเพื่อดูคำตอบ`
        }
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isFlipped ? theme.colors.primary : theme.colors.outlineVariant,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.sideBadge,
              {
                backgroundColor: isFlipped
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
              },
            ]}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.badgeText,
                  {
                    color: isFlipped
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurfaceVariant,
                  },
                ],
              ]}
            >
              {isFlipped ? "คำตอบ (Back)" : "คำถาม (Front)"}
            </Text>
          </View>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.flipHint, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {i18n.t("study.flipHint")}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [
                styles.mainText,
                {
                  color: theme.colors.onSurface,
                  fontSize: isFlipped ? 20 : 22,
                },
              ],
            ]}
          >
            {isFlipped ? card.back : card.front}
          </Text>

          {!isFlipped && card.hint && (
            <View style={styles.hintContainer}>
              {showHint ? (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [styles.hintText, { color: theme.colors.secondary }],
                  ]}
                >
                  💡 {card.hint}
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowHint(true);
                  }}
                  style={styles.hintButton}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.hintBtnText, { color: theme.colors.secondary }],
                    ]}
                  >
                    💡 {i18n.t("study.hint")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isFlipped && card.sourceRefs && card.sourceRefs.length > 0 && (
            <View style={styles.refsContainer}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.refLabel, { color: theme.colors.onSurfaceVariant }],
                ]}
              >
                {i18n.t("study.sourceReference")}:
              </Text>
              <View style={styles.refChips}>
                {card.sourceRefs.map((ref) => (
                  <SourceRefChip
                    key={`${ref.chunkId}-${ref.page ?? "null"}`}
                    sourceRef={ref}
                    sourceId={sourceId}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrapper: {
      width: "100%",
      minHeight: 280,
    },
    card: {
      flex: 1,
      minHeight: 280,
      borderRadius: tokens.radii["2xl"],
      borderWidth: 2,
      padding: 20,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    badgeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sideBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.radii.sm,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    flipHint: {
      fontSize: 12,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    mainText: {
      fontWeight: "600",
      lineHeight: 34,
      textAlign: "center",
    },
    hintContainer: {
      marginTop: 20,
      alignItems: "center",
    },
    hintButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    hintBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
    hintText: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
    },
    refsContainer: {
      marginTop: 24,
      borderTopWidth: 1,
      borderTopColor: "rgba(0,0,0,0.06)",
      paddingTop: 12,
    },
    refLabel: {
      fontSize: 12,
      fontWeight: "500",
      marginBottom: 6,
    },
    refChips: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
  });
