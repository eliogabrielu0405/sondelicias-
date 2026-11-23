/* Caja registradora: vender en mostrador y cobrar (también lo usan Pedidos y Por cobrar). */
import { poner, reemplazar } from "../comun.js";
import { usd, bs, numero, TIPOS_ENTREGA } from "../comun.js";
import { h, icono, abrirHoja, avisar, campoMonto, intentar, interruptor, confirmar, fotoProducto } from "./ui.js";
import { estado } from "./datos.js";
import { cuentasActivas, tasa, venderEnCaja, productosOrdenados, categoriasOrdenadas, totalDe } from "./negocio.js";
import { ajustesImpresion, imprimir } from "./impresion.js";
import * as C from "./calculos.js";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ───────── Cobro ───────── */
/* total y yaPagado en $. alConfirmar(pagos) recibe [{cuenta, monto}] en la moneda de cada cuenta ([] = cobrar después). */
export function abrirCobro({ titulo = "Cobrar", total, yaPagado = 0, permitirDespues = false, alConfirmar, app, preferida }) {
  const saldo = r2(total - yaPagado);
  abrirHoja(titulo, (cuerpo, cerrar) => {
    const pintar = () => {
      const t = tasa();
      const enMoneda = (c, montoUsd) => (c.moneda === "VES" ? (t ? bs(montoUsd * t.valor) : "falta la tasa") : usd(montoUsd));
      const terminar = async (pagos) => {
        if (await intentar(() => alConfirmar(pagos))) cerrar();
      };
      const pagarTodo = (c) => {
        if (c.moneda === "VES" && !t) { app?.pedirTasa(pintar); return; }
        terminar([{ cuenta: c.id, monto: c.moneda === "VES" ? r2(saldo * t.valor) : saldo }]);
      };

      // Dividir el pago entre varias formas
      const filas = cuentasActivas().map((c) => {
        const m = campoMonto({ id: `div-${c.id}`, moneda: c.moneda, alCambiar: () => calcularResta() });
        m.nodo.querySelector(".ayuda")?.remove();
        return { c, m };
      });
      const resta = h("p", { class: "resta num" });
      function sumaUsd() {
        let s = 0;
        for (const { c, m } of filas) {
          const v = m.valor() || 0;
          if (!v) continue;
          if (c.moneda === "VES") { if (!t) return null; s += v / t.valor; } else s += v;
        }
        return r2(s);
      }
      function calcularResta() {
        const s = sumaUsd();
        if (s == null) { resta.textContent = "Pon la tasa del día para cobrar en bolívares."; return; }
        const r = r2(saldo - s);
        resta.textContent = r > 0.004 ? `Falta: ${usd(r)}${t ? ` (${bs(r * t.valor)})` : ""}` : r < -0.004 ? `Te pasaste por ${usd(-r)}` : "Cuadra exacto";
      }
      queueMicrotask(calcularResta);

      // Vuelto en efectivo
      const recibido = campoMonto({ id: "recibido", etiqueta: "¿Con cuánto paga? (en $)", alCambiar: (v) => {
        vuelto.textContent = v > saldo ? `Vuelto: ${usd(v - saldo)}${t ? ` o ${bs((v - saldo) * t.valor)}` : ""}` : "";
      } });
      const vuelto = h("p", { class: "resta num", "aria-live": "polite" });

      reemplazar(cuerpo, 
        h("div", { class: "cobro-total" },
          h("div", null, h("b", null, yaPagado > 0 ? "Falta por cobrar" : "Total"),
            t ? h("p", { class: "ayuda num" }, `${bs(saldo * t.valor)} a tasa ${numero(t.valor)}`) : h("p", { class: "ayuda" }, "Sin tasa del día")),
          h("strong", { class: "num" }, usd(saldo))),
        !t ? h("div", { class: "aviso-caja", style: { marginTop: "12px" } }, icono("alerta", 20),
          h("div", null, "Para cobrar en bolívares pon la tasa de hoy.",
            h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => app?.pedirTasa(pintar) }, "Poner tasa"))) : null,
        h("p", { class: "etiqueta", style: { margin: "16px 0 8px" } }, "Pagó todo con:"),
        h("div", { class: "formas" }, [...cuentasActivas()].sort((a, b) => (b.id === preferida) - (a.id === preferida)).map((c) =>
          h("button", { class: `forma toca ${c.id === preferida ? "preferida" : ""}`, type: "button", onclick: () => pagarTodo(c) },
            h("span", null, c.nombre, c.id === preferida ? h("em", { class: "eligio" }, "Eligió el cliente") : null),
            h("small", { class: "num" }, enMoneda(c, saldo))))),
        h("details", { style: { marginTop: "14px" } },
          h("summary", { class: "etiqueta", style: { minHeight: "44px", display: "flex", alignItems: "center", cursor: "pointer" } }, "Dividir el pago entre varias formas"),
          h("div", { class: "division", style: { marginTop: "8px" } },
            filas.map(({ c, m }) => h("div", { class: "division-fila" }, h("label", { for: `div-${c.id}`, style: { fontWeight: 700 } }, `${c.nombre} (${c.moneda === "VES" ? "Bs" : "$"})`), m.entrada)),
            resta,
            h("button", { class: "boton verde ancho toca", type: "button", onclick: async () => {
              const s = sumaUsd();
              if (s == null) { app?.pedirTasa(pintar); return; }
              if (s <= 0) { avisar("Escribe cuánto pagó en cada forma"); return; }
              if (s - saldo > 0.02) { avisar("No se puede cobrar más de lo que falta"); return; }
              if (saldo - s > 0.004 && !(await confirmar("Queda debiendo", `Faltan ${usd(saldo - s)}. Quedará en Por cobrar.`, { boton: "Registrar así" }))) return;
              terminar(filas.map(({ c, m }) => ({ cuenta: c.id, monto: m.valor() || 0 })).filter((p) => p.monto > 0));
            } }, icono("check", 20), "Registrar cobro"))),
        h("details", { style: { marginTop: "6px" } },
          h("summary", { class: "etiqueta", style: { minHeight: "44px", display: "flex", alignItems: "center", cursor: "pointer" } }, "Calcular vuelto"),
          h("div", { class: "form", style: { marginTop: "8px" } }, recibido.nodo, vuelto)),
        permitirDespues ? h("button", { class: "boton ancho toca", type: "button", style: { marginTop: "14px" }, onclick: () => terminar([]) }, "Cobrar después (queda en Por cobrar)") : null,
      );
    };
    pintar();
  });
}

