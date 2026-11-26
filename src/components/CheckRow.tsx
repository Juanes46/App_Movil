import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { COLORS as C, emojiForProduct } from "@/constants/pantry";
import { Txt, ui } from "./PantryUI";

/**
 * Fila con casilla. Por defecto toda la fila marca/desmarca (onPress).
 * Si se pasa `onCheckPress`, la casilla marca y el resto de la fila hace
 * `onPress` (p. ej. abrir opciones en la lista de compras).
 */
export function CheckRow({
  name,
  category,
  subtitle,
  quantity = 1,
  quantityLabel,
  checked,
  onPress,
  onCheckPress,
}: {
  name: string;
  category: string;
  subtitle?: string;
  quantity?: number;
  /** Texto de la cantidad con unidad ("×3 un", "0,45 kg"); por defecto "x{quantity}". */
  quantityLabel?: string;
  checked: boolean;
  onPress: () => void;
  onCheckPress?: () => void;
}) {
  // Animación corta del check al marcar.
  const scale = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: checked ? 1 : 0, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  }, [checked, scale]);

  const box = (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: C.primary,
        backgroundColor: checked ? C.primary : C.white,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Txt style={{ color: C.white }}>✓</Txt>
      </Animated.View>
    </View>
  );

  return (
    <Pressable
      accessibilityRole={onCheckPress ? "button" : "checkbox"}
      accessibilityState={onCheckPress ? undefined : { checked }}
      accessibilityLabel={onCheckPress ? `${name}, opciones` : name}
      onPress={onPress}
      style={[
        ui.row,
        {
          padding: 10,
          minHeight: 62,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 14,
          backgroundColor: C.white,
        },
      ]}
    >
      {onCheckPress ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={checked ? `Desmarcar ${name}` : `Marcar ${name} como comprado`}
          hitSlop={12}
          onPress={onCheckPress}
        >
          {box}
        </Pressable>
      ) : (
        box
      )}
      <View style={[ui.image, { width: 40, height: 40, borderRadius: 10 }]}>
        <Txt style={{ fontSize: 24 }}>{emojiForProduct(name, category)}</Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt
          numberOfLines={2}
          style={{
            fontWeight: "600",
            fontSize: 14,
            ...(checked && onCheckPress ? { color: C.muted, textDecorationLine: "line-through" as const } : {}),
          }}
        >
          {name}
        </Txt>
        {subtitle && <Txt style={{ fontSize: 12, color: C.muted }}>{subtitle}</Txt>}
      </View>
      <Txt style={{ fontWeight: "600" }}>{quantityLabel ?? `x${quantity}`}</Txt>
    </Pressable>
  );
}
