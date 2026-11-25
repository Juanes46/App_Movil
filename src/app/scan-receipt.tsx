import * as ImagePicker from "expo-image-picker";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Txt, ui } from "@/components/PantryUI";
import { ScannerLayout } from "@/components/ScannerLayout";
import { COLORS as C } from "@/constants/pantry";
import { OcrError, recognizeText } from "@/services/ocr";
import { identifyReceipt } from "@/services/receiptIdentify";
import { knownEansForParsing, receiptSources } from "@/services/receiptSources";
import { TimeoutError, withTimeout } from "@/utils/timeout";
import {
  mergeReceipts,
  parseReceipt,
  setPendingReceipt,
  type ParsedReceipt,
} from "@/utils/receipt";

/** En desarrollo: cómo se leyó cada línea y de dónde salió cada nombre (sin llaves). */
function logDiagnostics(r: ParsedReceipt) {
  if (!__DEV__) return;
  const d = r.diagnostics;
  console.log(
    `[factura] códigos: ${d.codeLines} líneas · ${d.validCodes} válidos · ${d.rescued} rescatados · ${d.discarded} descartados`,
  );
  for (const l of d.lines) console.log(`[factura] ${l.rule}${l.ean ? ` · EAN ${l.ean}` : ""} · "${l.text}"`);
  for (const i of r.items)
    console.log(`[factura] → ${i.name} · ${i.category} · fuente ${i.nameSource ?? "Factura"}${i.ean ? ` · EAN ${i.ean}` : ""}`);
}

export default function ReceiptScanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("Leyendo la factura…");
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"full" | "close">("full");
  // Escaneo por partes: cada foto se suma a lo leído antes.
  const [acc, setAcc] = useState<ParsedReceipt | null>(null);
  const [lastAdded, setLastAdded] = useState(0);

  // Foto (cámara o galería) -> OCR -> productos por código -> nombres -> se suma a las partes.
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
      const known = await knownEansForParsing().catch(() => new Set<string>());
      let receipt = parseReceipt(text, { knownEans: known });
      if (!receipt.items.length) {
        logDiagnostics(receipt);
        setMessage(
          acc
            ? "No encontramos productos en esta parte. Acércate a las filas con código y descripción."
            : "No reconocimos productos en la factura. Encuádrala completa, sin sombras, o usa “De cerca”.",
        );
        return;
      }
      // Identificación por código: recordado → conocido → caché → OFF → Los Precios → UPCitemdb → factura.
      const total = receipt.items.length;
      setBusyMessage(`Identificando 0 de ${total}…`);
      const sources = await receiptSources(receipt);
      receipt = (
        await identifyReceipt(receipt, sources, {
          deadlineMs: 25_000,
          onProgress: (n, t) => setBusyMessage(`Identificando ${n} de ${t}…`),
        })
      ).receipt;
      logDiagnostics(receipt);
      const before = acc?.items.length ?? 0;
      const merged = acc ? mergeReceipts(acc, receipt) : receipt;
      setAcc(merged);
      setLastAdded(merged.items.length - before);
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

  function review() {
    if (!acc) return;
    setPendingReceipt(acc);
    setAcc(null);
    router.push("/review-receipt");
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

  const parts = acc ? acc.text.split("——— otra parte ———").length : 0;
  const panel = acc ? (
    <View style={[ui.card, { gap: 8 }]} accessibilityLiveRegion="polite">
      <Txt style={{ fontWeight: "600", fontSize: 16 }}>
        Se detectaron {acc.items.length} productos
        {parts > 1 ? ` (${parts} partes${lastAdded > 0 ? `, +${lastAdded} en la última` : ""})` : ""}
      </Txt>
      {acc.expectedCount !== null && (
        <Txt style={{ color: C.muted, fontSize: 12 }}>La factura dice {acc.expectedCount} artículos.</Txt>
      )}
      <View style={[ui.row, { gap: 8 }]}>
        <Button
          title="Tomar otra parte"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => setMessage("Encuadra las filas que faltan y toma otra foto.")}
        />
        <Button title="Revisar" style={{ flex: 1 }} onPress={review} />
      </View>
    </View>
  ) : null;

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
      // OCR (máx. 30 s) + identificación por código (máx. 25 s)
      busyTimeoutMs={60_000}
      message={message}
      receiptMode={mode}
      onReceiptModeChange={setMode}
      extra={panel}
    />
  );
}
