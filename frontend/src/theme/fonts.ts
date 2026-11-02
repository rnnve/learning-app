import {
  NotoSansThai_400Regular,
  NotoSansThai_500Medium,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
  useFonts,
} from "@expo-google-fonts/noto-sans-thai";

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansThai_400Regular,
    NotoSansThai_500Medium,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold,
  });

  return { fontsLoaded, fontError };
}

export const typography = {
  regular: "NotoSansThai_400Regular",
  medium: "NotoSansThai_500Medium",
  semiBold: "NotoSansThai_600SemiBold",
  bold: "NotoSansThai_700Bold",
};
