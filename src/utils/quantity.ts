/**
 * Cantidad con su unidad, para mostrar en Revisar factura y en la despensa.
 *   formatQuantity(3, "un")    -> "×3 un"
 *   formatQuantity(0.45, "kg") -> "0,45 kg"
 *   formatQuantity(2, "L")     -> "2 L"
 *   formatQuantity(1)          -> "×1 un"
 */
export function formatQuantity(quantity: number | undefined, unit: string | undefined = "un"): string {
  const q = quantity ?? 1;
  if (!unit || unit === "un") return `×${Math.round(q)} un`;
  const text = String(Math.round(q * 1000) / 1000).replace(".", ",");
  return `${text} ${unit}`;
}