/* ───────── Ticket de la caja (se conserva al cambiar de pestaña) ───────── */
const LLAVE = "sd-ticket";
const ticket = (() => {
  try {
    const t = JSON.parse(sessionStorage.getItem(LLAVE));
    if (t && Array.isArray(t.lineas)) return t;
  } catch { /* nada */ }
  return { lineas: [], cliente: "", tipo: "Para llevar", nota: "", cocina: true };
})();
const guardarTicket = () => { try { sessionStorage.setItem(LLAVE, JSON.stringify(ticket)); } catch { /* nada */ } };
const cuentaTicket = () => ticket.lineas.reduce((s, l) => s + l.cant, 0);

function agregar(p, opcion, delta = 1) {
  const i = ticket.lineas.findIndex((l) => l.pid === p.pid && l.opcion === (opcion || ""));
  if (i >= 0) {
    ticket.lineas[i].cant = Math.max(0, Math.min(99, ticket.lineas[i].cant + delta));
    if (!ticket.lineas[i].cant) ticket.lineas.splice(i, 1);
  } else if (delta > 0) {
    ticket.lineas.push({ pid: p.pid, nombre: p.nombre, opcion: opcion || "", cant: delta, precio: p.precio });
  }
  guardarTicket();
}

let filtro = { texto: "", cat: "" };

