/* Finanzas: reportes por día, semana y mes; comparación de meses; estado de resultados; márgenes por producto. */
import { poner, reemplazar } from "../comun.js";
import { usd, bs, pct, numero, enMarco } from "../comun.js";
import { NEGOCIO } from "../../menu.js";
import { h, icono, segmento, kpi, tituloSeccion, avisar } from "./ui.js";
import { estado } from "./datos.js";
import { nombreCuenta, cuentaPorId, costoDe, productosOrdenados } from "./negocio.js";
import * as C from "./calculos.js";

let subvista = "reportes";
let periodo = { tipo: "dia", ancla: null };
let mesResultados = null;
let cantidadMeses = 6;

export function pintar(vista, app, opciones = {}) {
  if (opciones.subvista) subvista = opciones.subvista;
  poner(vista, 
    tituloSeccion("Finanzas"),
    segmento([["reportes", "Reportes"], ["meses", "Meses"], ["resultados", "Resultados"], ["margenes", "Márgenes"]], subvista, (id) => { subvista = id; app.refrescar(); }, "Qué ver"),
  );
  const cuerpo = h("div", { style: { marginTop: "14px" } });
  poner(vista, cuerpo);
  ({ reportes: pintarReportes, meses: pintarMeses, resultados: pintarResultados, margenes: pintarMargenes }[subvista] || pintarReportes)(cuerpo, app);
}

/* ───────── Piezas ───────── */
function cambio(actual, anterior, { invertir = false } = {}) {
  const v = C.variacion(actual, anterior);
  if (v.pct == null) return `${usd(anterior)}`;
  const sube = v.pct >= 0;
  const bueno = invertir ? !sube : sube;
  return h("span", { class: Math.abs(v.pct) < 0.005 ? "" : bueno ? "sube" : "baja" }, `${sube ? "▲" : "▼"} ${pct(Math.abs(v.pct))}`);
}
const textoCambio = (actual, anterior) => {
  const v = C.variacion(actual, anterior);
  return v.pct == null ? "—" : `${v.pct >= 0 ? "+" : "−"}${pct(Math.abs(v.pct))}`;
};

function escalaBonita(max) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * p) return m * p;
  return 10 * p;
}

