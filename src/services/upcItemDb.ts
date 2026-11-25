import { fetchWithTimeout, LookupError } from "./lookupErrors";
import { getDb } from "./productStore";
import { createRateLimiter } from "./rateLimiter";

/* ------------------------------------------------------------------ */
/*  UPCitemdb, plan gratis (sin llave): último intento al leer facturas */
/*  Límites: 100 consultas al día y 6 por minuto. El contador del día   */
/*  se guarda en SQLite (tabla contador_api); si se acaba, se salta     */
/*  sin error.                                                          */
/* ------------------------------------------------------------------ */

const DAILY_LIMIT = 100;
const limiter = createRateLimiter(6, 60_000);

const today = () => new Date().toISOString().slice(0, 10);

async function counterDb() {
  const db = await getDb();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS contador_api (api TEXT NOT NULL, dia TEXT NOT NULL, usados INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (api, dia))",
  );
  return db;
}

/** Consultas usadas hoy en UPCitemdb. */
export async function upcUsedToday(): Promise<number> {
  const db = await counterDb();
  const row = await db.getFirstAsync<{ usados: number }>(
    "SELECT usados FROM contador_api WHERE api = 'upcitemdb' AND dia = ?",
    [today()],
  );
  return row?.usados ?? 0;
}

async function addUse(n = 1) {
  const db = await counterDb();
  await db.runAsync(
    "INSERT INTO contador_api (api, dia, usados) VALUES ('upcitemdb', ?, ?) ON CONFLICT(api, dia) DO UPDATE SET usados = usados + ?",
    [today(), n, n],
  );
}

type UpcResponse = {
  code?: string;
  items?: { title?: string; brand?: string; category?: string; size?: string }[];
};

/**
 * Producto por código en UPCitemdb, o null si no está o si ya se usaron las
 * 100 consultas del día (también si el servidor responde "demasiado rápido").
 *   await getUpcItem("0012000161155") // { title: "Pepsi…", brand: "Pepsi", category: "Food, Beverages…" }
 */
export async function getUpcItem(
  ean: string,
): Promise<{ title: string; brand: string | null; category: string | null; size: string | null } | null> {
  if ((await upcUsedToday().catch(() => 0)) >= DAILY_LIMIT) return null; // se acabó el día: se salta
  const res = await limiter.schedule(() =>
    fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(ean)}`, {
      headers: { Accept: "application/json" },
    }),
  );
  await addUse().catch(() => {});
  if (res.status === 429) {
    // Límite del servidor: no se vuelve a intentar hoy.
    await addUse(DAILY_LIMIT).catch(() => {});
    return null;
  }
  if (res.status >= 500) throw new LookupError("servicio_caido");
  let body: UpcResponse;
  try {
    body = await res.json();
  } catch {
    throw new LookupError("servicio_caido");
  }
  if (body.code && body.code !== "OK") return null; // TOO_FAST, EXCEED_LIMIT, INVALID_UPC…
  const it = body.items?.[0];
  return it?.title
    ? { title: it.title, brand: it.brand || null, category: it.category || null, size: it.size || null }
    : null;
}
