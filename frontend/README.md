# RutaSV · demo frontend v0.1

Prototipo local para explorar la **ruta 8-A (`AB008A0SS`)** y sus paradas en San Salvador y el AMSS. React, TypeScript, Vite y MapLibre GL JS; identidad visual definida en `../DESIGN_SYSTEM.md`.

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

- Al cargar se selecciona y encuadra el **Recorrido 01** de la 8-A. El buscador acepta `8-A`, `8A`, `8 A` y `AB008A0SS`, ignorando mayúsculas y acentos. Se muestra una ruta con dos trazados, no dos rutas independientes.
- En móvil, expandir/contraer el panel con el botón; no hay arrastre. En escritorio, desde 1024 px, el contenido ocupa un panel lateral de 400 px. En pantallas bajas se limita la altura del panel y se recolocan controles para conservar el mapa accesible.
- El selector de la ficha alterna entre **Recorrido 01 (14 paradas)** y **Recorrido 02 (17 paradas)**. La interpretación para esta demo es `I→01 / R→02`, según los códigos de la fuente.
- Seleccionar una tarjeta o un trazado abre su ficha y encuadra el recorrido. Seleccionar una parada abre sus detalles; volver conserva el recorrido anterior. Buscar regresa a explorar. Las paradas también se pueden abrir desde la **lista alfabética sin numeración de viaje**, con la nota “Orden de viaje no definido”.
- La búsqueda mantiene todas las rutas en el mapa. Una selección resalta el recorrido en verde y muestra sus paradas. Sin selección, las paradas se ven desde zoom 11 para reducir densidad.
- Los controles permiten acercar, alejar, encuadrar y solicitar una ubicación puntual. No se solicita ubicación al iniciar ni se sigue al dispositivo. La ubicación requiere localhost o HTTPS y permiso del navegador; el marcador corresponde al usuario, nunca a un bus.
- El encuadre considera la cabecera, los controles, las atribuciones y el panel. Redimensionar el viewport vuelve a encuadrar el trazado seleccionado; plegar el panel conserva la cámara. El panel lateral desplaza su contenido sin aumentar la altura del mapa.
- “Planificar un viaje” solo informa que estará disponible en otra fase.

## Datos y atribuciones

La aplicación carga `public/data/pilot/routes.geojson` y `stops.geojson`: **dos trazados de la ruta 8-A y 31 registros de paradas**, preparados desde la instantánea `20261029T224448147697Z`. No consulta ArcGIS durante la ejecución. Los archivos generados están incluidos en el frontend y Vite no requiere Python para iniciarse.

Fuente de referencia para la demo: VMT / ArcGIS. Edición declarada: 20 de septiembre de 2022; captura: 29 de octubre de 2026. Se conservan `source`, `source_snapshot`, `source_updated_at`, `verification_status: "unverified"` y `verified_at: null`. Los detalles muestran la procedencia y la fecha, sin afirmar verificación de campo.

`route_id` agrupa la ruta general; `recorrido_code` identifica cada trazado. `shape_id` asocia una parada para visualización, con `association_basis: "demo_direction_mapping"`. Esa asociación es la interpretación elegida para la demo, no una secuencia revisada. **`stop_ids` permanece vacío**, y `stop_sequence_status` sigue en `pending`. La función compartida `getRouteStops` resuelve mapa, cantidades y fichas sin suponer un orden de viaje.

Coordenadas GeoJSON: `[longitud, latitud]`. Se conservaron geometrías, IDs y todos los registros, incluidos los puntos alejados del trazado. No se fusionaron ni ajustaron paradas. La carga valida también las referencias a trazados existentes. Los datos ficticios Demo A/B en `public/data/routes.geojson` y `stops.geojson` se conservan como fixtures de pruebas, separados del piloto.

Para regenerar los archivos, desde la raíz del repositorio y con el entorno Python del importador instalado:

```powershell
.\data\.venv\Scripts\python.exe data/scripts/prepare_pilot_demo.py
```

Este comando lee y valida la instantánea procesada, y reemplaza solamente la copia derivada en `public/data/pilot/`. No modifica originales, procesados ni fixtures ficticios. La preparación es reproducible; la documentación de datos está en `../data/README.md`. El alcance es la 8-A; no se ha añadido un filtro geográfico general ni más rutas.