export function pintar(vista, app) {
  const r = C.resumen(estado, C.hoy(), C.hoy());
  const grid = h("div", { class: "pos-grid" });
  const productos = productosOrdenados();
  const enTicket = (pid) => ticket.lineas.filter((l) => l.pid === pid).reduce((s, l) => s + l.cant, 0);

  const barra = h("button", { class: "barra-ticket toca", type: "button", onclick: () => abrirTicket(app, refrescar) });
  const emojis = new Map(categoriasOrdenadas().map((c) => [c.id, c.emoji]));

  /* Cada ficha se arma una sola vez y se reutiliza: así las fotos no parpadean al tocar */
  const fichas = new Map();
  function ficha(p) {
    let f = fichas.get(p.id);
    if (!f) {
      const cuantos = h("em", { class: "cuantos num", "aria-hidden": "true", hidden: true });
      const boton = h("button", {
        class: `pos-producto toca ${p.disponible === false ? "agotado" : ""}`, type: "button",
        onclick: () => {
          const linea = { pid: p.id, nombre: p.nombre, precio: p.precio };
          if (p.opciones?.length) elegirOpcion(p, (op) => { agregar(linea, op); refrescar(); });
          else { agregar(linea, ""); refrescar(); }
        },
      },
      fotoProducto(p, { clase: "pos-foto", sizes: "(min-width: 900px) 220px, (min-width: 600px) 33vw, 50vw", emoji: emojis.get(p.cat) }),
      h("span", { class: "pos-texto" },
        h("b", null, p.nombre),
        h("span", { class: "pos-precio num" }, p.disponible === false ? "Agotado" : usd(p.precio))),
      cuantos);
      f = { boton, cuantos };
      fichas.set(p.id, f);
    }
    const n = enTicket(p.id);
    f.cuantos.hidden = !n;
    f.cuantos.textContent = String(n);
    f.boton.setAttribute("aria-label", `${p.nombre}, ${usd(p.precio)}${n ? `, ${n} en el ticket` : ""}${p.disponible === false ? ", agotado" : ""}`);
    return f.boton;
  }

  function refrescar() {
    const q = filtro.texto.trim().toLowerCase();
    reemplazar(grid, ...productos
      .filter((p) => (!filtro.cat || p.cat === filtro.cat) && (!q || p.nombre.toLowerCase().includes(q)))
      .map(ficha));
    const n = cuentaTicket();
    barra.hidden = n === 0;
    reemplazar(barra, h("span", { style: { display: "inline-flex", gap: "8px", alignItems: "center" } }, icono("recibo", 22), `Ticket (${n})`), h("span", { class: "num" }, usd(totalDe(ticket.lineas))));
  }

  const buscador = h("input", { class: "campo", type: "search", placeholder: "Buscar producto", value: filtro.texto, "aria-label": "Buscar producto" });
  buscador.addEventListener("input", () => { filtro.texto = buscador.value; refrescar(); });
  const chips = h("div", { class: "chips" }, [["", "Todo"], ...categoriasOrdenadas().map((c) => [c.id, `${c.emoji || ""} ${c.nombre}`.trim()])].map(([id, texto]) =>
    h("button", { class: "chip toca", type: "button", "aria-pressed": String(filtro.cat === id), onclick: (e) => {
      filtro.cat = id;
      chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      refrescar();
    } }, texto)));

  poner(vista, 
    h("div", { class: "titulo-seccion" }, h("h2", null, "Caja"),
      h("button", { class: "boton chico toca", type: "button", onclick: () => app.ir("mas", { abrir: "cierre" }) }, "Cierre del día")),
    h("p", { class: "sobre-vino num", style: { margin: "-6px 2px 12px" } }, `Hoy: ${usd(r.ingresos)} en ${r.n} ${r.n === 1 ? "venta" : "ventas"}`),
    h("div", { class: "pos" }, h("div", { class: "pos-busqueda" }, icono("buscar", 20), buscador), chips, grid),
    barra,
  );
  refrescar();
}

function elegirOpcion(p, alElegir) {
  abrirHoja(p.nombre, (cuerpo, cerrar) => {
    poner(cuerpo, h("div", { class: "formas" }, p.opciones.map((op) =>
      h("button", { class: "forma toca", type: "button", onclick: () => { alElegir(op); cerrar(); } }, h("span", null, op), icono("mas", 20)))));
  });
}

