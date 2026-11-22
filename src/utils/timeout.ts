/** Tiempo máximo de los procesos largos (OCR, búsqueda, guardar). */
export const MAX_WAIT_MS = 30_000;

export class TimeoutError extends Error {
  constructor() {
    super("Esto tardó demasiado. Revisa tu conexión e inténtalo de nuevo.");
  }
}

/**
 * Rechaza con TimeoutError si la promesa no termina a tiempo. Si termina
 * después, su resultado se ignora.
 *   await withTimeout(recognizeText(uri, "date"))  // a los 30 s: TimeoutError
 */
export function withTimeout<T>(promise: Promise<T>, ms = MAX_WAIT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
