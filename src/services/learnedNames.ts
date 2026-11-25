import type { ParsedReceipt } from "@/utils/receipt";
import { getDb } from "./productStore";
import { learnedKey, type Learned } from "./receiptLookup";

/* ------------------------------------------------------------------ */
/*  Nombres aprendidos: lo que el usuario corrigió en Revisar factura    */
/*  (o al editar un producto con EAN). La próxima factura con el mismo   */
/*  código lo usa sin consultar las APIs. Útil sobre todo con la marca   */
/*  propia de D1 (EAN 7700304…), que casi nunca está en las APIs.        */
/*                                                                       */
/*  nombres_aprendidos        (ean   PK): por código de barras           */
/*  nombres_aprendidos_texto  (clave PK): "D1|BARQUILLOS SU" sin EAN     */
/* ------------------------------------------------------------------ */

async function db() {
  const d = await getDb();
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS nombres_aprendidos (
      ean TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL, categoria TEXT NOT NULL,
      ubicacion TEXT, actualizado TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nombres_aprendidos_texto (
      clave TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL, categoria TEXT NOT NULL,
      ubicacion TEXT, actualizado TEXT NOT NULL
    );
  `);
  return d;
}

const isEanKey = (key: string) => /^\d{8,14}$/.test(key);

/** Lo aprendido para los ítems de una factura, por clave (EAN o "TIENDA|TEXTO"). */
export async function getLearnedFor(receipt: ParsedReceipt): Promise<Map<string, Learned>> {
  const out = new Map<string, Learned>();
  const keys = [...new Set(receipt.items.map((i) => learnedKey(i, receipt.store)))];
  if (!keys.length) return out;
  const d = await db();
  for (const key of keys) {
    const row = isEanKey(key)
      ? await d.getFirstAsync<Learned>(
          "SELECT nombre, categoria, ubicacion FROM nombres_aprendidos WHERE ean = ?",
          [key],
        )
      : await d.getFirstAsync<Learned>(
          "SELECT nombre, categoria, ubicacion FROM nombres_aprendidos_texto WHERE clave = ?",
          [key],
        );
    if (row) out.set(key, row);
  }
  return out;
}

export type LearnInput = { key: string; nombre: string; categoria: string; ubicacion?: string | null };

/**
 * Guarda (o actualiza) lo que el usuario corrigió.
 *   await saveLearned([{ key: "7700304448241", nombre: "Tortillas para fajitas", categoria: "Panadería", ubicacion: "Alacena" }])
 */
export async function saveLearned(entries: LearnInput[]): Promise<void> {
  if (!entries.length) return;
  const d = await db();
  const now = new Date().toISOString();
  await d.withTransactionAsync(async () => {
    for (const e of entries) {
      const table = isEanKey(e.key) ? "nombres_aprendidos (ean" : "nombres_aprendidos_texto (clave";
      await d.runAsync(
        `INSERT OR REPLACE INTO ${table}, nombre, categoria, ubicacion, actualizado) VALUES (?, ?, ?, ?, ?)`,
        [e.key, e.nombre.trim(), e.categoria, e.ubicacion ?? null, now],
      );
    }
  });
}

/** Todos los EAN recordados (permiten rescatar un código mal leído en la factura). */
export async function getAllLearnedEans(): Promise<Set<string>> {
  const d = await db();
  const rows = await d.getAllAsync<{ ean: string }>("SELECT ean FROM nombres_aprendidos");
  return new Set(rows.map((r) => r.ean));
}

/** Cuántos nombres hay recordados (para Perfil). */
export async function countLearned(): Promise<number> {
  const d = await db();
  const a = await d.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM nombres_aprendidos");
  const b = await d.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM nombres_aprendidos_texto");
  return (a?.n ?? 0) + (b?.n ?? 0);
}

/** Borra todos los nombres recordados (Perfil > Borrar nombres recordados). */
export async function clearLearned(): Promise<void> {
  const d = await db();
  await d.execAsync("DELETE FROM nombres_aprendidos; DELETE FROM nombres_aprendidos_texto;");
}
