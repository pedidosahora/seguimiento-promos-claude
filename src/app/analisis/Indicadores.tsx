import type { Metricas } from '../../analisis/agregar'
import { fmtEntero, fmtImporte, fmtPct } from '../../dominio/formato'

export default function Indicadores({ m }: { m: Metricas }) {
  const items: [string, string][] = [
    ['Promociones', fmtEntero(m.promociones)],
    ['Convocadas', fmtEntero(m.convocadas)],
    ['% aceptación', fmtPct(m.pctAceptacion)],
    ['% activación', fmtPct(m.pctActivacion)],
    ['Cupos', fmtEntero(m.cupos)],
    ['Usos', fmtEntero(m.usos)],
    ['% cupos gastados', fmtPct(m.pctCupos)],
    ['GSV', fmtImporte(m.gsv)],
  ]
  return (
    <dl className="analisis-indicadores">
      {items.map(([t, v]) => (
        <div key={t}>
          <dt>{t}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
