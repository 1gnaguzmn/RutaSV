import { useState } from 'react'
import type { JourneyDemo } from '../../hooks/useJourneyDemo'
import type { ScenarioId } from '../../types/journey'
import { DAYS, timeText, weekday } from './time'

export function DemoControls({ demo, onFrame }: { demo: JourneyDemo; onFrame: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false)
  return <section className="demo-controls" aria-label="Controles de simulación"><h3>{DAYS[weekday(demo.clock.day)]} {timeText(demo.clock.minute)}</h3>
    <p className="muted">Reloj virtual · El Salvador (UTC−06:00). Semana {Math.floor(demo.clock.day / 7) + 1}. Sin tráfico ni avisos reales.</p>
    <fieldset disabled={Boolean(demo.active)}><label>Situación simulada<select value={demo.scenario} onChange={(event) => { demo.changeScenario(event.target.value as ScenarioId); onFrame() }}><option value="normal">Normal</option><option value="traffic">Tráfico intenso</option><option value="closure">Cierre</option><option value="route-change">Cambio de recorrido</option></select></label>
      <div className="control-row"><button type="button" className="secondary-button" onClick={() => demo.advance(5)}>+5 min</button><button type="button" className="secondary-button" onClick={() => demo.advance(15)}>+15 min</button><button type="button" className="secondary-button" onClick={() => demo.advance(1440)}>+1 día</button></div>
      <button type="button" className="text-button" onClick={() => demo.reset(false)}>Reiniciar escenario · conservar rutinas</button>
      <button type="button" className="text-button" onClick={() => setConfirmReset(true)}>Restaurar toda la demo</button>
      {confirmReset && <div className="confirmation" role="group" aria-label="Confirmar restauración"><p>Se borrarán rutinas, favoritos, avisos e historial guardados. Se recuperarán los dos viajes históricos simulados.</p><div className="control-row"><button type="button" className="secondary-button" onClick={() => setConfirmReset(false)}>Conservar mis datos</button><button type="button" className="primary-button" onClick={() => { demo.reset(true); setConfirmReset(false) }}>Sí, restaurar demo</button></div></div>}
    </fieldset>
    {demo.active && <p role="status">Finaliza o cancela el viaje para cambiar el escenario.</p>}
  </section>
}
