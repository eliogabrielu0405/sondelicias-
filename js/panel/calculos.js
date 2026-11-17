/* Cálculos del panel. Funciones puras: no tocan la pantalla ni el almacenamiento (se prueban en Node). */

/* El día del negocio va de 4:00 a. m. a 4:00 a. m.: lo vendido después de medianoche cuenta en la noche anterior. */
export const HORA_CORTE = 4;

const dos = (n) => String(n).padStart(2, "0");
export const aClave = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

export function diaNegocio(ms) {
  const d = new Date(ms);
  d.setHours(d.getHours() - HORA_CORTE);
  return aClave(d);
}
export const hoy = (ahora = Date.now()) => diaNegocio(ahora);

/* Fechas como texto "AAAA-MM-DD"; la aritmética se hace en UTC para no depender de la zona horaria */
const aUTC = (dia) => {
  const [y, m, d] = dia.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const deUTC = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
};
export const sumarDias = (dia, n) => deUTC(aUTC(dia) + n * 86400000);
export const diaSemana = (dia) => (new Date(aUTC(dia)).getUTCDay() + 6) % 7; // 0 = lunes
export const inicioSemana = (dia) => sumarDias(dia, -diaSemana(dia));
export const mesDe = (dia) => dia.slice(0, 7);
export const inicioMes = (mes) => `${mes}-01`;
export function finMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  return deUTC(Date.UTC(y, m, 0));
}
export function sumarMeses(mes, n) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}`;
}
export const diasEntre = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / 86400000) + 1;
export function listaDias(desde, hasta) {
  const dias = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const nombreMes = (mes, conAño = true) => {
  const [y, m] = mes.split("-").map(Number);
  const n = MESES[m - 1];
  return conAño ? `${n[0].toUpperCase()}${n.slice(1)} ${y}` : n;
};
export const nombreMesCorto = (mes) => {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
};
export function nombreDia(dia, { conDiaSemana = true } = {}) {
  const [, m, d] = dia.split("-").map(Number);
  const base = `${d} de ${MESES[m - 1]}`;
  return conDiaSemana ? `${DIAS[diaSemana(dia)]} ${base}` : base;
}
export const diaCorto = (dia) => {
  const [, m, d] = dia.split("-").map(Number);
  return `${d}/${m}`;
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const sumar = (lista, f) => lista.reduce((s, x) => s + (Number(f(x)) || 0), 0);

/* ───────── Productos ───────── */
/* Costo de un producto: por receta (insumos) si la tiene; si no, el costo escrito a mano. null = sin costo. */
export function costoProducto(producto, insumosPorId) {
  const receta = producto?.receta || [];
  if (receta.length) {
    let total = 0;
    for (const l of receta) {
      const ins = insumosPorId.get(l.insumoId);
      if (!ins || ins.costo == null) return null;
      total += ins.costo * l.cantidad;
    }
    return Math.round(total * 10000) / 10000;
  }
  return producto?.costo == null ? null : Number(producto.costo);
}
export const margen = (precio, costo) => (precio > 0 && costo != null ? (precio - costo) / precio : null);
export function nivelMargen(m) {
  if (m == null) return { id: "sin", texto: "Sin costo" };
  if (m >= 0.5) return { id: "bien", texto: "Bien" };
  if (m >= 0.3) return { id: "ojo", texto: "Ajustado" };
  return { id: "bajo", texto: "Bajo" };
}

/* ───────── Ventas ───────── */
export const pagado = (v) => r2(sumar(v.pagos || [], (p) => p.usd));
export const saldo = (v) => r2(v.total - pagado(v));
export const cuenta = (v) => v.estado === "confirmada";
export const porCobrar = (ventas) => ventas.filter((v) => cuenta(v) && saldo(v) > 0.004).sort((a, b) => a.confirmada - b.confirmada);

/* Resumen de un periodo (fechas inclusivas, día del negocio). Las ventas cuentan el día en que se confirmaron. */
export function resumen({ ventas, gastos }, desde, hasta) {
  const vs = ventas.filter((v) => cuenta(v) && v.dia >= desde && v.dia <= hasta);
  const gs = gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta);
  let ingresos = 0, costo = 0, ventasSinCosto = 0;
  const productos = new Map();
  const porDia = new Map();
  const porOrigen = { web: 0, caja: 0 };
  for (const v of vs) {
    ingresos += v.total;
    porDia.set(v.dia, (porDia.get(v.dia) || 0) + v.total);
    porOrigen[v.origen === "web" ? "web" : "caja"] += 1;
    for (const it of v.items) {
      const linea = it.cant * it.precio;
      if (it.costo == null) ventasSinCosto += linea;
      else costo += it.cant * it.costo;
      const clave = it.pid || it.nombre;
      const p = productos.get(clave) || { pid: it.pid, nombre: it.nombre, cant: 0, ventas: 0, costo: 0, sinCosto: 0 };
      p.cant += it.cant;
      p.ventas += linea;
      if (it.costo == null) p.sinCosto += it.cant;
      else p.costo += it.cant * it.costo;
      productos.set(clave, p);
    }
  }
  const porCategoria = new Map();
  for (const g of gs) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) || 0) + g.usd);
  const totalGastos = sumar(gs, (g) => g.usd);
  const utilidadBruta = ingresos - costo;
  const utilidadNeta = utilidadBruta - totalGastos;
  return {
    desde, hasta,
    n: vs.length,
    ingresos: r2(ingresos),
    costo: r2(costo),
    ventasSinCosto: r2(ventasSinCosto),
    utilidadBruta: r2(utilidadBruta),
    gastos: r2(totalGastos),
    gastosPorCategoria: [...porCategoria].map(([categoria, usd]) => ({ categoria, usd: r2(usd) })).sort((a, b) => b.usd - a.usd),
    utilidadNeta: r2(utilidadNeta),
    margenBruto: ingresos ? utilidadBruta / ingresos : null,
    margenNeto: ingresos ? utilidadNeta / ingresos : null,
    ticket: vs.length ? r2(ingresos / vs.length) : 0,
    porOrigen,
    porDia,
    productos: [...productos.values()].map((p) => ({ ...p, ventas: r2(p.ventas), costo: r2(p.costo) })).sort((a, b) => b.ventas - a.ventas),
    porCobrar: r2(sumar(vs, (v) => Math.max(0, saldo(v)))),
  };
}

/* Lo cobrado en el periodo, por forma de pago (según el día en que entró el dinero) */
export function cobrosPorCuenta(ventas, desde, hasta) {
  const m = new Map();
  for (const v of ventas) {
    if (v.estado !== "confirmada") continue;
    for (const p of v.pagos || []) {
      if (p.dia < desde || p.dia > hasta) continue;
      const a = m.get(p.cuenta) || { cuenta: p.cuenta, usd: 0, bs: 0, n: 0 };
      a.usd += p.usd;
      a.bs += p.bs || 0;
      a.n += 1;
      m.set(p.cuenta, a);
    }
  }
  return [...m.values()].map((a) => ({ ...a, usd: r2(a.usd), bs: r2(a.bs) })).sort((a, b) => b.usd - a.usd);
}

export function variacion(actual, anterior) {
  const abs = r2(actual - anterior);
  return { abs, pct: anterior ? (actual - anterior) / Math.abs(anterior) : null };
}

/* Periodo anterior comparable: si el periodo está en curso, se compara hasta el mismo punto. */
export function periodoAnterior(tipo, desde, hasta) {
  if (tipo === "dia") return { desde: sumarDias(desde, -1), hasta: sumarDias(hasta, -1) };
  if (tipo === "semana") return { desde: sumarDias(desde, -7), hasta: sumarDias(hasta, -7) };
  const mesAnt = sumarMeses(mesDe(desde), -1);
  const ini = inicioMes(mesAnt);
  const fin = finMes(mesAnt);
  const dias = diasEntre(desde, hasta);
  const alMismoDia = sumarDias(ini, dias - 1);
  return { desde: ini, hasta: alMismoDia < fin ? alMismoDia : fin };
}

/* Tabla de meses (del más reciente al más viejo). El mes en curso va hasta hoy. */
export function comparativaMeses(datos, cantidad, diaHoy) {
  const filas = [];
  let mes = mesDe(diaHoy);
  for (let i = 0; i < cantidad; i++) {
    const hasta = i === 0 ? diaHoy : finMes(mes);
    filas.push({ mes, enCurso: i === 0, ...resumen(datos, inicioMes(mes), hasta) });
    mes = sumarMeses(mes, -1);
  }
  return filas;
}

/* ───────── Dinero ───────── */
/* Saldo de cada cuenta: cobros + aportes − gastos − compras − retiros (± traslados y ajustes).
   Las cuentas en bolívares se suman en Bs; las de dólares en $. */
export function saldosCuentas({ ventas, gastos, invmovs, caja }, cuentas) {
  const saldos = new Map(cuentas.map((c) => [c.id, { ...c, saldo: 0 }]));
  const mover = (cuentaId, usd, bsMonto) => {
    const c = saldos.get(cuentaId);
    if (!c) return;
    c.saldo += c.moneda === "VES" ? Number(bsMonto) || 0 : Number(usd) || 0;
  };
  for (const v of ventas) if (v.estado === "confirmada") for (const p of v.pagos || []) mover(p.cuenta, p.usd, p.bs);
  for (const g of gastos) if (g.cuenta) mover(g.cuenta, -g.usd, -(g.bs || 0));
  for (const m of invmovs) if (m.tipo === "compra" && m.cuenta) mover(m.cuenta, -(m.usd || 0), -(m.bs || 0));
  for (const c of caja) mover(c.cuenta, c.usd, c.bs);
  return [...saldos.values()].map((c) => ({ ...c, saldo: r2(c.saldo) }));
}

/* Movimiento de un día por cuenta (para el cierre de caja) */
export function movimientoDelDia(datos, cuentas, dia) {
  const filtrar = (lista, campo) => lista.filter((x) => x[campo] === dia);
  const delDia = {
    ventas: datos.ventas.map((v) => ({ ...v, pagos: (v.pagos || []).filter((p) => p.dia === dia) })),
    gastos: filtrar(datos.gastos, "fecha"),
    invmovs: filtrar(datos.invmovs, "dia"),
    caja: filtrar(datos.caja, "dia"),
  };
  return saldosCuentas(delDia, cuentas);
}

/* ───────── Inventario ───────── */
/* Costo promedio al comprar: mezcla lo que había con lo nuevo */
export function costoPromedio(stockActual, costoActual, cantidad, montoUsd) {
  const unitarioNuevo = montoUsd / cantidad;
  if (!(stockActual > 0) || costoActual == null) return Math.round(unitarioNuevo * 10000) / 10000;
  return Math.round(((stockActual * costoActual + montoUsd) / (stockActual + cantidad)) * 10000) / 10000;
}

/* Lo que una venta descuenta del inventario según las recetas */
export function consumoDeVenta(items, productosPorId) {
  const consumo = new Map();
  for (const it of items) {
    const receta = productosPorId.get(it.pid)?.receta || [];
    for (const l of receta) consumo.set(l.insumoId, (consumo.get(l.insumoId) || 0) + l.cantidad * it.cant);
  }
  return consumo;
}
