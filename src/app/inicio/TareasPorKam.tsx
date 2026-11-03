import { fmtEntero } from '../../dominio/formato'
import { contarTareas, TAREAS, type FilaInicio, type Tarea } from '../../dominio/tareas'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { useOrden, type Columna } from '../comun/orden'

type Grupo = { id: string | null; nombre: string; conteos: Record<Tarea, number> }
const total = (g: Grupo) => TAREAS.reduce((s, t) => s + g.conteos[t.clave], 0)
const COLUMNAS: Columna<Grupo>[] = [
  { clave: 'kam', valor: (g) => g.nombre },
  ...TAREAS.map((t) => ({ clave: t.clave, valor: (g: Grupo) => g.conteos[t.clave] })),
  { clave: 'total', valor: total },
]

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
  const grupos: Grupo[] = todos.map(
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
  const { filas: ordenados, orden, alternar } = useOrden(grupos, COLUMNAS)
  const cab = { orden, onAlternar: alternar }
  return (
    <table className="tabla tareas-por-kam">
      <thead>
        <tr>
          <CabeceraOrdenable clave="kam" {...cab}>KAM</CabeceraOrdenable>
          {TAREAS.map((t) => (
            <CabeceraOrdenable key={t.clave} clave={t.clave} className="num" {...cab}>{t.etiqueta}</CabeceraOrdenable>
          ))}
          <CabeceraOrdenable clave="total" className="num" {...cab}>Total</CabeceraOrdenable>
        </tr>
      </thead>
      <tbody>
        {ordenados.map((g) => (
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
                    {fmtEntero(g.conteos[t.clave])}
                  </button>
                ) : (
                  <span className="cero">0</span>
                )}
              </td>
            ))}
            <td className="num">{fmtEntero(total(g))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
