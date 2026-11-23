import { poner, reemplazar } from "./comun.js";
import { NEGOCIO, CATEGORIAS, PRODUCTOS, DEMO, RUTA_PANEL, HORARIO, DESTACADOS, SUGERENCIAS, PAGOS } from "../menu.js";
import { h, icono, usd, limpiar, redondear, codigoPedido, codificarPedido, enlaceWhatsApp, TIPOS_ENTREGA, abrirHoja, avisar, estadoHorario } from "./comun.js";
import { hamburguesaBailarina } from "./bailarina.js";
import { activarNavidad } from "./navidad.js";

const NOTA_MAX = 200;
const LINEA = "----------------------------------------";
const POR_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));
const CAT_POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]));
const $ = (id) => document.getElementById(id);
const ES_ESCRITORIO = () => matchMedia("(min-width: 1024px)").matches;
const SIN_MOVIMIENTO = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ES_NAVIDAD = () => document.documentElement.classList.contains("navidad");
/* Con "ahorro de datos" activado en el teléfono no se bajan las fotos decorativas de las categorías */
const AHORRO_DATOS = navigator.connection?.saveData === true;
try { history.scrollRestoration = "manual"; } catch { /* nada */ } // el botón Atrás cierra hojas: que no mueva la página

/* ───────── Estado (el carrito vive en esta pestaña; los datos del cliente se recuerdan en su teléfono) ───────── */
const guardado = {
  leer(almacen, clave, porDefecto) {
    try { return JSON.parse(almacen.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
  },
  escribir(almacen, clave, valor) {
    try { almacen.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: no pasa nada */ }
  },
};

/* Los adicionales de una línea son una lista de ids; un id repetido es doble porción (ej. doble tocineta) */
function claveLinea(id, opcion, extras = []) { return `${id}|${opcion || ""}|${[...extras].sort().join(",")}`; }
const ES_ADICIONAL = (p) => p?.cat === "adicionales";
const ADICIONALES = PRODUCTOS.filter((p) => ES_ADICIONAL(p) && !p.agotado);
const MAX_EXTRAS = 8;
const MAX_POR_EXTRA = 3;
const agrupar = (ids) => {
  const m = new Map();
  for (const id of ids) m.set(id, (m.get(id) || 0) + 1);
  return m;
};

const carrito = new Map(
  guardado.leer(sessionStorage, "sd-carrito", [])
    .filter(([, l]) => l && POR_ID.has(l.id) && !POR_ID.get(l.id).agotado && l.cant > 0)
    .map(([, l]) => {
      const extras = (Array.isArray(l.extras) ? l.extras : []).filter((e) => ES_ADICIONAL(POR_ID.get(e))).slice(0, MAX_EXTRAS);
      return [claveLinea(l.id, l.opcion, extras), { id: l.id, opcion: l.opcion || "", extras, cant: Math.min(99, l.cant) }];
    })
);
const cliente = { nombre: "", tipo: "L", direccion: "", notas: "", pago: "", ...guardado.leer(localStorage, "sd-cliente", {}) };
if (!TIPOS_ENTREGA[cliente.tipo]) cliente.tipo = "L";
/* Formas de pago según el tipo de pedido (en delivery no se aceptan todas) */
const pagosPara = (tipo) => PAGOS.filter((f) => f.tipos.includes(tipo));
const nombrePago = (id) => PAGOS.find((f) => f.id === id)?.nombre || "";
const listaNombres = (lista) => lista.map((f) => f.nombre).join(", ").replace(/, ([^,]*)$/, " o $1");
if (!pagosPara(cliente.tipo).some((f) => f.id === cliente.pago)) cliente.pago = "";

const lineas = () =>
  [...carrito.values()]
    .map((l) => {
      const producto = POR_ID.get(l.id);
      const extras = (l.extras || []).map((e) => POR_ID.get(e)).filter(Boolean);
      const unitario = producto ? redondear(producto.precio + extras.reduce((s, e) => s + e.precio, 0)) : 0;
      return { ...l, producto, extrasProductos: extras, unitario };
    })
    .filter((l) => l.producto);
const cuenta = () => lineas().reduce((s, l) => s + l.cant, 0);
const total = () => redondear(lineas().reduce((s, l) => s + l.cant * l.unitario, 0));
const cantidadDe = (id) => lineas().filter((l) => l.id === id).reduce((s, l) => s + l.cant, 0);

function cambiar(id, opcion, delta, extras = []) {
  const k = claveLinea(id, opcion, extras);
  const actual = carrito.get(k)?.cant || 0;
  const nueva = Math.max(0, Math.min(99, actual + delta));
  if (nueva) carrito.set(k, { id, opcion: opcion || "", extras: [...extras], cant: nueva });
  else carrito.delete(k);
  guardado.escribir(sessionStorage, "sd-carrito", [...carrito.entries()]);
  actualizarTodo(id, delta > 0);
}

function guardarCliente() {
  const { nombre, tipo, direccion, pago } = cliente;
  guardado.escribir(localStorage, "sd-cliente", { nombre, tipo, direccion, pago });
}

const nombreLinea = (l) => (l.opcion ? `${l.producto.nombre} (${l.opcion})` : l.producto.nombre);
const textoExtras = (l) => {
  if (!l.extrasProductos?.length) return "";
  const partes = [...agrupar(l.extras)].map(([id, n]) => `${n > 1 ? `${n}× ` : ""}${POR_ID.get(id)?.nombre || id}`);
  return `+ ${partes.join(", ")}`;
};
const listaOpciones = (ops) => ops.join(", ").replace(/, ([^,]*)$/, " o $1");

function falta() {
  if (!cuenta()) return "";
  if (!cliente.nombre.trim()) return "Escribe tu nombre para enviar el pedido.";
  if (cliente.tipo === "D" && !cliente.direccion.trim()) return "Escribe la dirección para el delivery.";
  if (!cliente.pago) return "Elige cómo vas a pagar.";
  return "";
}

/* ───────── Microinteracciones ───────── */
function vibrar(ms = 10) { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } }

function saltar(el) {
  if (!el || SIN_MOVIMIENTO()) return;
  el.classList.remove("salta");
  void el.offsetWidth; // reinicia la animación
  el.classList.add("salta");
}

/* Cuenta el número hasta el valor nuevo (precios y totales) */
function contar(el, valor) {
  const desde = Number(el.dataset.valor ?? valor);
  el.dataset.valor = String(valor);
  if (SIN_MOVIMIENTO() || desde === valor) { el.textContent = usd(valor); return; }
  const inicio = performance.now();
  const dur = 320;
  cancelAnimationFrame(el._cuadro);
  const paso = (t) => {
    const k = Math.min(1, (t - inicio) / dur);
    const suave = 1 - Math.pow(1 - k, 3);
    el.textContent = usd(desde + (valor - desde) * suave);
    if (k < 1) el._cuadro = requestAnimationFrame(paso);
  };
  el._cuadro = requestAnimationFrame(paso);
}

/* La foto del producto "vuela" hasta el pedido */
function volarAlPedido(origen) {
  try { volar(origen); } catch { /* es solo decorativo */ }
}
function volar(origen) {
  if (!origen || SIN_MOVIMIENTO() || origen.tagName !== "IMG" || !origen.animate) return;
  const destino = ES_ESCRITORIO() ? $("pedido-lateral") : document.querySelector("#barra-pedido .barra-icono");
  if (!destino) return;
  const a = origen.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const img = h("img", { class: "volando", src: origen.currentSrc || origen.src, alt: "" });
  Object.assign(img.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(img);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + Math.min(b.height, 80) / 2 - (a.top + a.height / 2);
  const anim = img.animate([
    { transform: "translate(0, 0) scale(1)", opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.6)`, opacity: 0.95, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.4 },
  ], { duration: 620, easing: "cubic-bezier(0.5, 0, 0.3, 1)" });
  anim.onfinish = () => img.remove();
  setTimeout(() => img.remove(), 900); // por si la animación no termina (pestaña en segundo plano)
}

/* Arrastrar la hoja hacia abajo para cerrarla (solo en el teléfono) */
function hacerArrastrable(hoja, cerrar, ...asas) {
  let inicioY = null, dy = 0, t0 = 0, moviendo = false;
  const empezar = (e) => {
    if (matchMedia("(min-width: 720px)").matches || hoja.scrollTop > 2) return;
    if (e.target.closest("button, input, textarea, a, label")) return;
    inicioY = e.clientY; dy = 0; t0 = performance.now(); moviendo = false;
  };
  const mover = (e) => {
    if (inicioY == null) return;
    dy = Math.max(0, e.clientY - inicioY);
    if (!moviendo && dy > 6) { moviendo = true; hoja.classList.add("arrastrando"); hoja.style.animation = "none"; }
    if (moviendo) { hoja.style.transform = `translateY(${dy}px)`; e.preventDefault(); }
  };
  const soltar = () => {
    if (inicioY == null) return;
    const velocidad = dy / Math.max(1, performance.now() - t0);
    inicioY = null;
    if (!moviendo) return;
    hoja.style.transition = "transform 0.22s ease";
    if (dy > 110 || (dy > 40 && velocidad > 0.6)) {
      hoja.style.transform = "translateY(100%)";
      setTimeout(cerrar, 120);
    } else {
      hoja.style.transform = "";
      setTimeout(() => { hoja.style.transition = ""; hoja.classList.remove("arrastrando"); }, 230);
    }
  };
  for (const asa of asas.filter(Boolean)) {
    asa.style.touchAction = "none";
    asa.addEventListener("pointerdown", (e) => {
      empezar(e);
      if (inicioY != null) { try { asa.setPointerCapture(e.pointerId); } catch { /* nada */ } }
    });
    asa.addEventListener("pointermove", mover);
    asa.addEventListener("pointerup", soltar);
    asa.addEventListener("pointercancel", soltar);
  }
}

const SVG_BOLSA = '<svg viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="60" cy="103" rx="40" ry="6" fill="#F1E4DC"/><path d="M27 38h66l-5 56a9 9 0 0 1-9 8H41a9 9 0 0 1-9-8z" fill="#C8141C"/><path d="M27 38h66l-1 9H28z" fill="#9E0F16"/><path d="M45 38v-6a15 15 0 0 1 30 0v6" fill="none" stroke="#3A0709" stroke-width="5" stroke-linecap="round"/><path d="M60 56c8 7 12 13 12 20a12 12 0 0 1-24 0c0-4 2-8 5-10 0 4 2 7 4 7-1-7 1-12 3-17z" fill="#FFC20F"/><path d="M60 69c3 3 6 7 6 10a6 6 0 0 1-12 0c0-3 3-7 6-10z" fill="#F7931E"/></svg>';
const SVG_LUPA = '<svg viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="60" cy="103" rx="40" ry="6" fill="#F1E4DC"/><circle cx="54" cy="48" r="28" fill="#FFF4E0" stroke="#3A0709" stroke-width="6"/><path d="M75 69l18 18" stroke="#3A0709" stroke-width="9" stroke-linecap="round"/><path d="M44 44c3-6 9-9 15-9" fill="none" stroke="#F7931E" stroke-width="5" stroke-linecap="round"/></svg>';
function svgDe(cadena) { const s = h("span", { "aria-hidden": "true" }); s.innerHTML = cadena; return s.firstChild; } // dibujos fijos del código

/* ───────── Imágenes livianas para teléfonos ─────────
   Cada foto .webp tiene una versión chica (foto-240.webp, o foto-720.webp para las de categoría).
   El teléfono baja la que le basta; si la versión chica no existe (foto nueva), usa la original. */
const variante = (ruta, ancho) => ruta.replace(/\.webp$/i, `-${ancho}.webp`);
function imagen(ruta, { clase, sizes, chica = 240, grande = 400, ancho = 104, alto = 104, diferida = true } = {}) {
  const props = { loading: diferida ? "lazy" : null, decoding: "async", class: clase, alt: "", width: ancho, height: alto };
  if (/\.webp$/i.test(ruta) && sizes) Object.assign(props, { sizes, srcset: `${variante(ruta, chica)} ${chica}w, ${ruta} ${grande}w` });
  const img = h("img", { ...props, src: ruta });
  img.addEventListener("error", () => {
    if (img.getAttribute("srcset")) { img.removeAttribute("srcset"); img.removeAttribute("sizes"); img.src = ruta; }
  });
  return img;
}

/* ───────── Menú ───────── */
function mediaProducto(p, clase = "foto-producto", sizes = "(max-width: 360px) 88px, 104px") {
  if (p.foto) return imagen(p.foto, { clase, sizes });
  return h("span", { class: `${clase} foto-vacia`, "aria-hidden": "true" }, CAT_POR_ID.get(p.cat)?.emoji || "🍽️");
}

function insigniaCantidad(p) {
  const n = cantidadDe(p.id);
  return h("span", { class: "cuenta-tarjeta num", hidden: !n, "aria-hidden": "true" }, String(n));
}

function alTocarProducto(p, origen) {
  if (p.agotado) { vibrar(30); avisar(`${p.nombre} está agotado por ahora`); return; }
  if (ES_ADICIONAL(p)) {
    vibrar();
    cambiar(p.id, "", 1);
    volarAlPedido(origen);
    avisar(`Agregaste ${p.nombre}`);
  } else {
    abrirPersonalizar(p);
  }
}

function etiquetaAccion(p) {
  if (p.agotado) return `${p.nombre}, agotado por ahora`;
  const n = cantidadDe(p.id);
  return `${p.nombre}, ${usd(p.precio)}. ${ES_ADICIONAL(p) ? "Agregar al pedido" : "Elegir y agregar"}${n ? `. ${n} en tu pedido` : ""}`;
}

function tarjeta(p) {
  const media = mediaProducto(p);
  const boton = h("button", {
    class: p.agotado ? "producto agotado" : "producto", type: "button", "aria-disabled": p.agotado ? "true" : null, dataset: { pid: p.id, buscar: normalizar(`${p.nombre} ${p.desc || ""} ${CAT_POR_ID.get(p.cat)?.nombre || ""}`) },
    "aria-label": etiquetaAccion(p),
    onclick: () => alTocarProducto(p, media),
  },
    h("span", { class: "producto-info" },
      h("span", { class: "producto-nombre" }, p.nombre),
      p.desc ? h("span", { class: "desc" }, p.desc) : null,
      p.opciones?.length ? h("span", { class: "opciones-texto" }, listaOpciones(p.opciones)) : null,
      p.agotado ? h("span", { class: "etiqueta-agotado" }, "Agotado por ahora") : h("span", { class: "precio num" }, usd(p.precio)),
    ),
    h("span", { class: "producto-media" }, media, insigniaCantidad(p), p.agotado ? null : h("span", { class: "mas-flotante", "aria-hidden": "true" }, icono("mas", 20))),
  );
  return boton;
}

function tarjetaDestacada(p) {
  const media = mediaProducto(p, "foto-producto", "(max-width: 360px) 150px, (min-width: 720px) 200px, 168px");
  return h("button", { class: "destacado", type: "button", dataset: { pid: p.id }, "aria-label": etiquetaAccion(p), onclick: () => alTocarProducto(p, media) },
    media, insigniaCantidad(p),
    h("span", { class: "mas-flotante", "aria-hidden": "true" }, icono("mas", 20)),
    h("span", { class: "destacado-info" }, h("b", null, p.nombre), h("span", { class: "precio num" }, usd(p.precio))));
}

const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function pintarMenu() {
  const nav = $("categorias");
  const menu = $("menu");
  $("esqueleto")?.remove();
  poner(menu, tarjetaRepetir());
  const destacados = DESTACADOS.map((id) => POR_ID.get(id)).filter((p) => p && !p.agotado);
  if (destacados.length) {
    poner(menu, h("section", { class: "destacados", id: "destacados", "aria-labelledby": "titulo-destacados" },
      h("div", { class: "titulo-bloque" }, h("h2", { id: "titulo-destacados" }, "🔥 Lo más pedido"), h("span", null, "Desliza para ver más")),
      h("div", { class: "destacados-carril" }, destacados.map(tarjetaDestacada))));
  }
  for (const c of CATEGORIAS) {
    const productos = PRODUCTOS.filter((p) => p.cat === c.id);
    if (!productos.length) continue;
    poner(nav, h("a", { class: "categoria", href: `#cat-${c.id}`, dataset: { cat: c.id } },
      h("span", { class: "emo", "aria-hidden": "true" }, c.emoji), c.corto || c.nombre));
    poner(menu, h("section", { class: "seccion", id: `cat-${c.id}`, "aria-labelledby": `titulo-${c.id}` },
      h("div", { class: "franja" },
        c.foto && !AHORRO_DATOS
          ? imagen(c.foto, { clase: "franja-foto", sizes: "(min-width: 1024px) 780px, calc(100vw - 32px)", chica: 720, grande: 1200, ancho: 1200, alto: 450 })
          : h("span", { class: "franja-emoji", "aria-hidden": "true" }, c.emoji),
        h("h2", { id: `titulo-${c.id}` }, c.nombre),
        h("span", { class: "franja-cuenta num" }, `${productos.length} ${productos.length === 1 ? "opción" : "opciones"}`),
      ),
      c.nota ? h("p", { class: "seccion-nota" }, c.nota) : null,
      h("div", { class: "lista" }, productos.map(tarjeta)),
    ));
  }
  poner(menu, h("div", { class: "vacio", id: "busqueda-vacia", hidden: true },
    svgDe(SVG_LUPA), h("b", null, "No encontramos eso"), h("p", null, "Prueba con otra palabra, como “perro”, “pollo” o “papas”."),
    h("button", { class: "boton suave toca", type: "button", onclick: () => limpiarBusqueda(true) }, "Ver todo el menú")));
  poner(menu, h("footer", { class: "pie" },
    h("a", { href: `https://wa.me/${NEGOCIO.whatsapp}` }, icono("telefono", 18), `Delivery y pedidos: ${NEGOCIO.telefono}`),
    NEGOCIO.instagram ? h("a", { href: `https://www.instagram.com/${NEGOCIO.instagram}/`, rel: "noopener" }, icono("instagram", 18), `@${NEGOCIO.instagram}`) : null,
    HORARIO ? h("span", null, icono("reloj", 18), HORARIO.texto) : null,
    PAGOS.length ? h("span", null, icono("billetera", 18), `Pagos: ${listaNombres(PAGOS).replace(/ o ([^ ]+)$/, " y $1")}${pagosPara("D").length < PAGOS.length ? ` (delivery: ${listaNombres(pagosPara("D"))})` : ""}`) : null,
    NEGOCIO.ciudad ? h("span", null, icono("pin", 18), NEGOCIO.ciudad) : null,
  ));

  // La portada ya viene armada en el HTML (para que no salte); aquí solo se pone al día con menu.js
  $("accion-telefono").href = `tel:+${NEGOCIO.whatsapp}`;
  $("accion-telefono-texto").textContent = NEGOCIO.telefono;
  if (NEGOCIO.instagram) $("accion-instagram").href = `https://www.instagram.com/${NEGOCIO.instagram}/`;
  else $("accion-instagram").remove();
  if (HORARIO) $("horario-semana-texto").textContent = HORARIO.texto;
  else $("horario-semana").remove();
  $("ranura-bailarina").replaceWith(hamburguesaBailarina({ navidad: ES_NAVIDAD }));

  // Tocar una categoría lleva a su sección sin llenar el historial (así "Atrás" no salta entre categorías)
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a.categoria");
    if (!a) return;
    e.preventDefault();
    if ($("buscar").value) limpiarBusqueda(false);
    const sec = $(`cat-${a.dataset.cat}`);
    if (!sec) return;
    const y = sec.getBoundingClientRect().top + scrollY - $("cabecera").offsetHeight - nav.offsetHeight + 6;
    scrollTo({ top: Math.max(0, y), behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
  });

  // Marca la categoría que se está viendo y la centra en la barra
  if (!("IntersectionObserver" in window)) return;
  const enlaces = new Map([...nav.querySelectorAll(".categoria")].map((a) => [a.dataset.cat, a]));
  const visibles = new Set();
  const observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) e.isIntersecting ? visibles.add(e.target.id) : visibles.delete(e.target.id);
    const primera = CATEGORIAS.map((c) => `cat-${c.id}`).find((id) => visibles.has(id));
    for (const [cat, a] of enlaces) {
      const activa = `cat-${cat}` === primera;
      if (activa && a.getAttribute("aria-current") !== "true") {
        nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
      }
      a.setAttribute("aria-current", activa ? "true" : "false");
    }
  }, { rootMargin: "-35% 0px -60% 0px" });
  menu.querySelectorAll(".seccion").forEach((s) => observador.observe(s));
}

