import { normalizeName } from "@/utils/keywords";
import { formatDate } from "@/utils/expiration";
import { formatQuantity } from "@/utils/quantity";

/** Nombre normalizado para comparar productos: "Leche  Entera" == "leche entera" == "LECHE ENTERA". */
export function sameName(a: string, b: string): boolean {
  return normalizeKey(a) === normalizeKey(b);
}
export function normalizeKey(s: string): string {
  return normalizeName(s).replace(/[^A-Z0-9Ñ ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Lista de compras para compartir (WhatsApp), pendientes agrupados por categoría.
 *   shoppingShareText([{ name: "Leche", category: "Lácteos", quantity: 2 }, { name: "Pan", category: "Panadería", quantity: 1 }])
 *   // "🛒 Lista de compras · Despensa Viva\n\nLácteos\n• Leche ×2\n\nPanadería\n• Pan"
 */
export function shoppingShareText(items: { name: string; category: string; quantity: number }[]): string {
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const line = `• ${it.name}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`;
    groups.set(it.category, [...(groups.get(it.category) ?? []), line]);
  }
  const body = [...groups.entries()].map(([cat, lines]) => `${cat}\n${lines.join("\n")}`).join("\n\n");
  return `🛒 Lista de compras · Despensa Viva\n\n${body || "(sin pendientes)"}`;
}

/**
 * Resumen de la despensa para "Exportar mis datos".
 *   pantrySummary([{ name: "Leche", category: "Lácteos", location: "Nevera", quantity: 2, unit: "un", expiresOn: … }])
 *   // "Mi despensa · Despensa Viva (1 productos)\n\nNevera\n• Leche ×2 un · Lácteos · vence 30/11/2026"
 */
export function pantrySummary(
  products: {
    name: string;
    category: string;
    location?: string;
    quantity?: number;
    unit?: string;
    expiresOn: Date;
    estimated?: boolean;
  }[],
  today: Date = new Date(),
): string {
  const byPlace = new Map<string, string[]>();
  for (const p of [...products].sort((a, b) => +a.expiresOn - +b.expiresOn)) {
    const place = p.location ?? "Alacena";
    const line = `• ${p.name} ${formatQuantity(p.quantity, p.unit)} · ${p.category} · vence ${formatDate(p.expiresOn)}${p.estimated ? " (estimada)" : ""}`;
    byPlace.set(place, [...(byPlace.get(place) ?? []), line]);
  }
  const body = [...byPlace.entries()].map(([place, lines]) => `${place}\n${lines.join("\n")}`).join("\n\n");
  return `Mi despensa · Despensa Viva (${products.length} productos) · ${formatDate(today)}\n\n${body || "(vacía)"}`;
}