/* Barras de una sola serie: el título dice qué es; tocar una barra muestra su valor; abajo, la tabla */
function graficaBarras({ titulo, puntos, formato = usd }) {
  const W = Math.max(280, Math.min(window.innerWidth - 56, 900));
  const H = 170;
  const base = H - 24;
  const techo = escalaBonita(Math.max(...puntos.map((p) => p.valor), 0));
  const paso = W / Math.max(1, puntos.length);
  const ancho = Math.max(3, Math.min(30, paso - 2));
  const cada = puntos.length <= 8 ? 1 : puntos.length <= 16 ? 2 : puntos.length <= 24 ? 3 : 5;
  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, texto) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (texto != null) n.textContent = texto;
    return n;
  };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${titulo}. Valor más alto: ${formato(Math.max(...puntos.map((p) => p.valor), 0))}` });
  const etiquetasEje = [];
  for (const f of [0.5, 1]) {
    const y = base - (base - 16) * f;
    poner(svg, el("line", { class: "rejilla", x1: 0, x2: W, y1: y, y2: y }));
    etiquetasEje.push(el("text", { class: "eje", x: 0, y: y - 4 }, formato(techo * f).replace(",00", "")));
  }
  poner(svg, el("line", { x1: 0, x2: W, y1: base, y2: base, stroke: "#000", "stroke-width": 1.5 }));
  const barras = puntos.map((p, i) => {
    const alto = techo ? ((base - 16) * p.valor) / techo : 0;
    const x = i * paso + (paso - ancho) / 2;
    const r = Math.min(4, ancho / 2, alto);
    const y = base - alto;
    const d = alto > 0
      ? `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${base} Z`
      : "";
    const barra = el("path", { class: "barra", d });
    poner(svg, barra);
    if (i % cada === 0 || i === puntos.length - 1) poner(svg, el("text", { class: "eje", x: x + ancho / 2, y: H - 6, "text-anchor": "middle" }, p.corta));
    return barra;
  });
  poner(svg, etiquetasEje); // encima de las barras para que no las tapen
  const detalle = h("p", { class: "detalle num", "aria-live": "polite" }, "Toca una barra para ver el monto.");
  const elegir = (evento) => {
    const caja = svg.getBoundingClientRect();
    const i = Math.min(puntos.length - 1, Math.max(0, Math.floor(((evento.clientX - caja.left) / caja.width) * puntos.length)));
    barras.forEach((b, j) => b.classList.toggle("activa", j === i));
    detalle.textContent = `${puntos[i].etiqueta}: ${formato(puntos[i].valor)}`;
  };
  svg.addEventListener("pointerdown", elegir);
  svg.addEventListener("pointermove", (e) => e.pointerType === "mouse" && elegir(e));
  return h("div", { class: "grafica caja" }, h("h3", null, titulo), svg, detalle,
    h("details", null, h("summary", null, "Ver en tabla"),
      h("table", { class: "tabla" }, h("tbody", null, puntos.map((p) => h("tr", null, h("td", null, p.etiqueta), h("td", { class: "num" }, formato(p.valor))))))));
}

/* ───────── Reportes por día, semana o mes ───────── */
function rango() {
  const hoy = C.hoy();
  const ancla = periodo.ancla || hoy;
  if (periodo.tipo === "dia") return { desde: ancla, hasta: ancla };
  if (periodo.tipo === "semana") {
    const desde = C.inicioSemana(ancla);
    const fin = C.sumarDias(desde, 6);
    return { desde, hasta: fin < hoy ? fin : hoy, finCompleto: fin };
  }
  const mes = C.mesDe(ancla);
  const fin = C.finMes(mes);
  return { desde: C.inicioMes(mes), hasta: fin < hoy ? fin : hoy, finCompleto: fin };
}
function etiquetaPeriodo({ desde, hasta, finCompleto }) {
  const hoy = C.hoy();
  if (periodo.tipo === "dia") return desde === hoy ? `Hoy, ${C.nombreDia(desde)}` : desde === C.sumarDias(hoy, -1) ? `Ayer, ${C.nombreDia(desde)}` : C.nombreDia(desde);
  if (periodo.tipo === "semana") return `Semana del ${C.nombreDia(desde, { conDiaSemana: false })} al ${C.nombreDia(finCompleto || hasta, { conDiaSemana: false })}`;
  return C.nombreMes(C.mesDe(desde));
}
function mover(delta) {
  const ancla = periodo.ancla || C.hoy();
  periodo.ancla = periodo.tipo === "dia" ? C.sumarDias(ancla, delta) : periodo.tipo === "semana" ? C.sumarDias(ancla, 7 * delta) : C.inicioMes(C.sumarMeses(C.mesDe(ancla), delta));
}

function pintarReportes(cuerpo, app) {
  const r = rango();
  const ant = C.periodoAnterior(periodo.tipo, r.desde, r.hasta);
  const actual = C.resumen(estado, r.desde, r.hasta);
  const previo = C.resumen(estado, ant.desde, ant.hasta);
  const hoy = C.hoy();
  const siguienteEmpieza = periodo.tipo === "dia" ? C.sumarDias(r.desde, 1) : C.sumarDias(r.finCompleto || r.hasta, 1);
  const nombreAnterior = { dia: "el día anterior", semana: "la semana anterior al mismo día", mes: "el mes anterior al mismo día" }[periodo.tipo];

  poner(cuerpo, 
    segmento([["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]], periodo.tipo, (id) => { periodo = { tipo: id, ancla: periodo.ancla }; app.refrescar(); }, "Periodo"),
    h("div", { class: "navegar" },
      h("button", { class: "redondo toca", type: "button", "aria-label": "Periodo anterior", onclick: () => { mover(-1); app.refrescar(); } }, icono("flecha_izq", 22)),
      h("b", { "aria-live": "polite" }, etiquetaPeriodo(r)),
      h("button", { class: "redondo toca", type: "button", "aria-label": "Periodo siguiente", disabled: siguienteEmpieza > hoy, onclick: () => { mover(1); app.refrescar(); } }, icono("flecha_der", 22))),
    h("div", { class: "kpis" },
      kpi("Ventas", usd(actual.ingresos), h("span", null, cambio(actual.ingresos, previo.ingresos), previo.ingresos ? ` vs ${nombreAnterior}` : ` ${nombreAnterior}`)),
      kpi("Pedidos y ventas", String(actual.n), `Ticket promedio ${usd(actual.ticket)}`),
      kpi("Utilidad bruta", usd(actual.utilidadBruta), `Margen ${pct(actual.margenBruto)}`),
      kpi("Gastos", usd(actual.gastos), h("span", null, cambio(actual.gastos, previo.gastos, { invertir: true }), previo.gastos ? ` vs ${nombreAnterior}` : ` ${nombreAnterior}`)),
      kpi("Utilidad neta", usd(actual.utilidadNeta), `Margen ${pct(actual.margenNeto)}`, { tono: actual.utilidadNeta < 0 ? "malo" : actual.n ? "bueno" : null }),
      kpi("Por cobrar", usd(actual.porCobrar), "De ventas de este periodo")),
  );
  if (actual.ventasSinCosto > 0) {
    poner(cuerpo, h("div", { class: "aviso-caja", style: { marginTop: "12px" } }, icono("alerta", 20),
      h("div", null, `${usd(actual.ventasSinCosto)} de lo vendido no tiene costo cargado, así que la utilidad sale más alta de lo real.`,
        h("div", null, h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => app.ir("productos") }, "Poner costos")))));
  }

  // Gráfica: por hora en el día; por día en semana y mes
  if (periodo.tipo === "dia") {
    const horas = new Map();
    for (const v of estado.ventas) {
      if (!C.cuenta(v) || v.dia !== r.desde) continue;
      const hr = new Date(v.confirmada).getHours();
      horas.set(hr, (horas.get(hr) || 0) + v.total);
    }
    if (horas.size) {
      const orden = [...horas.keys()].map((x) => (x + 24 - C.HORA_CORTE) % 24);
      const desde = Math.min(...orden), hasta = Math.max(...orden);
      const puntos = [];
      for (let k = desde; k <= hasta; k++) {
        const hr = (k + C.HORA_CORTE) % 24;
        const doce = hr % 12 || 12;
        puntos.push({ etiqueta: `Desde las ${doce}:00 ${hr < 12 ? "a. m." : "p. m."}`, corta: `${doce}${hr < 12 ? "a" : "p"}`, valor: Math.round((horas.get(hr) || 0) * 100) / 100 });
      }
      poner(cuerpo, h("div", { style: { marginTop: "14px" } }, graficaBarras({ titulo: "Ventas por hora", puntos })));
    }
  } else {
    const dias = C.listaDias(r.desde, r.finCompleto || r.hasta);
    const puntos = dias.map((d) => ({ etiqueta: C.nombreDia(d), corta: periodo.tipo === "semana" ? ["lu", "ma", "mi", "ju", "vi", "sá", "do"][C.diaSemana(d)] : d.slice(8).replace(/^0/, ""), valor: actual.porDia.get(d) || 0 }));
    poner(cuerpo, h("div", { style: { marginTop: "14px" } }, graficaBarras({ titulo: "Ventas por día", puntos })));
  }

  // Cobrado por forma de pago
  const cobros = C.cobrosPorCuenta(estado.ventas, r.desde, r.hasta);
  const totalCobrado = cobros.reduce((s, c) => s + c.usd, 0);
  poner(cuerpo, h("h3", { class: "subtitulo" }, "Cobrado por forma de pago"),
    cobros.length ? h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, cobros.map((c) => {
      const ves = cuentaPorId(c.cuenta)?.moneda === "VES";
      return h("li", null, h("div", { class: "fila-texto" }, h("b", null, nombreCuenta(c.cuenta)), h("span", { class: "num" }, `${c.n} ${c.n === 1 ? "cobro" : "cobros"}, ${pct(totalCobrado ? c.usd / totalCobrado : null)} del total`)),
        h("div", { class: "fila-monto num" }, ves ? bs(c.bs) : usd(c.usd), ves ? h("span", { class: "tenue", style: { display: "block", fontSize: "12.5px", fontWeight: 500 } }, usd(c.usd)) : null));
    }), h("li", null, h("div", { class: "fila-texto" }, h("b", null, "Total cobrado")), h("div", { class: "fila-monto num" }, usd(totalCobrado)))))
      : h("p", { class: "sobre-vino" }, "No hay cobros en este periodo."));

  // Lo más vendido
  if (actual.productos.length) {
    poner(cuerpo, h("h3", { class: "subtitulo" }, "Lo más vendido"),
      h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, actual.productos.slice(0, 10).map((p) =>
        h("li", null, h("div", { class: "fila-texto" }, h("b", null, p.nombre), h("span", { class: "num" }, `${p.cant} ${p.cant === 1 ? "unidad" : "unidades"}`)),
          h("div", { class: "fila-monto num" }, usd(p.ventas)))))));
  }
  if (actual.gastosPorCategoria.length) {
    poner(cuerpo, h("h3", { class: "subtitulo" }, "Gastos del periodo"),
      h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, actual.gastosPorCategoria.map((g) =>
        h("li", null, h("div", { class: "fila-texto" }, h("b", null, g.categoria)), h("div", { class: "fila-monto num" }, usd(g.usd)))))));
  }
}

/* ───────── Comparación de meses ───────── */
function pintarMeses(cuerpo, app) {
  const hoy = C.hoy();
  const filas = C.comparativaMeses(estado, cantidadMeses, hoy);
  const anteriorDe = (i) => {
    if (i === 0) {
      const a = C.periodoAnterior("mes", filas[0].desde, filas[0].hasta);
      return C.resumen(estado, a.desde, a.hasta);
    }
    return filas[i + 1] || null;
  };
  poner(cuerpo, 
    segmento([[6, "6 meses"], [12, "12 meses"]], cantidadMeses, (n) => { cantidadMeses = n; app.refrescar(); }, "Cuántos meses"),
    h("div", { style: { marginTop: "14px" } }, graficaBarras({
      titulo: "Ventas por mes",
      puntos: [...filas].reverse().map((f) => ({ etiqueta: `${C.nombreMes(f.mes)}${f.enCurso ? " (en curso)" : ""}`, corta: C.nombreMesCorto(f.mes).split(" ")[0], valor: f.ingresos })),
    })),
    h("h3", { class: "subtitulo" }, "Tabla comparativa"),
    h("p", { class: "sobre-vino", style: { fontSize: "13.5px", margin: "-4px 2px 10px" } }, `El mes en curso se compara con el mes anterior hasta el día ${Number(hoy.slice(8))}.`),
    h("div", { class: "tabla-envoltura" }, h("table", { class: "tabla" },
      h("thead", null, h("tr", null, ["Mes", "Ventas", "vs mes ant.", "Costo", "Utilidad bruta", "Gastos", "Utilidad neta", "Margen neto", "Ventas (N°)", "Ticket"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", null, filas.map((f, i) => {
        const a = anteriorDe(i);
        return h("tr", { class: f.enCurso ? "resaltar" : "" },
          h("th", { scope: "row", style: { textAlign: "left", fontWeight: 700 } }, `${C.nombreMesCorto(f.mes)}${f.enCurso ? " *" : ""}`),
          h("td", null, usd(f.ingresos)),
          h("td", null, a && a.ingresos ? cambio(f.ingresos, a.ingresos) : "—"),
          h("td", null, usd(f.costo)),
          h("td", null, usd(f.utilidadBruta)),
          h("td", null, usd(f.gastos)),
          h("td", { class: f.utilidadNeta < 0 ? "baja" : "" }, usd(f.utilidadNeta)),
          h("td", null, pct(f.margenNeto)),
          h("td", null, String(f.n)),
          h("td", null, usd(f.ticket)));
      })))),
    h("p", { class: "sobre-vino", style: { fontSize: "13px", marginTop: "8px" } }, "* Mes en curso."),
  );
}

/* ───────── Estado de resultados ───────── */
function pintarResultados(cuerpo, app) {
  const hoy = C.hoy();
  const mes = mesResultados || C.mesDe(hoy);
  const enCurso = mes === C.mesDe(hoy);
  const desde = C.inicioMes(mes);
  const hasta = enCurso ? hoy : C.finMes(mes);
  const ant = C.periodoAnterior("mes", desde, hasta);
  const a = C.resumen(estado, desde, hasta);
  const p = C.resumen(estado, ant.desde, ant.hasta);
  const etiquetaAnt = enCurso ? `${C.nombreMesCorto(C.mesDe(ant.desde))} (al día ${Number(ant.hasta.slice(8))})` : C.nombreMesCorto(C.mesDe(ant.desde));
  const porc = (v) => (a.ingresos ? pct(v / a.ingresos) : "—");

  const categorias = [...new Set([...a.gastosPorCategoria, ...p.gastosPorCategoria].map((g) => g.categoria))];
  const gastoDe = (r, cat) => r.gastosPorCategoria.find((g) => g.categoria === cat)?.usd || 0;
  const fila = (concepto, va, vp, { clase = "", signo = "", sangria = false, invertir = false } = {}) => h("tr", { class: clase },
    h("td", { class: sangria ? "sangria" : "" }, concepto),
    h("td", null, `${signo}${usd(va)}`), h("td", null, porc(va)), h("td", null, `${signo}${usd(vp)}`),
    h("td", null, va === 0 && vp === 0 ? "—" : (() => {
      const v = C.variacion(va, vp);
      if (v.pct == null) return "—";
      const bueno = invertir ? v.pct <= 0 : v.pct >= 0;
      return h("span", { class: Math.abs(v.pct) >= 0.15 ? (bueno ? "sube" : "baja") : "" }, textoCambio(va, vp));
    })()));

  const imprimible = h("div", { id: "imprimible" },
    h("div", { class: "titulo-seccion" }, h("h2", null, `Estado de resultados, ${C.nombreMes(mes)}`)),
    h("p", { class: "sobre-vino", style: { margin: "-6px 2px 12px", fontSize: "14px" } },
      `${NEGOCIO.nombre}. Del ${C.nombreDia(desde, { conDiaSemana: false })} al ${C.nombreDia(hasta, { conDiaSemana: false })}${enCurso ? " (mes en curso)" : ""}. Montos en dólares.`),
    h("div", { class: "tabla-envoltura" }, h("table", { class: "tabla" },
      h("thead", null, h("tr", null, ["Concepto", C.nombreMesCorto(mes), "% de ventas", etiquetaAnt, "Variación"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", null,
        fila("Ventas", a.ingresos, p.ingresos, { clase: "total" }),
        fila("Costo de lo vendido", a.costo, p.costo, { signo: "−", sangria: true, invertir: true }),
        fila("Utilidad bruta", a.utilidadBruta, p.utilidadBruta, { clase: "total" }),
        h("tr", { class: "grupo" }, h("td", { colspan: 5 }, "Gastos operativos")),
        ...(categorias.length ? categorias.map((c) => fila(c, gastoDe(a, c), gastoDe(p, c), { signo: "−", sangria: true, invertir: true })) : [h("tr", null, h("td", { class: "sangria", colspan: 5 }, "Sin gastos registrados"))]),
        fila("Total gastos operativos", a.gastos, p.gastos, { signo: "−", invertir: true }),
        fila("Utilidad neta", a.utilidadNeta, p.utilidadNeta, { clase: "total resaltar" }),
      ))),
    h("h3", { class: "subtitulo" }, "Indicadores"),
    h("div", { class: "tabla-envoltura" }, h("table", { class: "tabla" },
      h("thead", null, h("tr", null, ["Indicador", C.nombreMesCorto(mes), etiquetaAnt, "Cambio"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", null,
        ...[
          ["Margen bruto", a.margenBruto, p.margenBruto],
          ["Margen neto", a.margenNeto, p.margenNeto],
          ["Gastos sobre ventas", a.ingresos ? a.gastos / a.ingresos : null, p.ingresos ? p.gastos / p.ingresos : null],
        ].map(([n, x, y]) => h("tr", null, h("td", null, n), h("td", null, pct(x)), h("td", null, pct(y)),
          h("td", null, x == null || y == null ? "—" : `${x - y >= 0 ? "+" : "−"}${numero(Math.abs(x - y) * 100)} puntos`))),
        h("tr", null, h("td", null, "Ventas (N°)"), h("td", null, String(a.n)), h("td", null, String(p.n)), h("td", null, textoCambio(a.n, p.n))),
        h("tr", null, h("td", null, "Ticket promedio"), h("td", null, usd(a.ticket)), h("td", null, usd(p.ticket)), h("td", null, textoCambio(a.ticket, p.ticket))),
      ))),
    h("p", { class: "sobre-vino", style: { fontSize: "12.5px", marginTop: "10px" } },
      "Estado de resultados de gestión, hecho con lo registrado en el panel. No sustituye la contabilidad fiscal. Las variaciones de 15% o más se marcan en color."),
  );

  const resumenTexto = () => [
    `*Estado de resultados ${NEGOCIO.nombre}, ${C.nombreMes(mes)}${enCurso ? " (en curso)" : ""}*`,
    `Ventas: ${usd(a.ingresos)} (${textoCambio(a.ingresos, p.ingresos)} vs ${etiquetaAnt})`,
    `Costo de lo vendido: ${usd(a.costo)}`,
    `Utilidad bruta: ${usd(a.utilidadBruta)} (${pct(a.margenBruto)})`,
    `Gastos operativos: ${usd(a.gastos)}`,
    ...a.gastosPorCategoria.map((g) => `  - ${g.categoria}: ${usd(g.usd)}`),
    `*Utilidad neta: ${usd(a.utilidadNeta)} (${pct(a.margenNeto)})*`,
    `Ventas: ${a.n}, ticket promedio ${usd(a.ticket)}`,
  ].join("\n");

  poner(cuerpo, 
    h("div", { class: "navegar no-imprimir" },
      h("button", { class: "redondo toca", type: "button", "aria-label": "Mes anterior", onclick: () => { mesResultados = C.sumarMeses(mes, -1); app.refrescar(); } }, icono("flecha_izq", 22)),
      h("b", null, C.nombreMes(mes)),
      h("button", { class: "redondo toca", type: "button", "aria-label": "Mes siguiente", disabled: enCurso, onclick: () => { mesResultados = C.sumarMeses(mes, 1); app.refrescar(); } }, icono("flecha_der", 22))),
    a.ventasSinCosto > 0 ? h("div", { class: "aviso-caja no-imprimir" }, icono("alerta", 20), `${usd(a.ventasSinCosto)} de lo vendido no tiene costo cargado: el costo real es mayor y la utilidad, menor.`) : null,
    imprimible,
    h("div", { class: "acciones no-imprimir" },
      enMarco ? null : h("button", { class: "boton toca", type: "button", onclick: () => window.print() }, icono("imprimir", 20), "Imprimir o guardar PDF"),
      h("a", { class: "boton verde toca", href: `https://wa.me/?text=${encodeURIComponent(resumenTexto())}`, target: "_blank", rel: "noopener" }, icono("compartir", 20), "Enviar resumen por WhatsApp"),
      h("button", { class: "boton toca", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(resumenTexto()); avisar("Resumen copiado"); } catch { avisar("No se pudo copiar en este navegador"); }
      } }, icono("portapapeles", 20), "Copiar resumen")),
  );
}

