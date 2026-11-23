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
- **Más**: gastos, dinero en cuentas, por cobrar, cierre de caja, historial (con anulación de ventas), formas de pago, impresora y factura fiscal, copia de seguridad y contraseña.
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
- **Lo más pedido** (carrusel de arriba) y **Te puede gustar** (sugerencias dentro del pedido) se cambian en `DESTACADOS` y `SUGERENCIAS` de `menu.js`, poniendo los `id` de los productos.
- **Horario**: se cambia en `HORARIO` de `menu.js` (días, hora de abrir y de cerrar).
- **Adornos de Navidad** (luces, nieve, esferas y gorro): `NAVIDAD` en `menu.js`. Con `"auto"` aparecen solos del 15 de noviembre al 6 de enero; `true` los deja siempre y `false` los quita.
- La **hamburguesa bailarina** junto a Instagram está en `js/bailarina.js`.
- Fotos de productos: ponlas en `img/productos/` (en webp) y agrega `foto: "img/productos/h3.webp"` al producto en `menu.js`.
  - Para que cargue rápido en teléfonos, cada foto tiene además una versión chica de 240 px con el mismo nombre terminado en `-240.webp` (ej. `h3-240.webp`). Si una foto nueva no la tiene, la página usa la grande sin problema (solo gasta un poco más de datos).
  - Las fotos de categoría (`img/fotos/`) tienen una versión de 720 px terminada en `-720.webp`.
- Si cambias archivos del panel, cambia también `VERSION` en `sw.js` (por ejemplo `sd-panel-v2`) para que los teléfonos tomen lo nuevo.

## Formas de pago

Se cambian en `PAGOS` de `menu.js`. Hoy: **delivery** con Zelle, Binance o Pago Móvil; **para llevar y comer aquí** además con Tarjeta y Biopago. El cliente elige una al pedir (es obligatorio), sale en el mensaje de WhatsApp y en el pedido del panel, y al cobrar esa forma aparece primero. En el panel, las que no uses se apagan en **Más → Formas de pago**.

## Cambiar precios (panel → Productos → Ajustar precios)

- **Ajuste rápido**: sube o baja varios precios a la vez (por porcentaje, por monto en $ o por el margen que quieres ganar), para todo el menú o una categoría, con redondeo. Nada se guarda hasta que tocas **Guardar**, y el último ajuste se puede **deshacer**.
- En la misma lista se escriben los **costos** de cada producto, y el margen se ve al momento.
- La caja cobra con los precios nuevos apenas se guardan. Para que **la página de pedidos** también los tenga (y los productos **agotados**), toca **Descargar menu.js** y reemplaza el `menu.js` de la página (en GitHub o Vercel). Si no, usa **Pedir el cambio por WhatsApp**.

## Fotos en el panel

La **Caja** y **Productos** muestran la misma foto que la página (versión chica de 240 px). Los productos sin foto llevan el emoji de su categoría. Para cambiar o poner una foto, en **Productos** toca el producto → **Cambiar foto** (o **Enviar foto**): abre el WhatsApp de soporte con el mensaje listo, porque las fotos viven en la página.

## Imprimir comanda y ticket

- **Comanda** (para la cocina): número grande, tipo de pedido en recuadro, productos en letra grande con su opción y adicionales debajo, y la nota destacada. Sin precios.
- **Ticket del cliente**: productos con precio, total en $ y en Bs (con la tasa de la venta), forma de pago y, si se anotó, el número de factura fiscal.
- Se imprime desde la tarjeta del pedido (**Imprimir**) o desde **Más → Historial** (toca la venta → **Imprimir**).
- **Más → Impresora y factura fiscal**: papel de 58 u 80 mm, **Imprimir la comanda al aceptar** (también al vender en caja con «Enviar a cocina») e **Imprimir una prueba**.
- Impresora térmica Bluetooth o USB con Android: instala **RawBT** (o la app de la impresora) y actívala como servicio de impresión; al tocar Imprimir elige esa impresora y el papel. En computadora: elige la impresora, márgenes «Ninguno» y sin encabezados. El navegador siempre muestra la ventana de imprimir (no puede imprimir a escondidas).

## Factura fiscal

El panel **no emite facturas fiscales**: no sustituye la máquina fiscal ni un medio de facturación autorizado por el SENIAT. Por eso todo lo que imprime dice **«Documento no fiscal · No válido como factura»**. Lo que sí hace:

- Con **Anotar el número de factura fiscal** encendido (Más → Impresora y factura fiscal), cada venta confirmada tiene el botón **Anotar factura** y la caja trae el campo **N° de factura fiscal**. No deja anotar el mismo número en dos ventas.
- En **Cierre de caja**, la tarjeta **Cuadre con la máquina fiscal** muestra lo vendido hoy en Bs (con la tasa de cada venta), compara con el total del **Reporte Z** y lista las ventas de hoy sin número de factura, con **Anotar** al lado. El Reporte Z queda guardado con el cierre.

## Pensada para pedir desde el teléfono

- Carga liviana: fotos en versión chica para teléfonos, logo de 25 KB, esqueleto gris mientras llega el menú y nada se mueve mientras carga.
- El botón **Atrás** del teléfono cierra la ventana abierta (producto, pedido) en vez de salir de la página.
- Con el teclado abierto, el formulario de entrega se acomoda y el botón de WhatsApp sigue a la vista.
- **Repetir el último pedido**: quien ya pidió ve "¿Lo mismo de la última vez?" y lo carga con un toque (se guarda solo en su teléfono).
- Con "ahorro de datos" activado en el teléfono, las fotos decorativas de las categorías no se bajan.

## Probarla en la computadora

Ábrela con un servidor local (por ejemplo `npx vercel dev` dentro de la carpeta, o la extensión Live Server de VS Code). Si el servidor no entiende `/admin`, entra a `/admin.html`.
