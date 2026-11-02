import { authHeaders, sourceFileUrl } from "@/api/client";
import { deleteSource, getSource, retrySource } from "@/api/endpoints/sources";
import { getSourceText } from "@/api/endpoints/sources";
import { localizeErrorBody } from "@/api/errors";
import { type ExtractionWarning, type Source, SourceChunk } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { SourceRefChip } from "@/components/ui/SourceRefChip";
import { useJob } from "@/features/sources/useJob";
import i18n from "@/i18n";
import { formatBytes, formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
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
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 120,
    },
    sourceCard: {
      marginBottom: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    sourceHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
    },
    sourceIcon: {
      width: 56,
      height: 56,
      borderRadius: tokens.radii.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    sourceInfo: {
      flex: 1,
    },
    sourceTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    sourceMeta: {
      fontSize: 13,
      flexDirection: "row",
      gap: 16,
      flexWrap: "wrap",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.radii.full,
      fontSize: 11,
      fontWeight: "600",
    },
    extractionCard: {
      marginBottom: 16,
      padding: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
    },
    extractionTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 12,
    },
    extractionStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    extractionStatusText: {
      flex: 1,
    },
    qualityBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.radii.full,
      fontSize: 11,
      fontWeight: "600",
    },
    warningItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      marginBottom: 8,
    },
    warningIcon: {
      fontSize: 16,
      marginTop: 1,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.onWarningContainer,
    },
    previewSection: {
      marginBottom: 16,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
    },
    imagePager: {
      height: 300,
      borderRadius: tokens.radii.xl,
      overflow: "hidden",
      marginBottom: 12,
    },
    imagePage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    previewImage: {
      width: "100%",
      height: "100%",
    },
    textPreview: {
      padding: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      maxHeight: 200,
    },
    textPreviewContent: {
      fontSize: 14,
      lineHeight: 22,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    actionButton: {
      flex: 1,
    },
    partialNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      marginBottom: 12,
    },
    partialNoticeText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.onWarningContainer,
    },
    deleteConfirmText: {
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 8,
    },
    keepMaterialsLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      paddingVertical: 8,
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
    modalButtonTextCancel: {
      color: theme.colors.onSurfaceVariant,
    },
    modalButtonTextConfirm: {
      color: theme.colors.onPrimary,
    },
  });

const createSTATUS_COLORS = (theme: AppTheme): Record<string, { bg: string; text: string }> => ({
  ready: { bg: theme.colors.successContainer, text: theme.colors.onSuccessContainer },
  partial: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
  failed: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
  processing: { bg: theme.colors.infoContainer, text: theme.colors.onInfoContainer },
  queued: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
});

const createQUALITY_COLORS = (theme: AppTheme): Record<string, { bg: string; text: string }> => ({
  good: { bg: theme.colors.successContainer, text: theme.colors.onSuccessContainer },
  fair: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
  poor: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
  unreadable: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
});

const KIND_ICONS: Record<string, string> = {
  images: "📷",
  pdf: "📄",
  docx: "📝",
  txt: "📄",
};

const WARNING_MESSAGES: Record<string, string> = {
  OCR_PAGE_CAP: i18n.t("enums.warnings.OCR_PAGE_CAP"),
  EMBEDDED_IMAGES_NOT_ANALYZED: i18n.t("enums.warnings.EMBEDDED_IMAGES_NOT_ANALYZED"),
  UNSUPPORTED_IMAGE_FORMAT: i18n.t("enums.warnings.UNSUPPORTED_IMAGE_FORMAT"),
  LOW_CONTRAST: i18n.t("enums.warnings.LOW_CONTRAST"),
  PARTIAL_PAGE_READ: i18n.t("enums.warnings.PARTIAL_PAGE_READ"),
  TABLE_STRUCTURE_SIMPLIFIED: i18n.t("enums.warnings.TABLE_STRUCTURE_SIMPLIFIED"),
};

