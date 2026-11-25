import { normalizeName } from "@/utils/keywords";
import { estimateDays, guessCategory, type ParsedReceipt, type ReceiptItem } from "@/utils/receipt";

/* ------------------------------------------------------------------ */
/*  Identificación de los productos de una factura por su código de     */
/*  barras. Para cada ítem, la primera fuente que responda:             */
/*   1. Nombres recordados (correcciones del usuario)  · sin red        */
/*   2. Códigos conocidos (src/data/eanConocidos.ts)   · sin red        */
/*   3. Caché local de consultas (cache_productos)     · sin red        */
/*   4. Open Food Facts universal (v3, product_type=all)                */
/*   5. Los Precios                                                     */
/*   6. UPCitemdb (gratis, 100 al día)                                  */
/*   7. Nombre limpio de la factura + categoría por reglas              */
/*  Este archivo no usa red ni SQLite: las fuentes se pasan desde       */
/*  services/receiptSources.ts (y en las pruebas, simuladas).           */
/* ------------------------------------------------------------------ */

export type NameSource =
  | "Recordado"
  | "Conocido"
  | "Caché"
  | "Open Food Facts"
  | "Los Precios"
  | "UPCitemdb"
  | "Factura";

/** Nombre que el usuario corrigió antes para un producto (tabla nombres_aprendidos). */
export type Learned = { nombre: string; categoria: string; ubicacion: string | null };

/** Lo que devuelve una fuente remota o la caché. */
export type FoundName = {
  nombre: string;
  marca?: string | null;
  categoria?: string | null;
  tamano?: string | null;
  /** Fuente original (para lo que viene de la caché). */
  fuente?: NameSource;
};

export type RemoteSource = { name: NameSource; lookup: (ean: string) => Promise<FoundName | null> };

export type IdentifySources = {
  learned?: Map<string, Learned>;
  known?: Record<string, { nombre: string; categoria: string }>;
  cache?: {
    read: (ean: string) => Promise<FoundName | null | undefined>;
    write?: (ean: string, found: FoundName & { fuente: NameSource }) => Promise<void>;
  };
  /** En orden: Open Food Facts, Los Precios, UPCitemdb. */
  remote?: RemoteSource[];
};

/**
 * Clave de lo aprendido para un ítem: su EAN si es válido; si no, la tienda +
 * la descripción original normalizada.
 *   learnedKey({ ean: "7700304448241" }, "D1")           -> "7700304448241"
 *   learnedKey({ sourceText: "BARQUILLOS SU" }, "D1")    -> "D1|BARQUILLOS SU"
 */
export function learnedKey(
  item: Pick<ReceiptItem, "ean" | "sourceText" | "name">,
  store: string | null,
): string {
  if (item.ean) return item.ean;
  const text = normalizeName(item.sourceText ?? item.name).replace(/\s+/g, " ").trim();
  return `${normalizeName(store ?? "").trim()}|${text}`;
}

/** Aplica un nombre encontrado a un ítem: nombre + tamaño + marca y categoría por reglas propias. */
function applyFound(item: ReceiptItem, f: FoundName, source: NameSource, trusted: boolean): ReceiptItem {
  const size = f.tamano && !f.nombre.toLowerCase().includes(f.tamano.toLowerCase()) ? ` ${f.tamano}` : "";
  const brand = f.marca && !f.nombre.toLowerCase().includes(f.marca.toLowerCase()) ? ` · ${f.marca}` : "";
  const full = `${f.nombre}${size}${brand}`.trim();
  const name = full.charAt(0).toUpperCase() + full.slice(1);
  // Las reglas colombianas (sobre el nombre encontrado + la descripción de la
  // factura) mandan sobre la categoría en inglés de las APIs. Ej.: OFF dice
  // "Wheat flours" para unas tortillas -> sería Granos; las reglas: Panadería.
  // Lo recordado y lo conocido ya traen su categoría.
  const ours = guessCategory(`${f.nombre} ${item.name}`);
  const category = trusted && f.categoria
    ? f.categoria
    : ours !== "Otros"
      ? ours
      : f.categoria && f.categoria !== "Otros"
        ? f.categoria
        : item.category;
  return {
    ...item,
    name,
    category,
    days: estimateDays(`${f.nombre} ${item.name}`, category),
    lowConfidence: category === "Otros" || !!item.qtyMismatch,
    nameSource: source,
  };
}

/**
 * Identifica todos los ítems de la factura con las fuentes dadas.
 * Se detiene en la primera fuente que responda; si una falla (sin red, límite
 * de UPCitemdb…) pasa a la siguiente sin romper. Pasado `deadlineMs`, lo que
 * falte se queda con el nombre de la factura.
 *
 *   await identifyReceipt(receipt, { learned, known: EAN_CONOCIDOS, cache, remote },
 *     { onProgress: (n, total) => setMensaje(`Identificando ${n} de ${total}…`) })
 *   // -> { receipt (con nameSource por ítem), stats: { Conocido: 8, … } }
 */
export async function identifyReceipt(
  receipt: ParsedReceipt,
  sources: IdentifySources,
  {
    deadlineMs = 25_000,
    onProgress,
  }: { deadlineMs?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ receipt: ParsedReceipt; stats: Record<NameSource, number> }> {
  const start = Date.now();
  const stats: Record<NameSource, number> = {
    Recordado: 0, Conocido: 0, "Caché": 0, "Open Food Facts": 0, "Los Precios": 0, UPCitemdb: 0, Factura: 0,
  };
  const items = [...receipt.items];
  const total = items.length;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // 1) Recordado (por EAN o por "TIENDA|TEXTO")
    const l = sources.learned?.get(learnedKey(item, receipt.store));
    if (l) {
      items[i] = {
        ...applyFound(item, { nombre: l.nombre, categoria: l.categoria }, "Recordado", true),
        fromLearned: true,
        ...(l.ubicacion ? { learnedLocation: l.ubicacion } : {}),
      };
      stats.Recordado++;
      tick();
      continue;
    }
    if (!item.ean) {
      stats.Factura++;
      tick();
      continue;
    }
    // 2) Conocido (diccionario local)
    const k = sources.known?.[item.ean];
    if (k) {
      items[i] = applyFound(item, { nombre: k.nombre, categoria: k.categoria }, "Conocido", true);
      stats.Conocido++;
      tick();
      continue;
    }
    if (Date.now() - start > deadlineMs) {
      stats.Factura++;
      tick();
      continue;
    }
    // 3) Caché
    const cached = await sources.cache?.read(item.ean).catch(() => undefined);
    if (cached) {
      items[i] = applyFound(item, cached, cached.fuente ?? "Caché", false);
      stats[cached.fuente ?? "Caché"]++;
      tick();
      continue;
    }
    // 4-6) Fuentes remotas en orden
    let hit = false;
    for (const src of sources.remote ?? []) {
      if (Date.now() - start > deadlineMs) break;
      try {
        const f = await src.lookup(item.ean);
        if (f && f.nombre?.trim()) {
          items[i] = applyFound(item, f, src.name, false);
          stats[src.name]++;
          await sources.cache?.write?.(item.ean, { ...f, fuente: src.name }).catch(() => {});
          hit = true;
          break;
        }
      } catch {
        // sin red, límite diario de UPCitemdb, error del servidor: siguiente fuente
      }
    }
    // 7) Nombre limpio de la factura
    if (!hit) stats.Factura++;
    tick();
  }
  return { receipt: { ...receipt, items }, stats };
}
