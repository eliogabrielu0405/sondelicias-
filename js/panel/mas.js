/* Más: gastos, dinero en cuentas, por cobrar, cierre de caja, historial, ajustes y copias de seguridad. */
import { poner, reemplazar } from "../comun.js";
import { usd, bs, numero, enMarco } from "../comun.js";
import { NEGOCIO } from "../../menu.js";
import {
  h, icono, abrirHoja, avisar, intentar, confirmar, interruptor, campoMonto, campoTexto, selector, tituloSeccion, fechaHora, descargar, vacio,
} from "./ui.js";
import { estado, config, ponerConfig, copiaCompleta, restaurarCopia, protegerAlmacenamiento, borrar } from "./datos.js";
import {
  CATEGORIAS_GASTO, cuentas, cuentasActivas, cuentaPorId, nombreCuenta, tasa, guardarGasto, movimientoCaja, guardarCierre,
  registrarCobro, anularVenta,
} from "./negocio.js";
import { cambiarClave } from "./seguridad.js";
import { abrirCobro } from "./caja.js";
import * as C from "./calculos.js";

let seccion = null;
let mesGastos = null;
let filtroHistorial = { texto: "", estado: "confirmada", cuantos: 40 };

const enMoneda = (cuentaId, valor) => (cuentaPorId(cuentaId)?.moneda === "VES" ? bs(valor) : usd(valor));
const diasDesdeCopia = () => {
  const u = config("ultimaCopia", 0);
  return u ? Math.floor((Date.now() - u) / 86400000) : null;
};

const SECCIONES = [
  { id: "gastos", texto: "Gastos", detalle: "Registrar y ver lo que se paga", icono: "recibo", pintar: pintarGastos },
  { id: "dinero", texto: "Dinero en cuentas", detalle: "Saldos, aportes, retiros y traspasos", icono: "billetera", pintar: pintarDinero },
  { id: "cobrar", texto: "Por cobrar", detalle: "Ventas que quedaron debiendo", icono: "alerta", pintar: pintarPorCobrar },
  { id: "cierre", texto: "Cierre de caja", detalle: "Contar el dinero al final del día", icono: "caja", pintar: pintarCierre },
  { id: "historial", texto: "Historial de ventas", detalle: "Buscar, cobrar o anular una venta", icono: "buscar", pintar: pintarHistorial },
  { id: "formas", texto: "Formas de pago", detalle: "Efectivo, Pago Móvil, punto, Zelle…", icono: "billetera", pintar: pintarFormas },
  { id: "copia", texto: "Copia de seguridad", detalle: "Guardar o recuperar todos los datos", icono: "descargar", pintar: pintarCopia },
  { id: "clave", texto: "Contraseña", detalle: "Cambiar la contraseña del panel", icono: "candado", pintar: pintarClave },
];

export function pintar(vista, app, opciones = {}) {
  if (opciones.abrir) seccion = opciones.abrir;
  const actual = SECCIONES.find((s) => s.id === seccion);
  if (actual) {
    poner(vista, h("button", { class: "boton chico toca", type: "button", style: { marginBottom: "12px" }, onclick: () => { seccion = null; app.refrescar(); } }, icono("flecha_izq", 18), "Más"));
    actual.pintar(vista, app);
    return;
  }
  const dias = diasDesdeCopia();
  poner(vista, tituloSeccion("Más"));
  if (dias == null || dias >= 7) {
    poner(vista, h("div", { class: "aviso-caja" }, icono("alerta", 20), h("div", null,
      dias == null ? "Todavía no has guardado una copia de seguridad. " : `Tu última copia de seguridad es de hace ${dias} días. `,
      "Los datos viven solo en este teléfono: si se pierde o se borra Chrome, se pierden.",
      h("div", null, h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => { seccion = "copia"; app.refrescar(); } }, "Guardar copia ahora")))));
  }
  poner(vista, h("div", { class: "tarjeta caja menu-mas", style: { paddingBlock: "2px" } }, h("ul", { class: "filas" },
    SECCIONES.map((s) => h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => { seccion = s.id; app.refrescar(); } },
      icono(s.icono, 20), h("div", { class: "fila-texto" }, h("b", null, s.texto), h("span", null, s.detalle)), icono("flecha_der", 20)))),
    h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => app.pedirTasa() }, icono("billetera", 20),
      h("div", { class: "fila-texto" }, h("b", null, "Tasa del día"), h("span", null, tasa() ? `Bs ${numero(tasa().valor)} por $1${tasa().deHoy ? "" : ", no es de hoy"}` : "Sin tasa")), icono("flecha_der", 20))),
    enMarco ? null : h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => instalar(app) }, icono("descargar", 20),
      h("div", { class: "fila-texto" }, h("b", null, "Instalar en el teléfono"), h("span", null, "Ícono en la pantalla de inicio, funciona sin internet")), icono("flecha_der", 20))),
    h("li", null, h("a", { class: "fila-boton", href: enMarco ? "index.html" : "./", target: enMarco ? null : "_blank", rel: "noopener", style: { textDecoration: "none" } }, icono("compartir", 20),
      h("div", { class: "fila-texto" }, h("b", null, "Ver la página de pedidos"), h("span", null, "Lo que ven los clientes")), icono("flecha_der", 20))),
    h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => app.bloquear() }, icono("candado", 20),
      h("div", { class: "fila-texto" }, h("b", null, "Bloquear el panel"), h("span", null, "Pide la contraseña para volver a entrar")))),
  )));
}

