import { Link } from 'react-router-dom'
import type { FilaInicio } from '../../dominio/tareas'
import { rutaPromocion } from './datos'

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

export default function PromocionesNuevas({ filas, ahora }: { filas: FilaInicio[]; ahora: Date }) {
  const limite = ahora.getTime() - SIETE_DIAS_MS
  const nuevas = new Map<string, FilaInicio>()
  for (const f of filas) {
    if (f.publicada_en && new Date(f.publicada_en).getTime() >= limite && !nuevas.has(f.tag)) {
      nuevas.set(f.tag, f)
    }
  }
  if (nuevas.size === 0) return null
  return (
    <section className="promociones-nuevas">
      <h2>Promociones nuevas</h2>
      <p>
        {[...nuevas.values()].map((f) => (
          <span key={f.tag}><Link to={rutaPromocion(f.espacio, f.tag)}>{f.tag}</Link>{' '}</span>
        ))}
      </p>
    </section>
  )
}
