import type { SourceRef } from "@/api/types";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, type ViewStyle } from "react-native";

interface SourceRefChipProps {
  sourceRef: SourceRef;
  sourceId?: string | null;
  style?: ViewStyle;
}

export function SourceRefChip({ sourceRef, sourceId, style }: SourceRefChipProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  if (!sourceId) return null;

  const handlePress = () => {
    haptics.light();
    router.push({
      pathname: "/source/[id]/text",
      params: { id: sourceId, chunk: sourceRef.chunkId },
    });
  };

  const label = sourceRef.page !== null ? `หน้า ${sourceRef.page}` : sourceRef.chunkId;

  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={`อ้างอิง ${label}`}
      activeOpacity={0.7}
      onPress={handlePress}
      style={[
        styles.chip,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
    >
      <Text
        style={[{ color: theme.colors.onSurface }, [styles.text, { color: theme.colors.primary }]]}
      >
        📎 {label}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.radii.full,
      borderWidth: 1,
      alignSelf: "flex-start",
      marginRight: 6,
      marginBottom: 4,
    },
    text: {
      fontSize: 12,
      fontWeight: "600",
    },
  });
