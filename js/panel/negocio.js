/* Operaciones del negocio: pedidos, ventas, cobros, inventario, gastos y dinero. */
import { CATEGORIAS, PRODUCTOS, VERSION_MENU } from "../../menu.js";
import { estado, guardar, guardarJuntos, config, ponerConfig, nuevoId } from "./datos.js";
import * as C from "./calculos.js";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const CUENTAS_INICIALES = [
  { id: "efectivo-usd", nombre: "Efectivo $", moneda: "USD", activa: true },
  { id: "efectivo-bs", nombre: "Efectivo Bs", moneda: "VES", activa: true },
  { id: "pago-movil", nombre: "Pago Móvil", moneda: "VES", activa: true },
  { id: "punto", nombre: "Punto de venta", moneda: "VES", activa: true },
  { id: "zelle", nombre: "Zelle", moneda: "USD", activa: true },
];
export const CATEGORIAS_GASTO = [
  "Sueldos y pagos al personal", "Alquiler", "Luz, agua, gas e internet", "Delivery y transporte",
  "Empaques y desechables", "Mantenimiento y reparaciones", "Publicidad", "Impuestos y permisos",
  "Comisiones bancarias", "Otros",
];

export const cuentas = () => config("cuentas", CUENTAS_INICIALES);
export const cuentasActivas = () => cuentas().filter((c) => c.activa !== false);
export const cuentaPorId = (id) => cuentas().find((c) => c.id === id);
export const nombreCuenta = (id) => cuentaPorId(id)?.nombre || id || "Sin cuenta";

/* Tasa del día (Bs por 1 $). Si no es de hoy, igual se usa pero se avisa. */
export function tasa() {
  const t = config("tasa");
  return t?.valor > 0 ? { valor: t.valor, deHoy: t.dia === C.hoy(), dia: t.dia } : null;
}
export const ponerTasa = (valor) => ponerConfig("tasa", { valor: r2(valor), dia: C.hoy(), actualizado: Date.now() });

/* Convierte un monto escrito en la moneda de la cuenta a {usd, bs} */
export function aMontos(cuentaId, monto) {
  const c = cuentaPorId(cuentaId);
  const t = tasa()?.valor;
  if (c?.moneda === "VES") {
    if (!t) throw new Error("No hay tasa: pon la tasa del día para registrar montos en bolívares.");
    return { usd: r2(monto / t), bs: r2(monto), tasa: t };
  }
  return { usd: r2(monto), bs: t ? r2(monto * t) : 0, tasa: t || null };
}

/* ───────── Catálogo: se copia del menú de la página la primera vez y se pone al día cuando cambia ───────── */
export async function sembrarCatalogo() {
  const version = config("versionMenu", 0);
  if (estado.productos.length && version >= VERSION_MENU) return;
  const cambios = [];
  const porId = new Map(estado.productos.map((p) => [p.id, p]));
  CATEGORIAS.forEach((c, i) => {
    if (!estado.categorias.some((x) => x.id === c.id)) cambios.push(["categorias", { id: c.id, nombre: c.nombre, emoji: c.emoji, orden: i }]);
  });
  PRODUCTOS.forEach((p, i) => {
    const local = porId.get(p.id);
    if (!local) {
      cambios.push(["productos", {
        id: p.id, cat: p.cat, nombre: p.nombre, desc: p.desc || "", precio: p.precio, opciones: p.opciones || [],
        foto: p.foto || "", disponible: true, costo: null, receta: [], precioPagina: p.precio, orden: i, deLaPagina: true,
      }]);
    } else if (local.deLaPagina) {
      const sigue = { ...local, precioPagina: p.precio };
      if (local.precio === local.precioPagina) sigue.precio = p.precio; // el local no lo había cambiado
      if (!local.editado) Object.assign(sigue, { nombre: p.nombre, desc: p.desc || "", opciones: p.opciones || [], foto: p.foto || "", cat: p.cat });
      cambios.push(["productos", sigue]);
    }
  });
  cambios.push(["config", { clave: "versionMenu", valor: VERSION_MENU }]);
  await guardarJuntos(cambios);
}

export const productosOrdenados = () => {
  const ordenCat = new Map(estado.categorias.map((c) => [c.id, c.orden ?? 99]));
  return [...estado.productos].sort((a, b) => (ordenCat.get(a.cat) ?? 99) - (ordenCat.get(b.cat) ?? 99) || (a.orden ?? 999) - (b.orden ?? 999));
};
export const categoriasOrdenadas = () => [...estado.categorias].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
export const insumosPorId = () => new Map(estado.insumos.map((i) => [i.id, i]));
export const productosPorId = () => new Map(estado.productos.map((p) => [p.id, p]));
export const costoDe = (producto) => C.costoProducto(producto, insumosPorId());

