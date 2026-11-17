/* Piezas que comparten la tienda y el panel. */

const FORMATO = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const usd = (n) => {
  const v = redondear(n);
  return `${v < 0 ? "-" : ""}$${FORMATO.format(Math.abs(v))}`;
};
export const bs = (n) => `Bs ${FORMATO.format(redondear(n))}`;
export const numero = (n) => FORMATO.format(redondear(n));
const FORMATO_CANTIDAD = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 });
export const cantidad = (n) => FORMATO_CANTIDAD.format(Number(n) || 0);
export const pct = (n) => (n == null || !isFinite(n) ? "—" : `${Math.round(n * 1000) / 10}%`.replace(".", ","));

/* Convierte lo que escribe la persona ("5,50", "5.50", "1.234,5") en número. Devuelve null si no es válido. */
export function leerMonto(texto) {
  let t = String(texto ?? "").trim().replace(/\s|\$|bs\.?/gi, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  else if (/^-?[1-9]\d{0,2}\.\d{3}$/.test(t)) t = t.replace(".", ""); // "4.200" en Venezuela es cuatro mil doscientos
  const n = Number(t);
  return isFinite(n) ? n : null;
}

export const limpiar = (texto, max) => String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const TIPOS_ENTREGA = { A: "Comer aquí", L: "Para llevar", D: "Delivery" };

/* Dentro de un marco (por ejemplo, la vista previa de un artefacto) no hay ventanas nuevas, impresión ni descargas */
export const enMarco = (() => { try { return window.top !== window.self; } catch { return true; } })();

/* Código corto para reconocer el pedido en el chat (sin letras que se confundan: 0/O, 1/I) */
export function codigoPedido() {
  const letras = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const azar = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(azar, (b) => letras[b % letras.length]).join("");
}

/* ───────── El pedido viaja dentro de un enlace (#p=...) que abre el panel del local ───────── */
const aBase64Url = (texto) => {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deBase64Url = (texto) => {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export const codificarPedido = (pedido) => aBase64Url(JSON.stringify(pedido));

/* Lee el pedido de un enlace o de un mensaje pegado. Todo lo que llega se trata como texto no confiable. */
export function leerPedidoDeTexto(texto) {
  const m = String(texto ?? "").match(/#p=([A-Za-z0-9_-]{8,4000})/);
  if (!m) return null;
  let p;
  try {
    p = JSON.parse(deBase64Url(m[1]));
  } catch {
    return null;
  }
  if (!p || typeof p !== "object" || p.v !== 1 || !Array.isArray(p.i)) return null;
  const items = p.i
    .slice(0, 60)
    .map((it) => (Array.isArray(it) ? it : []))
    .map(([id, cant, opcion]) => ({
      id: limpiar(id, 12),
      cant: Math.min(99, Math.max(0, Math.floor(Number(cant) || 0))),
      opcion: opcion == null ? "" : limpiar(opcion, 40),
    }))
    .filter((it) => it.id && it.cant > 0);
  if (!items.length) return null;
  return {
    codigo: limpiar(p.c, 8).toUpperCase().replace(/[^0-9A-Z]/g, ""),
    cliente: limpiar(p.n, 60) || "Cliente",
    tipo: TIPOS_ENTREGA[p.t] || "Para llevar",
    direccion: limpiar(p.d, 200),
    nota: limpiar(p.o, 200),
    items,
    totalVisto: isFinite(Number(p.s)) ? redondear(p.s) : null,
    enviado: isFinite(Number(p.f)) ? Number(p.f) * 1000 : null,
  };
}

export const enlaceWhatsApp = (numero, texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

/* append y replaceChildren convierten null en el texto "null": estos los descartan */
const sinVacios = (hijos) => hijos.flat(Infinity).filter((c) => c != null && c !== false && c !== "");
export function poner(el, ...hijos) { el.append(...sinVacios(hijos)); return el; }
export function reemplazar(el, ...hijos) { el.replaceChildren(...sinVacios(hijos)); return el; }

/* ───────── Construir HTML sin innerHTML (lo que escribe un cliente nunca se interpreta como código) ───────── */
export function h(etiqueta, props, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  agregar(el, hijos);
  return el;
}
function agregar(el, hijos) {
  for (const c of hijos.flat(Infinity)) {
    if (c == null || c === false || c === "") continue;
    poner(el, c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/* ───────── Avisos cortos ───────── */
let temporizadorAviso;
export function avisar(texto) {
  const vivo = document.getElementById("aviso");
  if (vivo) vivo.textContent = texto;
  document.querySelector(".aviso-flotante")?.remove();
  const el = h("div", { class: "aviso-flotante", "aria-hidden": "true" }, texto);
  poner(document.body, el);
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.remove(), 1800);
}

/* ───────── Hoja que sube desde abajo (ventana) ───────── */
export function abrirHoja(titulo, llenar, { alCerrar, ancho } = {}) {
  const anterior = document.activeElement;
  const capa = h("div", { class: "fondo-hoja" });
  const hoja = h("div", { class: "hoja caja", role: "dialog", "aria-modal": "true", "aria-label": titulo, style: ancho ? { maxWidth: ancho } : null });
  let cerrada = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    capa.remove();
    document.removeEventListener("keydown", tecla);
    if (!document.querySelector(".fondo-hoja")) document.body.style.overflow = "";
    alCerrar?.();
    anterior?.focus?.({ preventScroll: true });
  };
  const tecla = (e) => e.key === "Escape" && capa === [...document.querySelectorAll(".fondo-hoja")].pop() && cerrar();
  poner(hoja, 
    h("div", { class: "hoja-cabeza" }, h("h2", null, titulo),
      h("button", { class: "redondo toca", type: "button", "aria-label": "Cerrar", onclick: cerrar }, icono("x", 22))),
  );
  const cuerpo = h("div", { class: "hoja-cuerpo" });
  poner(hoja, cuerpo);
  poner(capa, hoja);
  capa.addEventListener("click", (e) => e.target === capa && cerrar());
  document.addEventListener("keydown", tecla);
  (document.getElementById("capa") || document.body).append(capa);
  document.body.style.overflow = "hidden";
  llenar(cuerpo, cerrar, hoja);
  // Solo se enfoca un campo si la hoja lo pide (autofocus); si no, el foco va a la hoja y el teclado no salta solo
  const primero = hoja.querySelector("[autofocus]");
  if (primero) primero.focus({ preventScroll: true });
  else { hoja.tabIndex = -1; hoja.focus({ preventScroll: true }); }
  return cerrar;
}

/* Íconos (trazos de Lucide, licencia ISC). Son textos fijos del código, nunca datos de clientes. */
const TRAZOS = {
  bolsa: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  menos: '<path d="M5 12h14"/>',
  basura: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  enviar: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  cubiertos: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  moto: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  telefono: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z"/><path d="M17.5 6.5h.01"/>',
  flecha_abajo: '<path d="m6 9 6 6 6-6"/>',
  flecha_izq: '<path d="m15 18-6-6 6-6"/>',
  flecha_der: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  candado: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  caja: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  etiqueta: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42Z"/><path d="M7 7h.01"/>',
  grafica: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  portapapeles: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  billetera: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  recibo: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  paquete: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  ajustes: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  lapiz: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  compartir: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
  imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
};

export function icono(nombre, tam = 22) {
  const span = document.createElement("span");
  span.className = "ico";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || ""}</svg>`;
  return span;
}
