/* ------------------------------------------------------------------ */
/*  Ordena las líneas que devuelve ML Kit en filas de texto            */
/*  ML Kit agrupa por bloques: en una factura con columnas, los         */
/*  nombres y los precios salen en bloques distintos. Con la posición   */
/*  de cada línea las volvemos a juntar en la misma fila, como se ve en */
/*  el papel: "ARROZ DIANA 1000G   5.900".                              */
/* ------------------------------------------------------------------ */

export interface OcrLine {
  text: string;
  frame?: { left: number; top: number; width: number; height: number };
}

export function linesToText(lines: OcrLine[]): string {
  const withFrame = lines.filter((l) => l.text.trim() && l.frame);
  const without = lines.filter((l) => l.text.trim() && !l.frame);
  if (!withFrame.length) return without.map((l) => l.text).join("\n");

  // De arriba hacia abajo por el centro vertical de cada línea.
  const sorted = [...withFrame].sort(
    (a, b) => a.frame!.top + a.frame!.height / 2 - (b.frame!.top + b.frame!.height / 2),
  );

  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const f = line.frame!;
    const center = f.top + f.height / 2;
    const row = rows.at(-1);
    if (row) {
      const ref = row[0].frame!;
      const refCenter = ref.top + ref.height / 2;
      // Misma fila si los centros están a menos de 60 % de la altura de la letra.
      if (Math.abs(center - refCenter) < Math.min(ref.height, f.height) * 0.6) {
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
