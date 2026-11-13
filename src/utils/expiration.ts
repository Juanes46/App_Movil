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
  proximo: { label: 'Próximo a vencer', emoji: '🟡', color: COLORS.warning, bg: COLORS.warningSoft },
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

// Palabras que suelen acompañar a la fecha de vencimiento en las etiquetas.
const KEYWORDS = /(VENC|VTO|EXP|CONSUM|BEST BEFORE|USE BY|BBE|CADUC|\bFV\b)/i;
const NUMERIC = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b/g;
const TEXTUAL = /\b(\d{1,2})\s*([A-Za-z]{3})[A-Za-z]*\.?\s*(\d{4}|\d{2})\b/g;

function normalizeYear(raw: string): number {
  const y = Number(raw);
  return raw.length === 2 ? 2000 + y : y;
}

export interface DetectedDate {
  date: Date;
  raw: string;
}

/**
 * Busca fechas en el texto. Si alguna aparece en una línea con palabras como
 * "VENCE" o "EXP", se prefiere esa; si no, se toma la más lejana (la de
 * fabricación casi siempre es anterior a la de vencimiento).
 */
export function detectExpirationDate(text: string): DetectedDate | null {
  const found: { date: Date; raw: string; hasKeyword: boolean }[] = [];

  for (const line of text.split(/\r?\n/)) {
    const hasKeyword = KEYWORDS.test(line);

    for (const m of line.matchAll(NUMERIC)) {
      const date = buildDate(normalizeYear(m[3]), Number(m[2]), Number(m[1]));
      if (date) found.push({ date, raw: m[0], hasKeyword });
    }

    for (const m of line.matchAll(TEXTUAL)) {
      const month = MONTHS[m[2].toUpperCase()];
      if (!month) continue;
      const date = buildDate(normalizeYear(m[3]), month, Number(m[1]));
      if (date) found.push({ date, raw: m[0], hasKeyword });
    }
  }

  if (found.length === 0) return null;
  const pool = found.some((f) => f.hasKeyword) ? found.filter((f) => f.hasKeyword) : found;
  pool.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { date: pool[0].date, raw: pool[0].raw };
}
