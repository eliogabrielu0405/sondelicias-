/* Panel sin internet: guarda una copia de los archivos del panel en el teléfono.
   Cambia VERSION cuando subas cambios del panel para que los teléfonos tomen lo nuevo. */
const VERSION = "sd-panel-v10";
const ARCHIVOS = [
  "admin",
  "menu.js",
  "css/comun.css",
  "css/panel.css",
  "js/comun.js",
  "js/panel/app.js",
  "js/panel/caja.js",
  "js/panel/calculos.js",
  "js/panel/datos.js",
  "js/panel/finanzas.js",
  "js/panel/impresion.js",
  "js/panel/mas.js",
  "js/panel/negocio.js",
  "js/panel/pedidos.js",
  "js/panel/productos.js",
  "js/panel/seguridad.js",
  "js/panel/ui.js",
  "img/logo.webp",
  "img/favicon.png",
  "img/icono-192.png",
  "fonts/poppins-400.woff",
  "fonts/poppins-500.woff",
  "fonts/poppins-700.woff",
  "fonts/poppins-700i.woff"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((llaves) => Promise.all(llaves.filter((k) => k.startsWith("sd-panel-") && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Primero internet (para tener lo último); si no hay conexión, lo guardado */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("admin") : Response.error()))),
  );
});
