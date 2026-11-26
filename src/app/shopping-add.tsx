import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { CheckRow } from "@/components/CheckRow";
import { Screen, SearchField, Section, Stepper, Txt, ui } from "@/components/PantryUI";
import { COLORS as C } from "@/constants/pantry";
import { recentEvents, type HistoryEvent } from "@/services/historyStore";
import { useProducts } from "@/services/productStore";
import { useAjustes } from "@/services/settingsStore";
import { addShopping } from "@/services/shoppingStore";
import { daysUntil } from "@/utils/expiration";
import { guessCategory } from "@/utils/receipt";
import { normalizeKey } from "@/utils/shareText";

type Suggestion = { key: string; name: string; category: string; quantity: number; subtitle: string };

export default function ShoppingAddScreen() {
  const router = useRouter();
  const products = useProducts();
  const { diasAnticipacion } = useAjustes();
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<HistoryEvent[]>([]);

  // Lo que se consumió o se botó en los últimos 30 días (historial).
  useFocusEffect(
    useCallback(() => {
      recentEvents(30).then(setRecent).catch(() => setRecent([]));
    }, []),
  );

  const q = normalizeKey(query);
  const matches = (n: string) => !q || normalizeKey(n).includes(q);
  // 1) Por vencer o vencidos (según los días de anticipación del perfil)
  const soon: Suggestion[] = products
    .filter((p) => daysUntil(p.expiresOn) <= diasAnticipacion && matches(p.name))
    .sort((a, b) => +a.expiresOn - +b.expiresOn)
    .map((p) => {
      const d = daysUntil(p.expiresOn);
      return {
        key: "p:" + p.id,
        name: p.name,
        category: p.category,
        quantity: Math.max(1, Math.round(p.quantity ?? 1)),
        subtitle: d < 0 ? "Vencido · reponlo" : d === 0 ? "Vence hoy" : `Vence en ${d} días`,
      };
    });
  // 2) Terminados recientemente (sin repetir nombres ni lo que ya sigue en la despensa)
  const inPantry = new Set(products.map((p) => normalizeKey(p.name)));
  const seen = new Set<string>();
  const finished: Suggestion[] = recent
    .filter((e) => {
      const k = normalizeKey(e.nombre);
      if (seen.has(k) || inPantry.has(k) || !matches(e.nombre)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8)
    .map((e) => ({
      key: "h:" + e.id,
      name: e.nombre,
      category: e.categoria,
      quantity: 1,
      subtitle: e.motivo === "consumido" ? "Se terminó hace poco" : "Se venció hace poco",
    }));
  const all = [...soon, ...finished];

  const count = selected.length + (name.trim().length >= 2 ? 1 : 0);
  async function save() {
    if (!count || saving) return;
    setSaving(true);
    setError("");
    try {
      const input = all
        .filter((s) => selected.includes(s.key))
        .map((s) => ({ name: s.name, category: s.category, quantity: s.quantity }));
      if (name.trim().length >= 2)
        input.push({ name: name.trim(), category: guessCategory(name), quantity });
      // Si ya está pendiente en la lista, se suma la cantidad (no se duplica).
      await addShopping(input);
      router.replace("/shopping");
    } catch {
      setError("No se pudo guardar la lista. Intenta nuevamente.");
      setSaving(false);
    }
  }
  const toggle = (key: string) =>
    setSelected((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));

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
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar producto" />
      <Section title="Por vencer o vencidos" action={String(soon.length)} />
      {soon.map((s) => (
        <CheckRow key={s.key} name={s.name} category={s.category} quantity={s.quantity} subtitle={s.subtitle} checked={selected.includes(s.key)} onPress={() => toggle(s.key)} />
      ))}
      {!soon.length && <Txt style={ui.muted}>Nada por vencer en los próximos {diasAnticipacion} días.</Txt>}
      <Section title="Terminados recientemente" action={String(finished.length)} />
      {finished.map((s) => (
        <CheckRow key={s.key} name={s.name} category={s.category} quantity={s.quantity} subtitle={s.subtitle} checked={selected.includes(s.key)} onPress={() => toggle(s.key)} />
      ))}
      {!finished.length && (
        <Txt style={ui.muted}>
          Aquí aparecen los productos que marques como consumidos o vencidos al quitarlos de tu despensa.
        </Txt>
      )}
      <View style={[ui.card, { backgroundColor: C.surfaceSoft }]}>
        <Txt style={{ fontWeight: "600" }}>¿No lo encuentras? Agrégalo manualmente</Txt>
        <TextInput
          accessibilityLabel="Nombre del producto"
          value={name}
          onChangeText={setName}
          placeholder="Nombre del producto"
          placeholderTextColor={C.muted}
          style={ui.input}
        />
        {name.trim().length >= 2 && <Txt style={ui.muted}>Categoría: {guessCategory(name)}</Txt>}
        <View style={ui.between}>
          <Txt>Cantidad</Txt>
          <Stepper value={quantity} onChange={setQuantity} />
        </View>
      </View>
      {!!error && <Txt style={{ color: C.danger }}>{error}</Txt>}
    </Screen>
  );
}
