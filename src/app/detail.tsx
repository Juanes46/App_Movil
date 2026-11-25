import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/Button";
import { InfoRow, Note, Screen, Txt, ui } from "@/components/PantryUI";
import { COLORS as C, emojiForProduct } from "@/constants/pantry";
import {
  removeProduct,
  useProducts,
  useStoreStatus,
} from "@/services/productStore";
import { daysUntil, formatDate, statusText } from "@/utils/expiration";
import { formatQuantity } from "@/utils/quantity";
export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useProducts().find((p) => p.id === id);
  const { ready } = useStoreStatus();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!p || busy) return;
    setBusy(true);
    try {
      await removeProduct(p.id);
      router.replace("/pantry");
    } catch {
      setError("No se pudo eliminar el producto.");
      setBusy(false);
    }
  }
  if (!p)
    return (
      <Screen title="Detalle del producto">
        {ready ? (
          <Txt>Este producto ya no está en tu despensa.</Txt>
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );
  return (
    <Screen
      title="Detalle del producto"
      footer={
        confirm ? (
          <>
            <Txt>¿Eliminar {p.name} de tu despensa?</Txt>
            <Button
              title={busy ? "Eliminando…" : "Confirmar eliminación"}
              variant="danger"
              disabled={busy}
              onPress={remove}
            />
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => setConfirm(false)}
            />
          </>
        ) : (
          <View style={ui.row}>
            <Button
              title="Editar"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({ pathname: "/product", params: { id: p.id } })
              }
            />
            <Button
              title="Eliminar"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setConfirm(true)}
            />
          </View>
        )
      }
    >
      <View style={ui.image}>
        <Txt style={{ fontSize: 72 }}>{emojiForProduct(p.name, p.category)}</Txt>
      </View>
      <Txt style={ui.title}>{p.name}</Txt>
      <Txt style={{ color: daysUntil(p.expiresOn) < 0 ? C.danger : C.ok }}>
        {statusText(daysUntil(p.expiresOn))}
      </Txt>
      <View>
        <InfoRow label="Cantidad" value={formatQuantity(p.quantity, p.unit)} />
        <InfoRow label="Categoría" value={p.category} />
        <InfoRow label="Ubicación" value={p.location ?? "Alacena"} />
        <InfoRow label="Fecha de vencimiento" value={formatDate(p.expiresOn)} />
      </View>
      {p.estimated && (
        <Note>
          Fecha estimada por categoría. Verifica la fecha del envase o escanéala
          para corregirla.
        </Note>
      )}
      {!!error && <Txt style={{ color: C.danger }}>{error}</Txt>}
    </Screen>
  );
}
