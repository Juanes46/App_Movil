import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { COLORS as C } from "@/constants/pantry";
import { Logo } from "./Logo";
import { Txt } from "./PantryUI";

/**
 * Marca del splash del Figma: logo, "Despensa Viva" y, debajo, el lema o lo
 * que se pase como `children` (el spinner de LoadingSplash). La comparten el
 * splash de inicio y la pantalla de carga.
 */
export function SplashBrand({ children }: { children?: ReactNode }) {
  return (
    <View style={splash.content}>
      <Logo height={132} />
      <Txt style={splash.name}>Despensa Viva</Txt>
      {children ?? <Txt style={splash.motto}>Que nada se te venza.</Txt>}
    </View>
  );
}

/**
 * Splash de inicio. Aparece justo cuando se oculta el splash nativo (mismo
 * fondo y logo, sin salto) y se desvanece.
 */
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 450,
      delay: 650,
      useNativeDriver: true,
    }).start(onDone);
  }, [opacity, onDone]);
  return (
    <Animated.View pointerEvents="none" style={[splash.fill, { opacity }]}>
      <SplashBrand />
    </Animated.View>
  );
}

export const splash = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 24 },
  name: { fontFamily: "Jakarta", fontWeight: "700", fontSize: 34, color: C.text },
  motto: { fontFamily: "Jakarta", fontWeight: "600", fontSize: 18, color: C.primaryDark },
});
