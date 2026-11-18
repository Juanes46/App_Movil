import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import type { TextStyle } from "react-native";

/** Fuentes que se cargan al iniciar (ver app/_layout.tsx). */
export const FONT_FILES = {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
};

/** Plus Jakarta Sans para títulos y cifras; Inter para el resto. */
export const FONTS = {
  body: "Inter_400Regular",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  titleSemi: "PlusJakartaSans_600SemiBold",
  title: "PlusJakartaSans_700Bold",
} as const;

/**
 * Con fuentes estáticas, Android no elige el grosor por `fontWeight`: hay que
 * usar la familia de ese grosor. Esto convierte { fontFamily: "Jakarta",
 * fontWeight: "700" } en { fontFamily: "PlusJakartaSans_700Bold" }.
 */
export function resolveFont(style: TextStyle): TextStyle {
  const heavy = Number(style.fontWeight === "bold" ? 700 : style.fontWeight ?? 400);
  const isTitle = style.fontFamily === "Jakarta" || style.fontFamily?.startsWith("PlusJakarta");
  const fontFamily = isTitle
    ? heavy >= 700
      ? FONTS.title
      : FONTS.titleSemi
    : heavy >= 700
      ? FONTS.bodyBold
      : heavy >= 600
        ? FONTS.bodySemi
        : FONTS.body;
  return { ...style, fontFamily, fontWeight: undefined };
}
