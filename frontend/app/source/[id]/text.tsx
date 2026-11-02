import { getSourceText } from "@/api/endpoints/sources";
import { Source, type SourceChunk } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { PrimaryButton } from "@/components/ui/Buttons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MarkdownLiteText } from "@/components/ui/MarkdownLiteText";
import i18n from "@/i18n";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
    chunkItem: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceVariant,
    },
    chunkHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    chunkIndex: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: tokens.radii.full,
    },
    chunkPage: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: tokens.radii.full,
    },
    chunkText: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.onSurface,
    },
    highlight: {
      backgroundColor: theme.colors.warning,
      borderRadius: 2,
    },
    emptyState: {
      paddingVertical: 60,
      alignItems: "center",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
  });

export default function SourceTextScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { isAuthenticated } = useAuth();
  const { id, chunk } = useLocalSearchParams<{ id: string; chunk?: string }>();
  const [chunks, setChunks] = useState<SourceChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [highlightChunkId, setHighlightChunkId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<SourceChunk>>(null);

  const fetchChunks = useCallback(
    async (reset = false) => {
      try {
        const res = await getSourceText(id, {
          limit: 50,
          cursor: reset ? undefined : (cursor ?? undefined),
        });
        if (reset) {
          setChunks(res.items);
        } else {
          setChunks((prev) => [...prev, ...res.items]);
        }
        setCursor(res.nextCursor);
        setHasMore(!!res.nextCursor);
        setError(null);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, cursor],
  );

  const onRefresh = useCallback(() => {
    haptics.light();
    fetchChunks(true);
  }, [fetchChunks]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loading) {
      fetchChunks(false);
    }
  }, [hasMore, loading, fetchChunks]);

  useEffect(() => {
    if (chunk) setHighlightChunkId(chunk);
    fetchChunks(true);
  }, [fetchChunks, chunk]);

  const renderChunk = ({ item, index }: { item: SourceChunk; index: number }) => {
    const isHighlighted = item.id === highlightChunkId;
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.chunkItem}
        onPress={() => setHighlightChunkId(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.chunkHeader}>
          <Text style={[{ color: theme.colors.onSurface }, styles.chunkIndex]}>c{item.index}</Text>
          {item.page !== null && (
            <Text style={[{ color: theme.colors.onSurface }, styles.chunkPage]}>p{item.page}</Text>
          )}
        </View>
        <MarkdownLiteText
          content={item.text}
          style={
            [
              styles.chunkText,
              { color: theme.colors.onSurface },
              isHighlighted
                ? {
                    backgroundColor: theme.colors.warningContainer,
                    color: theme.colors.onWarningContainer,
                    borderRadius: 4,
                    padding: 4,
                  }
                : null,
            ].filter(Boolean) as any
          }
          selectable={true}
        />
      </TouchableOpacity>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
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
          {i18n.t("source.sourceTextTitle")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && chunks.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.onSurfaceVariant }]}
          >
            {i18n.t("common.loading")}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={chunks}
          renderItem={renderChunk}
          keyExtractor={(item) => item.id}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <EmptyState
              style={styles.emptyState}
              illustration="📄"
              title={i18n.t("common.empty")}
              description={i18n.t("common.empty")}
            />
          }
        />
      )}

      {error && chunks.length === 0 ? (
        <ErrorState error={error} onRetry={() => fetchChunks(true)} />
      ) : null}
    </SafeAreaView>
  );
}
