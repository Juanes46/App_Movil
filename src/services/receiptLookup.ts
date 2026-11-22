import { estimateDays, guessCategory, type ParsedReceipt, type ReceiptItem } from "@/utils/receipt";

/** Lo que se necesita del resultado de buscarPorEAN (ver services/productLookup). */
export type EanLookup = (ean: string) => Promise<{
  nombre: string;
  marca: string | null;
  categoria: string;
  tamano: string | null;
}>;

/**
 * Completa los ítems de la factura que traen código de barras válido con el
 * nombre, la marca y la categoría de Open Food Facts / Los Precios
 * (buscarPorEAN ya respeta la caché y los límites: 15/min y 1/s).
 * Si un producto no aparece o falla la red, se deja el texto de la factura.
 * Deja de buscar al pasar `deadlineMs` (los que falten quedan como estaban).
 *
 *   await enrichReceipt(receipt, buscarPorEAN, { onProgress: (n, t) => ... })
 *   // "TORTILLA FAJI" (7700304448241) -> "Tortillas fajitas · Marca X" si OFF lo tiene
 */
export async function enrichReceipt(
  receipt: ParsedReceipt,
  lookup: EanLookup,
  {
    deadlineMs = 25_000,
    onProgress,
  }: { deadlineMs?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ receipt: ParsedReceipt; found: number }> {
  const start = Date.now();
  const withEan = receipt.items.filter((i) => i.ean);
  let done = 0;
  let found = 0;
  const items: ReceiptItem[] = [];

  for (const item of receipt.items) {
    if (!item.ean || Date.now() - start > deadlineMs) {
      items.push(item);
      continue;
    }
    try {
      const r = await lookup(item.ean);
      const size = r.tamano && !r.nombre.toLowerCase().includes(r.tamano.toLowerCase()) ? ` ${r.tamano}` : "";
      const brand =
        r.marca && !r.nombre.toLowerCase().includes(r.marca.toLowerCase()) ? ` · ${r.marca}` : "";
      const full = `${r.nombre}${size}${brand}`.trim();
      const name = full.charAt(0).toUpperCase() + full.slice(1);
      // Primero las reglas propias (pensadas para productos colombianos) sobre el
      // nombre de la API + el de la factura; la categoría de OFF solo si no deciden.
      // Ej.: OFF dice "Wheat flours" para unas tortillas -> sería Granos; las reglas dicen Panadería.
      const ours = guessCategory(`${r.nombre} ${item.name}`);
      const category =
        ours !== "Otros" ? ours : r.categoria !== "Otros" ? r.categoria : item.category;
      items.push({
        ...item,
        name,
        category,
        days: estimateDays(`${r.nombre} ${item.name}`, category),
        lowConfidence: category === "Otros",
      });
      found++;
    } catch {
      items.push(item); // no está en las APIs o no hay red: queda la descripción de la factura
    }
    done++;
    onProgress?.(done, withEan.length);
  }
  return { receipt: { ...receipt, items }, found };
}
