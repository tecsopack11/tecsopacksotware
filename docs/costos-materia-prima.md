# Costos de materia prima — primera entrega

## Flujo operativo

1. En **Inventario → Ingresos / Salidas**, digitar cantidad y precio COP por la unidad del material, únicamente en las entradas. Cada compra a un precio distinto se guarda por separado. Las salidas no requieren precio.
2. El precio informado queda provisional. Un supervisor o administrador puede completar factura, proveedor, descuentos y gastos en **Inventario → Costos de MP**. No se vuelve a ingresar la cantidad.
3. **Compra con gastos** permite registrar una nueva recepción completa; cantidad, lote y costo se guardan en la misma transacción. No usarla para cantidades ya ingresadas.
4. Los dos formularios de recepción tienen identificadores de solicitud para evitar duplicados por reintento. Las correcciones tienen control de versión y conservan fecha, motivo y autor.

## Tres cifras distintas

- **Promedio de compras del mes:** suma de costos de compras / suma de cantidades de esas compras, por material y unidad. Incluye costos provisionales; las entradas sin precio se excluyen y se cuentan explícitamente. La fecha de compra determina el mes.
- **Promedio móvil de existencias:** se reconstruye en orden de fecha operativa, fecha de registro y secuencia de inserción. Cada entrada actualiza el promedio; cada salida consume al promedio vigente. Los movimientos internos conservan su valor, incluso en tránsito. Se usa un único promedio por material para todas las ubicaciones internas.
- **Valor al final del mes:** reconstrucción del saldo con movimientos cuya fecha operativa sea anterior o igual al mes elegido. Es un reporte operativo revisable, no un cierre contable bloqueado. Usa las revisiones de costos vigentes al consultar.

Ejemplo: 2.900 kg × $5.000 + 24.000 kg × $3.900 = $108.100.000 / 26.900 kg = **$4.018,59/kg**. Si los primeros 2.900 kg se consumieron antes de la segunda recepción, el costo del inventario remanente es **$3.900/kg**; el promedio mensual de compras sigue siendo $4.018,59/kg.

## Costo de una recepción

`(cantidad × precio − descuento) × tasa de cambio + flete + seguro + impuestos no recuperables + otros gastos`

Precio y descuento se expresan en moneda de compra (COP, USD o EUR). Gastos e impuestos se expresan en COP. La tasa para COP es 1. Los impuestos recuperables se registran por separado y no integran el costo. La asignación de gastos compartidos es manual y exige explicar el criterio; no hay reparto automático entre materiales de un contenedor.

La unidad es la del catálogo: **no se interpreta un bulto como un kg**. La calculadora de mezclas convierte kg/g/ton; para bultos o cuñetes exige una futura equivalencia de peso. Permite simular mezclas con ingredientes distintos que sumen 100%, sin guardar recetas ni mover inventario.

## Datos incompletos y trazabilidad

- Las entradas históricas siguen sin precio hasta que se complete su costo. Nunca se convierten en costo cero.
- Si una entrada sin precio se mezcla con inventario conocido, la valoración del saldo queda pendiente hasta completar los costos o agotar ese saldo. Una cronología con inventario negativo se marca para revisión.
- Los ajustes positivos y devoluciones sin costo de origen permanecen pendientes. No se les asigna el último precio de compra de forma automática.
- Las cancelaciones excluyen movimientos y reconstruyen la valoración. No se reescriben ni eliminan revisiones de costos.
- La fecha operativa de registros diarios anteriores se recupera del documento REG/VENTA-MP cuando es válido; para otros movimientos anteriores se usa la fecha de creación en Bogotá. Esto requiere contrastar el historial real antes de usar reportes como cifras de cierre.
- El total de valor identificado excluye materiales sin valoración completa. No representa el valor completo si hay pendientes.
- La valoración por área usa el promedio global de cada material. El inventario en tránsito interno forma parte del valor total, aunque todavía no figure disponible en el destino.

## Acceso y validaciones

Operarios: capturar precio inicial en sus propias entradas. Supervisores y administradores activos: consultar, exportar, registrar compras completas y corregir costos. Se verifica el acceso en servidor y PostgreSQL; las revisiones no admiten escrituras directas desde usuarios autenticados.

`material_cost_snapshot()` obtiene catálogos, movimientos y últimas revisiones en una sola instantánea, sin el límite predeterminado de 1.000 filas de consultas REST. Para historiales grandes convendrá trasladar agregados al servidor y paginar el historial; la primera entrega reconstruye el conjunto en memoria del servidor Next.js.

