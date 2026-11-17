/* Arranque del panel: entrada con contraseña, pestañas y pedidos que llegan por enlace. */
import { poner, reemplazar } from "../comun.js";
import { leerPedidoDeTexto, numero } from "../comun.js";
import { NEGOCIO, DEMO } from "../../menu.js";
import { h, icono, abrirHoja, avisar, campoMonto, intentar } from "./ui.js";
import { cargar, estado, alCambiarEnOtraPestana, protegerAlmacenamiento, soloEnMemoria } from "./datos.js";
import { pantallaEntrada, estaAbierto, bloquear } from "./seguridad.js";
import { sembrarCatalogo, importarPedido, tasa, ponerTasa } from "./negocio.js";
import * as Pedidos from "./pedidos.js";
import * as Caja from "./caja.js";
import * as Productos from "./productos.js";
import * as Finanzas from "./finanzas.js";
import * as Mas from "./mas.js";

const PESTANAS = [
  { id: "pedidos", texto: "Pedidos", icono: "campana", modulo: Pedidos },
  { id: "caja", texto: "Caja", icono: "caja", modulo: Caja },
  { id: "productos", texto: "Productos", icono: "etiqueta", modulo: Productos },
  { id: "finanzas", texto: "Finanzas", icono: "grafica", modulo: Finanzas },
  { id: "mas", texto: "Más", icono: "menu", modulo: Mas },
];

const raiz = document.getElementById("app");
let pestana = sessionStorage.getItem("sd-pestana") || "pedidos";
let opcionesVista = {};
let instalar = null;

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); instalar = e; });

export const app = {
  ir(id, opciones = {}) {
    pestana = id;
    opcionesVista = opciones;
    sessionStorage.setItem("sd-pestana", id);
    pintar();
    window.scrollTo({ top: 0 });
  },
  refrescar: () => pintar(),
  pedirTasa,
  cargarTexto: (texto) => cargarDesdeTexto(texto),
  get instalar() { return instalar; },
  bloquear() { bloquear(); arrancar(); },
};

function cabecera() {
  const t = tasa();
  const chip = h("button", { class: `chip-tasa toca ${t?.deHoy ? "" : "falta-tasa"}`, type: "button", onclick: () => pedirTasa() },
    t ? `Tasa ${numero(t.valor)}${t.deHoy ? "" : " (vieja)"}` : "Poner tasa");
  return h("header", { class: "p-cabecera" },
    h("div", { class: "p-cabecera-fila" },
      h("div", { class: "insignia" }, h("img", { src: "img/logo.webp", alt: "", width: 228, height: 166 })),
      h("div", { class: "p-titulo" }, h("b", null, "Panel"), h("span", null, NEGOCIO.nombre)),
      chip,
      h("button", { class: "redondo toca", type: "button", "aria-label": "Bloquear el panel", onclick: () => app.bloquear() }, icono("candado", 20)),
    ),
    h("div", { class: "franja-llama" }));
}

function barraPestanas() {
  const nuevos = estado.ventas.filter((v) => v.estado === "pendiente").length;
  return h("nav", { class: "p-pestanas", "aria-label": "Secciones del panel" },
    PESTANAS.map((p) => h("button", {
      type: "button", "aria-current": p.id === pestana ? "page" : null, onclick: () => app.ir(p.id),
    }, icono(p.icono, 22), p.texto,
    p.id === "pedidos" && nuevos ? h("span", { class: "burbuja num", "aria-label": `${nuevos} nuevos` }, String(nuevos)) : null)));
}

function pintar() {
  const actual = PESTANAS.find((p) => p.id === pestana) || PESTANAS[0];
  const vista = h("main", { class: "p-contenido", id: "vista" });
  reemplazar(raiz,
    DEMO ? h("div", { class: "barra-demo" }, h("span", null, "Demo: los datos quedan en este navegador"), h("a", { href: "index.html" }, "Ver la tienda")) : null,
    cabecera(),
    soloEnMemoria() ? h("div", { class: "barra-demo", style: { background: "var(--mostaza)", color: "#000" } }, "Este navegador no deja guardar datos: lo que registres se borra al cerrar.") : null,
    vista, barraPestanas());
  try {
    actual.modulo.pintar(vista, app, opcionesVista);
  } catch (e) {
    console.error(e);
    poner(vista, h("div", { class: "aviso-caja" }, "Algo falló al mostrar esta pantalla. Toca otra pestaña y vuelve."));
  }
  opcionesVista = {};
}

/* Tasa del día */
function pedirTasa(alListo) {
  const actual = tasa();
  abrirHoja("Tasa del día", (cuerpo, cerrar) => {
    const monto = campoMonto({ id: "tasa", etiqueta: "Bolívares por 1 dólar", moneda: "VES", valor: actual?.valor ?? "", autofocus: true, ayuda: "Se usa para cobrar y registrar en bolívares" });
    const form = h("form", { class: "form" }, monto.nodo,
      actual && !actual.deHoy ? h("p", { class: "ayuda" }, `La última tasa es del ${actual.dia}.`) : null,
      h("button", { class: "boton verde ancho toca", type: "submit" }, "Guardar tasa"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = monto.valor();
      if (!(v > 0)) { avisar("Escribe una tasa mayor que cero"); return; }
      if (await intentar(() => ponerTasa(v), "Tasa guardada")) { cerrar(); pintar(); alListo?.(); }
    });
    poner(cuerpo, form);
  });
}

/* Pedido que llega desde el enlace del WhatsApp (#p=...) */
async function revisarEnlace() {
  const datos = leerPedidoDeTexto(location.hash);
  if (!location.hash.includes("p=")) return;
  history.replaceState(null, "", location.pathname + location.search);
  if (!datos) { avisar("Ese enlace de pedido no se pudo leer"); return; }
  const { venta, repetido } = await importarPedido(datos);
  avisar(repetido ? `El pedido de ${venta.cliente} ya estaba cargado` : `Pedido de ${venta.cliente} cargado`);
  app.ir("pedidos", { resaltar: venta.id });
}
async function cargarDesdeTexto(texto) {
  const datos = leerPedidoDeTexto(texto);
  if (!datos) return false;
  const { venta, repetido } = await importarPedido(datos);
  avisar(repetido ? `El pedido de ${venta.cliente} ya estaba cargado` : `Pedido de ${venta.cliente} cargado`);
  app.ir("pedidos", { resaltar: venta.id });
  return true;
}

async function entrar() {
  await sembrarCatalogo();
  protegerAlmacenamiento();
  pintar();
  await revisarEnlace();
}

async function arrancar() {
  if (estaAbierto()) return entrar();
  pantallaEntrada(raiz, entrar);
}

window.addEventListener("hashchange", () => { if (estaAbierto()) revisarEnlace(); });
alCambiarEnOtraPestana(() => { if (estaAbierto() && !document.querySelector(".fondo-hoja")) pintar(); });

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js", { scope: "admin" }).catch(() => { /* sin modo sin conexión */ });
}

try {
  await cargar();
  await arrancar();
} catch (e) {
  console.error(e);
  reemplazar(raiz, h("div", { class: "p-contenido" }, h("div", { class: "aviso-caja" },
    "No se pudo abrir el almacenamiento del teléfono. Abre el panel en Chrome (no en modo incógnito) y vuelve a intentar.")));
}