/* ───────── Gastos ───────── */
function pintarGastos(vista, app) {
  const mes = mesGastos || C.mesDe(C.hoy());
  const lista = estado.gastos.filter((g) => C.mesDe(g.fecha) === mes).sort((a, b) => (b.fecha.localeCompare(a.fecha)) || b.creado - a.creado);
  const total = lista.reduce((s, g) => s + g.usd, 0);
  const porCat = new Map();
  for (const g of lista) porCat.set(g.categoria, (porCat.get(g.categoria) || 0) + g.usd);
  poner(vista, 
    tituloSeccion("Gastos", h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => editarGasto(null, app) }, icono("mas", 18), "Registrar gasto")),
    h("div", { class: "navegar" },
      h("button", { class: "redondo toca", type: "button", "aria-label": "Mes anterior", onclick: () => { mesGastos = C.sumarMeses(mes, -1); app.refrescar(); } }, icono("flecha_izq", 22)),
      h("b", null, `${C.nombreMes(mes)}: ${usd(total)}`),
      h("button", { class: "redondo toca", type: "button", "aria-label": "Mes siguiente", disabled: mes >= C.mesDe(C.hoy()), onclick: () => { mesGastos = C.sumarMeses(mes, 1); app.refrescar(); } }, icono("flecha_der", 22))),
  );
  if (!lista.length) { poner(vista, vacio("No hay gastos registrados este mes. Anota aquí sueldos, alquiler, luz, gas, empaques y lo demás que pagues.")); return; }
  poner(vista, h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" },
    [...porCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => h("li", null, h("div", { class: "fila-texto" }, h("b", null, c)), h("div", { class: "fila-monto num" }, usd(v)))))),
  h("h3", { class: "subtitulo" }, "Detalle"),
  h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, lista.map((g) =>
    h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => editarGasto(g, app) },
      h("div", { class: "fila-texto" }, h("b", null, g.concepto || g.categoria), h("span", null, `${C.diaCorto(g.fecha)}, ${g.categoria}${g.cuenta ? `, ${nombreCuenta(g.cuenta)}` : ""}`)),
      h("div", { class: "fila-monto num" }, usd(g.usd), g.bs && cuentaPorId(g.cuenta)?.moneda === "VES" ? h("span", { class: "tenue", style: { display: "block", fontSize: "12.5px", fontWeight: 500 } }, bs(g.bs)) : null)))))));
}

export function editarGasto(g, app) {
  abrirHoja(g ? "Editar gasto" : "Registrar gasto", (cuerpo, cerrar) => {
    const fecha = h("input", { class: "campo", type: "date", id: "g-fecha", value: g?.fecha || C.hoy(), max: C.hoy() });
    const categoria = selector({ id: "g-cat", etiqueta: "Tipo de gasto", opciones: CATEGORIAS_GASTO.map((c) => [c, c]), valor: g?.categoria || CATEGORIAS_GASTO[0] });
    const concepto = campoTexto({ id: "g-concepto", etiqueta: "Detalle (opcional)", valor: g?.concepto || "", max: 80, placeholder: "Ej: pago semanal de Luis" });
    const ops = [...cuentasActivas().map((c) => [c.id, c.nombre]), ["", "No anotar de dónde salió"]];
    const cuenta = selector({ id: "g-cuenta", etiqueta: "¿De dónde salió el dinero?", opciones: ops, valor: g ? g.cuenta || "" : cuentasActivas()[0]?.id });
    const monedaDe = () => cuentaPorId(cuenta.sel.value)?.moneda || "USD";
    const valorInicial = g ? (monedaDe() === "VES" ? g.bs : g.usd) : "";
    let monto = campoMonto({ id: "g-monto", etiqueta: "Monto", moneda: monedaDe(), valor: valorInicial, autofocus: !g });
    cuenta.sel.addEventListener("change", () => {
      const nuevo = campoMonto({ id: "g-monto", etiqueta: "Monto", moneda: monedaDe(), valor: monto.entrada.value });
      monto.nodo.replaceWith(nuevo.nodo);
      monto = nuevo;
    });
    const form = h("form", { class: "form" },
      h("div", null, h("label", { class: "etiqueta", for: "g-fecha" }, "Fecha"), fecha),
      categoria.nodo, concepto.nodo, cuenta.nodo, monto.nodo,
      h("p", { class: "ayuda" }, "¿Compraste ingredientes o mercancía? Anótalo en Productos, Inventario, Compra: así no se cuenta dos veces en la utilidad."),
      h("button", { class: "boton verde ancho toca", type: "submit" }, icono("check", 20), "Guardar gasto"),
      g ? h("button", { class: "boton ancho toca", type: "button", onclick: async () => {
        if (await confirmar("Eliminar gasto", `Se borra ${g.concepto || g.categoria} de ${usd(g.usd)}.`, { boton: "Eliminar", peligro: true })) {
          if (await intentar(() => borrar("gastos", g), "Gasto eliminado")) { cerrar(); app.refrescar(); }
        }
      } }, icono("basura", 20), "Eliminar gasto") : null);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = monto.valor();
      if (!(m > 0)) { avisar("Escribe el monto del gasto"); return; }
      if (monedaDe() === "VES" && !tasa()) { app.pedirTasa(); return; }
      const ok = await intentar(() => guardarGasto({ id: g?.id, fecha: fecha.value || C.hoy(), categoria: categoria.sel.value, concepto: concepto.entrada.value, cuenta: cuenta.sel.value || null, monto: m }), "Gasto guardado");
      if (ok) { cerrar(); app.refrescar(); }
    });
    poner(cuerpo, form);
  });
}

