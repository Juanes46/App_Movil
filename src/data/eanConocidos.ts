/**
 * Códigos de barras conocidos (sobre todo marca propia de D1, 7700304…, que
 * casi nunca está en las APIs). Se consultan ANTES que internet al leer una
 * factura. Ampliar a mano con cada factura nueva: código -> nombre completo y
 * categoría (una de las de src/constants/pantry.ts).
 *
 *   EAN_CONOCIDOS["7700304448241"] -> { nombre: "Tortillas para fajitas", categoria: "Panadería" }
 */
export const EAN_CONOCIDOS: Record<string, { nombre: string; categoria: string }> = {
  "7700304448241": { nombre: "Tortillas para fajitas", categoria: "Panadería" },
  "7700304930951": { nombre: "Atún en agua", categoria: "Enlatados" },
  "7700304537648": { nombre: "Mora congelada", categoria: "Congelados" },
  "7700304087143": { nombre: "Papas a la francesa", categoria: "Congelados" },
  "7700304587230": { nombre: "Aceite vegetal", categoria: "Condimentos y aceites" },
  "7700304035076": { nombre: "Salsa para adobar", categoria: "Condimentos y aceites" },
  "7700304687862": { nombre: "Leche entera", categoria: "Lácteos" },
  "7700304598281": { nombre: "Pan tajado blanco", categoria: "Panadería" },
};
