import { COLORS } from '@/constants/pantry';

export type Status = 'vigente' | 'proximo' | 'vencido';

/** Un producto es "próximo a vencer" si le quedan 7 días o menos. */
export const SOON_DAYS = 7;

const MS_DAY = 86_400_000;

export const STATUS_INFO: Record<
  Status,
  { label: string; emoji: string; color: string; bg: string }
> = {
  vigente: { label: 'Vigente', emoji: '🟢', color: COLORS.ok, bg: COLORS.okSoft },
  proximo: { label: 'Próximo a vencer', emoji: '🟡', color: COLORS.warningText, bg: COLORS.warningSoft },
  vencido: { label: 'Vencido', emoji: '🔴', color: COLORS.danger, bg: COLORS.dangerSoft },
};

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Días que faltan para la fecha (negativo si ya pasó). */
export function daysUntil(date: Date, today: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / MS_DAY);
}

export function getStatus(date: Date, today: Date = new Date()): Status {
  const days = daysUntil(date, today);
  if (days < 0) return 'vencido';
  if (days <= SOON_DAYS) return 'proximo';
  return 'vigente';
}

export function statusText(days: number): string {
  if (days < -1) return `Venció hace ${-days} días`;
  if (days === -1) return 'Venció ayer';
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

/** Date -> "30/09/2026" */
export function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Crea una fecha solo si es real (rechaza 31/02, mes 13, etc.). */
export function buildDate(year: number, month: number, day: number): Date | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** "30/09/2026" -> Date (o null si es inválida). */
export function parseDate(text: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  return buildDate(Number(m[3]), Number(m[2]), Number(m[1]));
}

/** Date -> "2026-09-30" (formato con el que se guarda en SQLite; ordena bien como texto). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-09-30" -> Date (o null si el texto guardado no es una fecha válida). */
export function fromISODate(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Mientras el usuario escribe: deja solo números y agrega las barras. "30092026" -> "30/09/2026" */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

/* ------------------------------------------------------------------ */
/*  Detección de la fecha de vencimiento en el texto que devuelve OCR  */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  ENE: 1, JAN: 1, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, AUG: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12, DEC: 12,
};

export const MONTH_ABBR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Palabras que acompañan a la fecha de vencimiento y a la de fabricación.
const KEYWORD = /VENC\w*|\bVTO\b|\bEXP\w*|CONSUM\w*|BEST BEFORE|USE BY|\bBBE\b|CADUC\w*|\bF\.?\s?V\b\.?/g;
// Fabricación, envasado o lote: si la fecha más cercana va con estas, no es la de vencimiento.
const MANUFACTURE = /\bELAB\w*|\bFAB\w*|\bPROD\w*|\bMFD\b|\bMFG\b|\bENV\w*|\bEMPAC\w*|\bL[O0]TE?\b|\bF\.?\s?E\b\.?/g;

export type DateConfidence = "alta" | "media" | "baja";

export interface DetectedDate {
  date: Date;
  /** Texto de la fecha tal como se leyó ("15/1O/2026"). */
  raw: string;
  /** alta: junto a VENCE/EXP…; media: era la única fecha; baja: hubo corrección, solo mes/año o varias sin palabra clave. */
  confidence: DateConfidence;
  /** Solo mes y año ("11/2026"): se toma el último día del mes. */
  monthOnly: boolean;
  /** Se corrigió una confusión del OCR (O→0, I/L→1, S→5, B→8). */
  corrected: boolean;
}

function normalizeYear(raw: string): number {
  const y = Number(raw);
  return raw.length === 2 ? 2000 + y : y;
}

/** Último día del mes: (2026, 11) -> 30/11/2026 */
function endOfMonth(year: number, month: number): Date | null {
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return new Date(year, month, 0);
}

// Algo con forma de fecha numérica, con letras que el OCR confunde con números:
// "15/1O/2026", "O1-12-27", "2O26-11-15".
const DATE_LIKE = /(^|[^A-Z0-9])([0-9OILSB]{1,4}(?:[/\-.][0-9OILSB]{1,4}){1,2})(?=$|[^A-Z0-9])/g;

/** Corrige O→0, I/L→1, S→5, B→8 solo dentro de tokens con forma de fecha. */
function fixDateTokens(line: string): { line: string; fixed: Set<string> } {
  const fixed = new Set<string>();
  const out = line.replace(DATE_LIKE, (all, before: string, token: string) => {
    if ((token.match(/\d/g) ?? []).length < 2 || !/[OILSB]/.test(token)) return all;
    const digits = token.replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
    fixed.add(digits);
    return before + digits;
  });
  return { line: out, fixed };
}

type Found = {
  date: Date;
  raw: string;
  index: number;
  end: number;
  monthOnly: boolean;
  corrected: boolean;
  kind: "keyword" | "manufacture" | "none";
};

/** Qué marca está más cerca ANTES de la fecha (o, si no hay, después). */
function markerFor(line: string, index: number, end: number): Found["kind"] {
  const before = line.slice(0, index);
  const lastOf = (re: RegExp, s: string) => {
    let pos = -1;
    for (const m of s.matchAll(new RegExp(re.source, "g"))) pos = m.index ?? pos;
    return pos;
  };
  const kw = lastOf(KEYWORD, before);
  const mf = lastOf(MANUFACTURE, before);
  if (kw >= 0 || mf >= 0) return kw > mf ? "keyword" : "manufacture";
  const after = line.slice(end);
  const kwA = after.search(new RegExp(KEYWORD.source));
  const mfA = after.search(new RegExp(MANUFACTURE.source));
  if (kwA >= 0 && (mfA < 0 || kwA < mfA)) return "keyword";
  if (mfA >= 0) return "manufacture";
  return "none";
}

/**
 * Busca la fecha de vencimiento en el texto del OCR.
 * Formatos: 15/11/2026, 15-11-26, 15.11.26, 15 11 2026, 2026-11-15,
 * 15 NOV 2026, 15NOV26, NOV 2026, 11/2026 y 11-26 (solo mes y año = último
 * día del mes). Prefiere fechas junto a VENCE, EXP, F.V…; descarta las de
 * fabricación (ELAB, FAB, LOTE…) si hay otra; ignora las absurdas (más de 5
 * años adelante o más de 1 año atrás). Sin palabra clave, toma la más lejana.
 *
 *   detectExpirationDate("L0TE 123 VENC 15/1O/2026")
 *   // { date: 15/10/2026, raw: "15/1O/2026", confidence: "baja", corrected: true, monthOnly: false }
 */
export function detectExpirationDate(text: string, today: Date = new Date()): DetectedDate | null {
  const found: Found[] = [];
  const min = addDays(today, -365);
  const max = addDays(today, 5 * 365 + 1);

  for (const originalLine of text.split(/\r?\n/)) {
    const upper = originalLine.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const { line, fixed } = fixDateTokens(upper);
    const hasKeyword = new RegExp(KEYWORD.source).test(line);
    const taken: [number, number][] = [];
    const free = (a: number, b: number) => taken.every(([x, y]) => b <= x || a >= y);

    const add = (m: RegExpMatchArray, date: Date | null, monthOnly: boolean) => {
      const index = m.index ?? 0;
      const lead = m[0].length - m[0].trimStart().length;
      const start = index + lead;
      const end = index + m[0].length;
      if (!date || !free(start, end)) return;
      taken.push([start, end]);
      const raw = m[0].trim();
      const corrected = [...fixed].some((t) => raw.includes(t));
      // Mostrar el texto original (con la O), no el corregido.
      const shown = corrected ? upper.slice(start, end).trim() : raw;
      found.push({ date, raw: shown, index: start, end, monthOnly, corrected, kind: markerFor(line, start, end) });
    };

    // 1) Año primero: 2026-11-15
    for (const m of line.matchAll(/\b(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g))
      add(m, buildDate(Number(m[1]), Number(m[2]), Number(m[3])), false);
    // 2) Día/mes/año: 15/11/2026, 15-11-26, 15.11.26
    for (const m of line.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b/g))
      add(m, buildDate(normalizeYear(m[3]), Number(m[2]), Number(m[1])), false);
    // 3) Con espacios: 15 11 2026 (año de 2 dígitos solo si hay palabra clave)
    for (const m of line.matchAll(/\b(\d{1,2}) +(\d{1,2}) +(\d{4}|\d{2})\b/g))
      if (m[3].length === 4 || hasKeyword)
        add(m, buildDate(normalizeYear(m[3]), Number(m[2]), Number(m[1])), false);
    // 4) Mes en letras: 15 NOV 2026, 15NOV26, 15-NOV-26
    for (const m of line.matchAll(/\b(\d{1,2})[\s\-/.]*([A-Z]{3})[A-Z]*\.?[\s\-/.]*(\d{4}|\d{2})\b/g)) {
      const month = MONTHS[m[2]];
      if (month) add(m, buildDate(normalizeYear(m[3]), month, Number(m[1])), false);
    }
    // 5) Solo mes y año en letras: NOV 2026 (año de 2 dígitos solo con palabra clave)
    for (const m of line.matchAll(/\b([A-Z]{3})[A-Z]*\.?[\s\-/.]*(\d{4}|\d{2})\b/g)) {
      const month = MONTHS[m[1]];
      if (month && (m[2].length === 4 || hasKeyword))
        add(m, endOfMonth(normalizeYear(m[2]), month), true);
    }
    // 6) Solo mes y año en números: 11/2026, 11-26 (año de 2 dígitos solo con palabra clave)
    for (const m of line.matchAll(/\b(\d{1,2})[/\-.](\d{4}|\d{2})\b/g))
      if (m[2].length === 4 || hasKeyword) add(m, endOfMonth(normalizeYear(m[2]), Number(m[1])), true);
  }

  const valid = found.filter((f) => f.date >= min && f.date <= max);
  if (!valid.length) return null;

  const withKeyword = valid.filter((f) => f.kind === "keyword");
  const notManufacture = valid.filter((f) => f.kind !== "manufacture");
  const pool = withKeyword.length ? withKeyword : notManufacture.length ? notManufacture : valid;
  pool.sort((a, b) => b.date.getTime() - a.date.getTime());
  const best = pool[0];

  const distinct = new Set(valid.map((f) => toISODate(f.date))).size;
  let confidence: DateConfidence = withKeyword.length ? "alta" : distinct === 1 ? "media" : "baja";
  if (best.corrected || best.monthOnly) confidence = "baja";

  return {
    date: best.date,
    raw: best.raw,
    confidence,
    monthOnly: best.monthOnly,
    corrected: best.corrected,
  };
}