/* ───────── Dinero en cuentas ───────── */
function pintarDinero(vista, app) {
  const saldos = C.saldosCuentas(estado, cuentas()).filter((c) => c.activa !== false || Math.abs(c.saldo) > 0.004);
  const t = tasa();
  const totalUsd = saldos.reduce((s, c) => s + (c.moneda === "VES" ? (t ? c.saldo / t.valor : 0) : c.saldo), 0);
  const sinInicial = !estado.caja.some((m) => m.tipo === "inicial");
  poner(vista, tituloSeccion("Dinero en cuentas"));
  if (sinInicial) {
    poner(vista, h("div", { class: "aviso-caja" }, icono("alerta", 20), h("div", null,
      "Para que los saldos cuadren con la realidad, anota cuánto había en cada cuenta al empezar a usar el panel.",
      h("div", null, h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => moverDinero("inicial", app) }, "Poner saldo inicial")))));
  }
  poner(vista, 
    h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" },
      saldos.map((c) => h("li", null, h("div", { class: "fila-texto" }, h("b", null, c.nombre), h("span", null, c.moneda === "VES" ? "En bolívares" : "En dólares")),
        h("div", { class: `fila-monto num ${c.saldo < 0 ? "baja" : ""}` }, c.moneda === "VES" ? bs(c.saldo) : usd(c.saldo),
          c.moneda === "VES" && t ? h("span", { class: "tenue", style: { display: "block", fontSize: "12.5px", fontWeight: 500 } }, `≈ ${usd(c.saldo / t.valor)}`) : null))),
      h("li", null, h("div", { class: "fila-texto" }, h("b", null, "Total aproximado en dólares"), h("span", null, t ? `Bolívares a tasa ${numero(t.valor)}` : "Sin tasa: no suma los bolívares")),
        h("div", { class: "fila-monto num" }, usd(totalUsd))))),
    h("div", { class: "botones-fila", style: { marginTop: "12px" } },
      [["aporte", "Meter dinero"], ["retiro", "Sacar dinero"], ["transferencia", "Pasar entre cuentas"], ["inicial", "Saldo inicial"], ["ajuste", "Corregir saldo"]].map(([tipo, texto]) =>
        h("button", { class: "boton toca", type: "button", onclick: () => moverDinero(tipo, app) }, texto))),
  );
  const ultimos = [...estado.caja].sort((a, b) => b.creado - a.creado).slice(0, 20);
  if (ultimos.length) {
    const nombres = { inicial: "Saldo inicial", aporte: "Entró dinero", retiro: "Salió dinero", transferencia: "Traspaso", ajuste: "Corrección", pago_proveedor: "Pago a proveedor" };
    poner(vista, h("h3", { class: "subtitulo" }, "Últimos movimientos"),
      h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, ultimos.map((m) =>
        h("li", null, h("div", { class: "fila-texto" }, h("b", null, `${nombres[m.tipo] || m.tipo}, ${nombreCuenta(m.cuenta)}`), h("span", null, [fechaHora(m.creado), m.nota].filter(Boolean).join(", "))),
          h("div", { class: `fila-monto num ${m.usd < 0 ? "baja" : "sube"}` }, enMoneda(m.cuenta, cuentaPorId(m.cuenta)?.moneda === "VES" ? m.bs : m.usd)))))));
  }
}

