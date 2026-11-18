import Constants from "expo-constants";

/**
 * Valores del .env que app.config.ts pasa a `extra`.
 * No imprimir estos valores en consola.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const ENV = {
  losPreciosApiKey: text(extra.losPreciosApiKey),
  losPreciosBaseUrl: text(extra.losPreciosBaseUrl).replace(/\/+$/, ""),
  offUserAgent: text(extra.offUserAgent) || "DespensaViva/1.0 (proyecto academico)",
};
