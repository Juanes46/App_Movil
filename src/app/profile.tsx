import { View } from "react-native";
import { Button } from "@/components/Button";
import { InfoRow, Note, Screen, Section, Txt, ui } from "@/components/PantryUI";
export default function ProfileScreen() {
  return (
    <Screen title="Perfil y configuración" active="Perfil">
      <View
        style={[
          ui.row,
          { backgroundColor: "#EEF3EA", padding: 14, borderRadius: 14 },
        ]}
      >
        <View style={[ui.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
          <Txt style={{ fontSize: 22 }}>S</Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: "600", fontSize: 16 }}>
            Samuel David Rodríguez
          </Txt>
          <Txt style={ui.muted}>Perfil de demostración</Txt>
        </View>
      </View>
      <Section title="Cuenta" />
      <InfoRow label="Datos personales" value="Perfil local" />
      <InfoRow label="Ciudad" value="Tunja" />
      <Section title="Preferencias" />
      <InfoRow label="Ubicaciones" value="Nevera, congelador, alacena" />
      <InfoRow label="Idioma" value="Español" />
      <Section title="Notificaciones" />
      <InfoRow label="Alertas de vencimiento" value="En la pantalla Inicio" />
      <InfoRow label="Anticipación" value="7 días" />
      <InfoRow label="Recordatorio de compras" value="Pendiente" />
      <Note>
        Este prototipo funciona sin iniciar sesión. Las notificaciones push y la
        edición del perfil no están habilitadas. La consulta de precios no cubre
        Tunja.
      </Note>
      <Button
        title="Cuenta local · sin sesión"
        variant="secondary"
        disabled
        onPress={() => {}}
      />
    </Screen>
  );
}