/* ───────── Buscador ───────── */
function filtrar(texto) {
  const q = normalizar(texto).trim();
  const palabras = q.split(/\s+/).filter(Boolean);
  let hallados = 0;
  for (const sec of document.querySelectorAll("#menu .seccion")) {
    let enSeccion = 0;
    for (const t of sec.querySelectorAll(".producto")) {
      const ok = !palabras.length || palabras.every((w) => t.dataset.buscar.includes(w));
      t.classList.toggle("oculto-busqueda", !ok);
      if (ok) enSeccion++;
    }
    sec.classList.toggle("oculto-busqueda", !enSeccion);
    hallados += enSeccion;
  }
  $("destacados")?.classList.toggle("oculto-busqueda", Boolean(q));
  const res = $("resultado-busqueda");
  res.hidden = !q || !hallados;
  res.textContent = q ? `${hallados} ${hallados === 1 ? "resultado" : "resultados"} para “${texto.trim()}”` : "";
  $("busqueda-vacia").hidden = !q || hallados > 0;
  $("buscar-limpiar").hidden = !q;
}
function limpiarBusqueda(enfocar) {
  $("buscar").value = "";
  filtrar("");
  if (enfocar) $("buscar").focus();
}

/* ───────── Personalizar: opción, adicionales y cantidad ───────── */
function abrirPersonalizar(p) {
  const conteo = new Map(); // id del adicional → porciones
  let opcion = p.opciones?.length === 1 ? p.opciones[0] : "";
  let cant = 1;

  abrirHoja(p.nombre, (cuerpo, cerrar, hoja) => {
    const media = mediaProducto(p, "foto-producto", "(min-width: 720px) 560px, 100vw");
    // Mientras baja la foto grande se ve la chica que ya está en el teléfono (sin hueco en blanco)
    const yaVista = document.querySelector(`[data-pid="${CSS.escape(p.id)}"] img`)?.currentSrc;
    if (yaVista && media.tagName === "IMG") media.style.background = `#FFF4E0 url("${yaVista}") center / cover`;
    const botonCerrar = h("button", { class: "cerrar-hoja", type: "button", "aria-label": "Cerrar", onclick: cerrar }, icono("x", 20));
    const asa = h("span", { class: "asa", "aria-hidden": "true" });
    const zonaFoto = p.foto ? h("div", { class: "personalizar-foto" }, media, asa, botonCerrar) : null;

    const precioBoton = h("span", { class: "num" });
    const boton = h("button", { class: "boton rojo toca", type: "button" }, icono("mas", 20), h("span", null, "Agregar"), h("span", { "aria-hidden": "true" }, "·"), precioBoton);
    const mensaje = h("p", { class: "falta", role: "status" });

    // Opción obligatoria (carne, pollo…)
    const estadoOpcion = h("span", { class: "etiqueta-estado obligatorio" }, "Obligatorio");
    const botonesOpcion = (p.opciones || []).map((op) => h("button", {
      class: "chip-opcion", type: "button", "aria-pressed": "false", dataset: { op },
      onclick: () => { opcion = op; vibrar(6); bloqueOpcion?.classList.remove("error"); refrescar(); },
    }, op));
    const bloqueOpcion = botonesOpcion.length ? h("fieldset", { class: "bloque-eleccion" },
      h("legend", null, h("span", null, "Elige una opción"), estadoOpcion),
      h("div", { class: "chips-opcion" }, botonesOpcion)) : null;

    // Adicionales con − / + (permite doble porción)
    const totalExtras = () => [...conteo.values()].reduce((s, n) => s + n, 0);
    const filas = ES_ADICIONAL(p) ? [] : ADICIONALES.map((a) => {
      const salida = h("output", { class: "num" }, "0");
      const menos = h("button", { class: "menos", type: "button", "aria-label": `Quitar ${a.nombre}` }, icono("menos", 18));
      const mas = h("button", { class: "mas", type: "button", "aria-label": `Agregar ${a.nombre}` }, icono("mas", 18));
      const fila = h("div", { class: "extra", dataset: { extra: a.id } },
        a.foto ? imagen(a.foto, { clase: "extra-foto", sizes: "44px", ancho: 44, alto: 44 }) : h("span", { class: "extra-foto", "aria-hidden": "true" }, "➕"),
        h("span", { class: "extra-textos" }, h("span", { class: "extra-nombre" }, a.nombre), h("span", { class: "extra-precio num" }, `+${usd(a.precio)}`)),
        h("span", { class: "paso" }, menos, salida, mas));
      const poner1 = (d) => {
        const n = Math.max(0, Math.min(MAX_POR_EXTRA, (conteo.get(a.id) || 0) + d));
        if (d > 0 && totalExtras() >= MAX_EXTRAS) { avisar(`Máximo ${MAX_EXTRAS} adicionales por producto`); return; }
        n ? conteo.set(a.id, n) : conteo.delete(a.id);
        vibrar(6);
        refrescar();
      };
      menos.addEventListener("click", () => poner1(-1));
      mas.addEventListener("click", () => poner1(1));
      fila.addEventListener("click", (e) => { if (!e.target.closest("button") && !conteo.get(a.id)) poner1(1); });
      return { a, fila, salida, menos, mas };
    });
    const estadoExtras = h("span", { class: "etiqueta-estado opcional" }, "Opcional");
    const bloqueExtras = filas.length ? h("fieldset", { class: "bloque-eleccion" },
      h("legend", null, h("span", null, "¿Le agregas algo?"), estadoExtras),
      h("div", { class: "lista-extras" }, filas.map((f) => f.fila))) : null;

    // Cantidad del producto
    const salidaCant = h("output", { class: "num", "aria-live": "polite" }, "1");
    const menosCant = h("button", { type: "button", "aria-label": "Uno menos", onclick: () => { cant = Math.max(1, cant - 1); vibrar(6); refrescar(); } }, icono("menos", 20));
    const masCant = h("button", { type: "button", "aria-label": "Uno más", onclick: () => { cant = Math.min(99, cant + 1); vibrar(6); refrescar(); } }, icono("mas", 20));

    function refrescar() {
      for (const b of botonesOpcion) b.setAttribute("aria-pressed", String(b.dataset.op === opcion));
      if (bloqueOpcion) {
        estadoOpcion.className = `etiqueta-estado ${opcion ? "listo" : "obligatorio"}`;
        estadoOpcion.textContent = opcion ? "✓ Listo" : "Obligatorio";
      }
      for (const f of filas) {
        const n = conteo.get(f.a.id) || 0;
        f.salida.textContent = String(n);
        f.fila.classList.toggle("activo", n > 0);
        f.menos.disabled = !n;
        f.mas.disabled = n >= MAX_POR_EXTRA;
      }
      const ne = totalExtras();
      estadoExtras.className = `etiqueta-estado ${ne ? "listo" : "opcional"}`;
      estadoExtras.textContent = ne ? `${ne} elegido${ne > 1 ? "s" : ""}` : "Opcional";
      salidaCant.textContent = String(cant);
      menosCant.disabled = cant <= 1;
      const unitario = p.precio + [...conteo].reduce((s, [id, n]) => s + POR_ID.get(id).precio * n, 0);
      contar(precioBoton, redondear(unitario * cant));
      mensaje.textContent = "";
    }

    boton.addEventListener("click", () => {
      if (p.opciones?.length && !opcion) {
        bloqueOpcion.classList.remove("error"); void bloqueOpcion.offsetWidth; bloqueOpcion.classList.add("error");
        mensaje.textContent = `Elige ${listaOpciones(p.opciones).toLowerCase()} para continuar.`;
        bloqueOpcion.scrollIntoView({ block: "center", behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
        vibrar(30);
        return;
      }
      const extras = [...conteo].flatMap(([id, n]) => Array(n).fill(id));
      vibrar(12);
      cerrar();
      cambiar(p.id, opcion, cant, extras);
      volarAlPedido(document.querySelector(`.producto[data-pid="${CSS.escape(p.id)}"] img, .destacado[data-pid="${CSS.escape(p.id)}"] img`));
      avisar(`Agregaste ${cant > 1 ? `${cant} ` : ""}${p.nombre}${opcion ? ` (${opcion})` : ""}${extras.length ? ` con ${extras.length} adicional${extras.length > 1 ? "es" : ""}` : ""}`);
    });

    const contenidoCuerpo = h("div", { class: `personalizar-cuerpo ${zonaFoto ? "" : "sin-foto"}` },
      h("div", { class: "personalizar-titulo" },
        h("h2", null, p.nombre),
        h("span", { class: "precio num" }, usd(p.precio)),
        p.desc ? h("p", null, p.desc) : null),
      bloqueOpcion, bloqueExtras);

    reemplazar(hoja, h("div", { class: "personalizar" },
      zonaFoto || h("div", { style: { position: "relative", height: "40px" } }, asa, h("div", { style: { position: "absolute", top: "14px", right: "14px", zIndex: 4 } }, botonCerrar)),
      contenidoCuerpo,
      h("div", { class: "hoja-pie" },
        h("div", { class: "hoja-pie-fila" }, h("span", { class: "paso grande" }, menosCant, salidaCant, masCant), boton),
        mensaje)));
    hoja.setAttribute("aria-label", `Personalizar ${p.nombre}`);
    hacerArrastrable(hoja, cerrar, zonaFoto || asa.parentElement);
    refrescar();
    precioBoton.textContent = usd(Number(precioBoton.dataset.valor));
  }, { historial: true });
}

/* ───────── Pedido ───────── */
const vistasPedido = new Set();

function crearPedido({ enHoja, cerrar }) {
  let paso = 1;
  const contadorCabeza = h("span", { class: "num", style: { color: "var(--gris)", fontWeight: 500, fontSize: "15px" } });
  const pasos = enHoja ? h("div", { class: "pasos", role: "group", "aria-label": "Pasos del pedido" }) : null;
  const cabeza = h("div", { class: "pedido-cabeza" },
    h("div", { class: "pedido-cabeza-fila" }, h("h2", null, "Tu pedido ", contadorCabeza),
      enHoja ? h("button", { class: "cerrar-hoja", type: "button", "aria-label": "Cerrar pedido", onclick: () => cerrar?.() }, icono("x", 20)) : null),
    pasos);
  const cuerpo = h("div", { class: "pedido-cuerpo" });
  const pie = h("div", { class: "hoja-pie" });
  const totalTexto = h("strong", { class: "num" });
  const mensaje = h("p", { class: "falta", role: "status" });
  const avisoCerrado = h("p", { class: "aviso-cerrado", hidden: true });
  const botonEnviar = h("a", { class: "boton verde toca", href: `https://wa.me/${NEGOCIO.whatsapp}`, target: "_blank", rel: "noopener", role: "button", onclick: enviar },
    icono("enviar", 20), "Enviar por WhatsApp");
  const precioContinuar = h("span", { class: "num" });
  const botonContinuar = h("button", { class: "boton rojo toca", type: "button", onclick: () => irPaso(2) }, "Continuar", h("span", { "aria-hidden": "true" }, "·"), precioContinuar);
  const botonVolver = h("button", { class: "volver", type: "button", "aria-label": "Volver a los productos", onclick: () => irPaso(1) }, icono("flecha_izq", 22));

  const sufijo = enHoja ? "h" : "l";
  const campoNombre = h("input", { class: "campo", id: `nombre-${sufijo}`, value: cliente.nombre, autocomplete: "name", autocapitalize: "words", spellcheck: "false", enterkeyhint: "done", maxLength: 60, placeholder: "¿A nombre de quién?" });
  const campoDir = h("input", { class: "campo", id: `dir-${sufijo}`, value: cliente.direccion, autocomplete: "street-address", autocapitalize: "sentences", enterkeyhint: "done", maxLength: 200, placeholder: "Calle, casa o edificio y una referencia" });
  const campoNotas = h("textarea", { class: "campo", id: `notas-${sufijo}`, rows: 2, maxLength: NOTA_MAX, placeholder: "Sin cebolla, salsas aparte…" });
  campoNotas.value = cliente.notas;
  const contador = h("span", { class: "num" });
  const bloqueDir = h("div", null,
    h("label", { class: "etiqueta", for: campoDir.id }, "Dirección"), campoDir,
    h("p", { class: "ayuda" }, "El costo del delivery te lo confirmamos por WhatsApp."));
  const botonesTipo = Object.entries(TIPOS_ENTREGA).map(([k, nombre]) =>
    h("button", { class: "tipo", type: "button", "aria-pressed": String(cliente.tipo === k), dataset: { tipo: k },
      onclick: () => {
        cliente.tipo = k;
        if (!pagosPara(k).some((f) => f.id === cliente.pago)) cliente.pago = ""; // en delivery no van todas
        vibrar(6); guardarCliente(); refrescarDatos(); campoNombre.setAttribute("enterkeyhint", k === "D" ? "next" : "done");
      } },
      icono({ A: "cubiertos", L: "bolsa", D: "moto" }[k], 22), nombre));
  campoNombre.addEventListener("input", () => { cliente.nombre = campoNombre.value; guardarCliente(); refrescarDatos(); });
  // "Listo" en el teclado: pasa a la dirección si es delivery; si no, cierra el teclado
  campoNombre.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (cliente.tipo === "D" && !cliente.direccion.trim()) campoDir.focus(); else campoNombre.blur();
  });
  campoDir.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); campoDir.blur(); } });
  campoDir.addEventListener("input", () => { cliente.direccion = campoDir.value; guardarCliente(); refrescarDatos(); });
  campoNotas.addEventListener("input", () => { cliente.notas = campoNotas.value; refrescarDatos(); });

  const cajaPagos = h("div", { class: "pagos", role: "group", "aria-label": "Forma de pago" });
  const ayudaPagos = h("p", { class: "ayuda" });
  const bloquePagos = h("fieldset", { class: "bloque-pagos", style: { border: 0, padding: 0, margin: 0, minWidth: 0 } },
    h("legend", { class: "etiqueta" }, "¿Cómo vas a pagar?"), cajaPagos, ayudaPagos);
  function pintarPagos() {
    const lista = pagosPara(cliente.tipo);
    reemplazar(cajaPagos, lista.map((f) => h("button", { class: "pago", type: "button", "aria-pressed": String(cliente.pago === f.id), onclick: () => {
      cliente.pago = f.id; bloquePagos.classList.remove("error"); vibrar(6); guardarCliente(); refrescarDatos();
    } }, h("span", { "aria-hidden": "true" }, f.emoji || ""), f.nombre)));
    ayudaPagos.textContent = cliente.tipo === "D" && lista.length < PAGOS.length ? `En delivery aceptamos ${listaNombres(lista)}.` : "";
    ayudaPagos.hidden = !ayudaPagos.textContent;
  }

  const datos = h("div", { class: "pedido-datos" },
    h("div", null, h("label", { class: "etiqueta", for: campoNombre.id }, "Nombre"), campoNombre),
    h("fieldset", { style: { border: 0, padding: 0, margin: 0, minWidth: 0 } },
      h("legend", { class: "etiqueta" }, "¿Cómo lo quieres?"), h("div", { class: "tipos" }, botonesTipo)),
    bloqueDir,
    bloquePagos,
    h("div", null,
      h("label", { class: "etiqueta", for: campoNotas.id }, "Notas para la cocina ", h("span", { style: { fontWeight: 500, color: "var(--gris)" } }, "(opcional)")),
      campoNotas,
      h("p", { class: "ayuda", style: { textAlign: "right" }, "aria-hidden": "true" }, contador, `/${NOTA_MAX}`)),
    avisoCerrado);

  const raiz = h("div", { class: "pedido" }, cabeza, cuerpo, pie);

  function irPaso(n) {
    if (n === 2 && !cuenta()) return;
    paso = n;
    vibrar(6);
    refrescar();
    raiz.closest(".hoja")?.scrollTo({ top: 0 });
    if (n === 2 && !cliente.nombre.trim() && !matchMedia("(pointer: coarse)").matches) campoNombre.focus();
  }

  function listaProductos() {
    if (!cuenta()) {
      return h("div", { class: "vacio" }, svgDe(SVG_BOLSA),
        h("b", null, "Tu pedido está vacío"),
        h("p", null, "Elige algo rico del menú y aparecerá aquí."),
        DESTACADOS.length ? h("button", { class: "boton rojo toca", type: "button", onclick: () => {
          cerrar?.();
          setTimeout(() => $("destacados")?.scrollIntoView({ behavior: SIN_MOVIMIENTO() ? "auto" : "smooth", block: "start" }), enHoja ? 220 : 0);
        } }, "🔥 Ver lo más pedido") : null);
    }
    return h("ul", { class: "pedido-lineas" }, lineas().map((l) =>
      h("li", null,
        l.producto.foto ? imagen(l.producto.foto, { clase: "linea-foto", sizes: "52px", ancho: 52, alto: 52 }) : h("span", { class: "linea-foto", "aria-hidden": "true" }, CAT_POR_ID.get(l.producto.cat)?.emoji || "🍽️"),
        h("div", { class: "linea-texto" }, h("b", null, nombreLinea(l)),
          textoExtras(l) ? h("span", { class: "linea-extras" }, textoExtras(l)) : null,
          h("span", { class: "num" }, usd(l.cant * l.unitario))),
        h("span", { class: "paso" },
          h("button", { type: "button", "aria-label": l.cant === 1 ? `Eliminar ${nombreLinea(l)}` : `Quitar uno de ${nombreLinea(l)}`, onclick: () => { vibrar(6); cambiar(l.id, l.opcion, -1, l.extras); } }, icono(l.cant === 1 ? "basura" : "menos", 17)),
          h("output", { class: "num" }, String(l.cant)),
          h("button", { type: "button", "aria-label": `Agregar otro de ${nombreLinea(l)}`, onclick: () => { vibrar(6); cambiar(l.id, l.opcion, 1, l.extras); } }, icono("mas", 17))),
      )));
  }

  function sugerencias() {
    const enPedido = new Set(lineas().map((l) => l.id));
    const lista = SUGERENCIAS.map((id) => POR_ID.get(id)).filter((p) => p && !p.agotado && !enPedido.has(p.id));
    if (!cuenta() || !lista.length) return null;
    return h("div", { class: "sugerencias" }, h("h3", null, "Te puede gustar"),
      h("div", { class: "sugerencias-carril" }, lista.map((p) =>
        h("button", { class: "sugerencia", type: "button", "aria-label": `Agregar ${p.nombre}, ${usd(p.precio)}`, onclick: (e) => {
          const foto = e.currentTarget.querySelector("img");
          vibrar(); cambiar(p.id, "", 1); volarAlPedido(foto); avisar(`Agregaste ${p.nombre}`);
        } },
          p.foto ? imagen(p.foto, { sizes: "36px", ancho: 36, alto: 36 }) : h("span", { class: "sug-emoji" }, CAT_POR_ID.get(p.cat)?.emoji || "🍽️"),
          h("span", null, p.nombre.replace(/^Ración de /, "")), h("span", { class: "num" }, `+${usd(p.precio)}`)))));
  }

  function refrescarDatos() {
    for (const b of botonesTipo) b.setAttribute("aria-pressed", String(b.dataset.tipo === cliente.tipo));
    bloqueDir.hidden = cliente.tipo !== "D";
    pintarPagos();
    contador.textContent = String(cliente.notas.length);
    for (const v of vistasPedido) if (v !== vista) v.sincronizar();
    const est = HORARIO ? estadoHorario(HORARIO) : { abierto: true };
    avisoCerrado.hidden = est.abierto || !cuenta();
    avisoCerrado.textContent = est.abierto ? "" : `${est.texto}. Puedes enviar tu pedido y te respondemos al abrir.`;
    const f = falta();
    mensaje.textContent = f;
    botonEnviar.setAttribute("aria-disabled", String(!cuenta() || Boolean(f)));
  }

  function refrescar() {
    sincronizar();
    const n = cuenta();
    if (!n) paso = 1;
    contadorCabeza.textContent = n ? `(${n})` : "";
    if (pasos) {
      pasos.hidden = !n;
      reemplazar(pasos,
        h("button", { type: "button", "aria-current": paso === 1 ? "step" : null, onclick: () => irPaso(1) }, h("span", { class: "num-paso" }, "1"), "Productos"),
        h("button", { type: "button", "aria-current": paso === 2 ? "step" : null, onclick: () => irPaso(2) }, h("span", { class: "num-paso" }, "2"), "Entrega"));
    }
    const resumen = n ? h("div", { class: "total-fila" }, h("b", null, "Total a pagar"), totalTexto) : null;
    if (!enHoja) {
      reemplazar(cuerpo, h("div", { class: "pedido-paso" }, listaProductos(), sugerencias(), n ? h("div", { style: { marginTop: "18px" } }, datos) : null));
      reemplazar(pie, resumen, n ? h("div", { class: "hoja-pie-fila" }, botonEnviar) : null, mensaje);
      pie.hidden = !n;
    } else if (paso === 1) {
      reemplazar(cuerpo, h("div", { class: "pedido-paso" }, listaProductos(), sugerencias()));
      reemplazar(pie, resumen, n ? h("div", { class: "hoja-pie-fila" }, botonContinuar) : null);
      pie.hidden = !n;
    } else {
      reemplazar(cuerpo, h("div", { class: "pedido-paso" }, datos));
      reemplazar(pie, resumen, h("div", { class: "hoja-pie-fila" }, botonVolver, botonEnviar), mensaje);
      pie.hidden = false;
    }
    contar(totalTexto, total());
    contar(precioContinuar, total());
    refrescarDatos();
  }

  // Si el cliente escribe en una vista (hoja o columna), la otra se pone al día sin perder lo escrito
  function sincronizar() {
    if (document.activeElement !== campoNombre) campoNombre.value = cliente.nombre;
    if (document.activeElement !== campoDir) campoDir.value = cliente.direccion;
    if (document.activeElement !== campoNotas) campoNotas.value = cliente.notas;
    for (const b of botonesTipo) b.setAttribute("aria-pressed", String(b.dataset.tipo === cliente.tipo));
    bloqueDir.hidden = cliente.tipo !== "D";
    pintarPagos();
  }

  const vista = { raiz, refrescar, sincronizar, cabeza };
  vistasPedido.add(vista);
  refrescar();
  return vista;
}

