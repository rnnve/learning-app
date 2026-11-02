import { getMeta } from "@/api/endpoints/home";
import { createSource } from "@/api/endpoints/sources";
import { localizeError } from "@/api/errors";
import { Banner } from "@/components/ui/Banner";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import i18n from "@/i18n";
import { formatBytes } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { type PreparedFile, prepareImagesForUpload } from "@/lib/imageUtils";
import { generateUuid } from "@/lib/uuid";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
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
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    section: {
      marginBottom: 24,
      backgroundColor: theme.colors.surface,
      borderRadius: tokens.radii.xl,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      overflow: "hidden",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
    },
    sectionDesc: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: 20,
      paddingBottom: 16,
      lineHeight: 22,
    },
    optionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceVariant,
    },
    optionIcon: {
      width: 48,
      height: 48,
      borderRadius: tokens.radii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    optionMeta: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.surfaceVariant,
      marginHorizontal: 20,
    },
    selectedFilesContainer: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    selectedFilesTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
    },
    selectedFileItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: tokens.radii.lg,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginBottom: 8,
    },
    selectedFileIcon: {
      width: 40,
      height: 40,
      borderRadius: tokens.radii.md,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedFileInfo: {
      flex: 1,
    },
    selectedFileName: {
      fontSize: 14,
      fontWeight: "500",
      marginBottom: 2,
    },
    selectedFileMeta: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    selectedFileDelete: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.errorContainer,
      alignItems: "center",
      justifyContent: "center",
    },
    uploadButton: {
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 30,
    },
    uploadButtonDisabled: {
      opacity: 0.6,
    },
    emptyState: {
      paddingVertical: 40,
      alignItems: "center",
    },
  });

