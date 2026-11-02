import { getHome } from "@/api/endpoints/home";
import { getStudySessions } from "@/api/endpoints/study";
import type { Job, StudySession } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import i18n from "@/i18n";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
      paddingTop: 44,
      paddingBottom: 12,
      backgroundColor: "transparent",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "700",
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 120,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      marginTop: 8,
    },
    jobCard: {
      marginBottom: 12,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    jobHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    jobIcon: {
      width: 44,
      height: 44,
      borderRadius: tokens.radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    jobInfo: {
      flex: 1,
    },
    jobTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    jobMeta: {
      fontSize: 12,
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    jobStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.full,
      fontSize: 11,
      fontWeight: "600",
    },
    sessionCard: {
      marginBottom: 12,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    sessionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    sessionIcon: {
      width: 44,
      height: 44,
      borderRadius: tokens.radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    sessionInfo: {
      flex: 1,
    },
    sessionTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    sessionMeta: {
      fontSize: 12,
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    sessionScore: {
      fontSize: 16,
      fontWeight: "700",
      marginRight: 12,
    },
    actionButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    emptyState: {
      paddingVertical: 40,
      alignItems: "center",
    },
  });

const JOB_TYPE_ICONS: Record<string, string> = {
  source_processing: "📄",
  generate_summary: "📝",
  generate_flashcards: "🃏",
  generate_quiz: "❓",
};

const createJOB_STATUS_COLORS = (
  theme: AppTheme,
): Record<string, { bg: string; text: string }> => ({
  queued: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
  running: { bg: theme.colors.infoContainer, text: theme.colors.onInfoContainer },
  succeeded: { bg: theme.colors.successContainer, text: theme.colors.onSuccessContainer },
  failed: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
  canceled: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
});

const SESSION_MODE_ICONS = {
  flashcards: "🃏",
  quiz: "❓",
};

export default function HistoryScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const JOB_STATUS_COLORS = createJOB_STATUS_COLORS(theme);
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const sessionsCursor = useRef<string | undefined>(undefined);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchData = useCallback(async (reset = false) => {
    try {
      const [sessionsRes, homeRes] = await Promise.all([
        getStudySessions({
          limit: 20,
          cursor: reset ? undefined : sessionsCursor.current,
        }),
        getHome(),
      ]);
      if (reset) {
        setSessions(sessionsRes.items);
      } else {
        setSessions((prev) => [...prev, ...sessionsRes.items]);
      }
      sessionsCursor.current = sessionsRes.nextCursor ?? undefined;
      setHasMoreSessions(!!sessionsRes.nextCursor);
      setJobs(homeRes.activeJobs);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    haptics.light();
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const getStatusColors = (status: string) => {
    const colors = JOB_STATUS_COLORS[status] || {
      bg: theme.colors.surfaceVariant,
      text: theme.colors.onSurfaceVariant,
    };
    return { backgroundColor: colors.bg, color: colors.text };
  };

  if (!isAuthenticated) return null;

  const activeAndFailedJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "queued" || j.status === "failed",
  );

  return (
    <SafeAreaView
      style={[
        { backgroundColor: theme.colors.background },
        [styles.container, { backgroundColor: theme.colors.background }],
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.headerTitle, { color: theme.colors.onSurface }],
          ]}
        >
          {i18n.t("navigation.history")}
        </Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {activeAndFailedJobs.length > 0 && (
          <>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("history.activeAndFailedJobs")}
            </Text>
            {activeAndFailedJobs.map((job) => (
              <View
                key={job.id}
                style={[
                  styles.jobCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.jobHeader}>
                  <View
                    style={[styles.jobIcon, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Text style={[{ color: theme.colors.onSurface }, { fontSize: 20 }]}>
                      {JOB_TYPE_ICONS[job.type] || "⚙️"}
                    </Text>
                  </View>
                  <View style={styles.jobInfo}>
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.jobTitle, { color: theme.colors.onSurface }],
                      ]}
                    >
                      {i18n.t(`enums.jobTypes.${job.type}`)}
                    </Text>
                    <View style={styles.jobMeta}>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {job.stage ? i18n.t(`enums.stages.${job.stage}`) : ""}
                      </Text>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {formatDate(job.createdAt, i18n.language as "th" | "en")}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.jobStatusBadge, getStatusColors(job.status)]}>
                    <Text style={{ color: theme.colors.onSurface }}>
                      {i18n.t(`enums.jobStatuses.${job.status}`)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.sectionTitle, { color: theme.colors.onSurface }],
          ]}
        >
          {i18n.t("history.sessionsTitle")}
        </Text>
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <View
              key={session.id}
              style={[
                styles.sessionCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.sessionHeader}>
                <View
                  style={[styles.sessionIcon, { backgroundColor: theme.colors.secondaryContainer }]}
                >
                  <Text style={[{ color: theme.colors.onSurface }, { fontSize: 20 }]}>
                    {SESSION_MODE_ICONS[session.mode]}
                  </Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.sessionTitle, { color: theme.colors.onSurface }],
                    ]}
                  >
                    {i18n.t(`enums.materialTypes.${session.mode}`)}
                  </Text>
                  <View style={styles.sessionMeta}>
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {formatDate(session.startedAt, i18n.language as "th" | "en")}
                    </Text>
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {session.itemsAnswered}/{session.itemsTotal} {i18n.t("common.pages")}
                    </Text>
                    {session.status === "completed" && (
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {i18n.t("history.completed")}
                      </Text>
                    )}
                  </View>
                </View>
                {session.score !== null && session.score !== undefined && (
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.sessionScore, { color: theme.colors.primary }],
                    ]}
                  >
                    {i18n.t("history.scoreText", { score: session.score })}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/study/result/${session.id}`)}
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
              </View>
            </View>
          ))
        ) : (
          <EmptyState
            style={styles.emptyState}
            icon="📊"
            title={i18n.t("history.emptyHistory")}
            description={i18n.t("history.emptyHistory")}
          />
        )}

        {hasMoreSessions && (
          <TouchableOpacity
            style={{ padding: 16, alignItems: "center" }}
            onPress={() => fetchData(false)}
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

        {error ? <ErrorState error={error} onRetry={() => fetchData(true)} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
