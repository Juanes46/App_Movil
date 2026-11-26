import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Share, Switch, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { Chip, Note, Screen, Section, StatTile, Txt, ui } from "@/components/PantryUI";
import { COLORS as C } from "@/constants/pantry";
import { clearAllData } from "@/services/dataStore";
import { monthStats, useHistoryVersion, type MonthStats } from "@/services/historyStore";
import { clearLearned, countLearned } from "@/services/learnedNames";
import {
  notificationsSupported,
  requestNotificationPermission,
  rescheduleNotifications,
} from "@/services/notifications";
import { useProducts } from "@/services/productStore";
import {
  CIUDADES,
  CIUDADES_CON_PRECIOS,
  initials,
  setAjuste,
  useAjustes,
} from "@/services/settingsStore";
import { getStatus } from "@/utils/expiration";
import { pantrySummary } from "@/utils/shareText";

/**
 * Fila de ajuste del Figma: título, detalle y, a la derecha, valor + chevron
 * (solo si es tocable) o un interruptor. Si no hace nada, no parece tocable.
 */
function SettingRow({
  title,
  detail,
  value,
  onPress,
  toggle,
  onToggle,
  disabled,
}: {
  title: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const content = (
    <View style={[ui.row, { gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border }]}>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt style={{ fontSize: 15, fontWeight: "600" }}>{title}</Txt>
        {!!detail && <Txt style={{ fontSize: 12, color: C.muted }}>{detail}</Txt>}
      </View>
      {toggle !== undefined ? (
        <Switch
          accessibilityLabel={title}
          value={toggle}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ true: C.primary, false: C.border }}
          thumbColor={C.white}
          ios_backgroundColor={C.border}
        />
      ) : (
        <>
          {!!value && <Txt style={{ color: C.muted }}>{value}</Txt>}
          {onPress && <Txt style={{ fontSize: 20, color: C.muted }}>›</Txt>}
        </>
      )}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${value ? `, ${value}` : ""}`} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const HOURS = [7, 8, 9, 12, 18, 20];
const hourLabel = (h: number) => (h === 12 ? "12:00 m." : h < 12 ? `${h}:00 a. m.` : `${h - 12}:00 p. m.`);

export default function ProfileScreen() {
  const router = useRouter();
  const ajustes = useAjustes();
  const products = useProducts();
  const historyVersion = useHistoryVersion();

  // Perfil
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(ajustes.nombre);
  const [pickCity, setPickCity] = useState(false);
  // Estadísticas del mes (tabla historial)
  const [stats, setStats] = useState<MonthStats | null>(null);
  useEffect(() => {
    monthStats().then(setStats).catch(() => setStats(null));
  }, [historyVersion, products.length]);
  // Nombres recordados
  const [learned, setLearned] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [msg, setMsg] = useState("");
  useFocusEffect(
    useCallback(() => {
      countLearned().then(setLearned).catch(() => setLearned(null));
    }, []),
  );
  // Borrar todos los datos (doble confirmación)
  const [wipeStep, setWipeStep] = useState<0 | 1>(0);
  const [wipeText, setWipeText] = useState("");
  const [notifMsg, setNotifMsg] = useState("");

  const soon = products.filter((p) => getStatus(p.expiresOn) === "proximo").length;
  const expired = products.filter((p) => getStatus(p.expiresOn) === "vencido").length;
  const byPlace = (place: string) => products.filter((p) => (p.location ?? "Alacena") === place).length;
  const toPantry = (params: Record<string, string>) => router.push({ pathname: "/pantry", params });
  const cityCovered = CIUDADES_CON_PRECIOS.includes(ajustes.ciudad);

  async function saveName() {
    await setAjuste("nombre", nameDraft.trim()).catch(() => {});
    setEditingName(false);
  }

  async function toggleNotification(key: "alertas" | "recordatorioCompras", value: boolean) {
    setNotifMsg("");
    if (value) {
      const ok = await requestNotificationPermission().catch(() => false);
      if (!ok) {
        setNotifMsg("Sin permiso de notificaciones. Actívalo en los ajustes del celular.");
        return;
      }
    }
    await setAjuste(key, value).catch(() => {});
    await rescheduleNotifications().catch(() => {});
  }

  async function clearNames() {
    try {
      await clearLearned();
      setLearned(0);
      setMsg("Listo: se borraron los nombres recordados.");
    } catch {
      setMsg("No se pudieron borrar. Intenta de nuevo.");
    }
    setConfirmClear(false);
  }

  async function wipeAll() {
    if (wipeText.trim().toUpperCase() !== "BORRAR") return;
    try {
      await clearAllData();
      setLearned(0);
      setNameDraft("");
      setMsg("Se borraron todos los datos. La app quedó como nueva.");
    } catch {
      setMsg("No se pudieron borrar los datos. Intenta de nuevo.");
    }
    setWipeStep(0);
    setWipeText("");
  }

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen title="Perfil y configuración" active="Perfil">
      {/* Perfil */}
      <View style={[ui.row, { backgroundColor: C.surfaceSoft, padding: 14, borderRadius: 14 }]}>
        <View style={[ui.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
          <Txt style={{ fontFamily: "Jakarta", fontWeight: "600", fontSize: 20, color: C.primaryDark }}>
            {initials(ajustes.nombre)}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: "600", fontSize: 16 }}>{ajustes.nombre.trim() || "Escribe tu nombre"}</Txt>
          <Txt style={ui.muted}>{ajustes.ciudad}</Txt>
        </View>
        <Chip
          label={editingName ? "Cancelar" : "Editar"}
          onPress={() => {
            setNameDraft(ajustes.nombre);
            setEditingName(!editingName);
          }}
        />
      </View>
      {editingName && (
        <View style={ui.card}>
          <TextInput
            accessibilityLabel="Tu nombre"
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Tu nombre"
            placeholderTextColor={C.muted}
            autoFocus
            onSubmitEditing={saveName}
            style={ui.input}
          />
          <Button title="Guardar nombre" onPress={saveName} />
        </View>
      )}

      {/* Resumen */}
      <View style={[ui.row, { gap: 10, alignItems: "stretch" }]}>
        <StatTile value={products.length} label="En la despensa" onPress={() => toPantry({})} />
        <StatTile value={soon} label="Por vencer" bg={C.warningSoft} onPress={() => toPantry({ status: "proximo" })} />
        <StatTile
          value={expired}
          label="Vencidos"
          bg={C.danger}
          fg={C.white}
          fgMuted={C.white}
          onPress={() => toPantry({ status: "vencido" })}
        />
      </View>

      {/* Este mes: aprovechado vs. botado */}
      <View style={ui.card}>
        <Txt style={ui.section}>Este mes</Txt>
        {stats && stats.aprovechado !== null ? (
          <>
            <View style={[ui.row, { gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: "Jakarta", fontWeight: "700", fontSize: 24, color: C.ok }}>
                  {stats.consumidos}
                </Txt>
                <Txt style={ui.muted}>aprovechados</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: "Jakarta", fontWeight: "700", fontSize: 24, color: C.danger }}>
                  {stats.botados}
                </Txt>
                <Txt style={ui.muted}>botados</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontFamily: "Jakarta", fontWeight: "700", fontSize: 24 }}>{stats.aprovechado} %</Txt>
                <Txt style={ui.muted}>aprovechado</Txt>
              </View>
            </View>
            <View
              accessibilityLabel={`${stats.aprovechado} por ciento aprovechado`}
              style={{ height: 10, backgroundColor: C.dangerSoft, borderRadius: 5, overflow: "hidden" }}
            >
              <View style={{ height: 10, width: `${stats.aprovechado}%`, backgroundColor: C.ok }} />
            </View>
            {stats.topBotados.length > 0 && (
              <View style={{ gap: 4 }}>
                <Txt style={{ fontWeight: "600" }}>Lo que más se te vence</Txt>
                {stats.topBotados.map(([cat, n], i) => (
                  <Txt key={cat} style={ui.muted}>
                    {i + 1}. {cat} · {n} {n === 1 ? "producto" : "productos"}
                  </Txt>
                ))}
              </View>
            )}
          </>
        ) : (
          <Txt style={[ui.muted, { lineHeight: 19 }]}>
            Aún no hay datos este mes. Cuando quites un producto de tu despensa, elige “Lo consumí” o “Se venció /
            lo boté”, y aquí verás cuánto aprovechas.
          </Txt>
        )}
      </View>

      {/* Cuenta */}
      <Section title="Cuenta" />
      <View>
        <SettingRow title="Nombre" value={ajustes.nombre.trim() || "Sin nombre"} onPress={() => setEditingName(true)} />
        <SettingRow title="Ciudad" value={ajustes.ciudad} onPress={() => setPickCity(!pickCity)} />
      </View>
      {pickCity && (
        <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
          {CIUDADES.map((c) => (
            <Chip
              key={c}
              label={c}
              active={ajustes.ciudad === c}
              onPress={() => {
                setAjuste("ciudad", c).catch(() => {});
                setPickCity(false);
              }}
            />
          ))}
        </View>
      )}
      {!cityCovered && <Note>Los precios se muestran como referencia de otras ciudades.</Note>}

      {/* Preferencias */}
      <Section title="Preferencias" />
      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 15, fontWeight: "600" }}>Días de anticipación</Txt>
        <Txt style={{ fontSize: 12, color: C.muted }}>
          Un producto está “Próximo a vencer” si le quedan estos días o menos.
        </Txt>
        <View style={[ui.row, { gap: 8 }]}>
          {[3, 5, 7].map((d) => (
            <Chip
              key={d}
              label={`${d} días`}
              active={ajustes.diasAnticipacion === d}
              onPress={() => setAjuste("diasAnticipacion", d).catch(() => {})}
            />
          ))}
        </View>
      </View>
      <View>
        {["Nevera", "Congelador", "Alacena"].map((place) => (
          <SettingRow
            key={place}
            title={place}
            value={`${byPlace(place)} ${byPlace(place) === 1 ? "producto" : "productos"}`}
            onPress={() => toPantry({ ubicacion: place })}
          />
        ))}
        <SettingRow title="Idioma" value="Español" />
      </View>

      {/* Notificaciones */}
      <Section title="Notificaciones" />
      <View>
        <SettingRow
          title="Alertas de vencimiento"
          detail={`Aviso diario: “Tienes N productos por vencer”`}
          toggle={ajustes.alertas}
          onToggle={(v) => toggleNotification("alertas", v)}
          disabled={!notificationsSupported}
        />
        <SettingRow
          title="Recordatorio de compras"
          detail="Aviso semanal (sábado) si tu lista tiene pendientes"
          toggle={ajustes.recordatorioCompras}
          onToggle={(v) => toggleNotification("recordatorioCompras", v)}
          disabled={!notificationsSupported}
        />
      </View>
      {(ajustes.alertas || ajustes.recordatorioCompras) && (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 15, fontWeight: "600" }}>Hora del aviso</Txt>
          <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
            {HOURS.map((h) => (
              <Chip
                key={h}
                label={hourLabel(h)}
                active={ajustes.horaAlerta === h}
                onPress={() => setAjuste("horaAlerta", h).catch(() => {})}
              />
            ))}
          </View>
        </View>
      )}
      {!notificationsSupported && <Note>Las notificaciones están disponibles en la app del celular.</Note>}
      {!!notifMsg && <Txt style={{ color: C.danger }}>{notifMsg}</Txt>}

      {/* Facturas */}
      <Section title="Facturas" />
      <SettingRow
        title="Nombres recordados"
        detail="Correcciones que se usan al escanear otra factura con el mismo producto"
        value={learned === null ? "—" : String(learned)}
      />
      {confirmClear ? (
        <View style={[ui.card, { backgroundColor: C.dangerSoft, borderColor: C.danger }]}>
          <Txt style={{ fontWeight: "600" }}>¿Borrar {learned ?? 0} nombres recordados? No se puede deshacer.</Txt>
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
            setMsg("");
            setConfirmClear(true);
          }}
        />
      )}

      {/* Datos */}
      <Section title="Datos" />
      <Button
        title="Exportar mis datos"
        variant="secondary"
        onPress={() => Share.share({ message: pantrySummary(products) }).catch(() => {})}
      />
      {wipeStep === 0 ? (
        <Button title="Borrar todos los datos" variant="danger" onPress={() => setWipeStep(1)} />
      ) : (
        <View style={[ui.card, { backgroundColor: C.dangerSoft, borderColor: C.danger }]}>
          <Txt style={{ fontWeight: "600" }}>¿Borrar TODOS los datos?</Txt>
          <Txt style={{ fontSize: 12 }}>
            Se borran la despensa, la lista de compras, el historial, los nombres recordados y tus ajustes. No se
            puede deshacer. Escribe BORRAR para confirmar.
          </Txt>
          <TextInput
            accessibilityLabel="Escribe BORRAR para confirmar"
            value={wipeText}
            onChangeText={setWipeText}
            autoCapitalize="characters"
            placeholder="BORRAR"
            placeholderTextColor={C.muted}
            style={ui.input}
          />
          <Button
            title="Borrar todo"
            variant="danger"
            disabled={wipeText.trim().toUpperCase() !== "BORRAR"}
            onPress={wipeAll}
          />
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => {
              setWipeStep(0);
              setWipeText("");
            }}
          />
        </View>
      )}
      {!!msg && <Txt style={ui.muted}>{msg}</Txt>}
      <Txt style={[ui.muted, { fontSize: 12 }]}>
        Cuenta local, sin sesión: tus datos se guardan solo en este celular.
      </Txt>

      {/* Acerca de */}
      <Section title="Acerca de" />
      <View style={[ui.row, { gap: 10, backgroundColor: C.surfaceSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }]}>
        <Logo height={28} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontFamily: "Jakarta", fontWeight: "600", fontSize: 15 }}>Despensa Viva v{version}</Txt>
          <Txt style={{ fontSize: 12, color: C.muted }}>Que nada se te venza</Txt>
        </View>
      </View>
      <View>
        <SettingRow title="Integrantes" detail="Samuel David Rodríguez Mendoza · Juan Esteban Gutiérrez Sanabria" />
        <SettingRow title="Materia" detail="Taller de Aplicaciones Móviles · Universidad de Boyacá" />
      </View>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL("https://world.openfoodfacts.org")}>
        <Txt style={[ui.muted, { fontSize: 12, lineHeight: 18 }]}>
          Datos de Open Food Facts (ODbL) · openfoodfacts.org.{"\n"}
          Precios de referencia: Los Precios (datos abiertos), solo Bogotá, Medellín, Cali y Barranquilla.
        </Txt>
      </Pressable>
    </Screen>
  );
}
