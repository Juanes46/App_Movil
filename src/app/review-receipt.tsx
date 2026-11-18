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
import { getPendingReceipt, setPendingReceipt } from "@/utils/receipt";
import { COLORS as C, ESTIMATED_DAYS } from "@/constants/pantry";
import { suggestLocation } from "@/utils/location";
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
  // Factura leída por el OCR; si no hay, se muestra la factura de ejemplo.
  const [scanned] = useState(() => getPendingReceipt());
  const [rows, setRows] = useState(() => {
    const source = scanned
      ? scanned.items.map((it) => ({
          name: it.name,
          category: it.category,
          location: suggestLocation(it.name, it.category),
          quantity: it.quantity,
          days: it.days ?? ESTIMATED_DAYS[it.category] ?? 30,
        }))
      : samples;
    return source.map((p, i) => ({
      ...p,
      selected: scanned ? true : i < 5,
      date: formatDate(addDays(new Date(), p.days)),
      estimated: true,
    }));
  });
  const [editing, setEditing] = useState(false);
  const [showText, setShowText] = useState(false);
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
      setPendingReceipt(null);
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
            {scanned ? (scanned.store ?? "Factura escaneada") : "Éxito · Calle 80"}
          </Txt>
          <Txt style={ui.muted}>
            {scanned
              ? `Leída con la cámara · ${rows.length} productos`
              : `Factura de ejemplo · ${rows.length} productos`}
          </Txt>
        </View>
      </View>
      <Note>
        La factura no trae fecha de vencimiento: calculamos una fecha
        aproximada según el tipo de producto. Corrígela con “Editar fechas” o
        escanéala después en el envase. Revisa también los nombres abreviados.
      </Note>
      {scanned && (
        <View style={{ gap: 8 }}>
          <Txt
            accessibilityRole="button"
            onPress={() => setShowText(!showText)}
            style={ui.link}
          >
            {showText ? "Ocultar texto leído" : "Ver texto leído por la cámara"}
          </Txt>
          {showText && (
            <View style={ui.card}>
              <Txt selectable style={{ fontSize: 12, color: C.muted }}>
                {scanned.text}
              </Txt>
            </View>
          )}
        </View>
      )}
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
                ? `${p.category} · ${p.location} · ${p.estimated ? `vence aprox. ${p.date}` : `vence ${p.date}`}`
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