/* Productos cuyo precio en el panel ya no es el de la página */
export const preciosDistintos = () => estado.productos.filter((p) => p.deLaPagina && p.precioPagina != null && r2(p.precio) !== r2(p.precioPagina));

export function guardarProducto(p) {
  return guardar("productos", { ...p, precio: r2(p.precio), costo: p.costo == null ? null : Number(p.costo) });
}

/* ───────── Ventas y pedidos ───────── */
function siguienteNumero() {
  const n = config("contador", 0) + 1;
  return n;
}

function lineaDesde(pid, cant, opcion) {
  const local = estado.productos.find((p) => p.id === pid);
  const pagina = PRODUCTOS.find((p) => p.id === pid);
  const base = local || pagina;
  return {
    pid,
    nombre: base?.nombre || `Producto ${pid}`,
    opcion: opcion || "",
    cant,
    precio: r2(base?.precio ?? 0),
    costo: null,
    desconocido: !local || undefined, // no está en el panel (borrado o nuevo en la página)
  };
}
export const totalDe = (items) => r2(items.reduce((s, it) => s + it.cant * it.precio, 0));

/* Pedido que llega desde el enlace de WhatsApp. Usa los precios del panel, no los que trae el enlace. */
export async function importarPedido(datos) {
  const repetido = estado.ventas.find((v) => v.origen === "web" && datos.codigo && v.codigo === datos.codigo && v.cliente === datos.cliente);
  if (repetido) return { venta: repetido, repetido: true };
  const items = datos.items.map((it) => lineaDesde(it.id, it.cant, it.opcion));
  const num = siguienteNumero();
  const venta = {
    id: nuevoId("v"), num, creado: Date.now(), origen: "web", estado: "pendiente", fase: null,
    codigo: datos.codigo, cliente: datos.cliente, tipo: datos.tipo, direccion: datos.direccion, nota: datos.nota,
    items, total: totalDe(items), totalVisto: datos.totalVisto, enviado: datos.enviado, pagos: [],
  };
  await guardarJuntos([["ventas", venta], ["config", { clave: "contador", valor: num }]]);
  return { venta, repetido: false };
}

/* Avisos de un pedido: productos agotados, desconocidos o precio distinto al que vio el cliente */
export function avisosPedido(venta) {
  const porId = productosPorId();
  const avisos = [];
  const agotados = venta.items.filter((it) => porId.get(it.pid)?.disponible === false).map((it) => it.nombre);
  if (agotados.length) avisos.push(`Agotado: ${agotados.join(", ")}`);
  const raros = venta.items.filter((it) => it.desconocido).map((it) => it.nombre);
  if (raros.length) avisos.push(`No está en el panel: ${raros.join(", ")}`);
  if (venta.totalVisto != null && Math.abs(venta.totalVisto - venta.total) > 0.004) {
    avisos.push(`El cliente vio un total de $${String(venta.totalVisto.toFixed(2)).replace(".", ",")}; con los precios del panel es $${String(venta.total.toFixed(2)).replace(".", ",")}`);
  }
  return avisos;
}

/* Prepara todo lo que cambia al confirmar una venta: costo del momento e inventario */
function cambiosAlConfirmar(venta, fase) {
  const porId = productosPorId();
  const insumos = insumosPorId();
  const ahora = Date.now();
  const dia = C.hoy(ahora);
  const items = venta.items.map((it) => {
    const p = porId.get(it.pid);
    return { ...it, costo: p ? C.costoProducto(p, insumos) : null };
  });
  const confirmada = { ...venta, items, estado: "confirmada", confirmada: ahora, dia, tasa: tasa()?.valor ?? null, fase };
  const cambios = [["ventas", confirmada]];
  for (const [insumoId, cantidad] of C.consumoDeVenta(items, porId)) {
    const ins = insumos.get(insumoId);
    if (!ins) continue;
    cambios.push(["insumos", { ...ins, stock: Math.round((ins.stock - cantidad) * 1000) / 1000 }]);
    cambios.push(["invmovs", { id: nuevoId("m"), creado: ahora, dia, insumoId, tipo: "venta", cambio: -cantidad, ventaId: venta.id, nota: `Venta #${venta.num}` }]);
  }
  return { confirmada, cambios };
}

