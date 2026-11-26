import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, LayoutAnimation, Modal, Pressable, ScrollView, Share, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CategoryChips } from "@/components/CategoryChips";
import { CheckRow } from "@/components/CheckRow";
import { ExpirationInput } from "@/components/ExpirationInput";
import {
  Avatar,
  Chip,
  ProductRowSkeleton,
  Screen,
  Section,
  StateMessage,
  Stepper,
  Tag,
  Txt,
  ui,
} from "@/components/PantryUI";
import { COLORS as C, emojiForProduct } from "@/constants/pantry";
import { useRefresh } from "@/hooks/use-refresh";
import {
  clearDone,
  clearShopping,
  finishShopping,
  refreshShopping,
  removeShopping,
  restoreShopping,
  retryShopping,
  toggleShopping,
  updateShopping,
  useShopping,
  useShoppingError,
  useShoppingReady,
  type ShoppingItem,
} from "@/services/shoppingStore";
import { addDays, formatDate, parseDate } from "@/utils/expiration";
import { suggestLocation } from "@/utils/location";
import { estimateDays } from "@/utils/receipt";
import { shoppingShareText } from "@/utils/shareText";

const LOCATIONS = ["Nevera", "Congelador", "Alacena"] as const;
type SheetRow = ShoppingItem & { date: string; location: string; estimated: boolean };

/** Acción roja que aparece al deslizar a la izquierda. */
function DeleteAction() {
  return (
    <View
      style={{
        backgroundColor: C.danger,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "flex-end",
        paddingHorizontal: 20,
        marginLeft: 8,
        flex: 1,
      }}
    >
      <Txt style={{ color: C.white, fontWeight: "700" }}>Eliminar</Txt>
    </View>
  );
}

