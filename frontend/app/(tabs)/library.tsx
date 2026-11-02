import { deleteMaterial, deleteSource, getMaterials, getSources } from "@/api/endpoints/library";
import type { MaterialSummary, Source } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import i18n from "@/i18n";
import { formatBytes, formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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
    segmentControl: {
      flexDirection: "row",
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: tokens.radii.xl,
      padding: 4,
      marginHorizontal: 20,
      marginBottom: 16,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: tokens.radii.lg,
      alignItems: "center",
    },
    segmentButtonActive: {
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentLabel: {
      fontSize: 14,
      fontWeight: "600",
    },
    searchContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    searchInput: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: tokens.radii.xl,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 12,
      overflow: "hidden",
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: tokens.radii.full,
      borderWidth: 1,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipInactive: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: "500",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },
    itemCard: {
      marginBottom: 12,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    itemIcon: {
      width: 48,
      height: 48,
      borderRadius: tokens.radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    itemMeta: {
      fontSize: 12,
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    itemActions: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
    },
    actionButtonPrimary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    emptyState: {
      paddingVertical: 60,
      alignItems: "center",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.full,
      fontSize: 11,
      fontWeight: "600",
    },
    fixtureBadge: {
      fontSize: 10,
      color: theme.colors.onWarningContainer,
      backgroundColor: theme.colors.warningContainer,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: tokens.radii.full,
      marginTop: 4,
    },
  });

type TabType = "sources" | "materials" | "saved";
type MaterialFilterType = "all" | "summary" | "flashcards" | "quiz";

export default function LibraryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("sources");
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [materialFilter, setMaterialFilter] = useState<MaterialFilterType>("all");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const sourcesCursor = useRef<string | undefined>(undefined);
  const materialsCursor = useRef<string | undefined>(undefined);
  const [hasMoreSources, setHasMoreSources] = useState(true);
  const [hasMoreMaterials, setHasMoreMaterials] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "source" | "material";
    id: string;
    keepMaterials?: boolean;
  } | null>(null);

  const fetchSources = useCallback(
    async (reset = false) => {
      try {
        const res = await getSources({
          q: searchQuery || undefined,
          limit: 20,
          cursor: reset ? undefined : sourcesCursor.current,
        });
        if (reset) {
          setSources(res.items);
        } else {
          setSources((prev) => [...prev, ...res.items]);
        }
        sourcesCursor.current = res.nextCursor ?? undefined;
        setHasMoreSources(!!res.nextCursor);
        setError(null);
      } catch (err: any) {
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [searchQuery],
  );

  const fetchMaterials = useCallback(
    async (reset = false) => {
      try {
        const res = await getMaterials({
          type: materialFilter === "all" ? undefined : materialFilter,
          saved: showSavedOnly || undefined,
          q: searchQuery || undefined,
          limit: 20,
          cursor: reset ? undefined : materialsCursor.current,
        });
        if (reset) {
          setMaterials(res.items);
        } else {
          setMaterials((prev) => [...prev, ...res.items]);
        }
        materialsCursor.current = res.nextCursor ?? undefined;
        setHasMoreMaterials(!!res.nextCursor);
        setError(null);
      } catch (err: any) {
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [materialFilter, showSavedOnly, searchQuery],
  );

  const onRefresh = useCallback(() => {
    haptics.light();
    setRefreshing(true);
    if (activeTab === "sources") {
      fetchSources(true);
    } else {
      fetchMaterials(true);
    }
  }, [activeTab, fetchSources, fetchMaterials]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "sources") {
        fetchSources(true);
      } else {
        fetchMaterials(true);
      }
      const timer = setInterval(() => {
        if (activeTab === "sources") fetchSources(true);
        else fetchMaterials(true);
      }, 4000);
      return () => clearInterval(timer);
    }, [activeTab, fetchSources, fetchMaterials]),
  );

  const handleDeleteSource = (source: Source) => {
    setDeleteConfirm({ type: "source", id: source.id });
  };

  const handleDeleteMaterial = (material: MaterialSummary) => {
    setDeleteConfirm({ type: "material", id: material.id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "source") {
        await deleteSource(deleteConfirm.id, deleteConfirm.keepMaterials);
        setSources((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      } else {
        await deleteMaterial(deleteConfirm.id);
        setMaterials((prev) => prev.filter((m) => m.id !== deleteConfirm.id));
      }
      haptics.success();
    } catch (err: any) {
      setError(err);
    }
    setDeleteConfirm(null);
  };

  const getStatusColors = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      ready: { bg: theme.colors.successContainer, text: theme.colors.onSuccessContainer },
      partial: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
      failed: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
      processing: { bg: theme.colors.infoContainer, text: theme.colors.onInfoContainer },
      queued: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
    };
    const colors = map[status] || {
      bg: theme.colors.surfaceVariant,
      text: theme.colors.onSurfaceVariant,
    };
    return { backgroundColor: colors.bg, color: colors.text };
  };

  if (!isAuthenticated) return null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 104 }}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.title, { color: theme.colors.onSurface }],
          ]}
        >
          {i18n.t("navigation.library")}
        </Text>
      </View>

      <View style={[styles.segmentControl, { backgroundColor: theme.colors.surfaceVariant }]}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeTab === "sources" && styles.segmentButtonActive,
            activeTab === "sources" && { backgroundColor: theme.colors.surface },
          ]}
          onPress={() => setActiveTab("sources")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "sources" }}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [
                styles.segmentLabel,
                {
                  color:
                    activeTab === "sources" ? theme.colors.primary : theme.colors.onSurfaceVariant,
                },
              ],
            ]}
          >
            {i18n.t("library.tabSources")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeTab === "materials" && styles.segmentButtonActive,
            activeTab === "materials" && { backgroundColor: theme.colors.surface },
          ]}
          onPress={() => setActiveTab("materials")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "materials" }}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [
                styles.segmentLabel,
                {
                  color:
                    activeTab === "materials"
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                },
              ],
            ]}
          >
            {i18n.t("library.tabMaterials")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeTab === "saved" && styles.segmentButtonActive,
            activeTab === "saved" && { backgroundColor: theme.colors.surface },
          ]}
          onPress={() => setActiveTab("saved")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "saved" }}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [
                styles.segmentLabel,
                {
                  color:
                    activeTab === "saved" ? theme.colors.primary : theme.colors.onSurfaceVariant,
                },
              ],
            ]}
          >
            {i18n.t("library.tabSaved")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            { color: theme.colors.onSurface },
            [
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
                color: theme.colors.onSurface,
              },
            ],
          ]}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          placeholder={i18n.t("library.searchPlaceholder")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => {
            if (activeTab === "sources") fetchSources(true);
            else fetchMaterials(true);
          }}
          accessibilityLabel={i18n.t("library.searchPlaceholder")}
        />
      </View>

      {activeTab === "materials" && (
        <ScrollView horizontal style={styles.filterRow} showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              materialFilter === "all" && styles.filterChipActive,
              materialFilter !== "all" && styles.filterChipInactive,
            ]}
            onPress={() => setMaterialFilter("all")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.filterChipText,
                  {
                    color: materialFilter === "all" ? theme.colors.surface : theme.colors.onSurface,
                  },
                ],
              ]}
            >
              {i18n.t("common.filter")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              materialFilter === "summary" && styles.filterChipActive,
              materialFilter !== "summary" && styles.filterChipInactive,
            ]}
            onPress={() => setMaterialFilter("summary")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.filterChipText,
                  {
                    color:
                      materialFilter === "summary" ? theme.colors.surface : theme.colors.onSurface,
                  },
                ],
              ]}
            >
              {i18n.t("enums.materialTypes.summary")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              materialFilter === "flashcards" && styles.filterChipActive,
              materialFilter !== "flashcards" && styles.filterChipInactive,
            ]}
            onPress={() => setMaterialFilter("flashcards")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.filterChipText,
                  {
                    color:
                      materialFilter === "flashcards"
                        ? theme.colors.surface
                        : theme.colors.onSurface,
                  },
                ],
              ]}
            >
              {i18n.t("enums.materialTypes.flashcards")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              materialFilter === "quiz" && styles.filterChipActive,
              materialFilter !== "quiz" && styles.filterChipInactive,
            ]}
            onPress={() => setMaterialFilter("quiz")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.filterChipText,
                  {
                    color:
                      materialFilter === "quiz" ? theme.colors.surface : theme.colors.onSurface,
                  },
                ],
              ]}
            >
              {i18n.t("enums.materialTypes.quiz")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {activeTab === "materials" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => setShowSavedOnly(!showSavedOnly)}
            style={[
              styles.filterChip,
              showSavedOnly ? styles.filterChipActive : styles.filterChipInactive,
            ]}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.filterChipText,
                  { color: showSavedOnly ? theme.colors.surface : theme.colors.onSurface },
                ],
              ]}
            >
              ⭐ {i18n.t("library.tabSaved")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === "sources" ? (
        <View style={styles.listContent}>
          {sources.length > 0 ? (
            sources.map((source) => (
              <View
                key={source.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.itemHeader}>
                  <View
                    style={[styles.itemIcon, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Text style={[{ color: theme.colors.onSurface }, { fontSize: 22 }]}>
                      {source.kind === "images"
                        ? "📷"
                        : source.kind === "pdf"
                          ? "📄"
                          : source.kind === "docx"
                            ? "📝"
                            : "📄"}
                    </Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.itemTitle, { color: theme.colors.onSurface }],
                      ]}
                      numberOfLines={2}
                    >
                      {source.title}
                    </Text>
                    <View style={styles.itemMeta}>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {formatDate(source.createdAt, i18n.language as "th" | "en")}
                      </Text>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {source.pageCount}{" "}
                        {i18n.t("source.pagesCount", { count: source.pageCount })}
                      </Text>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {formatBytes(source.sizeBytes)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, getStatusColors(source.status)]}>
                    <Text style={{ color: theme.colors.onSurface }}>
                      {i18n.t(`enums.sourceStatuses.${source.status}`)}
                    </Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={() => router.push(`/source/${source.id}`)}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.actionButtonText, { color: theme.colors.primary }],
                      ]}
                    >
                      {i18n.t("common.viewAll")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.actionButtonPrimary,
                      source.status !== "ready" && source.status !== "partial" && { opacity: 0.45 },
                    ]}
                    disabled={source.status !== "ready" && source.status !== "partial"}
                    onPress={() => router.push(`/source/${source.id}/generate?type=summary`)}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.actionButtonText, { color: theme.colors.onPrimary }],
                      ]}
                    >
                      {i18n.t("source.generateSummary")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.actionButtonSecondary,
                      { borderColor: theme.colors.error },
                    ]}
                    onPress={() => handleDeleteSource(source)}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.actionButtonText, { color: theme.colors.error }],
                      ]}
                    >
                      {i18n.t("common.delete")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              style={styles.emptyState}
              icon="📷"
              title={i18n.t("library.emptySources")}
              description={i18n.t("library.emptySources")}
              actionLabel={i18n.t("home.scanAction")}
              onAction={() => router.push("/capture")}
            />
          )}
          {hasMoreSources && (
            <TouchableOpacity
              style={{ padding: 16, alignItems: "center" }}
              onPress={() => fetchSources(false)}
              disabled={refreshing}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: theme.colors.primary, fontWeight: "600" },
                ]}
              >
                {i18n.t("common.viewAll")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : activeTab === "materials" ? (
        <View style={styles.listContent}>
          {materials.length > 0 ? (
            materials.map((material) => (
              <View
                key={material.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.itemHeader}>
                  <View
                    style={[styles.itemIcon, { backgroundColor: `${theme.colors.secondary}20` }]}
                  >
                    <Text style={[{ color: theme.colors.onSurface }, { fontSize: 22 }]}>
                      {material.type === "summary"
                        ? "📄"
                        : material.type === "flashcards"
                          ? "🃏"
                          : "❓"}
                    </Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.itemTitle, { color: theme.colors.onSurface }],
                      ]}
                      numberOfLines={2}
                    >
                      {material.title}
                    </Text>
                    <View style={styles.itemMeta}>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {i18n.t(`enums.materialTypes.${material.type}`)}
                      </Text>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {material.itemCount}{" "}
                        {material.type === "flashcards"
                          ? i18n.t("material.cardsCount", { count: material.itemCount })
                          : i18n.t("material.questionsCount", { count: material.itemCount })}
                      </Text>
                      {material.isSaved && (
                        <Text
                          style={[
                            { color: theme.colors.onSurface },
                            { color: theme.colors.primary, fontWeight: "600" },
                          ]}
                        >
                          ⭐
                        </Text>
                      )}
                      {material.generatedBy.mode === "fixture" && (
                        <Text style={[{ color: theme.colors.onSurface }, styles.fixtureBadge]}>
                          FIXTURE
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={() => router.push(`/material/${material.id}`)}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.actionButtonText, { color: theme.colors.primary }],
                      ]}
                    >
                      {i18n.t("common.viewAll")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      material.isSaved ? styles.actionButtonPrimary : styles.actionButtonSecondary,
                    ]}
                    onPress={async () => {
                      // Toggle saved
                      try {
                        await fetch(`/v1/materials/${material.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isSaved: !material.isSaved }),
                        });
                        setMaterials((prev) =>
                          prev.map((m) =>
                            m.id === material.id ? { ...m, isSaved: !m.isSaved } : m,
                          ),
                        );
                        haptics.light();
                      } catch {
                        // Error handled silently
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [
                          styles.actionButtonText,
                          { color: material.isSaved ? theme.colors.surface : theme.colors.primary },
                        ],
                      ]}
                    >
                      {material.isSaved ? i18n.t("common.save") : i18n.t("common.save")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.actionButtonSecondary,
                      { borderColor: theme.colors.error },
                    ]}
                    onPress={() => handleDeleteMaterial(material)}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.actionButtonText, { color: theme.colors.error }],
                      ]}
                    >
                      {i18n.t("common.delete")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              style={styles.emptyState}
              icon="📄"
              title={i18n.t("library.emptyMaterials")}
              description={i18n.t("library.emptyMaterials")}
              actionLabel={i18n.t("home.scanAction")}
              onAction={() => router.push("/capture")}
            />
          )}
          {hasMoreMaterials && (
            <TouchableOpacity
              style={{ padding: 16, alignItems: "center" }}
              onPress={() => fetchMaterials(false)}
              disabled={refreshing}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: theme.colors.primary, fontWeight: "600" },
                ]}
              >
                {i18n.t("common.viewAll")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.listContent}>
          <EmptyState
            style={styles.emptyState}
            icon="⭐"
            title={i18n.t("library.emptySaved")}
            description={i18n.t("library.emptySaved")}
          />
        </View>
      )}

      {error ? <ErrorState error={error} onRetry={onRefresh} /> : null}

      {deleteConfirm && (
        <ConfirmDialog
          visible={true}
          title={
            deleteConfirm.type === "source"
              ? i18n.t("source.deleteConfirmTitle")
              : i18n.t("material.deleteTitle")
          }
          message={
            deleteConfirm.type === "source"
              ? i18n.t("source.deleteConfirmDesc")
              : i18n.t("material.deleteDesc")
          }
          confirmLabel={i18n.t("common.delete")}
          cancelLabel={i18n.t("common.cancel")}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          isDestructive
        />
      )}
    </ScrollView>
  );
}
