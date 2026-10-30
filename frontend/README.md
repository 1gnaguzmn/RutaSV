# RutaSV · demo frontend v0.1

Prototipo local para explorar **8-A, 30A, 29G, 101A, 44 y 2-C** en San Salvador y el AMSS. React, TypeScript, Vite y MapLibre GL JS; identidad visual definida en `../DESIGN_SYSTEM.md`.

## Ejecutar

Con Node.js 22.13 o superior y npm:

```sh
cd test-rutasv
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

- Al cargar se selecciona y encuadra el **Recorrido 01** de la 8-A. El buscador acepta nombres con o sin guiones/espacios y códigos originales, ignorando mayúsculas y acentos: `8-A`, `8A`, `8 A`, `AB008A0SS`, `30A`, `MB030A0`, `2C`, `AB002C0`. Los trazados se agrupan en seis rutas.
- En móvil, expandir/contraer el panel con el botón; no hay arrastre. En escritorio, desde 1024 px, el contenido ocupa un panel lateral de 400 px. En pantallas bajas se limita la altura del panel y se recolocan controles para conservar el mapa accesible.
- El selector de la ficha alterna entre **Recorrido 01 (14 paradas)** y **Recorrido 02 (17 paradas)**. La interpretación para esta demo es `I→01 / R→02`, según los códigos de la fuente.
- 30A muestra 34/33 registros y 29G 34/32. 101A y 44 tienen trazados, pero la capa de origen no incluye sus paradas; el panel lo indica. 2-C conserva cuatro trazados (dos 01 y dos 02), identificados por registro de origen. Sus 26/17 paradas se muestran en todos los trazados con código compatible, con una nota sobre la variante no especificada. La tarjeta cuenta 43 registros una sola vez.
- Seleccionar una tarjeta o un trazado abre su ficha y encuadra el recorrido. Seleccionar una parada abre sus detalles; volver conserva el recorrido anterior. Buscar regresa a explorar. Las paradas también se pueden abrir desde la **lista alfabética sin numeración de viaje**, con la nota “Orden de viaje no definido”.
- La búsqueda mantiene todas las rutas en el mapa. Una selección resalta el recorrido en verde y muestra sus paradas. Sin selección, las paradas se ven desde zoom 11 para reducir densidad.
- Los controles permiten acercar, alejar, encuadrar y solicitar una ubicación puntual. No se solicita ubicación al iniciar ni se sigue al dispositivo. La ubicación requiere localhost o HTTPS y permiso del navegador; el marcador corresponde al usuario, nunca a un bus.
- El encuadre considera la cabecera, los controles, las atribuciones y el panel. Redimensionar el viewport vuelve a encuadrar el trazado seleccionado; plegar el panel conserva la cámara. El panel lateral desplaza su contenido sin aumentar la altura del mapa.
- “Planificar un viaje” solo informa que estará disponible en otra fase.

## Identificación visual del mapa

Cada ruta tiene un color estable en el mapa y en su tarjeta: 8-A azul, 30A naranja oscuro, 29G violeta, 101A magenta, 44 cian oscuro y 2-C pizarra. Todos los trazados de una misma ruta comparten ese color. Al seleccionar un recorrido, su línea pasa a verde con contorno blanco; al volver a explorar recupera su color. Los nombres y el panel permiten identificar rutas sin depender solo del color.

Desde **zoom 12**, las etiquetas siguen los trazados y muestran el nombre de ruta. El seleccionado añade su código de recorrido, por ejemplo `30A · 01`. Usan texto de 12–14 px, halo blanco y separación de 300 px entre repeticiones. Se reutiliza el font stack regular del estilo Liberty y su endpoint de glyphs, sin otro proveedor de fuentes. Pulsar una etiqueta selecciona ese trazado; las paradas tienen prioridad cuando coinciden sus áreas táctiles.

Las paradas conservan puntos pequeños; desde **zoom 15** aparece una señal de parada de 24 px dibujada localmente con Canvas 2D y registrada como imagen de MapLibre a densidad 2. La seleccionada se destaca en verde y aumenta ligeramente de tamaño. Su área de interacción sigue siendo de 44 px. Los puntos permanecen bajo los iconos como respaldo; si falla su generación, se conserva la selección desde mapa y listas.

MapLibre evita colisiones entre etiquetas y entre iconos normales, por lo que algunos pueden ocultarse cuando no hay espacio. La parada seleccionada permanece destacada. Los registros coincidentes no se fusionan y las geometrías no se desplazan para separar trazados. Las listas y el selector siguen permitiendo consultar las variantes de 2-C y los registros superpuestos.

`features/routes/routeAppearance.ts` resuelve la presentación por código original; mapa y tarjetas comparten esa configuración y los colores de `styles/tokens.css`. `components/map/layerStyles.ts` construye las expresiones cartográficas y toma las fuentes del estilo. Los archivos GeoJSON, el contrato de datos y el importador no cambian; los fixtures Demo A/B siguen usando `color_key: "a" / "b"`.

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
- `features/routes/` y `features/stops/`: lista, tarjetas, fichas y transiciones de selección. Colecciones vacías muestran “Aún no hay rutas cargadas”. Sin datos válidos no se dibujan capas.
- `services/`, `hooks/` y `types/`: carga estática, validación, estado de carga/error/reintento e inicialización de la selección. `features/routes/routeData.ts` centraliza agrupación y asociación de paradas. Las fichas no consultan servicios por separado.
- `styles/tokens.css`: colores, espaciado, radios y sombras reutilizables. CSS por componente; fuente de sistema, sin descargas de tipografía. Movimiento reducido, controles de 44 px y foco visible.

## Comprobaciones

`npm test` cubre el catálogo, el piloto y los fixtures ficticios: seis grupos, búsquedas por nombre/código, referencias inválidas entre rutas/sentidos, cantidades, multipartes, ambigüedad de 2-C, orden alfabético, selección inicial y regreso a un recorrido desde sus paradas. Las pruebas Python comprueban la conservación de geometrías, IDs y capturas, preparación reproducible, reutilización sin red y errores sin reemplazo de la copia estática. Para revisar visualmente:

1. Probar anchos de 320, 390, 768, 1024 y 1280 px, orientación horizontal y zoom al 200 %: sin desbordamiento ni superposición entre controles, panel y búsqueda.
2. Expandir/contraer, alternar recorridos 01/02 y comprobar 14/17 paradas y una lista sin numeración.
3. Buscar `8-A`, `8A`, `8 A` y `AB008A0SS`: un resultado con dos recorridos y 31 registros. Probar limpiar y un nombre inexistente.
4. Seleccionar paradas desde mapa/listas, comprobar su recorrido asociado y regresar sin perderlo.
5. Navegar con Tab/Enter y flechas del selector; verificar el foco y probar reducción de movimiento.
6. Denegar ubicación, interrumpir la descarga de GeoJSON o del estilo y comprobar mensajes/reintentos.

La implementación se verificó con Edge headless: anchos previstos, panel colapsado/expandido, orientación horizontal, búsqueda, selección desde mapa y listas, Enter para alternar el panel, foco de las fichas, movimiento reducido, ubicación simulada autorizada/denegada/no disponible y recuperación tras fallos de GeoJSON y del estilo. No se detectaron excepciones de JavaScript. Se emuló una superficie de 640×400 a densidad 2, equivalente al espacio de layout de una pantalla 1280×800 al 200 %; esto no sustituye la revisión del zoom nativo del navegador ni las pruebas táctiles en un dispositivo físico.

Para la integración del piloto se comprobó además en Edge que el filtro real de la capa de paradas contiene 14/17 IDs, que el selector funciona con teclado y conserva el foco, que el trazado permanece dentro del mapa al redimensionar y que no se hacen solicitudes a ArcGIS en ejecución.

Para el catálogo de seis rutas se verificaron en Edge headless las cinco búsquedas nuevas por código, los 14 trazados, los filtros reales de paradas, el encuadre de todas las partes geométricas, las cuatro opciones distintas de 2-C, el regreso desde sus paradas y los avisos de ausencia de datos de 101A/44. Se revisaron 320, 390, 768, 1024 y 1280 px y orientación horizontal; sin desbordamiento horizontal, excepciones de JavaScript ni consultas ArcGIS. Estas comprobaciones no sustituyen el uso táctil en un dispositivo físico.

Para la identificación visual se comprobaron los seis colores de tarjetas y expresiones del mapa, etiquetas en zoom 11.5/12/13/14.5 e iconos en 14.5/15/16. Se pulsó una etiqueta con el área de clic de líneas desactivada para comprobar su interacción propia; se verificaron iconos y parada seleccionada, selector con teclado, conservación de la instancia del mapa, tamaños responsive y respaldo tras un fallo simulado de Canvas con recuperación al reintentar. No hubo excepciones de JavaScript ni consultas a ArcGIS. Las pruebas unitarias cubren también colores por ruta, compatibilidad con fixtures y fuentes del estilo.

En una vista de 390×844 se emuló además un toque sobre un icono en zoom 16: abrió la ficha de parada y conservó su recorrido. El zoom nativo al 200 % y el uso táctil en un dispositivo físico siguen pendientes de comprobación manual.

No incluye backend, autenticación, horarios, predicciones, seguimiento GPS de buses ni cálculo de viajes.