Las condiciones de reutilización de la fuente siguen documentadas como no especificadas en los metadatos. Esta integración no realiza un despliegue ni interpreta esa ausencia como una licencia abierta.

El mapa base usa [OpenFreeMap Liberty](https://openfreemap.org/quick_start/), con datos de [OpenStreetMap](https://www.openstreetmap.org/copyright) y atribución a [OpenMapTiles](https://openmaptiles.org/). Las atribuciones proporcionadas por el estilo se conservan en el control del mapa. Se necesita conexión para descargar el estilo, teselas y fuentes; no se ofrece funcionamiento sin conexión.

## Organización y estados

- `components/map/`: ciclo de vida del mapa, capas de rutas/paradas y controles. Mapa en carga muestra un indicador; un fallo ofrece reintento y mantiene accesible el panel. Reintentar reconstruye la instancia conservando el centro/zoom y la selección de la aplicación.
- `components/layout/` y `components/ui/`: cabecera, búsqueda y panel no modal. Panel colapsado/expandido, foco al navegar entre fichas y contenido desplazable. La búsqueda sin coincidencias muestra un mensaje y permite limpiar.
- `features/routes/` y `features/stops/`: lista, tarjetas, fichas y transiciones de selección. Colecciones vacías muestran “Aún no hay rutas cargadas”. Sin datos válidos no se dibujan capas.
- `services/`, `hooks/` y `types/`: carga estática, validación, estado de carga/error/reintento e inicialización de la selección. `features/routes/routeData.ts` centraliza agrupación y asociación de paradas. Las fichas no consultan servicios por separado.
- `styles/tokens.css`: colores, espaciado, radios y sombras reutilizables. CSS por componente; fuente de sistema, sin descargas de tipografía. Movimiento reducido, controles de 44 px y foco visible.

## Comprobaciones

`npm test` cubre el piloto y los fixtures ficticios: agrupación, búsquedas equivalentes, referencias inválidas, cantidades 14/17, orden alfabético, selección inicial y regreso a un recorrido desde sus paradas. Las pruebas Python comprueban que la preparación conserva geometrías, IDs y capturas, y es reproducible. Para revisar visualmente:

1. Probar anchos de 320, 390, 768, 1024 y 1280 px, orientación horizontal y zoom al 200 %: sin desbordamiento ni superposición entre controles, panel y búsqueda.
2. Expandir/contraer, alternar recorridos 01/02 y comprobar 14/17 paradas y una lista sin numeración.
3. Buscar `8-A`, `8A`, `8 A` y `AB008A0SS`: un resultado con dos recorridos y 31 registros. Probar limpiar y un nombre inexistente.
4. Seleccionar paradas desde mapa/listas, comprobar su recorrido asociado y regresar sin perderlo.
5. Navegar con Tab/Enter y flechas del selector; verificar el foco y probar reducción de movimiento.
6. Denegar ubicación, interrumpir la descarga de GeoJSON o del estilo y comprobar mensajes/reintentos.

La implementación se verificó con Edge headless: anchos previstos, panel colapsado/expandido, orientación horizontal, búsqueda, selección desde mapa y listas, Enter para alternar el panel, foco de las fichas, movimiento reducido, ubicación simulada autorizada/denegada/no disponible y recuperación tras fallos de GeoJSON y del estilo. No se detectaron excepciones de JavaScript. Se emuló una superficie de 640×400 a densidad 2, equivalente al espacio de layout de una pantalla 1280×800 al 200 %; esto no sustituye la revisión del zoom nativo del navegador ni las pruebas táctiles en un dispositivo físico.

Para la integración del piloto se comprobó además en Edge que el filtro real de la capa de paradas contiene 14/17 IDs, que el selector funciona con teclado y conserva el foco, que el trazado permanece dentro del mapa al redimensionar y que no se hacen solicitudes a ArcGIS en ejecución.

No incluye backend, autenticación, horarios, predicciones, seguimiento GPS de buses ni cálculo de viajes.
