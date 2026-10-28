import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePerfil } from '../auth/useSesion'
import { hoyISO as hoy } from '../../dominio/fechas'
import {
  ETIQUETA_ESPACIO,
  ETIQUETA_ESTADO_PROMOCION,
  type Espacio,
  type EstadoPromocion,
} from '../../dominio/etiquetas'

interface Promo {
  id: string
  tag: string
  espacio: Espacio
  marca: 'TMICC' | 'UFS'
  mecanica: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: EstadoPromocion
}
interface Resumen {
  presentadas: number
  pct_aceptacion: number | null
  activas: number
  usos: number
  gsv: number
}

const ESPACIO_RUTA: Record<string, Espacio | undefined> = {
  tmicc: 'TMICC',
  ufs: 'UFS',
  campanas: 'CAMPANAS',
}

// La vista puede devolver numeric como string.
const num = (v: unknown) => Number(v ?? 0)
const fmtFecha = (f: string | null) => (f ? f.split('-').reverse().join('/') : '—')

export default function ListaPromociones() {
  const { espacio: ruta = 'todos' } = useParams()
  const perfil = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const espacio = ESPACIO_RUTA[ruta]
  const esTodos = ruta === 'todos'

  const [promos, setPromos] = useState<Promo[]>([])
  const [resumen, setResumen] = useState<Record<string, Resumen>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fCiclo, setFCiclo] = useState('')
  const [fVigencia, setFVigencia] = useState('')
  const [fMarca, setFMarca] = useState('')

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    let consulta = supabase
      .from('promociones')
      .select('id, tag, espacio, marca, mecanica, fecha_inicio, fecha_fin, estado')
      .order('fecha_inicio', { ascending: false })
    if (espacio) consulta = consulta.eq('espacio', espacio)
    Promise.all([consulta, supabase.from('v_resumen_promocion').select('*')]).then(
      ([p, r]) => {
        if (!vivo) return
        const fallo = p.error ?? r.error
        if (fallo) setError(fallo.message)
        const mapa: Record<string, Resumen> = {}
        for (const fila of (r.data ?? []) as Record<string, unknown>[]) {
          mapa[fila.promocion_id as string] = {
            presentadas: num(fila.presentadas),
            pct_aceptacion: fila.pct_aceptacion == null ? null : Number(fila.pct_aceptacion),
            activas: num(fila.activas),
            usos: num(fila.usos),
            gsv: num(fila.gsv),
          }
        }
        setPromos((p.data ?? []) as Promo[])
        setResumen(mapa)
      },
    ).catch((e) => {
      if (vivo) setError(e instanceof Error ? e.message : 'No se han podido cargar las promociones')
    }).finally(() => {
      if (vivo) setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [espacio])

  const visibles = useMemo(() => {
    const h = hoy()
    return promos.filter((p) => {
      // Con el ciclo en "Todos" las archivadas no se muestran; solo si se elige "Archivada".
      if (fCiclo ? p.estado !== fCiclo : p.estado === 'archivada') return false
      if (fMarca && p.marca !== fMarca) return false
      if (fVigencia === 'vigentes' && !(p.fecha_fin && p.fecha_fin >= h)) return false
      if (fVigencia === 'terminadas' && !(p.fecha_fin && p.fecha_fin < h)) return false
      return true
    })
  }, [promos, fCiclo, fVigencia, fMarca])

  const vencida = (p: Promo) => p.estado === 'publicada' && !!p.fecha_fin && p.fecha_fin < hoy()
  const titulo = esTodos
    ? 'Todas las promociones'
    : espacio
      ? ETIQUETA_ESPACIO[espacio]
      : 'Espacio desconocido'

  return (
    <section>
      <h1>{titulo}</h1>
      {esTodos && <p className="nota">Vista de solo lectura.</p>}
      <div className="filtros">
        <label>
          Ciclo
          <select value={fCiclo} onChange={(e) => setFCiclo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_ESTADO_PROMOCION).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Vigencia
          <select value={fVigencia} onChange={(e) => setFVigencia(e.target.value)}>
            <option value="">Todas</option>
            <option value="vigentes">Vigentes</option>
            <option value="terminadas">Terminadas</option>
          </select>
        </label>
        <label>
          Marca
          <select value={fMarca} onChange={(e) => setFMarca(e.target.value)}>
            <option value="">Todas</option>
            <option value="TMICC">TMICC</option>
            <option value="UFS">UFS</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? (
        <p className="nota">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="nota">No hay promociones.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>TAG</th>
              {esTodos && <th>Espacio</th>}
              <th>Mecánica</th>
              <th>Vigencia</th>
              <th className="num">Presentadas</th>
              <th className="num">% aceptación</th>
              <th className="num">Activas</th>
              <th className="num">Usos</th>
              <th className="num">GSV</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const r = resumen[p.id]
              const base = esTodos ? p.espacio.toLowerCase() : ruta
              return (
                <tr key={p.id}>
                  <td>
                    <Link to={`/${base}/${encodeURIComponent(p.tag)}`}>{p.tag}</Link>
                    {esAdmin && vencida(p) && <span className="insignia">Vencida</span>}
                  </td>
                  {esTodos && <td>{ETIQUETA_ESPACIO[p.espacio]}</td>}
                  <td>{p.mecanica ?? '—'}</td>
                  <td>{fmtFecha(p.fecha_inicio)} – {fmtFecha(p.fecha_fin)}</td>
                  <td className="num">{r?.presentadas ?? 0}</td>
                  <td className="num">
                    {r?.pct_aceptacion == null ? '—' : `${Math.round(r.pct_aceptacion * 100)} %`}
                  </td>
                  <td className="num">{r?.activas ?? 0}</td>
                  <td className="num">{(r?.usos ?? 0).toLocaleString('es-ES')}</td>
                  <td className="num">
                    {(r?.gsv ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