let cerrarHojaPedido = null;
function abrirPedido() {
  if (cerrarHojaPedido) return;
  document.querySelector(".aviso-flotante")?.remove(); // el aviso de "Agregaste…" ya cumplió
  let vista;
  cerrarHojaPedido = abrirHoja("Tu pedido", (cuerpo, cerrar, hoja) => {
    vista = crearPedido({ enHoja: true, cerrar });
    const asa = h("span", { class: "asa", "aria-hidden": "true" });
    reemplazar(hoja, asa, vista.raiz); // la hoja del pedido trae su propia cabecera
    hacerArrastrable(hoja, cerrar, vista.cabeza);
  }, { historial: true, alCerrar: () => { vistasPedido.delete(vista); cerrarHojaPedido = null; } });
}

function actualizarBarra(saltarBarra) {
  const n = cuenta();
  const barra = $("barra-pedido");
  const totalEl = barra.querySelector(".barra-total .num");
  if (!barra.dataset.armada) {
    barra.dataset.armada = "1";
    reemplazar(barra,
      h("span", { class: "barra-icono" }, icono("bolsa", 22), h("span", { class: "bolsa-cuenta num", hidden: true }, "0")),
      h("span", { class: "barra-textos" }, h("b"), h("small")),
      h("span", { class: "barra-total" }, h("span", { class: "num" }, usd(0)), icono("flecha_der", 18)));
    return actualizarBarra(saltarBarra);
  }
  barra.classList.toggle("vacia", n === 0);
  barra.querySelector(".barra-textos b").textContent = n ? "Ver tu pedido" : "Arma tu pedido";
  barra.querySelector(".barra-textos small").textContent = n ? `${n} producto${n > 1 ? "s" : ""}` : "Toca un producto para empezar";
  const burbuja = barra.querySelector(".bolsa-cuenta");
  burbuja.hidden = n === 0;
  burbuja.textContent = String(n);
  barra.querySelector(".barra-total").hidden = n === 0;
  contar(totalEl, total());
  barra.setAttribute("aria-label", n ? `Ver tu pedido: ${n} productos, ${usd(total())}` : "Tu pedido está vacío");
  const insignia = $("bolsa-cuenta");
  insignia.hidden = n === 0;
  insignia.textContent = String(n);
  $("boton-bolsa").setAttribute("aria-label", n ? `Ver tu pedido, ${n} productos` : "Ver tu pedido");
  if (saltarBarra) { saltar(barra); saltar(burbuja); saltar(insignia); }
}

