import { useRef } from 'react'
import { Icon } from './Icon'
import './SearchBar.css'

interface Props { value: string; onChange: (value: string) => void }
export function SearchBar({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <form className="search-bar" role="search" onSubmit={(event) => event.preventDefault()}>
    <Icon name="search" />
    <label className="sr-only" htmlFor="route-search">Buscar rutas por identificador o nombre</label>
    <input ref={inputRef} id="route-search" type="search" placeholder="Busca una ruta de bus..." value={value} autoComplete="off" onChange={(event) => onChange(event.target.value)} aria-controls="context-content" />
    {value && <button className="icon-button" type="button" aria-label="Limpiar búsqueda" onClick={() => { onChange(''); inputRef.current?.focus() }}><Icon name="close" /></button>}
  </form>
}
