export const COLORS = {
  background: "#F7F9F5",
  card: "#FFFFFF",
  text: "#1B2A22",
  muted: "#5A6B61",
  primary: "#2B77A8",
  primaryDark: "#1F5F8B",
  primarySoft: "#DCEAF4",
  border: "#DCE3D8",
  danger: "#D2453B",
  dangerSoft: "#FBE4E1",
  warning: "#A66A10",
  warningSoft: "#FCEBC8",
  ok: "#2E7D4F",
  okSoft: "#DDF0E3",
};

export const CATEGORIES = [
  { name: "Lácteos", emoji: "🥛" },
  { name: "Panadería", emoji: "🍞" },
  { name: "Enlatados", emoji: "🥫" },
  { name: "Carnes", emoji: "🥩" },
  { name: "Frutas y verduras", emoji: "🥦" },
  { name: "Bebidas", emoji: "🧃" },
  { name: "Granos", emoji: "🍚" },
  { name: "Otros", emoji: "📦" },
] as const;

export function emojiFor(category: string): string {
  return CATEGORIES.find((c) => c.name === category)?.emoji ?? "📦";
}
