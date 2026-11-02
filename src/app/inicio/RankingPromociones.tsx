import { fmtEntero, fmtImporte, fmtPct } from '../../dominio/formato'
import { Link } from 'react-router-dom'
import { rutaPromocion, type FilaRanking } from './datos'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { useOrden, type Columna } from '../comun/orden'

const COLUMNAS: Columna<FilaRanking>[] = [
  { clave: 'tag', valor: (f) => f.tag },
  { clave: 'espacio', valor: (f) => f.espacio },
  { clave: 'pct', valor: (f) => f.pct },
  { clave: 'usos', valor: (f) => f.usos },
  { clave: 'cupos', valor: (f) => f.cupos },
  { clave: 'gsv', valor: (f) => f.gsv },
  { clave: 'activas', valor: (f) => f.activas },
]

export default function RankingPromociones({ filas }: { filas: FilaRanking[] }) {
  const porDefecto = [...filas].sort(
    (a, b) =>
      Number(a.pct == null) - Number(b.pct == null) ||
      (b.pct ?? 0) - (a.pct ?? 0) ||
      a.tag.localeCompare(b.tag, 'es'),
  )
  const { filas: ordenadas, orden, alternar } = useOrden(porDefecto, COLUMNAS)
  const cab = { orden, onAlternar: alternar }
  return (
    <table className="tabla ranking">
      <thead>
        <tr>
          <CabeceraOrdenable clave="tag" {...cab}>TAG</CabeceraOrdenable>
          <CabeceraOrdenable clave="espacio" {...cab}>Espacio</CabeceraOrdenable>
          <CabeceraOrdenable clave="pct" {...cab}>% cupos gastados</CabeceraOrdenable>
          <CabeceraOrdenable clave="usos" className="num" {...cab}>Usos</CabeceraOrdenable>
          <CabeceraOrdenable clave="cupos" className="num" {...cab}>Cupos</CabeceraOrdenable>
          <CabeceraOrdenable clave="gsv" className="num" {...cab}>GSV</CabeceraOrdenable>
          <CabeceraOrdenable clave="activas" className="num" {...cab}>Activas</CabeceraOrdenable>
        </tr>
      </thead>
      <tbody>
        {ordenadas.map((f) => (
          <tr key={f.promocion_id}>
            <td><Link to={rutaPromocion(f.espacio, f.tag)}>{f.tag}</Link></td>
            <td>{f.espacio}</td>
            <td>
              {f.pct == null ? (
                '—'
              ) : (
                <div className="pct-cupos">
                  <span>{fmtPct(f.pct)}</span>
                  <div className="barra" aria-hidden="true">
                    <div className="barra-relleno" style={{ width: `${Math.min(f.pct, 1) * 100}%` }} />
                  </div>
                </div>
              )}
            </td>
            <td className="num">{fmtEntero(f.usos)}</td>
            <td className="num">{fmtEntero(f.cupos)}</td>
            <td className="num">{fmtImporte(f.gsv)}</td>
            <td className="num">{fmtEntero(f.activas)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
