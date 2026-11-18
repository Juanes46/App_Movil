import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { CheckRow } from "@/components/CheckRow";
import {
  Screen,
  SearchField,
  Section,
  Stepper,
  Txt,
  ui,
} from "@/components/PantryUI";
import { addShopping } from "@/services/shoppingStore";
import { useProducts } from "@/services/productStore";
import { daysUntil } from "@/utils/expiration";
import { COLORS as C } from "@/constants/pantry";
export default function ShoppingAddScreen() {
  const router = useRouter();
  const products = useProducts();
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const suggested = products
    .filter((p) => daysUntil(p.expiresOn) <= 7)
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const count = selected.length + (name.trim().length >= 2 ? 1 : 0);
  async function save() {
    if (!count || saving) return;
    setSaving(true);
    setError("");
    try {
      const input = products
        .filter((p) => selected.includes(p.id))
        .map((p) => ({
          name: p.name,
          category: p.category,
          quantity: p.quantity ?? 1,
        }));
      if (name.trim().length >= 2)
        input.push({ name: name.trim(), category: "Otros", quantity });
      await addShopping(input);
      router.replace("/shopping");
    } catch {
      setError("No se pudo guardar la lista. Intenta nuevamente.");
      setSaving(false);
    }
  }
  return (
    <Screen
      title="Agregar a compras"
      footer={
        <Button
          title={saving ? "Agregando…" : `Agregar ${count} a la lista`}
          disabled={!count || saving}
          onPress={save}
        />
      }
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar producto"
      />
      <Section title="Sugeridos" action="Por vencer" />
      {suggested.map((p) => (
        <CheckRow
          key={p.id}
          {...p}
          checked={selected.includes(p.id)}
          subtitle="Revisa si necesitas reponerlo"
          onPress={() =>
            setSelected((v) =>
              v.includes(p.id) ? v.filter((id) => id !== p.id) : [...v, p.id],
            )
          }
        />
      ))}
      {!suggested.length && (
        <Txt style={ui.muted}>No hay sugerencias para esta búsqueda.</Txt>
      )}
      <View style={[ui.card, { backgroundColor: C.surfaceSoft }]}>
        <Txt style={{ fontWeight: "600" }}>
          ¿No lo encuentras? Agrégalo manualmente
        </Txt>
        <TextInput
          accessibilityLabel="Nombre del producto"
          value={name}
          onChangeText={setName}
          placeholder="Nombre del producto"
          style={ui.input}
        />
        <View style={ui.between}>
          <Txt>Cantidad</Txt>
          <Stepper value={quantity} onChange={setQuantity} />
        </View>
      </View>
      {!!error && <Txt style={{ color: C.danger }}>{error}</Txt>}
    </Screen>
  );
}
