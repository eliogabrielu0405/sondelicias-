/* Productos: precios, agotados, costos y recetas. Inventario de insumos (ingredientes). */
import { poner, reemplazar } from "../comun.js";
import { usd, numero, cantidad, pct, enlaceWhatsApp, leerMonto } from "../comun.js";
import { SOPORTE, NEGOCIO } from "../../menu.js";
import { h, icono, abrirHoja, avisar, intentar, confirmar, interruptor, campoMonto, campoTexto, selector, segmento, tituloSeccion, fechaHora } from "./ui.js";
import { estado, borrar } from "./datos.js";
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
    segmento([["precios", "Precios y costos"], ["inventario", "Inventario"]], subvista, (id) => { subvista = id; app.refrescar(); }, "Qué ver"),
    h("div", { style: { height: "14px" } }),
  );
  if (subvista === "inventario") pintarInventario(vista, app);
  else pintarPrecios(vista, app);
}

/* ───────── Precios ───────── */
function etiquetaMargen(precio, costo) {
  const m = C.margen(precio, costo);
  const n = C.nivelMargen(m);
  return h("span", { class: `margen ${n.id}` }, m == null ? n.texto : `${n.texto}: ${pct(m)}`);
}

function pintarPrecios(vista, app) {
  const distintos = preciosDistintos();
  if (distintos.length) {
    const texto = [`Hola, soy de ${NEGOCIO.nombre}. Por favor actualiza estos precios en la página:`, ...distintos.map((p) => `- ${p.nombre}: ${usd(p.precio)} (antes ${usd(p.precioPagina)})`)].join("\n");
    poner(vista, h("div", { class: "aviso-caja" }, icono("alerta", 20), h("div", null,
      h("b", null, `${distintos.length} ${distintos.length === 1 ? "precio cambió" : "precios cambiaron"} en el panel. `),
      "La caja ya cobra con el precio nuevo, pero la página de pedidos sigue mostrando el anterior hasta que se actualice.",
      h("div", null, h("a", { class: "boton verde chico toca", style: { marginTop: "8px" }, href: enlaceWhatsApp(SOPORTE.whatsapp, texto), target: "_blank", rel: "noopener" }, icono("enviar", 18), "Pedir el cambio por WhatsApp")))));
  }
  const sinCosto = estado.productos.filter((p) => costoDe(p) == null).length;
  if (sinCosto) {
    poner(vista, h("div", { class: "aviso-caja" }, icono("alerta", 20),
      h("div", null, `${sinCosto} ${sinCosto === 1 ? "producto no tiene" : "productos no tienen"} costo. Sin costo no se puede saber cuánto ganas con ellos. Toca un producto para ponérselo.`)));
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
        return h("div", { class: "prod-fila" },
          h("button", { class: "fila-boton", type: "button", onclick: () => editarProducto(p, app), "aria-label": `Editar ${p.nombre}` },
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
