# Son D'licias: página de pedidos y panel del local

La página para clientes queda en la raíz del dominio (`/`). El panel del local queda en `/admin`. La página no tiene ningún enlace al panel.

No usa base de datos ni servidor. Todo lo del panel se guarda en el teléfono donde se abre.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La página donde el cliente arma su pedido y lo envía por WhatsApp |
| `admin.html` | El panel del local (se abre en `/admin`), entra solo con contraseña |
| `menu.js` | Menú, precios, opciones (carne, pollo, mixto…) y número de WhatsApp. **Los precios de la página se cambian aquí** |
| `js/tienda.js` | El funcionamiento de la página |
| `js/panel/` | El funcionamiento del panel: pedidos, caja, productos, finanzas, gastos, dinero |
| `css/`, `fonts/`, `img/` | Estilos, letra Poppins, logo, fotos e íconos |
| `sw.js`, `admin.webmanifest` | Para instalar el panel en el teléfono y que abra sin internet |
| `vercel.json` | Direcciones limpias (`/admin`) y caché |

## Subirla a Vercel (una sola vez)

1. Crea un repositorio en GitHub (por ejemplo `son-dlicias`) y sube esta carpeta.
2. En vercel.com toca **Add New → Project** y elige el repositorio. En Framework elige **Other**. No lleva comando de build ni variables.
3. Toca **Deploy**. La página queda en `https://tu-proyecto.vercel.app` y el panel en `https://tu-proyecto.vercel.app/admin`.

## Primer uso del panel (en el teléfono del local)

1. Abre `/admin` en Chrome y crea la contraseña. Guarda el código de recuperación (una captura sirve).
2. Instala el panel: **Más → Instalar en el teléfono** (o menú de Chrome → **Instalar app**). Queda con su ícono, abre sin internet y Chrome protege los datos.
3. Pon la tasa del día con el botón de arriba.
4. **Más → Dinero en cuentas → Saldo inicial** de cada cuenta.
5. **Productos**: toca cada producto y pon su costo aproximado, para ver la ganancia y los márgenes.

## Cómo llegan los pedidos

- El cliente arma el pedido en la página y lo envía por WhatsApp al 0414-1445118.
- Al final del mensaje viene un enlace "Para el local". En el teléfono del local, toca ese enlace y el pedido aparece en **Pedidos** con los precios del panel. El mismo enlace dos veces no lo duplica.
- Si el enlace no abre el panel, copia el mensaje completo y usa **Pedidos → Pegar pedido**.
- Cada pedido pasa por **Aceptar → En cocina → Listo → Entregado**. Se cobra en cualquier momento, con una o varias formas de pago, en dólares o en bolívares a la tasa del día.

## Uso diario

- **Caja**: ventas en el mostrador. Toca los productos, abre el ticket y cobra. **Cobrar después** deja la venta en **Por cobrar**.
- **Productos**: precios, agotados (interruptor), costos y receta con insumos (opcional). En **Inventario** se anotan compras, usos o mermas y conteos.
- **Finanzas**: reportes por día, semana y mes; **Meses** (tabla comparativa); **Resultados** (estado de resultados del mes, para imprimir o compartir); **Márgenes** por producto.
- **Más**: gastos, dinero en cuentas, por cobrar, cierre de caja, historial (con anulación de ventas), formas de pago, copia de seguridad y contraseña.
- El día del negocio va de 4:00 a. m. a 4:00 a. m.: lo vendido después de medianoche cuenta en la noche anterior.

## Importante: los datos viven en un solo teléfono

- No se sincroniza con otros teléfonos. Úsalo siempre en el mismo teléfono y en Chrome.
- Si se borran los datos de Chrome o se pierde el teléfono, se pierde todo. Por eso: **Más → Copia de seguridad → Guardar y enviar copia**, una vez por semana. El panel avisa cuando pasan 7 días.
- Para pasar todo a otro teléfono, restaura la copia allí.

## Cambiar precios o productos de la página

- Edita `menu.js` (precio, nombre, descripción u opciones), suma 1 a `VERSION_MENU` y sube el cambio a GitHub. Vercel publica solo.
- Al abrirse, el panel toma los precios nuevos de la página, salvo los que el local cambió a mano.
- Si el local cambia un precio en el panel, la caja ya cobra con ese precio, pero la página sigue igual hasta que se actualice `menu.js`. El panel muestra un aviso con el botón **Pedir el cambio por WhatsApp**, que escribe a soporte con la lista.
- No cambies el `id` de un producto ya publicado: viaja en los enlaces de los pedidos.
- Fotos de productos: ponlas en `img/productos/` (en webp) y agrega `foto: "img/productos/h3.webp"` al producto en `menu.js`.
- Si cambias archivos del panel, cambia también `VERSION` en `sw.js` (por ejemplo `sd-panel-v2`) para que los teléfonos tomen lo nuevo.

## Probarla en la computadora

Ábrela con un servidor local (por ejemplo `npx vercel dev` dentro de la carpeta, o la extensión Live Server de VS Code). Si el servidor no entiende `/admin`, entra a `/admin.html`.
