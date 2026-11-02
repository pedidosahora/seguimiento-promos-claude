import { fmtEntero, fmtImporte, fmtPct } from '../../dominio/formato'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { nivelAlertaCupos, pctCupos } from '../../dominio/calculos'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { useOrden, type Columna } from '../comun/orden'
import { supabase } from '../../lib/supabase'
import { ETIQUETA_ESPACIO, ETIQUETA_ESTADO, type Espacio, type EstadoSeguimiento } from '../../dominio/etiquetas'

interface Concesion {
  id: number
  razon_social: string
  nombre_comercial: string | null
  activa: boolean
  territorios: { nombre: string } | null
  kam: { nombre: string } | null
}
interface FilaPromo {
  id: string
  estado: EstadoSeguimiento
  cupos: number | null
  usos: number | null
  gsv: number | null
  promociones: { tag: string; espacio: Espacio; umbral_cupos: number | string } | null
}

const COLUMNAS: Columna<FilaPromo>[] = [
  { clave: 'tag', valor: (f) => f.promociones?.tag },
  { clave: 'espacio', valor: (f) => (f.promociones ? ETIQUETA_ESPACIO[f.promociones.espacio] : null) },
  { clave: 'estado', valor: (f) => ETIQUETA_ESTADO[f.estado] },
  { clave: 'cupos', valor: (f) => f.cupos },
  { clave: 'usos', valor: (f) => f.usos },
  { clave: 'pct', valor: (f) => pctCupos(f.usos, f.cupos) },
  { clave: 'gsv', valor: (f) => f.gsv },
]

export default function FichaConcesion() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [concesion, setConcesion] = useState<Concesion | null>(null)
  const [filas, setFilas] = useState<FilaPromo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    ;(async () => {
      const [c, s] = await Promise.all([
        supabase
          .from('concesiones')
          .select('id, razon_social, nombre_comercial, activa, territorios(nombre), kam:perfiles!concesiones_kam_id_fkey(nombre)')
          .eq('id', Number(id))
          .maybeSingle(),
        supabase
          .from('seguimiento')
          .select('id, estado, cupos, usos, gsv, promociones(tag, espacio, umbral_cupos)')
          .eq('concesion_id', Number(id)),
      ])
      if (c.error) throw new Error(c.error.message)
      if (s.error) throw new Error(s.error.message)
      if (!c.data) throw new Error('Concesión no encontrada')
      if (!vivo) return
      setConcesion(c.data as unknown as Concesion)
      const lista = ((s.data ?? []) as unknown as FilaPromo[]).map((f) => ({
        ...f,
        cupos: f.cupos == null ? null : Number(f.cupos),
        usos: f.usos == null ? null : Number(f.usos),
        gsv: f.gsv == null ? null : Number(f.gsv),
      }))
      lista.sort((a, b) => (a.promociones?.tag ?? '').localeCompare(b.promociones?.tag ?? ''))
      setFilas(lista)
    })()
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se ha podido cargar la concesión')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [id])

  const { filas: ordenadas, orden, alternar } = useOrden(filas, COLUMNAS)
  const cab = { orden, onAlternar: alternar }

  if (cargando) return <p className="nota">Cargando…</p>
  if (error || !concesion) return <p role="alert" className="error">{error ?? 'Concesión no encontrada'}</p>

  return (
    <section>
      <Link
        to="/"
        className="volver"
        onClick={(e) => {
          if (window.history.state?.idx > 0) {
            e.preventDefault()
            navigate(-1)
          }
        }}
      >
        ← Volver
      </Link>
      <h1>
        {concesion.nombre_comercial || concesion.razon_social}
        <span className={concesion.activa ? 'insignia neutra' : 'insignia'}>{concesion.activa ? 'Activa' : 'Inactiva'}</span>
      </h1>
      <dl className="ficha-datos ficha-datos-pagina">
        <div><dt>Nº concesión</dt><dd>{concesion.id}</dd></div>
        <div><dt>Razón social</dt><dd>{concesion.razon_social}</dd></div>
        <div><dt>KAM</dt><dd>{concesion.kam?.nombre ?? '—'}</dd></div>
        <div><dt>Territorio</dt><dd>{concesion.territorios?.nombre ?? '—'}</dd></div>
      </dl>
      <h2>Promociones</h2>
      {filas.length === 0 ? (
        <p className="nota">Esta concesión no tiene promociones.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <CabeceraOrdenable clave="tag" {...cab}>TAG</CabeceraOrdenable>
              <CabeceraOrdenable clave="espacio" {...cab}>Espacio</CabeceraOrdenable>
              <CabeceraOrdenable clave="estado" {...cab}>Estado en la promoción</CabeceraOrdenable>
              <CabeceraOrdenable clave="cupos" className="num" {...cab}>Cupos</CabeceraOrdenable>
              <CabeceraOrdenable clave="usos" className="num" {...cab}>Usos</CabeceraOrdenable>
              <CabeceraOrdenable clave="pct" className="num" {...cab}>% cupos</CabeceraOrdenable>
              <CabeceraOrdenable clave="gsv" className="num" {...cab}>GSV</CabeceraOrdenable>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f) => {
              const pct = pctCupos(f.usos, f.cupos)
              const nivel = f.promociones ? nivelAlertaCupos(f.usos, f.cupos, Number(f.promociones.umbral_cupos)) : null
              return (
              <tr key={f.id}>
                <td>
                  {f.promociones ? (
                    <Link to={`/${f.promociones.espacio.toLowerCase()}/${encodeURIComponent(f.promociones.tag)}`}>
                      {f.promociones.tag}
                    </Link>
                  ) : '—'}
                </td>
                <td>{f.promociones ? ETIQUETA_ESPACIO[f.promociones.espacio] : '—'}</td>
                <td><span className={`etiqueta-estado estado-${f.estado}`}>{ETIQUETA_ESTADO[f.estado]}</span></td>
                <td className="num">{fmtEntero(f.cupos)}</td>
                <td className="num">{fmtEntero(f.usos ?? 0)}</td>
                <td className="num">
                  {nivel ? <span className={nivel}>⚠ {fmtPct(pct)}</span> : fmtPct(pct)}
                </td>
                <td className="num">
                  {fmtImporte(f.gsv ?? 0)}
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
