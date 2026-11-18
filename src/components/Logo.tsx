import { Image } from "expo-image";

/**
 * Logo de Despensa Viva (versión positiva, para fondos claros).
 * Para cambiarlo, reemplaza SOLO assets/logo.png (proporción 114.4 × 120):
 * lo usan esta pieza y el splash nativo (app.json).
 */
const LOGO = require("../../assets/logo.png");
const RATIO = 114.4 / 120;

export function Logo({ height = 32 }: { height?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ height, width: height * RATIO }}
      contentFit="contain"
      accessibilityLabel="Despensa Viva"
    />
  );
}
