import { TAREAS, type Tarea } from '../../dominio/tareas'

interface Props {
  conteos: Record<Tarea, number>
  agotadas: boolean
  activa: Tarea | null
  onElegir: (t: Tarea) => void
}

export default function Contadores({ conteos, agotadas, activa, onElegir }: Props) {
  return (
    <div className="contadores">
      {TAREAS.map(({ clave, etiqueta }) => {
        const clases = [
          conteos[clave] > 0 ? 'aviso' : '',
          clave === 'cupos' && agotadas ? 'peligro' : '',
        ].filter(Boolean)
        return (
          <button
            key={clave}
            type="button"
            className={clases.join(' ') || undefined}
            aria-pressed={activa === clave}
            onClick={() => onElegir(clave)}
          >
            <strong>{conteos[clave]}</strong> {etiqueta}
          </button>
        )
      })}
    </div>
  )
}
