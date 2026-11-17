/* Menú, precios y datos de Son D'licias.
   Lo usan la tienda (index.html) y el panel (/admin).
   Para cambiar precios, nombres o el número, edita solo este archivo.
   Si cambias precios aquí, suma 1 a VERSION_MENU: así el panel del local avisa que hay precios nuevos. */

export const VERSION_MENU = 1;

/* DEMO = true muestra la barra de demostración (tienda ↔ panel). En la página real va en false. */
export const DEMO = false;
/* Dirección del panel. Con Vercel (cleanUrls) es "admin"; en un hosting sin direcciones limpias, "admin.html". */
export const RUTA_PANEL = "admin";

export const NEGOCIO = {
  nombre: "Son D'licias",
  lema: "Sabores que enamoran, ambiente que inspira",
  whatsapp: "584141445118", // formato internacional sin "+" (cartel: 0414-1445118)
  telefono: "0414-1445118",
  instagram: "son.deliciascalabozo",
  ciudad: "Calabozo",
};

/* A quién le escribe el panel cuando el local cambia precios y hay que actualizarlos en la página */
export const SOPORTE = { nombre: "EU Digital Solutions", whatsapp: "584144741237" };

/* Opciones que el cliente elige al agregar el producto (no cambian el precio) */
const CARNE_POLLO = ["Carne", "Pollo"];
const CARNE_POLLO_MIXTO = ["Carne", "Pollo", "Mixto"];
const CARNE_POLLO_MIXTA = ["Carne", "Pollo", "Mixta"];
const SALCHICHA = ["Salchicha de pollo", "Polaca"];

export const CATEGORIAS = [
  { id: "hamburguesas", nombre: "Hamburguesas", emoji: "🍔", foto: "img/fotos/hamburguesas.webp" },
  { id: "perros", nombre: "Perros calientes", corto: "Perros", emoji: "🌭", foto: "img/fotos/perros.webp" },
  { id: "pepitos", nombre: "Pepitos", emoji: "🥖", foto: "img/fotos/pepitos.webp" },
  { id: "sandwiches", nombre: "Sándwich y Club House", corto: "Sándwiches", emoji: "🥪", foto: "img/fotos/sandwiches.webp" },
  { id: "salchipapas", nombre: "Salchipapas", emoji: "🍟" },
  { id: "raciones", nombre: "Papas y tequeños", corto: "Raciones", emoji: "🥔" },
  { id: "adicionales", nombre: "Adicionales", emoji: "🥓", nota: "Se suman a tu pedido. Dinos en las notas a qué producto van." },
];

/* id corto y fijo: viaja en el enlace del pedido. No lo cambies una vez publicado.
   foto (opcional): ruta de la foto del producto, por ejemplo "img/productos/h3.webp". */
