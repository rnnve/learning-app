import { getHome } from "@/api/endpoints/home";
import type { Job, MaterialSummary, Source } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import i18n from "@/i18n";
import { formatBytes, formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { getJobTarget } from "@/lib/jobNavigation";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 104,
    },
    hero: {
      padding: 18,
      borderRadius: tokens.radii["3xl"],
      marginBottom: 20,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    greeting: {
      fontSize: 30,
      fontWeight: "700",
      lineHeight: 38,
    },
    greetingSub: {
      fontSize: 15,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 0,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 58,
      paddingVertical: 16,
      borderRadius: tokens.radii.full,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
    },
    seeAll: {
      fontSize: 14,
      fontWeight: "600",
    },
    statsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      padding: 14,
      minHeight: 104,
      borderRadius: tokens.radii["2xl"],
      borderWidth: 0,
      justifyContent: "space-between",
    },
    statValue: {
      fontSize: 32,
      fontWeight: "700",
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "500",
    },
    jobCard: {
      marginBottom: 12,
      padding: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
    },
    jobHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    jobTitle: {
      fontSize: 15,
      fontWeight: "600",
    },
    jobStatus: {
      fontSize: 12,
      fontWeight: "600",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.full,
    },
    sourceItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      marginBottom: 10,
    },
    sourceIcon: {
      width: 48,
      height: 48,
      borderRadius: tokens.radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    sourceInfo: {
      flex: 1,
    },
    sourceTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    sourceMeta: {
      fontSize: 12,
      flexDirection: "row",
      gap: 12,
    },
    sourceStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.full,
    },
    materialItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      marginBottom: 10,
    },
    materialIcon: {
      width: 48,
      height: 48,
      borderRadius: tokens.radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    materialInfo: {
      flex: 1,
    },
    materialTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    materialMeta: {
      fontSize: 12,
      flexDirection: "row",
      gap: 12,
    },
    emptyContainer: {
      paddingVertical: 40,
      alignItems: "center",
    },
    bannerContainer: {
      marginBottom: 16,
      paddingHorizontal: 20,
    },
    fixtureBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    fixtureText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.onWarningContainer,
      flex: 1,
    },
  });

const MATERIAL_ICONS: Record<string, string> = {
  summary: "📄",
  flashcards: "🃏",
  quiz: "❓",
};

const createSTATUS_COLORS = (theme: AppTheme): Record<string, { bg: string; text: string }> => ({
  ready: { bg: theme.colors.successContainer, text: theme.colors.onSuccessContainer },
  partial: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
  failed: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
  processing: { bg: theme.colors.infoContainer, text: theme.colors.onInfoContainer },
  queued: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
});