function moverDinero(tipo, app) {
  const titulos = { aporte: "Meter dinero", retiro: "Sacar dinero", transferencia: "Pasar entre cuentas", inicial: "Saldo inicial", ajuste: "Corregir saldo" };
  abrirHoja(titulos[tipo], (cuerpo, cerrar) => {
    const ops = cuentasActivas().map((c) => [c.id, c.nombre]);
    const origen = selector({ id: "d-cuenta", etiqueta: tipo === "transferencia" ? "Sale de" : "Cuenta", opciones: ops, valor: ops[0]?.[0] });
    const destino = selector({ id: "d-destino", etiqueta: "Entra a", opciones: ops, valor: ops[1]?.[0] });
    const monedaDe = (sel) => cuentaPorId(sel.value)?.moneda || "USD";
    const ayudaAjuste = undefined;
    const sentido = selector({ id: "d-sentido", etiqueta: "¿Qué pasó?", opciones: [["sobra", "Sobra dinero (se suma)"], ["falta", "Falta dinero (se resta)"]], valor: "falta" });
    let monto = campoMonto({ id: "d-monto", etiqueta: tipo === "transferencia" ? "Cuánto sale" : "Monto", moneda: monedaDe(origen.sel), autofocus: true, ayuda: ayudaAjuste });
    let montoDestino = campoMonto({ id: "d-monto2", etiqueta: "Cuánto entra", moneda: monedaDe(destino.sel) });
    const cajaDestino = h("div", { class: "form" }, destino.nodo, montoDestino.nodo);
    const pintarMonedas = () => {
      const m1 = campoMonto({ id: "d-monto", etiqueta: tipo === "transferencia" ? "Cuánto sale" : "Monto", moneda: monedaDe(origen.sel), valor: monto.entrada.value, ayuda: ayudaAjuste });
      monto.nodo.replaceWith(m1.nodo); monto = m1;
      const m2 = campoMonto({ id: "d-monto2", etiqueta: "Cuánto entra", moneda: monedaDe(destino.sel), valor: montoDestino.entrada.value });
      montoDestino.nodo.replaceWith(m2.nodo); montoDestino = m2;
      montoDestino.nodo.hidden = monedaDe(origen.sel) === monedaDe(destino.sel);
    };
    origen.sel.addEventListener("change", pintarMonedas);
    destino.sel.addEventListener("change", pintarMonedas);
    montoDestino.nodo.hidden = monedaDe(origen.sel) === monedaDe(destino.sel);
    const nota = campoTexto({ id: "d-nota", etiqueta: "Nota (opcional)", max: 80, placeholder: tipo === "retiro" ? "Ej: retiro del dueño" : "" });
    const form = h("form", { class: "form" }, origen.nodo, tipo === "ajuste" ? sentido.nodo : null, monto.nodo, tipo === "transferencia" ? cajaDestino : null, nota.nodo,
      h("button", { class: "boton verde ancho toca", type: "submit" }, icono("check", 20), "Guardar"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const escrito = monto.valor();
      if (!(escrito > 0)) { avisar("Escribe un monto mayor que cero"); return; }
      const m = tipo === "ajuste" && sentido.sel.value === "falta" ? -escrito : escrito;
      const necesitaTasa = [origen.sel, ...(tipo === "transferencia" ? [destino.sel] : [])].some((s) => monedaDe(s) === "VES");
      if (necesitaTasa && !tasa()) { app.pedirTasa(); return; }
      const mismaMoneda = monedaDe(origen.sel) === monedaDe(destino.sel);
      const md = tipo === "transferencia" && !mismaMoneda ? montoDestino.valor() : m;
      if (tipo === "transferencia" && !(md > 0)) { avisar("Escribe cuánto entra en la otra cuenta"); return; }
      const ok = await intentar(() => movimientoCaja({ tipo, cuenta: origen.sel.value, monto: m, cuentaDestino: destino.sel.value, montoDestino: md, nota: nota.entrada.value }), "Movimiento guardado");
      if (ok) { cerrar(); app.refrescar(); }
    });
    poner(cuerpo, form);
  });
}

/* ───────── Por cobrar ───────── */
function pintarPorCobrar(vista, app) {
  const lista = C.porCobrar(estado.ventas);
  const total = lista.reduce((s, v) => s + C.saldo(v), 0);
  poner(vista, tituloSeccion("Por cobrar"), h("p", { class: "sobre-vino num", style: { margin: "-6px 2px 12px" } }, `Total: ${usd(total)}`));
  if (!lista.length) { poner(vista, vacio("Nadie debe nada. Las ventas que se cobran después aparecen aquí.")); return; }
  poner(vista, h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, lista.map((v) =>
    h("li", null,
      h("div", { class: "fila-texto" }, h("b", null, `${v.cliente} (#${v.num})`), h("span", { class: "num" }, `${C.diaCorto(v.dia)}, total ${usd(v.total)}${C.pagado(v) ? `, abonó ${usd(C.pagado(v))}` : ""}`)),
      h("button", { class: "boton verde chico toca", type: "button", onclick: () => abrirCobro({
        titulo: `Cobrar a ${v.cliente}`, total: v.total, yaPagado: C.pagado(v), app,
        alConfirmar: async (pagos) => { await registrarCobro(v, pagos); app.refrescar(); avisar("Cobro registrado"); },
      }) }, `Cobrar ${usd(C.saldo(v))}`))))));
}

