export const JOURNEY_PIN_PIXEL_RATIO = 2
export const JOURNEY_ORIGIN_PIN = 'journey-origin-pin'
export const JOURNEY_DESTINATION_PIN = 'journey-destination-pin'

/** Local image for a GeoJSON symbol layer; the pin tip anchors to the coordinate. */
export function createJourneyPin(color: string, surface: string, letter: 'A' | 'B'): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = 32 * JOURNEY_PIN_PIXEL_RATIO
  canvas.height = 42 * JOURNEY_PIN_PIXEL_RATIO
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(JOURNEY_PIN_PIXEL_RATIO, JOURNEY_PIN_PIXEL_RATIO)
  context.beginPath()
  context.moveTo(16, 41)
  context.bezierCurveTo(12, 34, 2, 25, 2, 16)
  context.arc(16, 16, 14, Math.PI, Math.PI * 2)
  context.bezierCurveTo(30, 25, 20, 34, 16, 41)
  context.closePath()
  context.fillStyle = color
  context.fill()
  context.strokeStyle = surface
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = surface
  context.font = 'bold 16px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(letter, 16, 16)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}
