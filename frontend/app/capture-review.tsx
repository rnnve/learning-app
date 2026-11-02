import { createSource } from "@/api/endpoints/sources";
import { localizeError } from "@/api/errors";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { prepareImagesForUpload } from "@/lib/imageUtils";
import { generateUuid } from "@/lib/uuid";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
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
    content: {
      flex: 1,
    },
    photoPager: {
      height: 400,
    },
    photoPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    photoImage: {
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: 380,
    },
    pageIndicator: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
    },
    pageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.outlineVariant,
    },
    pageDotActive: {
      backgroundColor: theme.colors.primary,
      width: 24,
    },
    bottomSection: {
      paddingHorizontal: 20,
      paddingBottom: 30,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: tokens.radii["2xl"],
      borderTopRightRadius: tokens.radii["2xl"],
      marginTop: -tokens.radii["2xl"],
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 20,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: tokens.radii.lg,
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    formSection: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 8,
      color: theme.colors.onSurface,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: tokens.radii.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      backgroundColor: theme.colors.surface,
    },
    langChips: {
      flexDirection: "row",
      gap: 10,
    },
    langChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: tokens.radii.lg,
      borderWidth: 1,
    },
    langChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    langChipInactive: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    },
    langChipText: {
      fontSize: 14,
      fontWeight: "600",
    },
    uploadProgressContainer: {
      marginBottom: 16,
    },
    uploadProgressBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.outlineVariant,
      overflow: "hidden",
      marginBottom: 8,
    },
    uploadProgressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
      borderRadius: 3,
    },
    uploadProgressText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      textAlign: "right",
    },
    uploadButton: {
      paddingVertical: 16,
      borderRadius: tokens.radii.lg,
    },
    uploadButtonDisabled: {
      opacity: 0.6,
    },
  });

type Photo = {
  uri: string;
  index: number;
};

export default function CaptureReviewScreen() {
  const { photos: photosParam } = useLocalSearchParams<{ photos?: string }>();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [languageHint, setLanguageHint] = useState<"th" | "en" | "">("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    try {
      if (photosParam) {
        const parsed = JSON.parse(photosParam);
        setPhotos(parsed.map((uri: string, index: number) => ({ uri, index })));
      }
    } catch {
      // Ignore
    }
  }, [photosParam]);

  const handleAddPage = useCallback(() => {
    router.back();
  }, []);

  const handleRetake = useCallback(() => {
    if (photos.length === 0) return;
    const newPhotos = [...photos];
    newPhotos.splice(currentIndex, 1);
    setPhotos(newPhotos);
    if (currentIndex >= newPhotos.length && newPhotos.length > 0) {
      setCurrentIndex(newPhotos.length - 1);
    }
    router.back();
  }, [photos, currentIndex]);

  const handleUpload = useCallback(async () => {
    if (photos.length === 0 || uploading) return;
    haptics.medium();
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const idempotencyKey = generateUuid();
      const preparedFiles = await prepareImagesForUpload(photos.map((p) => p.uri));

      const res = await createSource({
        files: preparedFiles,
        title: title.trim() || undefined,
        language: languageHint || undefined,
        idempotencyKey,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          }
        },
      });

      setUploadProgress(100);

      haptics.success();
      router.push(`/source/${res.source.id}`);
    } catch (err: any) {
      setUploading(false);
      setError(err);
      haptics.error();
    }
  }, [photos, title, languageHint, uploading]);

  const handleClose = useCallback(() => {
    if (photos.length > 0) {
      Alert.alert(
        i18n.t("common.cancel"),
        i18n.t("capture.reviewAction", { count: photos.length }),
        [
          { text: i18n.t("common.cancel"), style: "cancel" },
          { text: i18n.t("common.delete"), onPress: () => router.back(), style: "destructive" },
        ],
      );
    } else {
      router.back();
    }
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
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
            {i18n.t("review.title")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              { fontSize: 18, color: theme.colors.onSurfaceVariant, textAlign: "center" },
            ]}
          >
            {i18n.t("review.title")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
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
          {i18n.t("review.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.photoPager}
        >
          {photos.map((photo, index) => (
            <View key={photo.uri} style={styles.photoPage}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>

        <View style={styles.pageIndicator}>
          {photos.map((photo, index) => (
            <View
              key={`photo-${photo.uri}`}
              style={[styles.pageDot, index === currentIndex && styles.pageDotActive]}
            />
          ))}
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleRetake}
              activeOpacity={0.9}
              accessibilityLabel={i18n.t("review.retake")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.actionButtonText, { color: theme.colors.error }],
                ]}
              >
                {i18n.t("review.retake")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleAddPage}
              activeOpacity={0.9}
              accessibilityLabel={i18n.t("review.addPage")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.actionButtonText, { color: theme.colors.primary }],
                ]}
              >
                {i18n.t("review.addPage")}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={[{ color: theme.colors.onSurface }, styles.label]}>
              {i18n.t("review.sourceTitlePlaceholder")}
            </Text>
            <TextInput
              style={[{ color: theme.colors.onSurface }, styles.textInput]}
              placeholder={i18n.t("review.sourceTitlePlaceholder")}
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              autoCapitalize="sentences"
              accessibilityLabel={i18n.t("review.sourceTitlePlaceholder")}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[{ color: theme.colors.onSurface }, styles.label]}>
              {i18n.t("review.langHint")}
            </Text>
            <View style={styles.langChips}>
              <TouchableOpacity
                style={[
                  styles.langChip,
                  languageHint === "th" ? styles.langChipActive : styles.langChipInactive,
                ]}
                onPress={() => setLanguageHint(languageHint === "th" ? "" : "th")}
              >
                <Text style={[{ color: theme.colors.onSurface }, styles.langChipText]}>🇹🇭</Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [
                      styles.langChipText,
                      {
                        color:
                          languageHint === "th"
                            ? theme.colors.surface
                            : theme.colors.onSurfaceVariant,
                      },
                    ],
                  ]}
                >
                  Thai
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.langChip,
                  languageHint === "en" ? styles.langChipActive : styles.langChipInactive,
                ]}
                onPress={() => setLanguageHint(languageHint === "en" ? "" : "en")}
              >
                <Text style={[{ color: theme.colors.onSurface }, styles.langChipText]}>🇺🇸</Text>
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    [
                      styles.langChipText,
                      {
                        color:
                          languageHint === "en"
                            ? theme.colors.surface
                            : theme.colors.onSurfaceVariant,
                      },
                    ],
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {uploading && (
            <View style={styles.uploadProgressContainer}>
              <View style={styles.uploadProgressBar}>
                <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={[{ color: theme.colors.onSurface }, styles.uploadProgressText]}>
                {i18n.t("review.uploading")} {uploadProgress}%
              </Text>
            </View>
          )}

          <PrimaryButton
            label={uploading ? i18n.t("review.uploading") : i18n.t("review.submit")}
            style={
              [styles.uploadButton, uploading ? styles.uploadButtonDisabled : null].filter(
                Boolean,
              ) as any
            }
            onPress={handleUpload}
            disabled={uploading || photos.length === 0}
            loading={uploading}
            accessibilityLabel={i18n.t("review.submit")}
          />

          {error ? (
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.error, textAlign: "center", marginTop: 12, fontSize: 14 },
              ]}
            >
              {localizeError(error)}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
