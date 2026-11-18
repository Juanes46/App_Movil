/** Dígito de verificación EAN/GTIN para los dígitos dados (sin el último). */
export function eanCheckDigit(digits: string): number {
  let sum = 0;
  // Desde la derecha: posiciones impares x3, pares x1.
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[digits.length - 1 - i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

/** true si es un EAN-13 o EAN-8 con dígito de verificación correcto. */
export function isValidEan(code: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(code)) return false;
  return eanCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Los Precios solo acepta 13 dígitos. Un EAN-8 se convierte así (según su
 * documentación): 9999 + 8 dígitos + dígito de verificación de esos 12.
 *   toLosPreciosEan13("96385074") -> "9999963850742"
 */
export function toLosPreciosEan13(code: string): string {
  if (code.length === 13) return code;
  const twelve = "9999" + code;
  return twelve + eanCheckDigit(twelve);
}
