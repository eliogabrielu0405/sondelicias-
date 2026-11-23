/* Impresión: comanda para la cocina y ticket para el cliente. Los dos son documentos NO fiscales:
   la factura sale de la máquina fiscal (o del medio de facturación que autorice el SENIAT).
   Se imprime con la ventana normal del navegador, así sirve con impresoras térmicas de 58 u 80 mm
   (en Android con RawBT u otra app que agregue la impresora) y con cualquier impresora de computadora. */
import { reemplazar } from "../comun.js";
import { usd, bs, numero, enMarco, TIPOS_ENTREGA } from "../comun.js";
import { NEGOCIO } from "../../menu.js";
import { h, icono, abrirHoja, avisar, segmento, intentar } from "./ui.js";
import { estado, config, ponerConfig } from "./datos.js";
import { nombreCuenta, cuentaPorId, tasa, pagoElegido, guardarFactura } from "./negocio.js";
import * as C from "./calculos.js";

/* ───────── Ajustes ───────── */
export const ajustesImpresion = () => ({ ancho: 58, comandaAuto: false, facturas: false, ...(config("impresion", null) || {}) });
export const cambiarImpresion = (cambios) => ponerConfig("impresion", { ...ajustesImpresion(), ...cambios });

/* ───────── Armar los documentos ───────── */
const esAdicionalDe = (it) => typeof it.opcion === "string" && it.opcion.startsWith("para ");

/* Cada adicional ("para Hamburguesa…") queda debajo del producto al que va, como lo pidió el cliente */
export function lineasAgrupadas(items = []) {
  const grupos = [];
  for (const it of items) {
    if (esAdicionalDe(it) && grupos.length) grupos[grupos.length - 1].extras.push(it);
    else grupos.push({ ...it, extras: [] });
  }
  return grupos;
}

/* "+ Tocineta c/u" si hay 2 hamburguesas con una tocineta cada una; "+ 2 Tocineta" si es una con dos */
function textoAdicional(ex, cantProducto) {
  if (cantProducto > 1 && ex.cant % cantProducto === 0) {
    const c = ex.cant / cantProducto;
    return `+ ${c > 1 ? `${c} ` : ""}${ex.nombre} c/u`;
  }
  return `+ ${ex.cant > 1 ? `${ex.cant} ` : ""}${ex.nombre}`;
}

const fechaTicket = (ms) => new Date(ms).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
const horaTicket = (ms) => new Date(ms).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
const numeroVenta = (v) => (v.num ? `#${v.num}` : "PRUEBA");
const fila = (izq, der, clase = "") => h("div", { class: `t-fila ${clase}`.trim() }, h("span", null, izq), h("span", null, der));
const esDelivery = (v) => v.tipo === TIPOS_ENTREGA.D;
const origen = (v) => (v.origen === "web" ? "WhatsApp" : "Caja");

function comanda(v, aj) {
  const grupos = lineasAgrupadas(v.items);
  const unidades = grupos.reduce((s, g) => s + g.cant, 0);
  return h("section", { class: `ticket-imp ancho-${aj.ancho}` },
    h("p", { class: "t-centro t-chico" }, `${NEGOCIO.nombre} · COMANDA`),
    h("p", { class: "t-centro t-titulo" }, numeroVenta(v)),
    h("p", { class: "t-tipo" }, v.tipo || TIPOS_ENTREGA.L),
    h("p", { class: "t-cliente" }, v.cliente),
    h("p", { class: "t-chico" }, `${horaTicket(v.confirmada || v.creado)} · ${origen(v)}`),
    esDelivery(v) && v.direccion ? h("p", { class: "t-chico" }, h("b", null, "Dirección: "), v.direccion) : null,
    h("hr"),
    grupos.map((g) => h("div", { class: "t-linea" },
      h("p", { class: "t-item" }, `${g.cant}× ${g.nombre}`),
      g.opcion ? h("p", { class: "t-sub t-opcion" }, g.opcion) : null,
      g.extras.map((ex) => h("p", { class: "t-sub" }, textoAdicional(ex, g.cant))))),
    v.nota ? h("p", { class: "t-nota" }, "NOTA: ", v.nota) : null,
    h("hr"),
    h("p", { class: "t-centro t-chico" }, `${unidades} ${unidades === 1 ? "producto" : "productos"} · Documento no fiscal`),
  );
}

