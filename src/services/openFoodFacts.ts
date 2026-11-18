import { ENV } from "@/config/env";
import { fetchWithTimeout, LookupError } from "./lookupErrors";
import { createRateLimiter } from "./rateLimiter";

/* ------------------------------------------------------------------ */
/*  Open Food Facts (sin llave). Datos bajo licencia ODbL.              */
/*  Límites: 15 consultas/min de producto y 10/min de búsqueda.         */
/*  No trae fecha de vencimiento.                                       */
/* ------------------------------------------------------------------ */

const BASE = "https://world.openfoodfacts.org/api/v2";
const FIELDS = "product_name,brands,categories,image_front_url,quantity";

const productLimiter = createRateLimiter(15, 60_000);
/** Para búsquedas por texto (aún no se usan en la app). */
export const offSearchLimiter = createRateLimiter(10, 60_000);

export type OffProduct = {
  product_name?: string;
  brands?: string;
  categories?: string;
  image_front_url?: string;
  quantity?: string;
};

/**
 * Producto por código de barras, o null si no existe en Open Food Facts.
 *   await getOffProduct("7702001114054")
 *   // { product_name: "Leche Actilife", brands: "Alpina", quantity: "1 l", ... }
 */
export async function getOffProduct(ean: string): Promise<OffProduct | null> {
  const res = await productLimiter.schedule(() =>
    fetchWithTimeout(`${BASE}/product/${encodeURIComponent(ean)}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": ENV.offUserAgent, Accept: "application/json" },
    }),
  );
  if (res.status === 429) throw new LookupError("limite");
  // Si el producto no existe, OFF responde 404 con {"status":0}.
  if (res.status >= 500) throw new LookupError("servicio_caido");
  let body: { status?: number; product?: OffProduct };
  try {
    body = await res.json();
  } catch {
    throw new LookupError("servicio_caido");
  }
  return body.status === 1 && body.product ? body.product : null;
}
