import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { getDb } from "./productStore";

/* ------------------------------------------------------------------ */
/*  Caché local de consultas por código de barras (tabla               */
/*  cache_productos) e imágenes guardadas en el almacenamiento de la   */
/*  app, para no repetir consultas ni descargas.                       */
/* ------------------------------------------------------------------ */

const FOUND_TTL_MS = 7 * 86_400_000; // producto encontrado: 7 días
const MISSING_TTL_MS = 86_400_000; // no encontrado: 1 día (puede agregarse luego)

async function cacheDb() {
  const db = await getDb();
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS cache_productos (ean TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, fecha TEXT NOT NULL)",
  );
  return db;
}

/** undefined = no está en caché (o venció); null = se sabe que no existe. */
export async function readCache<T>(ean: string): Promise<T | null | undefined> {
  const db = await cacheDb();
  const row = await db.getFirstAsync<{ json: string; fecha: string }>(
    "SELECT json, fecha FROM cache_productos WHERE ean = ?",
    [ean],
  );
  if (!row) return undefined;
  const value = JSON.parse(row.json) as T | null;
  const age = Date.now() - new Date(row.fecha).getTime();
  if (age > (value === null ? MISSING_TTL_MS : FOUND_TTL_MS)) return undefined;
  return value;
}

export async function writeCache(ean: string, value: unknown): Promise<void> {
  const db = await cacheDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO cache_productos (ean, json, fecha) VALUES (?, ?, ?)",
    [ean, JSON.stringify(value), new Date().toISOString()],
  );
}

/**
 * Descarga la imagen UNA vez a documentos/imagenes/{ean}.jpg y devuelve la
 * ruta local. Si ya existe, no la vuelve a descargar. En web (sin sistema de
 * archivos) devuelve la URL original.
 */
export async function saveImage(ean: string, url: string): Promise<string> {
  if (Platform.OS === "web") return url;
  try {
    const dir = new Directory(Paths.document, "imagenes");
    dir.create({ idempotent: true, intermediates: true });
    const file = new File(dir, `${ean}.jpg`);
    if (file.exists) return file.uri;
    const saved = await File.downloadFileAsync(url, file);
    return saved.uri;
  } catch {
    return url; // si la descarga falla, se muestra desde internet esta vez
  }
}