export default function HomeScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const STATUS_COLORS = createSTATUS_COLORS(theme);
  const insets = useSafeAreaInsets();
  const { user, hasConsent, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [homeData, setHomeData] = useState<{
    stats: any;
    activeJobs: Job[];
    recentSources: Source[];
    recentMaterials: MaterialSummary[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const fetchData = useCallback(async () => {
    try {
      const homeRes = await getHome();
      setHomeData(homeRes);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      const timer = setInterval(fetchData, 4000);
      return () => clearInterval(timer);
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    haptics.light();
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getStatusColors = (status: string) => {
    const colors = STATUS_COLORS[status] || {
      bg: theme.colors.surfaceVariant,
      text: theme.colors.onSurfaceVariant,
    };
    return { backgroundColor: colors.bg, color: colors.text };
  };

  if (!isAuthenticated) {
    return null; // Handled by index.tsx redirect
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
    >
      {!hasConsent && (
        <View style={styles.bannerContainer}>
          <Banner message={i18n.t("home.fixtureBanner")} variant="warning" />
        </View>
      )}

      <View style={[styles.hero, { backgroundColor: theme.colors.primaryContainer }]}>
        <View style={styles.header}>
          <View>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.greeting, { color: theme.colors.onPrimaryContainer }],
              ]}
            >
              {i18n.t("home.greeting", {
                name: user?.displayName || i18n.t("onboarding.welcomeTitle"),
              })}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.greetingSub, { color: theme.colors.onPrimaryContainer }],
              ]}
            >
              {i18n.t("home.quickStats")}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary, borderWidth: 0 }]}
            onPress={() => router.push("/capture")}
            activeOpacity={0.82}
            accessibilityLabel={i18n.t("home.scanAction")}
          >
            <MaterialCommunityIcons name="line-scan" size={23} color={theme.colors.onPrimary} />
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.onPrimary, fontSize: 15, fontWeight: "700" },
              ]}
            >
              {i18n.t("home.scanAction")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.secondaryContainer, borderWidth: 0 },
            ]}
            onPress={() => router.push("/import")}
            activeOpacity={0.82}
            accessibilityLabel={i18n.t("home.importAction")}
          >
            <MaterialCommunityIcons
              name="file-upload"
              size={23}
              color={theme.colors.onSecondaryContainer}
            />
            <Text
              numberOfLines={1}
              style={[
                { color: theme.colors.onSurface },
                {
                  color: theme.colors.onSecondaryContainer,
                  fontSize: 15,
                  fontWeight: "700",
                },
              ]}
            >
              {i18n.t("home.importAction")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {homeData && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.statValue, { color: theme.colors.onPrimaryContainer }],
              ]}
            >
              {homeData.stats.sources}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.statLabel, { color: theme.colors.onPrimaryContainer }],
              ]}
            >
              {i18n.t("home.statsSources")}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.statValue, { color: theme.colors.onSecondaryContainer }],
              ]}
            >
              {homeData.stats.materials}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.statLabel, { color: theme.colors.onSecondaryContainer }],
              ]}
            >
              {i18n.t("home.statsMaterials")}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.tertiaryContainer }]}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.statValue, { color: theme.colors.onTertiaryContainer }],
              ]}
            >
              {homeData.stats.sessionsLast7Days}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.statLabel, { color: theme.colors.onTertiaryContainer }],
              ]}
            >
              {i18n.t("home.statsSessions")}
            </Text>
          </View>
        </View>
      )}

      {homeData?.activeJobs && homeData.activeJobs.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("home.activeJobs")}
            </Text>
          </View>
          {homeData.activeJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={[
                styles.jobCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
              onPress={() => router.push(getJobTarget(job))}
              activeOpacity={0.9}
            >
              <View style={styles.jobHeader}>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [styles.jobTitle, { color: theme.colors.onSurface }],
                  ]}
                >
                  {job.type === "source_processing"
                    ? i18n.t("source.processingTitle")
                    : job.type === "generate_summary"
                      ? i18n.t("material.summaryTitle")
                      : job.type === "generate_flashcards"
                        ? i18n.t("material.flashcardsTitle")
                        : i18n.t("material.quizTitle")}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [styles.jobStatus, getStatusColors(job.status)],
                  ]}
                >
                  {i18n.t(`enums.jobStatuses.${job.status}`)}
                </Text>
              </View>
              <ProgressSteps
                stage={job.stage}
                progress={job.progress}
                type={job.type === "source_processing" ? "source_processing" : "generate"}
                detail={job.detail}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {homeData?.recentSources && homeData.recentSources.length > 0 ? (
        <View>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("home.recentSources")}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/library")}
              accessibilityLabel={i18n.t("common.viewAll")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.seeAll, { color: theme.colors.primary }],
                ]}
              >
                {i18n.t("common.viewAll")}
              </Text>
            </TouchableOpacity>
          </View>
          {homeData.recentSources.slice(0, 5).map((source) => (
            <TouchableOpacity
              key={source.id}
              style={[
                styles.sourceItem,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
              onPress={() => router.push(`/source/${source.id}`)}
              activeOpacity={0.9}
            >
              <View style={[styles.sourceIcon, { backgroundColor: theme.colors.primaryContainer }]}>
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
                    {formatDate(source.createdAt, i18n.language as "th" | "en")}
                  </Text>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {source.pageCount} {i18n.t("source.pagesCount", { count: source.pageCount })}
                  </Text>
                </View>
              </View>
              <View style={[styles.sourceStatus, getStatusColors(source.status)]}>
                <Text
                  style={[{ color: theme.colors.onSurface }, { fontSize: 11, fontWeight: "600" }]}
                >
                  {i18n.t(`enums.sourceStatuses.${source.status}`)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : homeData && !error ? (
        <EmptyState
          icon="📷"
          title={i18n.t("home.emptyTitle")}
          description={i18n.t("home.emptyDesc")}
          actionLabel={i18n.t("home.scanAction")}
          onAction={() => router.push("/capture")}
        />
      ) : null}

      {homeData?.recentMaterials && homeData.recentMaterials.length > 0 ? (
        <View>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("home.recentMaterials")}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/library")}
              accessibilityLabel={i18n.t("common.viewAll")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.seeAll, { color: theme.colors.primary }],
                ]}
              >
                {i18n.t("common.viewAll")}
              </Text>
            </TouchableOpacity>
          </View>
          {homeData.recentMaterials.slice(0, 5).map((material) => (
            <TouchableOpacity
              key={material.id}
              style={[
                styles.materialItem,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
              onPress={() => router.push(`/material/${material.id}`)}
              activeOpacity={0.9}
            >
              <View
                style={[styles.materialIcon, { backgroundColor: `${theme.colors.secondary}20` }]}
              >
                <Text style={[{ color: theme.colors.onSurface }, { fontSize: 22 }]}>
                  {MATERIAL_ICONS[material.type]}
                </Text>
              </View>
              <View style={styles.materialInfo}>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [styles.materialTitle, { color: theme.colors.onSurface }],
                  ]}
                  numberOfLines={2}
                >
                  {material.title}
                </Text>
                <View style={styles.materialMeta}>
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
                    {i18n.t(
                      material.type === "flashcards"
                        ? "material.cardsCount"
                        : "material.questionsCount",
                      { count: material.itemCount },
                    )}
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
                </View>
              </View>
              {material.generatedBy.mode === "fixture" && (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    {
                      fontSize: 10,
                      color: theme.colors.onWarningContainer,
                      backgroundColor: theme.colors.warningContainer,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: tokens.radii.full,
                    },
                  ]}
                >
                  FIXTURE
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {error ? <ErrorState error={error} onRetry={fetchData} /> : null}
    </ScrollView>
  );
}
