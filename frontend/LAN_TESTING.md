# Probar RutaSV desde iPhone y Android

## Abrir la demo

1. Conecta la computadora y el teléfono a la misma red. La computadora puede usar Ethernet y el teléfono Wi-Fi del mismo router.
2. Desde `frontend/`, ejecuta `npm run dev`. Vite escucha en `0.0.0.0:5173` y muestra las direcciones **Network** disponibles. El puerto es fijo: si está ocupado, avisa en vez de cambiarlo.
3. Abre en **Safari de iOS** o **Chrome de Android** la dirección de la LAN, por ejemplo `http://192.168.1.11:5173/`. La IP puede cambiar al reconectarte; usa la dirección actual de Vite o `ipconfig`.

En esta computadora se detectó `Ethernet: 192.168.1.11`. `192.168.56.1` corresponde a otro adaptador y no es la dirección elegida para el teléfono. `localhost` en el teléfono se refiere al propio teléfono; usa la IP de la computadora. `0.0.0.0` es la dirección de escucha, no la URL para abrir.

## Firewall de Windows

En esta computadora Windows ya tiene reglas activas que permiten Node.js en la red actual. No fue necesario cambiarlas. Si otro equipo bloquea la conexión, puedes crear una excepción específica con **PowerShell como administrador**, desde la raíz del repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File frontend/scripts/lan-firewall.ps1 -InterfaceAlias "Ethernet"
```

Si la computadora usa Wi-Fi, pasa su nombre de adaptador (habitualmente `Wi-Fi`), que puedes consultar con `Get-NetAdapter`.

El script permite únicamente **TCP 5173**, para el ejecutable de Node, desde **LocalSubnet**, en el adaptador indicado. Funciona también si Windows clasifica esa conexión como Pública; no cambia la categoría de red, no desactiva el firewall y no abre puertos del router.

El script no modifica reglas existentes de otras aplicaciones. Si encuentra un bloqueo explícito de Node, informa que debe revisarse manualmente: un permiso nuevo no prevalece sobre un bloqueo. Tampoco restringe permisos más amplios de Node que ya existan en Windows.

Para quitar solamente la excepción creada por este script, también como administrador:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File frontend/scripts/lan-firewall.ps1 -Remove
```

Si una política de tu organización impide modificar el firewall, se necesita intervención del administrador de esa red.

## iOS y Android

- Usa una versión actual de Safari o Chrome con WebGL2 disponible. El proyecto ya incluye viewport adaptable, safe areas, altura dinámica, controles táctiles y fuente de sistema.
- Prueba las tres vistas: **Lugares → Opciones → Plan de salida**, regresar, cancelar y completar una simulación. Comprueba zoom con dos dedos y orientación vertical/horizontal.
- El estilo, las teselas y fuentes de OpenFreeMap necesitan conexión a Internet. Los viajes y GeoJSON se sirven desde la computadora.
- Rutinas y favoritos se guardan en cada navegador y dispositivo. Cambiar de `localhost` a la IP, de IP o de HTTP a HTTPS produce otro origen y almacenamiento independiente. No se sincronizan con la computadora.

## Ubicación del teléfono

El mapa, las rutas y el flujo simulado funcionan por HTTP en la LAN. **Mostrar mi ubicación necesita HTTPS y permiso del navegador**. `http://192.168.x.x` no tiene la excepción de contexto seguro de `localhost`; la app lo explica al pulsar el botón y permite seguir usando la demo.

Para probar ubicación real se necesita servir por HTTPS con un certificado válido para la IP o nombre usado y confiable para iOS/Android. Aceptar una advertencia de certificado no equivale a configurar correctamente esa confianza. No incluyas claves privadas ni certificados de desarrollo en Git. Esta preparación utiliza HTTP para probar la interfaz y los viajes simulados, sin instalar certificados en los teléfonos.

## Probar el build

Detén primero `npm run dev` con `Ctrl+C`, porque preview usa el mismo puerto:

```powershell
npm run build
npm run preview
```

Abre la misma URL `http://<IP-LAN>:5173/` desde el teléfono.

## Si no conecta

1. Verifica que la terminal siga ejecutando Vite y muestre **Network**.
2. Abre la misma IP y puerto desde la computadora. Si allí funciona pero el teléfono no conecta, revisa firewall y la red Wi-Fi.
3. Evita redes de invitados o con aislamiento entre clientes; ambos dispositivos deben poder comunicarse. Comprueba que ninguna VPN esté cambiando la ruta entre ellos.
4. Si el navegador cambia automáticamente a HTTPS, escribe explícitamente `http://` para esta prueba. Si aparece un permiso de acceso a la red local, autorízalo para tu LAN.
5. Comprueba que elegiste el adaptador físico correcto y la IP actual. No expongas el servidor de desarrollo mediante redirección de puertos del router.

Referencias: [escucha LAN en Vite](https://vite.dev/config/server-options#server-host), [preview](https://vite.dev/config/preview-options), [geolocalización y contexto seguro](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [prioridad de reglas de firewall](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules).

## Verificación realizada

Se confirmó escucha en `0.0.0.0:5173`, respuesta HTTP 200 para HTML, GeoJSON, escenarios y cliente Vite mediante `192.168.1.11`, y conexión HMR por esa IP. En Chromium con viewport y toque emulados de iPhone (390×844) y Android (412×915) funcionaron mapa, fases y guardado local. El botón de ubicación en HTTP mostró el aviso de HTTPS sin solicitar posición. No hubo excepciones JavaScript. Pasan 52 pruebas y build; lint conserva el bloqueo conocido de TypeScript 7. La comprobación física en Safari de iOS y Chrome de Android queda para el teléfono.
