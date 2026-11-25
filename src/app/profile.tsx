import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Linking, Pressable, Switch, View } from "react-native";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { Note, Screen, Section, Txt, ui } from "@/components/PantryUI";
import { COLORS as C } from "@/constants/pantry";
import { SOON_DAYS } from "@/utils/expiration";
import { clearLearned, countLearned } from "@/services/learnedNames";

/** Fila de ajuste del Figma: título, detalle, valor y chevron o interruptor. */
function SettingRow({
  title,
  detail,
  value,
  toggle,
  onToggle,
  disabled,
}: {
  title: string;
  detail?: string;
  value?: string;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={[ui.row, { gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border }]}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Txt style={{ fontSize: 15, fontWeight: "600" }}>{title}</Txt>
        {!!detail && <Txt style={{ fontSize: 12, color: C.muted }}>{detail}</Txt>}
      </View>
      {toggle === undefined ? (
        <>
          {!!value && <Txt style={{ color: C.muted }}>{value}</Txt>}
          <Txt style={{ fontSize: 20, color: C.muted }}>›</Txt>
        </>
      ) : (
        <Switch
          accessibilityLabel={title}
          value={toggle}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ true: C.primary, false: C.border }}
          thumbColor={C.white}
          ios_backgroundColor={C.border}
        />
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const [alerts, setAlerts] = useState(true);
  // Nombres recordados: correcciones de facturas que se reusan por código de barras.
  const [learned, setLearned] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  useFocusEffect(
    useCallback(() => {
      countLearned().then(setLearned).catch(() => setLearned(null));
    }, []),
  );
  async function clearNames() {
    try {
      await clearLearned();
      setLearned(0);
      setClearMsg("Listo: se borraron los nombres recordados.");
    } catch {
      setClearMsg("No se pudieron borrar. Intenta de nuevo.");
    }
    setConfirmClear(false);
  }
  return (
    <Screen title="Perfil y configuración" active="Perfil">
      <View style={[ui.row, { backgroundColor: C.surfaceSoft, padding: 14, borderRadius: 14 }]}>
        <View style={[ui.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
          <Txt style={{ fontFamily: "Jakarta", fontWeight: "600", fontSize: 20, color: C.primaryDark }}>
            S
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: "600", fontSize: 16 }}>Samuel David Rodríguez</Txt>
          <Txt style={ui.muted}>Perfil local · sin sesión</Txt>
        </View>
      </View>

      <Section title="Cuenta" />
      <View>
        <SettingRow title="Datos personales" detail="Guardados solo en este celular" />
        <SettingRow
          title="Ciudad"
          detail="Los Precios no cubre Tunja: se muestran otras ciudades"
          value="Tunja"
        />
      </View>

      <Section title="Preferencias" />
      <View>
        <SettingRow title="Ubicaciones y categorías" detail="Nevera, congelador, alacena" />
        <SettingRow title="Idioma" value="Español" />
      </View>

      <Section title="Notificaciones" />
      <View>
        <SettingRow
          title="Alertas de vencimiento"
          detail="Se muestran en Inicio"
          toggle={alerts}
          onToggle={setAlerts}
        />
        <SettingRow title="Días de anticipación" value={`${SOON_DAYS} días`} />
        <SettingRow
          title="Recordatorio de compras"
          detail="Próximamente"
          toggle={false}
          disabled
        />
      </View>

      <Section title="Facturas" />
      <SettingRow
        title="Nombres recordados"
        detail="Correcciones que se usan al escanear otra factura con el mismo producto"
        value={learned === null ? "—" : String(learned)}
      />
      {confirmClear ? (
        <View style={[ui.card, { backgroundColor: C.dangerSoft, borderColor: C.danger }]}>
          <Txt style={{ fontWeight: "600" }}>
            ¿Borrar {learned ?? 0} nombres recordados? No se puede deshacer.
          </Txt>
          <Txt style={{ fontSize: 12, color: C.muted }}>
            Los productos de tu despensa no se borran; solo se olvidan las correcciones.
          </Txt>
          <Button title="Sí, borrar" variant="danger" onPress={clearNames} />
          <Button title="Cancelar" variant="secondary" onPress={() => setConfirmClear(false)} />
        </View>
      ) : (
        <Button
          title="Borrar nombres recordados"
          variant="secondary"
          disabled={!learned}
          onPress={() => {
            setClearMsg("");
            setConfirmClear(true);
          }}
        />
      )}
      {!!clearMsg && <Txt style={ui.muted}>{clearMsg}</Txt>}

      <Note>Este prototipo funciona sin iniciar sesión. Las notificaciones push aún no están habilitadas.</Note>
      <Button title="Cuenta local · sin sesión" variant="secondary" disabled onPress={() => {}} />

      <Section title="Acerca de" />
      <View style={[ui.row, { gap: 10, backgroundColor: C.surfaceSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }]}>
        <Logo height={28} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontFamily: "Jakarta", fontWeight: "600", fontSize: 15 }}>
            Despensa Viva v1.0
          </Txt>
          <Txt style={{ fontSize: 12, color: C.muted }}>
            Que nada se te venza · Taller de Aplicaciones Móviles
          </Txt>
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL("https://world.openfoodfacts.org")}
      >
        <Txt style={[ui.muted, { fontSize: 12, lineHeight: 18 }]}>
          Datos de Open Food Facts (ODbL) · openfoodfacts.org.{"\n"}
          Precios de referencia: Los Precios (datos abiertos), solo Bogotá, Medellín, Cali y
          Barranquilla.
        </Txt>
      </Pressable>
    </Screen>
  );
}
