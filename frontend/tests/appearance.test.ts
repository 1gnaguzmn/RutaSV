import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getRouteAppearance } from '../src/features/routes/routeAppearance.ts'
import { groupRoutes } from '../src/features/routes/routeData.ts'
import { routeColorExpression, routeLabelFont } from '../src/components/map/layerStyles.ts'
import { parseTransitData } from '../src/services/transit.ts'
import type { StyleSpecification } from 'maplibre-gl'

const read = (folder: string, name: string): unknown => JSON.parse(readFileSync(new URL(`../public/data/${folder}${name}.geojson`, import.meta.url), 'utf8'))
const fixture = () => parseTransitData(read('transit/', 'routes'), read('transit/', 'stops'))
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const cardCss = readFileSync(new URL('../src/features/routes/routes.css', import.meta.url), 'utf8')
const token = (name: string): string => {
  const value = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]+)`, 'i'))?.[1]
  assert(value, `Token CSS existente: ${name}`)
  return value.toUpperCase()
}

test('las seis rutas tienen colores distintos y coherentes entre mapa y tarjetas', () => {
  const expected: Record<string, string> = {
    AB008A0SS: '#2563EB', MB030A0: '#B45309', AB029G0: '#7C3AED',
    AB101A2E: '#BE185D', MB044X0: '#0E7490', AB002C0: '#475569',
  }
  const data = fixture()
  const expression = routeColorExpression(data.routes.features, token)
  assert(Array.isArray(expression))
  const colors = new Set<string>()
  for (const group of groupRoutes(data.routes.features)) {
    const p = group.variants[0].properties
    const appearance = getRouteAppearance(p)
    const color = token(appearance.colorToken)
    assert.equal(color, expected[p.source_route_code!])
    assert(cardCss.includes(`.route-code--${appearance.key} { color: var(${appearance.colorToken}); }`))
    assert.equal(expression[expression.indexOf(p.route_id) + 1], color)
    colors.add(color)
  }
  assert.equal(colors.size, 6)
  assert(!colors.has(token('--color-primary')), 'Reservar verde para selección')
})

test('los 14 trazados mantienen el color de su ruta aunque cambie el orden de carga', () => {
  const routes = fixture().routes.features
  const styles = new Map(routes.map((route) => [route.properties.id, getRouteAppearance(route.properties)]))
  for (const route of routes.reverse()) assert.deepEqual(getRouteAppearance(route.properties), styles.get(route.properties.id))
  for (const group of groupRoutes(routes)) {
    assert.equal(new Set(group.variants.map((route) => getRouteAppearance(route.properties).key)).size, 1)
  }
})

test('los fixtures ficticios y códigos todavía no configurados conservan color_key', () => {
  const data = parseTransitData(read('', 'routes'), read('', 'stops'))
  const appearances = data.routes.features.map((route) => getRouteAppearance(route.properties))
  assert.deepEqual(new Set(appearances.map((appearance) => appearance.key)), new Set(['a', 'b']))
  assert.equal(getRouteAppearance({ source_route_code: 'UNKNOWN', color_key: 'b' }).colorToken, '--color-route-b')
  assert.equal(routeColorExpression([], token), token('--color-route-a'))
})

test('reutiliza un font stack regular del estilo y no toma una expresión como nombre de fuente', () => {
  const style: StyleSpecification = { version: 8, sources: {}, layers: [
    { id: 'expression', type: 'symbol', layout: { 'text-font': ['case', ['has', 'bold'], ['literal', ['Other Bold']], ['literal', ['Other Regular']]] } },
    { id: 'bold', type: 'symbol', layout: { 'text-font': ['Existing Bold'] } },
    { id: 'regular', type: 'symbol', layout: { 'text-font': ['Existing Regular'] } },
  ] }
  const before = JSON.stringify(style)
  assert.deepEqual(routeLabelFont(style), ['Existing Regular'])
  assert.equal(JSON.stringify(style), before)
  assert.deepEqual(routeLabelFont({ version: 8, sources: {}, layers: [] }), ['Noto Sans Regular'])
})
