// Prueba buscarPorEAN contra las APIs reales (necesita internet y el .env).
// Usa SQLite en memoria (node:sqlite, Node 22.13+) y simula expo-constants,
// expo-file-system y react-native. No imprime la llave.
//   node scripts/verify-lookup.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const { DatabaseSync } = require("node:sqlite");

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const db = new DatabaseSync(":memory:");
const adapter = {
  execAsync: async (sql) => db.exec(sql),
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

const downloads = [];
const fakeFs = {
  Paths: { document: "file:///docs" },
  Directory: class {
    constructor(...p) {
      this.uri = p.join("/");
    }
    create() {}
  },
  File: class {
    constructor(dir, name) {
      this.uri = dir.uri + "/" + name;
      this.exists = downloads.includes(this.uri);
    }
    static async downloadFileAsync(_url, file) {
      downloads.push(file.uri);
      return file;
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (id) => {
    if (id === "expo-sqlite") return { openDatabaseAsync: async () => adapter };
    if (id === "expo-constants")
      return {
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              losPreciosApiKey: env.LOSPRECIOS_API_KEY,
              losPreciosBaseUrl: env.LOSPRECIOS_BASE_URL,
              offUserAgent: env.OFF_USER_AGENT,
            },
          },
        },
      };
    if (id === "expo-file-system") return fakeFs;
    if (id === "react-native") return { Platform: { OS: "android" } };
    if (id === "react") return { useSyncExternalStore: (_s, snap) => snap() };
    if (id.startsWith("@/")) return load(id.slice(2));
    if (id.startsWith("."))
      return load(
        path
          .relative(path.resolve("src"), path.resolve(path.dirname(filename), id))
          .replaceAll("\\", "/"),
      );
    return require(id);
  };
  vm.runInThisContext("(function(require,module,exports){" + code + "\n})", { filename })(
    localRequire,
    mod,
    mod.exports,
  );
  cache.set(filename, mod.exports);
  return mod.exports;
}

// Cuenta las llamadas reales a internet (y oculta la llave en los registros).
const realFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = (url, init) => {
  calls++;
  return realFetch(url, init);
};
const hide = (s) => s.split(env.LOSPRECIOS_API_KEY).join("***");

(async () => {
  const ean = load("utils/ean");
  assert.equal(ean.isValidEan("7702001114054"), true);
  assert.equal(ean.isValidEan("7702001114055"), false);
  assert.equal(ean.isValidEan("96385074"), true);
  assert.equal(ean.toLosPreciosEan13("96385074").length, 13);
  assert.equal(ean.isValidEan(ean.toLosPreciosEan13("96385074")), true);
  console.log("✓ EAN: dígito de verificación y conversión EAN-8 -> 13");

  const { createRateLimiter } = load("services/rateLimiter");
  const lim = createRateLimiter(1, 300);
  const t0 = Date.now();
  const times = await Promise.all([1, 2, 3].map(() => lim.schedule(async () => Date.now() - t0)));
  assert.ok(times[1] >= 290 && times[2] >= 590, "espera entre llamadas: " + times);
  console.log("✓ Control de ritmo: llamadas a", times.map((t) => t + " ms").join(", "));

  const { buscarPorEAN } = load("services/productLookup");

  const a = await buscarPorEAN("7702001114054");
  console.log("Open Food Facts ->", JSON.stringify(a));
  assert.equal(a.nombre, "Leche Actilife");
  assert.equal(a.categoria, "Lácteos");
  assert.ok(a.imagen.startsWith("file:///docs/imagenes/"));

  calls = 0;
  const again = await buscarPorEAN("7702001114054");
  assert.equal(calls, 0, "la segunda consulta sale de la caché");
  assert.equal(JSON.stringify(again), JSON.stringify(a));
  console.log("✓ Caché: la segunda consulta no usa internet");

  const b = await buscarPorEAN("7702177016862");
  console.log("Los Precios ->", hide(JSON.stringify(b)));
  assert.equal(b.fuente, "Los Precios");
  assert.ok(b.precios.length >= 1);
  assert.equal(b.imagen, null, "no se usa la imagen de Los Precios");

  // 7702004003509 tiene mal el dígito de verificación: se rechaza sin consultar.
  await assert.rejects(buscarPorEAN("7702004003509"), (e) => e.code === "codigo_invalido");
  // Con el dígito correcto (…508) es "Bavaria Club Colombia". Este código es inventado:
  await assert.rejects(buscarPorEAN("2999999999991"), (e) => {
    console.log("No encontrado ->", e.code, "·", e.message);
    return e.code === "no_encontrado";
  });
  await assert.rejects(buscarPorEAN("123"), (e) => e.code === "codigo_invalido");

  globalThis.fetch = async () => {
    throw new TypeError("Network request failed");
  };
  await assert.rejects(buscarPorEAN("7702129001809", { force: true }), (e) => {
    console.log("Sin internet ->", e.code, "·", e.message);
    return e.code === "sin_internet";
  });
  console.log("\nTodas las pruebas de búsqueda pasaron.");
})().catch((e) => {
  console.error(hide(String(e && e.stack ? e.stack : e)));
  process.exit(1);
});
