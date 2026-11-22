import { ESTIMATED_DAYS } from "@/constants/pantry";
import { CLEANING, normalizeName, PERSONAL, PET } from "@/utils/keywords";
import { isValidEan } from "@/utils/ean";
import { buildDate } from "@/utils/expiration";

const stripAccents = (s: string) => normalizeName(s);

/* ------------------------------------------------------------------ */
/*  Lectura de facturas: convierte el texto del OCR en productos       */
/*  Pensado para tiquetes de supermercado colombianos (Éxito, D1,      */
/*  Ara, Olímpica…). Es una heurística: el usuario siempre revisa.     */
/* ------------------------------------------------------------------ */

export interface ReceiptItem {
  name: string;
  quantity: number;
  category: string;
  /** Días aproximados hasta el vencimiento, según el tipo de producto. */
  days: number;
  /** Línea original del OCR, útil para mostrar qué se leyó (dos líneas unidas con " / "). */
  raw: string;
  /** Revisar primero: categoría "Otros", nombre muy corto o palabra corregida del OCR. */
  lowConfidence: boolean;
  /** Se corrigió una confusión del OCR (0→O, 1→I/L, 5→S, 8→B) en alguna palabra. */
  corrected?: boolean;
  /** Código de barras válido de la fila (EAN-8/13), si lo hay. Sirve para buscar el nombre completo. */
  ean?: string;
  /** Valor total de la línea en pesos (cantidad × precio), si se leyó. */
  total?: number;
}

export interface ParsedReceipt {
  store: string | null;
  items: ReceiptItem[];
  /** Texto completo que devolvió el OCR (para revisar qué se leyó). */
  text: string;
  /** Valor de la línea TOTAL de la factura, si se leyó. */
  total: number | null;
  /** Suma de los valores de las líneas detectadas. */
  sum: number;
  /** true: la suma cuadra con el TOTAL (lectura confiable); false: no cuadra; null: no se pudo comparar. */
  totalMatches: boolean | null;
  /** Fecha de compra ("Generacion: 2026/11/20"); base de los días estimados. */
  purchaseDate: Date | null;
  /** Factura con columnas (D1, Ara): solo se aceptan filas con código o columnas. */
  columnar: boolean;
}

// Líneas que no son productos: totales, pagos, datos legales, encabezado.
const SKIP =
  /\b(SUB\s*TOTAL|TOTAL|IVA|IMPTO|IMPUESTO|INC|NIT|FACTURA|RESOL|DIAN|CUFE|CAJA|CAJERO|CAMBIO|EFECTIVO|TARJETA|DEBITO|CREDITO|VUELTO|PAGO|PAGADO|FECHA|HORA|DIRECCION|DIR|TEL|TELEFONO|CEL|GRACIAS|CLIENTE|ITEMS?|ARTICULOS|DESCUENTOS?|AHORRO|PUNTOS|BASE|REDONDEO|REGIMEN|AUTORRET\w*|TIQUETE|TICKET|VENTA|DEVOLUCION|PROPINA|BOLSAS?|CODIGO|DESCRIP\w*|VALOR|PLU|EAN|SALDO|RECIBIDO|DOMICILIO|CALLE|CARRERA|CRA|CLL|AVENIDA|BARRIO|WWW|COM|SAS|LTDA|S\.A\.?S?|TARJ\w*|RECIBO|RRN|APRO\w*|AUTORIZ\w*|CONTADO|EXCLUIDO|EXENTO|VIGENCIA|PREFIJO|ATENDIDO|FACTURADOR|SISTEMA|CONSUMIDOR|GENERACION|VALIDACION|RESUMEN|FORMA|ENTREGADOS|ELECTRONIC\w*|POS|CUDE|QR|CAN UM)\b/;
// Más ruido del pie y del encabezado:
//  direcciones "DG 72 2 15 TUNJA", "CRA 10 # 5-20"; "ID. CLIENTE"; "A = 19%", "6 = EXCLUIDO".
const NOISE =
  /\b(?:DG|DIAG|TV|TRANSV|KR|CR|CRA|CL|CLL|AV|AK|AC|MZ)\.?\s*\d+|\bID\.?\s*CLIENTE\b|^\s*[A-Z0-9]\s*=|\bNUM\.?\s*ART/;

