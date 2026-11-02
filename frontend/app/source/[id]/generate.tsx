import { createMaterial } from "@/api/endpoints/materials";
import { getSource } from "@/api/endpoints/sources";
import { MaterialType, type Source } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { useJob } from "@/features/sources/useJob";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { generateUuid } from "@/lib/uuid";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
    handle: {
      width: 40,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.colors.outlineVariant,
      alignSelf: "center",
      marginTop: 8,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 20,
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
    content: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    sourceInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      marginBottom: 20,
    },
    sourceIcon: {
      width: 48,
      height: 48,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: "center",
      justifyContent: "center",
    },
    sourceTitle: {
      fontSize: 16,
      fontWeight: "600",
    },
    sourceMeta: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceVariant,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: "500",
    },
    optionValue: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    sliderContainer: {
      paddingVertical: 8,
    },
    sliderLabel: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    sliderValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: tokens.radii.full,
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipInactive: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
    },
    rangeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rangeInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: tokens.radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      textAlign: "center",
    },
    rangeSeparator: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    generateButton: {
      marginTop: 24,
      paddingVertical: 16,
      borderRadius: tokens.radii.lg,
    },
    generateButtonDisabled: {
      opacity: 0.6,
    },
    generatingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(255,255,255,0.95)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    generatingTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginTop: 20,
      marginBottom: 8,
      textAlign: "center",
    },
    generatingSubtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 24,
    },
  });

type GenerateType = "summary" | "flashcards" | "quiz";

