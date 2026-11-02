import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Contract 9.1: the intro has at most three slides. */
const INTRO_SLIDES = [
  { title: "onboarding.step1Title", description: "onboarding.step1Desc" },
  { title: "onboarding.step2Title", description: "onboarding.step2Desc" },
  { title: "onboarding.step3Title", description: "onboarding.step3Desc" },
] as const;

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 28,
      paddingVertical: 40,
      justifyContent: "center",
    },
    illustration: {
      width: 180,
      height: 180,
      alignSelf: "center",
      marginBottom: 32,
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
    step: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 24,
      gap: 14,
    },
    stepNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    stepNumberText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    stepText: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 26,
    },
    stepDescription: {
      fontSize: 15,
      lineHeight: 22,
      marginTop: 2,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      marginBottom: 24,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.outlineVariant,
    },
    dotActive: {
      backgroundColor: theme.colors.primary,
      width: 22,
    },
    buttonGroup: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    button: {
      flex: 1,
    },
  });

export default function WelcomeScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const isLastSlide = slide === INTRO_SLIDES.length - 1;

  const goToLanguage = useCallback(() => {
    router.replace("/(onboarding)/language");
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      goToLanguage();
      return;
    }
    setSlide((current) => current + 1);
  }, [goToLanguage, isLastSlide]);

  return (
    <SafeAreaView style={[{ backgroundColor: theme.colors.background }, styles.container]}>
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.title, { color: theme.colors.onSurface }],
          ]}
        >
          {i18n.t("onboarding.welcomeTitle")}
        </Text>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.subtitle, { color: theme.colors.onSurfaceVariant }],
          ]}
        >
          {i18n.t("onboarding.welcomeSubtitle")}
        </Text>
      </View>

      <View style={styles.step}>
        <View style={styles.stepNumber}>
          <Text style={[{ color: theme.colors.onSurface }, styles.stepNumberText]}>
            {slide + 1}
          </Text>
        </View>
        <View style={styles.stepText}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.stepTitle, { color: theme.colors.onSurface }],
            ]}
          >
            {i18n.t(INTRO_SLIDES[slide].title)}
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.stepDescription, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {i18n.t(INTRO_SLIDES[slide].description)}
          </Text>
        </View>
      </View>

      <View style={styles.dots}>
        {INTRO_SLIDES.map((introSlide) => (
          <View
            key={introSlide.title}
            style={[
              styles.dot,
              INTRO_SLIDES[slide].title === introSlide.title ? styles.dotActive : null,
            ]}
            testID={`intro-dot-${introSlide.title}`}
          />
        ))}
      </View>

      <View style={styles.buttonGroup}>
        <PrimaryButton
          label={isLastSlide ? i18n.t("common.start") : i18n.t("common.next")}
          style={styles.button}
          onPress={handleNext}
          accessibilityLabel={isLastSlide ? i18n.t("common.start") : i18n.t("common.next")}
          testID="intro-next"
        />
        <SecondaryButton
          label={i18n.t("onboarding.skip")}
          style={styles.button}
          onPress={goToLanguage}
          accessibilityLabel={i18n.t("onboarding.skip")}
          testID="intro-skip"
        />
      </View>
    </SafeAreaView>
  );
}
