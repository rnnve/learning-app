import { deleteMaterial, getMaterial, updateMaterial } from "@/api/endpoints/materials";
import type {
  FlashcardsContent,
  GeneratedBy,
  Material,
  MaterialType,
  QuizContent,
  SummaryContent,
} from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { SourceRefChip } from "@/components/ui/SourceRefChip";
import i18n from "@/i18n";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
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
    materialCard: {
      marginBottom: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    materialHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
    },
    materialIcon: {
      width: 56,
      height: 56,
      borderRadius: tokens.radii.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    materialInfo: {
      flex: 1,
    },
    materialTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    materialMeta: {
      fontSize: 13,
      flexDirection: "row",
      gap: 16,
      flexWrap: "wrap",
    },
    saveButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    contentSection: {
      padding: 16,
      borderTopWidth: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
    },
    keyPointItem: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
    },
    keyPointText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 24,
    },
    sectionItem: {
      marginBottom: 20,
    },
    sectionHeading: {
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 8,
    },
    sectionBody: {
      fontSize: 15,
      lineHeight: 24,
    },
    glossaryItem: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
    },
    glossaryTerm: {
      fontWeight: "700",
      fontSize: 15,
    },
    glossaryDefinition: {
      flex: 1,
      fontSize: 15,
      lineHeight: 24,
    },
    limitationItem: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.errorContainer,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    limitationText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.onErrorContainer,
    },
    flashcardItem: {
      marginBottom: 12,
      padding: 16,
      borderRadius: tokens.radii.lg,
      borderWidth: 1,
    },
    flashcardFront: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 8,
    },
    flashcardBack: {
      fontSize: 15,
      lineHeight: 24,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
    },
    quizItem: {
      marginBottom: 16,
      padding: 16,
      borderRadius: tokens.radii.lg,
      borderWidth: 1,
    },
    quizQuestion: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 12,
    },
    choiceItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
      marginBottom: 8,
    },
    choiceText: {
      flex: 1,
      fontSize: 15,
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
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.onSuccessContainer,
      marginBottom: 4,
    },
    explanationText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.onSuccessContainer,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
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

const TYPE_ICONS: Record<MaterialType, string> = {
  summary: "📄",
  flashcards: "🃏",
  quiz: "❓",
};

const createTYPE_COLORS = (
  theme: AppTheme,
): Record<MaterialType, { bg: string; text: string }> => ({
  summary: { bg: theme.colors.infoContainer, text: theme.colors.onInfoContainer },
  flashcards: { bg: theme.colors.primaryContainer, text: theme.colors.primary },
  quiz: { bg: theme.colors.warningContainer, text: theme.colors.onWarningContainer },
});