/* ───────── Cierre de caja ───────── */
function pintarCierre(vista, app) {
  const hoy = C.hoy();
  const r = C.resumen(estado, hoy, hoy);
  const delDia = new Map(C.movimientoDelDia(estado, cuentas(), hoy).map((c) => [c.id, c.saldo]));
  const saldos = C.saldosCuentas(estado, cuentas()).filter((c) => c.activa !== false);
  const cobrosHoy = C.cobrosPorCuenta(estado.ventas, hoy, hoy).reduce((s, c) => s + c.usd, 0);
  poner(vista, tituloSeccion("Cierre de caja"),
    h("p", { class: "sobre-vino", style: { margin: "-6px 2px 12px" } }, C.nombreDia(hoy)),
    h("div", { class: "kpis" },
      h("div", { class: "kpi caja" }, h("p", { class: "kpi-titulo" }, "Vendido hoy"), h("p", { class: "kpi-valor num" }, usd(r.ingresos)), h("p", { class: "kpi-detalle" }, `${r.n} ventas`)),
      h("div", { class: "kpi caja" }, h("p", { class: "kpi-titulo" }, "Cobrado hoy"), h("p", { class: "kpi-valor num" }, usd(cobrosHoy)), h("p", { class: "kpi-detalle" }, "Cuenta también lo que pagaron hoy de días anteriores")),
      h("div", { class: "kpi caja" }, h("p", { class: "kpi-titulo" }, "Quedó por cobrar hoy"), h("p", { class: "kpi-valor num" }, usd(r.porCobrar)), h("p", { class: "kpi-detalle" }, "Ver en Por cobrar"))),
    h("h3", { class: "subtitulo" }, "Cuenta el dinero de cada forma de pago"),
    h("p", { class: "sobre-vino", style: { fontSize: "13.5px", margin: "-4px 2px 10px" } }, "Escribe cuánto hay de verdad (caja de efectivo, saldo del banco). El panel te dice si sobra o falta."),
  );
  const filas = saldos.map((c) => {
    const contado = campoMonto({ id: `c-${c.id}`, moneda: c.moneda });
    const dif = h("p", { class: "ayuda num", "aria-live": "polite" });
    contado.entrada.addEventListener("input", () => {
      const v = contado.valor();
      if (v == null) { dif.textContent = ""; return; }
      const d = v - c.saldo;
      dif.textContent = Math.abs(d) < 0.005 ? "Cuadra exacto" : d > 0 ? `Sobra ${enMoneda(c.id, d)}` : `Falta ${enMoneda(c.id, -d)}`;
      dif.className = `ayuda num ${Math.abs(d) < 0.005 ? "sube" : "baja"}`;
    });
    contado.nodo.querySelector(".ayuda")?.remove();
    return { c, contado, nodo: h("div", { class: "tarjeta caja" },
      h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px" } },
        h("b", null, c.nombre), h("span", { class: "num tenue" }, `Movimiento de hoy: ${enMoneda(c.id, delDia.get(c.id) || 0)}`)),
      h("p", { class: "num", style: { margin: "6px 0 8px" } }, "Debería haber ", h("b", null, enMoneda(c.id, c.saldo))),
      h("label", { class: "solo-lector", for: `c-${c.id}` }, `Contado en ${c.nombre}`), contado.entrada, dif) };
  });
  const ajustar = { valor: true };
  const nota = campoTexto({ id: "c-nota", etiqueta: "Nota (opcional)", max: 120 });
  poner(vista, ...filas.map((f) => f.nodo),
    h("div", { class: "tarjeta caja form" },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
        h("span", null, h("b", null, "Corregir los saldos a lo contado"), h("span", { class: "ayuda", style: { display: "block" } }, "Si falta o sobra, se anota la diferencia para que mañana empiece cuadrado.")),
        interruptor(true, (v) => { ajustar.valor = v; }, "Corregir los saldos a lo contado")),
      nota.nodo,
      h("button", { class: "boton verde ancho toca", type: "button", onclick: async () => {
        const datos = filas.map(({ c, contado }) => ({ cuenta: c.id, esperado: c.saldo, contado: contado.valor() })).filter((f) => f.contado != null);
        if (!datos.length) { avisar("Escribe lo contado en al menos una cuenta"); return; }
        if (datos.some((f) => cuentaPorId(f.cuenta)?.moneda === "VES") && ajustar.valor && !tasa()) { app.pedirTasa(); return; }
        if (await intentar(() => guardarCierre({ fecha: hoy, filas: datos, nota: nota.entrada.value, ajustar: ajustar.valor }), "Cierre guardado")) app.refrescar();
      } }, icono("check", 20), "Guardar cierre de hoy")));

  const pasados = [...estado.cierres].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  if (pasados.length) {
    poner(vista, h("h3", { class: "subtitulo" }, "Cierres anteriores"),
      h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, pasados.map((ci) => {
        const difs = ci.filas.filter((f) => Math.abs(f.contado - f.esperado) >= 0.005);
        return h("li", null, h("div", { class: "fila-texto" }, h("b", null, C.nombreDia(ci.fecha)),
          h("span", null, difs.length ? difs.map((f) => `${nombreCuenta(f.cuenta)}: ${f.contado > f.esperado ? "sobró" : "faltó"} ${enMoneda(f.cuenta, Math.abs(f.contado - f.esperado))}`).join("; ") : "Todo cuadró")));
      }))));
  }
}

