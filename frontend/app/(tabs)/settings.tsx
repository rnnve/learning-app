import { deleteMe, getMe } from "@/api/endpoints/me";
import type { Preferences } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { SecondaryButton } from "@/components/ui/Buttons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import i18n from "@/i18n";
import { haptics } from "@/lib/haptics";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
}

function ChoiceChip({ label, selected, onPress, icon }: ChoiceChipProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      activeOpacity={0.76}
      onPress={onPress}
      style={[
        styles.choiceChip,
        {
          backgroundColor: selected ? theme.colors.secondaryContainer : theme.colors.surfaceVariant,
          borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
        },
      ]}
    >
      {icon ? (
        <Text style={[{ color: theme.colors.onSurface }, styles.choiceIcon]}>{icon}</Text>
      ) : null}
      <Text
        style={[
          { color: theme.colors.onSurface },
          [
            styles.choiceLabel,
            { color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant },
          ],
        ]}
      >
        {label}
      </Text>
      {selected ? (
        <View style={[styles.selectedMark, { backgroundColor: theme.colors.primary }]}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.selectedMarkText, { color: theme.colors.onPrimary }],
            ]}
          >
            ✓
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function Section({
  title,
  children,
  danger = false,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: danger ? theme.colors.errorContainer : theme.colors.surface,
          borderColor: danger ? theme.colors.error : theme.colors.outlineVariant,
        },
      ]}
    >
      <Text
        style={[
          { color: theme.colors.onSurface },
          [
            styles.sectionTitle,
            { color: danger ? theme.colors.error : theme.colors.onSurfaceVariant },
          ],
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function PreferenceBlock({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.preferenceBlock}>
      <Text
        style={[
          { color: theme.colors.onSurface },
          [styles.preferenceLabel, { color: theme.colors.onSurface }],
        ]}
      >
        {label}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.choiceGrid}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { user, updateUserPreferences, isGuest, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [apiVersion, setApiVersion] = useState("1.0.0");

  useEffect(() => {
    getMe()
      .then((response: any) => setApiVersion(response.apiVersion || "1.0.0"))
      .catch(() => {});
  }, []);

  const updatePreference = useCallback(
    async (preference: Partial<Preferences>) => {
      haptics.light();
      try {
        await updateUserPreferences(preference);
      } catch (preferenceError) {
        setError(preferenceError);
      }
    },
    [updateUserPreferences],
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    haptics.light();
    setSigningOut(true);
    setError(null);
    try {
      await queryClient.cancelQueries();
      await signOut();
      queryClient.clear();
      router.replace("/auth/sign-in");
    } catch (signOutError) {
      setError(signOutError);
    } finally {
      setSigningOut(false);
    }
  }, [signOut, signingOut, queryClient]);

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteMe();
      await signOut();
      router.replace("/auth/sign-in");
    } catch (deleteError) {
      setError(deleteError);
      setDeleting(false);
    }
  }, [signOut]);

  if (!user) return null;

  const initials = user.displayName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16, paddingBottom: 104 + insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.title, { color: theme.colors.onSurface }],
          ]}
        >
          {i18n.t("settings.title")}
        </Text>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.subtitle, { color: theme.colors.onSurfaceVariant }],
          ]}
        >
          {i18n.t("settings.sectionPreferences")}
        </Text>
      </View>

      <Section title={i18n.t("settings.sectionAccount")}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.avatarText, { color: theme.colors.onPrimaryContainer }],
              ]}
            >
              {initials}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.userName, { color: theme.colors.onSurface }],
              ]}
            >
              {user.displayName}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.userMeta, { color: theme.colors.onSurfaceVariant }],
              ]}
            >
              {user.email || i18n.t("settings.guestBadge")}
            </Text>
          </View>
          <View
            style={[
              styles.accountBadge,
              {
                backgroundColor: isGuest
                  ? theme.colors.secondaryContainer
                  : theme.colors.tertiaryContainer,
              },
            ]}
          >
            <Text
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.accountBadgeText,
                  {
                    color: isGuest
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onTertiaryContainer,
                  },
                ],
              ]}
            >
              {isGuest ? i18n.t("settings.guestBadge") : i18n.t("settings.registeredBadge")}
            </Text>
          </View>
        </View>

        {isGuest ? (
          <View style={styles.accountActions}>
            <TouchableOpacity
              style={[styles.accountButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push("/auth/register")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.accountButtonText, { color: theme.colors.onPrimary }],
                ]}
              >
                {i18n.t("settings.upgradeAccount")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accountButton, { backgroundColor: theme.colors.secondaryContainer }]}
              onPress={() => router.push("/auth/sign-in")}
            >
              <Text
                style={[
                  { color: theme.colors.onSurface },
                  [styles.accountButtonText, { color: theme.colors.onSecondaryContainer }],
                ]}
              >
                {i18n.t("settings.signIn")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <SecondaryButton
          label={i18n.t("settings.signOut")}
          onPress={handleSignOut}
          loading={signingOut}
          disabled={signingOut || deleting}
          style={styles.logoutButton}
          testID="settings-logout"
        />
      </Section>

      <Section title={i18n.t("settings.sectionPreferences")}>
        <PreferenceBlock label={i18n.t("settings.uiLanguage")}>
          <ChoiceChip
            icon="🇹🇭"
            label={i18n.t("onboarding.languageThai")}
            selected={user.preferences?.uiLanguage === "th"}
            onPress={() => updatePreference({ uiLanguage: "th" })}
          />
          <ChoiceChip
            icon="🇺🇸"
            label="English"
            selected={user.preferences?.uiLanguage === "en"}
            onPress={() => updatePreference({ uiLanguage: "en" })}
          />
        </PreferenceBlock>

        <PreferenceBlock label={i18n.t("settings.contentLanguage")}>
          {(["auto", "th", "en"] as const).map((language) => (
            <ChoiceChip
              key={language}
              label={i18n.t(`enums.contentLanguages.${language}`)}
              selected={user.preferences?.contentLanguage === language}
              onPress={() => updatePreference({ contentLanguage: language })}
            />
          ))}
        </PreferenceBlock>

        <PreferenceBlock label={i18n.t("settings.studyLevel")}>
          {(
            ["primary", "lower_secondary", "upper_secondary", "university", "general"] as const
          ).map((level) => (
            <ChoiceChip
              key={level}
              label={i18n.t(`enums.levels.${level}`)}
              selected={user.preferences?.level === level}
              onPress={() => updatePreference({ level })}
            />
          ))}
        </PreferenceBlock>

        <PreferenceBlock label={i18n.t("settings.theme")}>
          {(["system", "light", "dark"] as const).map((themeMode) => (
            <ChoiceChip
              key={themeMode}
              label={i18n.t(`enums.themes.${themeMode}`)}
              selected={user.preferences?.theme === themeMode}
              onPress={() => updatePreference({ theme: themeMode })}
            />
          ))}
        </PreferenceBlock>
      </Section>

      <Section title={i18n.t("settings.sectionPrivacy")}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: user.consent?.aiProcessing
                  ? tokens.colors.ratings.good
                  : theme.colors.outline,
              },
            ]}
          />
          <View style={styles.statusText}>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.rowTitle, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("settings.consentStatus")}
            </Text>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.rowDescription, { color: theme.colors.onSurfaceVariant }],
              ]}
            >
              {user.consent?.aiProcessing
                ? i18n.t("settings.consentAccepted")
                : i18n.t("settings.consentNotAccepted")}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() =>
            Alert.alert(i18n.t("settings.privacyDetails"), i18n.t("onboarding.privacyModalContent"))
          }
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.linkLabel, { color: theme.colors.primary }],
            ]}
          >
            {i18n.t("settings.privacyDetails")}
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.chevron, { color: theme.colors.primary }],
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </Section>

      <Section title={i18n.t("settings.sectionDanger")} danger>
        <Text
          style={[
            { color: theme.colors.onSurface },
            [styles.dangerDescription, { color: theme.colors.onErrorContainer }],
          ]}
        >
          {i18n.t("settings.deleteConfirmPrompt")}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
          onPress={() => setShowDeleteConfirm(true)}
        >
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.deleteIcon, { color: theme.colors.onError }],
            ]}
          >
            ⌫
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.deleteButtonText, { color: theme.colors.onError }],
            ]}
          >
            {i18n.t("settings.deleteAllData")}
          </Text>
        </TouchableOpacity>
      </Section>

      <Section title={i18n.t("settings.version")}>
        <View style={styles.aboutRow}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.rowTitle, { color: theme.colors.onSurface }],
            ]}
          >
            {i18n.t("settings.apiUrl")}
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.rowDescription, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {apiVersion}
          </Text>
        </View>
      </Section>

      {error ? <ErrorState error={error} /> : null}

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={i18n.t("settings.deleteAllData")}
        message={i18n.t("settings.deleteConfirmPrompt")}
        confirmLabel={deleting ? i18n.t("common.loading") : i18n.t("common.delete")}
        cancelLabel={i18n.t("common.cancel")}
        requiredConfirmText="DELETE"
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteConfirm(false)}
        isDestructive
      />
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
    },
    header: {
      marginBottom: 20,
      paddingHorizontal: 4,
    },
    title: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: "700",
    },
    subtitle: {
      marginTop: 2,
      fontSize: 14,
      lineHeight: 20,
    },
    section: {
      padding: 16,
      marginBottom: 16,
      borderRadius: tokens.radii["2xl"],
      borderWidth: 1,
      overflow: "hidden",
    },
    sectionTitle: {
      marginBottom: 14,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 52,
      height: 52,
      marginRight: 12,
      borderRadius: tokens.radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 19,
      fontWeight: "700",
    },
    profileText: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      fontSize: 17,
      lineHeight: 24,
      fontWeight: "700",
    },
    userMeta: {
      fontSize: 13,
      lineHeight: 18,
    },
    accountBadge: {
      maxWidth: 96,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: tokens.radii.full,
    },
    accountBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
    },
    accountActions: {
      marginTop: 16,
      gap: 10,
    },
    accountButton: {
      minHeight: 48,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: tokens.radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    accountButtonText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    logoutButton: {
      marginTop: 16,
    },
    preferenceBlock: {
      paddingVertical: 12,
    },
    preferenceLabel: {
      marginBottom: 10,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "600",
    },
    choiceGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    choiceChip: {
      minHeight: 40,
      maxWidth: "100%",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderRadius: tokens.radii.full,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    choiceIcon: {
      fontSize: 16,
    },
    choiceLabel: {
      flexShrink: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
    selectedMark: {
      width: 17,
      height: 17,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedMarkText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusDot: {
      width: 14,
      height: 14,
      marginRight: 12,
      borderRadius: 7,
    },
    statusText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "600",
    },
    rowDescription: {
      fontSize: 13,
      lineHeight: 19,
    },
    linkRow: {
      minHeight: 48,
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    linkLabel: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
    },
    chevron: {
      fontSize: 28,
      lineHeight: 28,
    },
    dangerDescription: {
      fontSize: 13,
      lineHeight: 20,
    },
    deleteButton: {
      minHeight: 50,
      marginTop: 16,
      paddingHorizontal: 16,
      borderRadius: tokens.radii.full,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    deleteButtonText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    deleteIcon: {
      fontSize: 20,
      lineHeight: 22,
      fontWeight: "700",
    },
    aboutRow: {
      gap: 4,
    },
  });
