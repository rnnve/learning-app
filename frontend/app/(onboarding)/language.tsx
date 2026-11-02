import { useAuth } from "@/auth/AuthProvider";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ErrorState } from "@/components/ui/ErrorState";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 28,
      paddingVertical: 40,
      justifyContent: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 10,
      lineHeight: 36,
    },
    subtitle: {
      fontSize: 16,
      textAlign: "center",
      marginBottom: 40,
      lineHeight: 24,
    },
    langCard: {
      flex: 1,
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderRadius: tokens.radii.xl,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    langCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    langCardUnselected: {
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surface,
    },
    langLabel: {
      fontSize: 24,
      fontWeight: "700",
      marginTop: 8,
    },
    langSubLabel: {
      fontSize: 14,
      marginTop: 4,
    },
    buttonGroup: {
      flexDirection: "row",
      gap: 12,
      marginTop: 32,
    },
  });

export default function LanguageScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { startGuestSession } = useAuth();
  const [selectedLang, setSelectedLang] = useState<"th" | "en">("th");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Contract 8: the guest session has to exist before the consent can be
   * recorded (`PUT /v1/me/consent` is an authenticated endpoint).
   */
  const handleContinue = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await i18n.changeLanguage(selectedLang);
      await startGuestSession();
      router.replace("/(onboarding)/consent");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }, [selectedLang, startGuestSession, router]);

  const isSelected = (lang: "th" | "en") => selectedLang === lang;

  if (error) {
    return (
      <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
        <ErrorState error={error} onRetry={handleContinue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.title, { color: theme.colors.onSurface }],
        ]}
      >
        {i18n.t("onboarding.selectLanguage")}
      </Text>
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.subtitle, { color: theme.colors.onSurfaceVariant }],
        ]}
      >
        {i18n.t("onboarding.welcomeSubtitle")}
      </Text>

      <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
        <TouchableOpacity
          style={[
            styles.langCard,
            isSelected("th") ? styles.langCardSelected : styles.langCardUnselected,
          ]}
          onPress={() => setSelectedLang("th")}
          accessibilityRole="radio"
          accessibilityState={{ checked: isSelected("th") }}
          accessibilityLabel={i18n.t("onboarding.languageThai")}
          testID="language-th"
        >
          <Text style={[{ color: theme.colors.onSurface }, styles.langLabel]}>ไทย</Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.langSubLabel, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            Thai
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.langCard,
            isSelected("en") ? styles.langCardSelected : styles.langCardUnselected,
          ]}
          onPress={() => setSelectedLang("en")}
          accessibilityRole="radio"
          accessibilityState={{ checked: isSelected("en") }}
          accessibilityLabel={i18n.t("onboarding.languageEnglish")}
          testID="language-en"
        >
          <Text style={[{ color: theme.colors.onSurface }, styles.langLabel]}>English</Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.langSubLabel, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            English
          </Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton
        label={i18n.t("common.next")}
        onPress={handleContinue}
        loading={submitting}
        style={{ marginTop: 24 }}
        accessibilityLabel={i18n.t("common.next")}
        testID="language-continue"
      />
    </SafeAreaView>
  );
}
