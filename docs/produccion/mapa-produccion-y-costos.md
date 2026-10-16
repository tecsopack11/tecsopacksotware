# Mapa de producción, inventario y costos

Estado: definición inicial del 15 de octubre de 2026. El catálogo genérico está preparado en código; órdenes, recetas y traslados de producto en proceso todavía no están implementados. Esta definición no cambia movimientos históricos.

## Reglas confirmadas

- Conservar VERDE CLARO y VERDE OSCURO como materiales separados.
- Toda salida de MP descuenta la ubicación de origen en la misma transacción. Nunca descontar el mismo evento dos veces por reintentos o por su posterior recepción.
- Los destinos productivos que reciben MP son EXTRUSIÓN e IMPRESIÓN, esta última para tintas. Los demás procesos reciben producto en proceso. Confirmar tratamiento de solventes y otros auxiliares de impresión antes de bloquear destinos.
- El superadministrador consulta kilos, orden, ubicación e historial. El operario registra avances y traslados hasta finalizar el ciclo de la orden, con permisos de servidor y base de datos por área asignada.
- Las compras e importaciones ocurren durante todo el año con precios variables. El costo parte de las recepciones de MP y continúa con la mezcla, cantidades consumidas y desperdicio de cada producto.

## Flujo y balance físico propuestos

1. Compra/importación → recepción en bodega: registrar material, lote, cantidad, unidad, fecha y costo de adquisición. Una corrección de precio no vuelve a ingresar cantidades.
2. Entrega a producción: seleccionar OP, material/lote, origen y máquina/área permitida. Descontar bodega y conservar cantidad entregada a la OP, todavía separada de su consumo real.
3. Transformación: registrar consumo real y generar lote(s) de producto en proceso, con kilos buenos, desperdicio, recuperable y saldo de MP sin consumir. La MP entregada no equivale automáticamente a MP consumida.
4. Traslado interno: enviar parte o todo un lote a la siguiente etapa autorizada, manteniendo OP, lote de origen, kilos y costo. No vuelve a salir MP de bodega. Si hay recepción confirmada, el envío queda en tránsito hasta recibirlo.
5. Cada etapa registra entrada, salida útil y pérdidas. Permitir producción parcial y división de lotes entre máquinas; una OP puede tener saldos simultáneos en varias ubicaciones. No basta con guardar una única ubicación en la cabecera de la OP.
6. Finalización: recepción de PT vinculada a OP/lote y referencia, con unidades y peso real en kg. No deducir peso a partir de calibre, dimensiones ni tamaño del paquete.
7. Despacho: descontar PT de su almacén, conservar cliente, pedido/orden de compra y lote(s). Diferenciar terminación de fabricación y entrega al cliente.

Balance de MP por OP: entregado = consumido + devuelto + saldo sin consumir. Balance por etapa: entrada + incorporaciones = salida útil + desperdicio + recuperable + saldo en proceso. El tratamiento de tinta/solvente necesita medir incorporaciones y pérdidas sin asumir que toda tinta entregada queda en el producto.

Los movimientos deben conservar identificador único de solicitud, fecha operativa, fecha de registro, responsable, origen/destino, OP y lote. Validar saldo y bloquear concurrencia dentro de PostgreSQL. No aceptar saldos negativos. Anulaciones y correcciones deben dejar trazabilidad y revertir saldos/costos; evitar borrar eventos. Una devolución debe vincularse a su entrega original.

## Modelo propuesto

- Cliente y orden comercial/OC; una OP puede ser para cliente o reposición de genérico.
- Referencia de producto y variante: familia, diseño, color, dimensiones, calibre y unidades por presentación. Identificador interno único; L15 por sí solo no identifica una variante.
- Receta versionada: materiales, unidad base kg, proporciones/cantidades, vigencia, rendimiento y desperdicio esperado. Conservar la versión usada en cada OP.
- OP y líneas: número, cliente cuando aplique, referencia, cantidad solicitada, unidad, kg objetivo si se conocen, entrega y OC. Registrar kg reales por separado del objetivo.
- Ruta versionada por producto, operaciones y máquinas habilitadas; confirmar secuencia real antes de crearla.
- Lotes de producto en proceso y genealogía de divisiones/uniones; saldos por OP, lote y ubicación.
- Entregas, consumos, devoluciones, transformaciones, desperdicios y traslados/recepciones como eventos relacionados, con permisos por rol y área.
- Lotes de PT, unidades y kg reales, vínculo a OP y costo acumulado.

## Costos

Confirmación del usuario: permitir tantos ingresos de costo y cantidad de una misma MP como se necesiten, sin límite de registros por material/año. Cada recepción conserva fecha, cantidad y precio para la trazabilidad anual. La captura debe indicar explícitamente precio por unidad y mostrar el valor total del ingreso para evitar confundirlos.

