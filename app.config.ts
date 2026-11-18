import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Configuración dinámica: toma todo lo de app.json y agrega las llaves del
 * archivo .env en `extra` (se leen en la app con expo-constants, ver
 * src/config/env.ts).
 *
 * OJO: lo que va en `extra` viaja dentro de la app compilada y cualquiera
 * que la descomprima puede leerlo. Para este proyecto académico está bien;
 * en una app real la llave de Los Precios debería quedar en un servidor propio.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    losPreciosApiKey: process.env.LOSPRECIOS_API_KEY ?? "",
    losPreciosBaseUrl: process.env.LOSPRECIOS_BASE_URL ?? "",
    offUserAgent: process.env.OFF_USER_AGENT ?? "",
  },
});
