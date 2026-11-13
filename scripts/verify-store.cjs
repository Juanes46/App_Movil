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
  console.log(
    "OK: migración sin pérdida, CRUD, cantidad y ubicación, factura atómica y rollback, compras persistentes, vencimientos y lectura de fecha.",
  );
  db.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
