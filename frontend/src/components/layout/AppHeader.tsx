import { Icon } from '../ui/Icon'

export function AppHeader() {
  return <header className="app-header">
    <div className="brand"><span className="brand-mark"><Icon name="bus" /></span><div><h1>RutaSV</h1><p>San Salvador</p></div></div>
    <span className="badge">Demo</span>
  </header>
}
