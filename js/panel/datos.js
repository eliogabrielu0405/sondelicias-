/* Todo se guarda en este teléfono (IndexedDB del navegador). No hay servidor ni base de datos en internet. */
import { enMarco } from "../comun.js";

const NOMBRE = "son-dlicias";
const VERSION = 1;
const LLAVES = { config: "clave", productos: "id", categorias: "id", ventas: "id", gastos: "id", insumos: "id", invmovs: "id", caja: "id", cierres: "fecha" };
export const ALMACENES = Object.keys(LLAVES);

export const estado = Object.fromEntries(ALMACENES.map((a) => [a, a === "config" ? {} : []]));

let bd = null;
/* En una vista previa (marco) sin almacenamiento, el panel igual funciona, pero solo en memoria */
let memoria = false;
export const soloEnMemoria = () => memoria;
const canal = "BroadcastChannel" in window ? new BroadcastChannel("son-dlicias-panel") : null;

const copiar = (obj) => JSON.parse(JSON.stringify(obj)); // los datos son JSON simples
const promesa = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });

function abrirBD() {
  return new Promise((ok, mal) => {
    if (!("indexedDB" in window)) return mal(new Error("Este navegador no permite guardar datos."));
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [almacen, llave] of Object.entries(LLAVES)) {
        if (!db.objectStoreNames.contains(almacen)) db.createObjectStore(almacen, { keyPath: llave });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
    req.onblocked = () => mal(new Error("Cierra las otras pestañas del panel y vuelve a abrirlo."));
  });
}

export async function cargar() {
  if (!bd && !memoria) {
    try { bd = await abrirBD(); } catch (e) { if (!enMarco) throw e; memoria = true; }
  }
  if (memoria) return;
  const tx = bd.transaction(ALMACENES, "readonly");
  const resultados = await Promise.all(ALMACENES.map((a) => promesa(tx.objectStore(a).getAll())));
  ALMACENES.forEach((a, i) => {
    estado[a] = a === "config" ? Object.fromEntries(resultados[i].map((r) => [r.clave, r.valor])) : resultados[i];
  });
}

const llaveDe = (almacen, obj) => obj[LLAVES[almacen]];

function aplicarEnMemoria(almacen, obj, borrar = false) {
  if (almacen === "config") {
    if (borrar) delete estado.config[obj.clave];
    else estado.config[obj.clave] = obj.valor;
    return;
  }
  const lista = estado[almacen];
  const llave = llaveDe(almacen, obj);
  const i = lista.findIndex((x) => llaveDe(almacen, x) === llave);
  if (borrar) { if (i >= 0) lista.splice(i, 1); }
  else if (i >= 0) lista[i] = obj;
  else lista.push(obj);
}

/* Guarda varios cambios juntos: o se guardan todos o ninguno.
   cambios = [["ventas", objeto], ["insumos", objeto], ["gastos", {id}, "borrar"], ...] */
export function guardarJuntos(cambios) {
  if (memoria) {
    for (const [almacen, obj, accion] of cambios) aplicarEnMemoria(almacen, copiar(obj), accion === "borrar");
    return Promise.resolve();
  }
  const almacenes = [...new Set(cambios.map(([a]) => a))];
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacenes, "readwrite");
    for (const [almacen, obj, accion] of cambios) {
      const st = tx.objectStore(almacen);
      if (accion === "borrar") st.delete(llaveDe(almacen, obj));
      else st.put(copiar(obj));
    }
    tx.oncomplete = () => {
      for (const [almacen, obj, accion] of cambios) aplicarEnMemoria(almacen, copiar(obj), accion === "borrar");
      canal?.postMessage("cambio");
      ok();
    };
    tx.onerror = () => mal(tx.error || new Error("No se pudo guardar"));
    tx.onabort = () => mal(tx.error || new Error("No se pudo guardar. Revisa el espacio libre del teléfono."));
  });
}

export const guardar = (almacen, obj) => guardarJuntos([[almacen, obj]]);
export const borrar = (almacen, obj) => guardarJuntos([[almacen, obj, "borrar"]]);
export const config = (clave, porDefecto) => (clave in estado.config ? estado.config[clave] : porDefecto);
export const ponerConfig = (clave, valor) => guardar("config", { clave, valor });

/* Otra pestaña del panel cambió algo: recargar */
export function alCambiarEnOtraPestana(fn) {
  canal?.addEventListener("message", async () => { await cargar(); fn(); });
}

export function nuevoId(prefijo) {
  const azar = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${prefijo}${Date.now().toString(36)}${azar.slice(0, 4)}`;
}

/* Pide al navegador que no borre estos datos cuando el teléfono se quede sin espacio */
export async function protegerAlmacenamiento() {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return Boolean(await navigator.storage?.persist?.());
  } catch {
    return false;
  }
}

/* ───────── Copias de seguridad ───────── */
export function copiaCompleta() {
  const datos = {};
  for (const a of ALMACENES) {
    datos[a] = a === "config"
      ? Object.entries(estado.config).filter(([clave]) => clave !== "clave" && clave !== "recuperacion").map(([clave, valor]) => ({ clave, valor }))
      : estado[a];
  }
  return { app: "son-dlicias-panel", version: 1, creada: new Date().toISOString(), datos };
}

export async function restaurarCopia(copia) {
  if (!copia || copia.app !== "son-dlicias-panel" || typeof copia.datos !== "object") {
    throw new Error("Ese archivo no es una copia de este panel.");
  }
  if (memoria) {
    for (const a of ALMACENES) {
      if (a === "config") {
        const conservar = { clave: estado.config.clave, recuperacion: estado.config.recuperacion };
        estado.config = Object.fromEntries((copia.datos.config || []).filter((r) => r && r.clave !== "clave" && r.clave !== "recuperacion").map((r) => [r.clave, r.valor]));
        Object.assign(estado.config, conservar);
      } else estado[a] = Array.isArray(copia.datos[a]) ? copia.datos[a] : [];
    }
    return;
  }
  const conservar = ["clave", "recuperacion"].map((c) => ({ clave: c, valor: estado.config[c] })).filter((r) => r.valor);
  await new Promise((ok, mal) => {
    const tx = bd.transaction(ALMACENES, "readwrite");
    for (const a of ALMACENES) {
      const st = tx.objectStore(a);
      st.clear();
      const filas = Array.isArray(copia.datos[a]) ? copia.datos[a] : [];
      for (const fila of filas) {
        if (fila && typeof fila === "object" && llaveDe(a, fila) != null && !(a === "config" && (fila.clave === "clave" || fila.clave === "recuperacion"))) st.put(fila);
      }
      if (a === "config") for (const r of conservar) st.put(r);
    }
    tx.oncomplete = ok;
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error || new Error("No se pudo restaurar la copia."));
  });
  await cargar();
  canal?.postMessage("cambio");
}
