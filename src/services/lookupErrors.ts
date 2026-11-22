/** Errores de búsqueda por código de barras, con mensajes para el usuario. */
export type LookupErrorCode =
  | "sin_internet"
  | "no_encontrado"
  | "limite"
  | "llave_invalida"
  | "servicio_caido"
  | "codigo_invalido"
  | "tiempo_agotado";

const MESSAGES: Record<LookupErrorCode, string> = {
  sin_internet: "Sin conexión a internet. Revisa tu red e inténtalo de nuevo.",
  no_encontrado: "No encontramos este producto. Puedes registrarlo a mano.",
  limite: "Hiciste muchas consultas seguidas. Espera un momento e inténtalo de nuevo.",
  llave_invalida: "La llave de Los Precios no es válida. Revisa el archivo .env.",
  servicio_caido: "El servicio de productos no responde. Inténtalo más tarde.",
  codigo_invalido: "El código de barras no es válido. Revisa los números (8 o 13 dígitos).",
  tiempo_agotado: "La búsqueda tardó demasiado. Revisa tu conexión e inténtalo de nuevo.",
};

export class LookupError extends Error {
  constructor(public code: LookupErrorCode) {
    super(MESSAGES[code]);
  }
}

/** fetch con tiempo límite; si no hay red lanza LookupError("sin_internet"). */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    // Abort = el servidor no respondió a tiempo; TypeError = sin red.
    throw new LookupError(
      e instanceof Error && e.name === "AbortError" ? "servicio_caido" : "sin_internet",
    );
  } finally {
    clearTimeout(timer);
  }
}
