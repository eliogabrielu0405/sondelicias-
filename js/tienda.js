import { poner, reemplazar } from "./comun.js";
import { NEGOCIO, CATEGORIAS, PRODUCTOS, DEMO, RUTA_PANEL } from "../menu.js";
import { h, icono, usd, limpiar, redondear, codigoPedido, codificarPedido, enlaceWhatsApp, TIPOS_ENTREGA, abrirHoja, avisar } from "./comun.js";

const NOTA_MAX = 200;
const LINEA = "----------------------------------------";
const POR_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));
const $ = (id) => document.getElementById(id);

/* ───────── Estado (el carrito vive en esta pestaña; los datos del cliente se recuerdan en su teléfono) ───────── */
const guardado = {
  leer(almacen, clave, porDefecto) {
    try { return JSON.parse(almacen.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
  },
  escribir(almacen, clave, valor) {
    try { almacen.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: no pasa nada */ }
  },
};

const carrito = new Map(
  guardado.leer(sessionStorage, "sd-carrito", [])
    .filter(([, l]) => l && POR_ID.has(l.id) && l.cant > 0)
);
const cliente = { nombre: "", tipo: "L", direccion: "", notas: "", ...guardado.leer(localStorage, "sd-cliente", {}) };
if (!TIPOS_ENTREGA[cliente.tipo]) cliente.tipo = "L";

const claveLinea = (id, opcion) => `${id}|${opcion || ""}`;
const lineas = () =>
  [...carrito.values()].map((l) => ({ ...l, producto: POR_ID.get(l.id) })).filter((l) => l.producto);
const cuenta = () => lineas().reduce((s, l) => s + l.cant, 0);
const total = () => redondear(lineas().reduce((s, l) => s + l.cant * l.producto.precio, 0));
const cantidadDe = (id) => lineas().filter((l) => l.id === id).reduce((s, l) => s + l.cant, 0);

function cambiar(id, opcion, delta) {
  const k = claveLinea(id, opcion);
  const actual = carrito.get(k)?.cant || 0;
  const nueva = Math.max(0, Math.min(99, actual + delta));
  if (nueva) carrito.set(k, { id, opcion: opcion || "", cant: nueva });
  else carrito.delete(k);
  guardado.escribir(sessionStorage, "sd-carrito", [...carrito.entries()]);
  actualizarTodo(id);
}

function guardarCliente() {
  const { nombre, tipo, direccion } = cliente;
  guardado.escribir(localStorage, "sd-cliente", { nombre, tipo, direccion });
}

const nombreLinea = (l) => (l.opcion ? `${l.producto.nombre} (${l.opcion})` : l.producto.nombre);

function falta() {
  if (!cuenta()) return "";
  if (!cliente.nombre.trim()) return "Escribe tu nombre para enviar el pedido.";
  if (cliente.tipo === "D" && !cliente.direccion.trim()) return "Escribe la dirección para el delivery.";
  return "";
}

/* ───────── Menú ───────── */
function botonCantidad(cant, onMenos, onMas, nombre) {
  return h("div", { class: "cantidad" },
    h("button", { class: "redondo toca", type: "button", "aria-label": `Quitar uno de ${nombre}`, onclick: onMenos }, icono("menos", 20)),
    h("output", { class: "num", "aria-live": "polite" }, String(cant)),
    h("button", { class: "redondo toca", type: "button", "aria-label": `Agregar otro de ${nombre}`, onclick: onMas }, icono("mas", 20)),
  );
}

function pieProducto(p) {
  const pie = h("div", { class: "producto-pie", id: `pie-${p.id}` }, h("span", { class: "precio num" }, usd(p.precio)));
  const cant = cantidadDe(p.id);
  if (p.opciones?.length) {
    poner(pie, h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
      cant ? h("span", { class: "en-pedido num" }, `${cant} en tu pedido`) : null,
      h("button", { class: "agregar toca", type: "button", onclick: () => abrirOpciones(p) }, icono("mas", 18), "Agregar"),
    ));
  } else if (cant) {
    poner(pie, botonCantidad(cant, () => cambiar(p.id, "", -1), () => cambiar(p.id, "", 1), p.nombre));
  } else {
    poner(pie, h("button", {
      class: "agregar toca", type: "button",
      onclick: () => { cambiar(p.id, "", 1); avisar(`Agregaste ${p.nombre}`); },
    }, icono("mas", 18), "Agregar"));
  }
  return pie;
}

function tarjeta(p) {
  return h("article", { class: "producto caja" },
    p.foto ? h("img", { class: "producto-foto", src: p.foto, alt: "", loading: "lazy", width: 84, height: 84 }) : null,
    h("div", { class: "producto-info" },
      h("h3", null, p.nombre),
      p.desc ? h("p", { class: "desc" }, p.desc) : null,
      p.opciones?.length ? h("p", { class: "opciones-texto" }, `Elige: ${p.opciones.join(", ").replace(/, ([^,]*)$/, " o $1")}`) : null,
      pieProducto(p),
    ),
  );
}

function pintarMenu() {
  const nav = $("categorias");
  const menu = $("menu");
  for (const c of CATEGORIAS) {
    const productos = PRODUCTOS.filter((p) => p.cat === c.id);
    if (!productos.length) continue;
    poner(nav, h("a", { class: "categoria toca", href: `#cat-${c.id}`, dataset: { cat: c.id } },
      h("span", { class: "emo", "aria-hidden": "true" }, c.emoji), c.corto || c.nombre));
    poner(menu, h("section", { class: "seccion", id: `cat-${c.id}`, "aria-labelledby": `titulo-${c.id}` },
      h("div", { class: "franja" },
        c.foto ? h("img", { class: "franja-foto", src: c.foto, alt: "", loading: "lazy" }) : h("span", { class: "franja-emoji", "aria-hidden": "true" }, c.emoji),
        h("h2", { id: `titulo-${c.id}` }, c.nombre),
      ),
      c.nota ? h("p", { class: "seccion-nota" }, c.nota) : null,
      h("div", { class: "lista" }, productos.map(tarjeta)),
    ));
  }
  poner(menu, h("footer", { class: "pie" },
    h("a", { href: `https://wa.me/${NEGOCIO.whatsapp}` }, icono("telefono", 18), `Delivery y pedidos: ${NEGOCIO.telefono}`),
    NEGOCIO.instagram ? h("a", { href: `https://www.instagram.com/${NEGOCIO.instagram}/`, rel: "noopener" }, icono("instagram", 18), `@${NEGOCIO.instagram}`) : null,
    NEGOCIO.ciudad ? h("span", { style: { display: "inline-flex", alignItems: "center", gap: "8px" } }, icono("pin", 18), NEGOCIO.ciudad) : null,
  ));

  poner($("portada-acciones"), 
    h("a", { class: "pastilla", href: `tel:+${NEGOCIO.whatsapp}` }, icono("telefono", 18), `Delivery ${NEGOCIO.telefono}`),
    NEGOCIO.instagram ? h("a", { class: "pastilla", href: `https://www.instagram.com/${NEGOCIO.instagram}/`, rel: "noopener" }, icono("instagram", 18), `@${NEGOCIO.instagram}`) : null,
  );

  // Marca la categoría que se está viendo
  const enlaces = new Map([...nav.querySelectorAll(".categoria")].map((a) => [a.dataset.cat, a]));
  const visibles = new Set();
  const observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) e.isIntersecting ? visibles.add(e.target.id) : visibles.delete(e.target.id);
    const primera = CATEGORIAS.map((c) => `cat-${c.id}`).find((id) => visibles.has(id));
    if (!primera) return;
    for (const [cat, a] of enlaces) {
      const activa = `cat-${cat}` === primera;
      if (activa && a.getAttribute("aria-current") !== "true") a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      a.setAttribute("aria-current", activa ? "true" : "false");
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  menu.querySelectorAll(".seccion").forEach((s) => observador.observe(s));
}

/* ───────── Elegir opción ───────── */
function abrirOpciones(p) {
  const cerrar = abrirHoja(p.nombre, (cuerpo) => {
    poner(cuerpo, 
      h("p", { style: { marginBottom: "12px", color: "var(--tenue)" } }, "Toca una opción para agregarla a tu pedido."),
      h("div", { class: "opciones" }, p.opciones.map((op) => {
        const ya = carrito.get(claveLinea(p.id, op))?.cant || 0;
        return h("button", {
          class: "opcion toca", type: "button",
          onclick: () => { cambiar(p.id, op, 1); cerrar(); avisar(`Agregaste ${p.nombre} (${op})`); },
        }, h("span", null, op), ya ? h("small", { class: "num" }, `${ya} en tu pedido`) : icono("mas", 20));
      })),
    );
  });
}

/* ───────── Pedido ───────── */
const vistasPedido = new Set();

function crearPedido({ enHoja }) {
  const cabeza = h("div", { class: "hoja-cabeza" });
  const lista = h("div", { style: { padding: "4px 16px" } });
  const totalTexto = h("strong", { class: "num" });
  const boton = h("a", { class: "boton verde ancho toca", href: `https://wa.me/${NEGOCIO.whatsapp}`, target: "_blank", rel: "noopener", role: "button", onclick: enviar, style: { minHeight: "56px", fontSize: "17px" } },
    icono("enviar", 22), "Enviar pedido por WhatsApp");
  const mensaje = h("p", { class: "falta", role: "status" });

  const campoNombre = h("input", { class: "campo", id: `nombre-${enHoja ? "h" : "l"}`, value: cliente.nombre, autocomplete: "name", maxLength: 60, placeholder: "¿A nombre de quién?" });
  const campoDir = h("input", { class: "campo", id: `dir-${enHoja ? "h" : "l"}`, value: cliente.direccion, autocomplete: "street-address", maxLength: 200, placeholder: "Calle, casa o edificio y una referencia" });
  const campoNotas = h("textarea", { class: "campo", id: `notas-${enHoja ? "h" : "l"}`, rows: 2, maxLength: NOTA_MAX, placeholder: "Ej: sin cebolla, salsas aparte, la tocineta va en la hamburguesa…" });
  campoNotas.value = cliente.notas;
  const contador = h("span", { class: "num" });
  const bloqueDir = h("div", null,
    h("label", { class: "etiqueta", for: campoDir.id }, "Dirección"), campoDir,
    h("p", { class: "ayuda" }, "El costo del delivery te lo confirmamos por WhatsApp."));

  const botonesTipo = Object.entries(TIPOS_ENTREGA).map(([k, nombre]) =>
    h("button", { class: "tipo toca", type: "button", "aria-pressed": String(cliente.tipo === k), dataset: { tipo: k },
      onclick: () => { cliente.tipo = k; guardarCliente(); refrescarDatos(); } },
      icono({ A: "cubiertos", L: "bolsa", D: "moto" }[k], 22), nombre));

  campoNombre.addEventListener("input", () => { cliente.nombre = campoNombre.value; guardarCliente(); refrescarDatos(); });
  campoDir.addEventListener("input", () => { cliente.direccion = campoDir.value; guardarCliente(); refrescarDatos(); });
  campoNotas.addEventListener("input", () => { cliente.notas = campoNotas.value; refrescarDatos(); });

  const datos = h("div", { class: "pedido-datos" },
    h("div", null, h("label", { class: "etiqueta", for: campoNombre.id }, "Nombre"), campoNombre),
    h("fieldset", { style: { border: 0, padding: 0, margin: 0 } },
      h("legend", { class: "etiqueta" }, "¿Cómo lo quieres?"), h("div", { class: "tipos" }, botonesTipo)),
    bloqueDir,
    h("div", null,
      h("label", { class: "etiqueta", for: campoNotas.id }, "Notas para la cocina ", h("span", { style: { fontWeight: 500, color: "var(--tenue)" } }, "(opcional)")),
      campoNotas,
      h("p", { class: "ayuda", style: { textAlign: "right" }, "aria-hidden": "true" }, contador, `/${NOTA_MAX}`)),
    h("div", { class: "total-fila" }, h("b", null, "Total a pagar"), totalTexto),
    boton, mensaje,
  );

  const raiz = h("div", { class: "pedido" }, cabeza, lista, datos);

  function refrescarDatos() {
    for (const b of botonesTipo) b.setAttribute("aria-pressed", String(b.dataset.tipo === cliente.tipo));
    bloqueDir.hidden = cliente.tipo !== "D";
    contador.textContent = String(cliente.notas.length);
    for (const v of vistasPedido) if (v !== vista) v.sincronizar();
    const f = falta();
    mensaje.textContent = f;
    boton.setAttribute("aria-disabled", String(!cuenta() || Boolean(f)));
  }

  function refrescar() {
    sincronizar();
    const n = cuenta();
    reemplazar(cabeza, h("h2", null, `Tu pedido (${n})`),
      enHoja ? h("button", { class: "redondo toca", type: "button", "aria-label": "Cerrar pedido", onclick: () => cerrarHojaPedido?.() }, icono("x", 22)) : null);
    reemplazar(lista, 
      n === 0
        ? h("p", { class: "pedido-vacio" }, "Aún no hay productos. Elige algo del menú para empezar.")
        : h("ul", { class: "pedido-lineas" }, lineas().map((l) =>
          h("li", null,
            h("div", { class: "linea-texto" }, h("b", null, nombreLinea(l)), h("span", { class: "num" }, usd(l.cant * l.producto.precio))),
            botonCantidad(l.cant, () => cambiar(l.id, l.opcion, -1), () => cambiar(l.id, l.opcion, 1), nombreLinea(l)),
            h("button", { class: "quitar", type: "button", "aria-label": `Eliminar ${nombreLinea(l)}`, onclick: () => cambiar(l.id, l.opcion, -l.cant) }, icono("basura", 20)),
          ))),
    );
    totalTexto.textContent = usd(total());
    refrescarDatos();
  }

  // Si el cliente escribe en una vista (hoja o lateral), la otra se pone al día sin perder lo escrito
  function sincronizar() {
    if (document.activeElement !== campoNombre) campoNombre.value = cliente.nombre;
    if (document.activeElement !== campoDir) campoDir.value = cliente.direccion;
    if (document.activeElement !== campoNotas) campoNotas.value = cliente.notas;
    for (const b of botonesTipo) b.setAttribute("aria-pressed", String(b.dataset.tipo === cliente.tipo));
    bloqueDir.hidden = cliente.tipo !== "D";
  }

  const vista = { raiz, refrescar, sincronizar };
  vistasPedido.add(vista);
  refrescar();
  return vista;
}

let cerrarHojaPedido = null;
function abrirPedido() {
  let vista;
  cerrarHojaPedido = abrirHoja("Tu pedido", (cuerpo, cerrar, hoja) => {
    vista = crearPedido({ enHoja: true });
    reemplazar(hoja, vista.raiz); // la hoja del pedido trae su propia cabecera
  }, { alCerrar: () => { vistasPedido.delete(vista); cerrarHojaPedido = null; actualizarBarra(); } });
  actualizarBarra();
}

function actualizarBarra() {
  const n = cuenta();
  const barra = $("barra-pedido");
  barra.hidden = n === 0 || Boolean(cerrarHojaPedido);
  reemplazar(barra, h("span", null, icono("bolsa", 22), `Ver pedido (${n})`), h("span", { class: "num" }, usd(total())));
  const insignia = $("bolsa-cuenta");
  insignia.hidden = n === 0;
  insignia.textContent = String(n);
  $("boton-bolsa").setAttribute("aria-label", n ? `Ver tu pedido, ${n} productos` : "Ver tu pedido");
}

function actualizarTodo(idCambiado) {
  if (idCambiado) {
    const viejo = $(`pie-${idCambiado}`);
    const enfocado = viejo?.contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
    viejo?.replaceWith(pieProducto(POR_ID.get(idCambiado)));
    if (enfocado) {
      const nuevo = $(`pie-${idCambiado}`);
      (nuevo.querySelector(`[aria-label="${CSS.escape(enfocado)}"]`) || nuevo.querySelector("button"))?.focus();
    }
  }
  for (const v of vistasPedido) v.refrescar();
  actualizarBarra();
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
    LINEA,
    "*Detalle del pedido:*",
    ...lineas().map((l) => `- ${l.cant}x ${nombreLinea(l)} - ${usd(l.cant * l.producto.precio)}`),
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
  if (!cuenta() || falta()) { evento.preventDefault(); return; }
  const codigo = codigoPedido();
  const datos = {
    v: 1,
    c: codigo,
    n: limpiar(cliente.nombre, 60),
    t: cliente.tipo,
    d: cliente.tipo === "D" ? limpiar(cliente.direccion, 200) : "",
    o: limpiar(cliente.notas, NOTA_MAX),
    i: lineas().map((l) => (l.opcion ? [l.id, l.cant, l.opcion] : [l.id, l.cant])),
    s: total(),
    f: Math.floor(Date.now() / 1000),
  };
  const enlacePanel = `${new URL(RUTA_PANEL, location.href).href}#p=${codificarPedido(datos)}`;
  const url = enlaceWhatsApp(NEGOCIO.whatsapp, armarMensaje(codigo, enlacePanel));
  evento.currentTarget.href = url; // el navegador abre WhatsApp con este enlace al terminar el clic
  setTimeout(() => mostrarEnviado(codigo, url), 0);
}

function mostrarEnviado(codigo, url) {
  cerrarHojaPedido?.();
  abrirHoja("¡Ya casi!", (cuerpo, cerrar) => {
    poner(cuerpo, 
      h("p", { style: { fontSize: "17px" } }, "Se abrió WhatsApp con tu pedido. Toca enviar en el chat para que te lo confirmemos."),
      DEMO ? h("p", { class: "ayuda", style: { marginTop: "8px" } }, "Demo: copia ese mensaje de WhatsApp y pégalo en el panel, en Pedidos → Pegar pedido.") : null,
      h("p", { class: "ayuda", style: { marginTop: "8px" } }, `Código de tu pedido: ${codigo}`),
      h("div", { style: { display: "grid", gap: "10px", marginTop: "16px" } },
        h("a", { class: "boton verde ancho toca", href: url, target: "_blank", rel: "noopener" }, icono("enviar", 20), "Abrir WhatsApp otra vez"),
        h("button", { class: "boton ancho toca", type: "button", onclick: () => {
          const ids = [...new Set(lineas().map((l) => l.id))];
          carrito.clear();
          cliente.notas = "";
          guardado.escribir(sessionStorage, "sd-carrito", []);
          ids.forEach((id) => actualizarTodo(id));
          actualizarTodo();
          cerrar();
          avisar("Listo para un pedido nuevo");
        } }, "Empezar otro pedido"),
      ),
    );
  });
}

/* ───────── Arranque ───────── */
$("ico-bolsa").replaceWith(icono("bolsa", 26));
$("boton-bolsa").addEventListener("click", () => {
  if (matchMedia("(min-width: 1024px)").matches) $("pedido-lateral").querySelector("input")?.focus();
  else abrirPedido();
});
$("barra-pedido").addEventListener("click", abrirPedido);

if (DEMO) {
  document.body.prepend(h("div", { class: "barra-demo" },
    h("span", null, "Demo de EU Digital Solutions"),
    h("a", { href: RUTA_PANEL }, "Abrir el panel del local")));
}
pintarMenu();
poner($("pedido-lateral"), crearPedido({ enHoja: false }).raiz);
actualizarBarra();

const medir = () => document.documentElement.style.setProperty("--alto-cabecera", `${$("cabecera").offsetHeight}px`);
medir();
new ResizeObserver(medir).observe($("cabecera"));
