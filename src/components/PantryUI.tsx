import type { PropsWithChildren } from "react";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS as C } from "@/constants/pantry";
import { FONTS, resolveFont } from "@/theme/fonts";
import { Button } from "./Button";

export const icons = {
  bell: require("../../assets/figma/homeContext-0.svg"),
  list: require("../../assets/figma/homeContext-1.svg"),
  home: require("../../assets/figma/homeContext-2.svg"),
  pantry: require("../../assets/figma/homeContext-3.svg"),
  cart: require("../../assets/figma/homeContext-4.svg"),
  search: require("../../assets/figma/1-139-0.svg"),
  barcode: require("../../assets/figma/1-237-0.svg"),
  receipt: require("../../assets/figma/1-237-1.svg"),
  manual: require("../../assets/figma/1-237-2.svg"),
  close: require("../../assets/figma/1-49-0.svg"),
  flash: require("../../assets/figma/1-49-1.svg"),
  homeInactive: require("../../assets/figma/1-237-4.svg"),
  pantryActive: require("../../assets/figma/1-139-2.svg"),
  cartActive: require("../../assets/figma/1-87-2.svg"),
  receiptReview: require("../../assets/figma/11-656-0.svg"),
};
export function Icon({
  name,
  size = 24,
}: {
  name: keyof typeof icons;
  size?: number;
}) {
  return (
    <Image
      source={icons[name]}
      style={{
        width:
          name === "barcode"
            ? 42
            : name === "receipt" || name === "manual"
              ? 41
              : size,
        height:
          name === "barcode"
            ? 42
            : name === "receipt"
              ? 41
              : name === "manual"
                ? 40
                : size,
      }}
      contentFit="contain"
    />
  );
}
export function Txt({ style, ...props }: TextProps) {
  // Elige Inter o Plus Jakarta Sans del grosor pedido (ver theme/fonts).
  const flat = StyleSheet.flatten([ui.text, style]) as TextStyle;
  return <Text {...props} style={resolveFont(flat)} />;
}

/** Barra superior con botón volver, título centrado y acción opcional. */
export function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={ui.topbar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={ui.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      >
        <Txt style={{ fontSize: 28, lineHeight: 30 }}>‹</Txt>
      </Pressable>
      <Txt accessibilityRole="header" style={[ui.section, { flex: 1, textAlign: "center" }]}>
        {title}
      </Txt>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

export type TagTone = "neutral" | "info" | "vigente" | "proximo" | "vencido";
const TAG_TONES: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: C.surfaceSoft, fg: C.text },
  info: { bg: C.primarySoft, fg: C.primaryDark },
  vigente: { bg: C.okSoft, fg: C.ok },
  proximo: { bg: C.warning, fg: C.text },
  vencido: { bg: C.danger, fg: C.white },
};
/** Etiqueta pequeña (estado de vencimiento, "Producto encontrado"…). */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: TagTone }) {
  const t = TAG_TONES[tone];
  return (
    <View style={[ui.tag, { backgroundColor: t.bg }]}>
      <Txt numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", color: t.fg }}>
        {label}
      </Txt>
    </View>
  );
}

/** Cifra grande con etiqueta (resumen de Inicio). */
export function StatTile({
  value,
  label,
  bg = C.card,
  fg = C.text,
  fgMuted = C.muted,
  onPress,
}: {
  value: number | string;
  label: string;
  bg?: string;
  fg?: string;
  fgMuted?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={[ui.stat, { backgroundColor: bg }]}
    >
      <Txt style={{ fontFamily: "Jakarta", fontSize: 28, fontWeight: "700", color: fg }}>
        {value}
      </Txt>
      <Txt style={{ fontSize: 12, color: fgMuted }}>{label}</Txt>
    </Pressable>
  );
}

/** Bloque gris que late suavemente mientras carga. */
export function Skeleton({
  width,
  height,
  radius = 8,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{ width, height, borderRadius: radius, backgroundColor: C.imageBg, opacity }}
    />
  );
}

/** Esqueleto con la forma de ProductRow (imagen, dos líneas y etiqueta). */
export function ProductRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="Cargando productos">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[ui.card, ui.row, { padding: 10, minHeight: 70 }]}>
          <Skeleton width={48} height={48} radius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={11} />
          </View>
          <Skeleton width={62} height={21} radius={10} />
        </View>
      ))}
    </View>
  );
}

/**
 * Estado vacío o de error con botón de reintento.
 *   <StateMessage kind="offline" onRetry={reload} />
 */