function ticket(v, aj) {
  const grupos = lineasAgrupadas(v.items);
  const t = v.tasa || tasa()?.valor || null;
  const pagos = v.pagos || [];
  const pagado = C.pagado(v);
  const debe = v.estado === "confirmada" ? C.saldo(v) : 0;
  const elegido = pagoElegido(v.pago);
  return h("section", { class: `ticket-imp ancho-${aj.ancho}` },
    v.estado === "anulada" ? h("p", { class: "t-tipo" }, "VENTA ANULADA") : null,
    h("p", { class: "t-centro t-negocio" }, NEGOCIO.nombre),
    h("p", { class: "t-centro t-chico" }, NEGOCIO.ciudad),
    h("p", { class: "t-centro t-chico" }, `WhatsApp ${NEGOCIO.telefono}`),
    NEGOCIO.instagram ? h("p", { class: "t-centro t-chico" }, `Instagram @${NEGOCIO.instagram}`) : null,
    h("hr"),
    fila(h("b", null, `Pedido ${numeroVenta(v)}`), fechaTicket(v.confirmada || v.creado), "t-chico"),
    h("p", null, `Cliente: ${v.cliente}`),
    h("p", { class: "t-chico" }, `${v.tipo || TIPOS_ENTREGA.L} · ${origen(v)}`),
    esDelivery(v) && v.direccion ? h("p", { class: "t-chico" }, `Dirección: ${v.direccion}`) : null,
    h("hr"),
    grupos.map((g) => [
      fila(`${g.cant}× ${g.nombre}${g.opcion ? ` (${g.opcion})` : ""}`, usd(g.cant * g.precio)),
      g.extras.map((ex) => fila(`+ ${ex.cant > 1 ? `${ex.cant} ` : ""}${ex.nombre}`, usd(ex.cant * ex.precio), "t-sub")),
    ]),
    h("hr"),
    fila("TOTAL", usd(v.total), "t-total"),
    t ? fila(`Tasa ${numero(t)}`, bs(v.total * t), "t-chico") : null,
    pagos.length ? h("div", { class: "t-pagos" }, pagos.map((p) =>
      fila(nombreCuenta(p.cuenta), cuentaPorId(p.cuenta)?.moneda === "VES" ? bs(p.bs) : usd(p.usd), "t-chico"))) : null,
    !pagos.length && elegido ? h("p", { class: "t-chico" }, `Paga con ${elegido.nombre}`) : null,
    debe > 0.004 && pagado > 0.004 ? fila("Falta por pagar", usd(debe), "t-total") : null,
    v.factura ? h("p", { class: "t-centro t-factura" }, `Factura fiscal N° ${v.factura}`) : null,
    h("hr"),
    h("p", { class: "t-centro t-nofiscal" }, "DOCUMENTO NO FISCAL"),
    h("p", { class: "t-centro t-chico" }, "No válido como factura"),
    h("p", { class: "t-centro t-gracias" }, "¡Gracias por preferirnos!"),
  );
}

export const documento = (tipo, venta, aj = ajustesImpresion()) => (tipo === "ticket" ? ticket(venta, aj) : comanda(venta, aj));

/* ───────── Imprimir ─────────
   Se pone el documento en #impresion y la hoja de estilo de impresión esconde todo lo demás.
   Si alguien imprime otra cosa (Ctrl+P, el reporte de Finanzas), no sale el último ticket. */
let imprimiendoNuestro = false;
window.addEventListener("beforeprint", () => { if (!imprimiendoNuestro) document.body.classList.remove("imprimiendo"); });

export function imprimir(tipos, venta) {
  if (enMarco) { avisar("Aquí es solo una vista previa. Para imprimir, abre el panel en su página."); return false; }
  const aj = ajustesImpresion();
  const lista = [].concat(tipos);
  let caja = document.getElementById("impresion");
  if (!caja) { caja = h("div", { id: "impresion", "aria-hidden": "true" }); document.body.append(caja); }
  reemplazar(caja, ...lista.map((t, i) => {
    const doc = documento(t, venta, aj);
    if (i < lista.length - 1) doc.classList.add("t-corte");
    return doc;
  }));
  document.body.classList.add("imprimiendo");
  const terminar = () => { imprimiendoNuestro = false; document.body.classList.remove("imprimiendo"); };
  window.addEventListener("afterprint", () => setTimeout(terminar, 500), { once: true });
  imprimiendoNuestro = true;
  try {
    window.print();
  } catch {
    terminar();
    avisar("Este navegador no dejó imprimir.");
    return false;
  }
  return true;
}

