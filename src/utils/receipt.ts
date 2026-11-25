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
  /** Descripción tal como vino en la factura, sin cantidad ni precio ("BARQUILLOS SU"). Clave de los nombres aprendidos sin EAN. */
  sourceText?: string;
  /** Unidad de la cantidad: "un" (unidades) o "kg" (por peso). */
  unit?: "un" | "kg";
  /** El nombre salió de lo que el usuario corrigió antes ("Nombre recordado"). */
  fromLearned?: boolean;
  /** Ubicación aprendida para este producto, si el usuario la corrigió antes. */
  learnedLocation?: string;
  /** Unitario × cantidad no da el total de la línea: cantidad dudosa. */
  qtyMismatch?: boolean;
  /** La fila no traía cantidad ni precio (foto recortada): cantidad 1 por defecto, revisar. */
  qtyUnknown?: boolean;
  /** El código no pasaba el dígito de control y se rescató (ver rescueEan). */
  rescued?: boolean;
  /** De dónde salió el nombre: "Recordado", "Conocido", "Open Food Facts", "Los Precios", "UPCitemdb", "Factura"… */
  nameSource?: string;
}

/** Cómo se leyó cada línea (para depurar en modo desarrollo). */
export interface ReceiptDiagnostics {
  /** Líneas con algo que parece código de barras. */
  codeLines: number;
  /** Códigos que pasaron el dígito de control (directo o corrigiendo letras). */
  validCodes: number;
  /** Códigos rescatados cambiando un dígito. */
  rescued: number;
  /** Líneas con código inválido que se descartaron. */
  discarded: number;
  /** Decisión por línea: regla usada y EAN validado. */
  lines: { text: string; rule: string; ean?: string }[];
}

