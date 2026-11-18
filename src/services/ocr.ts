import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { NativeModules } from "react-native";
import { linesToText, type OcrLine } from "@/utils/ocrLayout";

/* ------------------------------------------------------------------ */
/*  OCR: leer el texto de una foto                                      */
/*                                                                      */
/*  1. En el celular con ML Kit (Google), SIN límite y SIN internet.    */
/*     Solo existe en la app compilada (APK / development build):       */
/*     Expo Go no trae esa librería nativa.                             */
/*  2. En la nube con OCR.space, si ML Kit no está (Expo Go) o falla.   */
/*     Plan gratis: 25.000 lecturas/mes y 500/día por IP, por llave.    */
/*     Se pueden poner varias llaves: si una se agota, usa la siguiente.*/
/* ------------------------------------------------------------------ */

export type OcrKind = "date" | "receipt";
export class OcrError extends Error {}

type MlKit = {
  recognize: (uri: string) => Promise<{ text: string; blocks: { lines: OcrLine[] }[] }>;
};

// Solo se carga si el módulo nativo existe (app compilada). En Expo Go no existe
// y la app sigue con la nube, sin romperse.
const mlkit: MlKit | null = NativeModules.TextRecognition
  ? (require("@react-native-ml-kit/text-recognition").default as MlKit)
  : null;

/** "device" = ML Kit en el celular (sin límite); "cloud" = OCR.space. */
export const ocrMode: "device" | "cloud" = mlkit ? "device" : "cloud";

async function readOnDevice(uri: string): Promise<string> {
  const result = await mlkit!.recognize(uri);
  const lines = result.blocks.flatMap((b) => b.lines);
  return lines.length ? linesToText(lines) : result.text;
}

/* ------------------------------ Nube -------------------------------- */

const ENDPOINT = "https://api.ocr.space/parse/image";
// En .env: EXPO_PUBLIC_OCR_SPACE_KEY=llave1,llave2  (separadas por coma).
// "helloworld" es la llave pública de prueba: límites muy bajos.
const KEYS = (process.env.EXPO_PUBLIC_OCR_SPACE_KEY || "helloworld")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
let keyIndex = 0; // la última llave que funcionó

const MAX_BYTES = 950_000; // margen bajo el límite de 1 MB del plan gratis
const TIMEOUT_MS = 30_000;
const LIMIT_WORDS = /limit|maximum|exceed|quota|too many|upto/i;

class LimitError extends Error {}

/** Achica y comprime la foto hasta que pese menos de 1 MB. Devuelve base64 JPEG. */
async function prepareImage(uri: string, kind: OcrKind): Promise<string> {
  const widths = kind === "receipt" ? [1600, 1300, 1000] : [1200, 1000, 800];
  for (const width of widths) {
    for (const compress of [0.7, 0.5]) {
      const ref = await ImageManipulator.manipulate(uri)
        .resize({ width, height: null })
        .renderAsync();
      const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      const b64 = result.base64 ?? "";
      if (b64 && b64.length * 0.75 < MAX_BYTES) return b64;
    }
  }
  throw new OcrError("La foto es demasiado pesada. Acércate un poco más e inténtalo de nuevo.");
}

type OcrResponse = {
  ParsedResults?: { ParsedText?: string }[];
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  OCRExitCode?: number;
};

async function callCloud(base64: string, kind: OcrKind, key: string): Promise<string> {
  const form = new FormData();
  form.append("base64Image", `data:image/jpeg;base64,${base64}`);
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("detectOrientation", "true");
  if (kind === "receipt") form.append("isTable", "true");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let data: OcrResponse;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { apikey: key },
      body: form,
      signal: controller.signal,
    });
    if (res.status === 403 || res.status === 429) throw new LimitError();
    if (!res.ok) throw new OcrError(`El servicio de lectura respondió con error (${res.status}).`);
    data = (await res.json()) as OcrResponse;
  } catch (e) {
    if (e instanceof OcrError || e instanceof LimitError) throw e;
    if ((e as Error).name === "AbortError")
      throw new OcrError("La lectura tardó demasiado. Revisa tu conexión e inténtalo de nuevo.");
    throw new OcrError("No hay conexión con el servicio de lectura. Revisa tu internet.");
  } finally {
    clearTimeout(timer);
  }

  const msg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(" ") : data.ErrorMessage;
  if (data.IsErroredOnProcessing || (data.OCRExitCode ?? 1) >= 3) {
    if (msg && LIMIT_WORDS.test(msg)) throw new LimitError();
    throw new OcrError(msg ? `No se pudo leer la imagen: ${msg}` : "No se pudo leer la imagen.");
  }
  return (data.ParsedResults ?? []).map((r) => r.ParsedText ?? "").join("\n");
}

async function readInCloud(uri: string, kind: OcrKind): Promise<string> {
  const base64 = await prepareImage(uri, kind);
  // Prueba las llaves en orden, empezando por la última que funcionó.
  for (let tries = 0; tries < KEYS.length; tries++) {
    const i = (keyIndex + tries) % KEYS.length;
    try {
      const text = await callCloud(base64, kind, KEYS.at(i)!);
      keyIndex = i;
      return text;
    } catch (e) {
      if (!(e instanceof LimitError)) throw e;
    }
  }
  throw new OcrError(
    "Se alcanzó el límite del servicio de lectura. Usa otra llave del OCR o escribe los datos a mano.",
  );
}

/* --------------------------- Punto de entrada ---------------------------- */

/**
 * Lee el texto de una foto (uri local de la cámara o la galería).
 * Primero en el celular (ML Kit); si no está disponible o falla, en la nube.
 * Lanza OcrError con un mensaje listo para mostrar al usuario.
 */
export async function recognizeText(uri: string, kind: OcrKind): Promise<string> {
  let text = "";
  let useCloud = !mlkit;
  if (mlkit) {
    try {
      text = await readOnDevice(uri);
    } catch {
      useCloud = true; // si ML Kit falla, se intenta en la nube
    }
  }
  if (useCloud) text = await readInCloud(uri, kind);
  text = text.trim();
  if (!text) throw new OcrError("No se encontró texto en la foto. Prueba con más luz y más cerca.");
  return text;
}
