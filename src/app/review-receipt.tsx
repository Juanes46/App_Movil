import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { CategoryChips } from "@/components/CategoryChips";
import { CheckRow } from "@/components/CheckRow";
import { ExpirationInput } from "@/components/ExpirationInput";
import { LoadingSplash } from "@/components/LoadingSplash";
import {
  Chip,
  Icon,
  Note,
  Screen,
  Section,
  Stepper,
  Tag,
  Txt,
  ui,
} from "@/components/PantryUI";
import { COLORS as C, emojiForProduct, ESTIMATED_DAYS } from "@/constants/pantry";
import { saveLearned } from "@/services/learnedNames";
import { addProducts } from "@/services/productStore";
import { learnedKey } from "@/services/receiptLookup";
import { addDays, formatDate, parseDate } from "@/utils/expiration";
import { suggestLocation } from "@/utils/location";
import { estimateDays, getPendingReceipt, missingInfo, setPendingReceipt } from "@/utils/receipt";
import { formatQuantity } from "@/utils/quantity";
import { TimeoutError, withTimeout } from "@/utils/timeout";

const LOCATIONS = ["Nevera", "Congelador", "Alacena"] as const;

/** 39670 -> "$39.670" */
const formatPrice = (n: number) => "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

type Row = {
  name: string;
  category: string;
  location: string;
  quantity: number;
  days: number;
  raw?: string;
  lowConfidence?: boolean;
  /** "un" o "kg" */
  unit?: string;
  ean?: string;
  /** Clave para recordar correcciones: EAN o "TIENDA|TEXTO". */
  key?: string;
  /** El nombre salió de lo que el usuario corrigió antes. */
  fromLearned?: boolean;
  /** De dónde salió el nombre: Recordado, Conocido, Open Food Facts, Los Precios, UPCitemdb, Factura. */
  nameSource?: string;
  /** La factura no traía cantidad (foto recortada): 1 por defecto. */
  qtyUnknown?: boolean;
};

const samples: Row[] = [
  { name: "Leche entera 1 L", category: "Lácteos", location: "Nevera", quantity: 2, days: 7 },
  { name: "Huevos AA x12", category: "Lácteos", location: "Nevera", quantity: 1, days: 21 },
  { name: "Arroz blanco 1 kg", category: "Granos", location: "Alacena", quantity: 1, days: 365 },
  { name: "Atún en agua", category: "Enlatados", location: "Alacena", quantity: 3, days: 730 },
  { name: "Tomate chonto", category: "Frutas y verduras", location: "Nevera", quantity: 1, days: 5 },
  { name: "Jabón Protex avena", category: "Cuidado personal", location: "Alacena", quantity: 1, days: 730 },
  { name: "Prod xq 12", category: "Otros", location: "Alacena", quantity: 1, days: 30, lowConfidence: true },
];