export interface ParseOptions {
  /** Códigos conocidos (diccionario + nombres recordados): permiten rescatar un código mal leído. */
  knownEans?: Set<string>;
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
  /** "NUM ART ENTREGADOS: N" de la factura (unidades), si se leyó. */
  expectedCount: number | null;
  diagnostics: ReceiptDiagnostics;
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
  ["Snacks y dulces", /\b(GALLETAS?|BARQUILLOS?|GALL|NOEL|OREO|FESTIVAL|SALTIN|DUCALES|CHOCOLATES?|CHOCOLATINA|JET|GOMAS?|DULCES?|CARAMELOS?|CHUPETAS?|CHICLES?|BOCADILLO|MANI|PAPAS FRITAS|MARGARITA|DETODITO|CHEETOS|DORITOS|TODO RICO|CHITOS|ROSQUITAS|PAPAS MARGARITA)\b/],
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

/** "LECHE ENTERA ALQUERIA 1L" -> "Leche entera alqueria 1L" ("3X110G" y "X12" quedan en mayúsculas) */
function sentenceCase(s: string): string {
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.map((w) =>
    /^\d+(?:[.,]\d+)?[a-z]{1,3}$/.test(w) ||
    /^\d+x\d+(?:[.,]\d+)?[a-z]{0,3}$/.test(w) ||
    /^x\d+$/.test(w)
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
 * Código de barras de la fila: corrige las letras que el OCR confunde con
 * números (O→0, I/L→1, S→5, B→8, G→6, Z→2) y acepta solo si el dígito de
 * control cuadra. (Cambiar dígitos es otra cosa: ver rescueEan.)
 *   fixEan("77OO3O4448241") -> { ean: "7700304448241", corrected: true }
 *   fixEan("7700304448242") -> { ean: null, corrected: false }  (dígito de control inválido)
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
  return { ean: null, corrected: false };
}

/** Solo dígitos tras corregir letras ("77OO3O..." -> "7700300..."), o null. */
function codeDigits(token: string): string | null {
  const d = token
    .replace(/[OQD]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/Z/g, "2");
  return /^\d+$/.test(d) ? d : null;
}

// Dígitos que el OCR confunde entre sí (en los dos sentidos)
const RESCUE_SWAPS: Record<string, string[]> = {
  "0": ["8", "9"], "8": ["0", "3", "6"], "1": ["7"], "7": ["1"], "3": ["8"],
  "5": ["6"], "6": ["5", "8"], "9": ["0"],
};

/**
 * Rescate de un código que no pasa el dígito de control: prueba cambiar UN
 * dígito con confusiones típicas (0↔8, 1↔7, 3↔8, 5↔6, 6↔8, 0↔9). Acepta una
 * variante solo si (a) es un código conocido (diccionario o nombres
 * recordados), o (b) es la ÚNICA variante válida y comparte el prefijo de las
 * demás filas (p. ej. 7700304 de D1). Nunca inventa un código fuera de eso.
 *   rescueEan("7700304443241", { known: new Set(["7700304448241"]) }) -> "7700304448241"  (un 8 leído como 3)
 *   rescueEan("7700304443241", {})                                     -> null
 */
export function rescueEan(
  digits: string,
  ctx: { known?: Set<string>; prefix?: string | null } = {},
): string | null {
  if (!/^(\d{8}|\d{13})$/.test(digits) || isValidEan(digits)) return null;
  const variants = new Set<string>();
  for (let i = 0; i < digits.length; i++)
    for (const alt of RESCUE_SWAPS[digits[i]] ?? []) {
      const v = digits.slice(0, i) + alt + digits.slice(i + 1);
      if (isValidEan(v)) variants.add(v);
    }
  const list = [...variants];
  const known = list.filter((v) => ctx.known?.has(v));
  if (known.length === 1) return known[0];
  if (ctx.prefix && list.length === 1 && list[0].startsWith(ctx.prefix)) return list[0];
  return null;
}

type CodeHit = {
  start: number;
  end: number;
  /** EAN válido (por dígito de control, corregido o rescatado) o null si no se pudo. */
  ean: string | null;
  corrected: boolean;
  rescued: boolean;
};

/**
 * Busca un código de barras en la línea (8 a 14 caracteres, 6+ dígitos).
 * Devuelve el primero válido (o rescatado); si solo hay inválidos, el primero
 * con ean null (para el diagnóstico).
 */
function findCode(upper: string, ctx: { known?: Set<string>; prefix?: string | null }): CodeHit | null {
  let invalid: CodeHit | null = null;
  for (const m of upper.matchAll(/\S+/g)) {
    const token = m[0].replace(/[.,;:]+$/, "");
    if (!/^[0-9A-Z]{8,14}$/.test(token) || (token.match(/\d/g) ?? []).length < 6) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const fixed = fixEan(token);
    if (fixed.ean) return { start, end, ean: fixed.ean, corrected: fixed.corrected, rescued: false };
    const digits = codeDigits(token);
    const rescued = digits ? rescueEan(digits, ctx) : null;
    if (rescued) return { start, end, ean: rescued, corrected: true, rescued: true };
    if (!invalid && digits && (digits.length === 13 || digits.length === 8))
      invalid = { start, end, ean: null, corrected: false, rescued: false };
  }
  return invalid;
}

/** Código de una columna (D1, Ara): corrección de letras y, si hace falta, rescate. */
function resolveCode(token: string, ctx: { known?: Set<string>; prefix?: string | null }) {
  const fixed = fixEan(token);
  if (fixed.ean) return { ...fixed, rescued: false };
  const digits = codeDigits(token);
  const rescued = digits ? rescueEan(digits, ctx) : null;
  return rescued
    ? { ean: rescued, corrected: true, rescued: true }
    : { ean: null, corrected: false, rescued: false };
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
  [/\bMANI CON PASA$/, "MANÍ CON PASAS"],
  [/\bCON PASA$/, "CON PASAS"],
  [/\bBARQUILL\b/, "BARQUILLOS"],
  [/\bAREQUIP\w*$/, "AREQUIPE"],
  [/\bVAINIL\w*$/, "VAINILLA"],
  [/\bCHOCOLAT\b/, "CHOCOLATE"],
  [/\bGASEOS\b/, "GASEOSA"],
  [/\bNATURA\b/, "NATURAL"],
  [/\bAVENA HOJUEL\w*$/, "AVENA HOJUELAS"],
  [/\bLENTEJ\b/, "LENTEJAS"],
  [/\bFRIJOL\b/, "FRIJOLES"],
  [/\bDESINFECT\w*$/, "DESINFECTANTE"],
  [/\bLAVALOZ\w*$/, "LAVALOZA"],
];

/** "MORA CONGELAD" -> "MORA CONGELADA", "PAPAS A LA FR" -> "PAPAS A LA FRANCESA" */
export function completeTruncated(name: string): string {
  let out = name.trim();
  for (const [re, full] of COMPLETIONS) out = out.replace(re, full);
  return out;
}

// Palabras de enlace que no pueden terminar un nombre ("GALLETAS DE")
const CONNECTORS = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "PARA", "CON", "EN", "A", "Y", "AL", "SIN", "X"]);
// Palabras cortas (≤ 3 letras) que sí son palabras o abreviaturas válidas al final
const SHORT_OK = new Set([
  "SAL", "TE", "PAN", "RES", "AJO", "UVA", "AJI", "MIX", "ROA", "SOL", "OSO", "LUX", "AXE", "EGO",
  "FAB", "DET", "JAB", "QSO", "LCH", "HVO", "TAJ", "TOR", "HIT", "AA", "AAA", "UHT", "PET", "ZUM",
  "MAR", "RON", "GAS", "PIE", "BIO", "LIGHT", "PRO", "MAX", "UP", "XL", "XXL", "TIA", "TIO", "OREO",
]);
// Tamaños, unidades y números: "110G", "1L", "X12", "UN", "KG", "53", "1.5L", "3X110G"
const SIZE_OR_UNIT = /^(?:\d+(?:[.,]\d+)?|(?:\d+X)?\d+(?:[.,]\d+)?(?:G|GR|GRS|KG|ML|L|LT|CC|OZ|M|UN|UND)|X\d+|UN|UND|UNID|KG|GR|ML|LT|CC|OZ)$/;

