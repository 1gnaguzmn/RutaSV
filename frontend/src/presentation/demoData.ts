// ─────────────────────────────────────────────────────────────────────────────
// RutaSV · Datos del demo (modo presentación)
//
// Este es el ÚNICO archivo que hay que editar para cambiar textos, horas,
// rutas, tiempos y nombres de calles. La lógica no lee datos de otro lugar.
//
// • Los valores entre corchetes, como "[RUTA_A1]" o "[CALLE_CERRADA]", son
//   marcadores: reemplácenlos con datos verificados por el equipo.
// • No hay nada aleatorio: el demo se ve igual cada vez.
// • Con `npm run dev`, al guardar este archivo el navegador se actualiza solo.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoPaso = 'caminar' | 'abordar' | 'transbordo' | 'bajar'

export interface Paso {
  tipo: TipoPaso
  texto: string
  /** Minutos de este paso. Omitir si no aplica (por ejemplo, "bajar"). */
  min?: number
  /** Número de paradas a bordo (solo "abordar" y "transbordo"). */
  paradas?: number
  /** Nombre corto para el mapa esquemático (ruta). */
  etiquetaMapa?: string
}

export interface Ruta {
  titulo: string
  etiqueta: string
  duracionMin: number
  caminataMin: number
  transbordos: number
  pasos: Paso[]
}

export const demoData = {
  etiquetaDatos: 'Datos de ejemplo',
  marca: 'RutaSV',
  origen: 'El Salvador del Mundo',
  destino: 'Key Institute',

  /** Sugerencias que aparecen al escribir en "Desde" y "Hasta". */
  sugerencias: ['El Salvador del Mundo', 'Key Institute', '[LUGAR_EJEMPLO_1]', '[LUGAR_EJEMPLO_2]'],

  pestanas: { buscar: 'Buscar', calcular: 'Calcular viaje', avisos: 'Avisos' },

  // ── Pestaña 1 · Buscar ────────────────────────────────────────────────────
  buscar: {
    desde: 'Desde',
    hasta: 'Hasta',
    boton: 'Buscar rutas',
    resultados: 'Rutas sugeridas',
    caminando: 'min caminando',
    transbordo: 'transbordo',
    transbordos: 'transbordos',
    sinTransbordos: 'Sin transbordos',
    paradas: 'paradas',
    elegir: 'Elegir esta ruta',
    elegida: 'Ruta elegida',
    guardarTitulo: 'Guardar viaje',
    dias: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    diasNombres: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    diasPreseleccionados: [true, true, true, true, true, false, false],
    lunesAViernes: 'Lunes a viernes',
    privacidad: 'Tú decides qué se guarda. Puedes borrarlo cuando quieras.',
    guardar: 'Guardar',
    guardado: 'Viaje guardado',
    tusViajes: 'Tus viajes',
    quitar: 'Quitar',
  },

  rutas: {
    A: {
      titulo: 'Opción A',
      etiqueta: 'Más rápida',
      duracionMin: 38,
      caminataMin: 9,
      transbordos: 1,
      pasos: [
        { tipo: 'caminar', texto: 'Camina a la parada [PARADA_1]', min: 5 },
        { tipo: 'abordar', texto: 'Sube a la [RUTA_A1]', paradas: 8, min: 18, etiquetaMapa: '[RUTA_A1]' },
        { tipo: 'transbordo', texto: 'Bájate en [PARADA_2] y sube a la [RUTA_A2]', paradas: 5, min: 11, etiquetaMapa: '[RUTA_A2]' },
        { tipo: 'bajar', texto: 'Bájate en [PARADA_3]' },
        { tipo: 'caminar', texto: 'Camina hasta Key Institute', min: 4 },
      ],
    },
    B: {
      titulo: 'Opción B',
      etiqueta: 'Menos caminata',
      duracionMin: 45,
      caminataMin: 3,
      transbordos: 0,
      pasos: [
        { tipo: 'caminar', texto: 'Camina a la parada [PARADA_1]', min: 2 },
        { tipo: 'abordar', texto: 'Sube a la [RUTA_B]', paradas: 14, min: 42, etiquetaMapa: '[RUTA_B]' },
        { tipo: 'bajar', texto: 'Bájate en [PARADA_4]' },
        { tipo: 'caminar', texto: 'Camina hasta Key Institute', min: 1 },
      ],
    },
  } satisfies Record<'A' | 'B', Ruta>,

  // ── Pestaña 2 · Calcular viaje ────────────────────────────────────────────
  calcular: {
    titulo: 'Calcular viaje',
    hora: '¿A qué hora quieres llegar?',
    boton: 'Calcular',
    salAntes: 'Sal a las',
    /** Duración habitual del viaje + margen por incidentes conocidos.
     *  Con 45 + 10 = 55 min: llegar 10:00 a. m. → salir 9:05 a. m. */
    duracionHabitualMin: 45,
    margenMin: 10,
    resumenViaje: 'min de viaje',
    resumenMargen: 'min de margen',
    /** Ruta que se resume en el resultado (su duración debe coincidir con duracionHabitualMin). */
    ruta: 'B' as const,
    nota: 'Estimación según la duración habitual del viaje y los incidentes conocidos. No es una garantía.',
    am: 'a. m.',
    pm: 'p. m.',
  },

  // ── Pestaña 3 · Avisos ────────────────────────────────────────────────────
  avisos: {
    intro: 'Así se verán tus avisos. Estos son ejemplos.',
    lista: [
      { id: 'cierre', titulo: 'Cierre en tu ruta', hora: '6:30 a. m.', texto: '[CALLE_CERRADA] está cerrada esta mañana. Toca para ver una ruta alterna.' },
      { id: 'cambio', titulo: 'Tu ruta cambió de recorrido', hora: '6:35 a. m.', texto: 'La [RUTA] ya no pasa por [PARADA]. Tu nueva parada está a dos cuadras.' },
      { id: 'salir', titulo: 'Hora de salir', hora: '6:12 a. m.', texto: 'Sal en 10 minutos para llegar a las 7:00 a. m.' },
    ],
    boton: 'Ver ejemplo en pantalla',
    volver: '← Avisos',
    cierre: {
      titulo: 'Cierre en tu ruta',
      chip: '[CALLE_CERRADA] cerrada esta mañana',
      cerrado: 'Cerrado',
      rutaAlterna: '[RUTA_ALTERNA]',
      rutaAlternaTexto: 'Ruta alterna: sube a la [RUTA_ALTERNA] en [PARADA_ALTERNA]',
      salidaAntes: 'Hoy sal a las',
      horaSalidaAlterna: '6:40 a. m.',
      salidaDespues: 'para llegar a tiempo.',
      /** Ruta del ejemplo si no hay un viaje guardado. */
      rutaPorDefecto: 'A' as const,
      /** Índice del paso (en `rutas.X.pasos`, empezando en 0) afectado por el cierre. */
      pasoAfectado: { A: 1, B: 1 },
    },
  },
}

export type RutaId = keyof typeof demoData.rutas
