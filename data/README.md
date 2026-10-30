# RutaSV · importación del piloto ArcGIS VMT

Importador local y de solo lectura para auditar `AB008A0SS` (nombre publicado `8-A`). No cambia el frontend, no escribe una base de datos ni publica los resultados. Los registros importados son datos de una fuente externa **sin verificación de campo**; no son los recorridos ficticios de la demo.

## Entorno y dependencias

Desde la raíz del proyecto, con Python 3.12:

```powershell
py -3.12 -m venv data/.venv
.\data\.venv\Scripts\python.exe -m pip install -r data/scripts/requirements.txt
```

Se usan Shapely y pyproj; NumPy y certifi son dependencias transitivas. `scripts/requirements.lock.txt` fija las cuatro versiones probadas. El resto usa la biblioteca estándar. El entorno queda dentro de `data/.venv/`, sin instalar paquetes globales ni requerir activación.

## Capturar y procesar

```powershell
.\data\.venv\Scripts\python.exe data/scripts/import_arcgis_vmt.py run
```

El código predeterminado es `AB008A0SS`. El programa imprime el identificador de la nueva instantánea UTC y las carpetas de originales y procesados. Solo se consultan el servicio público y sus metadatos; no se solicitan credenciales ni se llaman operaciones de edición.

Para separar descarga y procesamiento:

```powershell
.\data\.venv\Scripts\python.exe data/scripts/import_arcgis_vmt.py fetch --route-code AB008A0SS
.\data\.venv\Scripts\python.exe data/scripts/import_arcgis_vmt.py process 20261029T224448147697Z --output-id auditoria-piloto
.\data\.venv\Scripts\python.exe data/scripts/import_arcgis_vmt.py validate auditoria-piloto
```

El identificador del ejemplo corresponde a la captura incluida localmente al desarrollar esta fase; reemplazarlo por el que imprima una captura nueva. `process` y `validate` funcionan sin conexión. `--data-root RUTA` permite otro directorio de datos y debe ir antes del subcomando.

Cada captura tiene un inventario previo de OBJECTID y conteos por filtro; se descargan lotes de hasta 500, respetando el límite del servicio. Se rechazan lotes truncados, IDs repetidos/no solicitados, descargas incompletas y errores ArcGIS aunque HTTP sea 200. Hay timeout de 30 segundos y hasta 3 reintentos adicionales para errores de red o HTTP transitorios, con espera de 1, 2 y 4 segundos. Los errores ArcGIS dentro de JSON se consideran fallos explícitos, sin convertirlos en una colección vacía.

Se contrastan los IDs después de descargar y el esquema/fechas de edición de ambas capas antes y después de toda la captura. Esto detecta cambios declarados por el servicio, pero no convierte varias consultas HTTP en una transacción atómica.

Un fallo deja una instantánea marcada `incomplete`, conservando las respuestas recibidas. No puede procesarse. Repetir una captura o un procesamiento con el mismo destino existente falla sin sobrescribirlo; usar un identificador nuevo. No hay opción `--force`.

## Originales y resultados

```text
raw/arcgis-vmt/<snapshot>/
  service.json, item.json, item-data.json, metadata.xml
  owner.json, organization.json
  layers/                  # esquema/edición antes y después
  responses/               # conteos, inventarios y lotes Esri JSON
  manifest.json

processed/arcgis-vmt/<output-id>/
  routes.geojson
  stops.geojson
  candidate_route_stops.csv
  quality_report.json
  rejected_records.json
  provenance.json
  reviewed_route_stops.csv  # solo si se proporciona una revisión
```

Los originales conservan los bytes de respuesta, atributos, referencia espacial y coordenadas Z/M disponibles. Su manifiesto incluye URLs, parámetros, cabeceras útiles, fechas, tamaños, inventarios, conteos y SHA-256. El importador no modifica instantáneas anteriores; una modificación manual se detecta al procesar o validar.

