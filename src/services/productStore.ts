import * as SQLite from "expo-sqlite";
import { useSyncExternalStore } from "react";

import { addDays, fromISODate, toISODate } from "@/utils/expiration";
import { suggestLocation } from "@/utils/location";

export interface Product {
  id: string;
  name: string;
  category: string;
  expiresOn: Date;
  quantity?: number;
  location?: string;
  estimated?: boolean;
}

type Row = {
  id: string;
  nombre: string;
  categoria: string;
  fecha_vencimiento: string;
  cantidad?: number;
  ubicacion?: string;
  estimada?: number;
};
type Status = { ready: boolean; error: string | null };

/* ------------------------------------------------------------------ */
/*  Base de datos SQLite (Fase 1)                                      */
/*  Tabla `productos`: id, nombre, categoria, fecha_vencimiento        */
/* ------------------------------------------------------------------ */

const DB_NAME = "despensa.db";

// Datos de ejemplo: se cargan UNA sola vez, la primera vez que se abre la app.
function demoProducts(): Row[] {
  const today = new Date();
  const mk = (
    i: number,
    nombre: string,
    categoria: string,
    days: number,
  ): Row => ({
    id: `demo-${i}`,
    nombre,
    categoria,
    fecha_vencimiento: toISODate(addDays(today, days)),
  });
  return [
    mk(1, "Leche entera", "Lácteos", 3),
    mk(2, "Pan de molde", "Panadería", -2),
    mk(3, "Atún en agua", "Enlatados", 210),
    mk(4, "Yogur natural", "Lácteos", 9),
    mk(5, "Arroz", "Otros", 380),
    mk(6, "Pechuga de pollo", "Carnes", 1),
    mk(7, "Manzanas", "Frutas y verduras", -5),
  ];
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS productos (
          id TEXT PRIMARY KEY NOT NULL,
          nombre TEXT NOT NULL,
          categoria TEXT NOT NULL,
          fecha_vencimiento TEXT NOT NULL
        );
      `);

      // user_version = 0 significa "base recién creada": se siembran los ejemplos una vez.
      const v = await db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
      );
      if ((v?.user_version ?? 0) < 1) {
        await db.withTransactionAsync(async () => {
          for (const r of demoProducts()) {
            await db.runAsync(
              "INSERT OR IGNORE INTO productos (id, nombre, categoria, fecha_vencimiento) VALUES (?, ?, ?, ?)",
              [r.id, r.nombre, r.categoria, r.fecha_vencimiento],
            );
          }
          await db.execAsync("PRAGMA user_version = 1");
        });
      }
      const columns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(productos)",
      );
      for (const [name, definition] of [
        ["cantidad", "INTEGER NOT NULL DEFAULT 1"],
        ["ubicacion", "TEXT NOT NULL DEFAULT 'Alacena'"],
        ["estimada", "INTEGER NOT NULL DEFAULT 0"],
      ]) {
        if (!columns.some((column) => column.name === name)) {
          await db.execAsync(
            "ALTER TABLE productos ADD COLUMN " + name + " " + definition,
          );
        }
      }

      // Versión 2: antes todo quedaba en "Alacena" por defecto. Se recoloca
      // cada producto que estaba ahí según su nombre y categoría (una sola vez).
      const v2 = await db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
      );
      if ((v2?.user_version ?? 0) < 2) {
        const rows = await db.getAllAsync<{ id: string; nombre: string; categoria: string }>(
          "SELECT id, nombre, categoria FROM productos WHERE ubicacion = 'Alacena'",
        );
        await db.withTransactionAsync(async () => {
          for (const r of rows) {
            const place = suggestLocation(r.nombre, r.categoria);
            if (place !== "Alacena")
              await db.runAsync("UPDATE productos SET ubicacion = ? WHERE id = ?", [place, r.id]);
          }
          await db.execAsync("PRAGMA user_version = 2");
        });
      }
      return db;
    })();
    // Si falla, permite reintentar en la siguiente llamada.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------ */
/*  Estado en memoria (copia de la tabla) para que React se actualice  */
/* ------------------------------------------------------------------ */

let products: Product[] = [];
let status: Status = { ready: false, error: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toProduct(r: Row): Product | null {
  const expiresOn = fromISODate(r.fecha_vencimiento);
  return expiresOn
    ? {
        id: r.id,
        name: r.nombre,
        category: r.categoria,
        expiresOn,
        quantity: r.cantidad ?? 1,
        location: r.ubicacion ?? "Alacena",
        estimated: Boolean(r.estimada),
      }
    : null;
}

/** Vuelve a leer la tabla completa y avisa a las pantallas. */
async function reload() {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM productos ORDER BY fecha_vencimiento ASC",
  );
  products = rows.map(toProduct).filter((p): p is Product => p !== null);
  status = { ready: true, error: null };
  emit();
}

function fail(e: unknown) {
  status = { ready: false, error: e instanceof Error ? e.message : String(e) };
  emit();
}

// Carga inicial: arranca apenas se importa el módulo.
reload().catch(fail);

/** Reintenta la carga inicial (botón "Reintentar" si algo falló). */
export function retryLoad() {
  status = { ready: false, error: null };
  emit();
  reload().catch(fail);
}

/* ------------------------------------------------------------------ */
/*  API para las pantallas                                             */
/* ------------------------------------------------------------------ */

export function useProducts(): Product[] {
  return useSyncExternalStore(
    subscribe,
    () => products,
    () => products,
  );
}

export function useStoreStatus(): Status {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => status,
  );
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export async function addProduct(input: Omit<Product, "id">): Promise<Product> {
  const db = await getDb();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.runAsync(
    "INSERT INTO productos (id, nombre, categoria, fecha_vencimiento, cantidad, ubicacion, estimada) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      input.name,
      input.category,
      toISODate(input.expiresOn),
      input.quantity ?? 1,
      input.location ?? "Alacena",
      input.estimated ? 1 : 0,
    ],
  );
  await reload();
  return { ...input, id };
}

export async function updateProduct(
  id: string,
  input: Omit<Product, "id">,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE productos SET nombre = ?, categoria = ?, fecha_vencimiento = ?, cantidad = ?, ubicacion = ?, estimada = ? WHERE id = ?",
    [
      input.name,
      input.category,
      toISODate(input.expiresOn),
      input.quantity ?? 1,
      input.location ?? "Alacena",
      input.estimated ? 1 : 0,
      id,
    ],
  );
  await reload();
}

export async function removeProduct(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM productos WHERE id = ?", [id]);
  await reload();
}

/** Guarda los productos revisados de una factura en una sola transacción. */
export async function addProducts(input: Omit<Product, "id">[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const item of input) {
      const id = Date.now() + "-" + Math.random().toString(36).slice(2);
      await db.runAsync(
        "INSERT INTO productos (id, nombre, categoria, fecha_vencimiento, cantidad, ubicacion, estimada) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          item.name,
          item.category,
          toISODate(item.expiresOn),
          item.quantity ?? 1,
          item.location ?? "Alacena",
          item.estimated ? 1 : 0,
        ],
      );
    }
  });
  await reload();
}
