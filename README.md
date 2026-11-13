# Despensa Viva

Prototipo móvil en React Native, Expo SDK 57, Expo Router y TypeScript estricto, basado en el archivo de Figma «Despensa viva Claude».

## Iniciar

```powershell
npm install
npm start
```

Abrir el proyecto con Expo Go desde el QR de Expo. La prueba en un teléfono físico sigue pendiente. Para la vista web: `npm run web`.

## Pantallas y recorridos

- Inicio con resumen real, alertas y productos de la base local.
- Mi despensa: búsqueda por nombre o categoría, filtros por ubicación y vencimiento, orden por nombre o fecha.
- Detalle, registro manual, edición y eliminación con confirmación.
- Agregar producto → código de barras → producto encontrado → OCR → confirmar → despensa.
- Agregar producto → factura → revisar selección, nombres, cantidades y fechas → despensa.
- Compras con categorías, progreso, marcado de comprados y agregado manual o desde sugeridos.
- Perfil y configuración con el alcance disponible claramente indicado.

Los escáneres, el producto encontrado y la factura usan **datos de demostración**, no cámara ni servicios externos. La fecha siempre pasa por confirmación antes de guardarse. Las fechas propuestas desde factura se guardan como **estimadas** hasta que se corrigen.

## Persistencia

SQLite conserva la tabla `productos` anterior. Una migración agrega `cantidad`, `ubicacion` y `estimada` sin borrar registros. Los productos anteriores reciben cantidad 1, ubicación Alacena y fecha no estimada. La tabla `compras` guarda la lista y su estado entre aperturas. Las fechas se almacenan como `AAAA-MM-DD`.

La carga original de ejemplos se mantiene únicamente para bases nuevas. Los conteos de Inicio reflejan los datos reales, por lo que pueden diferir de los números estáticos de Figma.

Los lotes revisados de una factura se guardan en una transacción: un fallo revierte el lote completo.

## Diseño

Fondo `#F7F9F5`, tarjetas blancas, acciones `#2B77A8`, estados con texto y color. Fuentes Inter y Plus Jakarta Sans incluidas localmente con sus licencias SIL OFL. Los iconos SVG originales de Figma están en `assets/figma`, sin enlaces temporales en tiempo de ejecución. Los márgenes de seguridad utilizan el área segura real del dispositivo; la barra del sistema no muestra una hora ficticia.

## Verificación

```powershell
npm run typecheck
npm run test:store
npx expo export --platform web
npx expo export --platform android
```

`test:store` requiere Node 22.13 o posterior con `node:sqlite`. Ejecuta los módulos reales del almacén con un adaptador de SQLite en memoria: verifica migración desde el esquema anterior, conservación de datos, CRUD, cantidades, ubicación, factura atómica y reversión, compras y límites de vencimiento. No sustituye una prueba del puente nativo de Expo ni una prueba en teléfono.

La exportación web necesita cabeceras `Cross-Origin-Embedder-Policy: credentialless` y `Cross-Origin-Opener-Policy: same-origin` para SQLite. Metro las configura en desarrollo. En este entorno se observó un fallo de empaquetado del worker de SQLite en el servidor web de desarrollo; la exportación de producción sí compila. La validación visual en navegador no pudo completarse por un bloqueo de la herramienta de navegador.

## Pendiente para próximas fases

Cámara real, OCR en la nube, Open Food Facts, Los Precios, selección de imágenes, autenticación y notificaciones push. El perfil es informativo; no existe sesión que cerrar. No se incluye ninguna clave de API.

Las fechas estimadas por categoría son orientativas para el prototipo y deben revisarse contra el envase.

Verificación realizada: TypeScript, pruebas de almacenes y exportaciones de producción web y Android (Hermes) aprobadas. No se completó la comprobación visual ni una prueba en dispositivo físico.