/**
 * Nombre limpio cuando la factura lo recorta y no hay completado conocido:
 * 1) COMPLETIONS; 2) si la última palabra es un fragmento (1 a 3 letras que
 * no son palabra conocida, tamaño ni unidad), se quita; 3) se quitan las
 * palabras de enlace del final. Nunca deja el nombre vacío.
 *   cleanTruncatedName("BARQUILLOS SU")    -> "BARQUILLOS"
 *   cleanTruncatedName("SALSA PARA AD")    -> "SALSA PARA ADOBAR"   (COMPLETIONS)
 *   cleanTruncatedName("GALLETAS DE CH")   -> "GALLETAS"
 *   cleanTruncatedName("MANI CON PASA")    -> "MANÍ CON PASAS"
 *   cleanTruncatedName("ARROZ DIANA 500G") -> "ARROZ DIANA 500G"   (sin cambio)
 * Las palabras desconocidas de 4 letras o más NO se quitan: suelen ser marcas.
 */
export function cleanTruncatedName(name: string): string {
  const completed = completeTruncated(name);
  if (completed !== name.trim()) return completed;
  const words = completed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return completed;
  const last = words[words.length - 1];
  const isFragment =
    /^[A-ZÑ]{1,3}$/.test(last) && !SHORT_OK.has(last) && !VOCAB.has(last) && !SIZE_OR_UNIT.test(last);
  if (isFragment) words.pop();
  while (words.length > 1 && CONNECTORS.has(words[words.length - 1])) words.pop();
  const out = words.join(" ");
  // Debe quedar al menos una palabra de 3 letras; si no, el texto original.
  return /[A-ZÑ]{3,}/.test(out) ? out : completed;
}

/* ------------------------------------------------------------------ */
/*  Cantidad dentro del nombre                                          */
/* ------------------------------------------------------------------ */

