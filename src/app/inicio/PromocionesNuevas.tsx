import { Link } from 'react-router-dom'
import { ETIQUETA_ESPACIO } from '../../dominio/etiquetas'
import type { FilaInicio } from '../../dominio/tareas'
import { rutaPromocion } from './datos'

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
const fmtDia = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid' })

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
      <ul className="tarjetas-promo">
        {[...nuevas.values()].map((f) => (
          <li key={f.tag}>
            <Link to={rutaPromocion(f.espacio, f.tag)}>{f.tag}</Link>
            <span className="nota">
              {ETIQUETA_ESPACIO[f.espacio]} · publicada el {fmtDia(f.publicada_en!)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
