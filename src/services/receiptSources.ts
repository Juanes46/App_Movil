import { EAN_CONOCIDOS } from "@/data/eanConocidos";
import type { ParsedReceipt } from "@/utils/receipt";
import { getAllLearnedEans, getLearnedFor } from "./learnedNames";
import { getLpItem } from "./losPrecios";
import { getOffUniversal } from "./openFoodFacts";
import { readCache, writeCache } from "./productCache";
import { mapCategory } from "./productLookup";
import type { FoundName, IdentifySources, NameSource } from "./receiptIdentify";
import { getUpcItem } from "./upcItemDb";

/* ------------------------------------------------------------------ */
/*  Fuentes reales de la cadena de identificación de facturas           */
/*  (ver receiptIdentify.ts para el orden).                             */
/* ------------------------------------------------------------------ */

/** Códigos que permiten rescatar un EAN mal leído: diccionario + nombres recordados. */
export async function knownEansForParsing(): Promise<Set<string>> {
  const learned = await getAllLearnedEans().catch(() => new Set<string>());
  return new Set([...Object.keys(EAN_CONOCIDOS), ...learned]);
}

type CachedLookup = { nombre?: string; marca?: string | null; categoria?: string; tamano?: string | null; fuente?: string };

/** Las fuentes completas para una factura ya leída. */
export async function receiptSources(receipt: ParsedReceipt): Promise<IdentifySources> {
  const learned = await getLearnedFor(receipt).catch(() => new Map());
  return {
    learned,
    known: EAN_CONOCIDOS,
    cache: {
      // Misma tabla cache_productos que el escáner de código (buscarPorEAN), pero lo
      // de las facturas se guarda como "fac:EAN" para no tapar el precio y la imagen
      // que ese escáner necesita. Al leer se aprovecha también lo que él guardó.
      read: async (ean) => {
        const c =
          (await readCache<CachedLookup>(`fac:${ean}`)) ?? (await readCache<CachedLookup>(ean));
        if (!c?.nombre) return undefined;
        const fuente: NameSource =
          c.fuente === "Los Precios" ? "Los Precios" : c.fuente === "UPCitemdb" ? "UPCitemdb" : "Open Food Facts";
        return { nombre: c.nombre, marca: c.marca ?? null, categoria: c.categoria ?? null, tamano: c.tamano ?? null, fuente };
      },
      write: async (ean, f) => {
        const value = { ean, nombre: f.nombre, marca: f.marca ?? null, categoria: f.categoria ?? "Otros", tamano: f.tamano ?? null, imagen: null, fuente: f.fuente };
        await writeCache(`fac:${ean}`, value);
      },
    },
    remote: [
      {
        name: "Open Food Facts",
        lookup: async (ean): Promise<FoundName | null> => {
          const p = await getOffUniversal(ean);
          return p?.product_name
            ? {
                nombre: p.product_name,
                marca: p.brands?.split(",")[0]?.trim() || null,
                categoria: mapCategory(p.categories),
                tamano: p.quantity || null,
              }
            : null;
        },
      },
      {
        name: "Los Precios",
        lookup: async (ean) => {
          const r = await getLpItem(ean);
          return r ? { nombre: r.nombre, marca: r.marca, tamano: r.tamano } : null;
        },
      },
      {
        name: "UPCitemdb",
        lookup: async (ean) => {
          const u = await getUpcItem(ean);
          return u
            ? { nombre: u.title, marca: u.brand, categoria: mapCategory(u.category), tamano: u.size }
            : null;
        },
      },
    ],
  };
}
