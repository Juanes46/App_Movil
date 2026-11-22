import { normalizeName } from "@/utils/keywords";

export { COLORS } from "@/theme/colors";

export type Location = "Nevera" | "Congelador" | "Alacena";

/**
 * Categorías de la app: emoji, días estimados de vencimiento (para productos
 * que llegan por factura, que no trae la fecha) y ubicación sugerida.
 * Los días son provisionales: falta confirmarlos con el profesor.
 *
 * Los productos guardados con una categoría que ya no exista se siguen
 * mostrando: emojiFor devuelve 📦 y se usan 30 días / Alacena.
 */
export const CATEGORIES = [
  { name: "Lácteos", emoji: "🥛", days: 7, location: "Nevera" },
  { name: "Carnes", emoji: "🥩", days: 3, location: "Congelador" },
  { name: "Frutas y verduras", emoji: "🥦", days: 5, location: "Nevera" },
  { name: "Panadería", emoji: "🍞", days: 5, location: "Alacena" },
  { name: "Granos", emoji: "🍚", days: 180, location: "Alacena" },
  { name: "Enlatados", emoji: "🥫", days: 365, location: "Alacena" },
  { name: "Condimentos y aceites", emoji: "🧂", days: 365, location: "Alacena" },
  { name: "Snacks y dulces", emoji: "🍫", days: 120, location: "Alacena" },
  { name: "Bebidas", emoji: "🧃", days: 90, location: "Alacena" },
  { name: "Congelados", emoji: "🧊", days: 90, location: "Congelador" },
  { name: "Aseo del hogar", emoji: "🧴", days: 730, location: "Alacena" },
  { name: "Cuidado personal", emoji: "🧼", days: 730, location: "Alacena" },
  { name: "Mascotas", emoji: "🐾", days: 365, location: "Alacena" },
  { name: "Otros", emoji: "📦", days: 30, location: "Alacena" },
] as const satisfies readonly { name: string; emoji: string; days: number; location: Location }[];

export type CategoryName = (typeof CATEGORIES)[number]["name"];

export function emojiFor(category: string): string {
  return CATEGORIES.find((c) => c.name === category)?.emoji ?? "📦";
}

/** Días estimados por categoría. ESTIMATED_DAYS["Aseo del hogar"] -> 730 */
export const ESTIMATED_DAYS: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.days]),
);

/** Ubicación sugerida según la categoría (sin nombre). Ver utils/location. */
export function defaultLocation(category: string): Location {
  return CATEGORIES.find((c) => c.name === category)?.location ?? "Alacena";
}

/* ------------------------------------------------------------------ */
/*  Icono por producto                                                  */
/*  Lo específico va primero: "CREMA DENTAL" antes que "CREMA",         */
/*  "JUGO DE LIMON" antes que "LIMON", "SALSA DE TOMATE" antes que      */
/*  "TOMATE". Si nada coincide, se usa el emoji de la categoría.        */
/* ------------------------------------------------------------------ */