export default function ReviewReceiptScreen() {
  const router = useRouter();
  // Factura leída por el OCR; si no hay, se muestra la factura de ejemplo.
  const [scanned] = useState(() => getPendingReceipt());
  // Los días estimados se cuentan desde la fecha de compra de la factura (si se leyó).
  const base = scanned?.purchaseDate ?? new Date();
  const [rows, setRows] = useState(() => {
    const source: Row[] = scanned
      ? scanned.items
          .filter((it) => it.name.trim().length >= 2) // nada de ítems vacíos
          .map((it) => ({
          name: it.name,
          category: it.category,
          location: it.learnedLocation ?? suggestLocation(it.name, it.category),
          quantity: it.quantity,
          days: it.days ?? ESTIMATED_DAYS[it.category] ?? 30,
          raw: it.raw,
          lowConfidence: it.lowConfidence,
          unit: it.unit ?? "un",
          ean: it.ean,
          key: learnedKey(it, scanned.store),
          fromLearned: it.fromLearned,
          nameSource: it.nameSource,
          qtyUnknown: it.qtyUnknown,
        }))
      : samples;
    return source
      .map((p) => ({
        ...p,
        // Los dudosos no se agregan solos: el usuario los revisa y los marca.
        selected: !p.lowConfidence,
        date: formatDate(addDays(base, p.days)),
        estimated: true,
        locationTouched: false,
        // Lo que vino de la lectura, para saber si el usuario lo corrigió.
        orig: { name: p.name, category: p.category, location: p.location },
      }))
      // Los de baja confianza al final, con aviso.
      .sort((a, b) => Number(!!a.lowConfidence) - Number(!!b.lowConfidence));
  });
  const [editing, setEditing] = useState(false);
  const [showText, setShowText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = rows.filter((p) => p.selected);
  const toReview = rows.filter((p) => p.lowConfidence).length;
  const missing = scanned ? missingInfo(scanned) : null;
  const [copied, setCopied] = useState(false);
  async function copyText() {
    if (!scanned) return;
    await Clipboard.setStringAsync(scanned.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function update(i: number, values: Partial<(typeof rows)[number]>) {
    setRows((v) => v.map((p, j) => (i === j ? { ...p, ...values } : p)));
  }

  // Al cambiar la categoría: la ubicación y la fecha estimada la siguen
  // (salvo que el usuario ya las haya elegido a mano).
  function changeCategory(i: number, category: string) {
    const p = rows[i];
    const days = estimateDays(p.name, category);
    update(i, {
      category,
      lowConfidence: category === "Otros" ? p.lowConfidence : false,
      ...(p.locationTouched ? {} : { location: suggestLocation(p.name, category) }),
      ...(p.estimated ? { days, date: formatDate(addDays(base, days)) } : {}),
    });
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
      await withTimeout(
        addProducts(
          selected.map((p) => ({
            name: p.name.trim(),
            category: p.category,
            location: p.location,
            quantity: p.quantity,
            expiresOn: parseDate(p.date)!,
            estimated: p.estimated,
            unit: p.unit ?? "un",
            ean: p.ean ?? null,
          })),
        ),
      );
      // Recordar las correcciones (nombre, categoría o ubicación) para la próxima factura.
      const corrected = selected.filter(
        (p) =>
          p.key &&
          (p.name.trim() !== p.orig.name ||
            p.category !== p.orig.category ||
            p.location !== p.orig.location),
      );
      await saveLearned(
        corrected.map((p) => ({
          key: p.key!,
          nombre: p.name.trim(),
          categoria: p.category,
          ubicacion: p.location,
        })),
      ).catch(() => {}); // si falla, los productos ya quedaron guardados
      setPendingReceipt(null);
      router.replace("/pantry");
    } catch (e) {
      setError(
        e instanceof TimeoutError
          ? "Guardar tardó demasiado. Toca “Agregar” para intentarlo de nuevo."
          : "No se pudo guardar la factura. Intenta nuevamente.",
      );
      setSaving(false);
    }
  }

  return (
    <Screen
      title="Revisar factura"
      footer={
        <>
          <Button
            title={saving ? "Guardando…" : `Agregar ${selected.length} a la despensa`}
            disabled={!selected.length || saving}
            onPress={save}
          />
          <Button
            title={editing ? "Terminar revisión" : "Editar productos y fechas"}
            variant="secondary"
            onPress={() => setEditing(!editing)}
          />
        </>
      }
    >
      <View style={[ui.card, ui.row]}>
        <View style={{ padding: 10, borderRadius: 10, backgroundColor: C.primarySoft }}>
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
      {scanned?.totalMatches === true && (
        <View style={[ui.card, { backgroundColor: C.okSoft, borderColor: C.okSoft }]}>
          <Txt style={{ color: C.ok, fontWeight: "600" }}>
            ✓ La suma coincide con el total de la factura ({formatPrice(scanned.total ?? 0)})
          </Txt>
          <Txt style={{ color: C.ok, fontSize: 12 }}>Lectura confiable.</Txt>
        </View>
      )}
      {scanned?.totalMatches === false && (
        <View
          accessibilityRole="alert"
          style={[ui.card, { backgroundColor: C.dangerSoft, borderColor: C.danger }]}
        >
          <Txt style={{ color: C.danger, fontWeight: "600" }}>
            La suma no coincide con el total: revisa los productos
          </Txt>
          <Txt style={{ color: C.text, fontSize: 12 }}>
            Suma leída {formatPrice(scanned.sum)} · total de la factura{" "}
            {formatPrice(scanned.total ?? 0)}. Puede faltar un producto o haber un precio mal leído.
          </Txt>
        </View>
      )}
      {missing && (
        <View
          accessibilityRole="alert"
          style={[ui.card, { backgroundColor: C.warningSoft, borderColor: C.warning }]}
        >
          <Txt style={{ color: C.warningText, fontWeight: "600" }}>
            {missing.missingUnits > 0
              ? `Faltan ${missing.missingUnits} ${missing.missingUnits === 1 ? "producto" : "productos"} según la factura: toma otra parte`
              : `Faltan ${formatPrice(missing.missingValue)} para llegar al total: toma otra parte`}
          </Txt>
          <Txt style={{ color: C.warningText, fontSize: 12 }}>
            {scanned?.expectedCount !== null && scanned?.expectedCount !== undefined
              ? `La factura dice ${scanned.expectedCount} artículos entregados. `
              : ""}
            Vuelve a Escanear factura y usa “De cerca” para las filas que faltan.
          </Txt>
        </View>
      )}
      {toReview > 0 && (
        <View style={[ui.card, { backgroundColor: C.warningSoft, borderColor: C.warning }]}>
          <Txt style={{ color: C.warningText, fontWeight: "600" }}>
            ⚠ {toReview === 1 ? "1 línea dudosa" : `${toReview} líneas dudosas`} al final de la lista
          </Txt>
          <Txt style={{ color: C.warningText, fontSize: 12 }}>
            No reconocimos bien su nombre o su categoría: no se agregan hasta que las marques.
          </Txt>
        </View>
      )}
      <Note>
        La factura no trae fecha de vencimiento: calculamos una fecha aproximada según el tipo
        de producto
        {scanned?.purchaseDate
          ? `, contando desde la compra (${formatDate(scanned.purchaseDate)})`
          : ""}
        . Corrígela con “Editar” o escanéala después en el envase.
      </Note>
      {scanned && (
        <View style={{ gap: 8 }}>
          <Txt accessibilityRole="button" onPress={() => setShowText(!showText)} style={ui.link}>
            {showText ? "Ocultar texto leído" : "Ver texto leído por la cámara"}
          </Txt>
          {showText && (
            <View style={ui.card}>
              <Button
                title={copied ? "Copiado ✓" : "Copiar texto"}
                variant="secondary"
                onPress={copyText}
              />
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
        onPress={() => setRows((v) => v.map((p) => ({ ...p, selected: !selected.length && !!p.name })))}
      />
      {rows.map((p, i) => (
        <View key={i} style={{ gap: 6 }}>
          {p.fromLearned && <Tag label="Nombre recordado" tone="info" />}
          {p.lowConfidence && (
            <Txt style={{ color: C.warningText, fontSize: 12, fontWeight: "600" }}>
              ⚠ Revisa este producto
            </Txt>
          )}
          <CheckRow
            {...p}
            name={p.name || "Sin nombre"}
            checked={p.selected}
            quantityLabel={formatQuantity(p.quantity, p.unit)}
            subtitle={
              p.name
                ? `${emojiForProduct(p.name, p.category)} ${formatQuantity(p.quantity, p.unit)} · ${p.category} · ${p.location} · ${p.estimated ? `vence aprox. ${p.date}` : `vence ${p.date}`}`
                : "Corrige el nombre antes de agregar"
            }
            onPress={() => {
              update(i, { selected: !p.selected });
              if (!p.name) setEditing(true);
            }}
          />
          {p.qtyUnknown && <Tag label="Revisar cantidad" tone="proximo" />}
          {(!!p.raw || !!p.nameSource) && (
            <Txt numberOfLines={2} style={{ fontSize: 11, color: C.muted }}>
              {p.nameSource ? `Nombre: ${p.nameSource}` : ""}
              {p.nameSource && p.raw ? " · " : ""}
              {p.raw ? `Leído: “${p.raw}”` : ""}
            </Txt>
          )}
          {editing && (
            <View style={ui.card}>
              <TextInput
                accessibilityLabel={`Nombre del producto ${i + 1}`}
                value={p.name}
                onChangeText={(name) => update(i, { name })}
                placeholder="Corregir nombre"
                placeholderTextColor={C.muted}
                style={ui.input}
              />
              <Txt style={ui.muted}>Categoría</Txt>
              <CategoryChips value={p.category} onChange={(c) => changeCategory(i, c)} />
              <Txt style={ui.muted}>Ubicación</Txt>
              <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
                {LOCATIONS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    active={p.location === l}
                    onPress={() => update(i, { location: l, locationTouched: true })}
                  />
                ))}
              </View>
              <Txt style={ui.muted}>Fecha de vencimiento</Txt>
              <ExpirationInput
                value={p.date}
                onChangeText={(date) => update(i, { date, estimated: false })}
              />
              {p.unit === "kg" ? (
                <Txt style={ui.muted}>Cantidad: {formatQuantity(p.quantity, p.unit)} (por peso)</Txt>
              ) : (
                <Stepper value={p.quantity} onChange={(quantity) => update(i, { quantity })} />
              )}
            </View>
          )}
        </View>
      ))}
      {!!error && (
        <Txt accessibilityRole="alert" style={{ color: C.danger }}>
          {error}
        </Txt>
      )}
      <LoadingSplash visible={saving} message="Guardando…" />
    </Screen>
  );
}