export default function MaterialScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const TYPE_COLORS = createTYPE_COLORS(theme);
  const { isAuthenticated } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchMaterial = useCallback(async () => {
    try {
      const res = await getMaterial(id);
      setMaterial(res);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMaterial();
  }, [fetchMaterial]);

  const onRefresh = useCallback(() => {
    haptics.light();
    fetchMaterial();
  }, [fetchMaterial]);

  const handleSaveToggle = useCallback(async () => {
    if (!material) return;
    try {
      const updated = await updateMaterial(material.id, { isSaved: !material.isSaved });
      setMaterial(updated);
      haptics.light();
    } catch (err: any) {
      setError(err);
    }
  }, [material]);

  const handleDelete = useCallback(async () => {
    if (!material) return;
    try {
      await deleteMaterial(material.id);
      haptics.success();
      router.back();
    } catch (err: any) {
      setError(err);
    }
    setShowDeleteConfirm(false);
  }, [material]);

  if (!isAuthenticated) return null;

  if (loading && !material) {
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

  if (!material) {
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
            {i18n.t("navigation.library")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ErrorState error={error || "errors.NOT_FOUND"} onRetry={fetchMaterial} />
      </SafeAreaView>
    );
  }

  const typeColors = TYPE_COLORS[material.type];
  const typeIcon = TYPE_ICONS[material.type];
  const content = material.content as SummaryContent | FlashcardsContent | QuizContent;
  const generatedBy = material.generatedBy as GeneratedBy;
  const itemCount =
    material.type === "summary"
      ? (content as SummaryContent).keyPoints.length +
        (content as SummaryContent).sections.length +
        (content as SummaryContent).glossary.length +
        (content as SummaryContent).limitations.length
      : material.type === "flashcards"
        ? (content as FlashcardsContent).cards.length
        : (content as QuizContent).questions.length;

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
          {material.title}
        </Text>
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: material.isSaved
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
            },
          ]}
          onPress={handleSaveToggle}
          accessibilityLabel={material.isSaved ? i18n.t("common.save") : i18n.t("common.save")}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              {
                color: material.isSaved
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurfaceVariant,
                fontSize: 20,
              },
            ]}
          >
            {material.isSaved ? "⭐" : "☆"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {generatedBy?.mode === "fixture" && (
          <Banner
            message={i18n.t("material.fixtureWarning")}
            variant="fixture"
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Material Card */}
        <View
          style={[
            styles.materialCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
          ]}
        >
          <View style={styles.materialHeader}>
            <View style={[styles.materialIcon, { backgroundColor: typeColors.bg }]}>
              <Text style={[{ color: theme.colors.onSurface }, { fontSize: 28 }]}>{typeIcon}</Text>
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: tokens.radii.full,
                    backgroundColor: typeColors.bg,
                  }}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: typeColors.text, fontSize: 11, fontWeight: "600" },
                    ]}
                  >
                    {i18n.t(`enums.materialTypes.${material.type}`)}
                  </Text>
                </View>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {itemCount}{" "}
                  {material.type === "flashcards"
                    ? i18n.t("material.cardsCount", { count: itemCount })
                    : i18n.t("material.questionsCount", { count: itemCount })}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatDate(material.createdAt, i18n.language as "th" | "en")}
                </Text>
              </View>
            </View>
          </View>

          {material.sourceId && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: theme.colors.onSurfaceVariant, fontSize: 13 },
                ]}
              >
                {i18n.t("material.createdFrom", { sourceTitle: material.sourceId })}
              </Text>
            </View>
          )}

          {/* Content Sections */}
          {material.type === "summary" && content && "overview" in content && (
            <View style={styles.contentSection}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("material.keyPoints")}
              </Text>
              {(content as SummaryContent).keyPoints.map((kp, idx) => (
                <View
                  key={`keypoint-${idx}-${kp.text}`}
                  style={[
                    styles.keyPointItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.primary, fontSize: 18, marginTop: 2 },
                    ]}
                  >
                    •
                  </Text>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.keyPointText, { color: theme.colors.onSurface }],
                    ]}
                  >
                    {kp.text}
                  </Text>
                  {kp.sourceRefs && kp.sourceRefs.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {kp.sourceRefs.map((ref) => (
                        <SourceRefChip
                          key={`${ref.chunkId}-${ref.page ?? "null"}`}
                          sourceRef={ref}
                          sourceId={material.sourceId}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ))}

              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 20 }],
                ]}
              >
                {i18n.t("material.sections")}
              </Text>
              {(content as SummaryContent).sections.map((section, idx) => (
                <View key={`section-${idx}-${section.heading}`} style={styles.sectionItem}>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.sectionHeading, { color: theme.colors.onSurface }],
                    ]}
                  >
                    {section.heading}
                  </Text>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.sectionBody, { color: theme.colors.onSurface }],
                    ]}
                  >
                    {section.body}
                  </Text>
                  {section.sourceRefs && section.sourceRefs.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {section.sourceRefs.map((ref) => (
                        <SourceRefChip
                          key={`${ref.chunkId}-${ref.page ?? "null"}`}
                          sourceRef={ref}
                          sourceId={material.sourceId}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ))}

              {(content as SummaryContent).glossary.length > 0 && (
                <>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 20 }],
                    ]}
                  >
                    {i18n.t("material.glossary")}
                  </Text>
                  {(content as SummaryContent).glossary.map((item, idx) => (
                    <View
                      key={`glossary-${idx}-${item.term}`}
                      style={[
                        styles.glossaryItem,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          [styles.glossaryTerm, { color: theme.colors.onSurface }],
                        ]}
                      >
                        {item.term}
                      </Text>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          [styles.glossaryDefinition, { color: theme.colors.onSurface }],
                        ]}
                      >
                        {item.definition}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {(content as SummaryContent).limitations.length > 0 && (
                <>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 20 }],
                    ]}
                  >
                    {i18n.t("material.limitations")}
                  </Text>
                  {(content as SummaryContent).limitations.map((limitation, idx) => (
                    <View key={`limitation-${idx}-${limitation}`} style={styles.limitationItem}>
                      <Text style={[{ color: theme.colors.onSurface }, { fontSize: 16 }]}>⚠️</Text>
                      <Text style={[{ color: theme.colors.onSurface }, styles.limitationText]}>
                        {limitation}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {material.type === "flashcards" && content && "cards" in content && (
            <View style={styles.contentSection}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("material.cardsCount", {
                  count: (content as FlashcardsContent).cards.length,
                })}
              </Text>
              {(content as FlashcardsContent).cards.map((card, idx) => (
                <View
                  key={card.id}
                  style={[
                    styles.flashcardItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.flashcardFront, { color: theme.colors.onSurface }],
                    ]}
                  >
                    Q: {card.front}
                  </Text>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.flashcardBack, { color: theme.colors.onSurface }],
                    ]}
                  >
                    A: {card.back}
                  </Text>
                  {card.hint && (
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        { color: theme.colors.secondary, fontSize: 13, fontStyle: "italic" },
                      ]}
                    >
                      💡 {card.hint}
                    </Text>
                  )}
                  {card.sourceRefs && card.sourceRefs.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {card.sourceRefs.map((ref) => (
                        <SourceRefChip
                          key={`${ref.chunkId}-${ref.page ?? "null"}`}
                          sourceRef={ref}
                          sourceId={material.sourceId}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {material.type === "quiz" && content && "questions" in content && (
            <View style={styles.contentSection}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("material.questionsCount", {
                  count: (content as QuizContent).questions.length,
                })}
              </Text>
              {(content as QuizContent).questions.map((question, idx) => (
                <View
                  key={question.id}
                  style={[
                    styles.quizItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [styles.quizQuestion, { color: theme.colors.onSurface }],
                    ]}
                  >
                    {idx + 1}. {question.prompt}
                  </Text>
                  {question.choices?.map((choice, cIdx) => (
                    <View
                      key={choice.id}
                      style={[
                        styles.choiceItem,
                        {
                          backgroundColor:
                            choice.id === question.correctChoiceId
                              ? theme.colors.successContainer
                              : theme.colors.surface,
                          borderColor:
                            choice.id === question.correctChoiceId
                              ? theme.colors.success
                              : theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          {
                            fontSize: 16,
                            fontWeight: "600",
                            color:
                              choice.id === question.correctChoiceId
                                ? theme.colors.onSuccessContainer
                                : theme.colors.onSurface,
                          },
                        ]}
                      >
                        {String.fromCharCode(65 + cIdx)}.
                      </Text>
                      <Text
                        style={[
                          { color: theme.colors.onSurface },
                          [
                            styles.choiceText,
                            {
                              color:
                                choice.id === question.correctChoiceId
                                  ? theme.colors.onSuccessContainer
                                  : theme.colors.onSurface,
                            },
                          ],
                        ]}
                      >
                        {choice.text}
                      </Text>
                      {choice.id === question.correctChoiceId && (
                        <Text
                          style={[
                            { color: theme.colors.onSurface },
                            { color: theme.colors.onSuccessContainer, fontSize: 16 },
                          ]}
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                  ))}
                  {question.explanation && (
                    <View style={styles.explanation}>
                      <Text style={[{ color: theme.colors.onSurface }, styles.explanationLabel]}>
                        {i18n.t("study.explanation")}
                      </Text>
                      <Text style={[{ color: theme.colors.onSurface }, styles.explanationText]}>
                        {question.explanation}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            {material.type === "flashcards" && (
              <PrimaryButton
                label={i18n.t("material.startStudy")}
                style={styles.actionButton}
                onPress={() => router.push(`/study/flashcards/${material.id}`)}
                accessibilityLabel={i18n.t("material.startStudy")}
              />
            )}
            {material.type === "quiz" && (
              <PrimaryButton
                label={i18n.t("material.startQuiz")}
                style={styles.actionButton}
                onPress={() => router.push(`/study/quiz/${material.id}`)}
                accessibilityLabel={i18n.t("material.startQuiz")}
              />
            )}
            {material.type === "summary" && (
              <PrimaryButton
                label={i18n.t("material.generateFlashcardsFromThis")}
                style={styles.actionButton}
                onPress={() => router.push(`/source/${material.sourceId}/generate?type=flashcards`)}
                accessibilityLabel={i18n.t("material.generateFlashcardsFromThis")}
              />
            )}
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.colors.errorContainer,
                  borderWidth: 1,
                  borderColor: theme.colors.error,
                  borderRadius: tokens.radii.lg,
                  paddingVertical: 12,
                  alignItems: "center",
                },
              ]}
              onPress={() => setShowDeleteConfirm(true)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: theme.colors.error, fontWeight: "600", fontSize: 15 },
                ]}
              >
                {i18n.t("common.delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {error ? <ErrorState error={error} onRetry={fetchMaterial} /> : null}
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
                {i18n.t("material.deleteTitle")}
              </Text>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalText, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("material.deleteDesc")}
              </Text>
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
