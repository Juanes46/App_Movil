import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { Button } from "@/components/Button";
import { Icon, Note, Screen, Section, Txt, ui } from "@/components/PantryUI";
import { COLORS as C } from "@/constants/pantry";
export default function AddScreen() {
  const router = useRouter();
  return (
    <Screen title="Agregar producto" active="Agregar">
      <Txt style={{ fontFamily: "Jakarta", fontWeight: "700", fontSize: 22 }}>
        ¿Cómo quieres encontrar el producto?
      </Txt>
      <Txt style={[ui.muted, { lineHeight: 20 }]}>
        Escanea un código, una factura o registra el producto manualmente.
      </Txt>
      <View
        style={[
          ui.card,
          {
            padding: 18,
            backgroundColor: C.surfaceSoft,
            borderColor: C.primary,
            borderWidth: 1.5,
          },
        ]}
      >
        <View style={ui.row}>
          <Icon name="barcode" size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: "600" }}>Escanear código de barras</Txt>
            <Txt style={ui.muted}>
              Apunta la cámara al código de un producto
            </Txt>
          </View>
        </View>
        <Txt
          style={[
            ui.link,
            {
              alignSelf: "flex-start",
              backgroundColor: C.primarySoft,
              borderRadius: 10,
              padding: 6,
            },
          ]}
        >
          Más rápido
        </Txt>
        <Button
          title="Abrir cámara"
          onPress={() => router.push("/scan-code")}
        />
      </View>
      <View style={[ui.card, { padding: 18, backgroundColor: C.surfaceSoft }]}>
        <View style={ui.row}>
          <Icon name="receipt" size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: "600" }}>Escanear factura</Txt>
            <Txt style={ui.muted}>
              Agrega varios productos de una sola compra
            </Txt>
          </View>
        </View>
        <Txt
          style={[
            ui.link,
            {
              alignSelf: "flex-start",
              backgroundColor: C.primarySoft,
              borderRadius: 10,
              padding: 6,
            },
          ]}
        >
          Varios a la vez
        </Txt>
        <Button
          title="Escanear factura"
          variant="secondary"
          onPress={() => router.push("/scan-receipt")}
        />
      </View>
      <View style={ui.row}>
        <View style={{ height: 1, backgroundColor: C.border, flex: 1 }} />
        <Txt style={ui.muted}>o</Txt>
        <View style={{ height: 1, backgroundColor: C.border, flex: 1 }} />
      </View>
      <View style={[ui.card, { padding: 18, backgroundColor: "transparent" }]}>
        <View style={ui.row}>
          <Icon name="manual" size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: "600" }}>Buscar manualmente</Txt>
            <Txt style={ui.muted}>Escribe el nombre del producto</Txt>
          </View>
        </View>
        <Pressable onPress={() => router.push("/product")} style={ui.search}>
          <Icon name="search" size={20} />
          <Txt style={ui.muted}>Ej. Leche entera Alpina</Txt>
        </Pressable>
      </View>
      <Note>
        El código de barras se busca en Open Food Facts y Los Precios; la fecha
        de vencimiento la confirmas tú. Todo se guarda en este dispositivo.
      </Note>
      <Section title="Registro manual" />
      <Button
        title="Registrar sin escanear"
        variant="secondary"
        onPress={() => router.push("/product")}
      />
    </Screen>
  );
}