const PRODUCT_EMOJI: [RegExp, string][] = [
  // No comida
  [/\b(PAPEL HIG\w*|PAP HIG|PAPEL HIGIENICO|SERVILLETAS?|PAPEL COCINA)\b/, "🧻"],
  [/\b(CREMA DENTAL|CR DENTAL|COLGATE|CEPILLO|ORAL ?B|ENJUAGUE|LISTERINE)\b/, "🪥"],
  [/\b(DETERG\w*|DET|SUAVIZANTE|SUAV|FAB|ARIEL|ARIAL|JAB(?:ON)? (?:DE )?ROPA)\b/, "🧺"],
  [/\b(SHAMPOO|SHAMP|ACONDICIONADOR|HEAD ?(?:&|Y)? ?SHOULDERS|PANTENE|SAVITAL|SEDAL)\b/, "🧴"],
  [/\b(JABON|JAB|PROTEX|DOVE|LUX|PALMOLIVE)\b/, "🧼"],
  [/\b(PANALES|HUGGIES|WINNY|PEQUENIN)\b/, "🍼"],
  [/\b(PERROS?|DOG ?CHOW|PEDIGREE|CHUNKY)\b/, "🐶"],
  [/\b(GATOS?|CAT ?CHOW|WHISKAS|FELIX)\b/, "🐱"],
  // Enlatados (antes que bebidas: "ATUN EN AGUA" no es agua)
  [/\b(ATUN|SARDINAS?|LATAS?|ENLAT\w*|VAN CAMPS)\b/, "🥫"],
  // Bebidas y preparados (antes que frutas y verduras)
  [/\b(JUGO|NECTAR|HIT|TAMPICO)\b/, "🧃"],
  // Salsas para adobar o aderezar son condimento; las de tomate, de tarro
  [/\b(SALSA PARA AD\w*|ADOBO|SAZON\w*|CONDIM\w*)\b/, "🧂"],
  [/\b(SALSA|KETCHUP|FRUCO)\b/, "🥫"],
  [/\b(GASEOSA|GASEOS|COCA ?COLA|POSTOBON|PEPSI|COLOMBIANA|PONY|SPRITE)\b/, "🥤"],
  [/\b(CAFE|TINTO|SELLO ROJO|AGUILA ROJA)\b/, "☕"],
  [/\b(CERVEZA|AGUILA|POKER|CLUB COLOMBIA)\b/, "🍺"],
  [/\b(TE|AROMATICA|INFUSION)\b/, "🍵"],
  [/\bAGUA\b/, "💧"],
  // Congelados y snacks
  [/\b(HELADOS?|PALETAS?|CONO)\b/, "🍦"],
  [/\b(PAPAS (?:A LA )?FRANCESA|FRANCESA)\b/, "🍟"],
  [/\b(PIZZA)\b/, "🍕"],
  [/\b(HAMBURGUESAS?)\b/, "🍔"],
  [/\b(NUGGETS?|APANAD\w*)\b/, "🍗"],
  [/\b(GALLETAS?|GALL|NOEL|OREO|FESTIVAL|SALTIN|DUCALES)\b/, "🍪"],
  [/\b(CHOCOLATES?|CHOCOLATINA|JET|CHOCOLISTO)\b/, "🍫"],
  [/\b(GOMAS?|DULCES?|CARAMELOS?|CHUPETAS?|BOCADILLO)\b/, "🍬"],
  [/\b(PAPAS FRITAS|MARGARITA|DETODITO|CHEETOS|DORITOS|PAPAS MARGARITA|TODO RICO)\b/, "🍿"],
  // Lácteos y huevos
  [/\b(QUESO|QSO|CUAJADA)\b/, "🧀"],
  [/\b(HUEVOS?|HVO)\b/, "🥚"],
  [/\b(MANTEQ\w*|MARGARINA)\b/, "🧈"],
  [/\b(YOGU?R|KUMIS|KEFIR)\b/, "🥣"],
  [/\b(LECHE|LCH)\b/, "🥛"],
  // Carnes
  [/\b(POLLO|PECHUGA|MUSLOS?|ALAS|CONTRAMUSLO)\b/, "🍗"],
  [/\b(PESCADO|TILAPIA|MOJARRA|SALMON|BAGRE)\b/, "🐟"],
  [/\b(CAMARON\w*|MARISCOS?)\b/, "🦐"],
  [/\b(JAMON|SALCHICHA|SALCHICHON|MORTADELA|CHORIZO|TOCINETA)\b/, "🌭"],
  [/\b(CARNE|RES|CERDO|LOMO|COSTILLAS?|MOLIDA|CHULETAS?)\b/, "🥩"],
  // Panadería y granos
  [/\b(CROISSANT)\b/, "🥐"],
  [/\b(PAN|PANES|TAJADO|TAJ|MOGOLLA|TOSTADAS?|BIMBO)\b/, "🍞"],
  [/\b(DONUTS?|DONAS?)\b/, "🍩"],
  [/\b(PONQUE|TORTA|TOR|BROWNIE)\b/, "🍰"],
  [/\b(AREPAS?|TORTILL\w*)\b/, "🫓"],
  [/\b(ARROZ)\b/, "🍚"],
  [/\b(PASTA|SPAGHETTI|ESPAGUETI|MACARRON\w*|FIDEOS?|DORIA|LA MUNECA)\b/, "🍝"],
  [/\b(FRIJOL\w*|LENTEJAS?|GARBANZOS?)\b/, "🫘"],
  [/\b(AVENA|CEREAL|HOJUELAS|GRANOLA)\b/, "🥣"],
  [/\b(HARINA)\b/, "🌾"],
  // Condimentos
  [/\b(ACEITE|OLIVA)\b/, "🫒"],
  [/\b(SAL|SAZON\w*|CONDIM\w*|ADOBO|PIMIENTA|COMINO)\b/, "🧂"],
  [/\b(AZUCAR|PANELA|MIEL)\b/, "🍯"],
  // Frutas y verduras
  [/\b(TOMATES?)\b/, "🍅"],
  [/\b(CEBOLLAS?)\b/, "🧅"],
  [/\b(AJOS?)\b/, "🧄"],
  [/\b(PAPAS?)\b/, "🥔"],
  [/\b(BANANOS?|PLATANOS?)\b/, "🍌"],
  [/\b(MANZANAS?)\b/, "🍎"],
  [/\b(PERAS?)\b/, "🍐"],
  [/\b(NARANJAS?|MANDARINAS?)\b/, "🍊"],
  [/\b(LIMON|LIMONES)\b/, "🍋"],
  [/\b(FRESAS?|MORAS?)\b/, "🍓"],
  [/\b(UVAS?)\b/, "🍇"],
  [/\b(PINA)\b/, "🍍"],
  [/\b(MANGOS?)\b/, "🥭"],
  [/\b(AGUACATES?)\b/, "🥑"],
  [/\b(ZANAHORIAS?)\b/, "🥕"],
  [/\b(BROCOLI|COLIFLOR)\b/, "🥦"],
  [/\b(LECHUGA|ESPINACA|CILANTRO|PEREJIL|APIO)\b/, "🥬"],
  [/\b(PEPINOS?)\b/, "🥒"],
  [/\b(PIMENTON|AJI)\b/, "🫑"],
  [/\b(MAIZ|MAZORCA)\b/, "🌽"],
];

/**
 * Emoji del producto según su nombre; si no reconoce el nombre, el de su
 * categoría.
 *   emojiForProduct("Queso campesino", "Lácteos")   -> "🧀"
 *   emojiForProduct("Jugo de limón", "Bebidas")     -> "🧃"
 *   emojiForProduct("Producto raro", "Granos")      -> "🍚"
 *   emojiForProduct("Algo", "Categoría vieja")      -> "📦"
 */
export function emojiForProduct(name: string, category: string): string {
  const up = normalizeName(name);
  for (const [re, emoji] of PRODUCT_EMOJI) if (re.test(up)) return emoji;
  return emojiFor(category);
}
