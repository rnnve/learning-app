import { useAuth } from "@/auth/AuthProvider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isGuest, isLoading, hasConsent } = useAuth();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || isGuest) {
        router.replace("/auth/sign-in");
      } else if (!hasConsent) {
        router.replace("/(onboarding)/consent");
      } else {
        router.replace("/(tabs)/home");
      }
    }
  }, [isLoading, isAuthenticated, isGuest, hasConsent, router]);

  return null;
}