/* ───────── Historial de ventas ───────── */
function pintarHistorial(vista, app) {
  const nombresEstado = { confirmada: "Confirmadas", cancelada: "Canceladas", anulada: "Anuladas", pendiente: "Sin confirmar" };
  const q = filtroHistorial.texto.trim().toLowerCase();
  const todas = [...estado.ventas].filter((v) => v.estado === filtroHistorial.estado)
    .filter((v) => !q || v.cliente.toLowerCase().includes(q) || String(v.num) === q.replace("#", "") || (v.codigo || "").toLowerCase() === q)
    .sort((a, b) => (b.confirmada || b.creado) - (a.confirmada || a.creado));
  const buscador = h("input", { class: "campo", type: "search", placeholder: "Buscar por cliente, # o código", value: filtroHistorial.texto, "aria-label": "Buscar venta" });
  buscador.addEventListener("change", () => { filtroHistorial.texto = buscador.value; app.refrescar(); });
  poner(vista, tituloSeccion("Historial de ventas"), buscador,
    h("div", { class: "chips", style: { margin: "10px 0" } }, Object.entries(nombresEstado).map(([id, t]) =>
      h("button", { class: "chip toca", type: "button", "aria-pressed": String(filtroHistorial.estado === id), onclick: () => { filtroHistorial.estado = id; filtroHistorial.cuantos = 40; app.refrescar(); } }, t))));
  if (!todas.length) { poner(vista, vacio("No hay ventas con ese filtro.")); return; }
  poner(vista, h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, todas.slice(0, filtroHistorial.cuantos).map((v) => {
    const debe = v.estado === "confirmada" ? C.saldo(v) : 0;
    return h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => detalleVenta(v, app) },
      h("div", { class: "fila-texto" }, h("b", null, `#${v.num} ${v.cliente}`), h("span", null, `${fechaHora(v.confirmada || v.creado)}, ${v.origen === "web" ? "WhatsApp" : "Caja"}${debe > 0.004 ? `, debe ${usd(debe)}` : ""}`)),
      h("div", { class: "fila-monto num" }, usd(v.total))));
  }))));
  if (todas.length > filtroHistorial.cuantos) {
    poner(vista, h("button", { class: "boton ancho toca", type: "button", style: { marginTop: "12px" }, onclick: () => { filtroHistorial.cuantos += 40; app.refrescar(); } }, `Ver más (${todas.length - filtroHistorial.cuantos} restantes)`));
  }
}

function detalleVenta(v, app) {
  abrirHoja(`Venta #${v.num}`, (cuerpo, cerrar) => {
    const debe = v.estado === "confirmada" ? C.saldo(v) : 0;
    poner(cuerpo, 
      h("p", null, h("b", null, v.cliente), `, ${v.tipo}, ${v.origen === "web" ? "pedido por WhatsApp" : "venta en caja"}`),
      h("p", { class: "ayuda" }, `${fechaHora(v.confirmada || v.creado)}${v.estado !== "confirmada" ? `, ${v.estado}` : ""}${v.anulada?.motivo ? ` (${v.anulada.motivo})` : ""}`),
      h("ul", { class: "pedido-items", style: { marginTop: "10px" } }, v.items.map((it) =>
        h("li", null, h("span", null, `${it.cant}× ${it.opcion ? `${it.nombre} (${it.opcion})` : it.nombre}`), h("span", { class: "num" }, usd(it.cant * it.precio))))),
      h("div", { class: "pedido-total", style: { marginTop: "10px" } }, h("span", null, "Total"), h("strong", { class: "num" }, usd(v.total))),
      (v.pagos || []).length ? h("ul", { class: "filas", style: { marginTop: "8px" } }, v.pagos.map((p) =>
        h("li", null, h("div", { class: "fila-texto" }, h("b", null, nombreCuenta(p.cuenta)), h("span", null, fechaHora(p.creado))),
          h("div", { class: "fila-monto num" }, cuentaPorId(p.cuenta)?.moneda === "VES" ? bs(p.bs) : usd(p.usd))))) : null,
      h("div", { class: "acciones" },
        debe > 0.004 ? h("button", { class: "boton verde toca", type: "button", onclick: () => { cerrar(); abrirCobro({
          titulo: `Cobrar #${v.num}`, total: v.total, yaPagado: C.pagado(v), app,
          alConfirmar: async (pagos) => { await registrarCobro(v, pagos); app.refrescar(); avisar("Cobro registrado"); },
        }); } }, `Cobrar ${usd(debe)}`) : null,
        v.estado === "confirmada" ? h("button", { class: "boton toca", type: "button", onclick: () => { cerrar(); anular(v, app); } }, "Anular venta") : null),
    );
  });
}

