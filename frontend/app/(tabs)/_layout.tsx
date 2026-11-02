import { GlassSurface } from "@/components/ui/GlassSurface";
import i18n from "@/i18n";
import { tokens } from "@/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type React from "react";
import { type ColorValue, Platform, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

function TabIcon({
  focused,
  color,
  activeIcon,
  inactiveIcon,
}: {
  focused: boolean;
  color: ColorValue;
  activeIcon: IconName;
  inactiveIcon: IconName;
}) {
  const theme = useTheme();

  return (
    <View
      style={[styles.iconPill, focused && { backgroundColor: theme.colors.secondaryContainer }]}
    >
      <MaterialCommunityIcons
        name={focused ? activeIcon : inactiveIcon}
        size={22}
        color={focused ? theme.colors.onSecondaryContainer : color}
      />
    </View>
  );
}

export default function TabsLayout() {
  if (Platform.OS === "ios") {
    return <IOSNativeTabs />;
  }

  return <MaterialTabs />;
}

function IOSNativeTabs() {
  const theme = useTheme();

  return (
    <NativeTabs
      tintColor={theme.colors.primary}
      backgroundColor={theme.colors.surface}
      iconColor={{
        default: theme.colors.onSurfaceVariant,
        selected: theme.colors.primary,
      }}
      labelStyle={{
        default: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 10,
          fontWeight: "600",
        },
        selected: {
          color: theme.colors.primary,
          fontSize: 10,
          fontWeight: "600",
        },
      }}
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{i18n.t("navigation.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon
          sf={{ default: "books.vertical", selected: "books.vertical.fill" }}
        />
        <NativeTabs.Trigger.Label>{i18n.t("navigation.library")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
        />
        <NativeTabs.Trigger.Label>{i18n.t("navigation.chat")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
        <NativeTabs.Trigger.Label>{i18n.t("navigation.history")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>{i18n.t("navigation.settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="index" hidden />
    </NativeTabs>
  );
}

function MaterialTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 52 + safeBottom,
            paddingBottom: safeBottom,
            borderColor: theme.colors.outlineVariant,
          },
        ],
        tabBarBackground: () => (
          <GlassSurface
            intensity={Platform.OS === "ios" ? 65 : 0}
            borderRadius={tokens.radii["3xl"]}
            style={styles.tabBackground}
          />
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: i18n.t("navigation.home"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="home-variant"
              inactiveIcon="home-variant-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: i18n.t("navigation.library"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="book-open-page-variant"
              inactiveIcon="book-open-page-variant-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: i18n.t("navigation.chat"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="message-processing"
              inactiveIcon="message-processing-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: i18n.t("navigation.history"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="chart-timeline-variant"
              inactiveIcon="chart-timeline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: i18n.t("navigation.settings"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="cog" inactiveIcon="cog-outline" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 6,
    paddingTop: 4,
    borderTopWidth: 0,
    borderWidth: 1,
    borderRadius: tokens.radii["3xl"],
    backgroundColor: "transparent",
    elevation: 8,
    shadowColor: "#1D1B20",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    overflow: "hidden",
  },
  tabBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  tabItem: {
    paddingHorizontal: 1,
  },
  iconPill: {
    width: 42,
    height: 26,
    borderRadius: tokens.radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600",
  },
});
