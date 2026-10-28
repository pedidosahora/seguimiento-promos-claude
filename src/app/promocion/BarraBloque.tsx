import { useState } from 'react'
import { ETIQUETA_ENVIO, ETIQUETA_ESTADO } from '../../dominio/etiquetas'

export interface CambiosBloque {
  estado?: string
  sms?: string
  email?: string
}

interface Props {
  seleccionadas: number
  ocupado: boolean
  onAplicar: (cambios: CambiosBloque) => void
  onLimpiar: () => void
}

/** Barra de acciones en bloque: aparece al seleccionar filas. Solo se envían los campos elegidos. */
export default function BarraBloque({ seleccionadas, ocupado, onAplicar, onLimpiar }: Props) {
  const [estado, setEstado] = useState('')
  const [sms, setSms] = useState('')
  const [email, setEmail] = useState('')
  if (seleccionadas === 0) return null

  const cambios: CambiosBloque = {}
  if (estado) cambios.estado = estado
  if (sms) cambios.sms = sms
  if (email) cambios.email = email
  const hayCambios = Object.keys(cambios).length > 0

  const selector = (
    etiqueta: string,
    valor: string,
    set: (v: string) => void,
    opciones: Record<string, string>,
  ) => (
    <label>
      {etiqueta}
      <select value={valor} onChange={(e) => set(e.target.value)}>
        <option value="">Sin cambio</option>
        {Object.entries(opciones).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="barra-bloque" role="region" aria-label="Acciones en bloque">
      <strong>{seleccionadas} {seleccionadas === 1 ? 'fila seleccionada' : 'filas seleccionadas'}</strong>
      {selector('Estado', estado, setEstado, ETIQUETA_ESTADO)}
      {selector('SMS', sms, setSms, ETIQUETA_ENVIO)}
      {selector('Email', email, setEmail, ETIQUETA_ENVIO)}
      <button
        type="button"
        className="boton"
        disabled={!hayCambios || ocupado}
        onClick={() => onAplicar(cambios)}
      >
        {ocupado ? 'Aplicando…' : 'Aplicar a la selección'}
      </button>
      <button type="button" className="boton secundario" onClick={onLimpiar}>Quitar selección</button>
    </div>
  )
}
