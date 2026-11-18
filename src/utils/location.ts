/* ------------------------------------------------------------------ */
/*  ¿Dónde se guarda cada producto? Nevera, Congelador o Alacena       */
/*  Primero se mira el nombre (lo más preciso); si no hay pista, la    */
/*  categoría. El usuario siempre puede cambiarlo al guardar.          */
/* ------------------------------------------------------------------ */

export type Location = "Nevera" | "Congelador" | "Alacena";

function clean(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// El orden importa: la primera regla que coincide gana.
const RULES: [RegExp, Location][] = [
  // Embutidos: nevera (antes que las carnes: "JAMON DE CERDO")
  [/\b(JAMON|SALCHICHA|SALCHICHON|MORTADELA|CHORIZO|TOCINETA|BUTIFARRA|SALAMI)\b/, "Nevera"],
  // Congelador: congelados y carnes crudas
  [/\b(HELADOS?|PALETAS?|CONGELAD\w*|NUGGETS?|HIELO|FRANCESA|APANAD\w*|HAMBURGUESAS?)\b/, "Congelador"],
  [/\b(POLLO|PECHUGA|MUSLOS?|ALAS|CONTRAMUSLO|CARNE|RES|CERDO|LOMO|COSTILLAS?|MOLIDA|SOBREBARRIGA|CHULETAS?|PESCADO|TILAPIA|MOJARRA|SALMON|CAMARON\w*|MARISCOS?|BAGRE)\b/, "Congelador"],

  // Alacena: condimentos, aseo y despensa seca (antes que las verduras: "CONDIMENTO AJO")
  [/\b(CONDIM\w*|SAZON\w*|ADOBO|CALDO|SALSA DE TOMATE|COLGATE|CREMA DENTAL|DETERG\w*|JABON|SHAMPOO|PAPEL|SERVILLETAS?|SUAVIZANTE|LIMPIA\w*|BLANQUEADOR|DESODORANTE)\b/, "Alacena"],
  [/\b(UHT|LARGA VIDA|EN POLVO|LECHE CONDENSADA)\b/, "Alacena"],

  // Nevera: lácteos, huevos, embutidos y frescos delicados
  [/\b(LECHE|LCH|YOGU?R|KUMIS|ALPINITO|KEFIR|QUESO|QSO|CUAJADA|MANTEQ\w*|MARGARINA|CREMA DE LECHE|ARROZ CON LECHE|AVENA LIQ\w*|POSTRE|GELATINA)\b/, "Nevera"],
  [/\b(HUEVOS?|HVO)\b/, "Nevera"],
  [/\b(AREPAS?|MASA|TORTILLAS?|PAN DE BONO|PANDEBONO|ALMOJABANAS?)\b/, "Nevera"],
  // Panadería y dulces (antes que las frutas: "DONUT FRESA", "GALLETA DE MORA")
  [/\b(DONUTS?|DONAS?|PAN|PANES|TAJADO|TAJ|MOGOLLA|GALLETAS?|PONQUE|TORTA|TOR|NOEL|BROWNIE|CROISSANT|CEREAL|CHOCOLATES?|CHOCOLATINA|GOMAS?|MERMELADA|BOCADILLO|DULCES?)\b/, "Alacena"],
  [/\b(FRESAS?|MORA|UVAS?|ARANDANOS?|MORAS|FRAMBUESA|KIWI|MANZANAS?|PERAS?|DURAZNOS?|CIRUELAS?|MANDARINAS?|NARANJAS?|LIMON|LIMONES|MARACUYA|LULO|GUAYABA|MELON|SANDIA|PATILLA)\b/, "Nevera"],
  [/\b(LECHUGA|ESPINACA|CILANTRO|PEREJIL|APIO|BROCOLI|COLIFLOR|REPOLLO|ZANAHORIA|PEPINO|PIMENTON|HABICHUELA|ARVEJA FRESCA|CHAMPI\w*|TOMATE|CALABACIN|AHUYAMA PARTIDA)\b/, "Nevera"],
  [/\b(JUGO NATURAL|JUGO FRESCO|LIMONADA|HUMMUS|GUACAMOLE|SALSA ROSADA|MAYONESA ABIERTA)\b/, "Nevera"],

  // Alacena: frutas y verduras que van afuera
  [/\b(BANANO|PLATANO|PAPA|PAPAS|CEBOLLA|AJO|AGUACATE|YUCA|ARRACACHA|PINA|PAPAYA|MANGO|AHUYAMA|NAME|BATATA)\b/, "Alacena"],
];

const BY_CATEGORY: Record<string, Location> = {
  "Lácteos": "Nevera",
  "Carnes": "Congelador",
  "Frutas y verduras": "Nevera",
  "Panadería": "Alacena",
  "Enlatados": "Alacena",
  "Bebidas": "Alacena",
  "Granos": "Alacena",
  "Otros": "Alacena",
};

/** Ubicación sugerida para un producto, según su nombre y su categoría. */
export function suggestLocation(name: string, category: string): Location {
  const up = clean(name);
  for (const [re, place] of RULES) if (re.test(up)) return place;
  return BY_CATEGORY[category] ?? "Alacena";
}
