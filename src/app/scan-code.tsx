import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScannerLayout } from "@/components/ScannerLayout";
import { isValidEan } from "@/utils/ean";

/** Código real de ejemplo (Leche Actilife, Alpina) para probar sin cámara. */
const DEMO_EAN = "7702001114054";

export default function CodeScreen() {
  const router = useRouter();
  const locked = useRef(false); // la cámara reporta el mismo código muchas veces
  const [message, setMessage] = useState<string | null>(null);

  // Al volver a esta pantalla se puede escanear otra vez.
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
    }, []),
  );

  function open(ean: string) {
    if (locked.current) return;
    if (!isValidEan(ean)) {
      setMessage("Ese código no parece un EAN-13 válido. Intenta de nuevo.");
      return;
    }
    locked.current = true;
    setMessage(null);
    router.push({ pathname: "/found", params: { ean } });
  }

  return (
    <ScannerLayout
      kind="code"
      onBarcode={open}
      onCapture={() => open(DEMO_EAN)}
      onManual={() => router.push("/found")}
      manualLabel="Escribir el código"
      message={message}
    />
  );
}
