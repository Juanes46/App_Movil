import type { ParsedReceipt } from "@/utils/receipt";
import { identifyReceipt, type Learned } from "@/services/receiptIdentify";

export { learnedKey, type Learned } from "@/services/receiptIdentify";

/** Lo que se necesita del resultado de buscarPorEAN (ver services/productLookup). */
export type EanLookup = (ean: string) => Promise<{
  nombre: string;
  marca: string | null;
  categoria: string;
  tamano: string | null;
}>;

/**
 * Versión simple de la identificación (ver receiptIdentify): nombres
 * recordados y luego una sola búsqueda por EAN (buscarPorEAN). La lectura de
 * facturas de la app usa identifyReceipt con la cadena completa.
 *
 *   await enrichReceipt(receipt, buscarPorEAN, { learned })
 *   // EAN aprendido como "Barquillos de vainilla" -> ese nombre, sin llamar a la API
 */
export async function enrichReceipt(
  receipt: ParsedReceipt,
  lookup: EanLookup,
  {
    deadlineMs = 25_000,
    onProgress,
    learned,
  }: {
    deadlineMs?: number;
    onProgress?: (done: number, total: number) => void;
    learned?: Map<string, Learned>;
  } = {},
): Promise<{ receipt: ParsedReceipt; found: number; remembered: number }> {
  const { receipt: out, stats } = await identifyReceipt(
    receipt,
    { learned, remote: [{ name: "Open Food Facts", lookup }] },
    { deadlineMs, onProgress },
  );
  return { receipt: out, found: stats["Open Food Facts"], remembered: stats.Recordado };
}
