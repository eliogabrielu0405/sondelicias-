/* Productos: precios, agotados, costos y recetas. Inventario de insumos (ingredientes). */
import { poner, reemplazar } from "../comun.js";
import { usd, bs, numero, cantidad, pct, enlaceWhatsApp, leerMonto, enMarco } from "../comun.js";
import { SOPORTE, NEGOCIO } from "../../menu.js";
import { h, icono, abrirHoja, avisar, intentar, confirmar, interruptor, campoMonto, campoTexto, selector, segmento, tituloSeccion, fechaHora, descargar, fotoProducto, fotoDe } from "./ui.js";
import { estado, borrar, guardarJuntos, config } from "./datos.js";
import {
  productosOrdenados, categoriasOrdenadas, guardarProducto, costoDe, preciosDistintos, insumosPorId,
  guardarInsumo, moverInsumo, cuentasActivas, cuentaPorId, tasa,
} from "./negocio.js";
import * as C from "./calculos.js";

let subvista = "precios";

export function pintar(vista, app, opciones = {}) {
  if (opciones.subvista) subvista = opciones.subvista;
  poner(vista, 
    tituloSeccion("Productos"),
    segmento([["precios", "Lista"], ["ajuste", "Ajustar precios"], ["inventario", "Inventario"]], subvista, (id) => { subvista = id; app.refrescar(); }, "Qué ver"),
    h("div", { style: { height: "14px" } }),
  );
  if (subvista === "inventario") pintarInventario(vista, app);
  else if (subvista === "ajuste") pintarAjuste(vista, app);
  else pintarPrecios(vista, app);
}

/* ───────── Precios ───────── */
function etiquetaMargen(precio, costo) {
  const m = C.margen(precio, costo);
  const n = C.nivelMargen(m);
  return h("span", { class: `margen ${n.id}` }, m == null ? n.texto : `${n.texto}: ${pct(m)}`);
}

function pintarPrecios(vista, app) {
  poner(vista, tarjetaPagina());
  const sinCosto = estado.productos.filter((p) => costoDe(p) == null).length;
  if (sinCosto) {
    poner(vista, h("div", { class: "aviso-caja" }, icono("alerta", 20),
      h("div", null, `${sinCosto} ${sinCosto === 1 ? "producto no tiene" : "productos no tienen"} costo. Sin costo no se puede saber cuánto ganas con ellos.`,
        h("div", null, h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => { subvista = "ajuste"; app.refrescar(); } }, "Poner los costos de una vez")))));
  }
  poner(vista, h("div", { class: "acciones no-imprimir", style: { margin: "0 0 4px" } },
    h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => editarProducto(null, app) }, icono("mas", 18), "Nuevo producto")));

  const productos = productosOrdenados();
  for (const cat of categoriasOrdenadas()) {
    const lista = productos.filter((p) => p.cat === cat.id);
    if (!lista.length) continue;
    poner(vista, h("h3", { class: "subtitulo" }, `${cat.emoji || ""} ${cat.nombre}`.trim()),
      h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, lista.map((p) => {
        const costo = costoDe(p);
        return h("div", { class: `prod-fila ${p.disponible === false ? "agotado" : ""}` },
          h("button", { class: "fila-boton", type: "button", onclick: () => editarProducto(p, app), "aria-label": `Editar ${p.nombre}` },
            fotoProducto(p, { clase: "miniatura", emoji: cat.emoji }),
            h("div", { class: "fila-texto" },
              h("b", null, p.nombre),
              p.opciones?.length ? h("span", null, p.opciones.join(", ")) : null,
              h("span", null, h("span", { class: "prod-precio num" }, usd(p.precio)), " ", costo != null ? `costo ${usd(costo)} ` : "", etiquetaMargen(p.precio, costo)))),
          h("div", { style: { display: "grid", justifyItems: "center", gap: "2px" } },
            interruptor(p.disponible !== false, async (v) => {
              if (await intentar(() => guardarProducto({ ...p, disponible: v }), v ? `${p.nombre}: disponible` : `${p.nombre}: agotado`)) app.refrescar();
            }, `${p.nombre} disponible`),
            h("small", { style: { fontSize: "11.5px", fontWeight: 700 } }, p.disponible === false ? "Agotado" : "Hay")));
      })));
  }
}

