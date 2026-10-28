import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Conc { id: number; razon_social: string; nombre_comercial: string | null }
interface Fila {
  id: string
  concesion_id: number
  estado: string
  fecha_aceptacion: string | null
  fecha_activacion: string | null
  cupos: number | null
  usos: number | null
  gsv: number | null
  sms: string
  email: string
}

/** Fila sin tocar: pendiente, sin datos, envíos por defecto y sin comentarios. */
const intacta = (f: Fila, conComentarios: Set<string>) =>
  f.estado === 'pendiente' &&
  f.fecha_aceptacion == null && f.fecha_activacion == null &&
  f.cupos == null && f.usos == null && f.gsv == null &&
  f.sms === 'pending' && f.email === 'pending' &&
  !conComentarios.has(f.id)

export default function Convocatoria() {
  const { id } = useParams()
  const [tag, setTag] = useState('')
  const [concs, setConcs] = useState<Conc[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    try {
      const [p, c, s] = await Promise.all([
        supabase.from('promociones').select('tag').eq('id', id).single(),
        supabase.from('concesiones').select('id, razon_social, nombre_comercial').eq('activa', true).order('id'),
        supabase.from('seguimiento').select('*').eq('promocion_id', id),
      ])
      const fallo = p.error ?? c.error ?? s.error
      if (fallo) setError(fallo.message)
      setTag((p.data as { tag: string } | null)?.tag ?? '')
      setConcs((c.data ?? []) as Conc[])
      const existentes = (s.data ?? []) as Fila[]
      setFilas(existentes)
      setMarcadas(new Set(existentes.map((f) => f.concesion_id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido cargar la convocatoria')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const alternar = (cid: number) =>
    setMarcadas((a) => {
      const n = new Set(a)
      if (n.has(cid)) n.delete(cid)
      else n.add(cid)
      return n
    })
  const todas = concs.length > 0 && concs.every((c) => marcadas.has(c.id))
  const seleccionarTodas = () =>
    setMarcadas((a) => {
      const n = new Set(a)
      for (const c of concs) {
        if (todas) n.delete(c.id)
        else n.add(c.id)
      }
      return n
    })

  async function guardar() {
    if (!id) return
    setError(null)
    setAviso(null)
    setGuardando(true)
    try {
      const nuevas = [...marcadas].filter((cid) => !filas.some((f) => f.concesion_id === cid))
      const quitadas = filas.filter((f) => !marcadas.has(f.concesion_id))

      // Desconvocar solo filas sin cambios; si no, hay que pasarlas a "No entra".
      if (quitadas.length) {
        const { data, error: ec } = await supabase
          .from('comentarios').select('seguimiento_id').in('seguimiento_id', quitadas.map((f) => f.id))
        if (ec) return setError(ec.message)
        const con = new Set(((data ?? []) as { seguimiento_id: string }[]).map((x) => x.seguimiento_id))
        const tocadas = quitadas.filter((f) => !intacta(f, con))
        if (tocadas.length) {
          const lista = tocadas.map((f) => f.concesion_id).join(', ')
          return setError(
            `No se puede desconvocar la concesión ${lista}: ya tiene seguimiento. Pásala a "No entra" en su ficha.`,
          )
        }
        const { error: ed } = await supabase.from('seguimiento').delete().in('id', quitadas.map((f) => f.id))
        if (ed) return setError(ed.message)
      }
      if (nuevas.length) {
        const { error: ei } = await supabase
          .from('seguimiento').insert(nuevas.map((cid) => ({ promocion_id: id, concesion_id: cid })))
        if (ei) return setError(ei.message)
      }
      setAviso(`Convocatoria guardada: ${nuevas.length} nuevas, ${quitadas.length} retiradas`)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <h1>Convocatoria {tag && `· ${tag}`}</h1>
      <p className="nota"><Link to={`/admin/promociones/${id}`}>Volver a la promoción</Link></p>
      {error && <p role="alert" className="error">{error}</p>}
      {aviso && <p className="nota">{aviso}</p>}
      {cargando ? <p className="nota">Cargando…</p> : (
        <>
          <label className="casilla">
            <input type="checkbox" checked={todas} onChange={seleccionarTodas} /> Seleccionar todas
          </label>
          <table className="tabla">
            <thead><tr><th /><th>Código</th><th>Razón social</th><th>Nombre comercial</th></tr></thead>
            <tbody>
              {concs.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input type="checkbox" aria-label={`Convocar ${c.id}`} checked={marcadas.has(c.id)} onChange={() => alternar(c.id)} />
                  </td>
                  <td>{c.id}</td><td>{c.razon_social}</td><td>{c.nombre_comercial ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="acciones">
            <button className="boton" disabled={guardando} onClick={() => void guardar()}>Guardar convocatoria</button>
          </div>
        </>
      )}
    </section>
  )
}