// Solo cantidad y precio: "2 X 2.250", "3 UN x 1.500"
const QTY_LINE = /^\s*(\d{1,3})\s*(?:UN|UND|UNID)?\s*[X*]\s*\$?\s*[\d.,]+\s*$/;
// Fila de factura con columnas (Ara, D1…):
// "1 7702025152773 NOEL NAVIDAD X J 1 UN 9.590 9.590"
//  #  código        descripción   imp cant unidad precios
const COLUMN_ROW = /^\s*(?:\d{1,3}\s+)?\d{4,14}\s+(.+?)\s+(\d{1,3})\s*(?:UN|UND|UNID|EA|KG|GR|LT|LB)\b/;
// Letra(s) de impuesto al final de la descripción: "J", "C", "CZ", "ES C"
const TAX_CODE_SUFFIX = /(?:\s+[A-Z]{1,2})+$/;
// Línea de peso: "0,450 KG X 4.200"
const WEIGHT_LINE = /^\s*[\d.,]+\s*(?:KG|KGS|GR|GRS|G|LB)\b/;
// Línea con solo un precio (el OCR a veces separa nombre y precio)
const PRICE_ONLY = /^\s*\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{3,6})(?:[.,]\d{1,2})?(?:\s+[A-Z])?\s*$/;
// Cantidad al inicio de la línea: "2 X LECHE…". (Al final no se toma: "HUEVOS X12" es el tamaño.)
const QTY_PREFIX = /^\s*(\d{1,2})\s*[X*]\s+/;
// Código de barras o PLU al inicio de la línea
const CODE_PREFIX = /^\s*\d{4,14}\s+/;
// Precio al final: "4.500", "12,900", "$ 4.500 A", "4500.00"
// (la letra final es el código de impuesto, separado por espacio: "4.500 A")
const PRICE_SUFFIX = /\s+\$?\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?(?:\s+[A-Z])?\s*$|\s+\$?\s*\d{3,6}(?:[.,]\d{2})?(?:\s+[A-Z])?\s*$/;

const CHAINS = [
  "EXITO", "CARULLA", "D1", "ARA", "OLIMPICA", "JUMBO", "METRO", "ALKOSTO",
  "COLSUBSIDIO", "MAKRO", "ISIMO", "SURTIMAX", "SUPER INTER", "MERCALDAS",
  "COMFABOY", "PRICESMART", "MERCAMIO", "COOMULTRASAN", "ZAPATOCA",
];

// Palabras clave -> categoría (las mismas de constants/pantry).
// El orden importa: la primera regla que coincide gana, así que lo más
// específico va primero. Ejemplos de por qué:
//   "PROTEX AVENA"     -> Cuidado personal (la marca gana sobre "AVENA")
//   "JABON LOZA"       -> Aseo del hogar (antes que "JABON" de baño)
//   "AVENA ALPINA"     -> Lácteos (antes que "AVENA" de Granos)
//   "SALSA DE TOMATE"  -> Condimentos (antes que "TOMATE")
//   "JUGO DE LIMON"    -> Bebidas (antes que "LIMON")
//   "CREMA DENTAL"     -> Cuidado personal (no hay "CREMA" suelta en Lácteos)
export const CATEGORY_WORDS: [string, RegExp][] = [
  ["Mascotas", PET],
  ["Aseo del hogar", CLEANING],
  ["Cuidado personal", PERSONAL],
  ["Congelados", /\b(HELADOS?|PALETAS?|CONGELAD\w*|NUGGETS?|HIELO|FRANCESA|APANAD\w*|HAMBURGUESAS?|PIZZA)\b/],
  ["Condimentos y aceites", /\b(CONDIM\w*|SAZON\w*|ADOBO|CALDOS?|CUBITOS?|MAGGI|RICOSTILLA|SALSAS?|KETCHUP|MAYONESA|MOSTAZA|FRUCO|VINAGRE|ACEITE|OLIVA|MARGARINA|SAL|AZUCAR|PANELA|PIMIENTA|COMINO|OREGANO|CANELA|COLOR|LA CONSTANCIA|BADIA|EL REY)\b/],
  ["Snacks y dulces", /\b(GALLETAS?|GALL|NOEL|OREO|FESTIVAL|SALTIN|DUCALES|CHOCOLATES?|CHOCOLATINA|JET|GOMAS?|DULCES?|CARAMELOS?|CHUPETAS?|CHICLES?|BOCADILLO|MANI|PAPAS FRITAS|MARGARITA|DETODITO|CHEETOS|DORITOS|TODO RICO|CHITOS|ROSQUITAS|PAPAS MARGARITA)\b/],
  ["Lácteos", /\b(LECHE|LCH|YOGU?R|KUMIS|KEFIR|QUESO|QSO|CUAJADA|MANTEQ\w*|CREMA DE LECHE|AVENA (?:LIQ\w*|ALPINA)|ALPINA|ALQUERIA|COLANTA|HUEVOS?|HVO)\b/],
  ["Panadería", /\b(PAN|PANES|TAJADO|TAJ|MOGOLLA|TORTILL\w*|CROISSANT|TOSTADAS?|BIMBO|PONQUE|DONUTS?|DONAS?|TOR|TORTA|BROWNIE|AREPAS?|PANDEBONO|ALMOJABANAS?)\b/],
  ["Enlatados", /\b(ATUN|SARDINAS?|LATA|ENLAT\w*|MAIZ TIERNO|VAN CAMPS)\b/],
  ["Carnes", /\b(POLLO|PECHUGA|MUSLOS?|ALAS|CARNE|RES|CERDO|LOMO|COSTILLAS?|MOLIDA|CHORIZO|SALCHICHAS?|SALCHICHON|JAMON|MORTADELA|TOCINETA|PESCADO|TILAPIA|MOJARRA|SALMON|CAMARON\w*)\b/],
  ["Bebidas", /\b(GASEOSA|GASEOS|COCA|POSTOBON|PEPSI|JUGO|NECTAR|HIT|AGUA|TE|CAFE|CERVEZA|BAVARIA|AGUILA|POKER|CLUB COLOMBIA|COSTENA|PILSEN|REFRESCO|BEBIDA|PONY|COLOMBIANA|AROMATICA|CHOCOLISTO|MILO)\b/],
  ["Frutas y verduras", /\b(TOMATES?|CEBOLLAS?|PAPA|PAPAS|ZANAHORIAS?|LECHUGA|AGUACATES?|BANANOS?|PLATANOS?|MANZANAS?|PERAS?|NARANJAS?|LIMON|LIMONES|MANGOS?|FRESAS?|MORA|PINA|UVAS?|PAPAYA|AJOS?|PIMENTON|BROCOLI|ESPINACA|PEPINOS?|AHUYAMA|YUCA|ARRACACHA|MANDARINAS?|GUAYABAS?|MARACUYA|LULO|CILANTRO|APIO|REPOLLO|HABICHUELA)\b/],
  ["Granos", /\b(ARROZ|FRIJOL\w*|LENTEJAS?|GARBANZOS?|PASTA|SPAGHETTI|ESPAGUETI|MACARRON\w*|FIDEOS?|AVENA|HOJUELAS|GRANOLA|HARINA|MAIZ|CEREAL|QUINUA|DIANA|ROA|DORIA)\b/],
];

