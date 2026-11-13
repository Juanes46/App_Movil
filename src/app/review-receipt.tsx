import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { CheckRow } from "@/components/CheckRow";
import { ExpirationInput } from "@/components/ExpirationInput";
import {
  Icon,
  Note,
  Screen,
  Section,
  Stepper,
  Txt,
  ui,
} from "@/components/PantryUI";
import { addProducts } from "@/services/productStore";
import { addDays, formatDate, parseDate } from "@/utils/expiration";
import { COLORS as C } from "@/constants/pantry";
const samples = [
  {
    name: "Leche entera 1 L",
    category: "Lácteos",
    location: "Nevera",
    quantity: 2,
    days: 7,
  },
  {
    name: "Huevos AA x12",
    category: "Lácteos",
    location: "Nevera",
    quantity: 1,
    days: 21,
  },
  {
    name: "Arroz blanco 1 kg",
    category: "Granos",
    location: "Alacena",
    quantity: 1,
    days: 365,
  },
  {
    name: "Atún en agua",
    category: "Enlatados",
    location: "Alacena",
    quantity: 3,
    days: 730,
  },
  {
    name: "Tomate chonto",
    category: "Frutas y verduras",
    location: "Nevera",
    quantity: 1,
    days: 5,
  },
  { name: "", category: "Otros", location: "Alacena", quantity: 1, days: 30 },
];
export default function ReviewReceiptScreen() {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    samples.map((p, i) => ({
      ...p,
      selected: i < 5,
      date: formatDate(addDays(new Date(), p.days)),
      estimated: true,
    })),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = rows.filter((p) => p.selected);
  function update(i: number, values: Partial<(typeof rows)[number]>) {
    setRows((v) => v.map((p, j) => (i === j ? { ...p, ...values } : p)));
  }
  async function save() {
    if (!selected.length || saving) return;
    if (selected.some((p) => p.name.trim().length < 2 || !parseDate(p.date))) {
      setError("Revisa el nombre y la fecha de cada producto seleccionado.");
      setEditing(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addProducts(
        selected.map((p) => ({
          name: p.name.trim(),
          category: p.category,
          location: p.location,
          quantity: p.quantity,
          expiresOn: parseDate(p.date)!,
          estimated: p.estimated,
        })),
      );
      router.replace("/pantry");
    } catch {
      setError("No se pudo guardar la factura. Intenta nuevamente.");
      setSaving(false);
    }
  }
  return (
    <Screen
      title="Revisar factura"
      footer={
        <>
          <Button
            title={
              saving ? "Guardando…" : `Agregar ${selected.length} a la despensa`
            }
            disabled={!selected.length || saving}
            onPress={save}
          />
          <Button
            title={
              editing ? "Terminar revisión" : "Editar fechas de vencimiento"
            }
            variant="secondary"
            onPress={() => setEditing(!editing)}
          />
        </>
      }
    >
      <View style={[ui.card, ui.row]}>
        <View
          style={{
            padding: 10,
            borderRadius: 10,
            backgroundColor: C.primarySoft,
          }}
        >
          <Icon name="receiptReview" size={24} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: "600", fontSize: 17 }}>
            Éxito · Calle 80
          </Txt>
          <Txt style={ui.muted}>Factura de ejemplo · 6 productos</Txt>
        </View>
      </View>
      <Note>
        La factura no trae fecha de vencimiento. Usamos una fecha estimada por
        categoría; corrígela o escanéala después. Revisa también los nombres
        abreviados.
      </Note>
      <Section
        title="Productos detectados"
        action={selected.length ? "Quitar todos" : "Elegir todos"}
        onPress={() =>
          setRows((v) =>
            v.map((p) => ({ ...p, selected: !selected.length && !!p.name })),
          )
        }
      />
      {rows.map((p, i) => (
        <View key={i} style={{ gap: 8 }}>
          <CheckRow
            {...p}
            name={p.name || 'No reconocido: "DETERG LIQ"'}
            checked={p.selected}
            subtitle={
              p.name
                ? `${p.category} · ${p.location} · ${p.estimated ? "Fecha estimada" : "Fecha corregida"}`
                : "Corrige el nombre antes de agregar"
            }
            onPress={() => {
              update(i, { selected: !p.selected });
              if (!p.name) setEditing(true);
            }}
          />
          {editing && (
            <View style={ui.card}>
              <TextInput
                accessibilityLabel={`Nombre del producto ${i + 1}`}
                value={p.name}
                onChangeText={(name) => update(i, { name })}
                placeholder="Corregir nombre"
                style={ui.input}
              />
              <ExpirationInput
                value={p.date}
                onChangeText={(date) => update(i, { date, estimated: false })}
              />
              <Stepper
                value={p.quantity}
                onChange={(quantity) => update(i, { quantity })}
              />
            </View>
          )}
        </View>
      ))}
      {!!error && (
        <Txt accessibilityRole="alert" style={{ color: C.danger }}>
          {error}
        </Txt>
      )}
    </Screen>
  );
}
