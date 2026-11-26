import { notifyHistoryChanged } from "./historyStore";
import { getDb, refreshProducts } from "./productStore";
import { loadAjustes } from "./settingsStore";
import { refreshShopping } from "./shoppingStore";

/**
 * "Borrar todos los datos": deja la base vacía sin cerrar la app (despensa,
 * lista de compras, historial, ajustes, nombres recordados y caché). No se
 * borran tablas, solo sus filas, y no se vuelven a cargar los ejemplos.
 *   await clearAllData()  // Mi despensa y Compras quedan vacías; Perfil vuelve a los valores por defecto
 */
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  await db.withTransactionAsync(async () => {
    for (const { name } of tables) await db.execAsync(`DELETE FROM "${name.replace(/"/g, "")}"`);
  });
  await Promise.all([refreshProducts(), refreshShopping(), loadAjustes()]);
  notifyHistoryChanged();
}
