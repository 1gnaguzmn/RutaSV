# RutaSV · demo frontend v0.1

Prototipo local para explorar **8-A, 30A, 29G, 101A, 44 y 2-C** en San Salvador y el AMSS. React, TypeScript, Vite y MapLibre GL JS; identidad visual definida en `../agents/DESIGN_SYSTEM.md`.

## Ejecutar

Con Node.js 22.13 o superior y npm:

```sh
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Abrir la dirección local que indique Vite. `--legacy-peer-deps` conserva las versiones existentes: TypeScript 7 está fuera del rango soportado por la configuración actual de typescript-eslint. No se cambiaron esas versiones para esta demo.

```sh
npm run build
npm run preview
npm test
npm run lint
```

El build comprueba TypeScript y genera `dist/`. Los tests usan el runner de Node y su soporte experimental para eliminar tipos, sin otra dependencia de tests. ESLint actualmente no puede iniciarse por la incompatibilidad mencionada. Vite puede advertir que el bundle de MapLibre supera 500 kB.

## Uso

- Al cargar se muestra **Explorar rutas**, sin selección ni recorridos dibujados, centrado en San Salvador `[-89.19, 13.70]` y zoom 12. El buscador acepta nombres con o sin guiones/espacios y códigos originales, ignorando mayúsculas y acentos: `8-A`, `8A`, `8 A`, `AB008A0SS`, `30A`, `MB030A0`, `2C`, `AB002C0`. Los trazados se agrupan en seis tarjetas.
- En móvil, expandir/contraer el panel con el botón; no hay arrastre. En escritorio, desde 1024 px, el contenido ocupa un panel lateral de 400 px. En pantallas bajas se limita la altura del panel y se recolocan controles para conservar el mapa accesible.
- Seleccionar una tarjeta abre su primer recorrido disponible. En la 8-A, el selector alterna entre **Recorrido 01 (14 paradas)** y **Recorrido 02 (17 paradas)**. La interpretación para esta demo es `I→01 / R→02`, según los códigos de la fuente.
- 30A muestra 34/33 registros y 29G 34/32. 101A y 44 tienen trazados, pero la capa de origen no incluye sus paradas; el panel lo indica. 2-C conserva cuatro trazados (dos 01 y dos 02), identificados por registro de origen. Sus 26/17 paradas se muestran en todos los trazados con código compatible, con una nota sobre la variante no especificada. La tarjeta cuenta 43 registros una sola vez.
- Seleccionar una tarjeta abre su ficha, dibuja exclusivamente ese trazado en verde y lo encuadra. Se muestran solo sus paradas asociadas, sin agrupación. Seleccionar una parada abre sus detalles; volver conserva el recorrido o grupo anterior. Las paradas de un recorrido siguen en **lista alfabética sin numeración de viaje**, con la nota “Orden de viaje no definido”.
- Buscar regresa a explorar sin dibujar rutas. **Limpiar selección** también vuelve a explorar y conserva cámara y búsqueda. Sin selección, el control de encuadre vuelve al centro de San Salvador y zoom 12.
- Los controles permiten acercar, alejar, encuadrar y solicitar una ubicación puntual. No se solicita ubicación al iniciar ni se sigue al dispositivo. La ubicación requiere localhost o HTTPS y permiso del navegador; el marcador corresponde al usuario, nunca a un bus.
- El encuadre considera la cabecera, los controles, las atribuciones y el panel. Redimensionar el viewport vuelve a encuadrar el trazado seleccionado; plegar el panel conserva la cámara. El panel lateral desplaza su contenido sin aumentar la altura del mapa.
- “Planificar un viaje” solo informa que estará disponible en otra fase.

## Identificación visual del mapa

Las tarjetas conservan un color estable por ruta: 8-A azul, 30A naranja oscuro, 29G violeta, 101A magenta, 44 cian oscuro y 2-C pizarra. En el mapa solo aparece el recorrido seleccionado, en verde con contorno blanco. Limpiar oculta su línea y etiqueta; no se dibujan los demás recorridos como contexto. Los nombres y el panel permiten identificar rutas sin depender solo del color.

Desde **zoom 12**, la etiqueta del trazado seleccionado muestra su nombre y código de recorrido, por ejemplo `30A · 01`. Usa texto de 12–14 px, halo blanco y separación de 300 px entre repeticiones. Se reutiliza el font stack regular del estilo Liberty y su endpoint de glyphs, sin otro proveedor de fuentes. Las paradas tienen prioridad cuando coinciden sus áreas táctiles.

Al explorar, las paradas de RutaSV se ocultan por debajo de **zoom 11**. Desde 11 hasta antes de 15 se muestran agrupaciones con contador y puntos individuales. Se usan `clusterRadius: 50`, `clusterMinPoints: 2` y `clusterMaxZoom: 14`. Desde **zoom 15** aparecen iconos individuales de señal de parada de 24 px, dibujados localmente con Canvas 2D y registrados a densidad 2. Los círculos quedan como respaldo; las áreas táctiles son de 44 px.

Pulsar un grupo usa `getClusterExpansionZoom` para acercarse. Si la expansión supera el límite de agrupación, se consultan sus miembros con `getClusterLeaves` y se abre el listado en el panel. Las pulsaciones ambiguas sobre puntos superpuestos abren el mismo listado, con nombre, rutas asociadas, orden alfabético y **50 registros por página**. Abrir una ficha y volver conserva el grupo y su página. Los contadores representan registros de la fuente, sin deduplicar por posición ni afirmar que sean paradas físicas distintas.

Al seleccionar un recorrido, se oculta la exploración agrupada y se muestran solo sus paradas, sin agrupar. Una parada abierta desde explorar conserva las agrupaciones y se destaca individualmente sin dibujar rutas. Las consultas de grupos que fallen permiten reintentar; las respuestas tardías se descartan al cambiar selección, datos o instancia del mapa.

MapLibre evita colisiones entre etiquetas y entre iconos normales, por lo que algunos pueden ocultarse cuando no hay espacio. La parada seleccionada permanece destacada. Los registros coincidentes no se fusionan y las geometrías no se desplazan para separar trazados. Las listas y el selector siguen permitiendo consultar las variantes de 2-C y los registros superpuestos.

`features/routes/routeAppearance.ts` resuelve los colores de tarjetas mediante los tokens CSS; los fixtures Demo A/B siguen usando `color_key: "a" / "b"`. `components/map/layerStyles.ts` centraliza zoom, agrupación y fuentes. `StopLayer` conserva una fuente agrupada de exploración y otra sin agrupar para el contexto, actualizada con `setData`. Las capas cambian de filtro/visibilidad sin recrear el mapa ni crear marcadores HTML por parada. Los GeoJSON, el contrato de datos y el importador permanecen intactos. Las preferencias históricas de ruta inicial que siguen en los archivos ya no se usan para seleccionar automáticamente.

La política afecta a las capas de RutaSV; los puntos de interés y atribuciones del mapa base Liberty permanecen. La visualización de itinerarios se documenta para una fase posterior: únicamente segmentos elegidos, bus con línea continua verde, caminatas con línea discontinua gris e hitos diferenciados. No se añadió un visualizador ni cálculo de viajes.

## Datos y atribuciones

La aplicación carga `public/data/transit/routes.geojson` y `stops.geojson`: **6 rutas, 14 trazados y 207 registros de paradas**. `catalog.json` documenta códigos, conteos, geometrías, instantáneas, edición, ausencia de paradas y hashes. La 8-A conserva la instantánea `20261029T224448147697Z`; las cinco nuevas tienen capturas independientes fijadas en `../data/demo_sources.json`. No consulta ArcGIS durante la ejecución. Los archivos generados están incluidos en el frontend y Vite no requiere Python para iniciarse.

Fuente de referencia para la demo: VMT / ArcGIS. Edición declarada: 20 de septiembre de 2022; captura: 29 de octubre de 2026. Se conservan `source`, `source_snapshot`, `source_updated_at`, `verification_status: "unverified"` y `verified_at: null`. Los detalles muestran la procedencia y la fecha, sin afirmar verificación de campo.

`route_id` agrupa la ruta general; `recorrido_code` conserva el código publicado del recorrido y `id` identifica cada trazado. `shape_ids` asocia una parada a uno o varios trazados compatibles, con `association_basis: "demo_direction_mapping"`; `shape_id` sigue disponible cuando la asociación es única. Esa asociación es la interpretación elegida para la demo, no una secuencia revisada. **`stop_ids` permanece vacío**, y `stop_sequence_status` sigue en `pending`. La función compartida `getRouteStops` resuelve mapa, cantidades y fichas sin suponer un orden de viaje.

Coordenadas GeoJSON: `[longitud, latitud]`. Se conservaron geometrías, IDs y todos los registros, incluidos los puntos alejados del trazado. Se admiten `LineString` y `MultiLineString`; las partes no se concatenan, y el encuadre considera todos sus vértices. No se fusionaron ni ajustaron paradas. La carga valida referencias, código de ruta y sentido. Los datos ficticios Demo A/B en `public/data/routes.geojson` y `stops.geojson` y la copia histórica `public/data/pilot/` se conservan, separados del catálogo actual.

Para regenerar los archivos, desde la raíz del repositorio y con el entorno Python del importador instalado:

```powershell
.\data\.venv\Scripts\python.exe data/scripts/import_demo_routes.py prepare
```

Este comando lee y valida todas las instantáneas fijadas, y reemplaza solamente la copia derivada en `public/data/transit/`, sin red. Para incorporar rutas nuevas a `../data/demo_routes.json`, ejecutar `import_demo_routes.py run`: captura únicamente códigos todavía no registrados, procesa y prepara. No modifica originales, procesados anteriores ni fixtures ficticios. La preparación es reproducible; los comandos y metadatos están documentados en `../data/README.md`. No hay filtro geográfico automático: se importan únicamente los seis códigos elegidos para esta demo del AMSS.

Las condiciones de reutilización de la fuente siguen documentadas como no especificadas en los metadatos. Esta integración no realiza un despliegue ni interpreta esa ausencia como una licencia abierta.

El mapa base usa [OpenFreeMap Liberty](https://openfreemap.org/quick_start/), con datos de [OpenStreetMap](https://www.openstreetmap.org/copyright) y atribución a [OpenMapTiles](https://openmaptiles.org/). Las atribuciones proporcionadas por el estilo se conservan en el control del mapa. Se necesita conexión para descargar el estilo, teselas y fuentes; no se ofrece funcionamiento sin conexión.

## Organización y estados

- `components/map/`: ciclo de vida del mapa, capas de rutas/paradas y controles. Mapa en carga muestra un indicador; un fallo ofrece reintento y mantiene accesible el panel. Reintentar reconstruye la instancia conservando el centro/zoom y la selección de la aplicación.
- `components/layout/` y `components/ui/`: cabecera, búsqueda y panel no modal. Panel colapsado/expandido, foco al navegar entre fichas y contenido desplazable. La búsqueda sin coincidencias muestra un mensaje y permite limpiar.
- `features/routes/` y `features/stops/`: tarjetas, fichas, listado paginado de grupos y transiciones de selección. Colecciones vacías muestran “Aún no hay rutas cargadas”. Sin datos válidos no se dibujan capas.
- `services/`, `hooks/` y `types/`: carga estática, validación, estado de carga/error/reintento e inicialización de la selección. `features/routes/routeData.ts` centraliza agrupación y asociación de paradas. Las fichas no consultan servicios por separado.
- `styles/tokens.css`: colores, espaciado, radios y sombras reutilizables. CSS por componente; fuente de sistema, sin descargas de tipografía. Movimiento reducido, controles de 44 px y foco visible.

## Comprobaciones

`npm test` cubre catálogo, piloto y fixtures: búsquedas, referencias, conteos, multipartes, cuatro variantes de 2-C, colores de tarjetas, contexto de paradas, grupos, paginación, regreso entre fichas, reintentos y descarte de respuestas obsoletas. Incluye 10.000 registros sintéticos para comprobar orden y conservación sin deduplicar. Las pruebas Python del importador siguen disponibles; esta actualización no cambia sus scripts ni sus datos.

Para revisar visualmente:

1. Probar anchos de 320, 390, 768, 1024 y 1280 px, orientación horizontal y zoom al 200 %: sin desbordamiento ni superposición entre controles, panel y búsqueda.
2. Comprobar inicio sin ruta seleccionada ni líneas de RutaSV. Revisar zoom 10.9/11/14.9/15/16: ocultación, agrupaciones, puntos e iconos.
3. Pulsar grupos separables y terminales; abrir registros superpuestos y volver desde una ficha. Probar páginas de 50 registros y conservar página, búsqueda y cámara.
4. Buscar `8-A`, `8A`, `8 A` y `AB008A0SS`: un resultado con dos recorridos y 31 registros. Seleccionar y alternar 01/02: solo ese trazado y 14/17 paradas, con lista sin numeración. Repetir con los demás trazados, incluidas 101A/44 sin paradas.
5. Limpiar selección, comprobar que desaparecen todas las líneas y se recuperan las agrupaciones. El botón de encuadre debe volver a San Salvador y zoom 12.
6. Navegar con Tab/Enter y flechas del selector; comprobar foco, toque, movimiento reducido y recuperación tras fallos de datos/mapa o consulta de grupos.

La visualización progresiva se verificó con Edge headless: inicio en zoom 12 sin selección, ausencia de líneas y clics de recorridos ocultos, límites de zoom, expansión/listado de grupos, nombres/rutas asociadas, los 14 trazados y sus conteos, limpieza conservando cámara y búsqueda, encuadre, errores/reintentos de grupo y respuestas tardías tras seleccionar una ruta. Se conservaron la instancia del mapa y las tres fuentes GeoJSON al cambiar de contexto.

Se comprobaron 320, 390, 768, 1024 y 1280 px, orientación horizontal y una superficie de 640×400; selector con teclado y toque simulado en 390×844. Con 10.000 puntos coincidentes, inyectados solo en memoria durante la prueba, el mapa mostró una agrupación, no creó marcadores HTML y el panel renderizó 50 filas por página; abrir una ficha y volver recuperó la segunda página. No hubo excepciones de JavaScript ni consultas a ArcGIS. La comparación de hashes comprueba que originales, procesados, GeoJSON públicos e importador siguen intactos.

El zoom nativo al 200 % y el uso táctil en un dispositivo físico siguen pendientes de comprobación manual.

No incluye backend, autenticación, horarios, predicciones, seguimiento GPS de buses ni cálculo de viajes.
