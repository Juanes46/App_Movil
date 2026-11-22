import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScannerLayout } from "@/components/ScannerLayout";
import { OcrError, recognizeText } from "@/services/ocr";
import { buscarPorEAN } from "@/services/productLookup";
import { enrichReceipt } from "@/services/receiptLookup";
import { TimeoutError, withTimeout } from "@/utils/timeout";
import { parseReceipt, setPendingReceipt } from "@/utils/receipt";

export default function ReceiptScanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("Leyendo la factura…");
  const [message, setMessage] = useState<string | null>(null);

  // Foto (cámara o galería) -> OCR -> productos -> nombres por código de barras -> revisión.
  async function read(uri: string) {
    if (!uri) {
      setMessage("No se pudo tomar la foto. Inténtalo de nuevo.");
      return;
    }
    setBusy(true);
    setBusyMessage("Leyendo la factura…");
    setMessage(null);
    try {
      const text = await withTimeout(recognizeText(uri, "receipt"));
      let receipt = parseReceipt(text);
      if (!receipt.items.length) {
        setMessage(
          "No reconocimos productos en la factura. Encuádrala completa, sin sombras, e inténtalo de nuevo.",
        );
        return;
      }
      // Los ítems con código de barras válido se buscan en Open Food Facts / Los Precios.
      const withEan = receipt.items.filter((i) => i.ean).length;
      if (withEan) {
        setBusyMessage(`Buscando los productos… (0/${withEan})`);
        receipt = (
          await enrichReceipt(receipt, buscarPorEAN, {
            onProgress: (done, total) => setBusyMessage(`Buscando los productos… (${done}/${total})`),
          })
        ).receipt;
      }
      setPendingReceipt(receipt);
      router.push("/review-receipt");
    } catch (e) {
      setMessage(
        e instanceof OcrError || e instanceof TimeoutError
          ? e.message
          : "No se pudo leer la factura. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function pickFromGallery() {
    setMessage(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      // En Android deja recortar la foto a solo los productos (en iOS el recorte es cuadrado).
      allowsEditing: Platform.OS === "android",
    });
    if (result.canceled || !result.assets?.length) return;
    await read(result.assets[0].uri);
  }

  return (
    <ScannerLayout
      kind="receipt"
      onPhoto={read}
      onCapture={() => {
        setPendingReceipt(null); // sin factura leída: la revisión muestra el ejemplo
        router.push("/review-receipt");
      }}
      onManual={pickFromGallery}
      busy={busy}
      busyMessage={busyMessage}
      // OCR (máx. 30 s) + búsqueda por código (máx. 25 s)
      busyTimeoutMs={60_000}
      message={message}
    />
  );
}
