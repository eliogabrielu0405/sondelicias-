/* Entrada al panel: solo contraseña. Se guarda cifrada (PBKDF2) en este teléfono, nunca en texto. */
import { poner, reemplazar } from "../comun.js";
import { h, icono } from "./ui.js";
import { config, ponerConfig } from "./datos.js";
import { NEGOCIO } from "../../menu.js";

const ITERACIONES = 150000;
const HORAS_ABIERTO = 12;
const LLAVE_SESION = "sd-panel-abierto";

const aHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (hex) => new Uint8Array(hex.match(/../g).map((x) => parseInt(x, 16)));

async function derivar(texto, salHex, iter = ITERACIONES) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(texto), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: deHex(salHex), iterations: iter }, base, 256);
  return aHex(bits);
}
async function proteger(texto) {
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)));
  return { sal, iter: ITERACIONES, hash: await derivar(texto, sal) };
}
async function coincide(texto, guardado) {
  if (!guardado?.hash) return false;
  const calc = await derivar(texto, guardado.sal, guardado.iter);
  let dif = calc.length ^ guardado.hash.length;
  for (let i = 0; i < calc.length; i++) dif |= calc.charCodeAt(i) ^ (guardado.hash.charCodeAt(i) || 0);
  return dif === 0;
}
const normalizarCodigo = (t) => String(t || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
function nuevoCodigo() {
  const letras = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const c = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => letras[b % letras.length]).join("");
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

export const tieneClave = () => Boolean(config("clave")?.hash);

export function estaAbierto() {
  try {
    const s = JSON.parse(localStorage.getItem(LLAVE_SESION));
    return Boolean(s && s.hasta > Date.now());
  } catch {
    return false;
  }
}
const marcarAbierto = () => {
  try { localStorage.setItem(LLAVE_SESION, JSON.stringify({ hasta: Date.now() + HORAS_ABIERTO * 3600000 })); } catch { /* sin almacenamiento */ }
};
export function bloquear() {
  try { localStorage.removeItem(LLAVE_SESION); } catch { /* nada */ }
}

export async function cambiarClave(actual, nueva) {
  if (!(await coincide(actual, config("clave")))) throw new Error("No coincide la contraseña actual.");
  if (String(nueva).length < 4) throw new Error("No sirve: la contraseña nueva necesita al menos 4 caracteres.");
  await ponerConfig("clave", await proteger(nueva));
}

/* Pantalla de entrada. Llama a listo() cuando la persona entra. */
export function pantallaEntrada(contenedor, listo) {
  const tarjeta = h("div", { class: "entrada caja" });
  reemplazar(contenedor, h("div", { class: "entrada-fondo" },
    h("img", { class: "entrada-logo", src: "img/logo.webp", alt: NEGOCIO.nombre, width: 228, height: 166 }),
    tarjeta));

  const mensaje = h("p", { class: "falta", role: "alert" });
  let fallos = 0;
  let esperarHasta = 0;

  const campo = (id, texto, extra = {}) => {
    const entrada = h("input", { class: "campo", id, type: "password", autocomplete: "current-password", ...extra });
    return [h("label", { class: "etiqueta", for: id }, texto), entrada];
  };

  function pedirClave() {
    const [lab, entrada] = campo("clave", "Contraseña", { autofocus: true });
    const boton = h("button", { class: "boton rojo ancho toca", type: "submit" }, icono("candado", 20), "Entrar");
    const form = h("form", { class: "entrada-form" },
      h("h1", null, "Panel del local"),
      h("p", { class: "ayuda" }, "Los datos se guardan solo en este teléfono."),
      lab, entrada, boton, mensaje,
      h("button", { class: "enlace", type: "button", onclick: recuperar }, "Olvidé la contraseña"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (Date.now() < esperarHasta) {
        mensaje.textContent = `Espera ${Math.ceil((esperarHasta - Date.now()) / 1000)} segundos e intenta de nuevo.`;
        return;
      }
      boton.disabled = true;
      const ok = await coincide(entrada.value, config("clave"));
      boton.disabled = false;
      if (ok) { marcarAbierto(); listo(); return; }
      fallos += 1;
      if (fallos >= 5) esperarHasta = Date.now() + 30000;
      mensaje.textContent = fallos >= 5 ? "Contraseña incorrecta. Espera 30 segundos para volver a intentar." : "Contraseña incorrecta.";
      entrada.select();
    });
    reemplazar(tarjeta, form);
    entrada.focus();
  }

  function crearClave() {
    const [lab1, e1] = campo("nueva", "Crea una contraseña", { autocomplete: "new-password", autofocus: true });
    const [lab2, e2] = campo("repite", "Escríbela otra vez", { autocomplete: "new-password" });
    const form = h("form", { class: "entrada-form" },
      h("h1", null, "Panel del local"),
      h("p", { class: "ayuda" }, "Es la primera vez que se abre en este teléfono. Todo lo que registres se guarda aquí, sin internet."),
      lab1, e1, lab2, e2,
      h("button", { class: "boton rojo ancho toca", type: "submit" }, "Crear contraseña"), mensaje);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (e1.value.length < 4) { mensaje.textContent = "Usa al menos 4 caracteres."; return; }
      if (e1.value !== e2.value) { mensaje.textContent = "Las dos contraseñas no son iguales."; return; }
      const codigo = nuevoCodigo();
      await ponerConfig("clave", await proteger(e1.value));
      await ponerConfig("recuperacion", await proteger(normalizarCodigo(codigo)));
      marcarAbierto();
      mostrarCodigo(codigo);
    });
    reemplazar(tarjeta, form);
    e1.focus();
  }

  function mostrarCodigo(codigo) {
    reemplazar(tarjeta, h("div", { class: "entrada-form" },
      h("h1", null, "Guarda este código"),
      h("p", null, "Si un día olvidas la contraseña, con este código entras y pones una nueva. Tómale una captura o anótalo."),
      h("p", { class: "codigo-recuperacion num" }, codigo),
      h("button", { class: "boton verde ancho toca", type: "button", onclick: listo }, icono("check", 20), "Ya lo guardé, entrar")));
  }

  function recuperar() {
    mensaje.textContent = "";
    const [lab1, c] = campo("codigo", "Código de recuperación", { type: "text", autocomplete: "off", autofocus: true, placeholder: "XXXXX-XXXXX" });
    const [lab2, n1] = campo("nueva2", "Contraseña nueva", { autocomplete: "new-password" });
    const form = h("form", { class: "entrada-form" },
      h("h1", null, "Recuperar acceso"),
      h("p", { class: "ayuda" }, "Escribe el código que guardaste cuando creaste la contraseña."),
      lab1, c, lab2, n1,
      h("button", { class: "boton rojo ancho toca", type: "submit" }, "Cambiar contraseña"), mensaje,
      h("button", { class: "enlace", type: "button", onclick: pedirClave }, "Volver"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (Date.now() < esperarHasta) { mensaje.textContent = "Espera unos segundos e intenta de nuevo."; return; }
      if (!(await coincide(normalizarCodigo(c.value), config("recuperacion")))) {
        fallos += 1;
        if (fallos >= 5) esperarHasta = Date.now() + 30000;
        mensaje.textContent = "Ese código no es el correcto.";
        return;
      }
      if (n1.value.length < 4) { mensaje.textContent = "Usa al menos 4 caracteres."; return; }
      await ponerConfig("clave", await proteger(n1.value));
      marcarAbierto();
      listo();
    });
    reemplazar(tarjeta, form);
    c.focus();
  }

  if (tieneClave()) pedirClave();
  else crearClave();
}
