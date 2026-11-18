import { useSyncExternalStore } from "react";
import { getDb } from "./productStore";
export type ShoppingItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  done: boolean;
};
let items: ShoppingItem[] = [];
let error: string | null = null;
let ready = false;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());
async function database() {
  const db = await getDb();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS compras (id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL, categoria TEXT NOT NULL, cantidad INTEGER NOT NULL, comprado INTEGER NOT NULL DEFAULT 0)",
  );
  return db;
}
async function reload() {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: string;
    nombre: string;
    categoria: string;
    cantidad: number;
    comprado: number;
  }>("SELECT * FROM compras ORDER BY rowid");
  items = rows.map((r) => ({
    id: r.id,
    name: r.nombre,
    category: r.categoria,
    quantity: r.cantidad,
    done: !!r.comprado,
  }));
  ready = true;
  error = null;
  emit();
}
export function retryShopping() {
  reload().catch((e) => {
    error = String(e);
    ready = false;
    emit();
  });
}
retryShopping();
/** Pull-to-refresh: recarga sin vaciar la lista; devuelve false si falla. */
export async function refreshShopping(): Promise<boolean> {
  try {
    await reload();
    return true;
  } catch (e) {
    error = String(e);
    emit();
    return false;
  }
}
export function useShopping() {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}
export function useShoppingError() {
  return useSyncExternalStore(
    subscribe,
    () => error,
    () => error,
  );
}
export function useShoppingReady() {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => ready,
  );
}
export async function addShopping(input: Omit<ShoppingItem, "id" | "done">[]) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const item of input)
      await db.runAsync(
        "INSERT INTO compras (id, nombre, categoria, cantidad, comprado) VALUES (?, ?, ?, ?, 0)",
        [
          Date.now() + "-" + Math.random().toString(36).slice(2),
          item.name.trim(),
          item.category,
          item.quantity,
        ],
      );
  });
  await reload();
}
export async function toggleShopping(item: ShoppingItem) {
  const db = await database();
  await db.runAsync("UPDATE compras SET comprado = ? WHERE id = ?", [
    item.done ? 0 : 1,
    item.id,
  ]);
  await reload();
}