function editarProducto(p, app) {
  const nuevo = !p;
  const base = p || { id: `x${Date.now().toString(36)}`, cat: categoriasOrdenadas()[0]?.id, nombre: "", desc: "", precio: 0, opciones: [], disponible: true, costo: null, receta: [], orden: 999 };
  abrirHoja(nuevo ? "Nuevo producto" : base.nombre, (cuerpo, cerrar) => {
    const nombre = campoTexto({ id: "p-nombre", etiqueta: "Nombre", valor: base.nombre, max: 80 });
    const desc = campoTexto({ id: "p-desc", etiqueta: "Descripción", valor: base.desc, max: 240 });
    const cat = selector({ id: "p-cat", etiqueta: "Categoría", opciones: categoriasOrdenadas().map((c) => [c.id, c.nombre]), valor: base.cat });
    const precio = campoMonto({ id: "p-precio", etiqueta: "Precio de venta ($)", valor: base.precio || "" });
    const opciones = campoTexto({ id: "p-op", etiqueta: "Opciones a elegir (separadas por coma)", valor: (base.opciones || []).join(", "), max: 160, ayuda: "Ejemplo: Carne, Pollo, Mixto. Déjalo vacío si no tiene." });
    const costo = campoMonto({ id: "p-costo", etiqueta: "Costo aproximado por unidad ($)", valor: base.costo ?? "", ayuda: "Lo que te cuesta hacerlo: pan, carne, salsas, empaque…" });

    // Receta (opcional): descuenta insumos con cada venta y calcula el costo sola
    let receta = (base.receta || []).map((l) => ({ ...l }));
    const cajaReceta = h("div", { class: "form" });
    const costoReceta = h("p", { class: "ayuda num" });
    const pintarReceta = () => {
      const insumos = [...estado.insumos].sort((a, b) => a.nombre.localeCompare(b.nombre));
      const porId = insumosPorId();
      const c = C.costoProducto({ receta }, porId);
      costoReceta.textContent = receta.length ? (c == null ? "Algún insumo no tiene costo todavía." : `Costo por receta: ${usd(c)}. Se usa en lugar del costo aproximado.`) : "";
      reemplazar(cajaReceta, 
        ...receta.map((l, i) => {
          const sel = h("select", { class: "campo", "aria-label": "Insumo" }, insumos.map((ins) => h("option", { value: ins.id, selected: ins.id === l.insumoId }, `${ins.nombre} (${ins.unidad})`)));
          sel.addEventListener("change", () => { l.insumoId = sel.value; pintarReceta(); });
          const cant = h("input", { class: "campo num", inputmode: "decimal", value: cantidad(l.cantidad), "aria-label": "Cantidad" });
          cant.addEventListener("change", () => { l.cantidad = leerMonto(cant.value) || 0; pintarReceta(); });
          return h("div", { class: "receta-fila" }, sel, cant,
            h("button", { class: "quitar", type: "button", "aria-label": "Quitar de la receta", onclick: () => { receta.splice(i, 1); pintarReceta(); } }, icono("basura", 18)));
        }),
        insumos.length
          ? h("button", { class: "boton chico toca", type: "button", onclick: () => { receta.push({ insumoId: insumos[0].id, cantidad: 1 }); pintarReceta(); } }, icono("mas", 18), "Agregar insumo")
          : h("p", { class: "ayuda" }, "Primero agrega insumos en Productos → Inventario."),
        costoReceta);
    };
    pintarReceta();

    const disponible = { valor: base.disponible !== false };
    const form = h("form", { class: "form" },
      !nuevo && base.deLaPagina ? bloqueFoto(base) : null,
      nombre.nodo, desc.nodo, cat.nodo, precio.nodo, opciones.nodo, costo.nodo,
      h("details", { open: receta.length > 0 },
        h("summary", { class: "etiqueta", style: { minHeight: "44px", display: "flex", alignItems: "center", cursor: "pointer" } }, "Receta con insumos (opcional)"),
        h("p", { class: "ayuda", style: { marginBottom: "8px" } }, "Con receta, cada venta descuenta los ingredientes del inventario."),
        cajaReceta),
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h("span", { class: "etiqueta", style: { margin: 0 } }, "Disponible para vender"),
        interruptor(disponible.valor, (v) => { disponible.valor = v; }, "Disponible para vender")),
      h("button", { class: "boton verde ancho toca", type: "submit" }, icono("check", 20), "Guardar producto"),
      !nuevo ? h("button", { class: "boton ancho toca", type: "button", onclick: async () => {
        const aviso = base.deLaPagina ? " Ojo: la página de pedidos lo sigue mostrando hasta que se actualice." : "";
        if (await confirmar("Eliminar producto", `Se quita ${base.nombre} del panel. Las ventas pasadas no cambian.${aviso}`, { boton: "Eliminar", peligro: true })) {
          if (await intentar(() => borrar("productos", base), "Producto eliminado")) { cerrar(); app.refrescar(); }
        }
      } }, icono("basura", 20), "Eliminar producto") : null,
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const n = nombre.entrada.value.trim();
      const pr = precio.valor();
      if (!n) { avisar("Escribe el nombre del producto"); return; }
      if (pr == null || pr < 0) { avisar("Escribe un precio válido"); return; }
      const co = costo.entrada.value.trim() === "" ? null : costo.valor();
      const datos = {
        ...base, nombre: n, desc: desc.entrada.value.trim(), cat: cat.sel.value, precio: pr, costo: co,
        opciones: opciones.entrada.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
        receta: receta.filter((l) => l.insumoId && l.cantidad > 0), disponible: disponible.valor,
        editado: base.editado || (!nuevo && (n !== base.nombre || desc.entrada.value.trim() !== base.desc)),
      };
      if (await intentar(() => guardarProducto(datos), "Producto guardado")) { cerrar(); app.refrescar(); }
    });
    poner(cuerpo, form);
  });
}

