import { Link } from 'react-router-dom'
import { rutaPromocion, type FilaRanking } from './datos'

const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

export default function RankingPromociones({ filas }: { filas: FilaRanking[] }) {
  const orden = [...filas].sort(
    (a, b) =>
      Number(a.pct == null) - Number(b.pct == null) ||
      (b.pct ?? 0) - (a.pct ?? 0) ||
      a.tag.localeCompare(b.tag, 'es'),
  )
  return (
    <table className="tabla ranking">
      <thead>
        <tr>
          <th>TAG</th>
          <th>Espacio</th>
          <th>% cupos gastados</th>
          <th className="num">Usos</th>
          <th className="num">Cupos</th>
          <th className="num">GSV</th>
          <th className="num">Activas</th>
        </tr>
      </thead>
      <tbody>
        {orden.map((f) => (
          <tr key={f.promocion_id}>
            <td><Link to={rutaPromocion(f.espacio, f.tag)}>{f.tag}</Link></td>
            <td>{f.espacio}</td>
            <td>
              {f.pct == null ? (
                '—'
              ) : (
                <div className="pct-cupos">
                  <span>{Math.round(f.pct * 100)}%</span>
                  <div className="barra" aria-hidden="true">
                    <div className="barra-relleno" style={{ width: `${Math.min(f.pct, 1) * 100}%` }} />
                  </div>
                </div>
              )}
            </td>
            <td className="num">{nf.format(f.usos)}</td>
            <td className="num">{nf.format(f.cupos)}</td>
            <td className="num">{nf.format(f.gsv)}</td>
            <td className="num">{nf.format(f.activas)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
