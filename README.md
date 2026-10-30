# RutaSV

Demo web móvil para explorar rutas de buses y paradas de San Salvador y el AMSS. React, TypeScript, Vite y MapLibre GL JS, sin backend ni autenticación.

## Ejecutar el frontend

Con Node.js 22.13 o superior y npm, desde la raíz del repositorio:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Abrir la dirección que indique Vite. El mapa base requiere conexión; las rutas y paradas se cargan desde archivos locales. El alcance y la interfaz se documentan en [frontend/README.md](frontend/README.md).

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

La demo incluye seis rutas, 14 trazados y 207 registros de paradas. Su procedencia es VMT / ArcGIS, con edición declarada de 2022 y estado sin verificación de campo. Las condiciones de reutilización se documentan como no especificadas.

Python solo es necesario para trabajar con el importador. Desde la raíz, con Python 3.12:

```powershell
py -3.12 -m venv data/.venv
.\data\.venv\Scripts\python.exe -m pip install -r data/scripts/requirements.txt
.\data\.venv\Scripts\python.exe data/scripts/import_demo_routes.py prepare
```

`prepare` valida las instantáneas locales y genera `frontend/public/data/transit/`, sin consultar ArcGIS. Para capturar rutas nuevas se utiliza `import_demo_routes.py run`; consultar [data/README.md](data/README.md) antes de usarlo. Las capturas necesarias deben estar disponibles localmente, pues no se distribuyen mediante Git.
