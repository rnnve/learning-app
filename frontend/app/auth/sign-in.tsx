import { useAuth } from "@/auth/AuthProvider";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React, { useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { ErrorState } from "@/components/ui/ErrorState";
import { haptics } from "@/lib/haptics";
import { router } from "expo-router";

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingVertical: 40,
      justifyContent: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
    },
    form: {
      width: "100%",
      gap: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: tokens.radii.xl,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    textInputError: {
      borderColor: theme.colors.error,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 4,
      marginLeft: 4,
    },
    submitButton: {
      marginTop: 8,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.outlineVariant,
    },
    dividerText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      fontWeight: "500",
    },
    switchButton: {
      marginTop: 24,
      paddingVertical: 12,
    },
    switchText: {
      fontSize: 15,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
    },
    switchLink: {
      color: theme.colors.primary,
      fontWeight: "700",
    },
    footer: {
      marginTop: 32,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
      alignItems: "center",
    },
    footerText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
  });

export default function SignInScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateForm = () => {
    let valid = true;
    if (!email.trim()) {
      setEmailError(i18n.t("errors.VALIDATION_ERROR"));
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(i18n.t("errors.VALIDATION_ERROR"));
      valid = false;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError(i18n.t("auth.passwordLabel"));
      valid = false;
    } else if (password.length < 8) {
      setPasswordError(i18n.t("auth.passwordLabel"));
      valid = false;
    } else {
      setPasswordError("");
    }
    return valid;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      await signIn({ email: email.trim(), password });
      haptics.success();
      router.replace("/");
    } catch (err: any) {
      setError(err);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        { backgroundColor: theme.colors.background },
        [styles.container, { backgroundColor: theme.colors.background }],
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.title, { color: theme.colors.onSurface }],
            ]}
          >
            {i18n.t("auth.signInTitle")}
          </Text>
          <Text
            style={[
              { color: theme.colors.onSurface },
              [styles.subtitle, { color: theme.colors.onSurfaceVariant }],
            ]}
          >
            {i18n.t("auth.signInSubtitle")}
          </Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.inputLabel, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("auth.emailLabel")}
            </Text>
            <TextInput
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                    color: theme.colors.onSurface,
                  },
                  emailError && styles.textInputError,
                ],
              ]}
              placeholder={i18n.t("auth.emailLabel")}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!loading}
              accessibilityLabel={i18n.t("auth.emailLabel")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
            {emailError && (
              <Text style={[{ color: theme.colors.onSurface }, styles.errorText]}>
                {emailError}
              </Text>
            )}
          </View>

          <View>
            <Text
              style={[
                { color: theme.colors.onSurface },
                [styles.inputLabel, { color: theme.colors.onSurface }],
              ]}
            >
              {i18n.t("auth.passwordLabel")}
            </Text>
            <TextInput
              style={[
                { color: theme.colors.onSurface },
                [
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                    color: theme.colors.onSurface,
                  },
                  passwordError && styles.textInputError,
                ],
              ]}
              placeholder={i18n.t("auth.passwordLabel")}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError("");
              }}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              editable={!loading}
              accessibilityLabel={i18n.t("auth.passwordLabel")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
            {passwordError && (
              <Text style={[{ color: theme.colors.onSurface }, styles.errorText]}>
                {passwordError}
              </Text>
            )}
          </View>

          {error ? <ErrorState error={error} style={{ marginTop: 8 }} /> : null}

          <PrimaryButton
            label={i18n.t("auth.signInButton")}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
            accessibilityLabel={i18n.t("auth.signInButton")}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={[{ color: theme.colors.onSurface }, styles.dividerText]}>
            {i18n.t("common.or").toUpperCase()}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <SecondaryButton
          label={i18n.t("auth.upgradeTitle")}
          onPress={() => router.push("/auth/register")}
          style={styles.switchButton}
          accessibilityLabel={i18n.t("auth.upgradeTitle")}
        />

        <View style={styles.footer}>
          <Text style={[{ color: theme.colors.onSurface }, styles.footerText]}>
            {i18n.t("auth.switchToRegister")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
