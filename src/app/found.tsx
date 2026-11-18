import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import {
  InfoRow,
  Note,
  Screen,
  Section,
  Skeleton,
  StateMessage,
  Tag,
  Txt,
  ui,
} from "@/components/PantryUI";
import { COLORS as C, emojiFor } from "@/constants/pantry";
import {
  buscarPorEAN,
  LookupError,
  type LookupResult,
} from "@/services/productLookup";
import { formatDate, fromISODate } from "@/utils/expiration";

/** 25850 -> "$25.850" */
function formatPrice(n: number): string {
  return "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: LookupError }
  | { kind: "ok"; product: LookupResult };

export default function FoundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ean?: string }>();
  const [ean, setEan] = useState(params.ean ?? "");
  const [typed, setTyped] = useState(params.ean ?? "");
  const [state, setState] = useState<State>({ kind: params.ean ? "loading" : "idle" });

  const search = useCallback(async (code: string, force = false) => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ok", product: await buscarPorEAN(code, { force }) });
    } catch (e) {
      setState({
        kind: "error",
        error: e instanceof LookupError ? e : new LookupError("servicio_caido"),
      });
    }
  }, []);

  useEffect(() => {
    if (ean) search(ean);
  }, [ean, search]);

  const p = state.kind === "ok" ? state.product : null;
  const fullName = p ? [p.nombre, p.tamano].filter(Boolean).join(" ") : "";
  const next = (pathname: "/scanner" | "/product") =>
    router.push({
      pathname,
      params: p ? { name: fullName, category: p.categoria } : {},
    });

  return (
    <Screen
      title="Producto encontrado"
      footer={
        p ? (
          <>
            <Button title="Escanear fecha de vencimiento" onPress={() => next("/scanner")} />
            <Button
              title="Ingresar fecha manualmente"
              variant="secondary"
              onPress={() => next("/product")}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{ alignSelf: "center", padding: 4 }}
            >
              <Txt style={ui.link}>No es este producto · escanear otro</Txt>
            </Pressable>
          </>
        ) : undefined
      }
    >
      {state.kind === "idle" && (
        <>
          <Section title="Escribe el código de barras" />
          <TextInput
            accessibilityLabel="Código de barras"
            value={typed}
            onChangeText={(t) => setTyped(t.replace(/\D/g, "").slice(0, 13))}
            placeholder="Ej. 7702001114054"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            onSubmitEditing={() => setEan(typed)}
            style={ui.input}
          />
          <Txt style={ui.muted}>Son los 13 (u 8) números bajo las barras.</Txt>
          <Button title="Buscar producto" disabled={typed.length < 8} onPress={() => setEan(typed)} />
        </>
      )}

      {state.kind === "loading" && (
        <View style={{ gap: 14 }} accessibilityLabel={`Buscando ${ean}`}>
          <Skeleton width="100%" height={210} radius={16} />
          <Skeleton width={133} height={21} radius={10} />
          <Skeleton width="75%" height={28} />
          <Skeleton width="35%" height={16} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={30} />
          ))}
        </View>
      )}

      {state.kind === "error" && (
        <View style={{ gap: 12 }}>
          <StateMessage
            kind={
              state.error.code === "sin_internet"
                ? "offline"
                : state.error.code === "no_encontrado" || state.error.code === "codigo_invalido"
                  ? "empty"
                  : "error"
            }
            title={state.error.message}
            detail={`Código: ${ean}`}
            actionLabel="Reintentar"
            onAction={
              state.error.code === "no_encontrado" || state.error.code === "codigo_invalido"
                ? undefined
                : () => search(ean, true)
            }
          />
          <Button
            title="Registrar manualmente"
            variant="secondary"
            onPress={() => router.push("/product")}
          />
          <Button
            title="Escribir otro código"
            variant="secondary"
            onPress={() => {
              setEan("");
              setState({ kind: "idle" });
            }}
          />
        </View>
      )}

      {p && (
        <>
          <View style={[ui.image, { height: 210, overflow: "hidden" }]}>
            {p.imagen ? (
              <Image
                source={{ uri: p.imagen }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                accessibilityLabel={`Foto de ${p.nombre}`}
              />
            ) : (
              <Txt style={{ fontSize: 72 }}>{emojiFor(p.categoria)}</Txt>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Tag label="Producto encontrado" tone="info" />
            <Txt style={[ui.title, { fontSize: 24 }]}>{p.nombre}</Txt>
            {!!p.marca && <Txt style={{ color: C.muted }}>{p.marca}</Txt>}
          </View>
          <View>
            {!!p.tamano && <InfoRow label="Presentación" value={p.tamano} />}
            <InfoRow label="Categoría" value={p.categoria} />
            <InfoRow label="Código de barras" value={p.ean} />
            <InfoRow label="Fuente" value={p.fuente} />
          </View>

          <Section title="Precio de referencia (otras ciudades)" />
          {p.precios?.length ? (
            <View>
              {p.precios.slice(0, 4).map((s) => {
                const d = fromISODate(s.fecha);
                return (
                  <InfoRow
                    key={s.tienda + s.fecha}
                    label={`${s.tienda} · ${d ? formatDate(d) : s.fecha}`}
                    value={formatPrice(s.precio)}
                  />
                );
              })}
              <Txt style={[ui.muted, { fontSize: 12, marginTop: 6 }]}>
                Precios de Bogotá, Medellín, Cali o Barranquilla (no Tunja), aportados por
                usuarios de Los Precios.
              </Txt>
            </View>
          ) : (
            <Txt style={ui.muted}>{p.avisoPrecio ?? "Sin precios de referencia para este producto."}</Txt>
          )}

          <Note>
            El código de barras no indica la fecha de vencimiento: escanéala o escríbela en el
            siguiente paso.
          </Note>
          <Txt style={[ui.muted, { fontSize: 11 }]}>
            Datos de Open Food Facts (ODbL) · Precios: Los Precios (datos abiertos)
          </Txt>
        </>
      )}
    </Screen>
  );
}