function abrirTicket(app, alCambiar) {
  abrirHoja("Ticket", (cuerpo, cerrar) => {
    const pintar = () => {
      const total = totalDe(ticket.lineas);
      if (!ticket.lineas.length) { cerrar(); return; }
      const nombre = h("input", { class: "campo", id: "t-cliente", value: ticket.cliente, maxLength: 60, placeholder: "Opcional" });
      nombre.addEventListener("input", () => { ticket.cliente = nombre.value; guardarTicket(); });
      const nota = h("input", { class: "campo", id: "t-nota", value: ticket.nota, maxLength: 200, placeholder: "Ej: sin cebolla" });
      nota.addEventListener("input", () => { ticket.nota = nota.value; guardarTicket(); });
      const lineaNombre = (l) => (l.opcion ? `${l.nombre} (${l.opcion})` : l.nombre);

      const aj = ajustesImpresion();
      const vender = async (pagos) => {
        const v = await venderEnCaja({
          items: ticket.lineas.map((l) => ({ ...l })), cliente: ticket.cliente, tipo: ticket.tipo, nota: ticket.nota, pagos, cocina: ticket.cocina,
          factura: aj.facturas ? ticket.factura : "",
        });
        Object.assign(ticket, { lineas: [], cliente: "", nota: "", factura: "" });
        guardarTicket();
        cerrar();
        alCambiar();
        app.refrescar();
        const debe = C.saldo(v);
        avisar(debe > 0.004 ? `Venta #${v.num} guardada. Debe ${usd(debe)}` : `Venta #${v.num} cobrada`);
        if (v.fase === "cocina" && aj.comandaAuto) imprimir("comanda", v);
      };
      const factura = h("input", { class: "campo num", id: "t-factura", inputmode: "numeric", autocomplete: "off", value: ticket.factura || "", maxLength: 20, placeholder: "Opcional" });
      factura.addEventListener("input", () => { ticket.factura = factura.value; guardarTicket(); });

      reemplazar(cuerpo, 
        h("ul", { class: "ticket-lineas" }, ticket.lineas.map((l) => h("li", null,
          h("div", { class: "fila-texto" }, h("b", null, lineaNombre(l)), h("span", { class: "num" }, usd(l.cant * l.precio))),
          h("div", { class: "cantidad" },
            h("button", { class: "redondo toca", type: "button", "aria-label": `Quitar uno de ${lineaNombre(l)}`, onclick: () => { agregar(l, l.opcion, -1); alCambiar(); pintar(); } }, icono("menos", 18)),
            h("output", { class: "num" }, String(l.cant)),
            h("button", { class: "redondo toca", type: "button", "aria-label": `Agregar otro de ${lineaNombre(l)}`, onclick: () => { agregar(l, l.opcion, 1); alCambiar(); pintar(); } }, icono("mas", 18))),
        ))),
        h("div", { class: "form", style: { marginTop: "14px" } },
          h("div", null, h("label", { class: "etiqueta", for: "t-cliente" }, "Cliente"), nombre),
          h("div", null, h("p", { class: "etiqueta" }, "Tipo"), h("div", { class: "chips" }, Object.values(TIPOS_ENTREGA).map((t) =>
            h("button", { class: "chip toca", type: "button", "aria-pressed": String(ticket.tipo === t), onclick: () => { ticket.tipo = t; guardarTicket(); pintar(); } }, t)))),
          h("div", null, h("label", { class: "etiqueta", for: "t-nota" }, "Nota para la cocina"), nota),
          aj.facturas ? h("div", null, h("label", { class: "etiqueta", for: "t-factura" }, "N° de factura fiscal"), factura) : null,
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
            h("span", { class: "etiqueta", style: { margin: 0 } }, "Enviar a cocina"),
            interruptor(ticket.cocina, (v) => { ticket.cocina = v; guardarTicket(); }, "Enviar a cocina")),
          h("div", { class: "cobro-total" }, h("b", null, "Total"), h("strong", { class: "num" }, usd(total))),
          h("button", { class: "boton verde ancho toca", type: "button", style: { minHeight: "56px" }, onclick: () => abrirCobro({
            titulo: "Cobrar venta", total, app,
            permitirDespues: true,
            alConfirmar: async (pagos) => {
              if (!pagos.length && !ticket.cliente.trim()) throw new Error("No se puede cobrar después sin el nombre del cliente. Escríbelo en el ticket.");
              await vender(pagos);
            },
          }) }, icono("billetera", 20), `Cobrar ${usd(total)}`),
          h("button", { class: "boton ancho toca", type: "button", onclick: async () => {
            if (await confirmar("Vaciar ticket", "Se quitan todos los productos del ticket.", { boton: "Vaciar", peligro: true })) {
              ticket.lineas = [];
              guardarTicket();
              alCambiar();
              cerrar();
            }
          } }, icono("basura", 20), "Vaciar ticket"),
        ),
      );
    };
    pintar();
  });
}