export function StateMessage({
  kind,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  kind: "empty" | "offline" | "error";
  title?: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const preset = {
    empty: { emoji: "🧺", title: "Aún no hay nada aquí", label: "Agregar" },
    offline: {
      emoji: "📡",
      title: "Sin conexión a internet",
      label: "Reintentar",
    },
    error: { emoji: "⚠️", title: "Algo salió mal", label: "Reintentar" },
  }[kind];
  return (
    <View
      accessibilityRole={kind === "empty" ? undefined : "alert"}
      style={[ui.card, { alignItems: "center", paddingVertical: 24, backgroundColor: C.surfaceSoft }]}
    >
      <Txt style={{ fontSize: 36 }}>{preset.emoji}</Txt>
      <Txt style={[ui.section, { textAlign: "center" }]}>{title ?? preset.title}</Txt>
      {!!detail && <Txt style={[ui.muted, { textAlign: "center", lineHeight: 19 }]}>{detail}</Txt>}
      {onAction && (
        <Button
          title={actionLabel ?? preset.label}
          variant={kind === "empty" ? "primary" : "secondary"}
          onPress={onAction}
          style={{ alignSelf: "stretch" }}
        />
      )}
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={ui.between}>
      <Txt style={ui.section}>{title}</Txt>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          disabled={!onPress}
        >
          <Txt style={ui.link}>{action}</Txt>
        </Pressable>
      )}
    </View>
  );
}
export function Avatar() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir perfil"
      onPress={() => router.push("/profile")}
      style={ui.avatar}
    >
      <Txt style={{ color: C.primaryDark, fontWeight: "600" }}>S</Txt>
    </Pressable>
  );
}
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        ui.chip,
        active && { backgroundColor: C.primary, borderColor: C.primary },
      ]}
    >
      <Txt style={{ fontSize: 13, color: active ? C.white : C.text }}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={ui.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Disminuir cantidad"
        disabled={value <= 1}
        onPress={() => onChange(Math.max(1, value - 1))}
        style={ui.step}
      >
        <Txt style={{ fontSize: 22, opacity: value <= 1 ? 0.4 : 1 }}>−</Txt>
      </Pressable>
      <Txt style={[ui.step, { textAlign: "center", paddingTop: 8 }]}>
        {value}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aumentar cantidad"
        onPress={() => onChange(Math.min(999, value + 1))}
        style={ui.step}
      >
        <Txt style={{ fontSize: 22 }}>+</Txt>
      </Pressable>
    </View>
  );
}
export function SearchField({
  value,
  onChangeText,
  placeholder = "Buscar en mi despensa",
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={ui.search}>
      <Icon name="search" size={20} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        style={[ui.text, { flex: 1, minWidth: 0, paddingVertical: 12 }]}
      />
    </View>
  );
}
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.info}>
      <Txt style={ui.muted}>{label}</Txt>
      <Txt style={{ fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
        {value}
      </Txt>
    </View>
  );
}
export function Note({ children }: PropsWithChildren) {
  return (
    <View style={ui.note}>
      <Txt style={{ fontSize: 13, lineHeight: 19, color: C.primaryDark }}>
        {children}
      </Txt>
    </View>
  );
}
export function BottomNav({ active }: { active?: string }) {
  const router = useRouter();
  const tabs: { label: string; path: Href; icon: keyof typeof icons }[] = [
    { label: "Inicio", path: "/", icon: "home" },
    { label: "Despensa", path: "/pantry", icon: "pantry" },
    { label: "Compras", path: "/shopping", icon: "cart" },
  ];
  return (
    <View style={ui.nav}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab.label }}
          onPress={() => router.replace(tab.path)}
          style={ui.tab}
        >
          <Icon
            name={
              tab.icon === "home" && active !== "Inicio"
                ? "homeInactive"
                : tab.icon === "pantry" && active === "Despensa"
                  ? "pantryActive"
                  : tab.icon === "cart" && active === "Compras"
                    ? "cartActive"
                    : tab.icon
            }
          />
          <Txt
            style={{
              fontSize: 11,
              color: active === tab.label ? C.text : C.muted,
              fontWeight: active === tab.label ? "600" : "400",
            }}
          >
            {tab.label}
          </Txt>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agregar producto"
        onPress={() => router.push("/add")}
        style={ui.fab}
      >
        <Txt style={{ fontSize: 34, color: C.white, lineHeight: 42 }}>+</Txt>
      </Pressable>
    </View>
  );
}
export function Screen({
  children,
  title,
  active,
  footer,
  scroll = true,
  refreshing,
  onRefresh,
}: PropsWithChildren<{
  title?: string;
  active?: string;
  footer?: React.ReactNode;
  scroll?: boolean;
  /** Pull-to-refresh: si se pasa onRefresh, se puede deslizar hacia abajo para recargar. */
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {title && <TopBar title={title} />}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={C.primary}
                  colors={[C.primary]}
                  progressBackgroundColor={C.card}
                />
              ) : undefined
            }
            contentContainerStyle={[
              ui.body,
              active ? { paddingBottom: 60 } : { paddingBottom: 24 },
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
        {footer && (
          <SafeAreaView edges={["bottom"]} style={ui.footer}>
            {footer}
          </SafeAreaView>
        )}
        {active && (
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: C.white }}>
            <BottomNav active={active} />
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  text: { fontFamily: FONTS.body, fontSize: 14, color: C.text },
  title: {
    fontFamily: "Jakarta",
    fontWeight: "700",
    fontSize: 26,
    color: C.text,
  },
  section: { fontFamily: "Jakarta", fontWeight: "600", fontSize: 17 },
  muted: { color: C.muted, fontSize: 13 },
  link: { color: C.primaryDark, fontSize: 13 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 14, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
  },
  stepper: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    overflow: "hidden",
  },
  step: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    paddingHorizontal: 14,
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    maxWidth: 140,
  },
  stat: { flex: 1, padding: 14, borderRadius: 14, minHeight: 80, gap: 2 },
  input: {
    fontFamily: FONTS.body,
    color: C.text,
    fontSize: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  note: { backgroundColor: C.primarySoft, padding: 12, borderRadius: 12 },
  nav: {
    height: 74,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  fab: {
    position: "absolute",
    left: "50%",
    marginLeft: -28,
    top: -41,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: C.white,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0px 4px 10px ${C.shadow}`,
  },
  topbar: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  image: {
    backgroundColor: C.imageBg,
    borderRadius: 16,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
  },
});
