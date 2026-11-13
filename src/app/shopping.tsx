import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/Button";
import { CheckRow } from "@/components/CheckRow";
import { Avatar, Chip, Screen, Section, Txt, ui } from "@/components/PantryUI";
import { COLORS as C } from "@/constants/pantry";
import {
  retryShopping,
  toggleShopping,
  useShopping,
  useShoppingError,
  useShoppingReady,
} from "@/services/shoppingStore";
import { useState } from "react";
export default function ShoppingScreen() {
  const router = useRouter();
  const items = useShopping();
  const error = useShoppingError();
  const ready = useShoppingReady();
  const [actionError, setActionError] = useState("");
  const done = items.filter((p) => p.done);
  const pending = items.filter((p) => !p.done);
  const categories = [...new Set(pending.map((p) => p.category))];
  return (
    <Screen active="Compras">
      <View style={ui.row}>
        <Txt style={[ui.title, { flex: 1 }]}>Lista de compras</Txt>
        <Chip label="+" onPress={() => router.push("/shopping-add")} />
        <Avatar />
      </View>
      <View style={ui.between}>
        <Txt style={ui.muted}>
          {done.length} de {items.length} comprados
        </Txt>
        <Txt style={ui.muted}>{pending.length} pendientes</Txt>
      </View>
      <View
        style={{
          height: 8,
          backgroundColor: C.border,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 8,
            width: `${items.length ? (done.length / items.length) * 100 : 0}%`,
            backgroundColor: C.primary,
          }}
        />
      </View>
      {!ready && !error && <ActivityIndicator />}
      {error && (
        <>
          <Txt>No se pudo cargar la lista de compras.</Txt>
          <Button title="Reintentar" onPress={retryShopping} />
        </>
      )}
      {!!actionError && <Txt style={{ color: C.danger }}>{actionError}</Txt>}
      {[...categories, ...(done.length ? ["Comprados"] : [])].map(
        (category) => {
          const group =
            category === "Comprados"
              ? done
              : pending.filter((p) => p.category === category);
          return (
            <View key={category} style={{ gap: 12 }}>
              <Section title={category} action={String(group.length)} />
              {group.map((p) => (
                <CheckRow
                  key={p.id}
                  {...p}
                  checked={p.done}
                  subtitle={p.category}
                  onPress={() => {
                    setActionError("");
                    toggleShopping(p).catch(() =>
                      setActionError(
                        "No se pudo actualizar el producto. Intenta nuevamente.",
                      ),
                    );
                  }}
                />
              ))}
            </View>
          );
        },
      )}
      {ready && !items.length && (
        <>
          <Txt style={ui.muted}>
            Tu lista está vacía. Agrega lo que necesitas para tu próxima compra.
          </Txt>
          <Button
            title="Agregar a compras"
            onPress={() => router.push("/shopping-add")}
          />
        </>
      )}
    </Screen>
  );
}
