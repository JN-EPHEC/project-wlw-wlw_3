import { Stack } from "expo-router";
import "react-native-reanimated";

export default function RootLayout() {
  return (
    <Stack initialRouteName="auth/LoginScreen">
      {/* ton dossier d’onglets existant */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Auth */}
      <Stack.Screen
        name="auth/LoginScreen"
        options={{ title: "Se connecter" }}
      />
      <Stack.Screen
        name="auth/RegisterScreen"
        options={{ title: "Créer un compte" }}
      />
    </Stack>
  );
}
