import { ESTIMATED_DAYS } from "@/constants/pantry";

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
  /** Línea original del OCR, útil para mostrar qué se leyó. */
  raw: string;
}

export interface ParsedReceipt {
  store: string | null;
  items: ReceiptItem[];
  /** Texto completo que devolvió el OCR (para revisar qué se leyó). */
  text: string;
}

// Líneas que no son productos: totales, pagos, datos legales, encabezado.
const SKIP =
  /\b(SUB\s*TOTAL|TOTAL|IVA|IMPTO|IMPUESTO|INC|NIT|FACTURA|RESOL|DIAN|CUFE|CAJA|CAJERO|CAMBIO|EFECTIVO|TARJETA|DEBITO|CREDITO|VUELTO|PAGO|PAGADO|FECHA|HORA|DIRECCION|DIR|TEL|TELEFONO|CEL|GRACIAS|CLIENTE|ITEMS?|ARTICULOS|DESCUENTOS?|AHORRO|PUNTOS|BASE|REDONDEO|REGIMEN|AUTORRET\w*|TIQUETE|TICKET|VENTA|DEVOLUCION|PROPINA|BOLSAS?|CODIGO|DESCRIP\w*|VALOR|PLU|EAN|SALDO|RECIBIDO|DOMICILIO|CALLE|CARRERA|CRA|CLL|AVENIDA|BARRIO|WWW|COM|SAS|LTDA|S\.A\.?S?)\b/;

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
const CATEGORY_WORDS: [string, RegExp][] = [
  // Primero condimentos y aseo: "CONDIMENTO AJO" no es una verdura.
  ["Otros", /\b(CONDIM\w*|SAZON\w*|ADOBO|CALDO|SALSA|COLGATE|CREMA DENTAL|DETERG\w*|JABON|SHAMPOO|PAPEL|SERVILLETAS?|CUCHIL\w*|SUAVIZANTE|LIMPIA\w*|BLANQUEADOR|DESODORANTE)\b/],
  ["Lácteos", /\b(LECHE|LCH|YOGU?R|KUMIS|QUESO|QSO|MANTEQ|MANTEQUILLA|CREMA|KUMIS|AVENA LIQ|ALPINA|ALQUERIA|COLANTA|HUEVOS?|HVO)\b/],
  ["Panadería", /\b(PAN|PANES|TAJADO|MOGOLLA|CROISSANT|TOSTADAS?|BIMBO|PONQUE|GALLETA?S?|DONUT|DONA|NOEL|TOR|TORTA)\b/],
  ["Enlatados", /\b(ATUN|SARDINAS?|LATA|ENLAT\w*|SALCHICHAS? LATA|MAIZ TIERNO|ARVEJA LATA|VAN CAMPS)\b/],
  ["Carnes", /\b(POLLO|PECHUGA|MUSLOS?|CARNE|RES|CERDO|LOMO|COSTILLA|MOLIDA|CHORIZO|SALCHICHA|JAMON|TOCINETA|PESCADO|TILAPIA|MOJARRA)\b/],
  ["Frutas y verduras", /\b(TOMATE|CEBOLLA|PAPA|PAPAS|ZANAHORIA|LECHUGA|AGUACATE|BANANO|PLATANO|MANZANAS?|NARANJAS?|LIMON|LIMONES|MANGO|FRESAS?|MORA|PIÑA|PINA|UVAS?|PAPAYA|AJO|PIMENTON|BROCOLI|ESPINACA|PEPINO|AHUYAMA|YUCA|ARRACACHA|MANDARINA|GUAYABA|MARACUYA|LULO|CILANTRO)\b/],
  ["Bebidas", /\b(GASEOSA|COCA|POSTOBON|JUGO|AGUA|TE|CAFE|CERVEZA|REFRESCO|HIT|NECTAR|COCA COLA|BEBIDA|PONY|COLOMBIANA)\b/],
  ["Granos", /\b(ARROZ|FRIJOL|FRIJOLES|LENTEJAS?|GARBANZOS?|PASTA|SPAGHETTI|ESPAGUETI|MACARRON\w*|AVENA|HARINA|AZUCAR|PANELA|SAL|MAIZ|CEREAL|DIANA|ROA|DORIA)\b/],
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function guessCategory(name: string): string {
  const up = stripAccents(name.toUpperCase());
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
  // Condimentos y productos de aseo: no se vencen pronto
  [/\b(CONDIM\w*|SAZON\w*|ADOBO|CALDO|SALSA|COLGATE|CREMA DENTAL|DETERG\w*|JABON|SHAMPOO|PAPEL|SERVILLETAS?|CUCHIL\w*|SUAVIZANTE|LIMPIA\w*|BLANQUEADOR|DESODORANTE)\b/, 365],
  // Lácteos y huevos
  [/\b(UHT|LARGA VIDA)\b/, 90],
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
  // Panadería
  [/\b(DONUT|DONA|CROISSANT|PANDEBONO|ALMOJABANA)\b/, 3],
  [/\b(PAN|TAJADO|TAJ|MOGOLLA)\b/, 6],
  [/\b(PONQUE|TORTA|TOR|BROWNIE)\b/, 10],
  [/\b(GALLETAS?|NOEL|TOSTADAS?)\b/, 90],
  // Frutas y verduras
  [/\b(FRESAS?|MORA|UVAS?|LECHUGA|ESPINACA|CILANTRO|PEREJIL)\b/, 4],
  [/\b(BANANO|PLATANO|AGUACATE|PAPAYA|MANGO|GUAYABA|YUCA)\b/, 5],
  [/\b(TOMATE|PEPINO|PIMENTON|BROCOLI|AHUYAMA|MARACUYA|LULO)\b/, 7],
  [/\b(NARANJAS?|MANDARINAS?|LIMON|LIMONES|ZANAHORIA)\b/, 14],
  [/\b(MANZANAS?|PERAS?)\b/, 21],
  [/\b(PAPA|PAPAS|CEBOLLA|AJO)\b/, 30],
  // Bebidas
  [/\b(JUGO|NECTAR|HIT)\b/, 90],
  [/\b(GASEOSA|COCA|POSTOBON|PONY|COLOMBIANA|CERVEZA)\b/, 180],
  [/\bAGUA\b/, 365],
  // Despensa seca
  [/\b(CAFE|AVENA|HARINA|CEREAL|PANELA)\b/, 180],
  [/\b(ARROZ|FRIJOL\w*|LENTEJAS?|GARBANZOS?|PASTA|SPAGHETTI|ESPAGUETI|AZUCAR|SAL|ACEITE|TE|CONDIM\w*|SALSA)\b/, 365],
  [/\b(ATUN|SARDINAS?|LATA|ENLAT\w*)\b/, 365],
];

/** Días aproximados de vida útil: por tipo de producto, si no por categoría. */
export function estimateDays(name: string, category: string): number {
  const up = stripAccents(name.toUpperCase());
  for (const [re, days] of SHELF_LIFE) if (re.test(up)) return days;
  return ESTIMATED_DAYS[category] ?? 30;
}

/** "LECHE ENTERA ALQUERIA 1L" -> "Leche entera alqueria 1L" */
function sentenceCase(s: string): string {
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.map((w) => (/^\d+(?:[.,]\d+)?[a-z]{1,3}$/.test(w) ? w.toUpperCase() : w));
  const joined = out.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function letters(s: string): number {
  return (s.match(/[A-ZÑ]/g) ?? []).length;
}

export function detectStore(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const up = stripAccents(line.toUpperCase());
    const chain = CHAINS.find((c) => new RegExp(`\\b${c}\\b`).test(up));
    if (chain) return sentenceCase(chain);
  }
  return null;
}

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  type Candidate = ReceiptItem & { priced: boolean };
  const found: Candidate[] = [];
  let pendingQty: number | null = null;

  for (const original of lines) {
    let line = stripAccents(original.toUpperCase());

    // Línea de solo cantidad: se la damos al producto anterior.
    const q = QTY_LINE.exec(line);
    if (q) {
      const qty = Number(q[1]);
      if (found.length) found[found.length - 1].quantity = qty;
      else pendingQty = qty;
      continue;
    }

    // Precio suelto: pertenece al producto de la línea anterior.
    if (PRICE_ONLY.test(line)) {
      if (found.length) found[found.length - 1].priced = true;
      continue;
    }
    if (WEIGHT_LINE.test(line)) continue;
    if (SKIP.test(line)) continue;

    const col = COLUMN_ROW.exec(line);
    if (col) {
      const name = col[1].replace(TAX_CODE_SUFFIX, "").replace(/[^A-ZÑ0-9 .,%/-]/g, " ").replace(/\s{2,}/g, " ").trim();
      if (letters(name) >= 3 && !SKIP.test(name)) {
        found.push({
          name: sentenceCase(name),
          quantity: Math.min(Math.max(Number(col[2]), 1), 99),
          category: guessCategory(name),
          days: estimateDays(name, guessCategory(name)),
          raw: original,
          priced: true,
        });
      }
      continue;
    }

    const hadCode = CODE_PREFIX.test(line);
    line = line.replace(CODE_PREFIX, "");

    let priced = false;
    while (PRICE_SUFFIX.test(line)) {
      line = line.replace(PRICE_SUFFIX, "");
      priced = true;
    }

    let quantity = pendingQty ?? 1;
    pendingQty = null;
    const pre = QTY_PREFIX.exec(line);
    if (pre) {
      quantity = Number(pre[1]);
      line = line.replace(QTY_PREFIX, "");
    }

    line = line.replace(/[^A-ZÑ0-9 .,%/-]/g, " ").replace(/\s{2,}/g, " ").trim();
    // Debe parecer un nombre: al menos 3 letras y una palabra de 3 o más.
    if (letters(line) < 3 || !/[A-ZÑ]{3,}/.test(line)) continue;
    if (letters(line) / line.replace(/\s/g, "").length < 0.5) continue;

    found.push({
      name: sentenceCase(line),
      quantity: Math.min(Math.max(quantity, 1), 99),
      category: guessCategory(line),
      days: estimateDays(line, guessCategory(line)),
      raw: original,
      priced: priced || hadCode,
    });
  }

  // Si la factura trae precios, nos quedamos solo con las líneas que tenían
  // precio o código: así se descartan encabezados y publicidad.
  const pricedCount = found.filter((f) => f.priced).length;
  const pool = pricedCount >= 2 ? found.filter((f) => f.priced) : found;

  // Productos repetidos en líneas distintas se suman.
  const merged = new Map<string, ReceiptItem>();
  for (const { priced: _p, ...item } of pool) {
    const key = item.name.toLowerCase();
    const prev = merged.get(key);
    if (prev) prev.quantity = Math.min(prev.quantity + item.quantity, 99);
    else merged.set(key, { ...item });
  }

  return { store: detectStore(lines), items: [...merged.values()].slice(0, 40), text };
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