export async function confirmarPedido(venta, { fase = "cocina", pagos = [] } = {}) {
  const actual = estado.ventas.find((v) => v.id === venta.id) || venta;
  if (actual.estado !== "pendiente") throw new Error(`No se puede: ese pedido ya está ${actual.estado}.`);
  const { confirmada, cambios } = cambiosAlConfirmar(actual, fase);
  confirmada.pagos = armarPagos(pagos, confirmada.total);
  await guardarJuntos(cambios);
  return confirmada;
}

/* Venta de mostrador: se crea y se confirma de una vez */
export async function venderEnCaja({ items, cliente, tipo, nota, pagos, cocina }) {
  if (!items.length) throw new Error("No hay productos en la venta.");
  const num = siguienteNumero();
  const borrador = {
    id: nuevoId("v"), num, creado: Date.now(), origen: "caja", estado: "pendiente", fase: null,
    cliente: (cliente || "").trim() || "Mostrador", tipo: tipo || "Para llevar", direccion: "", nota: nota || "",
    items: items.map((it) => ({ ...it, costo: null })), total: totalDe(items), pagos: [],
  };
  const { confirmada, cambios } = cambiosAlConfirmar(borrador, cocina ? "cocina" : "entregada");
  confirmada.pagos = armarPagos(pagos, confirmada.total);
  cambios.push(["config", { clave: "contador", valor: num }]);
  await guardarJuntos(cambios);
  return confirmada;
}

/* pagos = [{cuenta, monto}] en la moneda de cada cuenta */
function armarPagos(pagos, tope) {
  const ahora = Date.now();
  const dia = C.hoy(ahora);
  const lista = pagos.filter((p) => p.monto > 0).map((p) => ({ id: nuevoId("p"), cuenta: p.cuenta, ...aMontos(p.cuenta, p.monto), creado: ahora, dia }));
  const suma = lista.reduce((s, p) => s + p.usd, 0);
  if (suma - tope > 0.02) throw new Error("No se puede cobrar más del total de la venta.");
  // Si lo cobrado queda a centavos del total por redondeo de la tasa, se ajusta para que no quede deuda falsa
  if (lista.length && Math.abs(suma - tope) <= 0.02) lista[lista.length - 1].usd = r2(lista[lista.length - 1].usd + (tope - suma));
  return lista;
}

export async function registrarCobro(venta, pagos) {
  const actual = estado.ventas.find((v) => v.id === venta.id);
  if (!actual || actual.estado !== "confirmada") throw new Error("No se puede cobrar: esa venta no está confirmada.");
  const nuevos = armarPagos(pagos, C.saldo(actual));
  await guardar("ventas", { ...actual, pagos: [...(actual.pagos || []), ...nuevos] });
}

export async function cancelarPedido(venta) {
  const actual = estado.ventas.find((v) => v.id === venta.id);
  if (actual?.estado !== "pendiente") throw new Error("No se puede: solo se cancelan pedidos que no se han confirmado.");
  await guardar("ventas", { ...actual, estado: "cancelada", cancelada: Date.now() });
}

export async function cambiarFase(venta, fase) {
  const actual = estado.ventas.find((v) => v.id === venta.id);
  await guardar("ventas", { ...actual, fase });
}

/* Anular una venta confirmada: deja de contar como venta, sus cobros salen de las cuentas y el inventario vuelve */
export async function anularVenta(venta, motivo) {
  const actual = estado.ventas.find((v) => v.id === venta.id);
  if (actual?.estado !== "confirmada") throw new Error("No se puede: solo se anulan ventas confirmadas.");
  const ahora = Date.now();
  const dia = C.hoy(ahora);
  const cambios = [["ventas", { ...actual, estado: "anulada", fase: null, anulada: { en: ahora, motivo: (motivo || "").trim() } }]];
  // Copias: si algo falla al guardar, lo que hay en memoria no cambia
  const insumos = new Map(estado.insumos.map((i) => [i.id, { ...i }]));
  const tocados = new Set();
  for (const m of estado.invmovs.filter((x) => x.ventaId === actual.id && x.tipo === "venta")) {
    const ins = insumos.get(m.insumoId);
    if (!ins) continue;
    ins.stock = Math.round((ins.stock - m.cambio) * 1000) / 1000;
    tocados.add(ins);
    cambios.push(["invmovs", { id: nuevoId("m"), creado: ahora, dia, insumoId: m.insumoId, tipo: "anulacion", cambio: -m.cambio, ventaId: actual.id, nota: `Anulada #${actual.num}` }]);
  }
  for (const ins of tocados) cambios.push(["insumos", ins]);
  await guardarJuntos(cambios);
}

