// Pruebas del OCR sin celular ni internet: textos como los que devuelve
// OCR.space y lo que la app debe sacar de ellos.  Uso: npm run test:ocr
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

const cache = new Map();
function load(name) {
  const filename = path.resolve("src", name + ".ts");
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  cache.set(filename, mod.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (id) => (id.startsWith("@/") ? load(id.slice(2)) : require(id));
  vm.runInThisContext("(function(require,module,exports){" + code + "\n})", { filename })(
    localRequire,
    mod,
    mod.exports,
  );
  return mod.exports;
}

const exp = load("utils/expiration");
const { parseReceipt, guessCategory, estimateDays } = load("utils/receipt");
const { linesToText } = load("utils/ocrLayout");
const { suggestLocation } = load("utils/location");
const iso = (d) => exp.toISODate(d);

// ---- Fechas de vencimiento ----
assert.equal(iso(exp.detectExpirationDate("LOTE 2309\nF.V. 15/03/2027").date), "2027-03-15");
assert.equal(iso(exp.detectExpirationDate("FAB 01/10/2026\nVENCE 01/04/2027").date), "2027-04-01");
assert.equal(iso(exp.detectExpirationDate("EXP 12 ENE 2027").date), "2027-01-12");
assert.equal(iso(exp.detectExpirationDate("F.VENC: 05-11-27").date), "2027-11-05");
// Sin palabra clave: toma la más lejana (fabricación < vencimiento)
assert.equal(iso(exp.detectExpirationDate("10/09/2026 L123\n10/03/2027").date), "2027-03-10");
assert.equal(exp.detectExpirationDate("LOTE A23 HORA 14:32"), null);

// ---- Factura tipo supermercado colombiano ----
const exito = `ALMACENES EXITO S.A.
NIT 890.900.608-9
CALLE 80 # 69-70 BOGOTA
FACTURA ELECTRONICA DE VENTA No. E123
7702001041125 LECHE ENTERA ALQUERIA 1L 4.500 A
2 X 2.250
7701234567890 HUEVOS AA X12 15.900
ARROZ DIANA 1000G 5.900
7707211500016 ATUN EN AGUA VAN CAMPS 8.300
TOMATE CHONTO 2.340
DETERG LIQ 12.500
SUBTOTAL 49.440
IVA 19% 1.995
TOTAL 51.435
EFECTIVO 60.000
CAMBIO 8.565
GRACIAS POR SU COMPRA`;
const r = parseReceipt(exito);
assert.equal(r.store, "Exito");
const names = r.items.map((i) => i.name);
assert.deepEqual(names, [
  "Leche entera alqueria 1L",
  "Huevos aa x12",
  "Arroz diana 1000G",
  "Atun en agua van camps",
  "Tomate chonto",
  "Deterg liq",
]);
assert.equal(r.items[0].quantity, 2);
assert.equal(r.items[0].category, "Lácteos");
assert.equal(r.items[2].category, "Granos");
assert.equal(r.items[3].category, "Enlatados");
assert.equal(r.items[4].category, "Frutas y verduras");
assert.equal(r.items[5].category, "Aseo del hogar");

// Factura D1 con cantidad al inicio y repetidos
const d1 = `TIENDAS D1
2 X PAN TAJADO 3.200
GASEOSA 1.5L 4.100
GASEOSA 1.5L 4.100
TOTAL 14.600`;
const r2 = parseReceipt(d1);
assert.equal(r2.store, "D1");
assert.deepEqual(r2.items.map((i) => [i.name, i.quantity, i.category]), [
  ["Pan tajado", 2, "Panadería"],
  ["Gaseosa 1.5L", 2, "Bebidas"],
]);

// El OCR separó nombres y precios en líneas distintas, con encabezado y peso
const split = `SUPERMERCADO LA 14
LECHE DESLACTOSADA COLANTA 1.1L
5.200
QUESO CAMPESINO 500G
11.900
0,450 KG X 4.200
BANANO
1.890
TOTAL 18.990`;
const r3 = parseReceipt(split);
assert.deepEqual(r3.items.map((i) => i.name), [
  "Leche deslactosada colanta 1.1L",
  "Queso campesino 500G",
  "Banano",
]);
assert.ok(r3.text.includes("TOTAL"));

// Factura de Ara con columnas (foto real de prueba)
const ara = `TIENDAS ARA JERONIMO MARTINS COLOMBIA S.A.S. 900480569-1
#  CODIGO  DESCRIP  ID  CANT UM  VALOR/U  VALOR/T
1 7702025152773 NOEL NAVIDAD X J 1 UN 9.590 9.590
2 2000000046006 DONUT FRESA 53 CZ 1 UN 2.990 2.990
4 7709706206107 TOR VIN FELICES J 1 UN 10.590 10.590
5 7704269361232 PAN TAJ AMAP ES C 1 UN 4.990 4.990
6 2000000040806 BOLSAS T-SHIRT J 1 EA 127 73
8 7703308010025 ARROZ CASANARE C 2 UN 1.950 3.900
9 7702354955373 TE POLVO SUNTEA J 2 UN 1.570 3.140
14 7702535025482 COCA COLA 1750m J 1 UN 6.490 6.490
TOTALES:*RECARGOS= 0 DESCUENTOS= -2.600 FACTURA= 68.450`;
const r4 = parseReceipt(ara);
assert.equal(r4.store, "Ara");
assert.deepEqual(r4.items.map((i) => [i.name, i.quantity, i.category]), [
  ["Noel navidad", 1, "Snacks y dulces"],
  ["Donut fresa 53", 1, "Panadería"],
  ["Tor vin felices", 1, "Panadería"],
  ["Pan taj amap", 1, "Panadería"],
  ["Arroz casanare", 2, "Granos"],
  ["Te polvo suntea", 2, "Bebidas"],
  ["Coca cola 1750M", 1, "Bebidas"],
]);

assert.equal(guessCategory("PECHUGA POLLO"), "Carnes");
assert.equal(parseReceipt("TOTAL 10.000\nGRACIAS").items.length, 0);

// ML Kit: nombres y precios en bloques distintos se vuelven a juntar por fila
const f = (left, top) => ({ left, top, width: 100, height: 20 });
const joined = linesToText([
  { text: "ARROZ DIANA 1000G", frame: f(10, 100) },
  { text: "LECHE ENTERA 1L", frame: f(10, 130) },
  { text: "5.900", frame: f(400, 102) },
  { text: "4.500", frame: f(400, 131) },
]);
assert.equal(joined, "ARROZ DIANA 1000G  5.900\nLECHE ENTERA 1L  4.500");
assert.deepEqual(parseReceipt(joined).items.map((i) => i.name), ["Arroz diana 1000G", "Leche entera 1L"]);

// Vida útil aproximada por tipo de producto
assert.equal(estimateDays("LECHE ENTERA", "Lácteos"), 7);
assert.equal(estimateDays("PECHUGA POLLO", "Carnes"), 2);
assert.equal(estimateDays("ARROZ DIANA", "Granos"), 365);
assert.equal(estimateDays("BANANO", "Frutas y verduras"), 5);
assert.equal(estimateDays("DETERG LIQ", "Aseo del hogar"), 730);
assert.ok(r4.items.every((i) => i.days > 0));
assert.equal(r4.items.find((i) => i.name === "Donut fresa 53").days, 3);

// Condimentos y aseo no son verduras ni se vencen pronto (categorías propias)
assert.equal(guessCategory("CONDIMENTO AJO"), "Condimentos y aceites");
assert.equal(estimateDays("CONDIMENTO AJO", "Condimentos y aceites"), 365);
assert.equal(guessCategory("CR COLGATE MENT"), "Cuidado personal");
assert.equal(guessCategory("AJO"), "Frutas y verduras");

// Ubicación: nevera, congelador o alacena
assert.equal(suggestLocation("Leche entera", "Lácteos"), "Nevera");
assert.equal(suggestLocation("Leche UHT larga vida", "Lácteos"), "Alacena");
assert.equal(suggestLocation("Pechuga de pollo", "Carnes"), "Congelador");
assert.equal(suggestLocation("Helado de vainilla", "Otros"), "Congelador");
assert.equal(suggestLocation("Jamón de cerdo", "Carnes"), "Nevera");
assert.equal(suggestLocation("Manzanas", "Frutas y verduras"), "Nevera");
assert.equal(suggestLocation("Banano", "Frutas y verduras"), "Alacena");
assert.equal(suggestLocation("Condimento ajo", "Otros"), "Alacena");
assert.equal(suggestLocation("Arroz casanare", "Granos"), "Alacena");
assert.equal(suggestLocation("Huevos AA x12", "Lácteos"), "Nevera");
assert.equal(suggestLocation("Yogur natural", "Lácteos"), "Nevera");
assert.equal(suggestLocation("Producto raro", "Lácteos"), "Nevera");
assert.equal(suggestLocation("Donut fresa 53", "Panadería"), "Alacena");
assert.equal(suggestLocation("Yogur de fresa", "Lácteos"), "Nevera");
assert.equal(suggestLocation("Fresas", "Frutas y verduras"), "Nevera");

// El encabezado de la tabla de la factura no es un producto
const hdr = parseReceipt(`#  CODIGO  DESCRIP  ID  CANT UM  VALOR/U  VALOR/T
1 7702025152773 NOEL NAVIDAD X J 1 UN 9.590 9.590
2 2000000046006 DONUT FRESA 53 CZ 1 UN 2.990 2.990`);
assert.ok(hdr.items.every((i) => !/codigo|descrip/i.test(i.name)));

// ---- Categorías nuevas: lo específico gana ----
const { emojiForProduct, emojiFor, defaultLocation, ESTIMATED_DAYS } = load("constants/pantry");
const show = (label, value) => console.log("  " + label.padEnd(34) + " -> " + value);
console.log("Clasificación (nombre -> categoría · ubicación · días · icono):");
const cases = [
  ["JABON PROTEX AVENA", "Cuidado personal"],
  ["PROTEX AVENA 110G", "Cuidado personal"],
  ["AVENA", "Granos"],
  ["AVENA HOJUELAS 400G", "Granos"],
  ["AVENA ALPINA 250G", "Lácteos"],
  ["AVENA LIQUIDA", "Lácteos"],
  ["CREMA DENTAL COLGATE", "Cuidado personal"],
  ["SALSA DE TOMATE FRUCO", "Condimentos y aceites"],
  ["JUGO DE LIMON", "Bebidas"],
  ["SHAMPOO HEAD SHOULDERS 375ML", "Cuidado personal"],
  ["HEAD & SHOULDERS", "Cuidado personal"],
  ["PAP HIG FAMILIA 12 ROLLOS", "Aseo del hogar"],
  ["JABON LOZA AXION", "Aseo del hogar"],
  ["DET ARIEL 1KG", "Aseo del hogar"],
  ["LIMPIDO CLOROX", "Aseo del hogar"],
  ["REXONA", "Cuidado personal"],
  ["DOVE ORIGINAL", "Cuidado personal"],
  ["SAVITAL", "Cuidado personal"],
  ["BONAROMA", "Aseo del hogar"],
  ["GALLETAS FESTIVAL", "Snacks y dulces"],
  ["HELADO VAINILLA", "Congelados"],
  ["NUGGETS DE POLLO", "Congelados"],
  ["ACEITE GIRASOL", "Condimentos y aceites"],
  ["DOG CHOW ADULTOS", "Mascotas"],
  ["LCH ENTERA", "Lácteos"],
  ["QSO CAMPESINO", "Lácteos"],
  ["HVO AA X30", "Lácteos"],
  ["MANTEQ", "Lácteos"],
  ["GASEOS COLOMBIANA", "Bebidas"],
  ["BAVARIA CLUB COLOMBIA", "Bebidas"],
];
for (const [name, cat] of cases) {
  const got = guessCategory(name);
  show(name, `${got} · ${suggestLocation(name, got)} · ${estimateDays(name, got)} d · ${emojiForProduct(name, got)}`);
  assert.equal(got, cat, name);
}
assert.equal(suggestLocation("Protex avena 110G", "Cuidado personal"), "Alacena");
assert.equal(estimateDays("PROTEX AVENA 110G", "Cuidado personal"), 730);
assert.equal(estimateDays("AVENA HOJUELAS", "Granos"), 180);
assert.equal(suggestLocation("Helado vainilla", "Congelados"), "Congelador");
// Iconos: por producto; si no, por categoría; categoría vieja -> 📦
assert.equal(emojiForProduct("Queso campesino", "Lácteos"), "🧀");
assert.equal(emojiForProduct("Crema dental", "Cuidado personal"), "🪥");
assert.equal(emojiForProduct("Jugo de limón", "Bebidas"), "🧃");
assert.equal(emojiForProduct("Producto raro", "Granos"), "🍚");
assert.equal(emojiForProduct("Algo", "Categoría vieja"), "📦");
assert.equal(emojiFor("Categoría vieja"), "📦");
assert.equal(defaultLocation("Categoría vieja"), "Alacena");
assert.equal(ESTIMATED_DAYS["Aseo del hogar"], 730);

// ---- Fechas de vencimiento: formatos nuevos, OCR y confianza ----
const today = new Date(2026, 10, 22); // fija para que la prueba no dependa del día
const fmt = (d) => (d ? `${iso(d.date)} · confianza ${d.confidence}${d.corrected ? " · corregida" : ""}${d.monthOnly ? " · solo mes/año" : ""} · leído "${d.raw}"` : "null");
console.log("Fechas (texto -> fecha detectada):");
const dates = [
  ["VENCE 15 NOV 26", "2026-11-15", "alta"],
  ["EXP 11/2026", "2026-11-30", "baja"],
  ["F.V 2026-11-15", "2026-11-15", "alta"],
  ["L0TE 123 VENC 15/1O/2026", "2026-10-15", "baja"],
  ["15NOV26", "2026-11-15", "media"],
  ["NOV 2027", "2027-11-30", "baja"],
  ["CONSUMIR ANTES DE 15.11.27", "2027-11-15", "alta"],
  ["VENCE 15 11 2027", "2027-11-15", "alta"],
  ["BEST BEFORE 03-28", "2028-03-31", "baja"],
  ["ELAB 01/06/2026\nVENCE 01/06/2027", "2027-06-01", "alta"],
  ["FAB 01/10/2026 VTO 01/04/2027", "2027-04-01", "alta"],
  ["LOTE 15/11/2026 12/05/2027", "2027-05-12", "baja"],
  ["15/11/2026", "2026-11-15", "media"],
  ["VENCE 15/11/2045", null, null], // más de 5 años: absurda
  ["VENCE 15/11/2020", null, null], // más de 1 año atrás: absurda
  ["EXP 2O27-O1-15", "2027-01-15", "baja"],
];
for (const [text, want, conf] of dates) {
  const d = exp.detectExpirationDate(text, today);
  show(text.replace("\n", " ⏎ "), fmt(d));
  if (want === null) assert.equal(d, null, text);
  else {
    assert.equal(iso(d.date), want, text);
    assert.equal(d.confidence, conf, text);
  }
}

// ---- Facturas reales: nombres partidos, tamaños, impuestos y OCR ----
const printItems = (title, receipt) => {
  console.log(`${title} (tienda: ${receipt.store}):`);
  for (const i of receipt.items)
    show(
      i.raw,
      `${i.name} · x${i.quantity} · ${i.category} · ${i.days} d${i.lowConfidence ? " · ⚠ revisar" : ""}`,
    );
};
const exito2 = parseReceipt(`ALMACENES EXITO S.A.
NIT 890.900.608-9
7702310040123 JABON PROTEX AVENA 3X110G 12.900 A
PR0TEX AVENA 110G 4.300 E
AVENA HOJUELAS 400G 3.950
SHAMPOO HEAD
SHOULDERS 375ML 18.900 A
PAP HIG FAMILIA 12 ROLLOS 21.500 A
LCH ENTERA COLANTA 1.1L 4.900 E
XQZ 2.000
SUBTOTAL 68.450
TOTAL 68.450`);
printItems("Éxito", exito2);
const n2 = exito2.items.map((i) => [i.name, i.quantity, i.category]);
assert.deepEqual(n2, [
  ["Jabon protex avena 3X110G", 1, "Cuidado personal"],
  ["Protex avena 110G", 1, "Cuidado personal"],
  ["Avena hojuelas 400G", 1, "Granos"],
  ["Shampoo head shoulders 375ML", 1, "Cuidado personal"],
  ["Pap hig familia 12 rollos", 1, "Aseo del hogar"],
  ["Lch entera colanta 1.1L", 1, "Lácteos"],
  ["Xqz", 1, "Otros"],
]);
assert.equal(exito2.items[1].corrected, true); // PR0TEX -> PROTEX
// La suma (68.450) cuadra con el TOTAL: la corrección del OCR no basta para dudar.
assert.equal(exito2.total, 68450);
assert.equal(exito2.totalMatches, true);
assert.equal(exito2.items[1].lowConfidence, false);
assert.equal(exito2.items[3].raw, "SHAMPOO HEAD / SHOULDERS 375ML 18.900 A");
assert.equal(exito2.items[6].lowConfidence, true); // "Otros" y nombre corto
assert.equal(exito2.items[0].lowConfidence, false);

const d1b = parseReceipt(`TIENDAS D1
JABON PROTEX AVENA
3X110G 9.900
2 X DET ARIEL 1KG 15.800
GASEOS COLOMBIANA 1.5L 4.100
TOTAL 29.800`);
printItems("D1", d1b);
assert.deepEqual(d1b.items.map((i) => [i.name, i.quantity, i.category]), [
  ["Jabon protex avena 3X110G", 1, "Cuidado personal"],
  ["Det ariel 1KG", 2, "Aseo del hogar"],
  ["Gaseos colombiana 1.5L", 1, "Bebidas"],
]);

const ara2 = parseReceipt(`TIENDAS ARA JERONIMO MARTINS COLOMBIA S.A.S.
1 7702310040123 JABON PROTEX AVENA 3X110G J 1 UN 12.900 12.900
2 7500435126144 SHAMPOO HEAD SHOULDERS 375ML J 1 UN 18.900 18.900
3 7702026180096 PAP HIG FAMILIA 12 ROLLOS J 1 UN 21.500 21.500
4 7702001114054 AVENA HOJUELAS 400G C 2 UN 3.950 7.900`);
printItems("Ara", ara2);
assert.deepEqual(ara2.items.map((i) => [i.name, i.quantity, i.category]), [
  ["Jabon protex avena 3X110G", 1, "Cuidado personal"],
  ["Shampoo head shoulders 375ML", 1, "Cuidado personal"],
  ["Pap hig familia 12 rollos", 1, "Aseo del hogar"],
  ["Avena hojuelas 400G", 2, "Granos"],
]);

// ---- Foto inclinada: las filas bajan 8 % hacia la derecha (32 px en 400 px) ----
// Sin corregir la pendiente, el precio de la fila 1 (y≈132) quedaría con la fila 2 (y≈130).
const { estimateSlope } = load("utils/ocrLayout");
const tilt = (left, top) => ({ left, top: top + left * 0.08, width: 100, height: 20 });
const tilted = [
  { text: "ARROZ DIANA 1000G", frame: tilt(10, 100) },
  { text: "LECHE ENTERA 1L", frame: tilt(10, 130) },
  { text: "ATUN EN AGUA", frame: tilt(10, 160) },
  { text: "5.900", frame: tilt(400, 100) },
  { text: "4.500", frame: tilt(400, 130) },
  { text: "4.450", frame: tilt(400, 160) },
];
const slope = estimateSlope(tilted);
const tiltedText = linesToText(tilted);
console.log(`Foto inclinada: pendiente estimada ${slope.toFixed(3)} ->\n  ${tiltedText.replace(/\n/g, "\n  ")}`);
assert.ok(Math.abs(slope - 0.08) < 0.02, "pendiente " + slope);
assert.equal(tiltedText, "ARROZ DIANA 1000G  5.900\nLECHE ENTERA 1L  4.500\nATUN EN AGUA  4.450");
// Con esquinas de ML Kit se usa el ángulo de cada línea
const withCorners = tilted.map((l) => ({
  ...l,
  cornerPoints: [
    { x: l.frame.left, y: l.frame.top },
    { x: l.frame.left + 100, y: l.frame.top + 8 },
  ],
}));
assert.ok(Math.abs(estimateSlope(withCorners) - 0.08) < 0.001);
assert.equal(estimateSlope([{ text: "A", frame: f(10, 100) }]), 0); // una sola línea: sin inclinación

// ---- Factura D1 Tunja (formato de columnas N° CAN UM VALOR_U CÓDIGO DESCRIPCIÓN VALOR ID) ----
// RECONSTRUIDA a partir de la foto descrita por el usuario: falta pegar el texto
// real de "Ver texto leído por la cámara" y agregarlo como caso principal.
const D1_TUNJA = `D1 SAS NIT 900.276.962-1
DG 72 2 15 TUNJA
FACTURA ELECTRONICA DE VENTA No. TJ1 123456
Generacion: 2026/11/20 10:41:07
Validacion Dian: 2026/11/20 10:41:09
CLIENTE: CONSUMIDOR FINAL
N° CAN UM VALOR U CODIGO DESCRIPCION VALOR ID
1 1 UN 5.350 7700304448241 TORTILLA FAJI 5.350 A
2 1 UN 4.450 7700304930951 ATUN EN AGUA 4.450 5
3 1 UN 6.450 7700304537648 MORA CONGELAD 6.450 6
4 1 UN 4.750 7700304087143 PAPAS A LA FR 4.750 A
5 1 UN 6.750 7700304587230 ACEITE VEGETA 6.750 A
6 1 UN 2.750 7700304035076 SALSA PARA AD 2.750 A
7 2 UN 3.090 7700304687862 LECHE ENTERA 6.180 6
8 1 UN 2.990 7700304598281 PAN TAJADO BL 2.990 5
TOTAL $ 39.670
FORMA DE PAGO
TARJ CRE/DEB $ 39.670
TARJ: 9999 Recibo: 016301 RRN: 193968
Apro: 522389
CAMBIO $ 0
RESUMEN DE IMPUESTOS
6 = EXCLUIDO
5 = EXENTO
A = 19%
ID. CLIENTE 222222222222
SISTEMA POS D1
FACTURADOR ELECTRONICO D1 SAS
ATENDIDO POR: CAJA 03
NUM ART ENTREGADOS: 9
Resolucion DIAN 18764000000000 de 2025/01/01`;

const EXPECTED_D1 = [
  ["Tortilla fajita", 1, 5350, "7700304448241"],
  ["Atun en agua", 1, 4450, "7700304930951"],
  ["Mora congelada", 1, 6450, "7700304537648"],
  ["Papas a la francesa", 1, 4750, "7700304087143"],
  ["Aceite vegetal", 1, 6750, "7700304587230"],
  ["Salsa para adobar", 1, 2750, "7700304035076"],
  ["Leche entera", 2, 6180, "7700304687862"],
  ["Pan tajado blanco", 1, 2990, "7700304598281"],
];
const NOISY_NAMES = /tunja|tarj|recibo|rrn|apro|aro\b|cambio|excluido|exento|cliente|sistema|facturador|atendido|entregados|resolucion|generacion|validacion|forma de pago/i;

function checkD1(title, receipt) {
  console.log(`${title}: total ${receipt.total} · suma ${receipt.sum} · cuadra ${receipt.totalMatches} · compra ${receipt.purchaseDate && iso(receipt.purchaseDate)} · columnas ${receipt.columnar}`);
  for (const i of receipt.items)
    show(
      i.name,
      `x${i.quantity} · $${i.total} · ${i.category} · ${suggestLocation(i.name, i.category)} · ${emojiForProduct(i.name, i.category)} · EAN ${i.ean ?? "-"}${i.corrected ? " (corregido)" : ""}${i.lowConfidence ? " · ⚠" : ""}`,
    );
  assert.deepEqual(
    receipt.items.map((i) => [i.name, i.quantity, i.total, i.ean]),
    EXPECTED_D1,
    title,
  );
  assert.equal(receipt.sum, 39670);
  assert.equal(receipt.total, 39670);
  assert.equal(receipt.totalMatches, true);
  assert.equal(iso(receipt.purchaseDate), "2026-11-20");
  assert.equal(receipt.items.reduce((a, i) => a + i.quantity, 0), 9); // NUM ART ENTREGADOS: 9
  assert.ok(receipt.items.every((i) => !NOISY_NAMES.test(i.name)), "se coló una línea del pie");
}
const d1t = parseReceipt(D1_TUNJA);
checkD1("D1 Tunja (reconstruida)", d1t);
const where = (n) => {
  const i = d1t.items.find((x) => x.name === n);
  return [i.category, suggestLocation(i.name, i.category), emojiForProduct(i.name, i.category)];
};
assert.deepEqual(where("Tortilla fajita"), ["Panadería", "Alacena", "🫓"]);
assert.deepEqual(where("Atun en agua"), ["Enlatados", "Alacena", "🥫"]);
assert.deepEqual(where("Mora congelada"), ["Congelados", "Congelador", "🍓"]);
assert.deepEqual(where("Papas a la francesa"), ["Congelados", "Congelador", "🍟"]);
assert.deepEqual(where("Aceite vegetal"), ["Condimentos y aceites", "Alacena", "🫒"]);
assert.deepEqual(where("Salsa para adobar"), ["Condimentos y aceites", "Alacena", "🧂"]);
assert.deepEqual(where("Leche entera"), ["Lácteos", "Nevera", "🥛"]);
assert.deepEqual(where("Pan tajado blanco"), ["Panadería", "Alacena", "🍞"]);

// Versión con ruido: EAN con O por 0 e I por 1, una fila partida en dos líneas,
// filas desordenadas con el pie y espacios de más.
const D1_RUIDO = `D1 SAS NIT 900.276.962-1
DG 72 2 15 TUNJA
Generacion: 2026/11/20
N° CAN UM VALOR U CODIGO DESCRIPCION VALOR ID
1 1 UN 5.350 77OO3O4448241 TORTILLA FAJI 5.350 A
TARJ CRE/DEB $ 39.670
2  1 UN  4.450  77003O493O951  ATUN EN AGUA  4.450 5
3 1 UN 6.450 7700304537648 MORA CONGELAD 6.450 6
Apro: 522389
4 1 UN 4.750
7700304087143 PAPAS A LA FR 4.750 A
5 1 UN 6.750 770O3O4587230 ACEITE VEGETA 6.750 A
Aro
6 1 UN 2.750 7700304035076 SALSA PARA AD 2.750 A
7 2 UN 3.090 77003046878G2 LECHE ENTERA 6.180 6
8 1 UN 2.990 77OO3O4598281 PAN TAJADO BL 2.990 5
TARJ: 9999 Recibo: 016301 RRN: 193968
TOTAL $ 39.670`;
const ruido = parseReceipt(D1_RUIDO);
// Mismos 8 ítems, EAN corregidos (O→0, I→1, G→6), fila partida unida y sin ruido.
checkD1("D1 Tunja con ruido", ruido);
assert.equal(ruido.items[0].corrected, true); // 77OO3O4448241 -> 7700304448241
assert.equal(ruido.items[6].ean, "7700304687862"); // 77003046878G2: G -> 6
// Un código ilegible no tumba la fila: se usa la descripción como respaldo.
const sinCodigo = parseReceipt(`N° CAN UM VALOR U CODIGO DESCRIPCION VALOR ID
1 1 UN 5.350 77XX3O4448241 TORTILLA FAJI 5.350 A
2 1 UN 4.450 7700304930951 ATUN EN AGUA 4.450 5`);
assert.deepEqual(sinCodigo.items.map((i) => [i.name, i.ean ?? null]), [
  ["Tortilla fajita", null],
  ["Atun en agua", "7700304930951"],
]);

// Corrección de un dígito del EAN que el OCR confunde (8 leído como 0)
assert.deepEqual(load("utils/receipt").fixEan("7700304448841"), { ean: null, corrected: false });
assert.equal(load("utils/receipt").fixEan("77OO3O4448241").ean, "7700304448241");
assert.equal(load("utils/receipt").parseMoney("$ 39.670"), 39670);

// ---- Nombres completos por código de barras (búsqueda simulada, sin red) ----
const { enrichReceipt } = load("services/receiptLookup");
(async () => {
  const fake = async (ean) => {
    if (ean === "7700304930951") return { nombre: "Atún en agua", marca: "Del Mar", categoria: "Enlatados", tamano: "160 g" };
    if (ean === "7700304537648") throw new Error("Sin conexión a internet");
    const e = new Error("No encontramos este producto");
    e.code = "no_encontrado";
    throw e;
  };
  const progress = [];
  const { receipt: enr, found } = await enrichReceipt(d1t, fake, { onProgress: (d, t) => progress.push(`${d}/${t}`) });
  console.log("Con búsqueda por código (simulada):");
  for (const i of enr.items) show(i.raw.split(" ").slice(4, -2).join(" ") || i.raw, `${i.name} · ${i.category}`);
  assert.equal(found, 1);
  assert.equal(enr.items[1].name, "Atún en agua 160 g · Del Mar"); // de la API
  assert.equal(enr.items[2].name, "Mora congelada"); // sin red: queda la descripción
  assert.equal(enr.items[0].name, "Tortilla fajita"); // no encontrado: queda la descripción
  assert.equal(enr.items.length, 8);
  assert.equal(progress.at(-1), "8/8");
  // Pasado el tiempo máximo, deja de buscar y conserva lo leído
  // Respuestas REALES de Open Food Facts para estos 8 EAN (consultadas el 2026-11-22),
  // con una versión simplificada de mapCategory (la real, de productLookup, necesita
  // SQLite y archivos de Expo y no corre aquí). La mora no está en OFF.
  const { mapCategory } = { mapCategory: (c) => (/flour/i.test(c ?? "") ? "Granos" : /tuna/i.test(c ?? "") ? "Enlatados" : /oil/i.test(c ?? "") ? "Condimentos y aceites" : /salsa/i.test(c ?? "") ? "Condimentos y aceites" : /bread/i.test(c ?? "") ? "Panadería" : "Otros") };
  const OFF_REAL = {
    "7700304448241": ["crachos tortillas de harina", "crachos", "Wheat flours", "12 unidades 360g"],
    "7700304930951": ["Atún En Agua", "Carlo Forte", "Tunas", null],
    "7700304087143": ["Papas A La Francesa", "Toastatas", null, null],
    "7700304587230": ["aceite", "imata", "Olive oils", "900 ml"],
    "7700304035076": ["Salsa Para Adobar Speciaria", "SPECIARIA", "es:Despensa/Salsas y aderezos > Despensa", "110 g"],
    "7700304687862": ["Leche Entera", "Latti", null, null],
    "7700304598281": ["Pan tajado blanco", "Horneaditos", "Breads", "450 g"],
  };
  const realLookup = async (ean) => {
    const p = OFF_REAL[ean];
    if (!p) throw new Error("No encontramos este producto");
    return { nombre: p[0], marca: p[1], categoria: mapCategory(p[2]), tamano: p[3] };
  };
  const real = await enrichReceipt(d1t, realLookup);
  console.log("Con las respuestas reales de Open Food Facts:");
  for (const i of real.receipt.items)
    show(i.raw.split(" ").slice(5, -2).join(" "), `${i.name} · ${i.category} · ${suggestLocation(i.name, i.category)} · ${emojiForProduct(i.name, i.category)}`);
  assert.equal(real.found, 7);
  assert.deepEqual(
    real.receipt.items.map((i) => [i.category, suggestLocation(i.name, i.category), emojiForProduct(i.name, i.category)]),
    [
      ["Panadería", "Alacena", "🫓"], // OFF dice "Wheat flours", las reglas propias ganan
      ["Enlatados", "Alacena", "🥫"],
      ["Congelados", "Congelador", "🍓"], // no está en OFF: queda "Mora congelada"
      ["Congelados", "Congelador", "🍟"],
      ["Condimentos y aceites", "Alacena", "🫒"],
      ["Condimentos y aceites", "Alacena", "🧂"],
      ["Lácteos", "Nevera", "🥛"],
      ["Panadería", "Alacena", "🍞"],
    ],
  );

  const slow = await enrichReceipt(d1t, fake, { deadlineMs: -1 });
  assert.equal(slow.found, 0);
  assert.deepEqual(slow.receipt.items.map((i) => i.name), d1t.items.map((i) => i.name));
  console.log("OCR: fechas y facturas OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
