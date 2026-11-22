/* ------------------------------------------------------------------ */
/*  Ordena las líneas que devuelve ML Kit en filas de texto            */
/*  ML Kit agrupa por bloques: en una factura con columnas, los         */
/*  nombres y los precios salen en bloques distintos. Con la posición   */
/*  de cada línea las volvemos a juntar en la misma fila, como se ve en */
/*  el papel: "ARROZ DIANA 1000G   5.900".                              */
/*                                                                      */
/*  Si la foto está un poco inclinada (o el papel curvado), las filas   */
/*  "bajan" hacia la derecha. Se estima esa pendiente y se corrige      */
/*  antes de agrupar.                                                   */
/* ------------------------------------------------------------------ */

export interface OcrLine {
  text: string;
  frame?: { left: number; top: number; width: number; height: number };
  /** Esquinas de la línea (ML Kit): sup-izq, sup-der, inf-der, inf-izq. Dan la inclinación exacta. */
  cornerPoints?: { x: number; y: number }[];
}

const centerY = (l: OcrLine) => l.frame!.top + l.frame!.height / 2;
const centerX = (l: OcrLine) => l.frame!.left + l.frame!.width / 2;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Pendiente de las filas (Δy/Δx). Primero con las esquinas de ML Kit (cada
 * línea trae su propio ángulo); si no vienen, con pares de líneas de una
 * misma fila: una a la izquierda y otra lejos a la derecha, a menos de una
 * altura y media de distancia vertical. Se usa la mediana y se limita a
 * ±0,35 (unos 20°): más que eso no es "levemente inclinada".
 */
export function estimateSlope(lines: OcrLine[]): number {
  const fromCorners = lines
    .filter((l) => l.cornerPoints && l.cornerPoints.length >= 2)
    .map((l) => {
      const [a, b] = l.cornerPoints!;
      return b.x - a.x > 1 ? (b.y - a.y) / (b.x - a.x) : NaN;
    })
    .filter((v) => Number.isFinite(v));
  if (fromCorners.length >= 3) return clampSlope(median(fromCorners));

  // Sin esquinas: columnas (nombres a la izquierda, precios a la derecha). Se
  // emparejan por orden de arriba a abajo, probando desfases de ±2 filas por
  // si a una columna le falta una línea; gana el desfase con más pares y
  // pendientes más parejas.
  const columns = splitColumns(lines.filter((l) => l.frame));
  const chosen: number[] = [];
  for (let c = 0; c + 1 < columns.length; c++) {
    const a = columns[c];
    const b = columns[c + 1];
    let best: { pairs: number; spread: number; slope: number } | null = null;
    for (let k = -2; k <= 2; k++) {
      const s: number[] = [];
      for (let i = 0; i < a.length; i++) {
        const j = i + k;
        if (j < 0 || j >= b.length) continue;
        const dx = centerX(b[j]) - centerX(a[i]);
        if (dx > 0) s.push((centerY(b[j]) - centerY(a[i])) / dx);
      }
      if (s.length < 2) continue;
      const m = median(s);
      const spread = median(s.map((v) => Math.abs(v - m)));
      const better =
        !best ||
        s.length > best.pairs ||
        (s.length === best.pairs && spread < best.spread - 1e-6) ||
        (s.length === best.pairs && Math.abs(spread - best.spread) <= 1e-6 && Math.abs(m) < Math.abs(best.slope));
      if (better) best = { pairs: s.length, spread, slope: m };
    }
    if (best) chosen.push(best.slope);
  }
  return chosen.length ? clampSlope(median(chosen)) : 0;
}

/** Agrupa las líneas en columnas por su borde izquierdo, cada una ordenada de arriba a abajo. */
function splitColumns(lines: OcrLine[]): OcrLine[][] {
  if (!lines.length) return [];
  const byLeft = [...lines].sort((a, b) => a.frame!.left - b.frame!.left);
  const avgWidth = byLeft.reduce((s, l) => s + l.frame!.width, 0) / byLeft.length;
  const cols: OcrLine[][] = [[byLeft[0]]];
  for (const l of byLeft.slice(1)) {
    const last = cols.at(-1)!;
    if (l.frame!.left - last.at(-1)!.frame!.left > avgWidth * 0.5) cols.push([l]);
    else last.push(l);
  }
  return cols.map((c) => c.sort((a, b) => centerY(a) - centerY(b)));
}

function clampSlope(s: number): number {
  return Math.max(-0.35, Math.min(0.35, s));
}

export function linesToText(lines: OcrLine[]): string {
  const withFrame = lines.filter((l) => l.text.trim() && l.frame);
  const without = lines.filter((l) => l.text.trim() && !l.frame);
  if (!withFrame.length) return without.map((l) => l.text).join("\n");

  // Se "endereza" cada línea: su centro vertical sin la inclinación.
  const slope = estimateSlope(withFrame);
  const level = (l: OcrLine) => centerY(l) - slope * centerX(l);

  // De arriba hacia abajo por el centro vertical enderezado.
  const sorted = [...withFrame].sort((a, b) => level(a) - level(b));

  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const f = line.frame!;
    const row = rows.at(-1);
    if (row) {
      const ref = row[0];
      // Misma fila si los centros están a menos de 60 % de la altura de la letra.
      if (Math.abs(level(line) - level(ref)) < Math.min(ref.frame!.height, f.height) * 0.6) {
        row.push(line);
        continue;
      }
    }
    rows.push([line]);
  }

  const text = rows
    .map((row) =>
      row
        .sort((a, b) => a.frame!.left - b.frame!.left)
        .map((l) => l.text.trim())
        .join("  "),
    )
    .join("\n");
  return without.length ? text + "\n" + without.map((l) => l.text).join("\n") : text;
}
