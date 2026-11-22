import { Pressable, View } from "react-native";
import { COLORS as C, emojiForProduct } from "@/constants/pantry";
import type { Product } from "@/services/productStore";
import { daysUntil, getStatus } from "@/utils/expiration";
import { Tag, Txt, ui } from "./PantryUI";

/** Fila de producto: imagen, nombre, categoría · ubicación y etiqueta de estado. */
export function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const days = daysUntil(product.expiresOn);
  const label =
    days < 0 ? "Vencido" : days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${label}`}
      onPress={onPress}
      style={[ui.card, ui.row, { padding: 10, minHeight: 70 }]}
    >
      <View style={[ui.image, { width: 48, height: 48, borderRadius: 10 }]}>
        <Txt style={{ fontSize: 26 }}>{emojiForProduct(product.name, product.category)}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt numberOfLines={1} style={{ fontWeight: "600", fontSize: 15 }}>
          {product.name}
        </Txt>
        <Txt numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>
          {product.category} · {product.location ?? "Alacena"} · x{product.quantity ?? 1}
        </Txt>
        {product.estimated && (
          <Txt style={{ color: C.primaryDark, fontSize: 10 }}>Fecha estimada</Txt>
        )}
      </View>
      <Tag label={label} tone={getStatus(product.expiresOn)} />
    </Pressable>
  );
}
