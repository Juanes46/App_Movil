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
assert.equal(r.items[5].category, "Otros");

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
  ["Noel navidad", 1, "Panadería"],
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
assert.equal(estimateDays("DETERG LIQ", "Otros"), 365);
assert.ok(r4.items.every((i) => i.days > 0));
assert.equal(r4.items.find((i) => i.name === "Donut fresa 53").days, 3);

// Condimentos y aseo no son verduras ni se vencen pronto
assert.equal(guessCategory("CONDIMENTO AJO"), "Otros");
assert.equal(estimateDays("CONDIMENTO AJO", "Otros"), 365);
assert.equal(guessCategory("CR COLGATE MENT"), "Otros");
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

console.log("OCR: fechas y facturas OK");
