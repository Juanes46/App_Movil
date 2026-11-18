import { ENV } from "@/config/env";
import { toLosPreciosEan13 } from "@/utils/ean";
import { fetchWithTimeout, LookupError } from "./lookupErrors";
import { createRateLimiter } from "./rateLimiter";

/* ------------------------------------------------------------------ */
/*  Los Precios (https://losprecios.co/información/api)                 */
/*  GET {base}/ítem/detalles?ClaveAPI=..&CódigoEAN13=..                 */
/*  Límite: máximo 1 solicitud por segundo.                             */
/*  Cobertura: Bogotá (1), Medellín (2), Cali (3), Barranquilla (4).    */
/*  Las imágenes no son parte de la API: no se usan en la app.          */
/* ------------------------------------------------------------------ */

// El servidor rechaza (ErrorID 3) llamadas a poco más de 1 s: se deja margen.
const limiter = createRateLimiter(1, 1500);

/** Campos tal como los documenta Los Precios (con tildes). */
type LpStore = { Tienda: string; TiendaID: number; Precio: number; Fecha: string };
type LpItem = {
  Producto: string;
  Marca: string | null;
  Tamaño: number | null;
  Unidad: string | null;
  CódigoEAN13: string | null;
  ÍtemsTiendas: LpStore[];
};
type LpResponse = {
  Resultado: string;
  Datos: LpItem | null;
  ErrorID: number;
  Mensaje: string | null;
};

export type StorePrice = { tienda: string; precio: number; fecha: string };
export type LpResult = {
  nombre: string;
  marca: string | null;
  tamano: string | null;
  precios: StorePrice[];
};

export const losPreciosConfigured = () => !!(ENV.losPreciosApiKey && ENV.losPreciosBaseUrl);

/**
 * Ítem por código de barras, o null si Los Precios no lo tiene.
 *   await getLpItem("7702177016862")
 *   // { nombre: "Leche Larga Vida Descremada en Bolsa", marca: "Alquería",
 *   //   tamano: "7800 ml", precios: [{ tienda: "Carulla", precio: 25850, fecha: "2019-12-11" }] }
 */
export async function getLpItem(ean: string): Promise<LpResult | null> {
  try {
    return await requestItem(ean);
  } catch (e) {
    // "Solicitud muy frecuente": se espera otro turno de la cola y se reintenta una vez.
    if (e instanceof LookupError && e.code === "limite") return requestItem(ean);
    throw e;
  }
}

async function requestItem(ean: string): Promise<LpResult | null> {
  if (!losPreciosConfigured()) return null;
  const url =
    `${ENV.losPreciosBaseUrl}/${encodeURIComponent("ítem")}/detalles` +
    `?${encodeURIComponent("ClaveAPI")}=${encodeURIComponent(ENV.losPreciosApiKey)}` +
    `&${encodeURIComponent("CódigoEAN13")}=${encodeURIComponent(toLosPreciosEan13(ean))}`;
  const res = await limiter.schedule(() => fetchWithTimeout(url));
  if (res.status >= 500) throw new LookupError("servicio_caido");
  let body: LpResponse;
  try {
    body = await res.json();
  } catch {
    throw new LookupError("servicio_caido");
  }
  switch (body.ErrorID) {
    case 0:
      break;
    case 1:
    case 12: // 1 = clave incorrecta, 12 = clave desactivada
      throw new LookupError("llave_invalida");
    case 3: // solicitud muy frecuente
      throw new LookupError("limite");
    case 5:
    case 6: // ítem no existente / EAN no encontrado
      return null;
    default:
      throw new LookupError("servicio_caido");
  }
  const d = body.Datos;
  if (!d) return null;
  return {
    nombre: d.Producto,
    marca: d.Marca,
    tamano: d.Tamaño ? `${Number(d.Tamaño)} ${d.Unidad ?? ""}`.trim() : null,
    precios: (d.ÍtemsTiendas ?? [])
      .map((t) => ({ tienda: t.Tienda, precio: Number(t.Precio), fecha: t.Fecha }))
      .sort((a, b) => a.precio - b.precio),
  };
}