/* Vista previa con Comanda | Ticket y el botón de imprimir */
export function abrirImpresion(v, { tipo = "comanda", app } = {}) {
  let actual = tipo;
  abrirHoja(v.num ? `Imprimir #${v.num}` : "Prueba de impresión", (cuerpo, cerrar) => {
    const pintar = () => {
      const aj = ajustesImpresion();
      reemplazar(cuerpo,
        segmento([["comanda", "Comanda"], ["ticket", "Ticket del cliente"]], actual, (id) => { actual = id; pintar(); }, "Qué imprimir"),
        h("p", { class: "ayuda", style: { margin: "8px 2px 0" } }, actual === "comanda"
          ? "Para la cocina: sin precios y con letra grande."
          : "Para el cliente, con precios. No sustituye la factura fiscal."),
        h("div", { class: "papel-vista" }, documento(actual, v, aj)),
        h("button", { class: "boton verde ancho toca", type: "button", onclick: () => imprimir(actual, v) },
          icono("imprimir", 20), actual === "comanda" ? "Imprimir comanda" : "Imprimir ticket"),
        app ? h("button", { class: "boton ancho toca", type: "button", style: { marginTop: "8px" }, onclick: () => { cerrar(); app.ir("mas", { abrir: "impresion" }); } },
          icono("ajustes", 20), `Papel de ${aj.ancho} mm · Ajustes`) : null,
      );
    };
    pintar();
  });
}

/* Venta de ejemplo para probar la impresora */
export function ventaDePrueba() {
  const ahora = Date.now();
  const items = [
    { pid: "h3", nombre: "Hamburguesa Normal", opcion: "Pollo", cant: 2, precio: 5.5 },
    { pid: "a1", nombre: "Tocineta", opcion: "para Hamburguesa Normal (Pollo)", cant: 2, precio: 0.9 },
    { pid: "r3", nombre: "Ración de tequeños", opcion: "", cant: 1, precio: 4 },
  ];
  return {
    id: "prueba", num: 0, cliente: "Prueba de impresión", tipo: TIPOS_ENTREGA.L, origen: "caja", estado: "confirmada",
    creado: ahora, confirmada: ahora, items, total: 16.8, pagos: [], nota: "Esto es una prueba",
  };
}

/* ───────── Factura fiscal ─────────
   El panel no emite facturas fiscales. Si se activa en Más → Impresora y factura, se anota el número
   de la factura que sacó la máquina fiscal en cada venta, para cuadrar el día. */
export function botonFactura(v, app, { alGuardar } = {}) {
  return h("button", { class: `boton chico toca ${v.factura ? "" : "factura-falta"}`.trim(), type: "button", onclick: () => editarFactura(v, app, { alGuardar }) },
    icono("recibo", 18), v.factura ? `Factura N° ${v.factura}` : "Anotar factura");
}

export function editarFactura(v, app, { alGuardar } = {}) {
  abrirHoja(`Factura fiscal · #${v.num}`, (cuerpo, cerrar) => {
    const entrada = h("input", { class: "campo num", id: "f-numero", inputmode: "numeric", autocomplete: "off", maxLength: 20, value: v.factura || "", placeholder: "Ej: 00012345", autofocus: true });
    const guardarla = async (numero) => {
      let n = "";
      if (await intentar(async () => { n = await guardarFactura(v, numero); }, numero ? undefined : "Número de factura quitado")) {
        if (n) avisar(`Factura N° ${n} anotada en la venta #${v.num}`);
        cerrar();
        alGuardar?.(n);
        app?.refrescar();
      }
    };
    const form = h("form", { class: "form" },
      h("p", null, `${v.cliente} · ${usd(v.total)}`),
      h("div", null, h("label", { class: "etiqueta", for: "f-numero" }, "Número de la factura de la máquina fiscal"), entrada,
        h("p", { class: "ayuda" }, "Sirve para cuadrar el panel con el Reporte Z al final del día.")),
      h("button", { class: "boton verde ancho toca", type: "submit" }, icono("check", 20), "Guardar número"),
      v.factura ? h("button", { class: "boton ancho toca", type: "button", onclick: () => guardarla("") }, "Quitar el número") : null);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!entrada.value.trim()) { avisar("Escribe el número de la factura"); return; }
      guardarla(entrada.value);
    });
    reemplazar(cuerpo, form);
  });
}

/* Ventas confirmadas de un día que todavía no tienen número de factura */
export const ventasSinFactura = (dia) => estado.ventas.filter((v) => v.estado === "confirmada" && v.dia === dia && !v.factura);
