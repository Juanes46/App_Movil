import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { COLORS as C } from "@/constants/pantry";
import { Logo } from "./Logo";
import { Txt } from "./PantryUI";

/**
 * Splash del Figma (logo + "Despensa Viva" + lema). Aparece justo cuando se
 * oculta el splash nativo (mismo fondo y logo, sin salto) y se desvanece.
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
    <Animated.View pointerEvents="none" style={[styles.box, { opacity }]}>
      <Logo height={132} />
      <Txt style={styles.name}>Despensa Viva</Txt>
      <Txt style={styles.motto}>Que nada se te venza.</Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  name: { fontFamily: "Jakarta", fontWeight: "700", fontSize: 34, color: C.text },
  motto: { fontFamily: "Jakarta", fontWeight: "600", fontSize: 18, color: C.primaryDark },
});