/* ───────── Márgenes por producto ───────── */
function pintarMargenes(cuerpo, app) {
  const hoy = C.hoy();
  const mes = C.mesDe(hoy);
  const r = C.resumen(estado, C.inicioMes(mes), hoy);
  const vendidos = new Map(r.productos.map((p) => [p.pid, p]));
  const filas = productosOrdenados().map((p) => {
    const costo = costoDe(p);
    const m = C.margen(p.precio, costo);
    const v = vendidos.get(p.id);
    return { p, costo, m, cant: v?.cant || 0, ganancia: costo != null && v ? v.ventas - v.cant * costo : null };
  }).sort((x, y) => (x.m == null) - (y.m == null) || (x.m ?? 0) - (y.m ?? 0));
  const conCosto = filas.filter((f) => f.m != null);

  poner(cuerpo, 
    h("div", { class: "kpis" },
      kpi("Margen bruto del mes", pct(r.margenBruto), `En ${C.nombreMes(mes, false)}, sobre lo vendido`),
      kpi("Productos con costo", `${conCosto.length} de ${filas.length}`, conCosto.length < filas.length ? "Toca uno sin costo para cargarlo" : "Todos tienen costo"),
      kpi("Margen bajo (menos de 30%)", String(conCosto.filter((f) => f.m < 0.3).length), "Revisa precio o costo")),
    h("p", { class: "sobre-vino", style: { fontSize: "13.5px", margin: "12px 2px" } }, "Margen = (precio − costo) ÷ precio. Ordenado del margen más bajo al más alto. Toca un producto para cambiar su precio o costo."),
    h("div", { class: "tabla-envoltura" }, h("table", { class: "tabla" },
      h("thead", null, h("tr", null, ["Producto", "Precio", "Costo", "Gana c/u", "Margen", `Vendidos ${C.nombreMesCorto(mes).split(" ")[0]}`, "Ganancia del mes"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", null, filas.map(({ p, costo, m, cant, ganancia }) => {
        const nivel = C.nivelMargen(m);
        return h("tr", { style: { cursor: "pointer" }, onclick: () => app.ir("productos", { subvista: "precios" }) },
          h("td", null, p.nombre),
          h("td", null, usd(p.precio)),
          h("td", null, costo == null ? "—" : usd(costo)),
          h("td", null, costo == null ? "—" : usd(p.precio - costo)),
          h("td", null, h("span", { class: `margen ${nivel.id}` }, m == null ? nivel.texto : `${pct(m)} ${nivel.texto.toLowerCase()}`)),
          h("td", null, String(cant)),
          h("td", null, ganancia == null ? "—" : usd(ganancia)));
      })))),
  );
}
