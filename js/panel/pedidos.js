/* Pedidos que llegan por WhatsApp (desde el enlace del mensaje) y su paso por la cocina. */
import { poner, reemplazar } from "../comun.js";
import { usd, enMarco } from "../comun.js";
import { h, icono, abrirHoja, avisar, intentar, confirmar, haceCuanto, tituloSeccion } from "./ui.js";
import { estado } from "./datos.js";
import { confirmarPedido, cancelarPedido, cambiarFase, registrarCobro, avisosPedido, pagoElegido } from "./negocio.js";
import { abrirCobro } from "./caja.js";
import { ajustesImpresion, imprimir, abrirImpresion, botonFactura } from "./impresion.js";
import * as C from "./calculos.js";

const ETAPAS = {
  pendiente: { texto: "Nuevo", clase: "nuevo" },
  cocina: { texto: "En cocina", clase: "cocina" },
  lista: { texto: "Listo", clase: "lista" },
  entregada: { texto: "Entregado", clase: "" },
};

const nombreLinea = (it) => (it.opcion?.startsWith("para ") ? `+ ${it.nombre} (${it.opcion})` : it.opcion ? `${it.nombre} (${it.opcion})` : it.nombre);

export function tarjetaVenta(v, app, { resaltada } = {}) {
  const etapa = v.estado === "pendiente" ? ETAPAS.pendiente : ETAPAS[v.fase] || ETAPAS.entregada;
  const debe = v.estado === "confirmada" ? C.saldo(v) : 0;
  const avisos = v.estado === "pendiente" ? avisosPedido(v) : [];
  const accion = (texto, fn, clase = "") => h("button", { class: `boton chico toca ${clase}`, type: "button", onclick: fn }, texto);
  const pago = pagoElegido(v.pago);
  const cobrar = () => abrirCobro({
    titulo: `Cobrar #${v.num}`, total: v.total, yaPagado: C.pagado(v), app, preferida: pago?.cuenta,
    alConfirmar: async (pagos) => { await registrarCobro(v, pagos); app.refrescar(); avisar(`Cobro de ${v.cliente} registrado`); },
  });

  const botones = [];
  if (v.estado === "pendiente") {
    botones.push(accion("Aceptar y enviar a cocina", async () => {
      let confirmada = null;
      if (await intentar(async () => { confirmada = await confirmarPedido(v, { fase: "cocina" }); }, `Pedido #${v.num} en cocina`)) {
        app.refrescar();
        if (confirmada && ajustesImpresion().comandaAuto) imprimir("comanda", confirmada);
      }
    }, "verde"));
    botones.push(accion("Cancelar", async () => {
      if (await confirmar("Cancelar pedido", `El pedido de ${v.cliente} no se va a preparar ni a contar como venta.`, { boton: "Cancelar pedido", peligro: true })) {
        if (await intentar(() => cancelarPedido(v), "Pedido cancelado")) app.refrescar();
      }
    }));
  } else if (v.estado === "confirmada") {
    if (v.fase === "cocina") botones.push(accion("Marcar listo", async () => { if (await intentar(() => cambiarFase(v, "lista"))) app.refrescar(); }, "mostaza"));
    if (v.fase === "lista") botones.push(accion("Marcar entregado", async () => { if (await intentar(() => cambiarFase(v, "entregada"))) app.refrescar(); }, "mostaza"));
    if (debe > 0.004) botones.push(accion(`Cobrar ${usd(debe)}`, cobrar, "verde"));
    botones.push(h("button", { class: "boton chico toca", type: "button", onclick: () => abrirImpresion(v, { app }) }, icono("imprimir", 18), "Imprimir"));
    if (ajustesImpresion().facturas) botones.push(botonFactura(v, app));
  }

  return h("article", { class: "tarjeta caja pedido-tarjeta", id: `venta-${v.id}`, style: resaltada ? { boxShadow: "0 0 0 3px var(--mostaza), 0 10px 26px rgba(58, 7, 9, 0.16)" } : null },
    h("div", { class: "pedido-cabeza" },
      h("div", null,
        h("h3", null, `#${v.num} ${v.cliente}`),
        h("p", { class: "pedido-meta" }, [v.tipo, v.origen === "web" ? "WhatsApp" : "Caja", haceCuanto(v.creado), v.codigo ? `código ${v.codigo}` : ""].filter(Boolean).join(", "))),
      h("span", { class: `estado ${etapa.clase}` }, etapa.texto)),
    v.direccion ? h("p", null, h("b", null, "Dirección: "), v.direccion) : null,
    pago ? h("p", { class: "pedido-pago" }, h("span", { "aria-hidden": "true" }, pago.emoji || ""), "Paga con ", h("b", null, pago.nombre)) : null,
    h("ul", { class: "pedido-items" }, v.items.map((it) =>
      h("li", null, h("span", null, h("b", { class: "num" }, `${it.cant}×`), nombreLinea(it)), h("span", { class: "num" }, usd(it.cant * it.precio))))),
    v.nota ? h("p", { class: "nota-cocina" }, h("b", null, "Nota: "), v.nota) : null,
    ...avisos.map((a) => h("div", { class: "aviso-caja" }, icono("alerta", 18), a)),
    h("div", { class: "pedido-total" },
      h("span", null, debe > 0.004 && C.pagado(v) > 0 ? `Pagado ${usd(C.pagado(v))}, debe ${usd(debe)}` : v.estado === "confirmada" && debe <= 0.004 ? "Pagado" : "Total"),
      h("strong", { class: "num" }, usd(v.total))),
    botones.length ? h("div", { class: "acciones" }, botones) : null,
  );
}

