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

export type OffUniversalProduct = OffProduct & {
  /** "food", "beauty" (Open Beauty Facts), "petfood" (Open Pet Food Facts) o "product" (Open Products Facts). */
  product_type?: string;
};

/**
 * Open Food Facts universal (API v3 con product_type=all): busca también en
 * Open Beauty Facts, Open Pet Food Facts y Open Products Facts (sigue la
 * redirección). Mismo User-Agent y el mismo límite de 15/min. Para facturas.
 *   await getOffUniversal("7700304930951")
 *   // { product_name: "Atún En Agua", brands: "Carlo Forte", categories: "Tunas", product_type: "food" }
 *   await getOffUniversal("7700304537648")  // -> null ("product_not_found")
 */
export async function getOffUniversal(ean: string): Promise<OffUniversalProduct | null> {
  const url =
    `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(ean)}` +
    `?product_type=all&fields=product_name,brands,categories,quantity,product_type`;
  const res = await productLimiter.schedule(() =>
    fetchWithTimeout(url, { headers: { "User-Agent": ENV.offUserAgent, Accept: "application/json" } }),
  );
  if (res.status === 429) throw new LookupError("limite");
  if (res.status >= 500) throw new LookupError("servicio_caido");
  let body: { status?: string; product?: OffUniversalProduct };
  try {
    body = await res.json();
  } catch {
    throw new LookupError("servicio_caido");
  }
  // v3: {"status":"success","product":{…}} o {"status":"failure", result.id "product_not_found"} (HTTP 404)
  return body.status === "success" && body.product?.product_name ? body.product : null;
}