El promedio acumulado de compras del año se calcula como suma de valores de adquisición / suma de cantidades recibidas, siempre en una unidad compatible. No es la media simple de los precios. Mostrar historial por material, total recibido, valor comprado y promedio acumulado; permitir consultar años anteriores. Las recepciones sin precio quedan pendientes y deben indicarse fuera del promedio valorado. Este reporte anual se debe añadir: la base existente tiene promedio mensual y valoración móvil, pero no debe presentarse el mensual como anual.

Ejemplo: 100 kg a $5.000/kg y 300 kg a $4.000/kg = $1.700.000 / 400 kg = $4.250/kg. Cada costo de consumo por OP debe conservar fecha y base de valoración; confirmar si la empresa quiere aplicar a las OP el promedio de compras acumulado al momento del consumo o el promedio móvil de existencias. Son cifras distintas cuando hubo consumos entre compras. No reemplazar silenciosamente el método de valoración existente.

Existe una base de costos de MP documentada en `docs/costos-materia-prima.md`: compras por recepción, gastos de importación, moneda/tasa de cambio, promedio móvil e identificación de costos pendientes. Revisar y conciliar su estado desplegado antes de ampliarla; hay cambios locales previos en ese módulo.

Separar costo estimado de receta y costo real de fabricación. El estimado usa una versión de receta, cantidades objetivo y rendimiento esperado. El real usa consumos efectivos y costo vigente al consumo, más transformación identificada. Los traslados conservan el valor; las etapas siguientes añaden sus costos sin duplicar MP.

Guardar evidencia del costo aplicado al consumo; una nueva compra no debe cambiar silenciosamente el costo de una OP cerrada. Definir política para correcciones tardías de facturas/gastos y órdenes ya cerradas. Una entrada sin costo deja una valoración pendiente, nunca costo cero.

Distinguir desperdicio esperado de desperdicio real y recuperable. No sumar un porcentaje de desperdicio otra vez cuando ya está incluido en el consumo real. Definir tratamiento de recuperado y pérdidas anormales antes de calcular márgenes. Para costo completo faltan energía, mano de obra, empaque y demás costos de transformación acordados; mostrar alcance del costo mientras estén pendientes.

## Información para solicitar a planta

1. Lista de procesos, máquinas y ubicaciones; rutas por familia y excepciones, productos sin impresión, reprocesos y trabajos externos. Quién envía y quién confirma recepción.
2. Una OP real completa y su recorrido: número, cliente o reposición de stock, referencia/variante, cantidad/unidad, kg solicitados si existen, fechas, OC y entregas parciales.
3. Mezclas por producto: materiales exactos, porcentajes o kg por tanda, tamaño de tanda, colores/aditivos y vigencia. Fórmulas de extrusión y consumos de tinta separados.
4. Rendimiento y desperdicio esperado por etapa; cómo pesan desperdicio, recuperable, bobinas, empaques y taras. Cómo registran devoluciones/sobrantes y reutilización.
5. Cómo identifican bobinas, paquetes y lotes; si pueden dividir/mezclar lotes u órdenes; instrumentos y precisión de pesaje. Existencias iniciales de MP, producto en proceso y PT por ubicación, fecha y lote.
6. Compras/importaciones de ejemplo: factura, cantidades y unidades reales, precio, moneda, tasa, descuentos, flete, seguros y otros gastos; criterio de reparto entre materiales. Costos históricos disponibles y saldos iniciales valorizados.
7. Base para transformación: tarifas de operarios, tiempos, energía/máquina, empaque y otros costos; quién puede consultar/corregir precios y quién aprueba/cierra OP.
8. Del Excel: unidades de dimensiones y calibre; confirmar referencia L11 para 13X13 y R-19 para 17X20. La lista no aporta kg por unidad ni cantidades actuales disponibles.

## Primera entrega del catálogo

Fuente: `LISTA DE GENERICO.xlsx`. Se transcribieron 63 variantes: 41 láminas y 22 bolsillos. Los campos vacíos de referencia/diseño se interpretaron como continuación de la fila anterior dentro de cada sección. Se conserva `sourceRow` para revisión.

`lib/products/generic-catalog.json` conserva los atributos del archivo. `/inventario-pt/catalogo` permite buscarlos y revisarlos; un administrador activo puede agregar productos al catálogo existente, medidos en unidades. La carga usa códigos internos por variante y no sobrescribe productos con el mismo código. Antes de cargar en una base con referencias previas, revisar equivalencias para evitar duplicados con otros códigos.

Los atributos estructurados provienen por ahora del archivo versionado; la tabla `products` recibe código y nombre descriptivo. No se agregaron existencias, pedidos, recetas ni conversiones de kg. Migrar estas especificaciones a un catálogo editable en base de datos forma parte de la siguiente etapa. La carga y el despliegue no se ejecutan automáticamente al abrir la pantalla.
