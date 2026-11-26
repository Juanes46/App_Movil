import { useSyncExternalStore } from "react";
import { setSoonDays, SOON_DAYS } from "@/utils/expiration";
import { getDb } from "./productStore";

/* ------------------------------------------------------------------ */
/*  Ajustes del usuario (tabla ajustes: clave TEXT PK, valor TEXT)      */
/*  Todo lo que se cambia en Perfil se guarda aquí y se mantiene al     */
/*  cerrar la app.                                                      */
/* ------------------------------------------------------------------ */

export type Ajustes = {
  nombre: string;
  ciudad: string;
  /** Días de anticipación para "Próximo a vencer": 3, 5 o 7. */
  diasAnticipacion: number;
  /** Aviso diario de vencimientos. */
  alertas: boolean;
  /** Hora del aviso diario (0-23). */
  horaAlerta: number;
  /** Aviso semanal si la lista de compras tiene pendientes. */
  recordatorioCompras: boolean;
};

export const DEFAULT_AJUSTES: Ajustes = {
  nombre: "",
  ciudad: "Tunja",
  diasAnticipacion: SOON_DAYS,
  alertas: false,
  horaAlerta: 8,
  recordatorioCompras: false,
};

/** Ciudades con precios en Los Precios. */
export const CIUDADES_CON_PRECIOS = ["Bogotá", "Medellín", "Cali", "Barranquilla"];
export const CIUDADES = ["Tunja", "Bogotá", "Medellín", "Cali", "Barranquilla", "Otra"];

let ajustes: Ajustes = { ...DEFAULT_AJUSTES };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

async function db() {
  const d = await getDb();
  await d.execAsync("CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY NOT NULL, valor TEXT)");
  return d;
}

/** Texto guardado -> valor del tipo de cada ajuste. */
function decode<K extends keyof Ajustes>(key: K, raw: string | null): Ajustes[K] {
  const def = DEFAULT_AJUSTES[key];
  if (raw === null) return def;
  if (typeof def === "boolean") return (raw === "1") as Ajustes[K];
  if (typeof def === "number") {
    const n = Number(raw);
    return (Number.isFinite(n) ? n : def) as Ajustes[K];
  }
  return raw as Ajustes[K];
}

/** Lee todos los ajustes de la base (también sirve para "recargar"). */
export async function loadAjustes(): Promise<Ajustes> {
  const d = await db();
  const rows = await d.getAllAsync<{ clave: string; valor: string | null }>("SELECT clave, valor FROM ajustes");
  const next = { ...DEFAULT_AJUSTES };
  for (const r of rows)
    if (r.clave in next) (next as Record<string, unknown>)[r.clave] = decode(r.clave as keyof Ajustes, r.valor);
  ajustes = next;
  loaded = true;
  setSoonDays(ajustes.diasAnticipacion);
  emit();
  return ajustes;
}

/**
 * Guarda un ajuste y avisa a las pantallas.
 *   await setAjuste("diasAnticipacion", 3)  // "Próximo a vencer" pasa a 3 días en toda la app
 */
export async function setAjuste<K extends keyof Ajustes>(key: K, value: Ajustes[K]): Promise<void> {
  const d = await db();
  const raw = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  await d.runAsync("INSERT OR REPLACE INTO ajustes (clave, valor) VALUES (?, ?)", [key, raw]);
  ajustes = { ...ajustes, [key]: value };
  if (key === "diasAnticipacion") setSoonDays(Number(value));
  emit();
}

export function getAjustes(): Ajustes {
  return ajustes;
}

/** Ajustes actuales; la pantalla se vuelve a dibujar cuando cambian. */
export function useAjustes(): Ajustes & { loaded: boolean } {
  const a = useSyncExternalStore(subscribe, () => ajustes, () => ajustes);
  return { ...a, loaded };
}

export function onAjustesChange(fn: () => void): () => void {
  return subscribe(fn);
}

/** Iniciales para el avatar: "Samuel David Rodríguez" -> "SR"; "" -> "?" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Carga inicial
loadAjustes().catch(() => {});
