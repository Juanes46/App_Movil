import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { CategoryChips } from "@/components/CategoryChips";
import { ExpirationInput } from "@/components/ExpirationInput";
import {
  Chip,
  Note,
  Screen,
  Section,
  Stepper,
  Tag,
  Txt,
  ui,
} from "@/components/PantryUI";
import { COLORS as C, emojiForProduct } from "@/constants/pantry";
import {
  addProduct,
  updateProduct,
  useProducts,
  useStoreStatus,
} from "@/services/productStore";
import { formatDate, parseDate } from "@/utils/expiration";
import { suggestLocation } from "@/utils/location";
export default function ProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    category?: string;
    date?: string;
    source?: string;
    ocrRaw?: string;
    ocrConfidence?: string;
    quantity?: string;
    location?: string;
  }>();
  const products = useProducts();
  const { ready } = useStoreStatus();
  const existing = products.find((p) => p.id === params.id);
  const [name, setName] = useState(params.name ?? "");
  const [category, setCategory] = useState(params.category ?? "Lácteos");
  const [date, setDate] = useState(params.date ?? "");
  const [quantity, setQuantity] = useState(Number(params.quantity) || 1);
  const [location, setLocation] = useState(
    params.location ?? suggestLocation(params.name ?? "", params.category ?? "Lácteos"),
  );
  // En un producto nuevo la ubicación sigue al nombre y la categoría,
  // hasta que el usuario toque una ubicación a mano.
  const [locationTouched, setLocationTouched] = useState(
    !!params.location || !!params.id,
  );
  useEffect(() => {
    if (!locationTouched) setLocation(suggestLocation(name, category));
  }, [name, category, locationTouched]);
  const [editingDetails, setEditingDetails] = useState(
    !params.name || !!params.id,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [estimated, setEstimated] = useState(false);
  useEffect(() => {
    if (existing) {
      setName(params.name ?? existing.name);
      setCategory(params.category ?? existing.category);
      setDate(params.date ?? formatDate(existing.expiresOn));
      setQuantity(Number(params.quantity) || existing.quantity || 1);
      setLocation(params.location ?? existing.location ?? "Alacena");
      setEstimated(params.date ? false : !!existing.estimated);
    }
  }, [
    existing,
    params.name,
    params.category,
    params.date,
    params.quantity,
    params.location,
  ]);
  async function save() {
    const expiresOn = parseDate(date);
    if (name.trim().length < 2 || !expiresOn) {
      setError(
        "Escribe un nombre de al menos 2 caracteres y una fecha válida.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = {
        name: name.trim(),
        category,
        expiresOn,
        quantity,
        location,
        estimated,
      };
      if (params.id) {
        if (!existing) throw new Error("Producto no encontrado");
        await updateProduct(existing.id, input);
      } else await addProduct(input);
      router.replace("/pantry");
    } catch {
      setError("No se pudo guardar el producto. Intenta nuevamente.");
      setSaving(false);
    }
  }
  if (params.id && ready && !existing)
    return (
      <Screen title="Producto">
        <Txt>Este producto ya no está en tu despensa.</Txt>
      </Screen>
    );
  return (
    <Screen
      title={params.id ? "Editar producto" : "Confirmar producto"}
      footer={
        <>
          <Button
            title={
              saving
                ? "Guardando…"
                : params.id
                  ? "Guardar cambios"
                  : "Guardar producto"
            }
            disabled={saving || !ready}
            onPress={save}
          />
          <Button
            title="Volver a escanear fecha"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/scanner",
                params: {
                  name,
                  category,
                  id: params.id,
                  quantity: String(quantity),
                  location,
                },
              })
            }
          />
        </>
      }
    >
      {editingDetails ? (
        <View style={{ gap: 14 }}>
          <Section title="Nombre del producto" />
          <TextInput
            accessibilityLabel="Nombre del producto"
            value={name}
            onChangeText={setName}
            placeholder="Ej. Leche entera 1 L"
            style={ui.input}
          />
          <Section title="Categoría" />
          <CategoryChips value={category} onChange={setCategory} />
          <Button
            title="Confirmar datos"
            variant="secondary"
            onPress={() => setEditingDetails(false)}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Corregir datos del producto"
          onPress={() => setEditingDetails(true)}
          style={[ui.card, ui.row]}
        >
          <View style={[ui.image, { width: 48, height: 48, borderRadius: 10 }]}>
            <Txt style={{ fontSize: 26 }}>{emojiForProduct(name, category)}</Txt>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontSize: 15, fontWeight: "600" }}>{name}</Txt>
            <Txt style={ui.muted}>
              {category} · {location}
            </Txt>
          </View>
          <Txt style={ui.link}>Editar</Txt>
        </Pressable>
      )}
      <Section title="Fecha de vencimiento" />
      {params.source === "ocr" && !!params.ocrConfidence && (
        <Tag
          label={
            params.ocrConfidence === "alta"
              ? "Fecha leída · confianza alta"
              : params.ocrConfidence === "media"
                ? "Fecha leída · confianza media"
                : "Fecha leída · confianza baja: revísala"
          }
          tone={params.ocrConfidence === "alta" ? "vigente" : params.ocrConfidence === "media" ? "info" : "proximo"}
        />
      )}
      <ExpirationInput
        value={date}
        onChangeText={(value) => {
          setDate(value);
          setEstimated(false);
        }}
      />
      <Note>
        {params.source === "demo"
          ? "Fecha de una etiqueta de ejemplo. Confírmala o corrígela antes de guardar."
          : params.source === "ocr"
            ? `Fecha leída con la cámara${params.ocrRaw ? ` ("${params.ocrRaw}")` : ""}. Compárala con el envase antes de guardar.`
          : estimated
            ? "Fecha estimada por categoría. Verifica la fecha del envase."
            : "Revisa la fecha del envase antes de guardar."}
      </Note>
      <Section title="Cantidad" />
      <Stepper value={quantity} onChange={setQuantity} />
      <Section title="Ubicación" />
      <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
        {["Nevera", "Congelador", "Alacena"].map((l) => (
          <Chip
            key={l}
            label={l}
            active={location === l}
            onPress={() => {
              setLocation(l);
              setLocationTouched(true);
            }}
          />
        ))}
      </View>
      {!!error && (
        <Txt accessibilityRole="alert" style={{ color: C.danger }}>
          {error}
        </Txt>
      )}
    </Screen>
  );
}

