import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePerfil } from '../auth/useSesion'

type Rol = 'admin' | 'kam' | 'socio'
interface Usuario { id: string; email: string; nombre: string; rol: Rol; activo: boolean }

const VACIO = { email: '', nombre: '', rol: 'kam' as Rol, activo: true }

export default function Usuarios() {
  const yo = usePerfil()
  const [lista, setLista] = useState<Usuario[]>([])
  const [f, setF] = useState(VACIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Un administrador no puede quitarse a sí mismo el rol de admin ni desactivarse.
  const esYo = editando != null && editando === yo?.id

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data, error: e } = await supabase.from('perfiles').select('id, email, nombre, rol, activo').order('nombre')
      if (e) setError(e.message)
      setLista((data ?? []) as Usuario[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido cargar los usuarios')
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
    if (!f.email.trim() || !f.nombre.trim()) return setError('Email y nombre son obligatorios')
    const fila = { email: f.email.trim().toLowerCase(), nombre: f.nombre.trim(), rol: f.rol, activo: f.activo }
    try {
      const { error: e } = editando == null
        ? await supabase.from('perfiles').insert(fila)
        : await supabase.from('perfiles').update(fila).eq('id', editando)
      if (e) return setError(e.message)
      setF(VACIO)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
    }
  }

  return (
    <section>
      <h2>Usuarios</h2>
      <form className="formulario en-linea" onSubmit={guardar}>
        <label>Email
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label>Nombre
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </label>
        <label>Rol
          <select value={f.rol} disabled={esYo} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
            <option value="admin">Admin</option>
            <option value="kam">KAM</option>
            <option value="socio">Socio</option>
          </select>
        </label>
        <label className="casilla">
          <input type="checkbox" checked={f.activo} disabled={esYo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo
        </label>
        <button className="boton" type="submit">{editando == null ? 'Añadir' : 'Guardar cambios'}</button>
        {editando != null && (
          <button className="boton secundario" type="button" onClick={() => { setEditando(null); setF(VACIO) }}>Cancelar</button>
        )}
      </form>
      {esYo && <p className="nota">No puedes cambiar tu propio rol ni desactivarte: pídeselo a otro administrador.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? <p className="nota">Cargando…</p> : lista.length === 0 ? <p className="nota">No hay usuarios.</p> : (
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th /></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td><td>{u.email}</td><td>{u.rol}</td><td>{u.activo ? 'Sí' : 'No'}</td>
                <td className="acciones">
                  <button className="boton secundario" onClick={() => { setEditando(u.id); setF({ email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo }) }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
