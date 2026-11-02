import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

const SOURCE_STAGES = [
  "validating",
  "normalizing_images",
  "extracting_text",
  "ocr",
  "chunking",
  "finalizing",
] as const;

const GENERATE_STAGES = ["preparing_context", "generating", "validating_output", "saving"] as const;

interface ProgressStepsProps {
  stage: string | null;
  progress: number; // 0..100
  type?: "source_processing" | "generate";
  detail?: { page?: number; pagesTotal?: number } | null;
  style?: ViewStyle;
}

export function ProgressSteps({
  stage,
  progress,
  type = "source_processing",
  detail,
  style,
}: ProgressStepsProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const stages = (
    type === "source_processing" ? SOURCE_STAGES : GENERATE_STAGES
  ) as readonly string[];
  const currentStageIndex = stage ? stages.indexOf(stage) : 0;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: progress }}
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        style,
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.progressText, { color: theme.colors.primary }],
          ]}
        >
          {Math.round(progress)}%
        </Text>
        {detail?.page && detail?.pagesTotal && (
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.detailText, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {detail.page}/{detail.pagesTotal}
          </Text>
        )}
      </View>

      <View style={[styles.progressBarBg, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: theme.colors.primary,
              width: `${Math.min(Math.max(progress, 0), 100)}%`,
            },
          ]}
        />
      </View>

      <View style={styles.stepsList}>
        {stages.map((stg, index) => {
          const isDone = index < currentStageIndex || progress >= 100;
          const isCurrent = index === currentStageIndex && progress < 100;
          const stageKey = `enums.stages.${stg}`;
          const label = i18n.exists(stageKey) ? i18n.t(stageKey) : stg;

          return (
            <View key={stg} style={styles.stepRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isDone
                      ? theme.colors.primary
                      : isCurrent
                        ? theme.colors.secondary
                        : theme.colors.outlineVariant,
                  },
                ]}
              >
                {isDone && <Text style={[{ color: theme.colors.onSurface }, styles.check]}>✓</Text>}
              </View>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [
                    styles.stepLabel,
                    {
                      color: isCurrent
                        ? theme.colors.onSurface
                        : isDone
                          ? theme.colors.onSurfaceVariant
                          : theme.colors.outline,
                      fontWeight: isCurrent ? "700" : "500",
                    },
                  ],
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: 20,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      marginVertical: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    progressText: {
      fontSize: 20,
      fontWeight: "700",
    },
    detailText: {
      fontSize: 14,
      fontWeight: "500",
    },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 16,
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    stepsList: {
      gap: 10,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    dot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    check: {
      color: theme.colors.onPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    stepLabel: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