type DocumentPickerAsset = {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

type ImagePickerAsset = {
  uri: string;
  width?: number;
  height?: number;
  type?: string;
};

export default function ImportScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentPickerAsset | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    getMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  const maxImages = meta?.limits?.maxImagesPerSource || 10;
  const maxDocumentBytes = meta?.limits?.maxDocumentBytes || 25 * 1024 * 1024;

  const handlePickImages = useCallback(async () => {
    if (selectedDocument) {
      Alert.alert(i18n.t("common.error"), i18n.t("import.mutuallyExclusiveDocument"));
      return;
    }
    haptics.light();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxImages - selectedImages.length,
        quality: 1,
        presentationStyle: Platform.OS === "ios" ? "fullScreen" : "pageSheet",
      } as any);
      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((a) => a.uri);
        if (selectedImages.length + newImages.length > maxImages) {
          Alert.alert(i18n.t("common.error"), i18n.t("import.tooManyImages", { max: maxImages }));
          return;
        }
        setSelectedImages((prev) => [...prev, ...newImages]);
      }
    } catch (err: any) {
      setError(err);
    }
  }, [selectedImages.length, selectedDocument, maxImages]);

  const handlePickDocument = useCallback(async () => {
    if (selectedImages.length > 0) {
      Alert.alert(i18n.t("common.error"), i18n.t("import.mutuallyExclusiveImages"));
      return;
    }
    haptics.light();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size && file.size > maxDocumentBytes) {
          Alert.alert(
            i18n.t("import.fileTooBig", { maxMb: Math.round(maxDocumentBytes / 1024 / 1024) }),
          );
          return;
        }
        setSelectedDocument(file);
      }
    } catch (err: any) {
      setError(err);
    }
  }, [selectedImages.length, maxDocumentBytes]);

  const handleRemoveImage = useCallback((index: number) => {
    haptics.light();
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveDocument = useCallback(() => {
    haptics.light();
    setSelectedDocument(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if ((selectedImages.length === 0 && !selectedDocument) || uploading) return;
    haptics.medium();
    setUploading(true);
    setError(null);

    try {
      const idempotencyKey = generateUuid();
      let files: PreparedFile[] = [];

      if (selectedImages.length > 0) {
        files = await prepareImagesForUpload(selectedImages);
      } else if (selectedDocument) {
        files = [
          {
            filename: selectedDocument.name || "document",
            uri: selectedDocument.uri,
            mime: selectedDocument.mimeType || "application/pdf",
            sizeBytes: selectedDocument.size || 0,
          },
        ];
      }

      const res = await createSource({
        files,
        idempotencyKey,
      });

      haptics.success();
      router.push(`/source/${res.source.id}`);
    } catch (err: any) {
      setUploading(false);
      setError(err);
      haptics.error();
    }
  }, [selectedImages, selectedDocument, uploading]);

  const handleClose = useCallback(() => {
    if (selectedImages.length > 0 || selectedDocument) {
      Alert.alert(i18n.t("common.cancel"), i18n.t("import.discardConfirm"), [
        { text: i18n.t("common.cancel"), style: "cancel" },
        { text: i18n.t("common.delete"), onPress: () => router.back(), style: "destructive" },
      ]);
    } else {
      router.back();
    }
  }, [selectedImages.length, selectedDocument]);

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
          {i18n.t("import.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[{ color: theme.colors.onSurface }, styles.sectionTitle]}>
            {i18n.t("import.galleryTitle")}
          </Text>
          <Text style={[{ color: theme.colors.onSurface }, styles.sectionDesc]}>
            {i18n.t("import.galleryDesc", { max: maxImages - selectedImages.length })}
          </Text>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={handlePickImages}
            disabled={selectedDocument !== null || selectedImages.length >= maxImages}
            activeOpacity={0.9}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[{ color: theme.colors.onSurface }, { fontSize: 22 }]}>🖼️</Text>
            </View>
            <View style={styles.optionInfo}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.optionLabel, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("import.galleryTitle")}
              </Text>
              <Text style={[{ color: theme.colors.onSurface }, styles.optionMeta]}>
                {selectedImages.length}/{maxImages} {i18n.t("common.photos")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[{ color: theme.colors.onSurface }, styles.sectionTitle]}>
            {i18n.t("import.documentTitle")}
          </Text>
          <Text style={[{ color: theme.colors.onSurface }, styles.sectionDesc]}>
            {i18n.t("import.documentDesc", { maxMb: Math.round(maxDocumentBytes / 1024 / 1024) })}
          </Text>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={handlePickDocument}
            disabled={selectedImages.length > 0 || selectedDocument !== null}
            activeOpacity={0.9}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.colors.infoContainer }]}>
              <Text style={[{ color: theme.colors.onSurface }, { fontSize: 22 }]}>📄</Text>
            </View>
            <View style={styles.optionInfo}>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.optionLabel, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("import.documentTitle")}
              </Text>
              <Text style={[{ color: theme.colors.onSurface }, styles.optionMeta]}>
                {selectedDocument ? selectedDocument.name : i18n.t("common.none")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {(selectedImages.length > 0 || selectedDocument) && (
          <View style={styles.selectedFilesContainer}>
            <Text style={[{ color: theme.colors.onSurface }, styles.selectedFilesTitle]}>
              {i18n.t("common.selected", {
                count: selectedImages.length + (selectedDocument ? 1 : 0),
              })}
            </Text>
            {selectedImages.map((uri, index) => (
              <View key={uri} style={styles.selectedFileItem}>
                <View style={styles.selectedFileIcon}>
                  <Image
                    source={{ uri }}
                    style={{ width: 30, height: 30, borderRadius: tokens.radii.sm }}
                  />
                </View>
                <View style={styles.selectedFileInfo}>
                  <Text style={[{ color: theme.colors.onSurface }, styles.selectedFileName]}>
                    Photo {index + 1}
                  </Text>
                  <Text style={[{ color: theme.colors.onSurface }, styles.selectedFileMeta]}>
                    Image
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.selectedFileDelete}
                  onPress={() => handleRemoveImage(index)}
                  accessibilityLabel={i18n.t("common.delete")}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.error, fontSize: 14 },
                    ]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            {selectedDocument && (
              <View style={styles.selectedFileItem}>
                <View style={styles.selectedFileIcon}>
                  <Text style={[{ color: theme.colors.onSurface }, { fontSize: 18 }]}>
                    {selectedDocument.mimeType === "application/pdf" ? "📄" : "📝"}
                  </Text>
                </View>
                <View style={styles.selectedFileInfo}>
                  <Text style={[{ color: theme.colors.onSurface }, styles.selectedFileName]}>
                    {selectedDocument.name}
                  </Text>
                  <Text style={[{ color: theme.colors.onSurface }, styles.selectedFileMeta]}>
                    {formatBytes(selectedDocument.size || 0)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.selectedFileDelete}
                  onPress={handleRemoveDocument}
                  accessibilityLabel={i18n.t("common.delete")}
                >
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { color: theme.colors.error, fontSize: 14 },
                    ]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {error ? (
          <View
            style={{
              marginHorizontal: 20,
              marginBottom: 16,
              padding: 12,
              backgroundColor: theme.colors.errorContainer,
              borderRadius: tokens.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.error,
            }}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                { color: theme.colors.error, fontSize: 14 },
              ]}
            >
              {localizeError(error)}
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          label={uploading ? i18n.t("review.uploading") : i18n.t("review.submit")}
          style={
            [
              styles.uploadButton,
              selectedImages.length === 0 && !selectedDocument ? styles.uploadButtonDisabled : null,
            ].filter(Boolean) as any
          }
          onPress={handleUpload}
          disabled={uploading || (selectedImages.length === 0 && !selectedDocument)}
          loading={uploading}
          accessibilityLabel={i18n.t("review.submit")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