function anular(v, app) {
  abrirHoja(`Anular venta #${v.num}`, (cuerpo, cerrar) => {
    const motivo = campoTexto({ id: "a-motivo", etiqueta: "¿Por qué se anula?", max: 100, placeholder: "Ej: se cobró dos veces", autofocus: true });
    poner(cuerpo, h("div", { class: "form" },
      h("p", null, "La venta deja de contar en los reportes, lo cobrado sale de las cuentas (como si se devolviera) y los insumos vuelven al inventario."),
      motivo.nodo,
      h("button", { class: "boton rojo ancho toca", type: "button", onclick: async () => {
        if (await intentar(() => anularVenta(v, motivo.entrada.value), `Venta #${v.num} anulada`)) { cerrar(); app.refrescar(); }
      } }, "Anular venta")));
  });
}

/* ───────── Formas de pago ───────── */
function pintarFormas(vista, app) {
  const lista = cuentas();
  poner(vista, tituloSeccion("Formas de pago", h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => editarForma(null, app) }, icono("mas", 18), "Agregar")),
    h("p", { class: "sobre-vino", style: { margin: "-6px 2px 12px", fontSize: "14px" } }, "Apaga las que no uses. No se borran para no perder lo que ya se cobró con ellas."),
    h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, lista.map((c) =>
      h("li", null,
        h("button", { class: "fila-boton", type: "button", onclick: () => editarForma(c, app) },
          h("div", { class: "fila-texto" }, h("b", null, c.nombre), h("span", null, c.moneda === "VES" ? "En bolívares" : "En dólares"))),
        interruptor(c.activa !== false, async (v) => {
          if (await intentar(() => ponerConfig("cuentas", lista.map((x) => (x.id === c.id ? { ...x, activa: v } : x))))) app.refrescar();
        }, `Usar ${c.nombre}`))))));
}

function editarForma(c, app) {
  abrirHoja(c ? `Editar ${c.nombre}` : "Nueva forma de pago", (cuerpo, cerrar) => {
    const nombre = campoTexto({ id: "f-nombre", etiqueta: "Nombre", valor: c?.nombre || "", max: 30, autofocus: true, placeholder: "Ej: Binance" });
    const moneda = selector({ id: "f-moneda", etiqueta: "Moneda", opciones: [["USD", "Dólares"], ["VES", "Bolívares"]], valor: c?.moneda || "USD" });
    if (c) moneda.sel.disabled = true;
    const form = h("form", { class: "form" }, nombre.nodo, moneda.nodo, c ? h("p", { class: "ayuda" }, "La moneda no se cambia para no desordenar lo ya registrado.") : null,
      h("button", { class: "boton verde ancho toca", type: "submit" }, "Guardar"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const n = nombre.entrada.value.trim();
      if (!n) { avisar("Escribe el nombre"); return; }
      const lista = cuentas();
      const nueva = c ? lista.map((x) => (x.id === c.id ? { ...x, nombre: n } : x)) : [...lista, { id: `c${Date.now().toString(36)}`, nombre: n, moneda: moneda.sel.value, activa: true }];
      if (await intentar(() => ponerConfig("cuentas", nueva), "Guardado")) { cerrar(); app.refrescar(); }
    });
    poner(cuerpo, form);
  });
}

