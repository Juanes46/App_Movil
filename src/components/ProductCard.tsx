import { Pressable, StyleSheet, View } from "react-native";
import { COLORS as C, emojiFor } from "@/constants/pantry";
import type { Product } from "@/services/productStore";
import { daysUntil, getStatus } from "@/utils/expiration";
import { Txt, ui } from "./PantryUI";

export function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const days = daysUntil(product.expiresOn);
  const status = getStatus(product.expiresOn);
  const label =
    days < 0
      ? "Vencido"
      : days === 0
        ? "Hoy"
        : days === 1
          ? "Mañana"
          : `En ${days} días`;
  const bg =
    status === "vencido"
      ? C.danger
      : status === "proximo"
        ? "#E59A1F"
        : C.okSoft;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.image}>
        <Txt style={{ fontSize: 26 }}>{emojiFor(product.category)}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt numberOfLines={1} style={{ fontWeight: "600", fontSize: 15 }}>
          {product.name}
        </Txt>
        <Txt numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>
          {product.category} · {product.location ?? "Alacena"} · x
          {product.quantity ?? 1}
        </Txt>
        {product.estimated && (
          <Txt style={{ color: C.primaryDark, fontSize: 10 }}>
            Fecha estimada
          </Txt>
        )}
      </View>
      <View style={[styles.tag, { backgroundColor: bg }]}>
        <Txt
          style={{
            fontSize: 11,
            fontWeight: "600",
            color:
              status === "vencido"
                ? "white"
                : status === "vigente"
                  ? C.ok
                  : C.text,
          }}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    ...ui.row,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "white",
    borderRadius: 14,
    padding: 10,
    minHeight: 70,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#E8EFE3",
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 100,
  },
});
