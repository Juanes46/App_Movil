import { CameraView, useCameraPermissions, type FocusMode } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  View,
  type LayoutRectangle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { LoadingSplash } from "./LoadingSplash";
import { Icon, Txt, ui } from "./PantryUI";
import { COLORS as C } from "@/constants/pantry";
import { ocrMode } from "@/services/ocr";

type Props = {
  kind: "code" | "date" | "receipt";
  /** Captura de ejemplo (demo sin cámara ni internet). */
  onCapture: () => void;
  onManual: () => void;
  /** Si se pasa, se usa la cámara real y se entrega la foto ya recortada al recuadro. */
  onPhoto?: (uri: string) => void;
  /** Si se pasa, la cámara lee códigos EAN-13 / EAN-8 solos (sin tomar foto). */
  onBarcode?: (code: string) => void;
  /** Mientras el OCR lee la foto: muestra la pantalla de carga (LoadingSplash). */
  busy?: boolean;
  /** Tiempo máximo de la pantalla de carga (por defecto 30 s). */
  busyTimeoutMs?: number;
  /** Texto de la pantalla de carga; por defecto según `kind`. */
  busyMessage?: string;
  /** Mensaje de error o ayuda bajo el visor. */
  message?: string | null;
  manualLabel?: string;
};

// Zoom: en iOS el valor es exponencial (0 = 1×). Los valores dan aprox. 1×, 2× y 3×.
// Con zoom el usuario puede quedarse a ~25 cm, donde la cámara sí enfoca.
const ZOOMS = Platform.select({
  ios: [
    { label: "1×", value: 0 },
    { label: "2×", value: 0.17 },
    { label: "3×", value: 0.27 },
  ],
  default: [
    { label: "1×", value: 0 },
    { label: "2×", value: 0.1 },
    { label: "3×", value: 0.2 },
  ],
});

/**
 * Recorta la foto al recuadro guía, para que el OCR lea solo lo que el
 * usuario encuadró (por ejemplo, solo los productos de la factura).
 * La vista previa llena el contenedor tipo "cover", igual que se calcula aquí.
 */
async function cropToFrame(
  uri: string,
  photo: { width: number; height: number },
  box: LayoutRectangle,
  frame: LayoutRectangle,
): Promise<string> {
  const scale = Math.max(box.width / photo.width, box.height / photo.height);
  const offX = (photo.width * scale - box.width) / 2;
  const offY = (photo.height * scale - box.height) / 2;
  const margin = 12; // px de pantalla extra, por si el usuario encuadra justo
  let x = (frame.x - margin + offX) / scale;
  let y = (frame.y - margin + offY) / scale;
  let w = (frame.width + 2 * margin) / scale;
  let h = (frame.height + 2 * margin) / scale;
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  w = Math.min(photo.width - x, Math.round(w));
  h = Math.min(photo.height - y, Math.round(h));
  if (w < 50 || h < 50) return uri;
  const ref = await ImageManipulator.manipulate(uri)
    .crop({ originX: x, originY: y, width: w, height: h })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return out.uri;
}

