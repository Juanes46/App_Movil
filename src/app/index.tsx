import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import {
  Avatar,
  Icon,
  ProductRowSkeleton,
  Screen,
  Section,
  Skeleton,
  StatTile,
  StateMessage,
  Txt,
  ui,
} from "@/components/PantryUI";
import { ProductRow } from "@/components/ProductRow";
import { COLORS as C, emojiForProduct } from "@/constants/pantry";
import { useRefresh } from "@/hooks/use-refresh";
import {
  refreshProducts,
  retryLoad,
  useProducts,
  useStoreStatus,
} from "@/services/productStore";
import { refreshShopping, useShopping } from "@/services/shoppingStore";
import { useAjustes } from "@/services/settingsStore";
import { getStatus } from "@/utils/expiration";
import { formatQuantity } from "@/utils/quantity";

export default function HomeScreen() {
  const router = useRouter();
  const products = useProducts();
  const { nombre } = useAjustes(); // "Próximo a vencer" depende de los días de anticipación
  const { ready, error } = useStoreStatus();
  const shopping = useShopping();
  const { refreshing, onRefresh } = useRefresh(refreshProducts, refreshShopping);
  const soon = products
    .filter((p) => getStatus(p.expiresOn) === "proximo")
    .sort((a, b) => +a.expiresOn - +b.expiresOn);
  const expired = products.filter((p) => getStatus(p.expiresOn) === "vencido");
  const hour = new Date().getHours();
  const toPantry = (status = "") => router.push({ pathname: "/pantry", params: { status } });

  return (
    <Screen active="Inicio" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={[ui.row, { gap: 10 }]}>
        <Logo height={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={ui.muted}>
            {hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"}
          </Txt>
          <Txt style={[ui.title, { fontSize: 24 }]}>{nombre.trim() ? `Hola, ${nombre.trim().split(/\s+/)[0]}` : "Hola"}</Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver alertas de vencimiento"
          onPress={() => toPantry("atencion")}
          style={[ui.avatar, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}
        >
          <Icon name="bell" size={22} />
        </Pressable>
        <Avatar />
      </View>

      {!ready && error ? (
        <StateMessage
          kind="error"
          title="No se pudo abrir tu despensa"
          detail="La base de datos del celular no respondió."
          onAction={retryLoad}
        />
      ) : !ready ? (
        <>
          <Skeleton width="100%" height={65} radius={14} />
          <View style={[ui.row, { gap: 10 }]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1 }}>
                <Skeleton width="100%" height={80} radius={14} />
              </View>
            ))}
          </View>
          <ProductRowSkeleton count={2} />
        </>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => toPantry("atencion")}
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
              <Txt style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>!</Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontWeight: "600" }}>
                {expired.length} vencidos · {soon.length} vencen esta semana
              </Txt>
              <Txt style={{ fontSize: 12, color: C.muted }}>Revísalos hoy para no desperdiciar</Txt>
            </View>
            <Txt style={{ fontSize: 20, color: C.muted }}>›</Txt>
          </Pressable>

          <View style={[ui.row, { gap: 10, alignItems: "stretch" }]}>
            <StatTile value={products.length} label="Productos" onPress={() => toPantry()} />
            <StatTile
              value={soon.length}
              label="Por vencer"
              bg={C.warningSoft}
              onPress={() => toPantry("proximo")}
            />
            <StatTile
              value={expired.length}
              label="Vencidos"
              bg={C.danger}
              fg={C.white}
              fgMuted={C.white}
              onPress={() => toPantry("vencido")}
            />
          </View>

          <Button title="Escanear producto" onPress={() => router.push("/scan-code")} />

          <Section title="Próximos a vencer" action="Ver todo ›" onPress={() => toPantry("proximo")} />
          {soon.slice(0, 2).map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onPress={() => router.push({ pathname: "/detail", params: { id: p.id } })}
            />
          ))}
          {!soon.length && <Txt style={ui.muted}>No tienes productos próximos a vencer.</Txt>}

          <Section title="Agregados recientemente" action="Ver todo ›" onPress={() => toPantry()} />
          {products.length ? (
            <View style={[ui.row, { alignItems: "flex-start", gap: 10 }]}>
              {[...products]
                .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))
                .slice(0, 3)
                .map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    style={{ flex: 1, gap: 4 }}
                    onPress={() => router.push({ pathname: "/detail", params: { id: p.id } })}
                  >
                    <View style={[ui.image, { height: 66, borderRadius: 10 }]}>
                      <Txt style={{ fontSize: 34 }}>{emojiForProduct(p.name, p.category)}</Txt>
                    </View>
                    <Txt numberOfLines={1} style={{ fontSize: 13, fontWeight: "600" }}>
                      {p.name}
                    </Txt>
                    <Txt style={{ fontSize: 11, color: C.muted }}>
                      {formatQuantity(p.quantity, p.unit)} · {p.location ?? "Alacena"}
                    </Txt>
                  </Pressable>
                ))}
            </View>
          ) : (
            <StateMessage
              kind="empty"
              title="Tu despensa está vacía"
              detail="Escanea un código de barras o registra tu primer producto."
              actionLabel="Agregar producto"
              onAction={() => router.push("/add")}
            />
          )}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/shopping")}
        style={[ui.row, { backgroundColor: C.surfaceSoft, padding: 14, borderRadius: 14 }]}
      >
        <View
          style={{
            borderWidth: 1.5,
            borderColor: C.muted,
            borderRadius: 8,
            width: 28,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="list" size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontSize: 15, fontWeight: "600" }}>Lista de compras</Txt>
          <Txt style={{ color: C.muted, fontSize: 12 }}>
            {shopping.filter((p) => !p.done).length} pendientes ·{" "}
            {shopping.filter((p) => p.done).length} comprados
          </Txt>
        </View>
        <Txt style={{ fontSize: 20, color: C.muted }}>›</Txt>
      </Pressable>
    </Screen>
  );
}
