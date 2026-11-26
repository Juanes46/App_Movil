import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SplashOverlay } from "@/components/SplashOverlay";
import { COLORS } from "@/constants/pantry";
import { startNotificationSync } from "@/services/notifications";
import { getDb } from "@/services/productStore";
import { loadAjustes } from "@/services/settingsStore";
import { FONT_FILES } from "@/theme/fonts";

// El splash nativo queda visible hasta que carguen las fuentes y se abra SQLite.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 300 });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [dbDone, setDbDone] = useState(false);
  const [overlay, setOverlay] = useState(true);

  useEffect(() => {
    // Si SQLite falla, igual se entra: cada pantalla muestra su error con "Reintentar".
    // Los ajustes (p. ej. días de anticipación) se cargan antes de mostrar la app.
    getDb()
      .then(() => loadAjustes())
      .catch(() => {})
      .finally(() => {
        setDbDone(true);
        startNotificationSync();
      });
  }, []);

  const ready = (fontsLoaded || !!fontError) && dbDone;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  const hideOverlay = useCallback(() => setOverlay(false), []);

  if (!ready) return null; // sigue el splash nativo

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      />
      {overlay && <SplashOverlay onDone={hideOverlay} />}
    </GestureHandlerRootView>
  );
}
