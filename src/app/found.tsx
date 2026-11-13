import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { InfoRow, Note, Screen, Section, Txt, ui } from "@/components/PantryUI";
export default function FoundScreen() {
  const router = useRouter();
  return (
    <Screen
      title="Producto encontrado"
      footer={
        <>
          <Button
            title="Escanear fecha de vencimiento"
            onPress={() =>
              router.push({
                pathname: "/scanner",
                params: { name: "Leche entera 1 L", category: "Lácteos" },
              })
            }
          />
          <Button
            title="Ingresar fecha manualmente"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/product",
                params: { name: "Leche entera 1 L", category: "Lácteos" },
              })
            }
          />
        </>
      }
    >
      <View style={[ui.image, { height: 210 }]}>
        <Txt style={{ fontSize: 72 }}>🥛</Txt>
      </View>
      <Txt style={ui.title}>Leche entera 1 L</Txt>
      <Txt style={ui.muted}>Alpina</Txt>
      <View>
        <InfoRow label="Presentación" value="1 L · Caja" />
        <InfoRow label="Categoría" value="Lácteos" />
        <InfoRow label="Código de barras" value="7701234567890" />
        <InfoRow label="Fuente" value="Datos de ejemplo" />
      </View>
      <Section title="Información disponible" />
      <Txt>Nombre · Marca · Presentación</Txt>
      <Note>
        Producto de demostración. Open Food Facts y los precios se conectarán en
        la fase de integración. El código de barras no indica la fecha de
        vencimiento.
      </Note>
    </Screen>
  );
}
