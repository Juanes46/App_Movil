import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { ActivityIndicator, View } from "react-native";
import { COLORS } from "@/constants/pantry";
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter: require("../../assets/fonts/Inter.ttf"),
    Jakarta: require("../../assets/fonts/PlusJakartaSans.ttf"),
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      />
    </>
  );
}