/* La foto vive en la página de pedidos: el panel la muestra, y para cambiarla se envía a soporte */
function bloqueFoto(p) {
  const tiene = Boolean(fotoDe(p));
  const pedir = enlaceWhatsApp(SOPORTE.whatsapp, tiene
    ? `Hola, quiero cambiar la foto de "${p.nombre}" en la página de ${NEGOCIO.nombre}. Te la envío por aquí.`
    : `Hola, quiero ponerle foto a "${p.nombre}" en la página de ${NEGOCIO.nombre}. Te la envío por aquí.`);
  return h("div", { class: "foto-editar" },
    fotoProducto(p, { clase: "foto-grande", sizes: "120px" }),
    h("div", null,
      h("p", null, tiene ? "Esta foto sale en la página de pedidos." : "Este producto todavía no tiene foto en la página."),
      h("a", { class: "boton chico toca", href: pedir, target: "_blank", rel: "noopener" }, icono("enviar", 18), tiene ? "Cambiar foto" : "Enviar foto")));
}

/* ───────── Llevar los cambios a la página de pedidos ─────────
   La página lee los precios de menu.js. El panel arma ese archivo con los precios nuevos y los agotados,
   listo para subirlo a la página (o se pide el cambio por WhatsApp). */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function agotadosParaPagina() { return estado.productos.filter((p) => p.deLaPagina && p.disponible === false); }

