import { getMaterial } from "@/api/endpoints/materials";
import { getStudySession } from "@/api/endpoints/study";
import {
  CardRating,
  FlashcardItem,
  QuizQuestion,
  type StudySession,
  type Verdict,
} from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ErrorState } from "@/components/ui/ErrorState";
import { SourceRefChip } from "@/components/ui/SourceRefChip";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    scoreCard: {
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 24,
      borderRadius: tokens.radii["2xl"],
      padding: 24,
      alignItems: "center",
    },
    scoreCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 4,
    },
    scoreNumber: {
      fontSize: 40,
      fontWeight: "800",
    },
    scoreLabel: {
      fontSize: 16,
      fontWeight: "600",
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      width: "100%",
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
    },
    statItem: {
      alignItems: "center",
    },
    statValue: {
      fontSize: 22,
      fontWeight: "800",
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    itemCard: {
      marginHorizontal: 20,
      marginBottom: 12,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
    },
    verdictBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: tokens.radii.full,
      fontSize: 11,
      fontWeight: "700",
    },
    verdictCorrect: {
      backgroundColor: theme.colors.successContainer,
      color: theme.colors.onSuccessContainer,
    },
    verdictPartial: {
      backgroundColor: theme.colors.warningContainer,
      color: theme.colors.onWarningContainer,
    },
    verdictIncorrect: {
      backgroundColor: theme.colors.errorContainer,
      color: theme.colors.onErrorContainer,
    },
    itemContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    questionPrompt: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 12,
    },
    answerRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
      flexWrap: "wrap",
    },
    answerLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
    },
    answerText: {
      fontSize: 13,
      lineHeight: 20,
    },
    explanation: {
      marginTop: 12,
      padding: 12,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.successContainer,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    explanationLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.onSuccessContainer,
      marginBottom: 4,
    },
    explanationText: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.onSuccessContainer,
    },
    sourceRefs: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 12,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    actionButton: {
      flex: 1,
    },
  });

