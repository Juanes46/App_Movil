const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(":memory:");
// Reproduce una instalación previa: cuatro columnas y un producto del usuario.
db.exec(
  "CREATE TABLE productos (id TEXT PRIMARY KEY NOT NULL, nombre TEXT NOT NULL, categoria TEXT NOT NULL, fecha_vencimiento TEXT NOT NULL); INSERT INTO productos VALUES ('anterior', 'Producto anterior', 'Otros', '2027-02-01'); PRAGMA user_version = 1;",
);
const adapter = {
  execAsync: async (sql) => {
    db.exec(sql);
  },
  getAllAsync: async (sql, args = []) => db.prepare(sql).all(...args),
  getFirstAsync: async (sql, args = []) => db.prepare(sql).get(...args),
  runAsync: async (sql, args = []) => db.prepare(sql).run(...args),
  withTransactionAsync: async (fn) => {
    db.exec("BEGIN");
    try {
      await fn();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};
const cache = new Map();
function load(name) {
  const filename = path.resolve("src", name + ".ts");
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  cache.set(filename, mod.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (id) => {
    if (id === "expo-sqlite") return { openDatabaseAsync: async () => adapter };
    if (id === "react")
      return { useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
    if (id.startsWith("@/")) return load(id.slice(2));
    if (id.startsWith("."))
      return load(
        path
          .relative(
            path.resolve("src"),
            path.resolve(path.dirname(filename), id),
          )
          .replaceAll("\\", "/"),
      );
    return require(id);
  };
  vm.runInThisContext("(function(require,module,exports){" + code + "\n})", {
    filename,
  })(localRequire, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const store = load("services/productStore");
  const exp = load("utils/expiration");
  await store.getDb();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.useProducts().length, 1);
  assert.equal(store.useProducts()[0].name, "Producto anterior");
  assert.equal(store.useProducts()[0].quantity, 1);
  const data = {
    name: "Leche de prueba",
    category: "Lácteos",
    expiresOn: exp.fromISODate("2027-01-15"),
    quantity: 3,
    location: "Nevera",
    estimated: false,
  };
  const added = await store.addProduct(data);
  assert.equal(store.getProduct(added.id).quantity, 3);
  await store.updateProduct(added.id, {
    ...data,
    quantity: 4,
    location: "Congelador",
  });
  assert.equal(store.getProduct(added.id).quantity, 4);
  assert.equal(store.getProduct(added.id).location, "Congelador");
  const before = store.useProducts().length;
  await store.addProducts([
    { ...data, name: "Factura A", estimated: true },
    { ...data, name: "Factura B", estimated: true },
  ]);
  assert.equal(store.useProducts().length, before + 2);
  assert.equal(store.useProducts().filter((p) => p.estimated).length, 2);
  const beforeRollback = db
    .prepare("SELECT COUNT(*) AS n FROM productos")
    .get().n;
  await assert.rejects(() =>
    store.addProducts([
      { ...data, name: "Debe revertirse" },
      { ...data, name: null },
    ]),
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM productos").get().n,
    beforeRollback,
  );
  await store.removeProduct(added.id);
  assert.equal(store.getProduct(added.id), undefined);
  const shop = load("services/shoppingStore");
  await new Promise((resolve) => setImmediate(resolve));
  await shop.addShopping([{ name: "Arroz", category: "Granos", quantity: 2 }]);
  assert.equal(shop.useShopping().length, 1);
  await shop.toggleShopping(shop.useShopping()[0]);
  assert.equal(shop.useShopping()[0].done, true);
  assert.equal(db.prepare("SELECT comprado FROM compras").get().comprado, 1);
  const today = new Date(2026, 10, 13);
  assert.equal(exp.getStatus(exp.addDays(today, -1), today), "vencido");
  assert.equal(exp.getStatus(today, today), "proximo");
  assert.equal(exp.getStatus(exp.addDays(today, 7), today), "proximo");
  assert.equal(exp.getStatus(exp.addDays(today, 8), today), "vigente");
  assert.equal(exp.parseDate("31/02/2027"), null);
  assert.equal(
    exp.toISODate(exp.detectExpirationDate("LOTE 2\nVENCE 04/12/2026").date),
    "2026-12-04",
  );
  // Columnas nuevas (unidad, ean) sin perder datos, y cantidad por peso
  const cols = db.prepare("PRAGMA table_info(productos)").all().map((c) => c.name);
  assert.ok(cols.includes("unidad") && cols.includes("ean"));
  assert.ok(store.useProducts().some((p) => p.id === "anterior" && p.unit === "un"));
  await store.addProducts([
    { name: "Banano", category: "Frutas y verduras", expiresOn: new Date(2027, 0, 5), quantity: 0.45, unit: "kg" },
    { name: "Barquillos", category: "Snacks y dulces", expiresOn: new Date(2027, 2, 1), quantity: 1, ean: "7700304111114" },
  ]);
  const banano = store.useProducts().find((p) => p.name === "Banano");
  assert.equal(banano.quantity, 0.45);
  assert.equal(banano.unit, "kg");
  const barq = store.useProducts().find((p) => p.name === "Barquillos");
  assert.equal(barq.ean, "7700304111114");
  // Editar sin unidad ni EAN los conserva (COALESCE)
  await store.updateProduct(banano.id, { name: "Banano criollo", category: "Frutas y verduras", expiresOn: banano.expiresOn, quantity: 0.45 });
  assert.equal(store.useProducts().find((p) => p.id === banano.id).unit, "kg");

  // Nombres aprendidos: guardar, leer por EAN o por "TIENDA|TEXTO", contar y borrar
  const learned = load("services/learnedNames");
  await learned.saveLearned([
    { key: "7700304111114", nombre: "Barquillos de vainilla", categoria: "Snacks y dulces", ubicacion: "Alacena" },
    { key: "D1|GALLETAS DE CH", nombre: "Galletas de chocolate", categoria: "Snacks y dulces" },
  ]);
  const map = await learned.getLearnedFor({
    store: "D1",
    items: [{ ean: "7700304111114", name: "Barquillos" }, { sourceText: "GALLETAS DE CH", name: "Galletas" }],
  });
  assert.equal(map.get("7700304111114").nombre, "Barquillos de vainilla");
  assert.equal(map.get("D1|GALLETAS DE CH").nombre, "Galletas de chocolate");
  assert.equal(await learned.countLearned(), 2);
  await learned.saveLearned([{ key: "7700304111114", nombre: "Barquillos sabor vainilla", categoria: "Snacks y dulces" }]);
  assert.equal(await learned.countLearned(), 2); // actualiza, no duplica
  await learned.clearLearned();
  assert.equal(await learned.countLearned(), 0);
  assert.ok(store.useProducts().some((p) => p.name === "Barquillos")); // borrar lo aprendido no toca la despensa

  console.log(
    "OK: migración sin pérdida, CRUD, cantidad y ubicación, factura atómica y rollback, compras persistentes, vencimientos y lectura de fecha.",
  );
  console.log("OK: columnas unidad y ean, cantidad por peso y nombres aprendidos (guardar, leer, actualizar, borrar).");

  // ================= Lista de compras completa =================
  await shop.clearShopping();
  // Repetido (mismo nombre normalizado) suma cantidades
  await shop.addShopping([{ name: "Leche entera", category: "Lácteos", quantity: 1 }]);
  await shop.addShopping([{ name: "LECHE  ENTERA", category: "Lácteos", quantity: 2 }]);
  console.log(`Compras · repetido: ${JSON.stringify(shop.useShopping().map((i) => [i.name, i.quantity]))}`);
  assert.equal(shop.useShopping().length, 1);
  assert.equal(shop.useShopping()[0].quantity, 3);
  // Editar, eliminar y deshacer
  await shop.updateShopping(shop.useShopping()[0].id, { quantity: 4, category: "Bebidas" });
  assert.deepEqual([shop.useShopping()[0].quantity, shop.useShopping()[0].category], [4, "Bebidas"]);
  const removed = await shop.removeShopping(shop.useShopping()[0].id);
  assert.equal(shop.useShopping().length, 0);
  await shop.restoreShopping(removed);
  assert.equal(shop.useShopping()[0].quantity, 4);
  await shop.clearShopping();

  // Terminar compra: 3 marcados + 2 pendientes
  await shop.addShopping([
    { name: "Arroz diana", category: "Granos", quantity: 1 },
    { name: "Pechuga de pollo", category: "Carnes", quantity: 2 },
    { name: "Yogur natural", category: "Lácteos", quantity: 1 },
    { name: "Café", category: "Bebidas", quantity: 1 },
    { name: "Jabón Protex", category: "Cuidado personal", quantity: 1 },
  ]);
  for (const it of shop.useShopping().slice(0, 3)) await shop.toggleShopping(it);
  const { estimateDays } = load("utils/receipt");
  const { suggestLocation } = load("utils/location");
  const beforeFinish = store.useProducts().length;
  const compra = new Date(2026, 10, 24);
  const bought = shop.useShopping().filter((i) => i.done).map((i) => ({
    id: i.id, name: i.name, category: i.category, quantity: i.quantity,
    expiresOn: exp.addDays(compra, estimateDays(i.name, i.category)),
    location: suggestLocation(i.name, i.category), estimated: true,
  }));
  const n = await shop.finishShopping(bought);
  const nuevos = store.useProducts().filter((p) => bought.some((b) => b.name === p.name));
  console.log(`Terminar compra: ${n} a la despensa → ${nuevos.map((p) => `${p.name} (${p.location}, vence ${exp.formatDate(p.expiresOn)}${p.estimated ? " estimada" : ""})`).join(" · ")} · quedan en la lista: ${shop.useShopping().map((i) => i.name).join(", ")}`);
  assert.equal(n, 3);
  assert.equal(store.useProducts().length, beforeFinish + 3);
  assert.ok(nuevos.every((p) => p.estimated && p.location));
  assert.equal(nuevos.find((p) => p.name === "Pechuga de pollo").location, "Congelador");
  assert.equal(shop.useShopping().length, 2);
  assert.ok(shop.useShopping().every((i) => !i.done));
  // Al guardar una factura se marcan los pendientes que coinciden
  const marcados = await shop.markBoughtByNames(["Cafe sello rojo 250G", "Leche entera"]);
  assert.equal(marcados, 1); // "Café" ⊂ "Cafe sello rojo 250G"
  assert.equal(shop.useShopping().find((i) => i.name === "Café").done, true);
  // Compartir lista (texto agrupado por categoría)
  const { shoppingShareText, pantrySummary } = load("utils/shareText");
  const texto = shoppingShareText([{ name: "Leche", category: "Lácteos", quantity: 2 }, { name: "Pan", category: "Panadería", quantity: 1 }]);
  console.log("Compartir lista:\n  " + texto.replace(/\n/g, "\n  "));
  assert.ok(texto.includes("Lácteos\n• Leche ×2") && texto.includes("Panadería\n• Pan"));
  assert.ok(pantrySummary(store.useProducts()).startsWith("Mi despensa · Despensa Viva ("));
  await shop.clearDone();
  assert.ok(shop.useShopping().every((i) => !i.done));

  // ================= Historial y estadísticas de desperdicio =================
  const hist = load("services/historyStore");
  await store.addProducts([
    { name: "Leche deslactosada", category: "Lácteos", expiresOn: new Date(2026, 11, 1) },
    { name: "Yogur griego", category: "Lácteos", expiresOn: new Date(2026, 11, 1) },
    { name: "Pan blanco", category: "Panadería", expiresOn: new Date(2026, 11, 1) },
  ]);
  const byName = (name) => store.useProducts().find((p) => p.name === name).id;
  await store.removeProductWithReason(byName("Leche deslactosada"), "consumido");
  await store.removeProductWithReason(byName("Yogur griego"), "botado");
  await store.removeProductWithReason(byName("Pan blanco"), "error"); // no cuenta
  const stats = await hist.monthStats();
  console.log(`Estadísticas del mes: ${JSON.stringify(stats)}`);
  assert.deepEqual(stats, { consumidos: 1, botados: 1, aprovechado: 50, topBotados: [["Lácteos", 1]] });
  assert.ok(!store.useProducts().some((p) => p.name === "Pan blanco")); // se eliminó igual

  // ================= Días de anticipación =================
  const settings = load("services/settingsStore");
  const hoy = new Date(2026, 10, 24);
  const en5 = exp.addDays(hoy, 5);
  assert.equal(exp.getStatus(en5, hoy), "proximo"); // 7 por defecto
  await settings.setAjuste("diasAnticipacion", 3);
  console.log(`Anticipación 3 días: vence en 5 días -> ${exp.getStatus(en5, hoy)}`);
  assert.equal(exp.getStatus(en5, hoy), "vigente");
  assert.equal(exp.getStatus(exp.addDays(hoy, 2), hoy), "proximo");

  // ================= Los ajustes persisten al recargar la base =================
  await settings.setAjuste("nombre", "Samuel David Rodríguez Mendoza");
  await settings.setAjuste("ciudad", "Bogotá");
  await settings.setAjuste("alertas", true);
  exp.setSoonDays(7); // simula reiniciar la app
  const recargados = await settings.loadAjustes();
  console.log(`Ajustes recargados: ${JSON.stringify(recargados)} · iniciales ${settings.initials(recargados.nombre)}`);
  assert.equal(recargados.nombre, "Samuel David Rodríguez Mendoza");
  assert.equal(recargados.ciudad, "Bogotá");
  assert.equal(recargados.alertas, true);
  assert.equal(recargados.diasAnticipacion, 3);
  assert.equal(exp.getSoonDays(), 3); // se aplica al cargar
  assert.equal(settings.initials("Samuel David Rodríguez Mendoza"), "SM");

  // ================= Borrar todos los datos =================
  const dataSvc = load("services/dataStore");
  await dataSvc.clearAllData();
  assert.equal(store.useProducts().length, 0);
  assert.equal(shop.useShopping().length, 0);
  assert.equal((await hist.monthStats()).aprovechado, null);
  assert.equal(settings.getAjustes().nombre, "");
  assert.equal(exp.getSoonDays(), 7);
  console.log("OK: compras (repetidos, editar, deshacer, terminar compra, factura), historial, anticipación, ajustes y borrar todo.");
  db.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