export async function menuActualizado() {
  const res = await fetch(new URL("../../menu.js", import.meta.url), { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer el menú de la página.");
  let texto = await res.text();
  for (const p of estado.productos.filter((x) => x.deLaPagina)) {
    const re = new RegExp(`(\\{ id: "${escaparRegex(p.id)}",[^\\n]*?precio: )([\\d.]+)([^\\n]*)`);
    texto = texto.replace(re, (_, antes, _precio, resto) => {
      let r = resto.replace(/, agotado: true/g, "");
      if (p.disponible === false) r = r.replace(/ \},?\s*$/, (fin) => `, agotado: true${fin}`);
      return `${antes}${r2(p.precio)}${r}`;
    });
  }
  // Nueva versión: así el panel sabe que la página ya tiene estos precios
  texto = texto.replace(/export const VERSION_MENU = (\d+);/, (_, n) => `export const VERSION_MENU = ${Number(n) + 1};`);
  return texto;
}

function tarjetaPagina() {
  const distintos = preciosDistintos();
  const agotados = agotadosParaPagina();
  if (!distintos.length && !agotados.length) return null;
  const lineas = [
    ...distintos.map((p) => `- ${p.nombre}: ${usd(p.precio)} (antes ${usd(p.precioPagina)})`),
    ...agotados.map((p) => `- ${p.nombre}: AGOTADO`),
  ];
  const texto = [`Hola, soy de ${NEGOCIO.nombre}. Por favor actualiza la página de pedidos:`, ...lineas].join("\n");
  return h("div", { class: "aviso-caja pagina-sync" }, icono("alerta", 20), h("div", null,
    h("b", null, "La página de pedidos todavía no tiene estos cambios. "),
    distintos.length ? `${distintos.length} ${distintos.length === 1 ? "precio nuevo" : "precios nuevos"}` : "",
    distintos.length && agotados.length ? " y " : "",
    agotados.length ? `${agotados.length} ${agotados.length === 1 ? "producto agotado" : "productos agotados"}` : "",
    ". La caja ya cobra con los precios del panel.",
    h("div", { class: "acciones" },
      enMarco ? null : h("button", { class: "boton mostaza chico toca", type: "button", onclick: async () => {
        try { descargar("menu.js", await menuActualizado(), "text/javascript"); avisar("menu.js listo: súbelo a la página"); }
        catch (e) { avisar(e.message || "No se pudo armar el archivo"); }
      } }, icono("descargar", 18), "Descargar menu.js"),
      h("a", { class: "boton verde chico toca", href: enlaceWhatsApp(SOPORTE.whatsapp, texto), target: "_blank", rel: "noopener" }, icono("enviar", 18), "Pedir el cambio por WhatsApp")),
    h("p", { class: "ayuda" }, enMarco
      ? "En esta vista previa no se bajan archivos; en la página publicada sí."
      : "menu.js reemplaza al de la página (en GitHub o Vercel) y la página queda al día.")));
}

/* ───────── Ajustar precios: varios a la vez, con vista previa y deshacer ───────── */
const borrador = new Map(); // id → { precio?, costo? } cambios sin guardar
const rapido = { alcance: "todas", modo: "pct", sentido: "subir", valor: "", redondeo: "0.5" };
const REDONDEOS = [["0", "Sin redondeo"], ["0.1", "A $0,10"], ["0.25", "A $0,25"], ["0.5", "A $0,50"], ["1", "A $1"]];

const precioDe = (p) => (borrador.get(p.id)?.precio !== undefined ? borrador.get(p.id).precio : p.precio);
const tieneReceta = (p) => (p.receta || []).length > 0;
function costoActual(p) {
  if (tieneReceta(p)) return costoDe(p);
  const b = borrador.get(p.id);
  return b && "costo" in b ? b.costo : p.costo;
}
function marcar(p, campo, valor) {
  const b = { ...(borrador.get(p.id) || {}), [campo]: valor };
  const igual = (b.precio === undefined || b.precio === p.precio) && (!("costo" in b) || b.costo === p.costo);
  if (igual) borrador.delete(p.id); else borrador.set(p.id, b);
}

function calcular(p) {
  const v = leerMonto(rapido.valor);
  if (v == null || v < 0) return null;
  const paso = Number(rapido.redondeo);
  const signo = rapido.sentido === "bajar" ? -1 : 1;
  let n;
  if (rapido.modo === "pct") n = p.precio * (1 + signo * v / 100);
  else if (rapido.modo === "monto") n = p.precio + signo * v;
  else {
    const c = costoActual(p);
    if (c == null || c <= 0 || v >= 100) return null;
    n = c / (1 - v / 100);
  }
  if (paso > 0) n = (rapido.modo === "margen" ? Math.ceil(n / paso - 1e-9) : Math.round(n / paso)) * paso; // por margen se redondea hacia arriba
  n = r2(n);
  return n > 0 ? n : null;
}

function pintarAjuste(vista, app) {
  poner(vista, tarjetaPagina());
  const cats = categoriasOrdenadas();
  const enAlcance = () => productosOrdenados().filter((p) => rapido.alcance === "todas" || p.cat === rapido.alcance);

  // ── Ajuste rápido ──
  const alcance = selector({ id: "aj-alcance", etiqueta: "¿A cuáles?", opciones: [["todas", "Todos los productos"], ...cats.map((c) => [c.id, `${c.emoji || ""} ${c.nombre}`.trim()])], valor: rapido.alcance });
  alcance.sel.addEventListener("change", () => { rapido.alcance = alcance.sel.value; });
  const etiquetas = { pct: "¿Qué porcentaje?", monto: "¿Cuántos dólares?", margen: "¿Qué margen quieres ganar? (%)" };
  const valor = h("input", { class: "campo num", id: "aj-valor", inputmode: "decimal", autocomplete: "off", value: rapido.valor, placeholder: rapido.modo === "monto" ? "0,50" : "10" });
  valor.addEventListener("input", () => { rapido.valor = valor.value; });
  const redondeo = selector({ id: "aj-red", etiqueta: "Redondeo", opciones: REDONDEOS, valor: rapido.redondeo });
  redondeo.sel.addEventListener("change", () => { rapido.redondeo = redondeo.sel.value; });
  const calcularBoton = h("button", { class: "boton rojo ancho toca", type: "button", onclick: () => {
    if (leerMonto(rapido.valor) == null) { avisar("Escribe cuánto quieres ajustar"); valor.focus(); return; }
    let hechos = 0, sinCosto = 0;
    for (const p of enAlcance()) {
      const n = calcular(p);
      if (n == null) { if (rapido.modo === "margen") sinCosto++; continue; }
      marcar(p, "precio", n);
      if (n !== p.precio) hechos++;
    }
    avisar(hechos ? `${hechos} precios nuevos. Revisa la lista y toca Guardar.` : "No cambió ningún precio");
    if (sinCosto) setTimeout(() => avisar(`${sinCosto} sin costo: no se pueden calcular por margen`), 2000);
    app.refrescar();
  } }, icono("check", 20), "Calcular nuevos precios");

  poner(vista, h("div", { class: "tarjeta caja form ajuste-rapido" },
    h("div", null, h("h3", null, "Ajuste rápido"), h("p", { class: "ayuda" }, "Cambia varios precios de una vez. Nada se guarda hasta que lo revises.")),
    alcance.nodo,
    h("div", null, h("span", { class: "etiqueta" }, "¿Cómo?"),
      segmento([["pct", "Porcentaje"], ["monto", "Monto $"], ["margen", "Por margen"]], rapido.modo, (id) => { rapido.modo = id; app.refrescar(); }, "Cómo ajustar")),
    rapido.modo !== "margen" ? h("div", null, segmento([["subir", "Subir"], ["bajar", "Bajar"]], rapido.sentido, (id) => { rapido.sentido = id; app.refrescar(); }, "Subir o bajar")) : null,
    h("div", { class: "dos-col" },
      h("div", null, h("label", { class: "etiqueta", for: "aj-valor" }, etiquetas[rapido.modo]), valor),
      redondeo.nodo),
    rapido.modo === "margen" ? h("p", { class: "ayuda" }, "Pone el precio para que te quede ese porcentaje del precio como ganancia. Ej.: costo $3 y margen 40% → precio $5. Solo para productos con costo.") : null,
    calcularBoton));

  const anterior = config("ajusteAnterior");
  if (anterior?.productos?.length) {
    poner(vista, h("div", { class: "acciones", style: { marginTop: "-2px" } },
      h("button", { class: "boton chico toca", type: "button", onclick: () => deshacerAjuste(anterior, app) }, icono("repetir", 18),
        `Deshacer último ajuste (${anterior.productos.length}, ${fechaHora(anterior.fecha)})`)));
  }

  // ── Lista para editar precio y costo ──
  const barra = h("div", { class: "barra-ajuste", hidden: true });
  const pintarBarra = () => {
    const n = borrador.size;
    barra.hidden = !n;
    reemplazar(barra,
      h("span", { class: "num" }, h("b", null, `${n} ${n === 1 ? "cambio" : "cambios"}`), " sin guardar"),
      h("div", { style: { display: "flex", gap: "8px" } },
        h("button", { class: "boton chico toca", type: "button", onclick: () => { borrador.clear(); app.refrescar(); } }, "Descartar"),
        h("button", { class: "boton verde chico toca", type: "button", onclick: () => guardarBorrador(app) }, icono("check", 18), "Guardar")));
  };
  const t = tasa()?.valor;
  poner(vista, h("p", { class: "sobre-vino", style: { margin: "16px 2px 4px", fontSize: "14px" } }, "Toca un precio o un costo para cambiarlo. Los cambios se marcan en amarillo."));
  for (const cat of cats) {
    const lista = productosOrdenados().filter((p) => p.cat === cat.id);
    if (!lista.length) continue;
    poner(vista, h("h3", { class: "subtitulo" }, `${cat.emoji || ""} ${cat.nombre}`.trim()),
      h("div", { class: "tarjeta caja lista-ajuste" }, lista.map((p) => filaAjuste(p, t, pintarBarra))));
  }
  poner(vista, h("div", { style: { height: "84px" }, "aria-hidden": "true" }), barra); // espacio para la barra de guardar
  pintarBarra();
}

function filaAjuste(p, t, alCambiar) {
  const pr = precioDe(p);
  const co = costoActual(p);
  const precio = h("input", { class: "campo num campo-chico", inputmode: "decimal", autocomplete: "off", value: numero(pr), "aria-label": `Precio de ${p.nombre}` });
  const costo = h("input", { class: "campo num campo-chico", inputmode: "decimal", autocomplete: "off", value: co == null ? "" : numero(co), placeholder: "—", "aria-label": `Costo de ${p.nombre}`, readOnly: tieneReceta(p) || undefined, title: tieneReceta(p) ? "Sale de la receta" : null });
  const detalle = h("div", { class: "ajuste-detalle num" });
  const fila = h("div", { class: "ajuste-fila" },
    h("div", { class: "ajuste-nombre" }, h("b", null, p.nombre), p.opciones?.length ? h("span", null, p.opciones.join(", ")) : null, detalle),
    h("label", { class: "ajuste-campo" }, h("span", null, "Precio"), precio),
    h("label", { class: "ajuste-campo" }, h("span", null, tieneReceta(p) ? "Costo (receta)" : "Costo"), costo));
  const refrescar = () => {
    const vp = precioDe(p), vc = costoActual(p);
    const cambioPrecio = borrador.get(p.id)?.precio !== undefined && borrador.get(p.id).precio !== p.precio;
    const cambioCosto = "costo" in (borrador.get(p.id) || {});
    precio.classList.toggle("cambiado", cambioPrecio);
    costo.classList.toggle("cambiado", cambioCosto);
    precio.classList.toggle("invalido", !(vp > 0));
    reemplazar(detalle,
      vp > 0 ? etiquetaMargen(vp, vc) : h("span", { class: "margen bajo" }, "Precio no válido"),
      cambioPrecio ? h("span", { class: "antes" }, `antes ${usd(p.precio)}`) : null,
      t && vp > 0 ? h("span", { class: "en-bs" }, `≈ ${bs(vp * t)}`) : null);
  };
  precio.addEventListener("input", () => {
    const n = leerMonto(precio.value);
    marcar(p, "precio", n == null ? NaN : r2(n));
    refrescar(); alCambiar();
  });
  if (!tieneReceta(p)) costo.addEventListener("input", () => {
    const vacio = costo.value.trim() === "";
    const n = leerMonto(costo.value);
    if (!vacio && n == null) return;
    marcar(p, "costo", vacio ? null : r2(n));
    refrescar(); alCambiar();
  });
  for (const c of [precio, costo]) c.addEventListener("focus", () => c.select());
  refrescar();
  return fila;
}

async function guardarBorrador(app) {
  const cambios = [], antes = [];
  for (const [id, b] of borrador) {
    const p = estado.productos.find((x) => x.id === id);
    if (!p) continue;
    const precio = b.precio !== undefined ? b.precio : p.precio;
    if (!(precio > 0)) { avisar(`Revisa el precio de ${p.nombre}`); return; }
    const costo = "costo" in b ? b.costo : p.costo;
    antes.push({ id, precio: p.precio, costo: p.costo ?? null });
    cambios.push(["productos", { ...p, precio: r2(precio), costo: costo == null ? null : r2(costo) }]);
  }
  if (!cambios.length) { borrador.clear(); app.refrescar(); return; }
  const n = cambios.length;
  if (n >= 5 && !(await confirmar("Guardar cambios", `Se actualizan ${n} productos. La caja empieza a cobrar con estos precios ahora mismo.`, { boton: "Guardar" }))) return;
  cambios.push(["config", { clave: "ajusteAnterior", valor: { fecha: Date.now(), productos: antes } }]);
  if (await intentar(() => guardarJuntos(cambios), `${n} ${n === 1 ? "producto actualizado" : "productos actualizados"}`)) { borrador.clear(); app.refrescar(); }
}

async function deshacerAjuste(anterior, app) {
  if (!(await confirmar("Deshacer último ajuste", `Vuelven los precios y costos que tenían ${anterior.productos.length} productos antes del ${fechaHora(anterior.fecha)}.`, { boton: "Deshacer" }))) return;
  const cambios = anterior.productos.map((a) => {
    const p = estado.productos.find((x) => x.id === a.id);
    return p ? ["productos", { ...p, precio: a.precio, costo: a.costo }] : null;
  }).filter(Boolean);
  cambios.push(["config", { clave: "ajusteAnterior", valor: null }]);
  if (await intentar(() => guardarJuntos(cambios), "Ajuste deshecho")) { borrador.clear(); app.refrescar(); }
}

/* ───────── Inventario ───────── */
function pintarInventario(vista, app) {
  const insumos = [...estado.insumos].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const bajos = insumos.filter((i) => i.minimo > 0 && i.stock <= i.minimo);
  poner(vista, h("div", { class: "acciones", style: { margin: "0 0 4px" } },
    h("button", { class: "boton mostaza chico toca", type: "button", onclick: () => editarInsumo(null, app) }, icono("mas", 18), "Nuevo insumo")));
  if (!insumos.length) {
    poner(vista, h("div", { class: "vacio" },
      h("p", null, "Todavía no hay insumos."),
      h("p", { style: { fontSize: "14px" } }, "Agrega lo que compras para cocinar: pan, carne, salchichas, queso, papas, refrescos. Registra cada compra y sabrás cuánto queda. Si les pones receta a los productos, cada venta los descuenta sola.")));
    return;
  }
  if (bajos.length) poner(vista, h("div", { class: "aviso-caja" }, icono("alerta", 20), `Por acabarse: ${bajos.map((i) => i.nombre).join(", ")}`));
  poner(vista, h("div", { class: "tarjeta caja", style: { paddingBlock: "4px" } }, h("ul", { class: "filas" }, insumos.map((i) =>
    h("li", null, h("button", { class: "fila-boton", type: "button", onclick: () => abrirInsumo(i, app) },
      h("div", { class: "fila-texto" }, h("b", null, i.nombre),
        h("span", { class: "num" }, `${i.costo != null ? `${usd(i.costo)} por ${unidadCorta(i.unidad)}` : "Sin costo"}${i.minimo ? `, avisa con menos de ${cantidad(i.minimo)}` : ""}`)),
      h("div", { class: `fila-monto num ${i.minimo > 0 && i.stock <= i.minimo ? "stock-bajo" : ""}` }, `${cantidad(i.stock)} ${unidadCorta(i.unidad)}`)))))));
}

const unidadCorta = (u) => ({ unidades: "und", kilos: "kg", gramos: "g", litros: "L", paquetes: "paq" }[u] || u);
const UNIDADES = [["unidades", "Unidades"], ["kilos", "Kilos"], ["gramos", "Gramos"], ["litros", "Litros"], ["paquetes", "Paquetes"]];

function editarInsumo(ins, app) {
  const base = ins || { nombre: "", unidad: "unidades", stock: 0, minimo: 0, costo: null };
  abrirHoja(ins ? `Editar ${ins.nombre}` : "Nuevo insumo", (cuerpo, cerrar) => {
    const nombre = campoTexto({ id: "i-nombre", etiqueta: "Nombre", valor: base.nombre, max: 60, autofocus: !ins });
    const unidad = selector({ id: "i-unidad", etiqueta: "Se cuenta en", opciones: UNIDADES, valor: base.unidad });
    const stock = campoMonto({ id: "i-stock", etiqueta: "Cuánto hay ahora", valor: base.stock || "" });
    const minimo = campoMonto({ id: "i-min", etiqueta: "Avisar cuando quede menos de", valor: base.minimo || "" });
    const costo = campoMonto({ id: "i-costo", etiqueta: "Costo por unidad ($)", valor: base.costo ?? "" });
    stock.nodo.querySelector(".ayuda")?.remove();
    minimo.nodo.querySelector(".ayuda")?.remove();
    const form = h("form", { class: "form" }, nombre.nodo, unidad.nodo, ins ? null : stock.nodo, minimo.nodo, costo.nodo,
      h("button", { class: "boton verde ancho toca", type: "submit" }, "Guardar insumo"),
      ins ? h("button", { class: "boton ancho toca", type: "button", onclick: async () => {
        const usado = estado.productos.some((p) => (p.receta || []).some((l) => l.insumoId === ins.id));
        if (usado) { avisar("No se puede eliminar: está en la receta de algún producto"); return; }
        if (await confirmar("Eliminar insumo", `Se quita ${ins.nombre} del inventario.`, { boton: "Eliminar", peligro: true })) {
          if (await intentar(() => borrar("insumos", ins), "Insumo eliminado")) { cerrar(); app.refrescar(); }
        }
      } }, icono("basura", 20), "Eliminar insumo") : null);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!nombre.entrada.value.trim()) { avisar("Escribe el nombre"); return; }
      const datos = { ...base, nombre: nombre.entrada.value, unidad: unidad.sel.value, stock: ins ? base.stock : stock.valor() || 0, minimo: minimo.valor() || 0, costo: costo.entrada.value.trim() === "" ? null : costo.valor() };
      if (await intentar(() => guardarInsumo(datos), "Insumo guardado")) { cerrar(); app.refrescar(); }
    });
    poner(cuerpo, form);
  });
}

