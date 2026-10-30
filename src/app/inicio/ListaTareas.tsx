import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ETIQUETA_ENVIO,
  ETIQUETA_ESTADO,
  type EstadoEnvio,
  type EstadoSeguimiento,
} from '../../dominio/etiquetas'
import { tareasDeFila, type FilaInicio, type Tarea } from '../../dominio/tareas'
import { ConflictoError, type Cambios } from '../promocion/servicio'
import { guardarDesdeInicio, recargarFila, rutaPromocion } from './datos'

/** Guardado de una fila con el manejo común de errores y conflictos. */
export function useGuardar(fila: FilaInicio, onCambio: (f: FilaInicio) => void) {
  const [error, setError] = useState<string | null>(null)
  async function guardar(cambios: Cambios) {
    setError(null)
    try {
      onCambio(await guardarDesdeInicio(fila, cambios))
    } catch (e) {
      if (e instanceof ConflictoError) {
        setError(e.message)
        const nueva = await recargarFila(fila.seguimiento_id).catch(() => null)
        if (nueva) onCambio(nueva)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
  }
  return { error, setError, guardar }
}

interface Props {
  tarea: Tarea
  filas: FilaInicio[]
  ahora: Date
  onCambio: (f: FilaInicio) => void
  mostrarKam?: boolean
}

export default function ListaTareas({ tarea, filas, ahora, onCambio, mostrarKam }: Props) {
  const propias = filas.filter((f) => tareasDeFila(f, ahora).includes(tarea))
  return (
    <table className="tabla lista-tareas">
      <thead>
        <tr>
          <th>Concesión</th>
          {mostrarKam && <th>KAM</th>}
          <th>TAG</th>
          <th>Dato</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        {propias.map((f) => (
          <FilaTarea
            key={f.seguimiento_id}
            tarea={tarea}
            fila={f}
            onCambio={onCambio}
            mostrarKam={mostrarKam}
          />
        ))}
      </tbody>
    </table>
  )
}

function FilaTarea({
  tarea,
  fila,
  onCambio,
  mostrarKam,
}: Omit<Props, 'filas' | 'ahora'> & { fila: FilaInicio }) {
  const { error, setError, guardar } = useGuardar(fila, onCambio)
  const [cupos, setCupos] = useState(fila.cupos == null ? '' : String(fila.cupos))

  function guardarCupos() {
    if (cupos.trim() === '') return
    const n = Number(cupos)
    if (!Number.isInteger(n) || n < 0) {
      setError('Los cupos deben ser un número entero igual o mayor que 0')
      return
    }
    void guardar({ cupos: n })
  }

  const selectEnvio = (campo: 'sms' | 'email', etiqueta: string) => (
    <label>
      {etiqueta}{' '}
      <select
        value={fila[campo]}
        onChange={(e) => void guardar({ [campo]: e.target.value as EstadoEnvio })}
      >
        {Object.entries(ETIQUETA_ENVIO).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </label>
  )

  let dato: React.ReactNode
  let accion: React.ReactNode
  if (tarea === 'sin_respuesta' || tarea === 'sin_activar') {
    dato = ETIQUETA_ESTADO[fila.estado]
    accion = (
      <select
        aria-label="Estado"
        value={fila.estado}
        onChange={(e) => void guardar({ estado: e.target.value as EstadoSeguimiento })}
      >
        {Object.entries(ETIQUETA_ESTADO).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    )
  } else if (tarea === 'envios') {
    dato = `SMS ${ETIQUETA_ENVIO[fila.sms]} · Email ${ETIQUETA_ENVIO[fila.email]}`
    accion = (
      <>
        {selectEnvio('sms', 'SMS')} {selectEnvio('email', 'Email')}
      </>
    )
  } else {
    dato = `${fila.usos ?? '—'} / ${fila.cupos ?? '—'}`
    accion = (
      <>
        <input
          type="number"
          aria-label="Cupos"
          min={0}
          value={cupos}
          onChange={(e) => setCupos(e.target.value)}
        />{' '}
        <button type="button" className="boton pequeno" onClick={guardarCupos}>
          Guardar
        </button>
        {tarea === 'revision' && (
          <>
            {' '}
            <button
              type="button"
              className="boton pequeno secundario"
              onClick={() => void guardar({ cupos_revisado_en: new Date().toISOString() })}
            >
              Revisado, sin cambios
            </button>
          </>
        )}
      </>
    )
  }

  return (
    <tr>
      <td>{fila.concesion_nombre ?? fila.concesion_id}</td>
      {mostrarKam && <td>{fila.kam_nombre ?? '—'}</td>}
      <td><Link to={rutaPromocion(fila.espacio, fila.tag)}>{fila.tag}</Link></td>
      <td>{dato}</td>
      <td>
        {accion}
        {error && <p role="alert" className="error">{error}</p>}
      </td>
    </tr>
  )
}