/* ───────── Gastos ───────── */
export async function guardarGasto({ id, fecha, categoria, concepto, cuenta, monto }) {
  if (!(monto > 0)) throw new Error("No se puede guardar: el monto debe ser mayor que cero.");
  const montos = cuenta ? aMontos(cuenta, monto) : { usd: r2(monto), bs: 0, tasa: tasa()?.valor ?? null };
  await guardar("gastos", { id: id || nuevoId("g"), creado: Date.now(), fecha, categoria, concepto: (concepto || "").trim(), cuenta: cuenta || null, ...montos });
}

/* ───────── Inventario ───────── */
export async function guardarInsumo(ins) {
  await guardar("insumos", { id: ins.id || nuevoId("i"), creado: ins.creado || Date.now(), nombre: ins.nombre.trim(), unidad: ins.unidad || "unidades", stock: Number(ins.stock) || 0, minimo: Number(ins.minimo) || 0, costo: ins.costo == null ? null : Number(ins.costo) });
}

export async function moverInsumo(ins, { tipo, cantidad, monto, cuenta, nota }) {
  const actual = estado.insumos.find((x) => x.id === ins.id);
  if (!actual) throw new Error("No se encontró ese insumo.");
  const ahora = Date.now();
  const dia = C.hoy(ahora);
  let cambio = 0;
  const siguiente = { ...actual };
  const mov = { id: nuevoId("m"), creado: ahora, dia, insumoId: actual.id, tipo, nota: (nota || "").trim() };
  if (tipo === "compra") {
    if (!(cantidad > 0)) throw new Error("No se puede: la cantidad comprada debe ser mayor que cero.");
    cambio = cantidad;
    if (monto > 0) {
      const montos = cuenta ? aMontos(cuenta, monto) : { usd: r2(monto), bs: 0 };
      Object.assign(mov, { usd: montos.usd, bs: montos.bs, cuenta: cuenta || null });
      siguiente.costo = C.costoPromedio(actual.stock, actual.costo, cantidad, montos.usd);
    }
  } else if (tipo === "merma") {
    if (!(cantidad > 0)) throw new Error("No se puede: la cantidad debe ser mayor que cero.");
    cambio = -cantidad;
  } else if (tipo === "conteo") {
    if (!(cantidad >= 0)) throw new Error("No se puede: el conteo no puede ser negativo.");
    cambio = cantidad - actual.stock;
  }
  siguiente.stock = Math.round((actual.stock + cambio) * 1000) / 1000;
  mov.cambio = cambio;
  await guardarJuntos([["insumos", siguiente], ["invmovs", mov]]);
}

/* ───────── Dinero ───────── */
export async function movimientoCaja({ tipo, cuenta, monto, cuentaDestino, montoDestino, nota }) {
  const ahora = Date.now();
  const dia = C.hoy(ahora);
  const base = { creado: ahora, dia, tipo, nota: (nota || "").trim() };
  const mov = (c, m) => ({ ...base, id: nuevoId("c"), cuenta: c, ...aMontos(c, m) });
  if (!(Math.abs(monto) > 0)) throw new Error("No se puede guardar: el monto no puede ser cero.");
  if (tipo === "transferencia") {
    if (!cuentaDestino || cuentaDestino === cuenta) throw new Error("No se puede: elige dos cuentas distintas.");
    const salida = mov(cuenta, -Math.abs(monto));
    const entrada = mov(cuentaDestino, Math.abs(montoDestino ?? monto));
    await guardarJuntos([["caja", salida], ["caja", entrada]]);
    return;
  }
  const signo = tipo === "retiro" ? -1 : tipo === "ajuste" ? Math.sign(monto) : 1;
  await guardar("caja", mov(cuenta, signo * Math.abs(monto)));
}

export async function guardarCierre({ fecha, filas, nota, ajustar }) {
  const ahora = Date.now();
  const cambios = [["cierres", { fecha, filas, nota: (nota || "").trim(), creado: ahora }]];
  if (ajustar) {
    for (const f of filas) {
      const dif = r2(f.contado - f.esperado);
      if (f.contado == null || Math.abs(dif) < 0.005) continue;
      cambios.push(["caja", { id: nuevoId("c"), creado: ahora, dia: fecha, tipo: "ajuste", cuenta: f.cuenta, nota: `Cierre del ${fecha}`, ...aMontos(f.cuenta, dif) }]);
    }
  }
  await guardarJuntos(cambios);
}