function abrirInsumo(ins, app) {
  abrirHoja(ins.nombre, (cuerpo, cerrar) => {
    const movs = estado.invmovs.filter((m) => m.insumoId === ins.id).sort((a, b) => b.creado - a.creado).slice(0, 12);
    const etiquetaTipo = { compra: "Compra", merma: "Uso o merma", conteo: "Conteo", venta: "Venta", anulacion: "Venta anulada" };
    const cuantoHay = h("p", { class: "cobro-total" }, h("b", null, "Hay"), h("strong", { class: "num" }, `${cantidad(ins.stock)} ${unidadCorta(ins.unidad)}`));
    const accion = (texto, ico, fn, clase = "") => h("button", { class: `boton toca ${clase}`, type: "button", onclick: () => { cerrar(); fn(); } }, icono(ico, 18), texto);
    poner(cuerpo, cuantoHay,
      h("div", { class: "botones-fila", style: { marginTop: "12px" } },
        accion("Compra", "mas", () => movimiento(ins, "compra", app), "verde"),
        accion("Uso o merma", "menos", () => movimiento(ins, "merma", app)),
        accion("Contar", "check", () => movimiento(ins, "conteo", app)),
        accion("Editar", "lapiz", () => editarInsumo(ins, app))),
      h("h3", { style: { margin: "18px 0 6px", fontSize: "15px" } }, "Últimos movimientos"),
      movs.length ? h("ul", { class: "filas" }, movs.map((m) => h("li", null,
        h("div", { class: "fila-texto" }, h("b", null, etiquetaTipo[m.tipo] || m.tipo), h("span", null, [fechaHora(m.creado), m.nota, m.usd ? `pagado ${usd(m.usd)}` : ""].filter(Boolean).join(", "))),
        h("div", { class: `fila-monto num ${m.cambio < 0 ? "baja" : "sube"}` }, `${m.cambio > 0 ? "+" : ""}${cantidad(m.cambio)}`))))
        : h("p", { class: "ayuda" }, "Sin movimientos todavía."));
  });
}

