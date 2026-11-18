export { COLORS } from "@/theme/colors";

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

/**
 * Días estimados de vencimiento por categoría para los productos que llegan
 * por factura (la factura no trae la fecha). Son valores provisionales:
 * falta confirmarlos con el profesor. Se muestran como "fecha estimada".
 */
export const ESTIMATED_DAYS: Record<string, number> = {
  "Lácteos": 7,
  "Panadería": 5,
  "Enlatados": 365,
  "Carnes": 3,
  "Frutas y verduras": 5,
  "Bebidas": 90,
  "Granos": 180,
  "Otros": 30,
};

/** Ubicación sugerida según la categoría (sin nombre). Ver utils/location. */
export function defaultLocation(category: string): string {
  return category === "Carnes"
    ? "Congelador"
    : ["Lácteos", "Frutas y verduras"].includes(category)
      ? "Nevera"
      : "Alacena";
}