function actualizarTarjetas(id, sumo) {
  const p = POR_ID.get(id);
  if (!p) return;
  const n = cantidadDe(id);
  for (const t of document.querySelectorAll(`[data-pid="${CSS.escape(id)}"]`)) {
    const b = t.querySelector(".cuenta-tarjeta");
    if (b) {
      b.hidden = !n;
      b.textContent = String(n);
      if (sumo && n) saltar(b);
    }
    t.setAttribute("aria-label", etiquetaAccion(p));
  }
}

function actualizarTodo(idCambiado, sumo = false) {
  if (idCambiado) actualizarTarjetas(idCambiado, sumo);
  const repetir = $("repetir");
  if (repetir) repetir.hidden = cuenta() > 0;
  for (const v of vistasPedido) v.refrescar();
  actualizarBarra(sumo);
}

/* ───────── Enviar por WhatsApp ───────── */
function armarMensaje(codigo, enlacePanel) {
  const nota = limpiar(cliente.notas, NOTA_MAX);
  return [
    `*¡Nuevo pedido en ${NEGOCIO.nombre}!* 🔥`,
    `*Código:* ${codigo}`,
    LINEA,
    `*Cliente:* ${limpiar(cliente.nombre, 60)}`,
    `*Tipo:* ${TIPOS_ENTREGA[cliente.tipo]}`,
    ...(cliente.tipo === "D" ? [`*Dirección:* ${limpiar(cliente.direccion, 200)}`] : []),
    ...(cliente.pago ? [`*Pago:* ${nombrePago(cliente.pago)}`] : []),
    LINEA,
    "*Detalle del pedido:*",
    ...lineas().flatMap((l) => [
      `- ${l.cant}x ${nombreLinea(l)} - ${usd(l.cant * l.unitario)}`,
      ...(l.extrasProductos.length ? [`   ${textoExtras(l)}`] : []),
    ]),
    LINEA,
    `*Total a pagar:* ${usd(total())}`,
    LINEA,
    ...(nota ? [`📝 *Notas para la cocina:* ${nota}`, LINEA] : []),
    "¡Quedo a la espera de su confirmación!",
    "",
    "Para el local (carga el pedido en el sistema):",
    enlacePanel,
  ].join("\n");
}

