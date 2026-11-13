import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Button } from "@/components/Button";
import { Avatar, Icon, Screen, Section, Txt, ui } from "@/components/PantryUI";
import { ProductCard } from "@/components/ProductCard";
import { COLORS as C, emojiFor } from "@/constants/pantry";
import {
  retryLoad,
  useProducts,
  useStoreStatus,
} from "@/services/productStore";
import { getStatus } from "@/utils/expiration";
import { useShopping } from "@/services/shoppingStore";
export default function HomeScreen() {
  const router = useRouter();
  const products = useProducts();
  const { ready, error } = useStoreStatus();
  const shopping = useShopping();
  const soon = products
    .filter((p) => getStatus(p.expiresOn) === "proximo")
    .sort((a, b) => +a.expiresOn - +b.expiresOn);
  const expired = products.filter((p) => getStatus(p.expiresOn) === "vencido");
  const hour = new Date().getHours();
  return (
    <Screen active="Inicio">
      <View style={ui.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={ui.muted}>
            {hour < 12
              ? "Buenos días"
              : hour < 18
                ? "Buenas tardes"
                : "Buenas noches"}
          </Txt>
          <Txt style={[ui.title, { fontSize: 24 }]}>Hola, Samuel</Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver alertas de vencimiento"
          onPress={() =>
            router.push({ pathname: "/pantry", params: { status: "atencion" } })
          }
          style={[
            ui.avatar,
            { backgroundColor: "white", borderWidth: 1, borderColor: C.border },
          ]}
        >
          <Icon name="bell" size={22} />
        </Pressable>
        <Avatar />
      </View>
      {!ready ? (
        error ? (
          <>
            <Txt>No se pudo abrir tu despensa.</Txt>
            <Button title="Reintentar" onPress={retryLoad} />
          </>
        ) : (
          <ActivityIndicator color={C.primary} />
        )
      ) : (
        <>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/pantry",
                params: { status: "atencion" },
              })
            }
            style={[
              ui.row,
              {
                padding: 14,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: expired.length ? C.danger : C.border,
                backgroundColor: expired.length ? C.dangerSoft : C.okSoft,
              },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                backgroundColor: expired.length ? C.danger : C.ok,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt style={{ color: "white", fontWeight: "700" }}>!</Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontWeight: "600" }}>
                {expired.length} vencidos · {soon.length} vencen esta semana
              </Txt>
              <Txt style={{ fontSize: 12, color: C.muted }}>
                Revísalos hoy para no desperdiciar
              </Txt>
            </View>
            <Txt>›</Txt>
          </Pressable>
          <View style={[ui.row, { gap: 10 }]}>
            {[
              {
                count: products.length,
                label: "Productos",
                bg: "white",
                status: "",
              },
              {
                count: soon.length,
                label: "Por vencer",
                bg: C.warningSoft,
                status: "proximo",
              },
              {
                count: expired.length,
                label: "Vencidos",
                bg: C.danger,
                status: "vencido",
              },
            ].map((s, i) => (
              <Pressable
                key={s.label}
                onPress={() =>
                  router.push({
                    pathname: "/pantry",
                    params: { status: s.status },
                  })
                }
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  minHeight: 80,
                  gap: 2,
                  backgroundColor: s.bg,
                }}
              >
                <Txt
                  style={{
                    fontFamily: "Jakarta",
                    fontSize: 28,
                    fontWeight: "700",
                    color: i === 2 ? "white" : C.text,
                  }}
                >
                  {s.count}
                </Txt>
                <Txt
                  style={{ fontSize: 12, color: i === 2 ? "white" : C.muted }}
                >
                  {s.label}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Button
            title="Escanear producto"
            onPress={() => router.push("/scan-code")}
          />
          <Section
            title="Próximos a vencer"
            action="Ver todo ›"
            onPress={() =>
              router.push({
                pathname: "/pantry",
                params: { status: "proximo" },
              })
            }
          />
          {soon.slice(0, 2).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onPress={() =>
                router.push({ pathname: "/detail", params: { id: p.id } })
              }
            />
          ))}
          {!soon.length && (
            <Txt style={ui.muted}>No tienes productos próximos a vencer.</Txt>
          )}
          <Section
            title="Agregados recientemente"
            action="Ver todo ›"
            onPress={() => router.push("/pantry")}
          />
          <View style={[ui.row, { alignItems: "flex-start", gap: 10 }]}>
            {[...products]
              .sort((a, b) =>
                b.id.localeCompare(a.id, undefined, { numeric: true }),
              )
              .slice(0, 3)
              .map((p) => (
                <Pressable
                  key={p.id}
                  style={{ flex: 1, gap: 4 }}
                  onPress={() =>
                    router.push({ pathname: "/detail", params: { id: p.id } })
                  }
                >
                  <View style={[ui.image, { height: 66, borderRadius: 10 }]}>
                    <Txt style={{ fontSize: 34 }}>{emojiFor(p.category)}</Txt>
                  </View>
                  <Txt
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: "600" }}
                  >
                    {p.name}
                  </Txt>
                  <Txt style={{ fontSize: 11, color: C.muted }}>
                    x{p.quantity ?? 1} · {p.location ?? "Alacena"}
                  </Txt>
                </Pressable>
              ))}
          </View>
          {!products.length && (
            <Txt style={ui.muted}>Agrega tu primer producto para comenzar.</Txt>
          )}
        </>
      )}
      <Pressable
        onPress={() => router.push("/shopping")}
        style={[
          ui.row,
          { backgroundColor: "#EEF3EA", padding: 14, borderRadius: 14 },
        ]}
      >
        <Icon name="list" size={22} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontSize: 15, fontWeight: "600" }}>
            Lista de compras
          </Txt>
          <Txt style={{ color: C.muted, fontSize: 12 }}>
            {shopping.filter((p) => !p.done).length} pendientes ·{" "}
            {shopping.filter((p) => p.done).length} comprados
          </Txt>
        </View>
        <Txt>›</Txt>
      </Pressable>
    </Screen>
  );
}
