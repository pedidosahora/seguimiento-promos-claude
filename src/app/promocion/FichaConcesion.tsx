import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  usos: number | null
  gsv: number | null
  promociones: { tag: string; espacio: Espacio } | null
}

export default function FichaConcesion() {
  const { id = '' } = useParams()
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
          .select('id, estado, usos, gsv, promociones(tag, espacio)')
          .eq('concesion_id', Number(id)),
      ])
      if (c.error) throw new Error(c.error.message)
      if (s.error) throw new Error(s.error.message)
      if (!c.data) throw new Error('Concesión no encontrada')
      if (!vivo) return
      setConcesion(c.data as unknown as Concesion)
      const lista = ((s.data ?? []) as unknown as FilaPromo[]).map((f) => ({
        ...f,
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

  if (cargando) return <p className="nota">Cargando…</p>
  if (error || !concesion) return <p role="alert" className="error">{error ?? 'Concesión no encontrada'}</p>

  return (
    <section>
      <h1>
        {concesion.nombre_comercial || concesion.razon_social}
        <span className={concesion.activa ? 'insignia neutra' : 'insignia'}>{concesion.activa ? 'Activa' : 'Inactiva'}</span>
      </h1>
      <dl className="ficha-datos">
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
              <th>TAG</th>
              <th>Espacio</th>
              <th>Estado</th>
              <th className="num">Usos</th>
              <th className="num">GSV</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>
                  {f.promociones ? (
                    <Link to={`/${f.promociones.espacio.toLowerCase()}/${encodeURIComponent(f.promociones.tag)}`}>
                      {f.promociones.tag}
                    </Link>
                  ) : '—'}
                </td>
                <td>{f.promociones ? ETIQUETA_ESPACIO[f.promociones.espacio] : '—'}</td>
                <td>{ETIQUETA_ESTADO[f.estado]}</td>
                <td className="num">{(f.usos ?? 0).toLocaleString('es-ES')}</td>
                <td className="num">
                  {(f.gsv ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
