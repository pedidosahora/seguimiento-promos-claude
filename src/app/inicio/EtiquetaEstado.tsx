import { useState } from 'react'
import { nivelAlertaCupos, pctCupos } from '../../dominio/calculos'
import { ETIQUETA_ESTADO, type EstadoSeguimiento } from '../../dominio/etiquetas'
import type { FilaInicio } from '../../dominio/tareas'
import { useGuardar } from './ListaTareas'

interface Props {
  fila: FilaInicio
  ahora: Date
  onCambio: (f: FilaInicio) => void
}

export default function EtiquetaEstado({ fila, onCambio }: Props) {
  const [editando, setEditando] = useState(false)
  const { error, guardar } = useGuardar(fila, onCambio)
  const nivel = nivelAlertaCupos(fila.usos, fila.cupos, Number(fila.umbral_cupos))
  const pct = pctCupos(fila.usos, fila.cupos)

  const texto = (
    <>
      {fila.tag} · {ETIQUETA_ESTADO[fila.estado]}
      {nivel && pct != null && <span className={nivel}> ⚠ {Math.round(pct * 100)} %</span>}
    </>
  )
  const clase = `etiqueta-estado estado-${fila.estado}`

  if (!fila.editable) return <span className={clase}>{texto}</span>

  return (
    <>
      {editando ? (
        <select
          aria-label="Estado"
          autoFocus
          value={fila.estado}
          onChange={(e) => {
            setEditando(false)
            void guardar({ estado: e.target.value as EstadoSeguimiento })
          }}
          onBlur={() => setEditando(false)}
        >
          {Object.entries(ETIQUETA_ESTADO).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      ) : (
        <button type="button" className={clase} onClick={() => setEditando(true)}>
          {texto}
        </button>
      )}
      {error && <span role="alert" className="error">{error}</span>}
    </>
  )
}
