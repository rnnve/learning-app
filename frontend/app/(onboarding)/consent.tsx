import { getMeta } from "@/api/endpoints/meta";
import { useAuth } from "@/auth/AuthProvider";
import { PrimaryButton } from "@/components/ui/Buttons";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 8,
      lineHeight: 32,
    },
    content: {
      marginBottom: 24,
      lineHeight: 24,
    },
    consentText: {
      lineHeight: 22,
      marginBottom: 16,
    },
    privacyButton: {
      marginBottom: 24,
    },
    checkboxContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 24,
      padding: 16,
      borderRadius: tokens.radii.md,
      borderWidth: 1,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      marginRight: 12,
      marginTop: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxUnchecked: {
      borderColor: theme.colors.outlineVariant,
      backgroundColor: "transparent",
    },
    checkboxLabel: {
      flex: 1,
      lineHeight: 22,
      fontSize: 15,
    },
    buttonGroup: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
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
      maxHeight: "85%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 16,
    },
    modalText: {
      lineHeight: 24,
      marginBottom: 16,
    },
    modalClose: {
      marginTop: 8,
      alignSelf: "flex-end",
    },
  });

export default function ConsentScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { acceptConsent } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  // The consent version comes from the backend (GET /v1/meta) so that a new
  // backend consent version invalidates the old acceptance.
  const [consentVersion, setConsentVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMeta()
      .then((meta) => {
        if (!cancelled) setConsentVersion(meta.consentVersion);
      })
      .catch(() => {
        // Fall back to a local version so the student can still continue.
        if (!cancelled) setConsentVersion("2026-10-v1");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAccept = useCallback(async () => {
    if (!accepted || !consentVersion) return;
    try {
      await acceptConsent(consentVersion);
      router.replace("/(tabs)/home");
    } catch {
      // Error handled by AuthProvider
    }
  }, [accepted, acceptConsent, consentVersion, router]);

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", paddingBottom: 40 }}
      >
        <View>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.title, { color: theme.colors.onSurface }],
            ]}
          >
            {i18n.t("onboarding.consentTitle")}
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.content, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {i18n.t("onboarding.consentDesc")}
          </Text>

          <TouchableOpacity
            style={styles.privacyButton}
            onPress={() => setShowPrivacy(true)}
            accessibilityLabel={i18n.t("onboarding.consentPrivacy")}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                {
                  color: theme.colors.primary,
                  fontWeight: "600",
                  fontSize: 15,
                  textDecorationLine: "underline",
                },
              ]}
            >
              {i18n.t("onboarding.consentPrivacy")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.checkboxContainer,
              {
                borderColor: accepted ? theme.colors.primary : theme.colors.outline,
                backgroundColor: accepted ? theme.colors.surface : "transparent",
              },
            ]}
            onPress={() => setAccepted(!accepted)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            testID="consent-checkbox"
          >
            <View
              style={[
                styles.checkbox,
                accepted ? styles.checkboxChecked : styles.checkboxUnchecked,
              ]}
            >
              {accepted && (
                <Text
                  style={[
                    { color: theme.colors.onSurface },
                    { color: theme.colors.onPrimary, fontSize: 16, fontWeight: "700" },
                  ]}
                >
                  ✓
                </Text>
              )}
            </View>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.checkboxLabel, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("onboarding.acceptAndStart")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonGroup}>
          <PrimaryButton
            label={i18n.t("onboarding.acceptAndStart")}
            style={{ flex: 1 }}
            onPress={handleAccept}
            disabled={!accepted || !consentVersion}
            accessibilityLabel={i18n.t("onboarding.acceptAndStart")}
            testID="consent-accept"
          />
        </View>
      </ScrollView>

      <Modal visible={showPrivacy} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.modalTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("onboarding.privacyModalTitle")}
            </Text>
            <ScrollView>
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.modalText, { color: theme.colors.onSurface }],
                ]}
              >
                {i18n.t("onboarding.privacyModalContent")}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPrivacy(false)}
              accessibilityLabel={i18n.t("common.close")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  { color: theme.colors.primary, fontWeight: "600", fontSize: 16 },
                ]}
              >
                {i18n.t("common.close")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
