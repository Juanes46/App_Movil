import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal } from "react-native";
import { COLORS as C } from "@/constants/pantry";
import { Txt } from "./PantryUI";
import { splash, SplashBrand } from "./SplashOverlay";

const SHOW_AFTER_MS = 300; // si termina antes, no se muestra (evita parpadeos)
const MIN_VISIBLE_MS = 600; // si se mostró, se queda al menos esto
const FADE_MS = 200;

/**
 * Pantalla de carga con el diseño del splash: logo, "Despensa Viva", un
 * spinner y el texto del proceso. Bloquea los toques mientras está visible.
 *
 *   <LoadingSplash visible={busy} message="Leyendo la factura…" onTimeout={() => setError(...)} />
 *   // busy 120 ms  -> no se ve nada
 *   // busy 2 s     -> aparece a los 300 ms con fundido y se va al terminar
 *   // busy > 30 s  -> se cierra y llama a onTimeout para mostrar el error
 */
export function LoadingSplash({
  visible,
  message,
  timeoutMs = 30_000,
  onTimeout,
}: {
  visible: boolean;
  message: string;
  timeoutMs?: number;
  onTimeout?: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const shownAt = useRef(0);
  const timeoutCb = useRef(onTimeout);
  timeoutCb.current = onTimeout;

  // Cada proceso nuevo puede volver a mostrar la pantalla.
  useEffect(() => {
    if (visible) setTimedOut(false);
  }, [visible]);

  const active = visible && !timedOut;

  // Mostrar (después de 300 ms) y tiempo máximo: solo dependen de `active`.
  useEffect(() => {
    if (!active) return;
    const show = setTimeout(() => {
      shownAt.current = Date.now();
      setShown(true);
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    }, SHOW_AFTER_MS);
    const limit = setTimeout(() => {
      setTimedOut(true);
      timeoutCb.current?.();
    }, timeoutMs);
    return () => {
      clearTimeout(show);
      clearTimeout(limit);
    };
  }, [active, opacity, timeoutMs]);

  // Ocultar: cuando termina, tras el mínimo visible, con fundido.
  useEffect(() => {
    if (active || !shown) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const hide = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() =>
        setShown(false),
      );
    }, wait);
    return () => clearTimeout(hide);
  }, [active, shown, opacity, timeoutMs]);

  if (!shown) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <Animated.View
        style={[splash.fill, { opacity }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
      >
        <SplashBrand>
          <ActivityIndicator size="large" color={C.primary} />
          <Txt style={[splash.motto, { color: C.muted, fontSize: 16 }]}>{message}</Txt>
        </SplashBrand>
      </Animated.View>
    </Modal>
  );
}