Los procesados conservan `source_attributes`, identificadores de origen, instantánea y procedencia. `provenance.json` registra fechas declaradas, versiones de Python/Shapely/pyproj/PROJ, hashes del código/configuración, revisión recibida y archivos de salida. La validación comprueba también el manifiesto y los originales asociados. Es necesario conservarlos para validar posteriormente una salida.

`raw/`, `processed/`, `reviews/` y el entorno están excluidos de Git mediante el `.gitignore` de esta carpeta. Las capturas son locales: no se añaden automáticamente a `test-rutasv/public/data/` ni a ningún despliegue.

## Geometría, identificadores y calidad

- Solo se eliminan espacios exteriores de los códigos. No se quitan prefijos, ceros o sufijos ni se hacen coincidencias aproximadas.
- Se distingue ruta general (`CODIGO_RUTA`) de trazado (`GlobalID`). Los IDs incluyen el elemento ArcGIS. Para paradas se incluye la capa y OBJECTID; no se promete estabilidad si el servicio se republica.
- Las geometrías originales EPSG:3857 se transforman con `always_xy=True` a GeoJSON EPSG:4326, 2D, `[longitud, latitud]`, con 7 decimales. Esta precisión de escritura no representa exactitud del levantamiento.
- Las distancias y posiciones se calculan en UTM 16N (EPSG:32616), apropiado para este piloto del AMSS. No es una política de análisis nacional: otra zona requiere reevaluar la proyección.
- Se prefiere la geometría del servicio sobre los atributos de coordenadas. Las diferencias superiores a 5 m se informan, sin desplazar ni corregir automáticamente los puntos.
- Geometrías vacías, inválidas, curvas, multipartitas, códigos ausentes o nombres de parada vacíos quedan en `rejected_records.json`, con razón y registro original. No se unen partes inventando segmentos. Los códigos de sentido desconocidos se conservan y se advierten.
- Los puntos coincidentes no se fusionan. Pueden ser registros por ruta/sentido, no un catálogo de paradas físicas únicas.
- Los trazados con autointersecciones se señalan porque la proyección de puntos sobre ellos puede producir un orden ambiguo.

La salida cumple el contrato actual de `RouteProperties` y `StopProperties`: `color_key: "a"`, `verification_status: "unverified"`, `verified_at: null`, nombre publicado sin inventar origen/destino y propiedades adicionales de auditoría. `stop_ids` queda vacío por defecto.

## Revisar asociaciones y secuencias

`candidate_route_stops.csv` incluye un candidato por combinación de trazado y parada con el mismo código de ruta. Para el piloto son **62 pares**, no 62 paradas. No se descartan silenciosamente candidatos alejados.

`direction_hypothesis=yes` solo identifica la hipótesis no confirmada `I→01/Ida`, `R→02/Regreso`. No establece una asociación. `position_m` e `inferred_sequence` se calculan sobre la geometría original por trazado y código de parada; no se usan OBJECTID ni FID para ordenar. Todos quedan pendientes hasta revisión.

Estados espaciales:

| Estado | Interpretación |
|---|---|
| `within_50m` | Proximidad compatible; no confirma sentido ni pertenencia operacional. |
| `review_50_100m` | Revisión espacial necesaria. |
| `excluded_over_100m` | Excluido de cualquier asociación automática; requiere justificación manual. |

Para revisar, guardar una copia del CSV fuera de los originales/resultados, por ejemplo en `data/reviews/piloto.csv`. Solo para las filas realmente revisadas completar:

- `reviewed`: `yes`; dejar vacío o `no` en las demás.
- `sequence`: posición entera contigua desde 1 por trazado, sin duplicados.
- `direction`: etiqueta de sentido confirmada por quien revisa.
- `orientation`: `forward` si se conserva la orientación de la línea, `reverse` para invertirla explícitamente.
- `reviewed_by`: responsable real de la revisión.
- `reviewed_at`: fecha ISO con zona horaria.
- `override_reason`: justificación obligatoria cuando la distancia exceda 50 m, incluidos los casos superiores a 100 m.