export function guessCategory(name: string): string {
  const up = normalizeName(name);
  for (const [category, re] of CATEGORY_WORDS) if (re.test(up)) return category;
  return "Otros";
}

/* ------------------------------------------------------------------ */
/*  Vida útil aproximada por tipo de producto                          */
/*  La factura no trae la fecha de vencimiento. Estos días son una     */
/*  referencia típica desde la compra (refrigerado lo perecedero); se  */
/*  marcan como "fecha estimada" y el usuario los puede corregir.      */
/* ------------------------------------------------------------------ */

const SHELF_LIFE: [RegExp, number][] = [
  // Aseo, cuidado personal y mascotas: duran mucho (va antes que todo:
  // "PROTEX AVENA" no es avena).
  [PET, 365],
  [CLEANING, 730],
  [PERSONAL, 730],
  // Congelados
  [/\b(HELADOS?|PALETAS?|CONGELAD\w*|NUGGETS?|FRANCESA|APANAD\w*|HAMBURGUESAS?|PIZZA)\b/, 90],
  // Condimentos y aceites
  [/\b(CONDIM\w*|SAZON\w*|ADOBO|CALDOS?|CUBITOS?|SALSAS?|KETCHUP|MAYONESA|MOSTAZA|VINAGRE|ACEITE|SAL|AZUCAR|PIMIENTA|COMINO)\b/, 365],
  [/\bPANELA\b/, 180],
  // Lácteos y huevos
  [/\b(UHT|LARGA VIDA)\b/, 90],
  [/\bAVENA (?:LIQ\w*|ALPINA)\b/, 15],
  [/\b(LECHE|LCH)\b/, 7],
  [/\b(YOGU?R|KUMIS|ALPINITO)\b/, 15],
  [/\b(QUESO|QSO|CUAJADA)\b/, 10],
  [/\b(MANTEQ\w*|MARGARINA)\b/, 30],
  [/\bCREMA DE LECHE\b/, 10],
  [/\b(HUEVOS?|HVO)\b/, 21],
  // Carnes y frías
  [/\b(POLLO|PECHUGA|MUSLOS?|ALAS)\b/, 2],
  [/\b(PESCADO|TILAPIA|MOJARRA|SALMON)\b/, 2],
  [/\b(CARNE|RES|CERDO|LOMO|COSTILLA|MOLIDA)\b/, 3],
  [/\b(JAMON|SALCHICHA|SALCHICHON|MORTADELA|CHORIZO|TOCINETA)\b/, 10],
  // Panadería y snacks
  [/\b(DONUTS?|DONAS?|CROISSANT|PANDEBONO|ALMOJABANA)\b/, 3],
  [/\b(PAN|TAJADO|TAJ|MOGOLLA)\b/, 6],
  [/\b(PONQUE|TORTA|TOR|BROWNIE)\b/, 10],
  [/\bTORTILL\w*\b/, 30],
  [/\b(GALLETAS?|GALL|NOEL|TOSTADAS?)\b/, 90],
  [/\b(CHOCOLATES?|CHOCOLATINA|GOMAS?|DULCES?|CARAMELOS?|BOCADILLO)\b/, 180],
  [/\b(PAPAS FRITAS|MARGARITA|DETODITO|CHEETOS|DORITOS|TODO RICO)\b/, 60],
  // Bebidas (antes que frutas: "JUGO DE LIMON")
  [/\b(JUGO|NECTAR|HIT)\b/, 90],
  [/\b(GASEOSA|GASEOS|COCA|POSTOBON|PONY|COLOMBIANA|CERVEZA|BAVARIA|AGUILA|POKER|CLUB COLOMBIA|COSTENA|PILSEN)\b/, 180],
  [/\bAGUA\b/, 365],
  // Frutas y verduras
  [/\b(FRESAS?|MORA|UVAS?|LECHUGA|ESPINACA|CILANTRO|PEREJIL)\b/, 4],
  [/\b(BANANO|PLATANO|AGUACATE|PAPAYA|MANGO|GUAYABA|YUCA)\b/, 5],
  [/\b(TOMATE|PEPINO|PIMENTON|BROCOLI|AHUYAMA|MARACUYA|LULO)\b/, 7],
  [/\b(NARANJAS?|MANDARINAS?|LIMON|LIMONES|ZANAHORIA)\b/, 14],
  [/\b(MANZANAS?|PERAS?)\b/, 21],
  [/\b(PAPA|PAPAS|CEBOLLA|AJO)\b/, 30],
  // Despensa seca
  [/\b(CAFE|AVENA|HOJUELAS|HARINA|CEREAL)\b/, 180],
  [/\b(ARROZ|FRIJOL\w*|LENTEJAS?|GARBANZOS?|PASTA|SPAGHETTI|ESPAGUETI|TE)\b/, 365],
  [/\b(ATUN|SARDINAS?|LATA|ENLAT\w*)\b/, 365],
];

