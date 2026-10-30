import { contarTareas, TAREAS, type FilaInicio, type Tarea } from '../../dominio/tareas'

interface Props {
  filas: FilaInicio[]
  kams: { id: string; nombre: string }[]
  ahora: Date
  onElegir: (kamId: string | null, t: Tarea) => void
}

export default function TareasPorKam({ filas, kams, ahora, onElegir }: Props) {
  const conocidos = new Set(kams.map((k) => k.id))
  const extra = new Map<string, string>()
  for (const f of filas) {
    if (f.kam_id && !conocidos.has(f.kam_id)) extra.set(f.kam_id, f.kam_nombre ?? 'KAM desconocido')
  }
  const todos = [...kams, ...[...extra].map(([id, nombre]) => ({ id, nombre }))]
  const grupos: { id: string | null; nombre: string; conteos: Record<Tarea, number> }[] = todos.map(
    (k) => ({
      id: k.id,
      nombre: k.nombre,
      conteos: contarTareas(filas.filter((f) => f.kam_id === k.id), ahora),
    }),
  )
  const sinKam = filas.filter((f) => f.kam_id == null)
  if (sinKam.length > 0) {
    grupos.push({ id: null, nombre: 'Sin KAM', conteos: contarTareas(sinKam, ahora) })
  }
  grupos.sort(
    (a, b) =>
      b.conteos.sin_respuesta - a.conteos.sin_respuesta || a.nombre.localeCompare(b.nombre, 'es'),
  )
  return (
    <table className="tabla tareas-por-kam">
      <thead>
        <tr>
          <th>KAM</th>
          {TAREAS.map((t) => (
            <th key={t.clave} className="num">{t.etiqueta}</th>
          ))}
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => (
          <tr key={g.id ?? 'sin-kam'}>
            <td>{g.nombre}</td>
            {TAREAS.map((t) => (
              <td key={t.clave} className="num">
                {g.conteos[t.clave] > 0 ? (
                  <button
                    type="button"
                    className="enlace"
                    aria-label={`${g.nombre}: ${t.etiqueta} (${g.conteos[t.clave]})`}
                    onClick={() => onElegir(g.id, t.clave)}
                  >
                    {g.conteos[t.clave]}
                  </button>
                ) : (
                  0
                )}
              </td>
            ))}
            <td className="num">{TAREAS.reduce((s, t) => s + g.conteos[t.clave], 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
