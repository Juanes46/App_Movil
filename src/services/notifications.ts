import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getStatus } from "@/utils/expiration";
import { getProducts, onProductsChange } from "./productStore";
import { getAjustes, onAjustesChange } from "./settingsStore";
import { getShopping, onShoppingChange } from "./shoppingStore";

/* ------------------------------------------------------------------ */
/*  Notificaciones LOCALES (sin servidor) con expo-notifications.       */
/*  Funcionan en Expo Go y en el APK (lo que Expo Go no tiene desde el  */
/*  SDK 53 son las push remotas, que esta app no usa).                  */
/*   · Aviso diario a la hora elegida: "Tienes N productos por vencer"  */
/*   · Aviso semanal (sábado) si la lista de compras tiene pendientes   */
/*  Se reprograman al cambiar la despensa, la lista o los ajustes.      */
/* ------------------------------------------------------------------ */

const DAILY_ID = "vencimientos-diario";
const WEEKLY_ID = "compras-semanal";
const CHANNEL = "avisos";
export const notificationsSupported = Platform.OS !== "web";

let configured = false;
async function configure() {
  if (configured || !notificationsSupported) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Avisos de Despensa Viva",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
}

/** Pide permiso (al activar un interruptor). true si se concedió. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  await configure();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Vuelve a programar los avisos según los ajustes y los datos actuales.
 *   alertas = true, 3 productos por vencer, hora 8 -> aviso diario 8:00 "Tienes 3 productos por vencer"
 */
export async function rescheduleNotifications(): Promise<void> {
  if (!notificationsSupported) return;
  await configure();
  const perm = await Notifications.getPermissionsAsync();
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
  if (!perm.granted) return;
  const a = getAjustes();
  const hour = Math.min(23, Math.max(0, Math.round(a.horaAlerta)));

  if (a.alertas) {
    const soon = getProducts().filter((p) => getStatus(p.expiresOn) !== "vigente").length;
    if (soon > 0)
      await Notifications.scheduleNotificationAsync({
        identifier: DAILY_ID,
        content: {
          title: "Despensa Viva",
          body: `Tienes ${soon} ${soon === 1 ? "producto" : "productos"} por vencer`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL },
      });
  }
  if (a.recordatorioCompras) {
    const pending = getShopping().filter((i) => !i.done).length;
    if (pending > 0)
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_ID,
        content: {
          title: "Lista de compras",
          body: `Tienes ${pending} ${pending === 1 ? "producto pendiente" : "productos pendientes"} en tu lista`,
        },
        // 7 = sábado (1 = domingo)
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 7, hour, minute: 0, channelId: CHANNEL },
      });
  }
}

let started = false;
/** Reprograma (con una pequeña espera) cada vez que cambia algo. Se llama una vez al abrir la app. */
export function startNotificationSync(): void {
  if (started || !notificationsSupported) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => rescheduleNotifications().catch(() => {}), 1500);
  };
  onProductsChange(later);
  onShoppingChange(later);
  onAjustesChange(later);
  later();
}
