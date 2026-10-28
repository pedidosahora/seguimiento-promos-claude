import { ETIQUETA_ESPACIO, ETIQUETA_ESTADO_PROMOCION, type Espacio, type EstadoPromocion } from '../../dominio/etiquetas'

export interface PromoCabecera {
  tag: string
  espacio: Espacio
  mecanica: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: EstadoPromocion
}

export interface Indicadores {
  convocadas: number
  presentadas: number
  pct_aceptacion: number | null
  pct_pendientes: number | null
  pct_rechazo: number | null
  pct_activacion: number | null
  usos: number
  gsv: number
}

export type Pestana = 'mis' | 'todas' | 'pendientes'

const fmtFecha = (f: string | null) => (f ? f.split('-').reverse().join('/') : '—')
const fmtPct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)} %`)

interface Props {
  promo: PromoCabecera
  indicadores: Indicadores | null
  pestana: Pestana
  onPestana: (p: Pestana) => void
}

export default function Cabecera({ promo, indicadores: i, pestana, onPestana }: Props) {
  const datos: [string, string][] = i
    ? [
        ['Convocadas', String(i.convocadas)],
        ['Presentadas', String(i.presentadas)],
        ['% aceptación', fmtPct(i.pct_aceptacion)],
        ['% pendientes', fmtPct(i.pct_pendientes)],
        ['% rechazo', fmtPct(i.pct_rechazo)],
        ['% activación', fmtPct(i.pct_activacion)],
        ['Usos', i.usos.toLocaleString('es-ES')],
        ['GSV', i.gsv.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })],
      ]
    : []
  return (
    <header className="promo-cabecera">
      <h1>
        {promo.tag}
        <span className="insignia neutra">{ETIQUETA_ESPACIO[promo.espacio]}</span>
        {promo.estado !== 'publicada' && <span className="insignia">{ETIQUETA_ESTADO_PROMOCION[promo.estado]}</span>}
      </h1>
      <p className="nota">
        {promo.mecanica ?? 'Sin mecánica'} · {fmtFecha(promo.fecha_inicio)} – {fmtFecha(promo.fecha_fin)}
      </p>
      <dl className="indicadores">
        {datos.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="subnav" role="tablist">
        {(
          [
            ['mis', 'Mis concesiones'],
            ['todas', 'Todas'],
            ['pendientes', 'Solo pendientes'],
          ] as [Pestana, string][]
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            className={pestana === id ? 'pestana activa' : 'pestana'}
            onClick={() => onPestana(id)}
          >
            {texto}
          </button>
        ))}
      </div>
    </header>
  )
}
