import { Banner } from "@/components/ui/Banner";
import { IconButton, PrimaryButton } from "@/components/ui/Buttons";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { imageToBase64 } from "@/lib/imageUtils";
import { tokens } from "@/theme/tokens";
import { type CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

const MAX_IMAGES = 10;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  preview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 24,
    paddingBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "300",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  frameGuide: {
    position: "absolute",
    top: "20%",
    left: 20,
    right: 20,
    height: "55%",
    borderWidth: 2,
    borderColor: "#5B5BD6",
    borderStyle: "dashed",
    borderRadius: tokens.radii.xl,
  },
  frameCorner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderWidth: 4,
    borderColor: "#5B5BD6",
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  shutterWrapper: {
    flex: 1,
    alignItems: "center",
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#5B5BD6",
  },
  thumbnailStrip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: tokens.radii.md,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailDelete: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(220,38,38,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  pageCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 8,
  },
  tipsText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 4,
  },
  reviewButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewButtonActive: {
    backgroundColor: "#5B5BD6",
  },
  reviewButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#000",
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: "#5B5BD6",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: tokens.radii.full,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default function CaptureScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [photos, setPhotos] = useState<string[]>([]);
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [showTips, setShowTips] = useState(true);

  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current || photos.length >= MAX_IMAGES) return;
    haptics.medium();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        exif: false,
      });
      if (photo?.uri) {
        setPhotos((prev) => [...prev, photo.uri]);
      }
    } catch (err) {
      Alert.alert(i18n.t("common.error"), i18n.t("common.error"));
    }
  }, [photos.length]);

  const handleDeletePhoto = useCallback((index: number) => {
    haptics.light();
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReview = useCallback(() => {
    if (photos.length === 0) return;
    router.push({ pathname: "/capture-review", params: { photos: JSON.stringify(photos) } });
  }, [photos]);

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

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>{i18n.t("capture.cameraDeniedTitle")}</Text>
        <Text style={styles.permissionText}>{i18n.t("capture.cameraDeniedDesc")}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => Linking.openSettings()}>
          <Text style={styles.permissionButtonText}>{i18n.t("capture.openSettings")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => requestPermission()}>
          <Text style={{ color: "#5B5BD6", fontSize: 16, fontWeight: "600" }}>
            {i18n.t("common.retry")}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.preview}
        facing={cameraType}
        flash={torch ? "on" : "off"}
      />
      <View style={styles.overlay}>
        {/* Frame guide */}
        <View style={styles.frameGuide}>
          <View style={[styles.frameCorner, styles.cornerTL]} />
          <View style={[styles.frameCorner, styles.cornerTR]} />
          <View style={[styles.frameCorner, styles.cornerBL]} />
          <View style={[styles.frameCorner, styles.cornerBR]} />
        </View>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityLabel={i18n.t("common.close")}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{i18n.t("capture.title")}</Text>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => setCameraType(cameraType === "back" ? "front" : "back")}
            accessibilityLabel={i18n.t("capture.flipCamera")}
          >
            <Text style={styles.closeButtonText}>⇄</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.reviewButton, photos.length > 0 && styles.reviewButtonActive]}
            onPress={handleReview}
            disabled={photos.length === 0}
            accessibilityLabel={i18n.t("capture.reviewAction", { count: photos.length })}
          >
            <Text style={styles.reviewButtonText}>
              {i18n.t("capture.reviewAction", { count: photos.length })}
            </Text>
          </TouchableOpacity>

          <View style={styles.shutterWrapper}>
            <TouchableOpacity
              style={styles.shutterButton}
              onPress={handleTakePhoto}
              disabled={photos.length >= MAX_IMAGES}
              activeOpacity={0.8}
              accessibilityLabel={i18n.t("capture.takePhoto")}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            {showTips && <Text style={styles.tipsText}>{i18n.t("capture.tips")}</Text>}
          </View>

          <View style={{ width: 44 }} />
        </View>

        {/* Thumbnail strip */}
        {photos.length > 0 && (
          <View
            style={{ position: "absolute", bottom: 140, left: 0, right: 0, paddingHorizontal: 20 }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailStrip}
            >
              {photos.map((uri, index) => (
                <View key={uri} style={styles.thumbnail}>
                  <Image source={{ uri }} style={styles.thumbnailImage} />
                  <TouchableOpacity
                    style={styles.thumbnailDelete}
                    onPress={() => handleDeletePhoto(index)}
                    accessibilityLabel={i18n.t("common.delete")}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <Text style={[styles.pageCount, { textAlign: "center", marginTop: 8 }]}>
              {i18n.t("capture.pageCount", { count: photos.length })}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
