import { useSyncExternalStore } from "react";
import { getDb } from "./productStore";

/* ------------------------------------------------------------------ */
/*  Historial de lo que sale de la despensa (para medir desperdicio)    */
/*  Tabla historial (id, nombre, categoria, motivo, fecha).             */
/*  motivo: "consumido" | "botado". "Lo eliminé por error" no se guarda.*/
/* ------------------------------------------------------------------ */

export type Motivo = "consumido" | "botado" | "error";
export type HistoryEvent = { id: string; nombre: string; categoria: string; motivo: Motivo; fecha: string };

export type MonthStats = {
  consumidos: number;
  botados: number;
  /** % aprovechado (0-100), o null si no hay datos este mes. */
  aprovechado: number | null;
  /** Categorías que más se botan este mes: [["Lácteos", 3], …] (máx. 3). */
  topBotados: [string, number][];
};

let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

async function db() {
  const d = await getDb();
  await d.execAsync(
    "CREATE TABLE IF NOT EXISTS historial (id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL, categoria TEXT NOT NULL, motivo TEXT NOT NULL, fecha TEXT NOT NULL)",
  );
  return d;
}

/**
 * Registra por qué salió un producto. "error" no cuenta y no se guarda.
 *   await recordEvent({ name: "Leche", category: "Lácteos" }, "botado")
 */
export async function recordEvent(
  product: { name: string; category: string },
  motivo: Motivo,
  fecha: Date = new Date(),
): Promise<void> {
  if (motivo === "error") return;
  const d = await db();
  await d.runAsync("INSERT INTO historial (id, nombre, categoria, motivo, fecha) VALUES (?, ?, ?, ?, ?)", [
    `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product.name,
    product.category,
    motivo,
    fecha.toISOString(),
  ]);
  emit();
}

/**
 * Estadísticas del mes de `ref`.
 *   1 consumido + 1 botado -> { consumidos: 1, botados: 1, aprovechado: 50, topBotados: [["Lácteos", 1]] }
 */
export async function monthStats(ref: Date = new Date()): Promise<MonthStats> {
  const d = await db();
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).toISOString();
  const rows = await d.getAllAsync<{ categoria: string; motivo: string }>(
    "SELECT categoria, motivo FROM historial WHERE fecha >= ? AND fecha < ?",
    [from, to],
  );
  const consumidos = rows.filter((r) => r.motivo === "consumido").length;
  const botados = rows.filter((r) => r.motivo === "botado").length;
  const byCat = new Map<string, number>();
  for (const r of rows) if (r.motivo === "botado") byCat.set(r.categoria, (byCat.get(r.categoria) ?? 0) + 1);
  const topBotados = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const total = consumidos + botados;
  return {
    consumidos,
    botados,
    aprovechado: total ? Math.round((consumidos / total) * 100) : null,
    topBotados,
  };
}

/** Lo que salió de la despensa en los últimos `days` días (para sugerir reponerlo). */
export async function recentEvents(days = 30): Promise<HistoryEvent[]> {
  const d = await db();
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  return d.getAllAsync<HistoryEvent>(
    "SELECT id, nombre, categoria, motivo, fecha FROM historial WHERE fecha >= ? ORDER BY fecha DESC",
    [from],
  );
}

/** Número que cambia con cada evento (para volver a calcular las estadísticas en pantalla). */
export function useHistoryVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => version,
    () => version,
  );
}

export function notifyHistoryChanged() {
  emit();
}