/** Días aproximados de vida útil: por tipo de producto, si no por categoría. */
export function estimateDays(name: string, category: string): number {
  const up = stripAccents(name.toUpperCase());
  for (const [re, days] of SHELF_LIFE) if (re.test(up)) return days;
  return ESTIMATED_DAYS[category] ?? 30;
}

/** "LECHE ENTERA ALQUERIA 1L" -> "Leche entera alqueria 1L" ("3X110G" queda en mayúsculas) */
function sentenceCase(s: string): string {
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.map((w) =>
    /^\d+(?:[.,]\d+)?[a-z]{1,3}$/.test(w) || /^\d+x\d+(?:[.,]\d+)?[a-z]{0,3}$/.test(w)
      ? w.toUpperCase()
      : w,
  );
  const joined = out.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function letters(s: string): number {
  return (s.match(/[A-ZÑ]/g) ?? []).length;
}

const chainRe = (c: string) => new RegExp("\\b" + c + "\\b");

export function detectStore(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const up = stripAccents(line.toUpperCase());
    const chain = CHAINS.find((c) => chainRe(c).test(up));
    if (chain) return sentenceCase(chain);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Confusiones del OCR dentro de palabras: 0↔O, 1↔I/L, 5↔S, 8↔B       */
/*  Solo se corrige si el resultado es una palabra conocida (de las     */
/*  listas de categorías), así "110G" o "1L" no se tocan.               */
/* ------------------------------------------------------------------ */

const VOCAB = new Set(
  [...CATEGORY_WORDS.map(([, re]) => re), PET, CLEANING, PERSONAL].flatMap(
    (re) => re.source.match(/[A-ZÑ]{3,}/g) ?? [],
  ),
);
// Tamaños y empaques: "110G", "1.5L", "3X110G", "X12", "500ML" (no se corrigen)
const SIZE_TOKEN = /^(?:\d+X)?\d+(?:[.,]\d+)?(?:G|GR|GRS|KG|ML|L|LT|CC|UN|UND|M)?$|^X\d+$/;

/** "PR0TEX" -> "PROTEX", "JAB0N" -> "JABON", "5HAMPOO" -> "SHAMPOO"; "110G" no cambia. */
export function fixOcrWord(word: string): string {
  if (word.length < 3 || !/\d/.test(word) || !/[A-ZÑ]/.test(word)) return word;
  if (SIZE_TOKEN.test(word) || VOCAB.has(word)) return word;
  const base = (one: string) =>
    word.replace(/0/g, "O").replace(/1/g, one).replace(/5/g, "S").replace(/8/g, "B");
  for (const candidate of [base("I"), base("L")]) if (VOCAB.has(candidate)) return candidate;
  return word;
}

function fixOcrWords(line: string): { line: string; corrected: boolean } {
  let corrected = false;
  const fixed = line
    .split(" ")
    .map((w) => {
      const f = fixOcrWord(w);
      if (f !== w) corrected = true;
      return f;
    })
    .join(" ");
  return { line: fixed, corrected };
}

// Códigos de impuesto o de exclusión que quedan al final del nombre: "E", "CZ", "19%", "EXC"
const TAX_TAIL = /(?:\s+(?:[A-EJZ*]|CZ|EX|EXC|EXE|IVA\s?\d{0,2}%?|\d{1,2}%))+$/;

/* ------------------------------------------------------------------ */
/*  Formato D1 (columnas):  N°  CAN  UM  VALOR_U  CÓDIGO  DESCRIPCIÓN  VALOR  ID                 */
/*  "1 1 UN 5.350 7700304448241 TORTILLA FAJI 5.350 A"                  */
/*  "7 2 UN 3.090 7700304687862 LECHE ENTERA 6.180 5"                    */
/*  El código admite letras que el OCR confunde (O, I, L, S, B).         */
/* ------------------------------------------------------------------ */

const MONEY = String.raw`\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{3,7})(?:[.,]\d{1,2})?`;
// Código de barras: 8 a 14 caracteres con al menos 6 dígitos (el OCR confunde algunos con letras).
const CODE = String.raw`(?=(?:[A-Z]*\d){6})[0-9A-Z]{8,14}`;
const UNIT = "(?:UN|UND|UNID|EA|KG|GR|LT|LB|U)";
const D1_ROW = new RegExp(
  String.raw`^\s*(\d{1,3})\s+(\d{1,3})\s*(?:${UNIT}\b)?\s*(${MONEY})\s+(${CODE})\s+(.+?)\s+(${MONEY})(?:\s+[A-Z0-9*]{1,2})?\s*$`,
);
// La misma fila partida por el OCR en dos líneas:
//   "1 1 UN 5.350"  +  "7700304448241 TORTILLA FAJI 5.350 A"
const D1_QTY_PART = new RegExp(String.raw`^\s*(\d{1,3})\s+(\d{1,3})\s*${UNIT}\b\s*(${MONEY})\s*$`);
const CODE_DESC_TOTAL = new RegExp(
  String.raw`^\s*(${CODE})\s+(.+?)\s+(${MONEY})(?:\s+[A-Z0-9*]{1,2})?\s*$`,
);
// Cabecera de columnas de D1: "N° CAN UM VALOR U CODIGO DESCRIPCION VALOR ID"
const D1_HEADER = /\bCAN\b.*\bUM\b.*\bCODIGO\b.*\bDESCRIP/;
// Línea TOTAL de la factura (no SUBTOTAL, no "TOTALES:")
const TOTAL_LINE = new RegExp(String.raw`^\s*(?:VALOR\s+)?TOTAL(?:\s+A\s+PAGAR)?\b(?!ES)[^0-9$]*(${MONEY})`);
// Fecha de compra: "Generacion: 2026/11/20", "FECHA: 20/11/2026"
const PURCHASE_DATE =
  /\b(?:GENERACION|FECHA|EMISION|EXPEDICION)\b[^0-9]*(?:(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})|(\d{1,2})[/\-.](\d{1,2})[/\-.](20\d{2}))/;

/** "39.670" -> 39670, "$ 4.500" -> 4500, "4500.00" -> 4500, "12,900" -> 12900 */
export function parseMoney(s: string): number {
  const t = s.replace(/[$\s]/g, "");
  const dec = /[.,](\d{1,2})$/.exec(t);
  const intPart = dec ? t.slice(0, dec.index) : t;
  return Number(intPart.replace(/[.,]/g, "")) || 0;
}

/**
 * Código de barras de la fila: corrige O→0, I/L→1, S→5, B→8 y, si aun así el
 * dígito de control no cuadra, prueba cambiar UN dígito que el OCR suele
 * confundir (0↔8, 1↔7, 5↔6, 3↔8). Solo acepta si hay una única corrección.
 *   fixEan("77OO3O4448241") -> { ean: "7700304448241", corrected: true }
 *   fixEan("7700304448242") -> { ean: null, corrected: false }  (ninguna corrección única)
 */
export function fixEan(token: string): { ean: string | null; corrected: boolean } {
  const digits = token
    .replace(/[OQD]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/Z/g, "2");
  const lettered = digits !== token;
  if (!/^\d+$/.test(digits)) return { ean: null, corrected: false };
  if (isValidEan(digits)) return { ean: digits, corrected: lettered };
  if (digits.length !== 13 && digits.length !== 8) return { ean: null, corrected: false };
  const swaps: Record<string, string[]> = {
    "0": ["8"], "8": ["0", "3"], "1": ["7"], "7": ["1"], "5": ["6"], "6": ["5"], "3": ["8"],
  };
  const candidates = new Set<string>();
  for (let i = 0; i < digits.length; i++)
    for (const alt of swaps[digits[i]] ?? []) {
      const c = digits.slice(0, i) + alt + digits.slice(i + 1);
      if (isValidEan(c)) candidates.add(c);
    }
  return candidates.size === 1
    ? { ean: [...candidates][0], corrected: true }
    : { ean: null, corrected: false };
}

/* ------------------------------------------------------------------ */
/*  Nombres recortados: D1 corta la descripción a ~13 caracteres         */
/*  ("MORA CONGELAD", "PAPAS A LA FR", "PAN TAJADO BL"). Se completan    */
/*  las palabras conocidas antes de clasificar.                          */
/* ------------------------------------------------------------------ */

const COMPLETIONS: [RegExp, string][] = [
  [/\bPAPAS A LA F\w*$/, "PAPAS A LA FRANCESA"],
  [/\bPAPA A LA F\w*$/, "PAPA A LA FRANCESA"],
  [/\bTAJADO BL\w*$/, "TAJADO BLANCO"],
  [/\bTAJADO INT\w*$/, "TAJADO INTEGRAL"],
  [/\bSALSA PARA AD\w*$/, "SALSA PARA ADOBAR"],
  [/\bSALSA DE TOM\w*$/, "SALSA DE TOMATE"],
  [/\bCONGELAD\b/, "CONGELADA"],
  [/\bVEGETA\b/, "VEGETAL"],
  [/\bFAJI\b/, "FAJITA"],
  [/\bINTEGR\b/, "INTEGRAL"],
  [/\bDESLACT\w*$/, "DESLACTOSADA"],
  [/\bSEMIDESC\w*$/, "SEMIDESCREMADA"],
  [/\bDESCREM\b/, "DESCREMADA"],
  [/\bENTER\b/, "ENTERA"],
  [/\bCHOCOL\b/, "CHOCOLATE"],
  [/\bMANTEQUIL\b/, "MANTEQUILLA"],
  [/\bMERMELAD\b/, "MERMELADA"],
  [/\bMAYONES\b/, "MAYONESA"],
  [/\bDETERGEN\b/, "DETERGENTE"],
  [/\bSUAVIZAN\b/, "SUAVIZANTE"],
  [/\bGALLET\b/, "GALLETAS"],
  [/\bHAMBURG\w*$/, "HAMBURGUESA"],
  [/\bSALCHICH\b/, "SALCHICHA"],
  [/\bESPAGUET\b/, "ESPAGUETI"],
  [/\bTORTILL\b/, "TORTILLA"],
  [/\bMARGARIN\b/, "MARGARINA"],
  [/\bBLANQUEAD\b/, "BLANQUEADOR"],
];

/** "MORA CONGELAD" -> "MORA CONGELADA", "PAPAS A LA FR" -> "PAPAS A LA FRANCESA" */
export function completeTruncated(name: string): string {
  let out = name.trim();
  for (const [re, full] of COMPLETIONS) out = out.replace(re, full);
  return out;
}

/** Fecha de compra impresa en la factura, o null. */
export function detectPurchaseDate(lines: string[]): Date | null {
  for (const line of lines) {
    const m = PURCHASE_DATE.exec(stripAccents(line.toUpperCase()));
    if (!m) continue;
    const d = m[1]
      ? buildDate(Number(m[1]), Number(m[2]), Number(m[3]))
      : buildDate(Number(m[6]), Number(m[5]), Number(m[4]));
    if (d) return d;
  }
  return null;
}

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  const upperLines = lines.map((l) => stripAccents(l.toUpperCase()));

  // ¿Factura con columnas? Por la cabecera de D1 o por la forma de las filas
  // (D1 o Ara). "Código + nombre + precio" no cuenta: el Éxito mezcla líneas
  // con y sin código.
  const columnRows = upperLines.filter((l) => D1_ROW.test(l) || COLUMN_ROW.test(l)).length;
  const columnar = upperLines.some((l) => D1_HEADER.test(l)) || columnRows >= 2;

  type Candidate = ReceiptItem & { priced: boolean; continuable: boolean };
  const found: Candidate[] = [];
  let pendingQty: number | null = null;
  let lastWasProduct = false; // la línea anterior fue un nombre (para unir nombres partidos)
  let total: number | null = null;

  const make = (
    rawName: string,
    quantity: number,
    original: string,
    priced: boolean,
    corrected: boolean,
    continuable: boolean,
    extra: { ean?: string | null; total?: number } = {},
  ): Candidate => {
    const name = completeTruncated(rawName);
    const category = guessCategory(name);
    return {
      name: sentenceCase(name),
      quantity: Math.min(Math.max(quantity, 1), 99),
      category,
      days: estimateDays(name, category),
      raw: original,
      lowConfidence: false,
      corrected,
      priced,
      continuable,
      ...(extra.ean ? { ean: extra.ean } : {}),
      ...(extra.total ? { total: extra.total } : {}),
    };
  };
  /** Limpia la descripción ya aislada: símbolos, impuesto final y espacios. */
  const cleanDesc = (s: string) =>
    s.replace(/[^A-ZÑ0-9 .,%/-]/g, " ").replace(/\s{2,}/g, " ").trim();
  /** La regla del 50 % de letras se aplica solo a la descripción, no a toda la fila. */
  const looksLikeName = (s: string) =>
    letters(s) >= 3 &&
    /[A-ZÑ]{2,}/.test(s) &&
    letters(s) / Math.max(1, s.replace(/\s/g, "").length) >= 0.5 &&
    !SKIP.test(s);

  for (let li = 0; li < lines.length; li++) {
    const original = lines[li];
    const upper = upperLines[li];

    // TOTAL de la factura: se guarda para comparar y la línea se salta.
    const t = TOTAL_LINE.exec(upper);
    if (t && !/SUB\s*TOTAL/.test(upper)) {
      total = parseMoney(t[1]);
      lastWasProduct = false;
      continue;
    }

    // 1) Fila D1 completa
    const d1 = D1_ROW.exec(upper);
    if (d1) {
      const desc = cleanDesc(d1[5]);
      const code = fixEan(d1[4]);
      if (looksLikeName(desc)) {
        const qty = Number(d1[2]) || 1;
        found.push(
          make(desc, qty, original, true, code.corrected, false, {
            ean: code.ean,
            total: parseMoney(d1[6]),
          }),
        );
      }
      pendingQty = null;
      lastWasProduct = false;
      continue;
    }
    // 1b) Fila D1 partida: primero "N CAN UM VALOR_U", luego "CÓDIGO DESCRIPCIÓN VALOR ID"
    const part = D1_QTY_PART.exec(upper);
    if (part && columnar) {
      pendingQty = Number(part[2]) || 1;
      lastWasProduct = false;
      continue;
    }

    // Línea de solo cantidad: se la damos al producto anterior.
    const q = QTY_LINE.exec(upper);
    if (q) {
      const qty = Number(q[1]);
      if (found.length) found[found.length - 1].quantity = qty;
      else pendingQty = qty;
      lastWasProduct = false;
      continue;
    }

    // 2) Fila Ara: "# CÓDIGO DESCRIPCIÓN ID CANT UN VALOR_U VALOR_T"
    const col = COLUMN_ROW.exec(upper);
    if (col) {
      const name = cleanDesc(col[1].replace(TAX_CODE_SUFFIX, ""));
      const codeTok = /^\s*(?:\d{1,3}\s+)?(\d{4,14})\s/.exec(upper)?.[1] ?? "";
      const code = codeTok.length >= 8 ? fixEan(codeTok) : { ean: null, corrected: false };
      const prices = upper.match(new RegExp(MONEY, "g")) ?? [];
      const lineTotal = prices.length >= 2 ? parseMoney(prices[prices.length - 1]) : undefined;
      if (looksLikeName(name)) {
        found.push(
          make(name, Number(col[2]), original, true, fixOcrWords(upper).corrected, false, {
            ean: code.ean,
            total: lineTotal,
          }),
        );
      }
      lastWasProduct = false;
      continue;
    }

    // 3) Código + descripción + valor (también la 2.ª mitad de una fila D1 partida)
    const cdt = CODE_DESC_TOTAL.exec(upper);
    if (cdt) {
      const desc = cleanDesc(fixOcrWords(cdt[2]).line);
      const code = fixEan(cdt[1]);
      if (looksLikeName(desc)) {
        found.push(
          make(desc, pendingQty ?? 1, original, true, code.corrected, false, {
            ean: code.ean,
            total: parseMoney(cdt[3]),
          }),
        );
      }
      pendingQty = null;
      lastWasProduct = false;
      continue;
    }

    // Precio suelto: pertenece al producto de la línea anterior.
    if (PRICE_ONLY.test(upper)) {
      const prev = found.at(-1);
      if (prev) {
        prev.priced = true;
        prev.continuable = false;
        if (!prev.total) prev.total = parseMoney(upper);
      }
      lastWasProduct = false;
      continue;
    }
    if (WEIGHT_LINE.test(upper) || SKIP.test(upper) || NOISE.test(upper)) {
      lastWasProduct = false;
      continue;
    }
    // En una factura de columnas, una línea sin código ni columnas no es un producto
    // ("TARJ CRE/DEB", "ARO", la dirección…).
    if (columnar) {
      lastWasProduct = false;
      continue;
    }

    // 4) Tiquete sin columnas: nombre + precio
    const fixed = fixOcrWords(upper);
    let line = fixed.line;
    const hadCode = CODE_PREFIX.test(line);
    line = line.replace(CODE_PREFIX, "");

    let priced = false;
    let lineTotal: number | undefined;
    while (PRICE_SUFFIX.test(line)) {
      const m = PRICE_SUFFIX.exec(line)!;
      if (lineTotal === undefined) lineTotal = parseMoney(m[0].replace(/\s+[A-Z]\s*$/, ""));
      line = line.replace(PRICE_SUFFIX, "");
      priced = true;
    }
    if (priced || hadCode) line = line.replace(TAX_TAIL, "");

    let quantity = pendingQty ?? 1;
    pendingQty = null;
    const pre = QTY_PREFIX.exec(line);
    if (pre) {
      quantity = Number(pre[1]);
      line = line.replace(QTY_PREFIX, "");
    }

    line = cleanDesc(line);

    // Nombre partido en dos líneas: "SHAMPOO HEAD" + "SHOULDERS 375ML 18.900" o
    // "JABON PROTEX AVENA" + "3X110G 9.900". Si la anterior era un nombre sin
    // precio y esta es corta (máx. 2 palabras) y no empieza un producto nuevo
    // (sin código ni "2 X"), se unen.
    const prev = found.at(-1);
    const wordsWithLetters = line.split(" ").filter((w) => /[A-ZÑ]{2,}/.test(w)).length;
    if (
      prev &&
      lastWasProduct &&
      prev.continuable &&
      !prev.priced &&
      !pre &&
      !hadCode &&
      wordsWithLetters <= 2 &&
      line.length > 0
    ) {
      const joined = prev.raw.trim() + " / " + original.trim();
      const name = stripAccents(prev.name.toUpperCase()) + " " + line;
      found[found.length - 1] = make(
        name,
        prev.quantity,
        joined,
        priced || prev.priced,
        fixed.corrected || !!prev.corrected,
        false,
        { total: lineTotal ?? prev.total },
      );
      lastWasProduct = !priced;
      continue;
    }

    // Debe parecer un nombre: al menos 3 letras y una palabra de 3 o más.
    if (!looksLikeName(line) || !/[A-ZÑ]{3,}/.test(line)) {
      lastWasProduct = false;
      continue;
    }
    // El nombre de la tienda no se une con el siguiente producto.
    const isStore = CHAINS.some((c) => chainRe(c).test(line));

    found.push(
      make(line, quantity, original, priced || hadCode, fixed.corrected, !isStore, {
        total: lineTotal,
      }),
    );
    lastWasProduct = !(priced || hadCode);
  }

  // Si la factura trae precios, nos quedamos solo con las líneas que tenían
  // precio o código: así se descartan encabezados y publicidad.
  const pricedCount = found.filter((f) => f.priced).length;
  const pool = pricedCount >= 2 ? found.filter((f) => f.priced) : found;

  // Productos repetidos en líneas distintas se suman.
  const merged = new Map<string, ReceiptItem>();
  for (const { priced: _p, continuable: _c, ...item } of pool) {
    const key = item.ean ?? item.name.toLowerCase();
    const prev = merged.get(key);
    if (prev) {
      prev.quantity = Math.min(prev.quantity + item.quantity, 99);
      if (prev.total !== undefined || item.total !== undefined)
        prev.total = (prev.total ?? 0) + (item.total ?? 0);
    } else merged.set(key, { ...item });
  }

  const all = [...merged.values()].slice(0, 40);
  const sum = all.reduce((acc, it) => acc + (it.total ?? 0), 0);
  const allPriced = all.length > 0 && all.every((it) => it.total !== undefined);
  const totalMatches = total !== null && allPriced ? Math.abs(sum - total) <= 1 : null;

  // Baja confianza: categoría "Otros", nombre muy corto o palabra corregida.
  // (Si la suma cuadra con el total, una corrección del OCR no basta para dudar.)
  const items = all.map((it) => ({
    ...it,
    lowConfidence:
      it.category === "Otros" ||
      letters(stripAccents(it.name.toUpperCase())) < 5 ||
      (!!it.corrected && totalMatches !== true),
  }));

  return {
    store: detectStore(lines),
    items,
    text,
    total,
    sum,
    totalMatches,
    purchaseDate: detectPurchaseDate(lines),
    columnar,
  };
}

/* ------------------------------------------------------------------ */
/*  Factura pendiente de revisar                                        */
/*  El escáner la deja aquí y "Revisar factura" la toma (los params de  */
/*  la ruta no son buenos para listas largas).                          */
/* ------------------------------------------------------------------ */

let pending: ParsedReceipt | null = null;

export function setPendingReceipt(r: ParsedReceipt | null) {
  pending = r;
}

/** Lee la factura pendiente sin borrarla (React puede montar la pantalla dos veces en desarrollo). */
export function getPendingReceipt(): ParsedReceipt | null {
  return pending;
}