/* ───────── Copia de seguridad ───────── */
function pintarCopia(vista, app) {
  const dias = diasDesdeCopia();
  const estadoAlmacen = h("p", { class: "ayuda" });
  navigator.storage?.persisted?.().then((p) => {
    estadoAlmacen.textContent = p ? "El navegador protege estos datos: no los borra si falta espacio." : "El navegador todavía no protege estos datos. Instalar el panel en el teléfono ayuda.";
  }).catch(() => {});
  const nombreArchivo = () => `son-dlicias-copia-${C.hoy()}.json`;
  const marcar = () => ponerConfig("ultimaCopia", Date.now()).then(() => app.refrescar());
  const archivo = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  archivo.addEventListener("change", async () => {
    const f = archivo.files?.[0];
    if (!f) return;
    let copia;
    try { copia = JSON.parse(await f.text()); } catch { avisar("Ese archivo no es una copia del panel."); return; }
    const fecha = copia?.creada ? new Date(copia.creada).toLocaleString("es-VE") : "fecha desconocida";
    if (await confirmar("Restaurar copia", `Se reemplaza TODO lo que hay en este panel por la copia del ${fecha}. Lo que no esté en la copia se pierde.`, { boton: "Restaurar", peligro: true })) {
      if (await intentar(() => restaurarCopia(copia), "Copia restaurada")) app.refrescar();
    }
    archivo.value = "";
  });
  poner(vista, tituloSeccion("Copia de seguridad"),
    h("div", { class: "tarjeta caja form" },
      h("p", null, "Todo lo del panel vive solo en este teléfono. Guarda una copia cada semana y mándala a tu correo, a WhatsApp o a Drive. Con ella recuperas todo en otro teléfono."),
      h("p", null, h("b", null, "Última copia: "), dias == null ? "nunca" : dias === 0 ? "hoy" : `hace ${dias} ${dias === 1 ? "día" : "días"}`),
      estadoAlmacen,
      enMarco ? h("div", { class: "aviso-caja" }, icono("alerta", 20), "En esta vista previa no se pueden bajar archivos. En la página publicada en tu dominio sí.") : null,
      enMarco ? null : h("button", { class: "boton verde ancho toca", type: "button", onclick: async () => {
        const texto = JSON.stringify(copiaCompleta());
        const file = new File([texto], nombreArchivo(), { type: "application/json" });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: `Copia del panel de ${NEGOCIO.nombre}` }); await marcar(); avisar("Copia compartida"); return; } catch (e) { if (e?.name === "AbortError") return; }
        }
        descargar(nombreArchivo(), texto);
        await marcar();
        avisar("Copia descargada");
      } }, icono("compartir", 20), "Guardar y enviar copia"),
      enMarco ? null : h("button", { class: "boton ancho toca", type: "button", onclick: async () => { descargar(nombreArchivo(), JSON.stringify(copiaCompleta())); await marcar(); avisar("Copia descargada"); } }, icono("descargar", 20), "Solo descargar"),
      h("button", { class: "boton ancho toca", type: "button", onclick: () => archivo.click() }, icono("subir", 20), "Restaurar una copia"),
      archivo,
      h("p", { class: "ayuda" }, "La copia no incluye la contraseña: al restaurarla en otro teléfono, ese teléfono usa la suya.")));
  protegerAlmacenamiento();
}

/* ───────── Contraseña ───────── */
function pintarClave(vista, app) {
  const actual = h("input", { class: "campo", type: "password", id: "k-actual", autocomplete: "current-password" });
  const nueva = h("input", { class: "campo", type: "password", id: "k-nueva", autocomplete: "new-password" });
  const repite = h("input", { class: "campo", type: "password", id: "k-repite", autocomplete: "new-password" });
  const form = h("form", { class: "tarjeta caja form" },
    h("div", null, h("label", { class: "etiqueta", for: "k-actual" }, "Contraseña actual"), actual),
    h("div", null, h("label", { class: "etiqueta", for: "k-nueva" }, "Contraseña nueva"), nueva),
    h("div", null, h("label", { class: "etiqueta", for: "k-repite" }, "Repite la nueva"), repite),
    h("button", { class: "boton verde ancho toca", type: "submit" }, "Cambiar contraseña"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (nueva.value !== repite.value) { avisar("Las contraseñas nuevas no son iguales"); return; }
    if (await intentar(() => cambiarClave(actual.value, nueva.value), "Contraseña cambiada")) { seccion = null; app.refrescar(); }
  });
  poner(vista, tituloSeccion("Contraseña"), form);
}

/* ───────── Instalar ───────── */
async function instalar(app) {
  if (app.instalar) {
    app.instalar.prompt();
    const r = await app.instalar.userChoice.catch(() => null);
    if (r?.outcome === "accepted") { avisar("Panel instalado"); protegerAlmacenamiento(); }
    return;
  }
  abrirHoja("Instalar en el teléfono", (cuerpo) => {
    poner(cuerpo, h("div", { class: "form" },
      h("p", null, `En Chrome toca el menú de los tres puntos y elige "Instalar app" o "Agregar a la pantalla principal". El panel queda con el ícono de ${NEGOCIO.nombre} y abre aunque no haya internet.`),
      h("p", { class: "ayuda" }, "Si ya está instalado, ábrelo desde el ícono.")));
  });
}
