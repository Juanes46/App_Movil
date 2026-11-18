import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Avatar,
  Chip,
  ProductRowSkeleton,
  Screen,
  SearchField,
  StateMessage,
  Txt,
  ui,
} from "@/components/PantryUI";
import { ProductRow } from "@/components/ProductRow";
import { useRefresh } from "@/hooks/use-refresh";
import {
  refreshProducts,
  retryLoad,
  useProducts,
  useStoreStatus,
} from "@/services/productStore";
import { getStatus } from "@/utils/expiration";
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export default function PantryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const products = useProducts();
  const { ready, error } = useStoreStatus();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Todos");
  const [status, setStatus] = useState(params.status ?? "");
  const [sortName, setSortName] = useState(false);
  const { refreshing, onRefresh } = useRefresh(refreshProducts);
  const visible = products
    .filter(
      (p) =>
        normalize(p.name + " " + p.category).includes(normalize(query)) &&
        (location === "Todos" || p.location === location) &&
        (!status ||
          (status === "atencion"
            ? getStatus(p.expiresOn) !== "vigente"
            : getStatus(p.expiresOn) === status)),
    )
    .sort((a, b) =>
      sortName
        ? a.name.localeCompare(b.name, "es")
        : +a.expiresOn - +b.expiresOn,
    );
  return (
    <Screen active="Despensa" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={ui.row}>
        <Txt style={[ui.title, { flex: 1 }]}>Mi despensa</Txt>
        <Chip
          label="Filtros"
          active={!!status}
          onPress={() => setStatus(status ? "" : "atencion")}
        />
        <Avatar />
      </View>
      <SearchField value={query} onChangeText={setQuery} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: 8, alignItems: "center" }}
      >
        {["Todos", "Nevera", "Congelador", "Alacena"].map((l) => (
          <Chip
            key={l}
            label={l}
            active={location === l}
            onPress={() => setLocation(l)}
          />
        ))}
      </ScrollView>
      {!!status && (
        <Chip
          label={`${status === "proximo" ? "Por vencer" : status === "vencido" ? "Vencidos" : "Requieren atención"} · Quitar ×`}
          active
          onPress={() => setStatus("")}
        />
      )}
      <View style={ui.between}>
        <Txt style={ui.muted}>{visible.length} productos</Txt>
        <Chip
          label={`Ordenar: ${sortName ? "nombre" : "vencimiento"} ▾`}
          onPress={() => setSortName(!sortName)}
        />
      </View>
      {!ready ? (
        error ? (
          <StateMessage
            kind="error"
            title="No se pudo abrir la despensa"
            detail="La base de datos del celular no respondió."
            onAction={retryLoad}
          />
        ) : (
          <ProductRowSkeleton count={5} />
        )
      ) : (
        visible.map((p) => (
          <ProductRow
            key={p.id}
            product={p}
            onPress={() => router.push({ pathname: "/detail", params: { id: p.id } })}
          />
        ))
      )}
      {ready && !products.length && (
        <StateMessage
          kind="empty"
          title="Sin productos"
          detail="Agrega tu primer producto escaneando su código de barras."
          actionLabel="Agregar producto"
          onAction={() => router.push("/add")}
        />
      )}
      {ready && !!products.length && !visible.length && (
        <StateMessage
          kind="empty"
          title="Nada coincide"
          detail="No hay productos con estos filtros."
          actionLabel="Quitar filtros"
          onAction={() => {
            setQuery("");
            setLocation("Todos");
            setStatus("");
          }}
        />
      )}
    </Screen>
  );
}
