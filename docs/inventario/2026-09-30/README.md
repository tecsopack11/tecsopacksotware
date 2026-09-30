# Conteo físico de materia prima aplicado el 30 de septiembre de 2026

La web de Tecso Pack se actualizó con las 26 referencias del Excel `MATERIAS PRIMAS SEMANAL CCCC (2).xlsm`, hoja `SEPTIEMBRE 2026`, columna **FI (conteo físico)**. Se usaron los saldos físicos por instrucción del usuario, incluyendo las cifras escritas como texto con coma decimal; no los saldos calculados de GK.

- Total verificado: **18.797,85 kg**, en `BOD-01 / Bodega principal`.
- 24 referencias con saldo positivo; pigmento azul y tinta A20213 con saldo cero.
- Valoración provisional según columna C: **109.279.512 COP**.
- Referencia: `EXCEL-FISICO-20260926-08efecdf5755`.
- SHA-256: `08efecdf5755780a6f226793639f0b25d55f64539d7c64daba00b32e33f09374`.

El conteo aparece entre el cierre del 25 y la apertura del 26, por lo que los saldos tienen fecha operativa 26 de septiembre. Se anularon los 25 saldos activos anteriores y se crearon 24 saldos físicos en una transacción. Se conservaron el catálogo, los movimientos anteriores y su historial de costos. Los nuevos saldos no representan compras.

La transacción comprobó que el catálogo y los movimientos no hubieran cambiado y validó cantidades por referencia, ubicación y valoración. Una consulta posterior confirmó las 26 cantidades, incluidos los ceros. Los archivos de operación y comprobación están en `.tmp/inventario-2026-09-30/`.

[CSV de los saldos físicos](conteo-fisico.csv).
