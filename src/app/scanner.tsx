import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScannerLayout } from "@/components/ScannerLayout";
import { OcrError, recognizeText } from "@/services/ocr";
import { TimeoutError, withTimeout } from "@/utils/timeout";
import { addDays, detectExpirationDate, formatDate } from "@/utils/expiration";

export default function DateScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    category?: string;
    id?: string;
    quantity?: string;
    location?: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const manual = () =>
    router.replace({ pathname: "/product", params: { ...params } });

  // Foto real -> OCR en la nube -> busca la fecha en el texto.
  async function read(uri: string) {
    if (!uri) {
      setMessage("No se pudo tomar la foto. Inténtalo de nuevo.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const text = await withTimeout(recognizeText(uri, "date"));
      const detected = detectExpirationDate(text);
      if (!detected) {
        setMessage(
          "No encontramos una fecha en la foto. Acércate a la fecha, con buena luz, o escríbela a mano.",
        );
        return;
      }
      router.replace({
        pathname: "/product",
        params: {
          ...params,
          date: formatDate(detected.date),
          source: "ocr",
          ocrRaw: detected.raw,
          ocrConfidence: detected.confidence,
        },
      });
    } catch (e) {
      setMessage(e instanceof OcrError || e instanceof TimeoutError ? e.message : "No se pudo leer la foto. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  // Ejemplo sin cámara ni internet (para presentar sin conexión).
  function demo() {
    const detected = detectExpirationDate(
      "VENCE " + formatDate(addDays(new Date(), 3)),
    );
    router.replace({
      pathname: "/product",
      params: {
        ...params,
        name: params.name || "Leche entera 1 L",
        category: params.category || "Lácteos",
        date: detected ? formatDate(detected.date) : "",
        source: "demo",
      },
    });
  }

  return (
    <ScannerLayout
      kind="date"
      onPhoto={read}
      onCapture={demo}
      onManual={manual}
      busy={busy}
      message={message}
    />
  );
}
