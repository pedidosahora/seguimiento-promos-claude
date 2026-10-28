import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  ETIQUETA_ESPACIO,
  ETIQUETA_ESTADO_PROMOCION,
  type Espacio,
  type EstadoPromocion,
} from '../../dominio/etiquetas'

type Marca = 'TMICC' | 'UFS'
interface Datos {
  tag: string
  espacio: Espacio
  marca: Marca
  mecanica: string
  objetivo: string
  canal: string
  fecha_inicio: string
  fecha_fin: string
  umbral: string // en %
  revision_cupos: 'ninguna' | 'semanal' | 'quincenal'
}

const VACIO: Datos = {
  tag: '', espacio: 'TMICC', marca: 'TMICC', mecanica: '', objetivo: '', canal: '',
  fecha_inicio: '', fecha_fin: '', umbral: '80', revision_cupos: 'ninguna',
}

const marcaDe = (e: Espacio, actual: Marca): Marca => (e === 'CAMPANAS' ? actual : e)

export default function FormPromocion() {
  const { id } = useParams()
  const nueva = !id
  const navegar = useNavigate()
  const [d, setD] = useState<Datos>(VACIO)
  const [estado, setEstado] = useState<EstadoPromocion>('borrador')
  const [cargando, setCargando] = useState(!nueva)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    setCargando(true)
    Promise.resolve(supabase.from('promociones').select('*').eq('id', id).single())
      .then(({ data, error: e }) => {
        if (!vivo) return
        if (e) return setError(e.message)
        const p = data as Record<string, any>
        setEstado(p.estado)
        setD({
          tag: p.tag, espacio: p.espacio, marca: p.marca,
          mecanica: p.mecanica ?? '', objetivo: p.objetivo ?? '', canal: p.canal ?? '',
          fecha_inicio: p.fecha_inicio ?? '', fecha_fin: p.fecha_fin ?? '',
          umbral: String(Math.round(Number(p.umbral_cupos) * 100)),
          revision_cupos: p.revision_cupos,
        })
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se ha podido cargar la promoción'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [id])

  const cambiar = (campo: keyof Datos, valor: string) =>
    setD((a) => {
      const n = { ...a, [campo]: valor } as Datos
      n.marca = marcaDe(n.espacio, n.marca)
      return n
    })

  async function guardar(nuevoEstado?: EstadoPromocion) {
    setError(null)
    setAviso(null)
    const destino = nuevoEstado ?? estado
    if (!d.tag.trim()) return setError('El TAG es obligatorio')
    const umbral = Number(d.umbral)
    if (!Number.isInteger(umbral) || umbral < 1 || umbral > 100) return setError('El umbral debe estar entre 1 y 100 %')
    if (destino !== 'borrador') {
      const accion = nuevoEstado === 'publicada' && estado === 'borrador' ? 'publicar' : 'cambiar el estado'
      const faltan: string[] = []
      if (!d.mecanica.trim()) faltan.push('mecánica')
      if (!d.fecha_inicio) faltan.push('fecha de inicio')
      if (!d.fecha_fin) faltan.push('fecha de fin')
      if (faltan.length) return setError(`Para ${accion} faltan: ${faltan.join(', ')}`)
      if (d.fecha_fin < d.fecha_inicio) return setError('La fecha de fin no puede ser anterior a la de inicio')
    }
    const fila = {
      tag: d.tag.trim(),
      espacio: d.espacio,
      marca: marcaDe(d.espacio, d.marca),
      mecanica: d.mecanica.trim() || null,
      objetivo: d.objetivo.trim() || null,
      canal: d.canal.trim() || null,
      fecha_inicio: d.fecha_inicio || null,
      fecha_fin: d.fecha_fin || null,
      umbral_cupos: umbral / 100,
      revision_cupos: d.revision_cupos,
      estado: destino,
    }
    setGuardando(true)
    try {
      const q = nueva
        ? supabase.from('promociones').insert(fila).select('id').single()
        : supabase.from('promociones').update(fila).eq('id', id!).select('id').single()
      const { data, error: e } = await q
      if (e) return setError(e.message)
      setEstado(destino)
      if (nueva) navegar(`/admin/promociones/${(data as { id: string }).id}`, { replace: true })
      else setAviso('Guardado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p className="nota">Cargando…</p>

  return (
    <section>
      <h1>{nueva ? 'Nueva promoción' : `Promoción ${d.tag}`}</h1>
      {!nueva && (
        <p className="nota">
          Estado: {ETIQUETA_ESTADO_PROMOCION[estado]} ·{' '}
          <Link to={`/admin/promociones/${id}/convocatoria`}>Convocatoria</Link>
        </p>
      )}
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
        <label>TAG
          <input value={d.tag} onChange={(e) => cambiar('tag', e.target.value)} />
        </label>
        <label>Espacio
          <select value={d.espacio} onChange={(e) => cambiar('espacio', e.target.value)}>
            {Object.entries(ETIQUETA_ESPACIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Marca
          <select value={d.marca} disabled={d.espacio !== 'CAMPANAS'} onChange={(e) => cambiar('marca', e.target.value)}>
            <option value="TMICC">TMICC</option>
            <option value="UFS">UFS</option>
          </select>
        </label>
        <label>Mecánica
          <input value={d.mecanica} onChange={(e) => cambiar('mecanica', e.target.value)} />
        </label>
        <label>Objetivo
          <input value={d.objetivo} onChange={(e) => cambiar('objetivo', e.target.value)} />
        </label>
        <label>Canal
          <input value={d.canal} onChange={(e) => cambiar('canal', e.target.value)} />
        </label>
        <label>Fecha de inicio
          <input type="date" value={d.fecha_inicio} onChange={(e) => cambiar('fecha_inicio', e.target.value)} />
        </label>
        <label>Fecha de fin
          <input type="date" value={d.fecha_fin} onChange={(e) => cambiar('fecha_fin', e.target.value)} />
        </label>
        <label>Umbral de cupos (%)
          <input type="number" min={1} max={100} value={d.umbral} onChange={(e) => cambiar('umbral', e.target.value)} />
        </label>
        <label>Revisión de cupos
          <select value={d.revision_cupos} onChange={(e) => cambiar('revision_cupos', e.target.value)}>
            <option value="ninguna">Ninguna</option>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
          </select>
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        {aviso && <p className="nota">{aviso}</p>}
        <div className="acciones">
          <button type="submit" className="boton" disabled={guardando}>Guardar</button>
          {estado === 'borrador' && (
            <button type="button" className="boton secundario" disabled={guardando} onClick={() => void guardar('publicada')}>Publicar</button>
          )}
          {estado === 'publicada' && (
            <button type="button" className="boton secundario" disabled={guardando} onClick={() => void guardar('cerrada')}>Cerrar</button>
          )}
          {estado === 'cerrada' && (
            <button type="button" className="boton secundario" disabled={guardando} onClick={() => void guardar('publicada')}>Reabrir</button>
          )}
          {estado === 'cerrada' && (
            <button type="button" className="boton secundario" disabled={guardando} onClick={() => void guardar('archivada')}>Archivar</button>
          )}
        </div>
      </form>
    </section>
  )
}
