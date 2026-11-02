import { createQueryClient, setupFocusManager } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import i18n from "@/i18n";
import { setupNetworkManager } from "@/lib/network";
import { darkPaperTheme, lightPaperTheme } from "@/theme/paperTheme";
import {
  NotoSansThai_400Regular,
  NotoSansThai_500Medium,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
  useFonts,
} from "@expo-google-fonts/noto-sans-thai";
import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Appearance,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  splashText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "500",
    color: "#5B5BD6",
  },
});

export default function RootLayout() {
  // One client for the whole app; created lazily so it is not shared between
  // fast refreshes.
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    setupNetworkManager();
    return setupFocusManager();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansThai_400Regular,
    NotoSansThai_500Medium,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold,
  });
  const { isLoading: authLoading, user } = useAuth();
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());
  const preference = user?.preferences?.theme ?? "system";
  const colorScheme = preference === "system" ? systemScheme : preference;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setIsReady(true);
    }
  }, [fontsLoaded, fontError]);

  const theme = colorScheme === "dark" ? darkPaperTheme : lightPaperTheme;
  useEffect(() => {
    Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
    setSystemScheme(Appearance.getColorScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme }) =>
      setSystemScheme(colorScheme),
    );
    return () => subscription.remove();
  }, [preference]);

  if (!isReady || authLoading) {
    return (
      <PaperProvider theme={theme}>
        <SafeAreaProvider>
          <View
            style={[styles.splash, { backgroundColor: theme.colors.background }]}
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.splashText, { color: theme.colors.primary }]}>กำลังโหลด...</Text>
          </View>
        </SafeAreaProvider>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <StatusBar barStyle={colorScheme === "dark" ? "light-content" : "dark-content"} />
        <ThemeProvider
          value={{
            ...(theme.dark ? DarkTheme : DefaultTheme),
            colors: {
              ...(theme.dark ? DarkTheme : DefaultTheme).colors,
              background: theme.colors.background,
              card: theme.colors.surface,
              text: theme.colors.onSurface,
              border: theme.colors.outlineVariant,
              primary: theme.colors.primary,
            },
          }}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="(onboarding)/welcome" />
            <Stack.Screen name="(onboarding)/language" />
            <Stack.Screen name="(onboarding)/consent" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="capture" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="capture-review" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="import" options={{ presentation: "formSheet" }} />
            <Stack.Screen name="source/[id]" />
            <Stack.Screen name="source/[id]/text" />
            <Stack.Screen name="source/[id]/generate" options={{ presentation: "formSheet" }} />
            <Stack.Screen name="material/[id]" />
            <Stack.Screen name="study/flashcards/[materialId]" />
            <Stack.Screen name="study/quiz/[materialId]" />
            <Stack.Screen name="study/result/[sessionId]" />
            <Stack.Screen name="chat/[conversationId]" />
            <Stack.Screen name="history" />
            <Stack.Screen name="auth/sign-in" options={{ animation: "fade" }} />
            <Stack.Screen name="auth/register" options={{ animation: "fade" }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
