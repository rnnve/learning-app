import { getMaterial } from "@/api/endpoints/materials";
import {
  completeStudySession,
  createStudySession,
  getFlashcardProgress,
  submitFlashcardAnswer,
} from "@/api/endpoints/study";
import {
  type CardRating,
  type FlashcardItem,
  FlashcardProgressItem,
  type Material,
} from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ErrorState } from "@/components/ui/ErrorState";
import { FlashCard } from "@/components/ui/FlashCard";
import { RatingButtons } from "@/components/ui/RatingButtons";
import { SourceRefChip } from "@/components/ui/SourceRefChip";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    cardContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 16,
      justifyContent: "center",
    },
    ratingRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 30,
      justifyContent: "center",
    },
    ratingButton: {
      flex: 1,
      maxWidth: 80,
      paddingVertical: 12,
      borderRadius: tokens.radii.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    ratingButtonAgain: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
    },
    ratingButtonHard: {
      backgroundColor: theme.colors.warningContainer,
      borderColor: theme.colors.warning,
    },
    ratingButtonGood: {
      backgroundColor: theme.colors.infoContainer,
      borderColor: theme.colors.info,
    },
    ratingButtonEasy: {
      backgroundColor: theme.colors.successContainer,
      borderColor: theme.colors.success,
    },
    ratingText: {
      fontSize: 13,
      fontWeight: "700",
    },
    ratingTextAgain: { color: theme.colors.error },
    ratingTextHard: { color: theme.colors.warning },
    ratingTextGood: { color: theme.colors.info },
    ratingTextEasy: { color: theme.colors.success },
    dueInfo: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      alignItems: "center",
    },
    dueText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
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

const RATING_LABELS: Record<CardRating, string> = {
  again: i18n.t("study.again"),
  hard: i18n.t("study.hard"),
  good: i18n.t("study.good"),
  easy: i18n.t("study.easy"),
};

export default function FlashcardStudyScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { isAuthenticated } = useAuth();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const [material, setMaterial] = useState<Material | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completed, setCompleted] = useState(false);

  const fetchMaterial = useCallback(async () => {
    try {
      const res = await getMaterial(materialId);
      setMaterial(res);
      const content = res.content as { cards: FlashcardItem[] };
      setCards(content.cards);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  const startSession = useCallback(async () => {
    try {
      const session = await createStudySession({ materialId, mode: "flashcards" });
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

  const handleRating = useCallback(
    async (rating: CardRating) => {
      if (!sessionId || submitting || currentIndex >= cards.length) return;
      setSubmitting(true);
      try {
        await submitFlashcardAnswer(sessionId, { itemId: cards[currentIndex].id, rating });
        const nextIndex = currentIndex + 1;
        if (nextIndex >= cards.length) {
          const completedSession = await completeStudySession(sessionId);
          setCompleted(true);
        } else {
          setCurrentIndex(nextIndex);
        }
        haptics.light();
      } catch (err: any) {
        setError(err);
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, submitting, currentIndex, cards],
  );

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
            {i18n.t("material.flashcardsTitle")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorState error={error} onRetry={fetchMaterial} />
      </SafeAreaView>
    );
  }

  if (!material || !sessionId || cards.length === 0) {
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
            {i18n.t("material.flashcardsTitle")}
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

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? (currentIndex + 1) / cards.length : 0;

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
              {i18n.t("material.cardsCount", { count: cards.length })}
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
        {i18n.t("study.cardsRemaining", { count: cards.length - currentIndex - 1 })}
      </Text>

      <View style={styles.cardContainer}>
        <FlashCard card={currentCard} sourceId={material.sourceId} style={{ minHeight: 320 }} />
      </View>

      {!submitting && <RatingButtons onRate={handleRating} />}

      {submitting && (
        <View style={styles.dueInfo}>
          <Text style={[{ color: theme.colors.onSurface }, styles.dueText]}>
            {i18n.t("study.feedbackLoading")}
          </Text>
        </View>
      )}

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
                {i18n.t("study.cardsRemaining", { count: cards.length - currentIndex - 1 })}{" "}
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
