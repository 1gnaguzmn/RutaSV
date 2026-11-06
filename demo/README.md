# RutaSV · Demo para presentación

Demo independiente de RutaSV para proyectar en la presentación. **No depende de la app de `frontend/`.**

## Cómo abrirlo

Abrir `index.html` con doble clic. Funciona en el navegador sin internet, sin instalar nada y sin servidor.

## Qué incluye

- **Buscar:** dos opciones de ruta (Más rápida y Menos caminata) con mapa y una mini animación del viaje al elegir. Se puede guardar el viaje con sus días.
- **Calcular viaje:** hora de salida recomendada según la hora de llegada.
- **Rutas:** Ruta 101 (A, B, C, D), Ruta 42 (B, C) y Ruta 40-A.
- **Avisos:** ejemplo de cierre de calle con ruta alterna, parada a dos cuadras y hora de salida en un menú desplegable. "Ver ejemplo en pantalla" muestra la notificación bajando.

Tecla oculta: **R** reinicia el demo.

## Editar datos

Todos los textos, rutas y tiempos están en el objeto `DATOS`, al inicio del `<script>` dentro de `index.html`. Los valores entre corchetes, como `[PARADA 1]` o `[CALLE CERRADA]`, son marcadores para completar con datos verificados.
