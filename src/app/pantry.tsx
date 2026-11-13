import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import {
  Avatar,
  Chip,
  Screen,
  SearchField,
  Txt,
  ui,
} from "@/components/PantryUI";
import { Button } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import {
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
    <Screen active="Despensa">
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
        contentContainerStyle={{ gap: 8 }}
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
          <>
            <Txt>No se pudo abrir la despensa.</Txt>
            <Button title="Reintentar" onPress={retryLoad} />
          </>
        ) : (
          <ActivityIndicator />
        )
      ) : (
        visible.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onPress={() =>
              router.push({ pathname: "/detail", params: { id: p.id } })
            }
          />
        ))
      )}
      {ready && !visible.length && (
        <Txt style={ui.muted}>
          No hay productos que coincidan con estos filtros.
        </Txt>
      )}
    </Screen>
  );
}