const UNIT_WORD = /^(?:ML|L|LT|LTS|G|GR|GRS|KG|CC|OZ|M|CM|MM)$/;
const PACK_WORD = /^(?:PACK|PK|SIXPACK|SIX|ROLLOS?|UNIDADES|PAQ)$/;
// Al inicio: "3 CERVEZAS", "3CERVEZAS", "3 UN CERVEZA", "3UND CERVEZA", "3 X CERVEZA"
const QTY_START = /^(\d{1,2})\s*(?:(?:UNID|UND|UN|U)\b\s*)?(?:[X*]\s+)?(?=[A-ZÑ])/;
// Al final (o antes del tamaño): "CERVEZA AGUILA 3 UN", "X 3 UN", "PONY MALTA 6 UN 330ML"
const QTY_END = /\s(?:X\s*)?(\d{1,2})\s*(?:UNIDS?|UNDS?|UN|U)\b/;

/**
 * Separa la cantidad del nombre. No toca tamaños ni empaques: "HUEVOS X12",
 * "6 PACK", "3X110G", "500ML", "12 ROLLOS". Con cantidad > 1 la primera
 * palabra pasa a singular si es un plural simple conocido.
 *   extractQuantity("3 CERVEZAS")            -> { name: "CERVEZA", quantity: 3, fromName: true }
 *   extractQuantity("3CERVEZAS")             -> { name: "CERVEZA", quantity: 3, fromName: true }
 *   extractQuantity("CERVEZA AGUILA 3 UN")   -> { name: "CERVEZA AGUILA", quantity: 3, fromName: true }
 *   extractQuantity("PONY MALTA 6 UN 330ML") -> { name: "PONY MALTA 330ML", quantity: 6, fromName: true }
 *   extractQuantity("HUEVOS X12")            -> { name: "HUEVOS X12", quantity: 1, fromName: false }
 *   extractQuantity("3X110G JABON PROTEX")   -> { name: "3X110G JABON PROTEX", quantity: 1, fromName: false }
 */
export function extractQuantity(line: string): { name: string; quantity: number; fromName: boolean } {
  let name = line.trim();
  let quantity = 1;
  let fromName = false;

  const s = QTY_START.exec(name);
  if (s) {
    const rest = name.slice(s[0].length).trim();
    const first = rest.split(/\s+/)[0] ?? "";
    // Lo que sigue debe ser una palabra de verdad (no "X110G", "ML", "PACK", "ROLLOS")
    const isWord = /^[A-ZÑ]{3,}/.test(first) && !/^X\d/.test(first) && !UNIT_WORD.test(first) && !PACK_WORD.test(first);
    if (isWord && Number(s[1]) >= 1) {
      quantity = Number(s[1]);
      name = rest;
      fromName = true;
    }
  }
  if (!fromName) {
    const e = QTY_END.exec(name);
    if (e && Number(e[1]) >= 1) {
      quantity = Number(e[1]);
      name = (name.slice(0, e.index) + name.slice(e.index + e[0].length)).replace(/\s{2,}/g, " ").trim();
      fromName = true;
    }
  }
  // Plural simple -> singular: CERVEZAS -> CERVEZA, LIMONES -> LIMON (solo si el
  // singular es conocido y el plural no lo es: "PAPAS A LA FRANCESA" no cambia).
  if (fromName && quantity > 1) {
    const words = name.split(" ");
    const w = words[0];
    const candidates = [w.replace(/ES$/, ""), w.replace(/S$/, "")].filter((c) => c !== w && c.length >= 3);
    const sing = candidates.find((c) => VOCAB.has(c));
    if (sing && !VOCAB.has(w)) {
      words[0] = sing;
      name = words.join(" ");
    }
  }
  return { name, quantity, fromName };
}

/** ¿unitario × cantidad ≈ total? (tolerancia de $1 o 2 %) */
function quantityMatches(unit: number, qty: number, total: number): boolean {
  return Math.abs(unit * qty - total) <= Math.max(1, total * 0.02);
}