function movimiento(ins, tipo, app) {
  const titulos = { compra: `Compra de ${ins.nombre}`, merma: `Uso o merma de ${ins.nombre}`, conteo: `Contar ${ins.nombre}` };
  abrirHoja(titulos[tipo], (cuerpo, cerrar) => {
    const cantidad = campoMonto({ id: "m-cant", etiqueta: tipo === "conteo" ? `¿Cuánto hay de verdad? (${ins.unidad})` : `Cantidad (${ins.unidad})`, autofocus: true });
    cantidad.nodo.querySelector(".ayuda")?.remove();
    const cuentas = cuentasActivas();
    const cuenta = selector({ id: "m-cuenta", etiqueta: "¿De dónde salió el dinero?", opciones: [...cuentas.map((c) => [c.id, c.nombre]), ["", "No registrar el pago"]], valor: cuentas[0]?.id });
    const monto = campoMonto({ id: "m-monto", etiqueta: "Cuánto pagaste en total", moneda: cuentaPorId(cuenta.sel.value)?.moneda || "USD" });
    cuenta.sel.addEventListener("change", () => {
      const nueva = campoMonto({ id: "m-monto", etiqueta: "Cuánto pagaste en total", moneda: cuentaPorId(cuenta.sel.value)?.moneda || "USD", valor: monto.entrada.value });
      monto.nodo.replaceWith(nueva.nodo);
      Object.assign(monto, nueva);
    });
    const nota = campoTexto({ id: "m-nota", etiqueta: tipo === "compra" ? "Proveedor (opcional)" : "Motivo (opcional)", max: 80 });
    const form = h("form", { class: "form" }, cantidad.nodo, tipo === "compra" ? [cuenta.nodo, monto.nodo] : null, nota.nodo,
      h("button", { class: "boton verde ancho toca", type: "submit" }, "Guardar"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cant = cantidad.valor();
      if (cant == null) { avisar("Escribe la cantidad"); return; }
      const m = tipo === "compra" ? monto.valor() : null;
      if (m && cuentaPorId(cuenta.sel.value)?.moneda === "VES" && !tasa()) { app.pedirTasa(); return; }
      if (await intentar(() => moverInsumo(ins, { tipo, cantidad: cant, monto: m, cuenta: cuenta.sel.value || null, nota: nota.entrada.value }), "Inventario al día")) { cerrar(); app.refrescar(); }
    });
    poner(cuerpo, form);
  });
}

export { unidadCorta };
