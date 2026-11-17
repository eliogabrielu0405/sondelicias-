/* Piezas de pantalla del panel */
import { poner, reemplazar } from "../comun.js";
import { h, icono, abrirHoja, avisar, usd, bs, leerMonto, numero } from "../comun.js";

export { h, icono, abrirHoja, avisar };

export const hora = (ms) => new Date(ms).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
export const fechaHora = (ms) => new Date(ms).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const haceCuanto = (ms) => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  return horas < 24 ? `hace ${horas} h` : fechaHora(ms);
};

/* Pregunta antes de algo que no se puede deshacer. Devuelve true o false. */
export function confirmar(titulo, texto, { boton = "Sí, continuar", peligro = false } = {}) {
  return new Promise((resolver) => {
    let respuesta = false;
    abrirHoja(titulo, (cuerpo, cerrar) => {
      poner(cuerpo, 
        h("p", { style: { fontSize: "16px" } }, texto),
        h("div", { class: "botones-fila", style: { marginTop: "18px" } },
          h("button", { class: "boton toca", type: "button", onclick: cerrar }, "Volver"),
          h("button", { class: `boton toca ${peligro ? "rojo" : "verde"}`, type: "button", onclick: () => { respuesta = true; cerrar(); } }, boton),
        ),
      );
    }, { alCerrar: () => resolver(respuesta) });
  });
}

/* Interruptor sí/no */
export function interruptor(activo, alCambiar, etiqueta) {
  const b = h("button", { class: "interruptor", type: "button", role: "switch", "aria-checked": String(activo), "aria-label": etiqueta },
    h("span", { class: "perilla" }));
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const nuevo = b.getAttribute("aria-checked") !== "true";
    b.setAttribute("aria-checked", String(nuevo));
    alCambiar(nuevo);
  });
  return b;
}

/* Botones de opciones excluyentes (Día | Semana | Mes) */
export function segmento(opciones, actual, alCambiar, etiqueta) {
  return h("div", { class: `segmento ${opciones.length >= 4 ? "rejilla" : ""}`, role: "group", "aria-label": etiqueta },
    opciones.map(([id, texto]) =>
      h("button", { type: "button", "aria-pressed": String(id === actual), onclick: () => alCambiar(id) }, texto)));
}

/* Campo de dinero con vista previa ("= Bs 1.234,00") para no equivocarse con puntos y comas */
export function campoMonto({ id, etiqueta, moneda = "USD", valor = "", ayuda, autofocus, alCambiar }) {
  const entrada = h("input", { class: "campo num", id, inputmode: "decimal", autocomplete: "off", value: valor === "" || valor == null ? "" : String(valor).replace(".", ","), placeholder: moneda === "VES" ? "0,00 Bs" : "0,00 $", autofocus });
  const vista = h("p", { class: "ayuda num" });
  const pintar = () => {
    const n = leerMonto(entrada.value);
    vista.textContent = entrada.value.trim() === "" ? (ayuda || "") : n == null ? "Escribe solo números, por ejemplo 12,50" : `= ${moneda === "VES" ? bs(n) : usd(n)}${ayuda ? ` · ${ayuda}` : ""}`;
    alCambiar?.(n);
  };
  entrada.addEventListener("input", pintar);
  queueMicrotask(pintar);
  return {
    nodo: h("div", null, etiqueta ? h("label", { class: "etiqueta", for: id }, etiqueta) : null, entrada, vista),
    entrada,
    valor: () => leerMonto(entrada.value),
    poner: (n) => { entrada.value = n == null ? "" : numero(n); pintar(); },
  };
}

export function campoTexto({ id, etiqueta, valor = "", placeholder, max = 120, autofocus, tipo = "text", ayuda }) {
  const entrada = h("input", { class: "campo", id, type: tipo, value: valor ?? "", placeholder, maxLength: max, autofocus });
  return { nodo: h("div", null, h("label", { class: "etiqueta", for: id }, etiqueta), entrada, ayuda ? h("p", { class: "ayuda" }, ayuda) : null), entrada };
}

export function selector({ id, etiqueta, opciones, valor }) {
  const sel = h("select", { class: "campo", id }, opciones.map(([v, t]) => h("option", { value: v, selected: v === valor }, t)));
  return { nodo: h("div", null, h("label", { class: "etiqueta", for: id }, etiqueta), sel), sel };
}

export const vacio = (texto, accion) => h("div", { class: "vacio" }, h("p", null, texto), accion || null);

export function tituloSeccion(texto, extra) {
  return h("div", { class: "titulo-seccion" }, h("h2", null, texto), extra || null);
}

export function kpi(titulo, valor, detalle, { tono } = {}) {
  return h("div", { class: `kpi caja ${tono ? `kpi-${tono}` : ""}` },
    h("p", { class: "kpi-titulo" }, titulo),
    h("p", { class: "kpi-valor num" }, valor),
    detalle ? h("p", { class: "kpi-detalle num" }, detalle) : null);
}

/* Muestra un error de guardado sin perder lo que la persona escribió */
export async function intentar(fn, mensajeOk) {
  try {
    await fn();
    if (mensajeOk) avisar(mensajeOk);
    return true;
  } catch (e) {
    console.error(e);
    avisar(e?.message?.startsWith("No ") || e?.message?.startsWith("Ese") ? e.message : "No se pudo guardar. Intenta de nuevo.");
    return false;
  }
}

export function descargar(nombre, contenido, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = h("a", { href: url, download: nombre });
  poner(document.body, a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