function enviar(evento) {
  if (!cuenta() || falta()) {
    evento.preventDefault();
    vibrar(30);
    const pedido = evento.currentTarget.closest(".pedido");
    if (!cliente.nombre.trim()) pedido?.querySelector('input[id^="nombre-"]')?.focus();
    else if (cliente.tipo === "D" && !cliente.direccion.trim()) pedido?.querySelector('input[id^="dir-"]')?.focus();
    else if (!cliente.pago) {
      const bloque = pedido?.querySelector(".bloque-pagos");
      bloque?.scrollIntoView({ block: "center", behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
      bloque?.classList.remove("error"); void bloque?.offsetWidth; bloque?.classList.add("error");
    }
    return;
  }
  const codigo = codigoPedido();
  const datos = {
    v: 1,
    c: codigo,
    n: limpiar(cliente.nombre, 60),
    t: cliente.tipo,
    d: cliente.tipo === "D" ? limpiar(cliente.direccion, 200) : "",
    o: limpiar(cliente.notas, NOTA_MAX),
    m: cliente.pago,
    // Cada adicional va como línea propia, con su cantidad total y a qué producto va
    i: lineas().flatMap((l) => [
      l.opcion ? [l.id, l.cant, l.opcion] : [l.id, l.cant],
      ...[...agrupar(l.extras)].map(([e, n]) => [e, l.cant * n, `para ${nombreLinea(l)}`]),
    ]),
    s: total(),
    f: Math.floor(Date.now() / 1000),
  };
  const enlacePanel = `${new URL(RUTA_PANEL, location.href).href}#p=${codificarPedido(datos)}`;
  guardado.escribir(localStorage, "sd-ultimo", { fecha: Date.now(), lineas: [...carrito.values()].map(({ id, opcion, extras, cant }) => ({ id, opcion, extras, cant })) });
  guardado.escribir(sessionStorage, "sd-repetir-oculto", true);
  const url = enlaceWhatsApp(NEGOCIO.whatsapp, armarMensaje(codigo, enlacePanel));
  evento.currentTarget.href = url; // el navegador abre WhatsApp con este enlace al terminar el clic
  setTimeout(() => mostrarEnviado(codigo, url), 0);
}

function mostrarEnviado(codigo, url) {
  cerrarHojaPedido?.();
  abrirHoja("¡Ya casi!", (cuerpo, cerrar) => {
    poner(cuerpo,
      h("div", { class: "vacio", style: { paddingTop: "4px" } }, svgDe(SVG_BOLSA),
        h("b", null, "Se abrió WhatsApp con tu pedido"),
        h("p", null, "Toca enviar en el chat para que te lo confirmemos."),
        h("p", { class: "num", style: { fontWeight: 600, color: "var(--tinta)" } }, `Código de tu pedido: ${codigo}`),
        ES_NAVIDAD() ? h("p", { class: "mensaje-fiestas" }, "🎄 ¡Felices fiestas de parte de Son D'licias!") : null),
      DEMO ? h("p", { class: "ayuda", style: { marginTop: "8px" } }, "Demo: copia ese mensaje de WhatsApp y pégalo en el panel, en Pedidos → Pegar pedido.") : null,
      h("div", { style: { display: "grid", gap: "10px", marginTop: "8px" } },
        h("a", { class: "boton verde ancho toca", href: url, target: "_blank", rel: "noopener" }, icono("enviar", 20), "Abrir WhatsApp otra vez"),
        h("button", { class: "boton suave ancho toca", type: "button", onclick: () => {
          const ids = [...new Set(lineas().map((l) => l.id))];
          carrito.clear();
          cliente.notas = "";
          guardado.escribir(sessionStorage, "sd-carrito", []);
          ids.forEach((id) => actualizarTarjetas(id));
          actualizarTodo();
          cerrar();
          avisar("Listo para un pedido nuevo");
        } }, "Empezar otro pedido"),
      ),
    );
  }, { historial: true });
}

/* ───────── Repetir el último pedido (clientes que vuelven) ───────── */
function lineasUltimoPedido() {
  const ultimo = guardado.leer(localStorage, "sd-ultimo", null);
  if (!ultimo || !Array.isArray(ultimo.lineas)) return [];
  return ultimo.lineas.filter((l) => {
    const p = POR_ID.get(l?.id);
    if (!p || p.agotado || !(l.cant > 0)) return false;
    if (p.opciones?.length && !p.opciones.includes(l.opcion)) return false; // la opción ya no existe
    return (l.extras || []).every((e) => ES_ADICIONAL(POR_ID.get(e)) && !POR_ID.get(e).agotado);
  }).map((l) => ({ id: l.id, opcion: l.opcion || "", extras: (l.extras || []).slice(0, MAX_EXTRAS), cant: Math.min(99, l.cant) }));
}

function tarjetaRepetir() {
  const previas = lineasUltimoPedido();
  if (!previas.length || guardado.leer(sessionStorage, "sd-repetir-oculto", false)) return null;
  const unidades = previas.reduce((s, l) => s + l.cant, 0);
  const totalPrevio = redondear(previas.reduce((s, l) => {
    const unit = POR_ID.get(l.id).precio + l.extras.reduce((t, e) => t + POR_ID.get(e).precio, 0);
    return s + unit * l.cant;
  }, 0));
  const primera = previas[0];
  const nombre = `${primera.cant > 1 ? `${primera.cant}× ` : ""}${POR_ID.get(primera.id).nombre}${primera.opcion ? ` (${primera.opcion})` : ""}`;
  const resto = previas.length - 1;
  const tarjeta = h("div", { class: "repetir", id: "repetir", hidden: cuenta() > 0 },
    h("span", { class: "repetir-icono", "aria-hidden": "true" }, icono("repetir", 22)),
    h("span", { class: "repetir-textos" },
      h("b", null, "¿Lo mismo de la última vez?"),
      h("span", { class: "repetir-detalle" },
        h("span", { class: "repetir-nombre" }, `${nombre}${resto ? ` y ${resto} más` : ""}`),
        h("span", { class: "num" }, `· ${usd(totalPrevio)}`))),
    h("button", { class: "boton rojo toca", type: "button", "aria-label": `Repetir tu último pedido: ${unidades} productos, ${usd(totalPrevio)}`, onclick: () => {
      vibrar(12);
      for (const l of previas) {
        const k = claveLinea(l.id, l.opcion, l.extras);
        carrito.set(k, { id: l.id, opcion: l.opcion, extras: [...l.extras], cant: Math.min(99, (carrito.get(k)?.cant || 0) + l.cant) });
      }
      guardado.escribir(sessionStorage, "sd-carrito", [...carrito.entries()]);
      new Set(previas.map((l) => l.id)).forEach((id) => actualizarTarjetas(id, true));
      actualizarTodo(null, true);
      avisar("Pedido anterior agregado");
      if (ES_ESCRITORIO()) saltar($("pedido-lateral")); else abrirPedido();
    } }, "Repetir"),
    h("button", { class: "repetir-cerrar", type: "button", "aria-label": "Ocultar", onclick: () => {
      guardado.escribir(sessionStorage, "sd-repetir-oculto", true);
      tarjeta.remove();
    } }, icono("x", 16)));
  return tarjeta;
}

/* ───────── Arranque ───────── */
// Íconos que el HTML deja reservados con su tamaño (así nada se mueve al aparecer)
for (const el of document.querySelectorAll("[data-ico]")) el.replaceWith(icono(el.dataset.ico, Number(el.dataset.tam) || 20));
$("boton-bolsa").addEventListener("click", () => {
  if (ES_ESCRITORIO()) {
    const caja = $("pedido-lateral");
    caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
    saltar(caja);
  } else abrirPedido();
});
$("barra-pedido").addEventListener("click", () => { vibrar(6); abrirPedido(); });
$("boton-buscar").addEventListener("click", () => {
  const b = $("buscar");
  const destino = b.closest(".buscador").getBoundingClientRect().top + scrollY - $("cabecera").offsetHeight - 8;
  scrollTo({ top: destino, behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" });
  b.focus({ preventScroll: true });
});
let temporizadorBusqueda;
$("buscar").addEventListener("input", (e) => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(() => filtrar(e.target.value), 120);
});
$("buscar").addEventListener("keydown", (e) => { if (e.key === "Escape") limpiarBusqueda(false); if (e.key === "Enter") e.target.blur(); });
$("buscar-limpiar").addEventListener("click", () => limpiarBusqueda(true));

if (DEMO) {
  document.body.prepend(h("div", { class: "barra-demo" },
    h("span", null, "Demo de EU Digital Solutions"),
    h("a", { href: RUTA_PANEL }, "Abrir el panel del local")));
}
pintarMenu();
actualizarBarra();
activarNavidad();

// La columna del pedido solo existe en pantallas grandes; en el teléfono no se arma (menos trabajo)
const pantallaGrande = matchMedia("(min-width: 1024px)");
let lateralMontado = false;
function montarLateral() {
  if (lateralMontado || !pantallaGrande.matches) return;
  lateralMontado = true;
  poner($("pedido-lateral"), crearPedido({ enHoja: false }).raiz);
}
montarLateral();
if (pantallaGrande.addEventListener) pantallaGrande.addEventListener("change", montarLateral);
else pantallaGrande.addListener?.(montarLateral);

// Con el teclado abierto, la hoja se ajusta al espacio visible y el campo activo queda a la vista
const vv = window.visualViewport;
if (vv) {
  const raiz = document.documentElement;
  const ajustar = () => {
    raiz.style.setProperty("--vv-alto", `${Math.round(vv.height)}px`);
    raiz.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
  };
  vv.addEventListener("resize", ajustar);
  vv.addEventListener("scroll", ajustar);
  ajustar();
}
document.addEventListener("focusin", (e) => {
  const campo = e.target;
  if (!campo.matches?.(".hoja input, .hoja textarea")) return;
  setTimeout(() => campo.scrollIntoView({ block: "center", behavior: SIN_MOVIMIENTO() ? "auto" : "smooth" }), 320);
});

// La portada (hamburguesa, nieve) deja de animarse cuando no se ve
const portada = document.querySelector(".portada");
if (portada && "IntersectionObserver" in window) {
  new IntersectionObserver(([e]) => portada.classList.toggle("pausada", !e.isIntersecting)).observe(portada);
}

function refrescarHorario() {
  if (!HORARIO) return;
  const { abierto, corto } = estadoHorario(HORARIO);
  for (const el of document.querySelectorAll("[data-horario]")) {
    el.className = `estado-horario chico ${abierto ? "abierto" : "cerrado"}`;
    el.textContent = abierto ? "Abierto ahora" : "Cerrado";
  }
  const linea = $("estado-portada");
  if (linea) {
    linea.className = `estado-portada ${abierto ? "abierto" : "cerrado"}`;
    linea.textContent = corto;
  }
  for (const v of vistasPedido) v.refrescar();
}
refrescarHorario();
setInterval(refrescarHorario, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescarHorario(); });

const medir = () => document.documentElement.style.setProperty("--alto-cabecera", `${$("cabecera").offsetHeight}px`);
medir();
if ("ResizeObserver" in window) new ResizeObserver(medir).observe($("cabecera"));
else addEventListener("resize", medir);
const sombraCabecera = () => $("cabecera").classList.toggle("con-sombra", scrollY > 8);
addEventListener("scroll", sombraCabecera, { passive: true });
sombraCabecera();
