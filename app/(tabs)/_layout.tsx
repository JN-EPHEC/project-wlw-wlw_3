import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* Auth */}
      <Stack.Screen name="auth/LoginScreen" options={{ headerShown: false }} />
      <Stack.Screen name="auth/RegisterScreen" options={{ headerShown: false }} />
      <Stack.Screen name="auth/ForgotPassword" options={{ headerShown: false }} />

      {/* Pages principales */}
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="camera-screen" options={{ headerShown: false }} />
      <Stack.Screen name="recipe-result" options={{ headerShown: false }} />
      <Stack.Screen name="planning" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}