const createVERDICT_COLORS = (theme: AppTheme): Record<Verdict, { bg: string; text: string }> => ({
  correct: { bg: theme.colors.successContainer, text: theme.colors.onSuccessContainer },
  partially_correct: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
  incorrect: { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
});

const VERDICT_LABELS: Record<Verdict, string> = {
  correct: i18n.t("enums.verdicts.correct"),
  partially_correct: i18n.t("enums.verdicts.partially_correct"),
  incorrect: i18n.t("enums.verdicts.incorrect"),
};

const VERDICT_STYLES: Record<Verdict, keyof ReturnType<typeof createStyles>> = {
  correct: "verdictCorrect",
  partially_correct: "verdictPartial",
  incorrect: "verdictIncorrect",
};

export default function StudyResultScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const VERDICT_COLORS = createVERDICT_COLORS(theme);
  const { isAuthenticated } = useAuth();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<StudySession | null>(null);
  const [material, setMaterial] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await getStudySession(sessionId);
      setSession(res.session);
      setAnswers(res.answers);
      if (res.session.materialId) {
        const mat = await getMaterial(res.session.materialId);
        setMaterial(mat);
      }
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleExit = useCallback(() => {
    router.replace("/");
  }, []);

  if (!isAuthenticated) return null;

  if (loading) {
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

  if (error) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleExit}
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
            {i18n.t("history.title")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorState error={error} onRetry={fetchSession} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleExit}
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
            {i18n.t("history.title")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={[{ color: theme.colors.onSurface }, { color: theme.colors.onSurfaceVariant }]}
          >
            {i18n.t("common.error")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const score = session.score ?? 0;
  const total = session.itemsTotal;
  const answered = session.itemsAnswered;
  const correctCount = answers.filter((a) => a.verdict === "correct").length;
  const partialCount = answers.filter((a) => a.verdict === "partially_correct").length;
  const incorrectCount = answers.filter((a) => a.verdict === "incorrect").length;

  let scoreCardBg = theme.colors.primary;
  if (score >= 80) scoreCardBg = theme.colors.success;
  else if (score >= 60) scoreCardBg = theme.colors.warning;
  else scoreCardBg = theme.colors.error;

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleExit}
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
          {material?.title || i18n.t("history.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        {material?.generatedBy?.mode === "fixture" && (
          <Banner
            message={i18n.t("home.fixtureBanner")}
            variant="fixture"
            style={{ marginHorizontal: 20, marginTop: 16 }}
          />
        )}

        {/* Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: scoreCardBg }]}>
          <View style={[styles.scoreCircle, { shadowColor: scoreCardBg }]}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.scoreNumber, { color: theme.colors.onPrimary }],
              ]}
            >
              {score}%
            </Text>
          </View>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.scoreLabel, { color: theme.colors.onPrimary }],
            ]}
          >
            {i18n.t("study.scoreLabel", { score })}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.statValue, { color: theme.colors.onPrimary }],
                ]}
              >
                {correctCount}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.statLabel, { color: "rgba(255,255,255,0.8)" }],
                ]}
              >
                {i18n.t("enums.verdicts.correct")}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.statValue, { color: theme.colors.onPrimary }],
                ]}
              >
                {partialCount}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.statLabel, { color: "rgba(255,255,255,0.8)" }],
                ]}
              >
                {i18n.t("enums.verdicts.partially_correct")}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.statValue, { color: theme.colors.onPrimary }],
                ]}
              >
                {incorrectCount}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.statLabel, { color: "rgba(255,255,255,0.8)" }],
                ]}
              >
                {i18n.t("enums.verdicts.incorrect")}
              </Text>
            </View>
          </View>
        </View>

        {/* Review Items */}
        <Text style={[{ color: theme.colors.onSurface }, styles.sectionTitle]}>
          {i18n.t("history.sessionsTitle")}
        </Text>
        <FlatList
          data={answers}
          keyExtractor={(item) => item.itemId}
          renderItem={({ item }) => {
            const verdict = item.verdict as Verdict | null;
            const colors = verdict
              ? VERDICT_COLORS[verdict]
              : { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant };
            const label = verdict ? VERDICT_LABELS[verdict] : i18n.t("common.loading");
            const styleKey = verdict ? VERDICT_STYLES[verdict] : "";
            return (
              <View
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.itemHeader}>
                  {verdict && (
                    <View style={[styles.verdictBadge, styles[VERDICT_STYLES[verdict]]] as any}>
                      <Text style={{ color: theme.colors.onSurface }}>{label}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemContent}>
                  {material?.type === "flashcards" && item.rating && (
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [styles.answerRow, { flexDirection: "row" }],
                      ]}
                    >
                      <Text style={styles.answerLabel}>{i18n.t("study.hint")}: </Text>
                      <Text style={styles.answerText}>
                        {i18n.t(`enums.cardRatings.${item.rating}`)}
                      </Text>
                    </Text>
                  )}
                  {material?.type === "quiz" && (
                    <>
                      {item.userAnswer && (
                        <View style={styles.answerRow}>
                          <Text style={[{ color: theme.colors.onSurface }, styles.answerLabel]}>
                            {i18n.t("study.yourAnswer")}:{" "}
                          </Text>
                          <Text style={[{ color: theme.colors.onSurface }, styles.answerText]}>
                            {item.userAnswer}
                          </Text>
                        </View>
                      )}
                      {item.modelAnswer && (
                        <View style={styles.answerRow}>
                          <Text style={[{ color: theme.colors.onSurface }, styles.answerLabel]}>
                            {i18n.t("study.modelAnswer")}:{" "}
                          </Text>
                          <Text style={[{ color: theme.colors.onSurface }, styles.answerText]}>
                            {item.modelAnswer}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  {item.explanation && (
                    <View style={styles.explanation}>
                      <Text style={[{ color: theme.colors.onSurface }, styles.explanationLabel]}>
                        {i18n.t("study.explanation")}
                      </Text>
                      <Text style={[{ color: theme.colors.onSurface }, styles.explanationText]}>
                        {item.explanation}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={() => <View style={{ height: 100 }} />}
        />

        {/* Actions */}
        <View style={styles.actionRow}>
          <SecondaryButton
            label={i18n.t("study.reviewMissed")}
            onPress={() => {
              /* TODO: filter missed items */
            }}
            style={styles.actionButton}
          />
          <PrimaryButton
            label={i18n.t("study.returnHome")}
            onPress={handleExit}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
