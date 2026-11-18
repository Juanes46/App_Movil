/**
 * Paleta "Fresca y clara". Ninguna pantalla debe usar colores sueltos:
 * siempre `COLORS.<token>`.
 */
export const COLORS = {
  // Neutros
  background: "#F7F9F5", // fondo de pantallas
  card: "#FFFFFF", // tarjetas
  white: "#FFFFFF",
  surfaceSoft: "#EEF3EA", // superficie suave (tarjetas destacadas, accesos)
  imageBg: "#E8EFE3", // fondo de imágenes / placeholder
  border: "#DCE3D8", // línea
  text: "#1B2A22",
  muted: "#5A6B61", // texto secundario

  // Acción
  primary: "#2B77A8", // acción azul
  primaryDark: "#1F5F8B", // texto de enlaces y botón secundario
  primarySoft: "#DCEAF4",

  // Estados
  danger: "#D2453B", // peligro / vencido
  dangerSoft: "#FBE4E1",
  warning: "#E59A1F", // advertencia / próximo
  warningSoft: "#FCEBC8",
  warningText: "#8A5A0C", // texto legible sobre warningSoft
  ok: "#1F6B3D", // vigente: texto
  okSoft: "#DDF0E3", // vigente: fondo

  // Escáner
  scannerBg: "#D9D9D9",
  overlay: "rgba(27,42,34,0.65)",
  shadow: "rgba(23,38,28,0.25)",
} as const;

export type ColorToken = keyof typeof COLORS;
