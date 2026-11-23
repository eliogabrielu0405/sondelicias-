/* Hamburguesa bailarina: personaje propio de la página (dibujo SVG fijo del código, sin datos de clientes).
   Baila sola; al tocarla da un giro y dice algo. En Navidad lleva gorro (lo muestra css/navidad.css). */
import { h } from "./comun.js";

const DIBUJO = `<svg class="hb" viewBox="0 -8 120 148" aria-hidden="true" focusable="false">
  <ellipse class="hb-sombra" cx="60" cy="134" rx="24" ry="4" fill="#000" opacity=".28"/>
  <g class="hb-pierna hb-izq">
    <path d="M50 104 L46 124" stroke="#3A0709" stroke-width="5" stroke-linecap="round"/>
    <path d="M35 127 q0 -6 10 -6 q8 0 8 6 z" fill="#C8141C" stroke="#3A0709" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <g class="hb-pierna hb-der">
    <path d="M70 104 L74 124" stroke="#3A0709" stroke-width="5" stroke-linecap="round"/>
    <path d="M67 127 q0 -6 8 -6 q10 0 10 6 z" fill="#C8141C" stroke="#3A0709" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <g class="hb-cuerpo">
    <g class="hb-brazo hb-izq">
      <path d="M22 84 Q12 78 8 64" fill="none" stroke="#3A0709" stroke-width="5" stroke-linecap="round"/>
      <circle cx="8" cy="61" r="6.5" fill="#fff" stroke="#3A0709" stroke-width="2"/>
    </g>
    <g class="hb-brazo hb-der">
      <path d="M98 84 Q108 78 112 64" fill="none" stroke="#3A0709" stroke-width="5" stroke-linecap="round"/>
      <circle cx="112" cy="61" r="6.5" fill="#fff" stroke="#3A0709" stroke-width="2"/>
    </g>
    <path d="M18 96 H102 Q106 96 106 100 V102 Q106 116 92 116 H28 Q14 116 14 102 V100 Q14 96 18 96 Z" fill="#E9A23B" stroke="#3A0709" stroke-width="2.5"/>
    <rect x="15" y="84" width="90" height="15" rx="7.5" fill="#6B3A1E" stroke="#3A0709" stroke-width="2.5"/>
    <path d="M16 79 H104 L99 87 L91 85 L85 94 L79 85 H66 L61 92 L56 85 H38 L32 93 L27 85 H18 Z" fill="#FFC20F" stroke="#3A0709" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M12 77 Q18 69 24 76 Q30 69 36 76 Q42 69 48 76 Q54 69 60 76 Q66 69 72 76 Q78 69 84 76 Q90 69 96 76 Q102 69 108 77 L108 80 H12 Z" fill="#5DBB3F" stroke="#3A0709" stroke-width="2.5" stroke-linejoin="round"/>
    <g class="hb-tapa">
      <path d="M17 73 Q13 73 13 68 C13 38 35 22 60 22 C85 22 107 38 107 68 Q107 73 103 73 Z" fill="#F0A93E" stroke="#3A0709" stroke-width="2.5"/>
      <path d="M28 46 C32 36 42 30 52 28" fill="none" stroke="#FAD48A" stroke-width="5" stroke-linecap="round"/>
      <g fill="#FFF6DF" stroke="#3A0709" stroke-width="1">
        <ellipse cx="44" cy="34" rx="3" ry="1.8" transform="rotate(-25 44 34)"/>
        <ellipse cx="60" cy="29" rx="3" ry="1.8"/>
        <ellipse cx="76" cy="33" rx="3" ry="1.8" transform="rotate(25 76 33)"/>
        <ellipse cx="88" cy="42" rx="3" ry="1.8" transform="rotate(40 88 42)"/>
        <ellipse cx="33" cy="44" rx="3" ry="1.8" transform="rotate(-40 33 44)"/>
      </g>
      <g class="hb-ojos">
        <ellipse cx="47" cy="51" rx="7" ry="8" fill="#fff" stroke="#3A0709" stroke-width="2"/>
        <ellipse cx="73" cy="51" rx="7" ry="8" fill="#fff" stroke="#3A0709" stroke-width="2"/>
        <circle cx="48.5" cy="52.5" r="3.6" fill="#1D0A0B"/>
        <circle cx="74.5" cy="52.5" r="3.6" fill="#1D0A0B"/>
        <circle cx="49.8" cy="51" r="1.2" fill="#fff"/>
        <circle cx="75.8" cy="51" r="1.2" fill="#fff"/>
      </g>
      <ellipse cx="37" cy="61" rx="5" ry="3" fill="#F2707A" opacity=".6"/>
      <ellipse cx="83" cy="61" rx="5" ry="3" fill="#F2707A" opacity=".6"/>
      <path d="M51 61 Q60 71 69 61 Z" fill="#7A1F12" stroke="#3A0709" stroke-width="2" stroke-linejoin="round"/>
      <path d="M55 65 Q60 69.5 65 65 Q60 63 55 65 Z" fill="#F2707A"/>
      <g class="hb-gorro">
        <path d="M34 28 C38 8 56 -2 74 0 C90 2 101 13 106 30 C100 24 92 21 86 22 Z" fill="#D7262E" stroke="#3A0709" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="30" y="20" width="60" height="13" rx="6.5" fill="#fff" stroke="#3A0709" stroke-width="2.5" transform="rotate(-6 60 26)"/>
        <circle cx="106" cy="32" r="7" fill="#fff" stroke="#3A0709" stroke-width="2.5"/>
      </g>
    </g>
  </g>
</svg>`;

const FRASES = ["¡Provecho! 😋", "¡Pide la tuya! 🔥", "¡Qué rico! 🍔", "¡Chévere! 🎉"];
const FRASES_NAVIDAD = ["¡Feliz Navidad! 🎄", "¡Jo, jo, jo! 🎅", "¡Felices fiestas! ✨"];

export function hamburguesaBailarina({ navidad = () => false } = {}) {
  const globo = h("span", { class: "hb-globo", "aria-hidden": "true" });
  const figura = h("span", { class: "hb-figura" });
  figura.innerHTML = DIBUJO;
  const boton = h("button", { class: "hamburguesa-bailarina", type: "button", "aria-label": "Hamburguesa bailarina: tócala para que te salude" }, globo, figura);
  let temporizador;
  let ultima = -1;
  boton.addEventListener("click", () => {
    const frases = navidad() ? [...FRASES_NAVIDAD, ...FRASES.slice(0, 2)] : FRASES;
    let i = Math.floor(Math.random() * frases.length);
    if (i === ultima) i = (i + 1) % frases.length; // no repetir la misma frase seguida
    ultima = i;
    globo.textContent = frases[i];
    boton.classList.remove("saluda");
    void boton.offsetWidth; // reinicia la animación
    boton.classList.add("saluda");
    clearTimeout(temporizador);
    temporizador = setTimeout(() => boton.classList.remove("saluda"), 1900);
    try { navigator.vibrate?.([10, 40, 10]); } catch { /* sin vibración */ }
  });
  return boton;
}
