/* ------------------------------------------------------------------ */
/*  Palabras clave compartidas para clasificar productos que no son    */
/*  comida (aseo, cuidado personal, mascotas). Las usan receipt.ts,    */
/*  location.ts y el icono por producto, para que no se contradigan.   */
/*  Todo en MAYÚSCULAS y sin tildes (ver normalizeName).               */
/* ------------------------------------------------------------------ */

/** "Jabón Protex" -> "JABON PROTEX" */
export function normalizeName(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const PET =
  /\b(MASCOTAS?|PERROS?|GATOS?|CACHORROS?|DOG ?CHOW|CAT ?CHOW|PEDIGREE|WHISKAS|CHUNKY|PURINA|AGILITY|FELIX|ARENA (?:PARA )?GATOS?|ARENA SANITARIA)\b/;

/**
 * Aseo del hogar. Va ANTES que cuidado personal: "JABON LOZA" es de la
 * cocina, aunque "JABON" a secas sea de baño.
 */
export const CLEANING =
  /\b(DETERG\w*|DET|JAB(?:ON)? (?:DE )?(?:LOZA|ROPA|BARRA|REY|AZUL|COCO)|LAVALOZAS?|LAVAPLATOS|LIMPIDO|BLANQUEADOR|CLOROX|SUAVIZANTE|SUAV|DESINFECT\w*|LIMPIA\w*|AMBIENTADOR|PAPEL (?:HIG\w*|HIGIENICO)|PAP HIG|PAPEL COCINA|TOALLAS? (?:DE )?COCINA|SERVILLETAS?|BOLSAS? (?:DE )?BASURA|ESPONJAS?|BRILLO|CERA|FAMILIA|SCOTT|ROSAL|ELITE|FAB|ARIEL|ARIAL|BONAROMA|DANN|AXION|FABULOSO|LYSOL|AJAX|VANISH|DERSA|SUPREMO)\b/;

/** Cuidado personal: tipo de producto o marca conocida (sin la palabra del tipo). */
export const PERSONAL =
  /\b(JABON|JAB|SHAMPOO|SHAMP|ACONDICIONADOR|CREMA DENTAL|CR DENTAL|DENTAL|CEPILLO|ENJUAGUE|DESODORANTE|DESOD|ANTITRANSPIRANTE|TOALLAS? HIG\w*|PROTECTORES?|PANALES|PANITOS|AFEITAR|GEL ANTIBACTERIAL|CREMA CORPORAL|PROTEX|REXONA|DOVE|PALMOLIVE|COLGATE|HEAD ?(?:&|Y)? ?SHOULDERS|H ?& ?S|PANTENE|SAVITAL|SEDAL|AXE|NIVEA|JOHNSON|ORAL ?B|LISTERINE|GILLETTE|LUX|SPEED ?STICK|LADYSOFT|NOSOTRAS|KOTEX|HUGGIES|WINNY|PEQUENIN|EGO|TIO NACHO)\b/;

/** Cualquier producto que no es comida: va a la alacena y dura mucho. */
export function isNonFood(name: string): boolean {
  const up = normalizeName(name);
  return PET.test(up) || CLEANING.test(up) || PERSONAL.test(up);
}