export default function GenerateScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { isAuthenticated, user } = useAuth();
  const { id: sourceId, type = "summary" } = useLocalSearchParams<{
    id: string;
    type?: GenerateType;
  }>();
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Poll the generation job (1.5 s, backing off to 4 s after 30 s).
  const { job, isError: isJobError, error: jobQueryError, refetch: refetchJob } = useJob(jobId);

  // Options state
  const [options, setOptions] = useState({
    language: (user?.preferences?.contentLanguage || "auto") as "auto" | "th" | "en",
    level: (user?.preferences?.level || "general") as any,
    pageRange: { from: "", to: "" } as { from: string; to: string },
    // Summary
    length: "medium" as "short" | "medium" | "detailed",
    // Flashcards
    count: 15,
    // Quiz
    quizCount: 10,
    difficulty: "mixed" as "easy" | "medium" | "hard" | "mixed",
    questionTypes: ["multiple_choice", "true_false", "short_answer"] as Array<
      "multiple_choice" | "true_false" | "short_answer"
    >,
  });

  useEffect(() => {
    // Fetch source info
    getSource(sourceId)
      .then(setSource)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sourceId]);

  const updateOption = useCallback(
    <K extends keyof typeof options>(key: K, value: (typeof options)[K]) => {
      haptics.light();
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    haptics.medium();
    setGenerating(true);
    setError(null);

    try {
      const idempotencyKey = generateUuid();
      const pageRange =
        options.pageRange.from && options.pageRange.to
          ? {
              from: Number.parseInt(options.pageRange.from, 10),
              to: Number.parseInt(options.pageRange.to, 10),
            }
          : null;

      const materialOptions: any = {
        language: options.language,
        level: options.level,
        pageRange,
      };

      if (type === "summary") {
        materialOptions.length = options.length;
      } else if (type === "flashcards") {
        materialOptions.count = options.count;
      } else if (type === "quiz") {
        materialOptions.count = options.quizCount;
        materialOptions.difficulty = options.difficulty;
        materialOptions.questionTypes = options.questionTypes;
      }

      const res = await createMaterial({
        type,
        sourceId,
        options: materialOptions,
        idempotencyKey,
      });

      setJobId(res.job.id);
    } catch (err: any) {
      setGenerating(false);
      setError(err);
      haptics.error();
    }
  }, [generating, type, sourceId, options]);

  // React to the polled job: open the material when it is ready, otherwise
  // surface the failure (the material id only exists once the job succeeded).
  useEffect(() => {
    if (!job) return;

    if (job.status === "succeeded") {
      const materialId = job.result?.materialId;
      if (materialId) {
        haptics.success();
        router.replace(`/material/${materialId}`);
      } else {
        setGenerating(false);
        setError("errors.GENERIC_FALLBACK");
      }
    } else if (job.status === "failed" || job.status === "canceled") {
      setGenerating(false);
      // The raw server message is only shown for an unmapped error code
      // (contract 3.2 + i18n rules).
      const code = job.error?.code;
      setError(
        code && i18n.exists(`errors.${code}`)
          ? `errors.${code}`
          : (job.error?.message ?? "errors.GENERIC_FALLBACK"),
      );
      haptics.error();
    }
  }, [job]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.handle} />
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

  const typeLabels = {
    summary: i18n.t("material.summaryTitle"),
    flashcards: i18n.t("material.flashcardsTitle"),
    quiz: i18n.t("material.quizTitle"),
  };

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={[{ color: theme.colors.onSurface }, styles.headerTitle]}>
          {i18n.t("generate.title")}
        </Text>
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
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {source && (
          <View style={styles.sourceInfo}>
            <View style={styles.sourceIcon}>
              <Text style={[{ color: theme.colors.onSurface }, { fontSize: 22 }]}>📄</Text>
            </View>
            <View>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sourceTitle, { color: theme.colors.onSurface }],
                ]}
                numberOfLines={2}
              >
                {source.title}
              </Text>
              <Text style={[{ color: theme.colors.onSurface }, styles.sourceMeta]}>
                {source.pageCount} {i18n.t("source.pagesCount", { count: source.pageCount })} •{" "}
                {i18n.t(`enums.sourceKinds.${source.kind}`)}
              </Text>
            </View>
          </View>
        )}

        {/* Common Options */}
        <View style={styles.section}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.sectionTitle, { color: theme.colors.onSurface }],
            ]}
          >
            {i18n.t("generate.language")}
          </Text>
          <View style={styles.chipRow}>
            {["auto", "th", "en"].map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.chip,
                  options.language === lang ? styles.chipActive : styles.chipInactive,
                ]}
                onPress={() => updateOption("language", lang as any)}
              >
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [
                      styles.chipText,
                      {
                        color:
                          options.language === lang ? theme.colors.surface : theme.colors.onSurface,
                      },
                    ],
                  ]}
                >
                  {lang === "auto"
                    ? i18n.t("enums.contentLanguages.auto")
                    : lang === "th"
                      ? "Thai"
                      : "English"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.sectionTitle, { color: theme.colors.onSurface }],
            ]}
          >
            {i18n.t("generate.level")}
          </Text>
          <View style={styles.chipRow}>
            {["primary", "lower_secondary", "upper_secondary", "university", "general", "auto"].map(
              (level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.chip,
                    options.level === level ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => updateOption("level", level)}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [
                        styles.chipText,
                        {
                          color:
                            options.level === level ? theme.colors.surface : theme.colors.onSurface,
                        },
                      ],
                    ]}
                  >
                    {i18n.t(`enums.levels.${level}`).split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>

        {source && source.pageCount > 1 && (
          <View style={styles.section}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("generate.pageRange")}
            </Text>
            <View style={styles.rangeRow}>
              <TextInput
                style={[{ color: theme.colors.onSurface }, styles.rangeInput]}
                placeholder={i18n.t("generate.pageFrom")}
                value={options.pageRange.from}
                onChangeText={(v: string) =>
                  updateOption("pageRange", { ...options.pageRange, from: v })
                }
                keyboardType="numeric"
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />
              <Text style={[{ color: theme.colors.onSurface }, styles.rangeSeparator]}>-</Text>
              <TextInput
                style={[{ color: theme.colors.onSurface }, styles.rangeInput]}
                placeholder={i18n.t("generate.pageTo")}
                value={options.pageRange.to}
                onChangeText={(v: string) =>
                  updateOption("pageRange", { ...options.pageRange, to: v })
                }
                keyboardType="numeric"
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />
            </View>
          </View>
        )}

        {/* Type-specific Options */}
        {type === "summary" && (
          <View style={styles.section}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("generate.summaryLength")}
            </Text>
            <View style={styles.chipRow}>
              {["short", "medium", "detailed"].map((len) => (
                <TouchableOpacity
                  key={len}
                  style={[
                    styles.chip,
                    options.length === len ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => updateOption("length", len as any)}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [
                        styles.chipText,
                        {
                          color:
                            options.length === len ? theme.colors.surface : theme.colors.onSurface,
                        },
                      ],
                    ]}
                  >
                    {i18n.t(`generate.length${len.charAt(0).toUpperCase() + len.slice(1)}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {type === "flashcards" && (
          <View style={styles.section}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.sectionTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("generate.flashcardCount", { count: options.count })}
            </Text>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabel}>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant, fontSize: 13 },
                  ]}
                >
                  5
                </Text>
                <Text style={[{ color: theme.colors.onSurface }, styles.sliderValue]}>
                  {options.count}
                </Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onSurfaceVariant, fontSize: 13 },
                  ]}
                >
                  50
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  backgroundColor: theme.colors.outlineVariant,
                  borderRadius: 2,
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${((options.count - 5) / 45) * 100}%`,
                    backgroundColor: theme.colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>
            <View style={styles.chipRow}>
              {[5, 10, 15, 20, 25, 30, 40, 50].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.chip,
                    options.count === c ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => updateOption("count", c)}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      [
                        styles.chipText,
                        {
                          color:
                            options.count === c ? theme.colors.surface : theme.colors.onSurface,
                        },
                      ],
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {type === "quiz" && (
          <>
            <View style={styles.section}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("generate.quizCount", { count: options.quizCount })}
              </Text>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderLabel}>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.onSurfaceVariant, fontSize: 13 },
                    ]}
                  >
                    3
                  </Text>
                  <Text style={[{ color: theme.colors.onSurface }, styles.sliderValue]}>
                    {options.quizCount}
                  </Text>
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.onSurfaceVariant, fontSize: 13 },
                    ]}
                  >
                    30
                  </Text>
                </View>
                <View
                  style={{
                    height: 4,
                    backgroundColor: theme.colors.outlineVariant,
                    borderRadius: 2,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${((options.quizCount - 3) / 27) * 100}%`,
                      backgroundColor: theme.colors.primary,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("generate.difficulty")}
              </Text>
              <View style={styles.chipRow}>
                {["easy", "medium", "hard", "mixed"].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.chip,
                      options.difficulty === d ? styles.chipActive : styles.chipInactive,
                    ]}
                    onPress={() => updateOption("difficulty", d as any)}
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [
                          styles.chipText,
                          {
                            color:
                              options.difficulty === d
                                ? theme.colors.surface
                                : theme.colors.onSurface,
                          },
                        ],
                      ]}
                    >
                      {i18n.t(`enums.difficulties.${d}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.sectionTitle, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("generate.questionTypes")}
              </Text>
              <View style={styles.chipRow}>
                {["multiple_choice", "true_false", "short_answer"].map((qt) => (
                  <TouchableOpacity
                    key={qt}
                    style={[
                      styles.chip,
                      options.questionTypes.includes(qt as any)
                        ? styles.chipActive
                        : styles.chipInactive,
                    ]}
                    onPress={() =>
                      updateOption(
                        "questionTypes",
                        options.questionTypes.includes(qt as any)
                          ? options.questionTypes.filter((t) => t !== qt)
                          : [...options.questionTypes, qt as any],
                      )
                    }
                  >
                    <Text
                      style={[
                        { color: theme.colors.onSurface },
                        [
                          styles.chipText,
                          {
                            color: options.questionTypes.includes(qt as any)
                              ? theme.colors.surface
                              : theme.colors.onSurface,
                          },
                        ],
                      ]}
                    >
                      {i18n.t(`enums.questionTypes.${qt}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {error ? (
          <ErrorState error={error} onRetry={handleGenerate} style={{ marginBottom: 16 }} />
        ) : null}

        <PrimaryButton
          label={generating ? i18n.t("generate.inProgressTitle") : i18n.t("generate.submit")}
          style={
            [styles.generateButton, generating ? styles.generateButtonDisabled : null].filter(
              Boolean,
            ) as any
          }
          onPress={handleGenerate}
          disabled={generating}
          loading={generating}
          accessibilityLabel={i18n.t("generate.submit")}
          testID="generate-submit"
        />
      </ScrollView>

      {generating && jobId && (
        <View style={styles.generatingOverlay}>
          {isJobError ? (
            <ErrorState
              error={jobQueryError}
              message={
                (jobQueryError as any)?.getLocalizedMessage?.() ?? i18n.t("errors.GENERIC_FALLBACK")
              }
              onRetry={() => {
                refetchJob();
              }}
            />
          ) : (
            <>
              <ProgressSteps
                stage={job?.stage ?? "preparing_context"}
                progress={job?.progress ?? 0}
                detail={job?.detail ?? null}
                type="generate"
              />
              <Text style={[{ color: theme.colors.onSurface }, styles.generatingTitle]}>
                {i18n.t("generate.inProgressTitle")}
              </Text>
              <Text style={[{ color: theme.colors.onSurface }, styles.generatingSubtitle]}>
                {i18n.t("generate.inProgressTitle")}
              </Text>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
