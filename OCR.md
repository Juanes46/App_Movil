# OCR (lectura con la cámara)

La app lee la **fecha de vencimiento** y las **facturas** con la cámara, de dos formas:

| Dónde corre la app | Cómo lee | Límite | Internet |
|---|---|---|---|
| **App compilada (APK)** | ML Kit de Google, dentro del celular | **Sin límite** | No necesita |
| **Expo Go** | OCR.space, en la nube | 25.000/mes y 500/día por llave | Sí |

El código elige solo: si ML Kit está disponible lo usa; si no (Expo Go), usa la nube. Si ML Kit falla, intenta en la nube. El escáner muestra cuál se está usando.

## 1. Instalar (una vez, en cada copia del proyecto)

```sh
npm install
```

`@react-native-ml-kit/text-recognition` ya está en `package.json`. En otra copia del proyecto: `npm install @react-native-ml-kit/text-recognition`.

## 2. Llaves de la nube (para Expo Go y como respaldo)

1. Cada integrante pide una llave gratis en https://ocr.space/ocrapi.
2. Copiar `.env.example` como `.env` y poner las llaves separadas por coma:
   ```
   EXPO_PUBLIC_OCR_SPACE_KEY=llave_juan,llave_samuel
   ```
   Si una llave se agota, la app usa la siguiente.
3. Reiniciar con `npx expo start -c`.

## 3. Compilar el APK con ML Kit (lectura sin límite)

Expo Go no trae ML Kit, así que hay que compilar la app. Dos caminos:

**A. En la nube con EAS (no necesita Android Studio)**

```sh
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Al terminar, EAS muestra un enlace y un QR para descargar el APK. Se instala en cualquier Android (permitir "fuentes desconocidas"). La cola gratis puede tardar de 15 minutos a más de una hora.

El `.env` no se sube a EAS. Si quieren la nube como respaldo en el APK, pongan la llave en `eas.json`, dentro de `build.preview.env`:
```json
"env": { "EXPO_PUBLIC_OCR_SPACE_KEY": "llave_juan,llave_samuel" }
```
y no suban ese cambio a un repositorio público.

**B. En el PC con Android Studio**

Con Android Studio instalado y el celular conectado por USB (depuración USB activada):
```sh
npx expo run:android --variant release
```

## Cómo funciona

| Paso | Archivo |
|---|---|
| Cámara, recorte al recuadro, zoom, linterna | `src/components/ScannerLayout.tsx` |
| ML Kit o nube, llaves de respaldo | `src/services/ocr.ts` |
| Juntar líneas de ML Kit en filas (nombre + precio) | `src/utils/ocrLayout.ts` |
| Buscar la fecha en el texto | `detectExpirationDate` en `src/utils/expiration.ts` |
| Factura → productos, cantidad, categoría y vida útil aproximada | `parseReceipt` y `estimateDays` en `src/utils/receipt.ts` |

**Fecha estimada de la factura:** la factura no trae la fecha de vencimiento. `estimateDays` da una vida útil típica por tipo de producto (leche 7 días, pollo 2, pan 6, arroz 365…). Si no reconoce el producto, usa `ESTIMATED_DAYS` de su categoría (`src/constants/pantry.ts`). Se guarda marcada como "fecha estimada" y el usuario la puede corregir.

## Pruebas

```sh
npm run typecheck
npm run test:ocr     # fechas, facturas, filas de ML Kit y vida útil
npm run test:store
```

La cámara solo funciona en un celular físico.
