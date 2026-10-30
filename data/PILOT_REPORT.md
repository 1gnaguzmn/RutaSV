# Resultado del piloto AB008A0SS

Captura local: `20261029T224448147697Z`, realizada el 29 de octubre de 2026. Nombre publicado: `8-A`. El servicio informa última edición de datos el 20 de septiembre de 2022. No se verificó operación vigente ni se confirmó la licencia de redistribución.

| Resultado | Cantidad |
|---|---:|
| Trazados originales / exportados | 2 / 2 |
| Registros de paradas originales / exportados | 31 / 31 |
| Pares candidatos por código exacto | 62 |
| Registros rechazados | 0 |
| Asociaciones revisadas | 0 |
| Grupos de coordenadas coincidentes conservados por separado | 2 |
| Trazados con autointersecciones | 2 |

En los **62 pares candidatos**, 54 están a menos de o igual a 50 m, 3 entre 50 y 100 m y 5 a más de 100 m. Estos pares incluyen ambos trazados para cada parada y no constituyen asociaciones confirmadas.

Limitando el diagnóstico a la hipótesis **no confirmada** `I→01 / R→02`, hay 31 pares: 3 superan 50 m, incluidos 2 superiores a 100 m. La distancia máxima es aproximadamente **282.978 m**. Esta medición reproducible en UTM 16N sustituye la aproximación exploratoria en Web Mercator del informe inicial, que había contado cuatro casos superiores a 50 m. Los umbrales no describen exactitud del levantamiento.

Los 31 puntos presentan diferencias de aproximadamente 9.59–9.62 m entre la geometría y los atributos `Latitud/Longitud`. Ambas representaciones se conservaron; no se ajustaron ni fusionaron puntos.

Los dos GeoJSON usan EPSG:4326, posiciones 2D y estado `unverified`. Se confirmó que el validador TypeScript existente acepta las colecciones. Ambos trazados mantienen **`stop_ids: []`**, porque todavía no hay revisión de sentidos ni secuencias. La ausencia de rechazos geométricos no equivale a verificación operacional.

Los originales se encuentran en `raw/arcgis-vmt/20261029T224448147697Z/` y los resultados en `processed/arcgis-vmt/20261029T224448147697Z/`. Allí están los manifiestos, hashes, CSV de candidatos y reportes completos. Esas carpetas se conservan localmente y están excluidas de Git; durante la importación inicial no se copiaron al frontend ni a una base de datos.

Pendiente para otra iteración: resolver las condiciones de reutilización, revisar sentido/orientación/orden, inspeccionar las paradas alejadas y contrastar la vigencia con fuentes actuales o trabajo de campo. No se fabricó una revisión para completar esas tareas.

## Integración posterior en la demo

Se preparó una copia estática en `test-rutasv/public/data/pilot/`, utilizando esta instantánea como referencia. Por decisión de alcance de la demo, se interpreta `I→01 / R→02` y se muestran 14/17 registros mediante una relación `shape_id` marcada `demo_direction_mapping`. La lista es alfabética, sin orden de viaje. Los originales, procesados y resultados de auditoría anteriores permanecen intactos; `stop_ids` sigue vacío y no se declaró verificación de campo. La preparación se ejecuta con `data/scripts/prepare_pilot_demo.py` desde la raíz del proyecto, como explica el README de datos.