## Instalación y comprobación

- Aplicar `supabase/migrations/0011_material_costs.sql` y publicar el código coordinadamente. La pantalla indica que falta la migración cuando el RPC no está disponible. El nuevo registro diario depende de esta migración.
- La migración no añade compras, precios históricos ni recetas de ejemplo; sí recupera fechas operativas del historial existente.
- `npm run test:costs` (Node 22.18+): cálculo del promedio, consumo entre compras, tránsito, pendientes, cancelaciones y fechas; migraciones completas en PostgreSQL embebido (PGlite), transacciones, permisos, versiones y reintentos.
- Compilación verificada con `npm run build -- --webpack` y ESLint en los archivos modificados. Turbopack no pudo compilar en este entorno por una restricción al abrir un puerto local, incluso tras solicitar ejecución fuera del sandbox.
- No se ha aplicado esta migración a producción desde esta entrega.

## Próximas etapas del módulo de producción

Pendientes: recetas persistentes y versionadas de lámina/bolsa, equivalencias por presentación, costo inicial validado para ajustes y saldos sin compras trazables, devoluciones vinculadas a su operación original, cierre mensual bloqueado y ajustes posteriores, costos inmutables de consumo por OP, producción intermedia y terminada, comparación estimado/real, tiempos de mano de obra, paros, energía y mantenimiento. La simulación actual no calcula estos costos de transformación.

La valoración operativa propuesta debe conciliarse con el método que use contabilidad. Referencias de diseño: [NIC 2 — IFRS Foundation](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/) y [OEE — Lean Enterprise Institute](https://www.lean.org/lexicon-terms/overall-equipment-effectiveness/).


---

# Costos de materia prima: revisión local

Ruta: `/inventario/costos` (administrador o supervisor activo).

- El bloque **PROMEDIO PONDERADO ANUAL** permite seleccionar un año y material. Se calcula por cada materia prima: suma del costo COP de sus compras / suma de las cantidades de esas compras con precio. No promedia precios sin ponderar cantidades.
- Incluye gastos de importación y otros costos atribuibles registrados. Los impuestos recuperables siguen excluidos por la lógica vigente.
- Conserva cada entrada por separado, sin límite de registros por material o año. El historial se pagina de 30 en 30 y el CSV exporta todo el resultado filtrado, no solo la página visible.
- Las entradas sin precio se muestran como pendientes y se excluyen de numerador y denominador; las provisionales quedan identificadas. Si no hay compras valoradas, se muestra PENDIENTE, nunca un costo unitario cero.
- El historial inicia con todo el año; puede consultarse solo el mes. El comparativo mensual y el cierre utilizan el mes indicado, independientemente del año del reporte anual.
- La fecha del reporte es la fecha de compra. En entradas aún sin costo, se usa la fecha operativa; al completar el precio, su fecha de compra determina el año definitivo.
- Se mantiene separado el promedio móvil operativo del inventario. Los consumos y traslados no reducen el promedio anual de compras.
- El registro rápido crea una entrada nueva en una bodega activa y su costo de manera atómica, con identificador de reintento para impedir duplicar ese envío. Si la entrada ya existe, debe completarse desde el historial; no debe registrarse otra compra.
- No se modifica la valoración histórica de las órdenes ni se inventan costos faltantes. Corregir precios recalcula el reporte; no implementa un cierre contable inmutable.

## Validación

ESLint del módulo y `npm run test:costs`: cálculos financieros, 1.500 compras sin truncamiento en el cálculo, pendientes sin cero, costos de importación, revisiones, permisos, atomicidad e idempotencia en PostgreSQL local mediante PGlite. No se ejecutaron escrituras en servicios remotos.

## Recorrido sugerido

1. Abrir `/inventario/costos?ano=2026` y revisar el panel anual.
2. Seleccionar material y año; revisar cantidades con costo, compras pendientes y promedio por unidad.
3. Consultar historial anual, cambiar a mensual y descargar CSV con formato decimal colombiano.
4. Abrir una entrada existente para revisar/corregir precio sin sumar kilos otra vez.
5. La creación de compras es una escritura de inventario: probarla únicamente con una base local antes de aceptar los cambios. La vista local puede seguir conectada a una base remota según su configuración.
