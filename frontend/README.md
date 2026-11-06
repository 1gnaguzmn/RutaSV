# RutaSV · demo frontend v0.2

Asistente de viaje simulado sobre el explorador de **8-A, 30A, 29G y 2-C** en San Salvador y el AMSS. React, TypeScript, Vite y MapLibre GL JS; identidad visual definida en `../agents/DESIGN_SYSTEM.md`. Sin dependencias nuevas.

## Ejecutar

Con Node.js 22.13 o superior y npm:

```sh
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Abrir la dirección local que indique Vite. `--legacy-peer-deps` conserva las versiones existentes: TypeScript 7 está fuera del rango soportado por la configuración actual de typescript-eslint. No se cambiaron esas versiones para esta demo.

Vite y preview escuchan en **`0.0.0.0:5173`**, con puerto fijo. Para abrir la demo en Safari de iOS o Chrome de Android desde la misma red, consultar [pruebas por LAN](LAN_TESTING.md), incluyendo la regla de firewall de Windows y la limitación de ubicación por HTTP.

```sh
npm run build
npm run preview
npm test
npm run lint
```

El build comprueba TypeScript y genera `dist/`. Los tests usan el runner de Node y su soporte experimental para eliminar tipos, sin otra dependencia de tests. ESLint actualmente no puede iniciarse por la incompatibilidad mencionada. Vite puede advertir que el bundle de MapLibre supera 500 kB.

## Uso

Para seguir la demo en orden, consultar la [guía de navegación de usuario](USER_GUIDE.md): **Lugares → Opciones → Plan de salida**. Son vistas individuales con regreso y cancelación. La simulación y la llegada tienen sus propias vistas; los controles de presentación están en su sección del menú.

- Al cargar se muestra **Explorar rutas**, sin selección ni recorridos dibujados, centrado en San Salvador `[-89.19, 13.70]` y zoom 12. El buscador acepta nombres con o sin guiones/espacios y códigos originales, ignorando mayúsculas y acentos: `8-A`, `8A`, `8 A`, `AB008A0SS`, `30A`, `MB030A0`, `2C`, `AB002C0`. Los trazados se agrupan en cuatro tarjetas.
- En móvil, expandir/contraer el panel con el botón; no hay arrastre. En escritorio, desde 1024 px, el contenido ocupa un panel lateral de 400 px. En pantallas bajas se limita la altura del panel y se recolocan controles para conservar el mapa accesible.
- Seleccionar una tarjeta abre su primer recorrido disponible. En la 8-A, el selector alterna entre **Recorrido 01 (14 paradas)** y **Recorrido 02 (17 paradas)**. La interpretación para esta demo es `I→01 / R→02`, según los códigos de la fuente.
- 30A muestra 34/33 registros y 29G 34/32. 2-C conserva cuatro trazados (dos 01 y dos 02), identificados por registro de origen. Sus 26/17 paradas se muestran en todos los trazados con código compatible, con una nota sobre la variante no especificada. La tarjeta cuenta 43 registros una sola vez.
- Seleccionar una tarjeta abre su ficha, dibuja exclusivamente ese trazado en verde y lo encuadra. Se muestran solo sus paradas asociadas, sin agrupación. Seleccionar una parada abre sus detalles; volver conserva el recorrido o grupo anterior. Las paradas de un recorrido siguen en **lista alfabética sin numeración de viaje**, con la nota “Orden de viaje no definido”.
- Buscar regresa a explorar sin dibujar rutas. **Limpiar selección** también vuelve a explorar y conserva cámara y búsqueda. Sin selección, el control de encuadre vuelve al centro de San Salvador y zoom 12.
- Los controles permiten acercar, alejar, encuadrar y solicitar una ubicación puntual. No se solicita ubicación al iniciar ni se sigue al dispositivo. La ubicación requiere localhost o HTTPS y permiso del navegador; el marcador corresponde al usuario, nunca a un bus.
- El encuadre considera la cabecera, los controles, las atribuciones y el panel. Redimensionar el viewport vuelve a encuadrar el trazado seleccionado; plegar el panel conserva la cámara. El panel lateral desplaza su contenido sin aumentar la altura del mapa.
- El menú compacto permite cambiar entre **Explorar**, **Planificar**, **Mis viajes**, **Avisos** y **Controles de demo**, sin barra inferior permanente. “Planificar un viaje” comienza en Lugares.

## Identificación visual del mapa

Las tarjetas conservan un color estable por ruta: 8-A azul, 30A naranja oscuro, 29G violeta y 2-C pizarra. En el mapa solo aparece el recorrido seleccionado, en verde con contorno blanco. Limpiar oculta su línea y etiqueta; no se dibujan los demás recorridos como contexto. Los nombres y el panel permiten identificar rutas sin depender solo del color.

Desde **zoom 12**, la etiqueta del trazado seleccionado muestra su nombre y código de recorrido, por ejemplo `30A · 01`. Usa texto de 12–14 px, halo blanco y separación de 300 px entre repeticiones. Se reutiliza el font stack regular del estilo Liberty y su endpoint de glyphs, sin otro proveedor de fuentes. Las paradas tienen prioridad cuando coinciden sus áreas táctiles.

Al explorar, las paradas de RutaSV se ocultan por debajo de **zoom 11**. Desde 11 hasta antes de 15 se muestran agrupaciones con contador y puntos individuales. Se usan `clusterRadius: 50`, `clusterMinPoints: 2` y `clusterMaxZoom: 14`. Desde **zoom 15** aparecen iconos individuales de señal de parada de 24 px, dibujados localmente con Canvas 2D y registrados a densidad 2. Los círculos quedan como respaldo; las áreas táctiles son de 44 px.

Pulsar un grupo usa `getClusterExpansionZoom` para acercarse. Si la expansión supera el límite de agrupación, se consultan sus miembros con `getClusterLeaves` y se abre el listado en el panel. Las pulsaciones ambiguas sobre puntos superpuestos abren el mismo listado, con nombre, rutas asociadas, orden alfabético y **50 registros por página**. Abrir una ficha y volver conserva el grupo y su página. Los contadores representan registros de la fuente, sin deduplicar por posición ni afirmar que sean paradas físicas distintas.

Al seleccionar un recorrido, se oculta la exploración agrupada y se muestran solo sus paradas, sin agrupar. Una parada abierta desde explorar conserva las agrupaciones y se destaca individualmente sin dibujar rutas. Las consultas de grupos que fallen permiten reintentar; las respuestas tardías se descartan al cambiar selección, datos o instancia del mapa.

MapLibre evita colisiones entre etiquetas y entre iconos normales, por lo que algunos pueden ocultarse cuando no hay espacio. La parada seleccionada permanece destacada. Los registros coincidentes no se fusionan y las geometrías no se desplazan para separar trazados. Las listas y el selector siguen permitiendo consultar las variantes de 2-C y los registros superpuestos.

`features/routes/routeAppearance.ts` resuelve los colores de tarjetas mediante los tokens CSS; los fixtures Demo A/B siguen usando `color_key: "a" / "b"`. `components/map/layerStyles.ts` centraliza zoom, agrupación y fuentes. `StopLayer` conserva una fuente agrupada de exploración y otra sin agrupar para el contexto, actualizada con `setData`. Las capas cambian de filtro/visibilidad sin recrear el mapa ni crear marcadores HTML por parada. Los GeoJSON, el contrato de datos y el importador permanecen intactos. Las preferencias históricas de ruta inicial que siguen en los archivos ya no se usan para seleccionar automáticamente.

La política afecta a las capas de RutaSV; los puntos de interés y atribuciones del mapa base Liberty permanecen. Al planificar, se muestran únicamente los segmentos de la alternativa elegida: bus verde continuo, caminata gris discontinua e hitos de abordaje, transbordo y destino. **A · Inicio** es un pin verde al comienzo de la primera caminata y **B · Destino** un pin rojo al final del viaje, distintos de los símbolos ↑ de abordaje y ⇄ de transbordo. Los mismos colores y letras identifican los campos del formulario. Los pins se generan localmente en Canvas para capas de símbolos GeoJSON; conservan letras y círculos de respaldo si falla la generación. El encuadre deja espacio para sus iconos. Las capas exploratorias se retiran durante esa vista; volver a explorar recupera las agrupaciones sin recrear la instancia del mapa. `JourneyLayer` conserva las geometrías multipartitas y actualiza sus fuentes con `setData`.

## Datos y atribuciones

La aplicación carga `public/data/transit/routes.geojson` y `stops.geojson`: **4 rutas, 10 trazados y 207 registros de paradas**. `catalog.json` documenta códigos, conteos, geometrías, instantáneas, edición, ausencia de paradas y hashes. La 8-A conserva la instantánea `20261029T224448147697Z`; las otras tres rutas activas tienen capturas independientes fijadas en `../data/demo_sources.json`. No consulta ArcGIS durante la ejecución. Los archivos generados están incluidos en el frontend y Vite no requiere Python para iniciarse.

Fuente de referencia para la demo: VMT / ArcGIS. Edición declarada: 20 de septiembre de 2022; captura: 29 de octubre de 2026. Se conservan `source`, `source_snapshot`, `source_updated_at`, `verification_status: "unverified"` y `verified_at: null`. Los detalles muestran la procedencia y la fecha, sin afirmar verificación de campo.

`route_id` agrupa la ruta general; `recorrido_code` conserva el código publicado del recorrido y `id` identifica cada trazado. `shape_ids` asocia una parada a uno o varios trazados compatibles, con `association_basis: "demo_direction_mapping"`; `shape_id` sigue disponible cuando la asociación es única. Esa asociación es la interpretación elegida para la demo, no una secuencia revisada. **`stop_ids` permanece vacío**, y `stop_sequence_status` sigue en `pending`. La función compartida `getRouteStops` resuelve mapa, cantidades y fichas sin suponer un orden de viaje.

Coordenadas GeoJSON: `[longitud, latitud]`. Se conservaron geometrías, IDs y todos los registros, incluidos los puntos alejados del trazado. Se admiten `LineString` y `MultiLineString`; las partes no se concatenan, y el encuadre considera todos sus vértices. No se fusionaron ni ajustaron paradas. La carga valida referencias, código de ruta y sentido. Los datos ficticios Demo A/B en `public/data/routes.geojson` y `stops.geojson` y la copia histórica `public/data/pilot/` se conservan, separados del catálogo actual.

Para regenerar los archivos, desde la raíz del repositorio y con el entorno Python del importador instalado:

```powershell
.\data\.venv\Scripts\python.exe data/scripts/import_demo_routes.py prepare
```

Este comando lee y valida todas las instantáneas fijadas, y reemplaza solamente la copia derivada en `public/data/transit/`, sin red. Para incorporar rutas nuevas a `../data/demo_routes.json`, ejecutar `import_demo_routes.py run`: captura únicamente códigos todavía no registrados, procesa y prepara. No modifica originales, procesados anteriores ni fixtures ficticios. La preparación es reproducible; los comandos y metadatos están documentados en `../data/README.md`. No hay filtro geográfico automático: se importan únicamente los cuatro códigos elegidos para esta demo del AMSS.

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
4. Buscar `8-A`, `8A`, `8 A` y `AB008A0SS`: un resultado con dos recorridos y 31 registros. Seleccionar y alternar 01/02: solo ese trazado y 14/17 paradas, con lista sin numeración. Repetir con los demás trazados activos; 44 y 101A no deben aparecer en resultados.
5. Limpiar selección, comprobar que desaparecen todas las líneas y se recuperan las agrupaciones. El botón de encuadre debe volver a San Salvador y zoom 12.
6. Navegar con Tab/Enter y flechas del selector; comprobar foco, toque, movimiento reducido y recuperación tras fallos de datos/mapa o consulta de grupos.

La visualización progresiva se verificó con Edge headless: inicio en zoom 12 sin selección, ausencia de líneas y clics de recorridos ocultos, límites de zoom, expansión/listado de grupos, nombres/rutas asociadas, la selección exclusiva de trazados y sus conteos, limpieza conservando cámara y búsqueda, encuadre, errores/reintentos de grupo y respuestas tardías tras seleccionar una ruta. Se conservaron la instancia del mapa y las tres fuentes GeoJSON al cambiar de contexto.

Se comprobaron 320, 390, 768, 1024 y 1280 px, orientación horizontal y una superficie de 640×400; selector con teclado y toque simulado en 390×844. Con 10.000 puntos coincidentes, inyectados solo en memoria durante la prueba, el mapa mostró una agrupación, no creó marcadores HTML y el panel renderizó 50 filas por página; abrir una ficha y volver recuperó la segunda página. No hubo excepciones de JavaScript ni consultas a ArcGIS. La comparación de hashes comprueba que originales, procesados, GeoJSON públicos e importador siguen intactos.

El zoom nativo al 200 % y el uso táctil en un dispositivo físico siguen pendientes de comprobación manual.

No incluye backend, autenticación, horarios operativos, predicciones reales, seguimiento GPS de buses ni planificación general fuera del catálogo de ejemplos.

## Asistente simulado v0.2

### Presentación de Martín

1. Abrir **Planificar**. En **Lugares**, elegir **Casa sur → Universidad** y pulsar **Ver opciones**, o elegirlo en **Viajes de ejemplo**. En **Opciones** se muestran las tres alternativas, con la recomendada seleccionada. Pulsar **Ver plan de salida** para ajustar llegada 07:00 y margen 10 min. También están preparados **Centro → Universidad** (tres alternativas) y **Casa oriente → Centro** (dos).
2. En **Plan de salida**, revisar la recomendación y pulsar **Simular viaje ahora** o **Guardar como habitual**. Los pasos y cálculos quedan en desplegables opcionales. La simulación utiliza la hora actual del reloj virtual y muestra una instrucción a la vez. Completar caminata, abordaje, paradas, aviso “Baja en la próxima”, transbordo y caminata final. Cada paso avanza sus minutos; no se usa GPS. **Volver** detiene la simulación sin registrarla y abre el plan; **Cancelar viaje** cierra el plan y vuelve a Explorar. Se conserva el reloj ya avanzado.
3. Al finalizar aparece la sugerencia de habitualidad: hay dos viajes históricos iniciales, identificados como simulados, y el tercero se acaba de completar. La regla requiere el mismo origen/destino dentro de 14 días y una franja de ±30 min. Solo **Aceptar y guardar rutina** crea una rutina; no es aprendizaje automático.
4. En **Mis viajes**, editar nombre, origen/destino, días (lunes a viernes por defecto), llegada, margen y anticipación (15 min iniciales). Se puede pausar, reanudar o borrar. Los destinos favoritos se guardan desde el planificador.
5. Abrir **Menú → Controles de demo** y **Reiniciar escenario · conservar rutinas**. El reloj vuelve al lunes 05:45. Elegir tráfico, cierre y cambio de recorrido: se genera un aviso al entrar en la ventana de anticipación de la rutina. En normal no hay avisos nuevos. La bandeja de **Avisos** abre directamente el plan de salida correspondiente.
6. **Restaurar toda la demo** pide confirmación antes de borrar rutinas, favoritos, avisos e historial; repone los dos ejemplos históricos. Reiniciar solo el escenario conserva rutinas, favoritos y preferencias de sugerencias, y repone reloj/historial inicial y bandeja vacía para repetir la presentación.

### Tiempos, recomendaciones y avisos

- El reloj virtual se representa por día y minutos desde medianoche en El Salvador (UTC−06:00), independiente de la zona horaria del navegador. No avanza por tiempo real. Los botones suman 5 min, 15 min o un día.
- Los tiempos base son de prueba: caminatas rectas a 75 m/min y bus a 240 m/min más espera incluida. El patrón ficticio aplica +20 % al bus en días laborables, 06:00–08:30 y 16:00–18:30. Tráfico añade 15 min por viaje afectado, una sola vez; cambio de recorrido añade 3 min y modifica la caminata inicial.
- Se evalúan salidas cada cinco minutos en las tres horas anteriores al objetivo, eligiendo la última cuya llegada más margen cumple la hora deseada. La recomendación global prioriza esa última salida viable. El desglose y las comparaciones usan la misma función de tiempos que los pasos. Si ya pasó la recomendación, se ofrece la siguiente salida de ejemplo con su llegada, aunque supere el objetivo.
- El cierre bloquea una alternativa por viaje preparado; nunca se recomienda una bloqueada. El cambio de recorrido desplaza únicamente el abordaje del escenario unos 150 m, dibuja el conector ficticio y cambia sus instrucciones. Los datos VMT no se modifican.
- Los avisos se evalúan por rutina activa, día de viaje, impacto y ventana de anticipación. Se deduplican por rutina + incidente + día virtual, incluso tras recargar. Consultar un aviso lo marca como leído. No se solicitan permisos de notificación ni se funciona con la app cerrada.
- Persistencia local versionada en `rutasv.demo.v02`: rutinas, favoritos, historial y bandeja. La carga descarta registros inválidos o referencias ausentes. Ante almacenamiento denegado o sin espacio se conserva el estado en memoria y se informa en el panel. El reloj, el escenario y un viaje en curso no se persisten.

### Escenarios y procedencia

`public/data/demo/scenarios.json` contiene cuatro lugares de ejemplo, ocho itinerarios y tres incidentes (más la situación normal). Cada tramo de bus referencia un **ID de trazado concreto**, incluidas dos variantes de 2-C; las secuencias de parada son subconjuntos simulados, independientes de `stop_ids` del VMT, que permanece vacío. Nombres/IDs de referencia provienen del catálogo original; no prueban un orden operativo.

Las geometrías de bus se recortan y, cuando lo exige la historia, se invierten **solo en estos escenarios simulados**. Las caminatas son líneas rectas, no caminos peatonales calculados. El ejemplo multipartito de 30A conserva tres partes que se encuentran en el mismo cruce; no se concatenan para crear conexiones falsas. No usar estos ejemplos como instrucciones de viaje reales.

Los fixtures se incluyen en Git; Vite no necesita Python ni ArcGIS. Para regenerarlos con Python estándar desde la raíz:

```powershell
python frontend/scripts/prepare_journey_demo.py
```

Este script solo lee `public/data/transit/` y escribe `public/data/demo/scenarios.json`. No modifica el importador, capturas originales, procesados ni GeoJSON importados. La validación frontend comprueba referencias, geometrías 2D, continuidad, tiempos positivos y extremos de cada viaje antes de presentar resultados. Una combinación no preparada muestra un estado explícito y ofrece el catálogo disponible.

### Separación de responsabilidades

- `types/journey.ts`: modelos de lugares, segmentos, itinerarios, recomendaciones, rutinas, historial e incidentes.
- `features/journeys/`: cálculos puros de estimación/recomendación, geometrías, reloj y transiciones en `flow.ts`. `JourneyPlanner` elige lugares, `JourneyResults` compara opciones y `JourneyDeparture` presenta salida y acciones. `JourneyFlowActions` conserva los controles de volver/cancelar al alcance. El estado compartido conserva borrador, fase y selección al volver; cada cambio de vista devuelve scroll y foco al encabezado.
- `features/habits/` y `features/alerts/`: persistencia validada, regla de repetición y evaluación de avisos, separadas de React.
- `hooks/useJourneyDemo.ts`: carga, estado compartido y acciones; `services/journeyDemo.ts`: validación de datos en el límite.
- `MapScene` distingue exploración e itinerario. `JourneyLayer` usa fuentes/capas GeoJSON, sin marcadores HTML de viaje. CSS por componente y tokens existentes.

Las **52 pruebas frontend** cubren catálogo, grupos y regresiones cartográficas, además de las ocho alternativas, los cuatro escenarios, campos inválidos, suma de pasos y tiempos, recomendación última viable, hora pasada, cierres, continuidad, multipartes, terceros viajes, días/pausa, almacenamiento inválido, deduplicación y transiciones de fases con regreso/cancelación. El build pasa; lint continúa bloqueado por TypeScript 7 / typescript-eslint y permanece la advertencia del tamaño de MapLibre.

El flujo por fases se comprobó en navegador: lugares y destino visibles sin desplazar el panel en 320/390/768/1024/1280 px y horizontal; vistas excluyentes, recomendación inicial, conservación de lugares/selección/orden/horario al volver, reinicio del scroll, edición de rutina con retorno al plan, cancelación sin historial, finalización aislada y acceso a planes desde avisos. La instancia de MapLibre se conserva. Cancelar retira el itinerario sin borrar rutinas ni reiniciar el reloj.

La revisión v0.2 con Edge headless completó la historia de Martín, un viaje con transbordo, los cuatro escenarios, avisos sin duplicados, edición/pausa y persistencia de rutinas tras recarga, restauración con confirmación, almacenamiento inválido/denegado y reintento tras un fallo de escenarios. Se comprobaron 320, 390, 768, 1024 y 1280 px, horizontal, una superficie de 640×400, teclado/Enter/Escape, foco contextual, toque emulado y movimiento reducido. El mapa conservó su instancia al alternar exploración/itinerario y mantuvo multipartes. No hubo excepciones de JavaScript ni consultas a ArcGIS. El zoom nativo al 200 % y el toque en un dispositivo físico siguen pendientes de comprobación manual.

Seguir rutas, reportes comunitarios, planificación general, datos de tiempos observados, backend y notificaciones con la app cerrada quedan para etapas posteriores.