export default function SourceScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const STATUS_COLORS = createSTATUS_COLORS(theme);
  const QUALITY_COLORS = createQUALITY_COLORS(theme);
  const { isAuthenticated, user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [keepMaterials, setKeepMaterials] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // Poll the processing job so the extraction progress is live (contract 3.7).
  const { job } = useJob(jobId);

  const fetchSource = useCallback(async () => {
    try {
      const res = await getSource(id);
      setSource(res);
      setJobId(res.jobId);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSource();
  }, [fetchSource]);

  // When processing ends, pull the source again so the extraction status,
  // page counts and warnings are current (contract 9.4).
  useEffect(() => {
    if (job?.status === "succeeded" || job?.status === "failed" || job?.status === "canceled") {
      fetchSource();
    }
  }, [job?.status, fetchSource]);

  const onRefresh = useCallback(() => {
    haptics.light();
    fetchSource();
  }, [fetchSource]);

  const handleRetry = useCallback(async () => {
    if (!source) return;
    haptics.medium();
    try {
      const res = await retrySource(source.id);
      setSource(res.source);
      setJobId(res.job.id);
    } catch (err: any) {
      setError(err);
    }
  }, [source]);

  const handleDelete = useCallback(async () => {
    if (!source) return;
    try {
      await deleteSource(source.id, keepMaterials);
      haptics.success();
      router.back();
    } catch (err: any) {
      setError(err);
    }
    setShowDeleteConfirm(false);
  }, [source, keepMaterials]);

  const getStatusColors = (status: string) =>
    STATUS_COLORS[status] || {
      bg: theme.colors.surfaceVariant,
      text: theme.colors.onSurfaceVariant,
    };
  const getQualityColors = (quality: string) =>
    QUALITY_COLORS[quality] || {
      bg: theme.colors.surfaceVariant,
      text: theme.colors.onSurfaceVariant,
    };

  if (!isAuthenticated) return null;

  if (loading && !source) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.onSurfaceVariant }]}
          >
            {i18n.t("common.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!source) {
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
            {i18n.t("source.previewTitle")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorState error={error || "errors.NOT_FOUND"} onRetry={fetchSource} />
      </SafeAreaView>
    );
  }

  const isProcessing = source.status === "queued" || source.status === "processing";
  const isReady = source.status === "ready" || source.status === "partial";
  const isFailed = source.status === "failed";

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
        <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]} numberOfLines={2}>
          {source.title}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {source.status === "ready" && source.extraction?.method === "direct_text" && (
          <Banner
            message={i18n.t("home.fixtureBanner")}
            variant="fixture"
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Source Card */}
        <View
          style={[
            styles.sourceCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
          ]}
        >
          <View style={styles.sourceHeader}>
            <View style={[styles.sourceIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[{ color: theme.colors.onSurface }, { fontSize: 28 }]}>
                {KIND_ICONS[source.kind] || "📄"}
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
              <View style={styles.sourceMeta}>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {i18n.t(`enums.sourceKinds.${source.kind}`)}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatBytes(source.sizeBytes)}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {source.pageCount} {i18n.t("source.pagesCount", { count: source.pageCount })}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatDate(source.createdAt, i18n.language as "th" | "en")}
                </Text>
              </View>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: getStatusColors(source.status).bg }]}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: getStatusColors(source.status).text },
                ]}
              >
                {i18n.t(`enums.sourceStatuses.${source.status}`)}
              </Text>
            </View>
          </View>

          {/* Processing Progress */}
          {isProcessing && jobId && (
            <ProgressSteps
              stage={
                job?.stage ??
                (source.extraction?.method === "vision_ocr" ? "ocr" : "extracting_text")
              }
              progress={job?.progress ?? 0}
              detail={job?.detail ?? null}
              type="source_processing"
            />
          )}

          {/* Extraction Status */}
          {isReady && (
            <View
              style={[
                styles.extractionCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.extractionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("source.chunksCount", { count: source.extraction?.pagesExtracted || 0 })}
              </Text>
              <View style={styles.extractionStatus}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.onSurface, fontWeight: "600" },
                    ]}
                  >
                    {source.status === "ready"
                      ? i18n.t("source.extractionSuccess")
                      : i18n.t("source.extractionPartial")}
                  </Text>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.onSurfaceVariant, fontSize: 13 },
                    ]}
                  >
                    {i18n.t("source.charsCount", { count: source.charCount })} •{" "}
                    {source.extraction?.pagesExtracted}/{source.extraction?.pagesTotal}{" "}
                    {i18n.t("common.pages")}
                  </Text>
                </View>
                {source.extraction?.quality && (
                  <View
                    style={[
                      styles.qualityBadge,
                      { backgroundColor: getQualityColors(source.extraction.quality).bg },
                    ]}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        { color: getQualityColors(source.extraction.quality).text },
                      ]}
                    >
                      {i18n.t(`enums.extractionQuality.${source.extraction.quality}`)}
                    </Text>
                  </View>
                )}
              </View>

              {source.extraction?.pagesFailed && source.extraction.pagesFailed.length > 0 && (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.warning, fontSize: 13, marginBottom: 8 },
                  ]}
                >
                  {i18n.t("source.partialNotice")}{" "}
                  {source.extraction.pagesFailed.map((p) => `p${p}`).join(", ")}
                </Text>
              )}

              {source.extraction?.warnings && source.extraction.warnings.length > 0 && (
                <View>
                  {source.extraction.warnings.map((w: ExtractionWarning, idx: number) => (
                    <View key={`warning-${idx}-${w.code}-${w.page}`} style={styles.warningItem}>
                      <Text style={[{ color: theme.colors.onSurface }, styles.warningIcon]}>⚠️</Text>
                      <Text style={[{ color: theme.colors.onSurface }, styles.warningText]}>
                        {WARNING_MESSAGES[w.code] || w.message}
                        {w.page ? ` (p${w.page})` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {source.status === "partial" && (
                <View style={styles.partialNotice}>
                  <Text style={[{ color: theme.colors.onSurface }, { fontSize: 18 }]}>⚠️</Text>
                  <Text style={[{ color: theme.colors.onSurface }, styles.partialNoticeText]}>
                    {i18n.t("source.partialNotice")}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Failed State */}
          {isFailed && (
            <View
              style={[
                styles.extractionCard,
                { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.error },
              ]}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.extractionTitle, { color: theme.colors.error }],
                ]}
              >
                {i18n.t("source.extractionFailed")}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: theme.colors.onErrorContainer, marginBottom: 12 },
                ]}
              >
                {source.error
                  ? localizeErrorBody(source.error)
                  : i18n.t("errors.EXTRACTION_FAILED")}
              </Text>
              <PrimaryButton
                label={i18n.t("source.retryProcessing")}
                onPress={handleRetry}
                style={{ marginTop: 8 }}
                accessibilityLabel={i18n.t("source.retryProcessing")}
              />
            </View>
          )}

          {/* Preview Section */}
          {isReady && source.kind === "images" && (
            <View style={styles.previewSection}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.previewTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("source.previewTitle")}
              </Text>
              <View
                style={[
                  styles.imagePager,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                  {Array.from(
                    { length: source.pageCount },
                    (_unused, pageNumber) => pageNumber,
                  ).map((pageNumber) => (
                    <View key={pageNumber} style={styles.imagePage}>
                      <Image
                        source={{
                          uri: sourceFileUrl(source.id, pageNumber),
                          headers: authHeaders(),
                        }}
                        style={styles.previewImage}
                        contentFit="contain"
                        transition={200}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outline,
                    borderRadius: tokens.radii.lg,
                    paddingVertical: 12,
                  },
                ]}
                onPress={() => router.push(`/source/${source.id}/text`)}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.primary, fontWeight: "600", fontSize: 15 },
                  ]}
                >
                  {i18n.t("source.fullTextAction")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isReady && source.kind !== "images" && (
            <View style={styles.previewSection}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.previewTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("source.previewTitle")}
              </Text>
              <View
                style={[
                  styles.textPreview,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [styles.textPreviewContent, { color: theme.colors.onSurface }],
                  ]}
                >
                  {i18n.t("source.fullTextAction")}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outline,
                    borderRadius: tokens.radii.lg,
                    paddingVertical: 12,
                  },
                ]}
                onPress={() => router.push(`/source/${source.id}/text`)}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.primary, fontWeight: "600", fontSize: 15 },
                  ]}
                >
                  {i18n.t("source.fullTextAction")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Actions */}
          {isReady && !isProcessing && (
            <View>
              <View style={styles.actionRow}>
                <PrimaryButton
                  label={i18n.t("source.generateSummary")}
                  style={styles.actionButton}
                  onPress={() => router.push(`/source/${source.id}/generate?type=summary`)}
                  accessibilityLabel={i18n.t("source.generateSummary")}
                />
                <PrimaryButton
                  label={i18n.t("source.generateFlashcards")}
                  style={styles.actionButton}
                  onPress={() => router.push(`/source/${source.id}/generate?type=flashcards`)}
                  accessibilityLabel={i18n.t("source.generateFlashcards")}
                />
              </View>
              <View style={styles.actionRow}>
                <PrimaryButton
                  label={i18n.t("source.generateQuiz")}
                  style={styles.actionButton}
                  onPress={() => router.push(`/source/${source.id}/generate?type=quiz`)}
                  accessibilityLabel={i18n.t("source.generateQuiz")}
                />
                <SecondaryButton
                  label={i18n.t("source.askTiw")}
                  style={styles.actionButton}
                  onPress={() => router.push(`/chat/new?sourceId=${source.id}`)}
                  accessibilityLabel={i18n.t("source.askTiw")}
                />
              </View>
            </View>
          )}

          {source.status === "partial" && isReady && !isProcessing && (
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  backgroundColor: theme.colors.warningContainer,
                  borderRadius: tokens.radii.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
                onPress={() => router.push(`/source/${source.id}/generate?type=summary`)}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onWarningContainer, fontSize: 14, fontWeight: "600" },
                  ]}
                >
                  ✓ {i18n.t("source.partialConfirm")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {error ? <ErrorState error={error} onRetry={fetchSource} /> : null}
      </ScrollView>

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
                {i18n.t("source.deleteConfirmTitle")}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalText, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("source.deleteConfirmDesc")}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}
              >
                <TouchableOpacity
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: keepMaterials ? theme.colors.primary : theme.colors.outline,
                    backgroundColor: keepMaterials ? theme.colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => setKeepMaterials(!keepMaterials)}
                >
                  {keepMaterials && (
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        { color: theme.colors.onPrimary, fontSize: 14, fontWeight: "700" },
                      ]}
                    >
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurface, fontSize: 15 },
                  ]}
                >
                  {i18n.t("source.keepMaterials")}
                </Text>
              </View>
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
                  disabled={false}
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
