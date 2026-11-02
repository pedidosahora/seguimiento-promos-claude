import { fmtEntero, fmtImporte, fmtPct } from '../../dominio/formato'
import { Link } from 'react-router-dom'
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
  activas: number
  pendientes: number
  cupos: number
  pct_aceptacion: number | null
  pct_pendientes: number | null
  pct_rechazo: number | null
  pct_activacion: number | null
  usos: number
  gsv: number
}

export type Pestana = 'mis' | 'todas' | 'pendientes'

const RUTA_ESPACIO: Record<Espacio, string> = { TMICC: 'tmicc', UFS: 'ufs', CAMPANAS: 'campanas' }

const fmtFecha = (f: string | null) => (f ? f.split('-').reverse().join('/') : '—')

interface Props {
  promo: PromoCabecera
  indicadores: Indicadores | null
  pestana: Pestana
  onPestana: (p: Pestana) => void
  onExportar?: () => void
}

export default function Cabecera({ promo, indicadores: i, pestana, onPestana, onExportar }: Props) {
  const grupos: [string, [string, string][]][] = i
    ? [
        [
          'Participación',
          [
            ['Convocadas', fmtEntero(i.convocadas)],
            ['Presentadas', fmtEntero(i.presentadas)],
            ['Activas', fmtEntero(i.activas)],
            ['Pendientes', fmtEntero(i.pendientes)],
          ],
        ],
        [
          'Porcentajes',
          [
            ['% aceptación', fmtPct(i.pct_aceptacion)],
            ['% pendientes', fmtPct(i.pct_pendientes)],
            ['% rechazo', fmtPct(i.pct_rechazo)],
            ['% activación', fmtPct(i.pct_activacion)],
          ],
        ],
        [
          'Resultados',
          [
            ['Cupos', fmtEntero(i.cupos)],
            ['Usos', fmtEntero(i.usos)],
            ['GSV', fmtImporte(i.gsv)],
          ],
        ],
      ]
    : []
  return (
    <header className="promo-cabecera">
      <Link to={`/${RUTA_ESPACIO[promo.espacio]}`} className="volver">← {ETIQUETA_ESPACIO[promo.espacio]}</Link>
      <div className="titulo-seccion">
        <h1>
          {promo.tag}
          <span className="insignia neutra">{ETIQUETA_ESPACIO[promo.espacio]}</span>
          {promo.estado !== 'publicada' && <span className="insignia">{ETIQUETA_ESTADO_PROMOCION[promo.estado]}</span>}
        </h1>
        {onExportar && (
          <button type="button" className="boton secundario" onClick={onExportar}>
            Exportar a Excel
          </button>
        )}
      </div>
      <p className="nota">
        {promo.mecanica ?? 'Sin mecánica'} · {fmtFecha(promo.fecha_inicio)} – {fmtFecha(promo.fecha_fin)}
      </p>
      <div className="indicadores">
        {grupos.map(([titulo, datos]) => (
          <section key={titulo} className="indicadores-grupo">
            <h2>{titulo}</h2>
            <dl>
              {datos.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
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