// Línea de peso: "0,450 KG X 4.200" -> 0.45 kg; "450 GR X 9.800" -> 0.45 kg
const WEIGHT_VALUE = /^\s*(\d+(?:[.,]\d+)?)\s*(KGS?|GRS?|G|LB)\b/;
function weightKg(line: string): number | null {
  const m = WEIGHT_VALUE.exec(line);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  const kg = /^G/.test(m[2]) ? v / 1000 : /^LB/.test(m[2]) ? v * 0.4536 : v;
  return kg > 0 && kg < 100 ? Math.round(kg * 1000) / 1000 : null;
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

export function parseReceipt(text: string, options: ParseOptions = {}): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  const upperLines = lines.map((l) => stripAccents(l.toUpperCase()));

  // ¿Factura con columnas? Por la cabecera de D1 o por la forma de las filas
  // (D1 o Ara). "Código + nombre + precio" no cuenta: el Éxito mezcla líneas
  // con y sin código.
  const columnRows = upperLines.filter((l) => D1_ROW.test(l) || COLUMN_ROW.test(l)).length;

  // El código de barras manda: se cuentan las líneas con un EAN válido y el
  // prefijo que comparten (7700304 = marca propia de D1).
  const strictEans: string[] = [];
  let nonCodePriced = 0;
  for (const l of upperLines) {
    const hit = findCode(l, {});
    if (hit?.ean) strictEans.push(hit.ean);
    else if (
      PRICE_SUFFIX.test(l) &&
      !TOTAL_LINE.test(l) &&
      !SKIP.test(l) &&
      !NOISE.test(l) &&
      !WEIGHT_LINE.test(l) &&
      !PRICE_ONLY.test(l)
    )
      nonCodePriced++;
  }
  const prefixCount = new Map<string, number>();
  for (const e of strictEans)
    if (e.length === 13) prefixCount.set(e.slice(0, 7), (prefixCount.get(e.slice(0, 7)) ?? 0) + 1);
  const prefix = [...prefixCount.entries()].sort((a, b) => b[1] - a[1]).find(([, n]) => n >= 2)?.[0] ?? null;
  const ctx = { known: options.knownEans, prefix };
  // "Modo código": 2 o más códigos válidos y son la mayoría de las filas con
  // precio. Así una factura del Éxito, que mezcla filas con y sin código, sigue
  // aceptando las filas sin código.
  const codeMode = strictEans.length >= 2 && strictEans.length > nonCodePriced;
  const columnar = upperLines.some((l) => D1_HEADER.test(l)) || columnRows >= 2 || codeMode;
  let expectedCount: number | null = null;
  const diag: ReceiptDiagnostics = { codeLines: 0, validCodes: 0, rescued: 0, discarded: 0, lines: [] };
  const note = (text: string, rule: string, ean?: string | null) =>
    diag.lines.push({ text, rule, ...(ean ? { ean } : {}) });

  type Candidate = ReceiptItem & { priced: boolean; continuable: boolean };
  const found: Candidate[] = [];
  let pendingQty: number | null = null;
  let pendingWeight: number | null = null; // kg de una línea de peso, para el producto siguiente
  let lastWasProduct = false; // la línea anterior fue un nombre (para unir nombres partidos)
  let total: number | null = null;

  const make = (
    rawName: string,
    quantity: number,
    original: string,
    priced: boolean,
    corrected: boolean,
    continuable: boolean,
    extra: {
      ean?: string | null;
      total?: number;
      unit?: "un" | "kg";
      qtyMismatch?: boolean;
      qtyUnknown?: boolean;
      rescued?: boolean;
    } = {},
  ): Candidate => {
    const name = cleanTruncatedName(rawName);
    const category = guessCategory(name);
    const unit = extra.unit ?? "un";
    return {
      name: sentenceCase(name),
      sourceText: rawName.trim(),
      unit,
      // Por unidades: entero de 1 a 99. Por peso: kg con 3 decimales.
      quantity:
        unit === "kg"
          ? Math.round(quantity * 1000) / 1000
          : Math.min(Math.max(Math.round(quantity), 1), 99),
      ...(extra.qtyMismatch ? { qtyMismatch: true } : {}),
      ...(extra.qtyUnknown ? { qtyUnknown: true } : {}),
      ...(extra.rescued ? { rescued: true } : {}),
      nameSource: "Factura",
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
      note(original, "TOTAL");
      lastWasProduct = false;
      continue;
    }
    // "NUM ART ENTREGADOS: 9": cuántas unidades debería tener la factura.
    const na = /\bNUM\.?\s*ART\w*\s*(?:ENTREGADOS?)?\s*:?\s*(\d{1,3})\b/.exec(upper);
    if (na) {
      expectedCount = Number(na[1]);
      note(original, "NUM ART ENTREGADOS");
      lastWasProduct = false;
      continue;
    }
    const codeHit = findCode(upper, ctx);
    if (codeHit) {
      diag.codeLines++;
      if (codeHit.ean && !codeHit.rescued) diag.validCodes++;
      if (codeHit.rescued) diag.rescued++;
    }

    // 1) Fila D1 completa
    const d1 = D1_ROW.exec(upper);
    if (d1) {
      const desc = cleanDesc(d1[5]);
      const code = resolveCode(d1[4], ctx);
      if (looksLikeName(desc)) {
        const qty = Number(d1[2]) || 1;
        const lineTotal = parseMoney(d1[6]);
        found.push(
          make(desc, qty, original, true, code.corrected, false, {
            ean: code.ean,
            total: lineTotal,
            // Cantidad de la columna; si unitario × cantidad no da el total, se marca.
            qtyMismatch: !quantityMatches(parseMoney(d1[3]), qty, lineTotal),
            rescued: code.rescued,
          }),
        );
        note(original, "D1 completa", code.ean);
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
      const unitPrice = prices.length >= 2 ? parseMoney(prices[prices.length - 2]) : undefined;
      const qty = Number(col[2]);
      if (looksLikeName(name)) {
        found.push(
          make(name, qty, original, true, fixOcrWords(upper).corrected, false, {
            ean: code.ean,
            total: lineTotal,
            qtyMismatch:
              unitPrice !== undefined && lineTotal !== undefined && !quantityMatches(unitPrice, qty, lineTotal),
          }),
        );
      }
      lastWasProduct = false;
      continue;
    }

    // 3) El código de barras como ancla: toda línea con un EAN válido es un
    //    producto, aunque no tenga cantidad ni precio (foto recortada):
    //    "7700304448241 TORTILLA FAJI". La descripción va después del código
    //    (o en la línea siguiente si el OCR la partió). Cantidad y precio son
    //    opcionales; sin ellos: cantidad 1 y "revisar cantidad".
    if (codeHit?.ean) {
      const before = upper.slice(0, codeHit.start).trim();
      let rest = " " + upper.slice(codeHit.end).trim();
      const prices: number[] = [];
      while (PRICE_SUFFIX.test(rest)) {
        const m = PRICE_SUFFIX.exec(rest)!;
        prices.push(parseMoney(m[0].replace(/\s+[A-Z0-9]\s*$/, "")));
        rest = rest.replace(PRICE_SUFFIX, "");
      }
      if (prices.length) rest = rest.replace(TAX_TAIL, "");
      let desc = cleanDesc(fixOcrWords(rest.trim()).line);
      let raw = original;
      // Descripción en la línea siguiente (sin código, con letras)
      if (!looksLikeName(desc) && li + 1 < lines.length) {
        const next = upperLines[li + 1];
        const nd = cleanDesc(fixOcrWords(next.replace(PRICE_SUFFIX, "")).line);
        if (
          !findCode(next, ctx) &&
          !SKIP.test(next) &&
          !NOISE.test(next) &&
          !TOTAL_LINE.test(next) &&
          looksLikeName(nd)
        ) {
          desc = nd;
          raw = original + " / " + lines[li + 1];
          li++;
        }
      }
      // Cantidad: columna antes del código ("1 2 UN 3.090 7700…"), línea anterior o dentro del nombre
      let qty: number | null = pendingQty;
      const pre = new RegExp(String.raw`^\s*\d{1,3}\s+(\d{1,3})\s*${UNIT}\b`).exec(before);
      if (pre) qty = Number(pre[1]);
      if (qty === null && desc) {
        const q = extractQuantity(desc);
        if (q.fromName) {
          qty = q.quantity;
          desc = q.name;
        }
      }
      const qtyUnknown = qty === null && prices.length === 0;
      found.push(
        make(
          desc && looksLikeName(desc) ? desc : `PRODUCTO ${codeHit.ean}`,
          qty ?? 1,
          raw,
          true,
          codeHit.corrected,
          false,
          { ean: codeHit.ean, total: prices[0], qtyUnknown, rescued: codeHit.rescued },
        ),
      );
      note(raw, codeHit.rescued ? "código rescatado" : "código", codeHit.ean);
      pendingQty = null;
      lastWasProduct = false;
      continue;
    }
    if (codeHit && !codeHit.ean) {
      diag.discarded++;
      // Con varios códigos válidos en la factura, una fila de código inválido no se inventa.
      if (codeMode) {
        note(original, "código inválido (descartada)");
        lastWasProduct = false;
        continue;
      }
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
    // Peso: "0,450 KG X 4.200 1.890". Va al producto de la línea anterior si
    // aún no tenía precio; si no, al siguiente ("0,450 KG X 4.200" + "BANANO").
    if (WEIGHT_LINE.test(upper)) {
      const kg = weightKg(upper);
      const prev = found.at(-1);
      if (kg && prev && lastWasProduct && !prev.priced && prev.unit !== "kg") {
        prev.quantity = kg;
        prev.unit = "kg";
        const m = PRICE_SUFFIX.exec(upper);
        if (m) {
          prev.priced = true;
          prev.total = parseMoney(m[0].replace(/\s+[A-Z]\s*$/, ""));
        }
      } else if (kg) pendingWeight = kg;
      lastWasProduct = false;
      continue;
    }
    if (SKIP.test(upper) || NOISE.test(upper)) {
      note(original, "ruido (pie, pagos, dirección)");
      lastWasProduct = false;
      continue;
    }
    // En una factura de columnas, una línea sin código ni columnas no es un producto
    // ("TARJ CRE/DEB", "ARO", la dirección…).
    if (columnar) {
      note(original, codeMode ? "sin código (factura con códigos)" : "sin columnas (factura de columnas)");
      lastWasProduct = false;
      continue;
    }

    // 4) Tiquete sin columnas: nombre + precio
    const fixed = fixOcrWords(upper);
    let line = fixed.line;
    const hadCode = CODE_PREFIX.test(line);
    line = line.replace(CODE_PREFIX, "");

    let priced = false;
    const prices: number[] = []; // de derecha a izquierda: [total, unitario?]
    while (PRICE_SUFFIX.test(line)) {
      const m = PRICE_SUFFIX.exec(line)!;
      prices.push(parseMoney(m[0].replace(/\s+[A-Z]\s*$/, "")));
      line = line.replace(PRICE_SUFFIX, "");
      priced = true;
    }
    const lineTotal: number | undefined = prices[0];
    if (priced || hadCode) line = line.replace(TAX_TAIL, "");

    // Cantidad: "2 X LECHE", "3 CERVEZAS", "3CERVEZAS", "CERVEZA AGUILA 3 UN"…
    line = cleanDesc(line);
    let quantity = pendingQty ?? 1;
    pendingQty = null;
    const q2 = extractQuantity(line);
    const pre = q2.fromName;
    if (q2.fromName) {
      quantity = q2.quantity;
      line = q2.name;
    }
    // Si hay unitario y total, la cantidad debe cuadrar; si no, 1 y baja confianza.
    let qtyMismatch = false;
    if (prices.length >= 2 && quantity > 1 && !quantityMatches(prices[1], quantity, prices[0])) {
      quantity = 1;
      qtyMismatch = true;
    }
    const weight = pendingWeight;
    pendingWeight = null;

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
      const name = (prev.sourceText ?? stripAccents(prev.name.toUpperCase())) + " " + line;
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
      make(line, weight ?? quantity, original, priced || hadCode, fixed.corrected, !isStore, {
        total: lineTotal,
        qtyMismatch,
        ...(weight ? { unit: "kg" as const } : {}),
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
      (!!it.corrected && totalMatches !== true) ||
      !!it.qtyMismatch,
  }));

  // Sin encabezado en la foto: si los códigos son de marca propia de D1 (7700304…), es D1.
  const store =
    detectStore(lines) ?? (strictEans.filter((e) => e.startsWith("7700304")).length >= 2 ? "D1" : null);

  return {
    store,
    items,
    text,
    total,
    sum,
    totalMatches,
    purchaseDate: detectPurchaseDate(lines),
    columnar,
    expectedCount,
    diagnostics: diag,
  };
}

/** Clave para unir una misma fila leída en dos fotos: EAN o descripción normalizada. */
function itemKey(it: ReceiptItem): string {
  return it.ean ?? normalizeName(it.sourceText ?? it.name).replace(/\s+/g, " ").trim();
}

/**
 * Une dos lecturas de la misma factura (escaneo por partes). Los productos
 * repetidos se unen por EAN (o por descripción) SIN sumar cantidades: se
 * queda la lectura con más datos (con precio o cantidad conocida).
 *   mergeReceipts(filas 1-5, filas 4-8) -> 8 productos
 */
export function mergeReceipts(a: ParsedReceipt, b: ParsedReceipt): ParsedReceipt {
  const byKey = new Map<string, ReceiptItem>();
  const score = (it: ReceiptItem) =>
    (it.total ? 2 : 0) + (it.qtyUnknown ? 0 : 1) + (it.lowConfidence ? 0 : 1);
  for (const it of [...a.items, ...b.items]) {
    const k = itemKey(it);
    const prev = byKey.get(k);
    if (!prev || score(it) > score(prev)) byKey.set(k, it);
  }
  const items = [...byKey.values()];
  const total = a.total ?? b.total;
  const sum = items.reduce((acc, it) => acc + (it.total ?? 0), 0);
  const allPriced = items.length > 0 && items.every((it) => it.total !== undefined);
  return {
    store: a.store ?? b.store,
    items,
    text: [a.text, b.text].filter(Boolean).join("\n——— otra parte ———\n"),
    total,
    sum,
    totalMatches: total !== null && allPriced ? Math.abs(sum - total) <= 1 : null,
    purchaseDate: a.purchaseDate ?? b.purchaseDate,
    columnar: a.columnar || b.columnar,
    expectedCount: a.expectedCount ?? b.expectedCount,
    diagnostics: {
      codeLines: a.diagnostics.codeLines + b.diagnostics.codeLines,
      validCodes: a.diagnostics.validCodes + b.diagnostics.validCodes,
      rescued: a.diagnostics.rescued + b.diagnostics.rescued,
      discarded: a.diagnostics.discarded + b.diagnostics.discarded,
      lines: [...a.diagnostics.lines, ...b.diagnostics.lines],
    },
  };
}

/**
 * ¿Faltan productos según la factura? Compara las unidades detectadas con
 * "NUM ART ENTREGADOS" y la suma con el TOTAL. null si no falta nada o no hay
 * con qué comparar.
 *   missingInfo(factura con 6 unidades y "NUM ART ENTREGADOS: 9") -> { missingUnits: 3, missingValue: 0 }
 */
export function missingInfo(r: ParsedReceipt): { missingUnits: number; missingValue: number } | null {
  if (r.expectedCount === null && r.total === null) return null;
  const units = r.items.reduce((acc, it) => acc + (it.unit === "kg" ? 1 : it.quantity), 0);
  const missingUnits = r.expectedCount !== null ? Math.max(0, r.expectedCount - units) : 0;
  // La suma solo se compara si todos los productos tienen valor (si no, no es falta, es foto recortada).
  const allPriced = r.items.length > 0 && r.items.every((it) => it.total !== undefined);
  const missingValue = r.total !== null && allPriced && r.sum < r.total - 1 ? r.total - r.sum : 0;
  return missingUnits > 0 || missingValue > 0 ? { missingUnits, missingValue } : null;
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
