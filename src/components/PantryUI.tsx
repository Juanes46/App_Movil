import type { PropsWithChildren } from "react";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS as C } from "@/constants/pantry";

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
  return <Text {...props} style={[ui.text, style]} />;
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
      <Txt style={{ fontSize: 13, color: active ? "white" : C.text }}>
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
        <Txt style={{ fontSize: 34, color: "white", lineHeight: 42 }}>+</Txt>
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
}: PropsWithChildren<{
  title?: string;
  active?: string;
  footer?: React.ReactNode;
  scroll?: boolean;
}>) {
  const router = useRouter();
  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {title && (
          <View style={ui.topbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              style={ui.back}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              <Txt style={{ fontSize: 28, lineHeight: 30 }}>‹</Txt>
            </Pressable>
            <Txt style={[ui.section, { flex: 1, textAlign: "center" }]}>
              {title}
            </Txt>
            <View style={{ width: 40 }} />
          </View>
        )}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
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
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "white" }}>
            <BottomNav active={active} />
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  text: { fontFamily: "Inter", fontSize: 14, color: C.text },
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
    backgroundColor: "white",
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
    backgroundColor: "white",
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
    backgroundColor: "white",
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
    backgroundColor: "white",
    paddingHorizontal: 14,
  },
  input: {
    fontFamily: "Inter",
    color: C.text,
    fontSize: 16,
    backgroundColor: "white",
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
    backgroundColor: "white",
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
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 10px rgba(23,38,28,0.25)",
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
    backgroundColor: "white",
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
    backgroundColor: "#E8EFE3",
    borderRadius: 16,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
  },
});