export const PRODUCTOS = [
  // Hamburguesas
  { id: "h1", cat: "hamburguesas", nombre: "Mini D'licias", desc: "Pan pequeño, huevo, carne, lechuga, tomate, papas perreras y salsas", precio: 4 },
  { id: "h2", cat: "hamburguesas", nombre: "Mini D'licias Especial", desc: "Mini D'licias + jamón, queso amarillo y tocineta", precio: 5 },
  { id: "h3", cat: "hamburguesas", nombre: "Hamburguesa Normal", desc: "Pan, huevo, carne o pollo, lechuga, tomate, papas perreras y salsas", precio: 5.5, opciones: CARNE_POLLO },
  { id: "h4", cat: "hamburguesas", nombre: "Hamburguesa Especial", desc: "La Normal + jamón, queso amarillo y tocineta", precio: 6.5, opciones: CARNE_POLLO },
  { id: "h5", cat: "hamburguesas", nombre: "Hamburguesa Doble Normal", desc: "Doble carne, doble pollo o mixta + jamón, queso amarillo y tocineta", precio: 7.5, opciones: CARNE_POLLO_MIXTA },
  { id: "h6", cat: "hamburguesas", nombre: "Hamburguesa Doble Especial Mixta", desc: "Carne y pollo + jamón, queso amarillo y tocineta", precio: 8.5 },
  { id: "h7", cat: "hamburguesas", nombre: "Hamburguesa de Chuleta Ahumada", desc: "Chuleta ahumada + jamón y queso amarillo", precio: 6.5 },
  { id: "h8", cat: "hamburguesas", nombre: "Hamburguesa de Chuleta y Carne", desc: "Mixta de chuleta y carne + jamón, queso amarillo y tocineta", precio: 8.5 },
  { id: "h9", cat: "hamburguesas", nombre: "Hamburguesa de Chuleta y Pollo", desc: "Mixta de chuleta y pollo + jamón, queso amarillo y tocineta", precio: 8.5 },
  { id: "h10", cat: "hamburguesas", nombre: "Son Crispy", desc: "Pan, huevo, milanesas de pollo crispy, cebolla caramelizada, lechuga, tomate, salsa Big Mac, queso cheddar fundido y ración de papas pequeña", precio: 9 },
  { id: "h11", cat: "hamburguesas", nombre: "DeliBurguer Súper Especial", desc: "Pan, huevo, lechuga, tomate, papas perreras, salsas, chuleta ahumada, carne, pollo, chorizo ahumado Las Tinajas, jamón, queso cheddar fundido, tocineta y ración de papas pequeña", precio: 13.5 },
  { id: "h12", cat: "hamburguesas", nombre: "Hamburguesa Keto", desc: "Baja en carbohidratos: cubierta de lechuga, tomate, carne o pollo doble, jamón de pierna, queso mozzarella y tocineta. Salsas opcionales", precio: 7, opciones: CARNE_POLLO },

  // Perros calientes
  { id: "p1", cat: "perros", nombre: "Perro Normal", desc: "Pan, salchicha de pollo, repollo, papas perreras, salsas variadas y queso de año", precio: 2.5 },
  { id: "p2", cat: "perros", nombre: "Perro Especial", desc: "Pan, salchicha de pollo o polaca, repollo, papas perreras, salsas, jamón y queso amarillo", precio: 3.5, opciones: SALCHICHA },
  { id: "p3", cat: "perros", nombre: "Perro Súper Especial", desc: "El Especial + tocineta", precio: 4, opciones: SALCHICHA },
  { id: "p4", cat: "perros", nombre: "Mechi Perro Normal", desc: "Pan, salchicha polaca, carne mechada, repollo, papas perreras, salsas y queso de año", precio: 6.5 },
  { id: "p5", cat: "perros", nombre: "Mechi Perro Especial", desc: "Mechi Perro + jamón, queso amarillo y tocineta", precio: 7.5 },
  { id: "p6", cat: "perros", nombre: "Perro Gemelo Normal", desc: "Pan, 2 salchichas de pollo, repollo, papas perreras, salsas y queso de año", precio: 3.5 },
  { id: "p7", cat: "perros", nombre: "Perro Gemelo Especial", desc: "Perro Gemelo + jamón y queso amarillo", precio: 4.5 },

  // Pepitos
  { id: "pe1", cat: "pepitos", nombre: "MiniPepito Normal", desc: "Pan especial de perro, carne o pollo (o mixto), tomate, lechuga, papas, salsas y queso de año", precio: 6.5, opciones: CARNE_POLLO_MIXTO },
  { id: "pe2", cat: "pepitos", nombre: "MiniPepito Especial", desc: "Carne o pollo (o mixto), tomate, lechuga, papas, salsas, jamón, queso amarillo rallado y tocineta", precio: 7.5, opciones: CARNE_POLLO_MIXTO },
  { id: "pe3", cat: "pepitos", nombre: "Pepito de Carne Normal", desc: "Pan canilla grande de 40 cm, carne, tomate, lechuga, papas perreras, salsas y queso de año", precio: 15.9 },
  { id: "pe4", cat: "pepitos", nombre: "Pepito de Carne Especial", desc: "Pepito de carne + jamón, queso amarillo y tocineta", precio: 16.9 },
  { id: "pe5", cat: "pepitos", nombre: "Pepito Mixto Normal", desc: "Pan canilla grande de 40 cm, carne, pollo, chorizo, tomate, lechuga, papas, salsas y queso de año", precio: 15.9 },
  { id: "pe6", cat: "pepitos", nombre: "Pepito Mixto Especial", desc: "Pepito mixto + jamón, queso amarillo y tocineta", precio: 16.9 },
  { id: "pe7", cat: "pepitos", nombre: "MetroPepito de Carne Especial", desc: "", precio: 38, foto: "img/fotos/pepitos.webp" },
  { id: "pe8", cat: "pepitos", nombre: "MetroPepito Mixto Especial", desc: "", precio: 39, foto: "img/fotos/pepitos.webp" },
  { id: "pe9", cat: "pepitos", nombre: "Enrollado tipo Shawarma", desc: "Pan árabe, carne o pollo (o mixto), tomate, lechuga, queso amarillo rallado, jamón y tocineta. Salsas opcionales", precio: 7.5, opciones: CARNE_POLLO_MIXTO },

  // Sándwich y Club House
  { id: "s1", cat: "sandwiches", nombre: "Sándwich", desc: "Pan, lechuga, tomate, jamón, queso amarillo y salsas", precio: 3.5 },
  { id: "s2", cat: "sandwiches", nombre: "Club House Normal", desc: "Sándwich de jamón, queso, huevo, lechuga, tomate, salsas y papas fritas", precio: 7.8, foto: "img/fotos/sandwiches.webp" },
  { id: "s3", cat: "sandwiches", nombre: "Club House de Carne o Pollo", desc: "Sándwich de jamón, queso, huevo, lechuga, tomate, salsas, full papas fritas y milanesa de pollo o carne a la plancha", precio: 11, opciones: CARNE_POLLO },
  { id: "s4", cat: "sandwiches", nombre: "Club House Mixto", desc: "Sándwich, milanesa de pollo, carne de hamburguesa, papas crujientes, salsas, queso amarillo rallado, tocineta y maíz", precio: 13 },

  // Salchipapas
  { id: "sp1", cat: "salchipapas", nombre: "Salchipapa Normal", desc: "Full papas fritas, salchichas, ensalada coleslaw, salsas y maíz", precio: 7 },
  { id: "sp2", cat: "salchipapas", nombre: "Salchipapa Especial", desc: "Salchipapa + jamón, queso amarillo y tocineta", precio: 8.5 },
  { id: "sp3", cat: "salchipapas", nombre: "SalchiClubHouse", desc: "La combinación perfecta entre Club House Normal y Salchipapas", precio: 9.5 },
  { id: "sp4", cat: "salchipapas", nombre: "SalchiTernera Mix", desc: "Papas crujientes, ensalada coleslaw, salchichas, carne de lomo, salsas, maíz, queso amarillo y tocineta", precio: 13 },

  // Papas y tequeños
  { id: "r1", cat: "raciones", nombre: "Ración de papas 150 g", desc: "Papas fritas", precio: 2 },
  { id: "r2", cat: "raciones", nombre: "Ración de papas 200 g", desc: "Papas fritas", precio: 2.5 },
  { id: "r3", cat: "raciones", nombre: "Ración de tequeños", desc: "6 tequeños", precio: 4 },

  // Adicionales
  { id: "a1", cat: "adicionales", nombre: "Tocineta", desc: "", precio: 0.9 },
  { id: "a2", cat: "adicionales", nombre: "Maíz", desc: "", precio: 0.5 },
  { id: "a3", cat: "adicionales", nombre: "Pepinillo", desc: "", precio: 0.8 },
  { id: "a4", cat: "adicionales", nombre: "Hamburguesa de carne", desc: "", precio: 3 },
  { id: "a5", cat: "adicionales", nombre: "Milanesa de pollo", desc: "", precio: 2.5 },
  { id: "a6", cat: "adicionales", nombre: "Pollo crispy", desc: "", precio: 3 },
  { id: "a7", cat: "adicionales", nombre: "Cebolla caramelizada", desc: "", precio: 1.2 },
];
