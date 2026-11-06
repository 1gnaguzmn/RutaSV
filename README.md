# RutaSV

Demo web móvil de un asistente de viaje para San Salvador y el AMSS. La versión 1.2 combina exploración de rutas con tres viajes preparados, instrucciones paso a paso, recomendaciones de salida y avisos simulados para rutinas locales. React, TypeScript, Vite y MapLibre GL JS, sin backend ni autenticación.

## Ejecutar el frontend

Con Node.js 22.13 o superior y npm, desde la raíz del repositorio:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Abrir la dirección que indique Vite. El mapa base requiere conexión; las rutas y paradas se cargan desde archivos locales. El alcance y la interfaz se documentan en [frontend/README.md](frontend/README.md).

El frontend escucha en la LAN por el puerto **5173**. Para probarlo en un teléfono iOS o Android conectado al mismo router, seguir la [guía de acceso LAN y firewall](frontend/LAN_TESTING.md).

Para presentar la demo, abrir **Planificar** y seguir las vistas **Lugares → Opciones → Plan de salida**. Elegir Casa sur → Universidad, revisar la alternativa recomendada y simular sus pasos o guardar una rutina. Volver conserva los datos; cancelar cierra el plan. Al completar el tercer viaje (dos vienen en el historial de prueba), se ofrece guardar una rutina con aceptación explícita. En **Menú → Controles de demo**, reiniciar conservando rutinas y elegir tráfico, cierre o cambio de recorrido para consultar un aviso accionable. El reloj comienza el lunes a las 05:45 de El Salvador; solo avanza con los controles o los pasos del viaje. Todos los tiempos, caminatas, secuencias e incidentes añadidos son simulados. Consultar la [guía de navegación](frontend/USER_GUIDE.md).

## Estructura

- `frontend/`: aplicación, pruebas y GeoJSON estáticos.
- `data/`: scripts de captura/preparación, catálogo y documentación de procedencia. Originales y procesados son locales y quedan excluidos de Git.
- `agents/`: instrucciones, contexto y sistema de diseño locales; se conserva su exclusión de Git.

## Comprobar cambios

Desde `frontend/`:

```powershell
npm test
npm run build
npm run lint
```

ESLint tiene una incompatibilidad conocida con TypeScript 7. El build puede advertir sobre el tamaño del bundle de MapLibre; las versiones existentes se conservan.

## Preparación de datos

La demo incluye cuatro rutas, 10 trazados y 207 registros de paradas. Su procedencia es VMT / ArcGIS, con edición declarada de 2022 y estado sin verificación de campo. Las condiciones de reutilización se documentan como no especificadas.

Python solo es necesario para trabajar con el importador. Desde la raíz, con Python 3.12:

```powershell
py -3.12 -m venv data/.venv
.\data\.venv\Scripts\python.exe -m pip install -r data/scripts/requirements.txt
.\data\.venv\Scripts\python.exe data/scripts/import_demo_routes.py prepare
```

`prepare` valida las instantáneas locales y genera `frontend/public/data/transit/`, sin consultar ArcGIS. Para capturar rutas nuevas se utiliza `import_demo_routes.py run`; consultar [data/README.md](data/README.md) antes de usarlo. Las capturas necesarias deben estar disponibles localmente, pues no se distribuyen mediante Git.
