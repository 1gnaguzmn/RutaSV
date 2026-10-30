export const STOP_ICON = 'rutasv-stop'
export const SELECTED_STOP_ICON = 'rutasv-stop-selected'
export const STOP_ICON_PIXEL_RATIO = 2

export function createStopIcon(surface: string, primary: string, selected: boolean): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 24 * STOP_ICON_PIXEL_RATIO
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(STOP_ICON_PIXEL_RATIO, STOP_ICON_PIXEL_RATIO)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  // Señal fija con poste: representa una parada, no la posición de un bus.
  context.fillStyle = selected ? primary : surface
  context.strokeStyle = selected ? surface : primary
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(12, 12, 11, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.beginPath()
  context.roundRect(6.5, 4.5, 11, 11, 2)
  context.moveTo(12, 15.5)
  context.lineTo(12, 20)
  context.moveTo(8.5, 20)
  context.lineTo(15.5, 20)
  context.stroke()
  context.lineWidth = 1.1
  context.strokeRect(8.5, 7, 7, 4)
  for (const x of [9, 15]) {
    context.beginPath()
    context.arc(x, 13, 0.7, 0, Math.PI * 2)
    context.stroke()
  }
  return context.getImageData(0, 0, canvas.width, canvas.height)
}
