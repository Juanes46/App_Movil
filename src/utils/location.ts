import { defaultLocation, type Location } from "@/constants/pantry";
import { CLEANING, normalizeName, PERSONAL, PET } from "@/utils/keywords";

/* ------------------------------------------------------------------ */
/*  ¿Dónde se guarda cada producto? Nevera, Congelador o Alacena       */
/*  Primero se mira el nombre (lo más preciso); si no hay pista, la    */
/*  categoría (constants/pantry). El usuario siempre puede cambiarlo.  */
/* ------------------------------------------------------------------ */

export type { Location };

// El orden importa: la primera regla que coincide gana.
const RULES: [RegExp, Location][] = [
  // Aseo, cuidado personal y mascotas: alacena (antes que todo: "PROTEX AVENA",
  // "JABON DE LECHE", "SHAMPOO MANZANILLA" no son comida).
  [PET, "Alacena"],
  [CLEANING, "Alacena"],
  [PERSONAL, "Alacena"],
  // Embutidos: nevera (antes que las carnes: "JAMON DE CERDO")
  [/\b(JAMON|SALCHICHA|SALCHICHON|MORTADELA|CHORIZO|TOCINETA|BUTIFARRA|SALAMI)\b/, "Nevera"],
  // Congelador: congelados y carnes crudas
  [/\b(HELADOS?|PALETAS?|CONGELAD\w*|NUGGETS?|HIELO|FRANCESA|APANAD\w*|HAMBURGUESAS?|PIZZA)\b/, "Congelador"],
  [/\b(POLLO|PECHUGA|MUSLOS?|ALAS|CONTRAMUSLO|CARNE|RES|CERDO|LOMO|COSTILLAS?|MOLIDA|SOBREBARRIGA|CHULETAS?|PESCADO|TILAPIA|MOJARRA|SALMON|CAMARON\w*|MARISCOS?|BAGRE)\b/, "Congelador"],

  // Margarina: va con los aceites en la categoría, pero se guarda en la nevera.
  [/\b(MARGARINA|MAYONESA ABIERTA)\b/, "Nevera"],
  // Alacena: condimentos y despensa seca (antes que las verduras:
  // "CONDIMENTO AJO", "SALSA DE TOMATE")
  [/\b(CONDIM\w*|SAZON\w*|ADOBO|CALDOS?|CUBITOS?|SALSAS?|KETCHUP|MAYONESA|MOSTAZA|VINAGRE|ACEITE|SAL|AZUCAR|PANELA|PIMIENTA|COMINO)\b/, "Alacena"],
  [/\b(UHT|LARGA VIDA|EN POLVO|LECHE CONDENSADA)\b/, "Alacena"],

  // Nevera: lácteos, huevos y frescos delicados
  [/\b(LECHE|LCH|YOGU?R|KUMIS|ALPINITO|KEFIR|QUESO|QSO|CUAJADA|MANTEQ\w*|CREMA DE LECHE|ARROZ CON LECHE|AVENA (?:LIQ\w*|ALPINA)|POSTRE|GELATINA)\b/, "Nevera"],
  [/\b(HUEVOS?|HVO)\b/, "Nevera"],
  [/\b(AREPAS?|MASA|PAN DE BONO|PANDEBONO|ALMOJABANAS?)\b/, "Nevera"],
  // Bebidas (antes que frutas: "JUGO DE LIMON" de caja va a la alacena)
  [/\b(JUGO NATURAL|JUGO FRESCO|LIMONADA)\b/, "Nevera"],
  [/\b(JUGO|NECTAR|HIT|GASEOSA|GASEOS|AGUA|CAFE|TE|CERVEZA)\b/, "Alacena"],
  // Panadería, snacks y dulces (antes que las frutas: "DONUT FRESA", "GALLETA DE MORA")
  [/\b(DONUTS?|DONAS?|PAN|PANES|TAJADO|TAJ|MOGOLLA|TORTILL\w*|GALLETAS?|GALL|PONQUE|TORTA|TOR|NOEL|BROWNIE|CROISSANT|CEREAL|CHOCOLATES?|CHOCOLATINA|GOMAS?|MERMELADA|BOCADILLO|DULCES?|PAPAS FRITAS|MARGARITA)\b/, "Alacena"],
  [/\b(FRESAS?|MORA|UVAS?|ARANDANOS?|MORAS|FRAMBUESA|KIWI|MANZANAS?|PERAS?|DURAZNOS?|CIRUELAS?|MANDARINAS?|NARANJAS?|LIMON|LIMONES|MARACUYA|LULO|GUAYABA|MELON|SANDIA|PATILLA)\b/, "Nevera"],
  [/\b(LECHUGA|ESPINACA|CILANTRO|PEREJIL|APIO|BROCOLI|COLIFLOR|REPOLLO|ZANAHORIA|PEPINO|PIMENTON|HABICHUELA|ARVEJA FRESCA|CHAMPI\w*|TOMATE|CALABACIN|AHUYAMA PARTIDA)\b/, "Nevera"],
  [/\b(HUMMUS|GUACAMOLE)\b/, "Nevera"],

  // Alacena: frutas y verduras que van afuera
  [/\b(BANANO|PLATANO|PAPA|PAPAS|CEBOLLA|AJO|AGUACATE|YUCA|ARRACACHA|PINA|PAPAYA|MANGO|AHUYAMA|NAME|BATATA)\b/, "Alacena"],
];

/**
 * Ubicación sugerida para un producto, según su nombre y su categoría.
 *   suggestLocation("Protex avena 110G", "Granos")  -> "Alacena"
 *   suggestLocation("Helado de vainilla", "Otros")  -> "Congelador"
 *   suggestLocation("Producto raro", "Lácteos")     -> "Nevera"
 */
export function suggestLocation(name: string, category: string): Location {
  const up = normalizeName(name);
  for (const [re, place] of RULES) if (re.test(up)) return place;
  return defaultLocation(category);
}
