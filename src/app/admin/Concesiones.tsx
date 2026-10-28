import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Conc {
  id: number
  razon_social: string
  nombre_comercial: string | null
  kam_id: string | null
  territorio_id: number | null
  activa: boolean
}
interface Opcion { id: string | number; nombre: string }

const VACIO = { id: '', razon_social: '', nombre_comercial: '', kam_id: '', territorio_id: '' }

export default function Concesiones() {
  const [lista, setLista] = useState<Conc[]>([])
  const [kams, setKams] = useState<Opcion[]>([])
  const [terr, setTerr] = useState<Opcion[]>([])
  const [filtro, setFiltro] = useState<'activas' | 'inactivas'>('activas')
  const [f, setF] = useState(VACIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [c, k, t] = await Promise.all([
        supabase.from('concesiones').select('*').order('id'),
        supabase.from('perfiles').select('id, nombre').eq('rol', 'kam').eq('activo', true).order('nombre'),
        supabase.from('territorios').select('id, nombre').order('nombre'),
      ])
      const fallo = c.error ?? k.error ?? t.error
      if (fallo) setError(fallo.message)
      setLista((c.data ?? []) as Conc[])
      setKams((k.data ?? []) as Opcion[])
      setTerr((t.data ?? []) as Opcion[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido cargar las concesiones')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    const id = Number(f.id)
    if (!Number.isInteger(id) || id <= 0) return setError('El código de concesión debe ser un número')
    if (!f.razon_social.trim()) return setError('La razón social es obligatoria')
    const fila = {
      razon_social: f.razon_social.trim(),
      nombre_comercial: f.nombre_comercial.trim() || null,
      kam_id: f.kam_id || null,
      territorio_id: f.territorio_id ? Number(f.territorio_id) : null,
    }
    try {
      const { error: e } = editando == null
        ? await supabase.from('concesiones').insert({ id, ...fila })
        : await supabase.from('concesiones').update(fila).eq('id', editando)
      if (e) return setError(e.message)
      setF(VACIO)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
    }
  }

  async function alternar(c: Conc) {
    setError(null)
    try {
      const { error: e } = await supabase.from('concesiones').update({ activa: !c.activa }).eq('id', c.id)
      if (e) return setError(e.message)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido actualizar')
    }
  }

  const editar = (c: Conc) => {
    setEditando(c.id)
    setF({
      id: String(c.id), razon_social: c.razon_social, nombre_comercial: c.nombre_comercial ?? '',
      kam_id: c.kam_id ?? '', territorio_id: c.territorio_id ? String(c.territorio_id) : '',
    })
  }
  const visibles = lista.filter((c) => c.activa === (filtro === 'activas'))
  const nombre = (ops: Opcion[], id: string | number | null) => ops.find((o) => o.id === id)?.nombre ?? '—'

  return (
    <section>
      <h2>Concesiones</h2>
      <form className="formulario en-linea" onSubmit={guardar}>
        <label>Código
          <input value={f.id} disabled={editando != null} onChange={(e) => setF({ ...f, id: e.target.value })} />
        </label>
        <label>Razón social
          <input value={f.razon_social} onChange={(e) => setF({ ...f, razon_social: e.target.value })} />
        </label>
        <label>Nombre comercial
          <input value={f.nombre_comercial} onChange={(e) => setF({ ...f, nombre_comercial: e.target.value })} />
        </label>
        <label>KAM
          <select value={f.kam_id} onChange={(e) => setF({ ...f, kam_id: e.target.value })}>
            <option value="">Sin KAM</option>
            {kams.map((k) => <option key={k.id} value={k.id}>{k.nombre}</option>)}
          </select>
        </label>
        <label>Territorio
          <select value={f.territorio_id} onChange={(e) => setF({ ...f, territorio_id: e.target.value })}>
            <option value="">Sin territorio</option>
            {terr.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <button className="boton" type="submit">{editando == null ? 'Añadir' : 'Guardar cambios'}</button>
        {editando != null && (
          <button className="boton secundario" type="button" onClick={() => { setEditando(null); setF(VACIO) }}>Cancelar</button>
        )}
      </form>
      <div className="filtros">
        <label>Mostrar
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as 'activas' | 'inactivas')}>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? <p className="nota">Cargando…</p> : visibles.length === 0 ? <p className="nota">No hay concesiones.</p> : (
        <table className="tabla">
          <thead><tr><th>Código</th><th>Razón social</th><th>Nombre comercial</th><th>KAM</th><th>Territorio</th><th /></tr></thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td><td>{c.razon_social}</td><td>{c.nombre_comercial ?? '—'}</td>
                <td>{nombre(kams, c.kam_id)}</td><td>{nombre(terr, c.territorio_id)}</td>
                <td className="acciones">
                  <button className="boton secundario" onClick={() => editar(c)}>Editar</button>
                  <button className="boton secundario" onClick={() => void alternar(c)}>{c.activa ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
