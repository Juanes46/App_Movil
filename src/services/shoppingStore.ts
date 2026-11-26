import { useSyncExternalStore } from "react";
import { normalizeKey } from "@/utils/shareText";
import { addProducts, getDb, type Product } from "./productStore";

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

type Row = { id: string; nombre: string; categoria: string; cantidad: number; comprado: number };

async function database() {
  const db = await getDb();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS compras (id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL, categoria TEXT NOT NULL, cantidad INTEGER NOT NULL, comprado INTEGER NOT NULL DEFAULT 0)",
  );
  return db;
}
async function reload() {
  const db = await database();
  const rows = await db.getAllAsync<Row>("SELECT * FROM compras ORDER BY rowid");
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
  return useSyncExternalStore(subscribe, () => items, () => items);
}
export function useShoppingError() {
  return useSyncExternalStore(subscribe, () => error, () => error);
}
export function useShoppingReady() {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}
export function getShopping(): ShoppingItem[] {
  return items;
}
export function onShoppingChange(fn: () => void): () => void {
  return subscribe(fn);
}

const newId = () => Date.now() + "-" + Math.random().toString(36).slice(2);

/**
 * Agrega productos a la lista. Si ya hay uno PENDIENTE con el mismo nombre
 * (normalizado), suma la cantidad en vez de crear otra fila.
 *   addShopping([{ name: "Leche", category: "Lácteos", quantity: 1 }])
 *   addShopping([{ name: "LECHE", category: "Lácteos", quantity: 2 }])  // una sola fila: Leche ×3
 */
export async function addShopping(input: Omit<ShoppingItem, "id" | "done">[]) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const item of input) {
      const key = normalizeKey(item.name);
      const pending = await db.getAllAsync<Row>("SELECT * FROM compras WHERE comprado = 0");
      const same = pending.find((r) => normalizeKey(r.nombre) === key);
      if (same)
        await db.runAsync("UPDATE compras SET cantidad = cantidad + ? WHERE id = ?", [item.quantity, same.id]);
      else
        await db.runAsync(
          "INSERT INTO compras (id, nombre, categoria, cantidad, comprado) VALUES (?, ?, ?, ?, 0)",
          [newId(), item.name.trim(), item.category, item.quantity],
        );
    }
  });
  await reload();
}

export async function toggleShopping(item: ShoppingItem) {
  const db = await database();
  await db.runAsync("UPDATE compras SET comprado = ? WHERE id = ?", [item.done ? 0 : 1, item.id]);
  await reload();
}

/** Cambia la cantidad o la categoría de un producto de la lista. */
export async function updateShopping(id: string, values: { quantity?: number; category?: string }) {
  const db = await database();
  if (values.quantity !== undefined)
    await db.runAsync("UPDATE compras SET cantidad = ? WHERE id = ?", [Math.max(1, values.quantity), id]);
  if (values.category !== undefined)
    await db.runAsync("UPDATE compras SET categoria = ? WHERE id = ?", [values.category, id]);
  await reload();
}

/** Elimina un producto y lo devuelve (para "Deshacer"). */
export async function removeShopping(id: string): Promise<ShoppingItem | null> {
  const item = items.find((i) => i.id === id) ?? null;
  const db = await database();
  await db.runAsync("DELETE FROM compras WHERE id = ?", [id]);
  await reload();
  return item;
}

/** "Deshacer": vuelve a poner el producto eliminado, con su mismo id y estado. */
export async function restoreShopping(item: ShoppingItem) {
  const db = await database();
  await db.runAsync(
    "INSERT OR REPLACE INTO compras (id, nombre, categoria, cantidad, comprado) VALUES (?, ?, ?, ?, ?)",
    [item.id, item.name, item.category, item.quantity, item.done ? 1 : 0],
  );
  await reload();
}

/** Vaciar comprados (quedan los pendientes). */
export async function clearDone() {
  const db = await database();
  await db.runAsync("DELETE FROM compras WHERE comprado = 1");
  await reload();
}

/** Vaciar lista (todo). */
export async function clearShopping() {
  const db = await database();
  await db.runAsync("DELETE FROM compras");
  await reload();
}

export type FinishInput = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  expiresOn: Date;
  location: string;
  estimated: boolean;
};

/**
 * Terminar compra: los comprados pasan a la despensa (con fecha estimada y
 * ubicación) y se quitan de la lista. Los pendientes se quedan.
 *   await finishShopping([3 comprados con fecha y ubicación])  // -> 3 (productos nuevos en la despensa)
 */
export async function finishShopping(bought: FinishInput[]): Promise<number> {
  if (!bought.length) return 0;
  const toPantry: Omit<Product, "id">[] = bought.map((b) => ({
    name: b.name.trim(),
    category: b.category,
    quantity: b.quantity,
    expiresOn: b.expiresOn,
    location: b.location,
    estimated: b.estimated,
    unit: "un",
  }));
  await addProducts(toPantry);
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const b of bought) await db.runAsync("DELETE FROM compras WHERE id = ?", [b.id]);
  });
  await reload();
  return bought.length;
}

/**
 * Al guardar una factura: los pendientes de la lista que coincidan por nombre
 * (normalizado) se marcan como comprados. Devuelve cuántos se marcaron.
 *   await markBoughtByNames(["Leche entera", "Pan tajado"])  // -> 2
 */
export async function markBoughtByNames(names: string[]): Promise<number> {
  const keys = new Set(names.map(normalizeKey));
  const db = await database();
  const pending = await db.getAllAsync<Row>("SELECT * FROM compras WHERE comprado = 0");
  const hits = pending.filter((r) => {
    const k = normalizeKey(r.nombre);
    // Coincide si el nombre de la lista está dentro del de la factura ("Leche" ⊂ "Leche entera colanta").
    return keys.has(k) || [...keys].some((n) => n.startsWith(k + " ") || n === k);
  });
  for (const r of hits) await db.runAsync("UPDATE compras SET comprado = 1 WHERE id = ?", [r.id]);
  if (hits.length) await reload();
  return hits.length;
}
