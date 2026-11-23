/* Adornos de Navidad: luces bajo la cabecera, nieve y esferas en la portada y gorro en el logo.
   Se encienden solos según NAVIDAD en menu.js. Los dibujos son fijos del código (nunca datos de clientes). */
import { h } from "./comun.js";
import { NAVIDAD, HORARIO } from "../menu.js";

/* ¿Toca adornar? "auto": del 15 de noviembre al 6 de enero (Día de Reyes), en hora de Venezuela */
export function navidadActiva(fecha = new Date()) {
  if (NAVIDAD === true) return true;
  if (NAVIDAD !== "auto") return false;
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: HORARIO?.zona || "America/Caracas", month: "numeric", day: "numeric" })
    .formatToParts(fecha).map((p) => [p.type, p.value]));
  const mes = Number(partes.month);
  const dia = Number(partes.day);
  return (mes === 11 && dia >= 15) || mes === 12 || (mes === 1 && dia <= 6);
}

const COLORES_LUCES = ["#E53935", "#FFC20F", "#22B35E", "#2E9BF0", "#F7931E"];
const PASO_LUCES = 44; // separación entre bombillos (px)

function ponerLuces() {
  const cabecera = document.getElementById("cabecera");
  if (!cabecera) return;
  const luces = h("div", { class: "luces", "aria-hidden": "true" });
  const pintar = () => {
    const n = Math.ceil(window.innerWidth / PASO_LUCES) + 1;
    if (luces.childElementCount === n) return;
    luces.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const foco = h("span", { class: "foco" });
      foco.style.cssText = `left:${PASO_LUCES / 2 + i * PASO_LUCES}px;--c:${COLORES_LUCES[i % COLORES_LUCES.length]};` +
        `--t:${(1.3 + (i % 3) * 0.45).toFixed(2)}s;--r:${(-i * 0.37).toFixed(2)}s;--g:${i % 2 ? 8 : -8}deg`;
      return foco;
    }));
  };
  pintar();
  let espera;
  window.addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(pintar, 200); });
  cabecera.append(luces);
}

function ponerNieve(tarjeta) {
  const nieve = h("div", { class: "nieve", "aria-hidden": "true" });
  // Menos copos en teléfonos sencillos o con ahorro de datos
  const sencillo = (navigator.deviceMemory || 4) <= 2 || (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData === true;
  const copos = sencillo ? 8 : window.innerWidth < 720 ? 12 : 18;
  for (let i = 0; i < copos; i++) {
    const estrella = i % 5 === 0;
    const copo = h("span", { class: estrella ? "copo estrella" : "copo" }, estrella ? "❄" : null);
    const tam = estrella ? 9 + Math.random() * 6 : 3 + Math.random() * 4;
    copo.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--s:${tam.toFixed(1)}px;` +
      `--d:${(7 + Math.random() * 7).toFixed(1)}s;--r:${(-Math.random() * 14).toFixed(1)}s;` +
      `--dx:${Math.round(Math.random() * 30 - 15)}px;--o:${(0.5 + Math.random() * 0.45).toFixed(2)}`;
    nieve.append(copo);
  }
  tarjeta.append(nieve);
}

function ponerEsferas(tarjeta) {
  // [color, largo del hilo, tamaño]
  const esferas = [["#D7262E", 14, 20], ["#F2B807", 34, 16], ["#1E9E4A", 22, 22], ["#F7931E", 8, 15]];
  tarjeta.append(h("div", { class: "esferas", "aria-hidden": "true" }, esferas.map(([c, largo, tam], i) => {
    const e = h("span", { class: "esfera" }, h("b"));
    e.style.cssText = `--c:${c};--l:${largo}px;--s:${tam}px;--t:${(2.4 + i * 0.35).toFixed(2)}s;--r:${(-i * 0.6).toFixed(1)}s`;
    return e;
  })));
}

const GORRO = '<svg viewBox="0 0 40 34" aria-hidden="true" focusable="false"><path d="M4 26 C6 12 16 3 27 4 C34 5 38 11 39 20 C35 17 31 17 28 19 Z" fill="#D7262E" stroke="#3A0709" stroke-width="2" stroke-linejoin="round"/><rect x="1" y="21" width="30" height="9" rx="4.5" fill="#fff" stroke="#3A0709" stroke-width="2" transform="rotate(-8 16 25)"/><circle cx="38" cy="21" r="4.5" fill="#fff" stroke="#3A0709" stroke-width="2"/></svg>';

function ponerGorro() {
  const insignia = document.querySelector(".cabecera .insignia");
  if (!insignia) return;
  const gorro = h("span", { class: "gorro-insignia", "aria-hidden": "true" });
  gorro.innerHTML = GORRO;
  insignia.append(gorro);
}

/* Enciende los adornos si es temporada. Devuelve true si quedaron puestos. */
export function activarNavidad() {
  const raiz = document.documentElement;
  if (!navidadActiva()) { raiz.classList.remove("navidad"); return false; }
  document.head.append(h("link", { rel: "stylesheet", href: "css/navidad.css" }));
  raiz.classList.add("navidad");
  ponerLuces();
  ponerGorro();
  const tarjeta = document.querySelector(".portada-tarjeta");
  if (tarjeta) {
    ponerNieve(tarjeta);
    ponerEsferas(tarjeta);
  }
  return true;
}
