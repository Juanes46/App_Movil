import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon, Txt, ui } from "./PantryUI";
import { COLORS as C } from "@/constants/pantry";
export function ScannerLayout({
  kind,
  onCapture,
  onManual,
}: {
  kind: "code" | "date" | "receipt";
  onCapture: () => void;
  onManual: () => void;
}) {
  const router = useRouter();
  const [flash, setFlash] = useState(false);
  const title =
    kind === "code"
      ? "Escanear código"
      : kind === "date"
        ? "Escanear vencimiento"
        : "Escanear factura";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#D9D9D9" }}>
      <View style={{ flex: 1, padding: 20, paddingTop: 8, gap: 14 }}>
        <View style={ui.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar escáner"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/add")
            }
            style={{
              width: 44,
              height: 44,
              borderWidth: 1.5,
              borderColor: C.text,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={20} />
          </Pressable>
          <Txt style={ui.section}>{title}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Linterna de demostración"
            accessibilityState={{ selected: flash }}
            onPress={() => setFlash(!flash)}
            style={{
              width: 44,
              height: 44,
              borderWidth: 1.5,
              borderColor: C.text,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: flash ? "#FCEBC8" : "transparent",
            }}
          >
            <Icon name="flash" size={22} />
          </Pressable>
        </View>
        <Txt style={{ textAlign: "center", fontSize: 12 }}>
          Demostración · cámara y reconocimiento pendientes
        </Txt>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usar captura de ejemplo"
            onPress={onCapture}
            style={{
              width: "85%",
              maxWidth: kind === "date" ? 340 : 300,
              height: kind === "receipt" ? "65%" : kind === "date" ? 110 : 170,
              borderWidth: 2,
              borderColor: C.text,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt style={{ fontSize: 13 }}>Vista de cámara</Txt>
          </Pressable>
          <Txt style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>
            {kind === "code"
              ? "Coloca el código de barras dentro del recuadro"
              : kind === "date"
                ? "Encuadra la fecha de vencimiento"
                : "Encuadra toda la factura dentro del recuadro"}
          </Txt>
          <Txt style={{ fontSize: 13, textAlign: "center" }}>
            {kind === "receipt"
              ? "Si es muy larga, toma varias fotos"
              : "Mantén el producto firme y con buena luz"}
          </Txt>
        </View>
        {kind !== "code" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capturar ejemplo"
            onPress={onCapture}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 4,
              borderColor: C.text,
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: C.primary,
              }}
            />
          </Pressable>
        )}
        <Button
          title={
            kind === "code"
              ? "Simular código de ejemplo"
              : "Usar captura de ejemplo"
          }
          onPress={onCapture}
        />
        <Button
          title={
            kind === "receipt"
              ? "Elegir de la galería (pendiente)"
              : kind === "date"
                ? "Escribir fecha manualmente"
                : "Buscar manualmente"
          }
          variant="secondary"
          onPress={onManual}
        />
      </View>
    </SafeAreaView>
  );
}
