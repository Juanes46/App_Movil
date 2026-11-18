import { isValidEan } from "@/utils/ean";
import { LookupError } from "./lookupErrors";
import { getLpItem, type LpResult, type StorePrice } from "./losPrecios";
import { getOffProduct, type OffProduct } from "./openFoodFacts";
import { readCache, saveImage, writeCache } from "./productCache";

export { LookupError } from "./lookupErrors";
export type { StorePrice } from "./losPrecios";

export type LookupResult = {
  ean: string;
  nombre: string;
  marca: string | null;
  /** Una de las categorías de la app (Lácteos, Bebidas…). */
  categoria: string;
  tamano: string | null;
  /** Ruta local de la imagen (Open Food Facts) o null para usar placeholder. */
  imagen: string | null;
  /** Precios de referencia de Los Precios (otras ciudades), si hay. */
  precios?: StorePrice[];
  /** Por qué no hay precio, si Los Precios falló (llave inválida, límite…). */
  avisoPrecio?: string;
  fuente: "Open Food Facts" | "Los Precios" | "Open Food Facts + Los Precios";
};

/** Categorías de Open Food Facts (inglés o español) -> categorías de la app. */
const CATEGORY_RULES: [RegExp, string][] = [
  [/milk|leche|dair|lácte|lacte|yogur|chees|queso|butter|mantequilla/i, "Lácteos"],
  [/bread|pan\b|panader|bakery|biscuit|galleta|cake/i, "Panadería"],
  [/canned|enlatad|conserva|tuna|atún|atun/i, "Enlatados"],
  [/meat|carne|pollo|chicken|beef|pork|cerdo|sausage|salchich|fish|pescado/i, "Carnes"],
  [/fruit|fruta|vegetable|verdura|hortaliza/i, "Frutas y verduras"],
  [/beverage|bebida|drink|juice|jugo|soda|water|agua|coffee|café|tea\b/i, "Bebidas"],
  [/cereal|grain|grano|rice|arroz|pasta|legum|bean|frijol|lenteja|flour|harina/i, "Granos"],
];

export function mapCategory(text: string | null | undefined): string {
  if (!text) return "Otros";
  // OFF ordena de lo general a lo específico: se revisa la más específica primero.
  const parts = text.split(",").map((s) => s.trim()).reverse();
  for (const part of parts)
    for (const [re, name] of CATEGORY_RULES) if (re.test(part)) return name;
  return "Otros";
}

const clean = (s?: string | null) => (s && s.trim() ? s.trim() : null);

async function combine(
  ean: string,
  off: OffProduct | null,
  lp: LpResult | null,
  lpError: LookupError | null,
): Promise<LookupResult | null> {
  const nombre = clean(off?.product_name) ?? clean(lp?.nombre);
  if (!nombre) return null;
  const marca = clean(off?.brands?.split(",")[0]) ?? clean(lp?.marca);
  const imageUrl = clean(off?.image_front_url);
  const precios = lp?.precios.length ? lp.precios : undefined;
  return {
    ean,
    nombre,
    marca,
    // Si OFF no clasifica, se intenta con el nombre (de OFF o Los Precios).
    categoria:
      mapCategory(off?.categories) !== "Otros"
        ? mapCategory(off?.categories)
        : mapCategory(nombre),
    tamano: clean(off?.quantity) ?? lp?.tamano ?? null,
    // Nunca se usa la imagen de Los Precios (no es parte de su API).
    imagen: imageUrl ? await saveImage(ean, imageUrl) : null,
    precios,
    avisoPrecio: lpError?.message,
    fuente: off && lp ? "Open Food Facts + Los Precios" : off ? "Open Food Facts" : "Los Precios",
  };
}

/**
 * Busca un producto por EAN-13 o EAN-8.
 * 1) Caché local. 2) Open Food Facts (nombre, marca, categoría, imagen).
 * 3) Los Precios (precios y lo que falte). El precio es opcional: si Los
 * Precios falla y OFF sí encontró el producto, se devuelve sin precio.
 *
 *   await buscarPorEAN("7702001114054")
 *   // { nombre: "Leche Actilife", marca: "Alpina", categoria: "Lácteos",
 *   //   tamano: "1 l", imagen: "file:///.../imagenes/7702001114054.jpg",
 *   //   precios: undefined, fuente: "Open Food Facts" }
 *
 * Lanza LookupError con mensaje en español (sin internet, no encontrado,
 * límite excedido, llave inválida, servicio caído, código inválido).
 */
export async function buscarPorEAN(
  rawEan: string,
  { force = false } = {},
): Promise<LookupResult> {
  const ean = rawEan.replace(/\D/g, "");
  if (!isValidEan(ean)) throw new LookupError("codigo_invalido");

  if (!force) {
    const cached = await readCache<LookupResult>(ean).catch(() => undefined);
    if (cached === null) throw new LookupError("no_encontrado");
    if (cached) return cached;
  }

  let offError: LookupError | null = null;
  const off = await getOffProduct(ean).catch((e) => {
    if (!(e instanceof LookupError)) throw e;
    offError = e;
    return null;
  });
  // Sin internet no tiene sentido intentar la segunda API.
  if (offError && (offError as LookupError).code === "sin_internet") throw offError;

  let lpError: LookupError | null = null;
  const lp = await getLpItem(ean).catch((e) => {
    if (!(e instanceof LookupError)) throw e;
    lpError = e;
    return null;
  });

  const result = await combine(ean, off, lp, lpError);
  if (result) {
    // Si Los Precios falló, no se guarda: la próxima vez se reintenta el precio.
    if (!lpError) await writeCache(ean, result).catch(() => {});
    return result;
  }
  // Ninguna lo encontró: si alguna falló, se informa ese error (no es seguro
  // que el producto no exista); si no, se guarda en caché como no encontrado.
  if (offError) throw offError;
  if (lpError) throw lpError;
  await writeCache(ean, null).catch(() => {});
  throw new LookupError("no_encontrado");
}