function pegarPedido(app) {
  abrirHoja("Cargar pedido de WhatsApp", (cuerpo, cerrar) => {
    const texto = h("textarea", { class: "campo", id: "pegar", rows: 6, placeholder: "Pega aquí el mensaje completo del cliente (con el enlace del final)" });
    const cargarTexto = async (t) => {
      if (await app.cargarTexto(t)) cerrar();
      else avisar("No encontré un pedido en ese texto. Copia el mensaje completo, con el enlace del final.");
    };
    poner(cuerpo, h("div", { class: "form" },
      h("p", null, "Lo normal es tocar el enlace que trae el mensaje del cliente. Si no abre aquí, copia el mensaje completo y pégalo."),
      h("label", { class: "etiqueta", for: "pegar" }, "Mensaje del cliente"), texto,
      navigator.clipboard?.readText && !enMarco ? h("button", { class: "boton toca", type: "button", onclick: async () => {
        try { texto.value = await navigator.clipboard.readText(); } catch { avisar("El teléfono no dejó leer lo copiado. Pégalo a mano."); }
      } }, icono("portapapeles", 20), "Pegar lo copiado") : null,
      h("button", { class: "boton verde ancho toca", type: "button", onclick: () => cargarTexto(texto.value) }, "Cargar pedido")));
  });
}

export function pintar(vista, app, { resaltar } = {}) {
  const ventas = estado.ventas;
  const nuevos = ventas.filter((v) => v.estado === "pendiente").sort((a, b) => a.creado - b.creado);
  const cocina = ventas.filter((v) => v.estado === "confirmada" && v.fase === "cocina").sort((a, b) => a.confirmada - b.confirmada);
  const listos = ventas.filter((v) => v.estado === "confirmada" && v.fase === "lista").sort((a, b) => a.confirmada - b.confirmada);
  const hoy = C.hoy();
  const sinCobrar = ventas.filter((v) => v.estado === "confirmada" && v.fase === "entregada" && v.dia === hoy && C.saldo(v) > 0.004);

  poner(vista, tituloSeccion("Pedidos", h("button", { class: "boton chico toca", type: "button", onclick: () => pegarPedido(app) }, icono("portapapeles", 18), "Pegar pedido")));

  const grupo = (titulo, lista) => lista.length
    ? [h("h3", { class: "subtitulo" }, `${titulo} (${lista.length})`), h("div", { class: "pila" }, lista.map((v) => tarjetaVenta(v, app, { resaltada: v.id === resaltar })))]
    : [];

  if (!nuevos.length && !cocina.length && !listos.length && !sinCobrar.length) {
    poner(vista, h("div", { class: "vacio" },
      h("p", null, "No hay pedidos activos."),
      h("p", { style: { fontSize: "14px" } }, "Cuando un cliente te escriba desde la página, toca el enlace que viene al final de su mensaje y el pedido aparece aquí. Las ventas del local se hacen en Caja."),
      h("button", { class: "boton mostaza toca", type: "button", onclick: () => app.ir("caja") }, icono("caja", 20), "Ir a la caja")));
  }
  poner(vista, ...grupo("Nuevos", nuevos), ...grupo("En cocina", cocina), ...grupo("Listos para entregar", listos), ...grupo("Entregados hoy sin cobrar", sinCobrar));

  if (resaltar) requestAnimationFrame(() => document.getElementById(`venta-${resaltar}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
}
