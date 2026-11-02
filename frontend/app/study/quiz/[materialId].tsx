import { getMaterial } from "@/api/endpoints/materials";
import { completeStudySession, createStudySession, submitQuizAnswer } from "@/api/endpoints/study";
import {
  type AnswerResult,
  type Material,
  QuestionType,
  type QuizQuestion,
  Verdict,
} from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ErrorState } from "@/components/ui/ErrorState";
import { QuizVerdict } from "@/components/ui/QuizVerdict";
import { SourceRefChip } from "@/components/ui/SourceRefChip";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.outlineVariant,
      borderRadius: 2,
      marginHorizontal: 20,
      marginTop: 8,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    progressText: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 12,
      fontSize: 13,
      textAlign: "center",
    },
    scrollContent: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    questionCard: {
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      padding: 20,
      marginBottom: 16,
    },
    questionNumber: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
    },
    questionPrompt: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
      lineHeight: 26,
    },
    choiceItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: tokens.radii.lg,
      borderWidth: 2,
      marginBottom: 10,
    },
    choiceItemSelected: {},
    choiceItemCorrect: {
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.successContainer,
    },
    choiceItemIncorrect: {
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.errorContainer,
    },
    choiceLabel: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      fontSize: 14,
      fontWeight: "700",
    },
    choiceLabelDefault: {},
    choiceLabelSelected: {},
    choiceLabelCorrect: {
      borderColor: theme.colors.success,
      color: theme.colors.success,
      backgroundColor: theme.colors.successContainer,
    },
    choiceLabelIncorrect: {
      borderColor: theme.colors.error,
      color: theme.colors.error,
      backgroundColor: theme.colors.errorContainer,
    },
    choiceText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 24,
    },
    choiceTextCorrect: { color: theme.colors.onSuccessContainer },
    choiceTextIncorrect: { color: theme.colors.onErrorContainer },
    choiceTextDefault: {},
    shortAnswerInput: {
      borderWidth: 1,
      borderRadius: tokens.radii.lg,
      padding: 16,
      fontSize: 16,
      minHeight: 100,
      textAlignVertical: "top",
      marginBottom: 16,
    },
    submitButton: {
      marginTop: 8,
    },
    feedbackContainer: {
      marginTop: 16,
      padding: 16,
      borderRadius: tokens.radii.lg,
    },
    feedbackCorrect: {
      backgroundColor: theme.colors.successContainer,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    feedbackIncorrect: {
      backgroundColor: theme.colors.errorContainer,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    feedbackPartial: {
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    feedbackTitle: {
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 8,
    },
    feedbackTitleCorrect: { color: theme.colors.onSuccessContainer },
    feedbackTitleIncorrect: { color: theme.colors.onErrorContainer },
    feedbackTitlePartial: { color: theme.colors.onWarningContainer },
    feedbackExplanation: {
      fontSize: 14,
      lineHeight: 22,
    },
    feedbackExplanationCorrect: { color: theme.colors.onSuccessContainer },
    feedbackExplanationIncorrect: { color: theme.colors.onErrorContainer },
    feedbackExplanationPartial: { color: theme.colors.onWarningContainer },
    nextButton: {
      marginTop: 16,
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
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 8,
    },
    modalText: {
      fontSize: 15,
      lineHeight: 24,
      textAlign: "center",
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
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
      backgroundColor: theme.colors.primary,
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    modalButtonTextCancel: { color: theme.colors.onSurfaceVariant },
    modalButtonTextConfirm: { color: theme.colors.onPrimary },
  });

export default function QuizStudyScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { isAuthenticated } = useAuth();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const [material, setMaterial] = useState<Material | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const fetchMaterial = useCallback(async () => {
    try {
      const res = await getMaterial(materialId);
      setMaterial(res);
      const content = res.content as { questions: QuizQuestion[] };
      setQuestions(content.questions);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  const startSession = useCallback(async () => {
    try {
      const session = await createStudySession({ materialId, mode: "quiz" });
      setSessionId(session.id);
    } catch (err: any) {
      setError(err);
    }
  }, [materialId]);

  useEffect(() => {
    fetchMaterial().then(() => {
      if (!error) startSession();
    });
  }, [fetchMaterial, startSession, error]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? (currentIndex + 1) / questions.length : 0;

  const handleChoiceSelect = useCallback(
    (choiceId: string) => {
      if (!submitting && !showFeedback) {
        setSelectedChoice(choiceId);
        haptics.light();
      }
    },
    [submitting, showFeedback],
  );

  const handleShortAnswerChange = useCallback((text: string) => {
    setShortAnswer(text);
  }, []);

  const canSubmit = useCallback(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === "short_answer") {
      return shortAnswer.trim().length > 0;
    }
    return selectedChoice !== null;
  }, [currentQuestion, selectedChoice, shortAnswer]);

  const handleSubmit = useCallback(async () => {
    if (!sessionId || submitting || !currentQuestion || !canSubmit()) return;
    setSubmitting(true);
    try {
      let result: AnswerResult;
      if (currentQuestion.type === "short_answer") {
        result = await submitQuizAnswer(sessionId, {
          itemId: currentQuestion.id,
          text: shortAnswer,
        });
      } else {
        result = await submitQuizAnswer(sessionId, {
          itemId: currentQuestion.id,
          choiceId: selectedChoice!,
        });
      }
      setLastResult(result);
      setShowFeedback(true);
      haptics.medium();
    } catch (err: any) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, submitting, currentQuestion, selectedChoice, shortAnswer, canSubmit]);

  const handleNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      try {
        await completeStudySession(sessionId!);
        setCompleted(true);
      } catch (err: any) {
        setError(err);
      }
    } else {
      setCurrentIndex(nextIndex);
      setSelectedChoice(null);
      setShortAnswer("");
      setLastResult(null);
      setShowFeedback(false);
    }
  }, [currentIndex, questions.length, sessionId]);

  const handleExit = useCallback(() => {
    if (completed || currentIndex === 0) {
      router.back();
    } else {
      setShowExitConfirm(true);
    }
  }, [completed, currentIndex]);

  const confirmExit = useCallback(() => {
    setShowExitConfirm(false);
    router.back();
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
            {i18n.t("material.quizTitle")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorState error={error} onRetry={fetchMaterial} />
      </SafeAreaView>
    );
  }

  if (!material || !sessionId || questions.length === 0) {
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
            {i18n.t("material.quizTitle")}
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

  if (completed) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
            {i18n.t("study.completedTitle")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: tokens.radii["2xl"],
              padding: 32,
              alignItems: "center",
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
            }}
          >
            <Text style={[{ color: theme.colors.onSurface }, { fontSize: 48, marginBottom: 16 }]}>
              🎉
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                {
                  fontSize: 24,
                  fontWeight: "700",
                  color: theme.colors.onSurface,
                  marginBottom: 8,
                },
              ]}
            >
              {i18n.t("study.completedTitle")}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                {
                  fontSize: 16,
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                  marginBottom: 24,
                },
              ]}
            >
              {i18n.t("material.questionsCount", { count: questions.length })}
            </Text>
            <PrimaryButton
              label={i18n.t("study.returnHome")}
              onPress={() => router.replace("/")}
              style={{ minWidth: 200 }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isMultipleChoice = currentQuestion.type !== "short_answer";
  const isCorrect = lastResult?.verdict === "correct";
  const isPartial = lastResult?.verdict === "partially_correct";

  const getChoiceStyle = (choiceId: string) => {
    if (!showFeedback) {
      return selectedChoice === choiceId
        ? [
            styles.choiceItemSelected,
            { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
          ]
        : styles.choiceItem;
    }
    if (choiceId === currentQuestion.correctChoiceId) return styles.choiceItemCorrect;
    if (selectedChoice === choiceId && choiceId !== currentQuestion.correctChoiceId)
      return styles.choiceItemIncorrect;
    return styles.choiceItem;
  };

  const getChoiceLabelStyle = (choiceId: string) => {
    if (!showFeedback) {
      return selectedChoice === choiceId
        ? [
            styles.choiceLabelSelected,
            {
              borderColor: theme.colors.primary,
              color: theme.colors.primary,
              backgroundColor: theme.colors.primaryContainer,
            },
          ]
        : [
            styles.choiceLabelDefault,
            { borderColor: theme.colors.outline, color: theme.colors.onSurface },
          ];
    }
    if (choiceId === currentQuestion.correctChoiceId) return styles.choiceLabelCorrect;
    if (selectedChoice === choiceId && choiceId !== currentQuestion.correctChoiceId)
      return styles.choiceLabelIncorrect;
    return [
      styles.choiceLabelDefault,
      { borderColor: theme.colors.outline, color: theme.colors.onSurface },
    ];
  };

  const getChoiceTextStyle = (choiceId: string) => {
    if (!showFeedback) return [styles.choiceTextDefault, { color: theme.colors.onSurface }];
    if (choiceId === currentQuestion.correctChoiceId) return styles.choiceTextCorrect;
    if (selectedChoice === choiceId && choiceId !== currentQuestion.correctChoiceId)
      return styles.choiceTextIncorrect;
    return [styles.choiceTextDefault, { color: theme.colors.onSurface }];
  };

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
        <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]} numberOfLines={2}>
          {material.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.colors.primary, width: `${progress * 100}%` },
          ]}
        />
      </View>
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.progressText, { color: theme.colors.onSurfaceVariant }],
        ]}
      >
        {i18n.t("study.questionProgress", { current: currentIndex + 1, total: questions.length })}
      </Text>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.questionCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
          ]}
        >
          <Text style={[{ color: theme.colors.onSurface }, styles.questionNumber]}>
            {i18n.t("study.questionProgress", {
              current: currentIndex + 1,
              total: questions.length,
            })}
          </Text>
          <Text style={[{ color: theme.colors.onSurface }, styles.questionPrompt]}>
            {currentQuestion.prompt}
          </Text>

          {isMultipleChoice &&
            currentQuestion.choices &&
            currentQuestion.choices.map((choice) => (
              <TouchableOpacity
                key={choice.id}
                style={getChoiceStyle(choice.id) as any}
                onPress={() => handleChoiceSelect(choice.id)}
                activeOpacity={0.9}
                disabled={submitting || showFeedback}
              >
                <View style={getChoiceLabelStyle(choice.id) as any}>
                  <Text style={{ color: theme.colors.onSurface }}>{choice.text.charAt(0)}</Text>
                </View>
                <Text
                  style={[{ color: theme.colors.onSurface }, getChoiceTextStyle(choice.id) as any]}
                >
                  {choice.text}
                </Text>
                {showFeedback && choice.id === currentQuestion.correctChoiceId && (
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.success, fontSize: 20 },
                    ]}
                  >
                    ✓
                  </Text>
                )}
                {showFeedback &&
                  selectedChoice === choice.id &&
                  choice.id !== currentQuestion.correctChoiceId && (
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        { color: theme.colors.error, fontSize: 20 },
                      ]}
                    >
                      ✗
                    </Text>
                  )}
              </TouchableOpacity>
            ))}

          {!isMultipleChoice && (
            <TextInput
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.shortAnswerInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outline,
                    color: theme.colors.onSurface,
                  },
                ],
              ]}
              placeholder={i18n.t("study.typeAnswerPlaceholder")}
              value={shortAnswer}
              onChangeText={handleShortAnswerChange}
              multiline
              placeholderTextColor={theme.colors.outlineVariant}
              editable={!(submitting || showFeedback)}
              autoFocus
              blurOnSubmit={false}
            />
          )}

          {showFeedback && lastResult?.verdict && (
            <QuizVerdict
              verdict={lastResult.verdict}
              explanation={lastResult.explanation}
              questionExplanation={currentQuestion.explanation}
            />
          )}

          {showFeedback && (
            <PrimaryButton
              label={
                currentIndex + 1 < questions.length
                  ? i18n.t("study.nextQuestion")
                  : i18n.t("common.done")
              }
              onPress={handleNext}
              style={styles.nextButton}
              loading={submitting}
            />
          )}

          {!showFeedback && (
            <PrimaryButton
              label={i18n.t("study.submitAnswer")}
              onPress={handleSubmit}
              style={styles.submitButton}
              loading={submitting}
              disabled={!canSubmit()}
            />
          )}
        </View>
      </ScrollView>

      {showExitConfirm && (
        <Modal visible={showExitConfirm} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("common.close")}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalText, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("study.questionProgress", {
                  current: currentIndex + 1,
                  total: questions.length,
                })}{" "}
                {i18n.t("common.cancel")}?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setShowExitConfirm(false)}
                  activeOpacity={0.9}
                >
                  <Text style={[{ color: theme.colors.onSurface }, styles.modalButtonTextCancel]}>
                    {i18n.t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  onPress={confirmExit}
                  activeOpacity={0.9}
                >
                  <Text style={[{ color: theme.colors.onSurface }, styles.modalButtonTextConfirm]}>
                    {i18n.t("common.close")}
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