export function ScannerLayout({
  kind,
  onCapture,
  onManual,
  onPhoto,
  onBarcode,
  busy = false,
  busyMessage,
  busyTimeoutMs,
  message,
  manualLabel,
}: Props) {
  const router = useRouter();
  const focused = useIsFocused();
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [focusMode, setFocusMode] = useState<FocusMode>("off"); // "off" = enfoque automático continuo
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const box = useRef<LayoutRectangle | null>(null);
  const frame = useRef<LayoutRectangle | null>(null);
  const live = !!onPhoto || !!onBarcode;
  const title =
    kind === "code"
      ? "Escanear código"
      : kind === "date"
        ? "Escanear vencimiento"
        : "Escanear factura";

  // Al salir de la pantalla (por ejemplo, a "Revisar factura") se apaga la
  // linterna y se cierra la cámara: si no, el flash queda encendido.
  useEffect(() => {
    if (!focused) {
      setFlash(false);
      setReady(false);
    }
  }, [focused]);

  // Tocar el visor vuelve a enfocar: "on" enfoca una vez y luego se regresa
  // al enfoque continuo.
  function refocus() {
    setFocusMode("on");
    setTimeout(() => setFocusMode("off"), 800);
  }

  async function shoot() {
    if (!onPhoto) return onCapture();
    if (!camera.current || !ready || busy) return;
    try {
      const photo = await camera.current.takePictureAsync({
        quality: 0.9,
        shutterSound: false,
      });
      if (!photo?.uri) return onPhoto("");
      let uri = photo.uri;
      if (box.current && frame.current) {
        try {
          uri = await cropToFrame(photo.uri, photo, box.current, frame.current);
        } catch {
          uri = photo.uri; // si el recorte falla, se manda la foto completa
        }
      }
      onPhoto(uri);
    } catch {
      onPhoto("");
    }
  }

  const frameStyle = {
    width: "85%" as const,
    maxWidth: kind === "date" ? 340 : kind === "receipt" ? 340 : 300,
    height: kind === "receipt" ? ("62%" as const) : kind === "date" ? 120 : 170,
    borderWidth: 2,
    borderColor: live ? C.white : C.text,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const granted = !!permission?.granted;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.scannerBg }}>
      <View style={{ flex: 1, padding: 20, paddingTop: 8, gap: 12 }}>
        <View style={ui.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar escáner"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/add")
            }
            style={circle}
          >
            <Icon name="close" size={20} />
          </Pressable>
          <Txt style={ui.section}>{title}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={live ? "Linterna" : "Linterna de demostración"}
            accessibilityState={{ selected: flash }}
            onPress={() => setFlash(!flash)}
            style={[circle, { backgroundColor: flash ? C.warningSoft : "transparent" }]}
          >
            <Icon name="flash" size={22} />
          </Pressable>
        </View>

        {!live ? (
          <Txt style={{ textAlign: "center", fontSize: 12 }}>
            Demostración · cámara y reconocimiento pendientes
          </Txt>
        ) : (
          <Txt style={{ textAlign: "center", fontSize: 12, color: C.muted }}>
            {onBarcode
              ? "El código se lee solo al encuadrarlo"
              : ocrMode === "device"
              ? "Lectura en el celular · sin internet ni límite"
              : "Lectura en la nube · requiere internet"}
          </Txt>
        )}

        <View
          onLayout={(e) => (box.current = e.nativeEvent.layout)}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {live && granted && focused && (
            <CameraView
              ref={camera}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              facing="back"
              enableTorch={flash}
              zoom={zoom}
              autofocus={focusMode}
              active={focused}
              onCameraReady={() => setReady(true)}
              barcodeScannerSettings={
                onBarcode ? { barcodeTypes: ["ean13", "ean8"] } : undefined
              }
              onBarcodeScanned={
                onBarcode && !busy ? (r) => onBarcode(r.data) : undefined
              }
            />
          )}

          {live && !granted ? (
            <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 12 }}>
              <Txt style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>
                {permission === null
                  ? "Preparando la cámara…"
                  : "Necesitamos tu permiso para usar la cámara"}
              </Txt>
              {permission && !permission.granted && (
                <Button
                  title={permission.canAskAgain ? "Permitir cámara" : "Abrir ajustes para permitir"}
                  onPress={() =>
                    permission.canAskAgain ? requestPermission() : Linking.openSettings()
                  }
                />
              )}
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={live ? "Enfocar" : "Usar captura de ejemplo"}
                onPress={live ? refocus : onCapture}
                onLayout={(e) => (frame.current = e.nativeEvent.layout)}
                style={frameStyle}
              >
                {!live && <Txt style={{ fontSize: 13 }}>Vista de cámara</Txt>}
              </Pressable>
              <View
                style={
                  live
                    ? { backgroundColor: C.overlay, borderRadius: 12, padding: 10, gap: 4 }
                    : { gap: 20 }
                }
              >
                <Txt
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    textAlign: "center",
                    color: live ? C.white : C.text,
                  }}
                >
                  {kind === "code"
                    ? "Coloca el código de barras dentro del recuadro"
                    : kind === "date"
                      ? "Encuadra solo la fecha de vencimiento"
                      : "Encuadra solo la lista de productos"}
                </Txt>
                <Txt style={{ fontSize: 12, textAlign: "center", color: live ? C.white : C.text }}>
                  {live && onBarcode
                    ? "Mantén el código quieto y con buena luz. Toca el recuadro para enfocar."
                    : live
                    ? "Aléjate a unos 20 cm y usa 2× o 3×. Toca el recuadro para enfocar."
                    : kind === "receipt"
                      ? "Si es muy larga, toma varias fotos"
                      : "Mantén el producto firme y con buena luz"}
                </Txt>
              </View>
            </>
          )}
        </View>

        {live && granted && (
          <View style={[ui.row, { justifyContent: "center", gap: 8 }]}>
            {ZOOMS.map((z) => (
              <Pressable
                key={z.label}
                accessibilityRole="button"
                accessibilityLabel={`Zoom ${z.label}`}
                accessibilityState={{ selected: zoom === z.value }}
                onPress={() => setZoom(z.value)}
                style={{
                  minWidth: 52,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: zoom === z.value ? C.text : "transparent",
                  borderWidth: 1.5,
                  borderColor: C.text,
                }}
              >
                <Txt style={{ fontWeight: "700", color: zoom === z.value ? C.white : C.text }}>
                  {z.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}

        {!!message && (
          <Txt
            accessibilityRole="alert"
            style={{ color: C.danger, textAlign: "center", fontWeight: "600" }}
          >
            {message}
          </Txt>
        )}

        {kind !== "code" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={live ? "Tomar foto" : "Capturar ejemplo"}
            accessibilityState={{ disabled: busy || (live && !ready) }}
            disabled={busy || (live && !ready)}
            onPress={shoot}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 4,
              borderColor: C.text,
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              opacity: busy || (live && !ready) ? 0.5 : 1,
            }}
          >
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.primary }} />
          </Pressable>
        )}

        {!live && (
          <Button
            title={kind === "code" ? "Simular código de ejemplo" : "Usar captura de ejemplo"}
            onPress={onCapture}
          />
        )}
        <Button
          title={
            manualLabel ??
            (kind === "receipt"
              ? "Elegir de la galería"
              : kind === "date"
                ? "Escribir fecha manualmente"
                : "Buscar manualmente")
          }
          variant="secondary"
          disabled={busy}
          onPress={onManual}
        />
        {live && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usar ejemplo sin cámara"
            disabled={busy}
            onPress={onCapture}
            style={{ alignSelf: "center", padding: 4 }}
          >
            <Txt style={ui.link}>Usar ejemplo (sin cámara ni internet)</Txt>
          </Pressable>
        )}
      </View>
      <LoadingSplash
        visible={busy}
        timeoutMs={busyTimeoutMs}
        message={busyMessage ?? (kind === "receipt" ? "Leyendo la factura…" : kind === "date" ? "Leyendo la fecha…" : "Buscando el producto…")}
      />
    </SafeAreaView>
  );
}

const circle = {
  width: 44,
  height: 44,
  borderWidth: 1.5,
  borderColor: C.text,
  borderRadius: 22,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