export default function ShoppingScreen() {
  const router = useRouter();
  const items = useShopping();
  const error = useShoppingError();
  const ready = useShoppingReady();
  const { refreshing, onRefresh } = useRefresh(refreshShopping);
  const [actionError, setActionError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [undo, setUndo] = useState<ShoppingItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheet, setSheet] = useState<SheetRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const done = items.filter((p) => p.done);
  const pending = items.filter((p) => !p.done);
  const categories = [...new Set(pending.map((p) => p.category))];
  const progress = items.length ? done.length / items.length : 0;

  // Barra de progreso animada
  const bar = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(bar, { toValue: progress, duration: 350, useNativeDriver: false }).start();
  }, [progress, bar]);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const fail = (msg = "No se pudo actualizar la lista. Intenta nuevamente.") => () => setActionError(msg);

  function toggle(p: ShoppingItem) {
    setActionError("");
    // La fila pasa a "Comprados" (o vuelve) con una animación corta.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleShopping(p).catch(fail());
  }

  async function remove(p: ShoppingItem) {
    setOpenId(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const removed = await removeShopping(p.id).catch(() => null);
    if (!removed) return setActionError("No se pudo eliminar. Intenta nuevamente.");
    setUndo(removed);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4000);
  }

  async function undoRemove() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const item = undo;
    setUndo(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await restoreShopping(item).catch(fail("No se pudo deshacer."));
  }

  function openFinish() {
    const today = new Date();
    setSheet(
      done.map((p) => ({
        ...p,
        date: formatDate(addDays(today, estimateDays(p.name, p.category))),
        location: suggestLocation(p.name, p.category),
        estimated: true,
      })),
    );
  }

  async function confirmFinish() {
    if (!sheet || saving) return;
    if (sheet.some((r) => !parseDate(r.date))) {
      setActionError("Revisa las fechas de vencimiento antes de terminar.");
      return;
    }
    setSaving(true);
    try {
      const n = await finishShopping(
        sheet.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          quantity: r.quantity,
          expiresOn: parseDate(r.date)!,
          location: r.location,
          estimated: r.estimated,
        })),
      );
      setSheet(null);
      setAdded(n);
    } catch {
      setActionError("No se pudo terminar la compra. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    setMenu(false);
    await Share.share({ message: shoppingShareText(pending) }).catch(() => {});
  }

  const row = (p: ShoppingItem) => (
    <View key={p.id} style={{ gap: 8, width: "100%" }}>
      {/* Solo la fila se desliza (a la izquierda = eliminar); el panel de opciones va debajo. */}
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={60}
        containerStyle={{ width: "100%" }}
        renderRightActions={() => <DeleteAction />}
        onSwipeableOpen={(direction) => {
          if (direction === "left" || direction === "right") remove(p);
        }}
      >
        <CheckRow
          {...p}
          checked={p.done}
          subtitle={openId === p.id ? "Toca de nuevo para cerrar" : p.category}
          onCheckPress={() => toggle(p)}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setOpenId(openId === p.id ? null : p.id);
          }}
        />
      </ReanimatedSwipeable>
        {openId === p.id && (
          <View style={[ui.card, { backgroundColor: C.surfaceSoft }]}>
            <View style={ui.between}>
              <Txt>Cantidad</Txt>
              <Stepper
                value={p.quantity}
                onChange={(quantity) => updateShopping(p.id, { quantity }).catch(fail())}
              />
            </View>
            <Txt style={ui.muted}>Categoría</Txt>
            <CategoryChips
              value={p.category}
              onChange={(category) => updateShopping(p.id, { category }).catch(fail())}
            />
            <Button title="Eliminar de la lista" variant="danger" onPress={() => remove(p)} />
          </View>
        )}
    </View>
  );

  return (
    <Screen
      active="Compras"
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={
        undo || done.length ? (
          <>
            {undo && (
              <View
                accessibilityLiveRegion="polite"
                style={[ui.between, { backgroundColor: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }]}
              >
                <Txt style={{ color: C.white }}>Producto eliminado</Txt>
                <Pressable accessibilityRole="button" onPress={undoRemove} hitSlop={10}>
                  <Txt style={{ color: C.primarySoft, fontWeight: "700" }}>Deshacer</Txt>
                </Pressable>
              </View>
            )}
            {done.length > 0 && (
              <Button title={`Terminar compra (${done.length})`} onPress={openFinish} />
            )}
          </>
        ) : undefined
      }
    >
      <View style={ui.row}>
        <Txt style={[ui.title, { flex: 1 }]}>Lista de compras</Txt>
        <Chip label="+" onPress={() => router.push("/shopping-add")} />
        <Chip label="⋯" active={menu} onPress={() => setMenu(!menu)} />
        <Avatar />
      </View>

      {menu && (
        <View style={[ui.card, { gap: 8 }]}>
          <Button title="Compartir lista" variant="secondary" disabled={!pending.length} onPress={share} />
          <Button
            title="Vaciar comprados"
            variant="secondary"
            disabled={!done.length}
            onPress={() => {
              setMenu(false);
              clearDone().catch(fail());
            }}
          />
          {confirmClearAll ? (
            <View style={[ui.card, { backgroundColor: C.dangerSoft, borderColor: C.danger }]}>
              <Txt style={{ fontWeight: "600" }}>¿Vaciar toda la lista ({items.length} productos)?</Txt>
              <Button
                title="Sí, vaciar"
                variant="danger"
                onPress={() => {
                  setConfirmClearAll(false);
                  setMenu(false);
                  clearShopping().catch(fail());
                }}
              />
              <Button title="Cancelar" variant="secondary" onPress={() => setConfirmClearAll(false)} />
            </View>
          ) : (
            <Button title="Vaciar lista" variant="danger" disabled={!items.length} onPress={() => setConfirmClearAll(true)} />
          )}
        </View>
      )}

      {added !== null && (
        <View style={[ui.card, { backgroundColor: C.okSoft, borderColor: C.okSoft }]} accessibilityRole="alert">
          <Txt style={{ color: C.ok, fontWeight: "600" }}>
            Se agregaron {added} {added === 1 ? "producto" : "productos"} a tu despensa
          </Txt>
          <Button title="Ir a Mi despensa" variant="secondary" onPress={() => router.push("/pantry")} />
        </View>
      )}

      {items.length > 0 && (
        <View style={{ gap: 6 }}>
          <View style={ui.between}>
            <Txt style={{ fontWeight: "600" }}>
              {done.length} de {items.length} comprados
            </Txt>
            <Txt style={ui.muted}>{pending.length} pendientes</Txt>
          </View>
          <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, overflow: "hidden" }}>
            <Animated.View
              style={{
                height: 8,
                backgroundColor: C.primary,
                width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }}
            />
          </View>
          <Txt style={[ui.muted, { fontSize: 12 }]}>
            Toca la casilla para marcar · toca el producto para editarlo · desliza a la izquierda para eliminar
          </Txt>
        </View>
      )}

      {!ready && !error && <ProductRowSkeleton count={4} />}
      {error && (
        <StateMessage kind="error" title="No se pudo cargar la lista de compras" onAction={retryShopping} />
      )}
      {!!actionError && <Txt style={{ color: C.danger }}>{actionError}</Txt>}

      {categories.map((category) => {
        const group = pending.filter((p) => p.category === category);
        return (
          <View key={category} style={{ gap: 12 }}>
            <Section title={category} action={String(group.length)} />
            {group.map(row)}
          </View>
        );
      })}
      {done.length > 0 && (
        <View style={{ gap: 12 }}>
          <Section title="Comprados" action={String(done.length)} />
          {done.map(row)}
        </View>
      )}

      {ready && !items.length && (
        <StateMessage
          kind="empty"
          title="Tu lista está vacía"
          detail="Agrega lo que necesitas para tu próxima compra. Te sugerimos lo que está por vencer o se acabó."
          actionLabel="Agregar a compras"
          onAction={() => router.push("/shopping-add")}
        />
      )}

      {/* Hoja de confirmación de "Terminar compra" */}
      <Modal visible={!!sheet} animationType="slide" transparent onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <SafeAreaView
            edges={["bottom"]}
            style={{ backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%" }}
          >
            <View style={{ padding: 20, paddingBottom: 8, gap: 4 }}>
              <Txt style={ui.section}>Terminar compra</Txt>
              <Txt style={ui.muted}>
                Revisa la fecha (estimada según el producto), la ubicación y la cantidad. Se agregarán a tu despensa.
              </Txt>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
              {sheet?.map((r, i) => (
                <View key={r.id} style={ui.card}>
                  <View style={ui.row}>
                    <Txt style={{ fontSize: 24 }}>{emojiForProduct(r.name, r.category)}</Txt>
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: "600" }}>{r.name}</Txt>
                      <Txt style={ui.muted}>{r.category}</Txt>
                    </View>
                    <Stepper
                      value={r.quantity}
                      onChange={(quantity) => setSheet((s) => s!.map((x, j) => (j === i ? { ...x, quantity } : x)))}
                    />
                  </View>
                  {r.estimated && <Tag label="Fecha estimada" tone="info" />}
                  <ExpirationInput
                    value={r.date}
                    onChangeText={(date) =>
                      setSheet((s) => s!.map((x, j) => (j === i ? { ...x, date, estimated: false } : x)))
                    }
                  />
                  <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
                    {LOCATIONS.map((l) => (
                      <Chip
                        key={l}
                        label={l}
                        active={r.location === l}
                        onPress={() => setSheet((s) => s!.map((x, j) => (j === i ? { ...x, location: l } : x)))}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ padding: 20, paddingTop: 8, gap: 10 }}>
              <Button
                title={saving ? "Agregando…" : `Agregar ${sheet?.length ?? 0} a la despensa`}
                disabled={saving}
                onPress={confirmFinish}
              />
              <Button title="Cancelar" variant="secondary" onPress={() => setSheet(null)} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </Screen>
  );
}