No alterar `snapshot_id`, `shape_id` ni `stop_id`. El importador vuelve a comprobar las referencias y distancias: editar una distancia del CSV no evita sus controles. Después:

```powershell
.\data\.venv\Scripts\python.exe data/scripts/import_arcgis_vmt.py process 20261029T224448147697Z --review data/reviews/piloto.csv --output-id piloto-revisado
```

Solo esas asociaciones se incorporan a `stop_ids`; su estado será `reviewed_subset` y `stop_sequence_complete` seguirá siendo `false`. No se supone que una lista sea completa ni se cambia a verificación de campo por revisar el CSV. Sin revisión explícita, no se exporta una secuencia inferida como real. Se conserva la revisión recibida y su hash.

## Licencia y vigencia

Fuente: [FeatureServer de recorridos y paradas](https://services9.arcgis.com/4ZwMO9wShTnUDuWy/ArcGIS/rest/services/Recorridos_y_paradas_de_rutas_de_El_Salvador_WFL1/FeatureServer). El publicador es `vmt_planificacion`, identificado en el portal como Dirección General de Transporte Terrestre / Ministerio de Obras Públicas y de Transporte.

En la captura del 29 de octubre de 2026, la última edición declarada sigue siendo el 20 de septiembre de 2022. Los metadatos no especifican licencia de redistribución. Se registra `license_status: "unspecified"` y `ready_for_publication: false`. Si apareciera un texto de licencia, se marcaría `requires_review`; no se interpreta automáticamente. Se debe aclarar reutilización/atribución y verificar vigencia antes de publicar una copia.

## Comprobaciones

```powershell
.\data\.venv\Scripts\python.exe -m unittest discover -s data/scripts/tests -v
.\data\.venv\Scripts\python.exe -m pip check
```

Las pruebas no usan la red: datos sintéticos comprueban inventarios, truncamiento, errores HTTP/ArcGIS, reintentos, hashes, destinos inmutables, geometrías, ejes, datos faltantes, duplicados, sentidos desconocidos, distancias, revisiones inválidas, conservación de puntos coincidentes y determinismo. Reprocesar la misma instantánea/configuración genera los mismos GeoJSON y CSV; `processed_at` puede variar en la procedencia.

Para ver los hallazgos del piloto ejecutado, consultar `PILOT_REPORT.md` y el `quality_report.json` de su instantánea. Este proceso no valida horarios, llegadas, operación vigente, orden completo de paradas ni posición de buses.

## Copia estática para el frontend

La demo utiliza la instantánea `20261029T224448147697Z` como referencia. Se añadió una preparación explícita, separada del importador:

```powershell
.\data\.venv\Scripts\python.exe data/scripts/prepare_pilot_demo.py
```

Valida los hashes de los originales/procesados y genera exclusivamente `test-rutasv/public/data/pilot/routes.geojson` y `stops.geojson`. Esa copia sí está incluida en el frontend; los originales y procesados siguen intactos y excluidos de Git. No hace consultas de red ni despliega la aplicación.

La interpretación elegida para la demo es `I→Recorrido 01` (14 registros) y `R→Recorrido 02` (17). Se guarda como `shape_id` y `association_basis: "demo_direction_mapping"`, sin llenar `stop_ids`, crear una revisión manual ficticia ni cambiar `unverified` o `verified_at`. El script conserva geometrías, IDs, nombres y todos los puntos, independientemente de su distancia al trazado.

La lista del frontend es alfabética y sin numeración de viaje. La asociación para visualización es independiente de la secuencia que el importador deja pendiente. Los reportes de calidad originales no se alteran; su estado corresponde a la captura y auditoría, no a esta decisión de presentación de la demo.
