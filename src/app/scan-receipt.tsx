import { useRouter } from "expo-router";
import { useState } from "react";
import { ScannerLayout } from "@/components/ScannerLayout";
import { Note, Screen } from "@/components/PantryUI";
import { Button } from "@/components/Button";
export default function ReceiptScanner() {
  const router = useRouter();
  const [gallery, setGallery] = useState(false);
  if (gallery)
    return (
      <Screen title="Elegir factura">
        <Note>
          La selección de imágenes y el reconocimiento de facturas se conectarán
          en una fase posterior. Puedes recorrer el flujo con una factura de
          ejemplo.
        </Note>
        <Button
          title="Ver factura de ejemplo"
          onPress={() => router.push("/review-receipt")}
        />
        <Button
          title="Volver al escáner"
          variant="secondary"
          onPress={() => setGallery(false)}
        />
      </Screen>
    );
  return (
    <ScannerLayout
      kind="receipt"
      onCapture={() => router.push("/review-receipt")}
      onManual={() => setGallery(true)}
    />
  );
}
