import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScannerLayout } from "@/components/ScannerLayout";
import { OcrError, recognizeText } from "@/services/ocr";
import { parseReceipt, setPendingReceipt } from "@/utils/receipt";

export default function ReceiptScanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Foto (cámara o galería) -> OCR -> productos -> pantalla de revisión.
  async function read(uri: string) {
    if (!uri) {
      setMessage("No se pudo tomar la foto. Inténtalo de nuevo.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const text = await recognizeText(uri, "receipt");
      const receipt = parseReceipt(text);
      if (!receipt.items.length) {
        setMessage(
          "No reconocimos productos en la factura. Encuádrala completa, sin sombras, e inténtalo de nuevo.",
        );
        return;
      }
      setPendingReceipt(receipt);
      router.push("/review-receipt");
    } catch (e) {
      setMessage(e instanceof OcrError ? e.message : "No se pudo leer la factura. Inténtalo de nuevo.");
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
      message={message}
    />
  );
}
