import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Buscador, coincide } from '../comun/Buscador'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { PanelPlegable } from '../comun/PanelPlegable'
import { useOrden, type Columna } from '../comun/orden'
import { usePerfil } from '../auth/useSesion'

type Rol = 'admin' | 'kam' | 'socio'
interface Usuario { id: string; email: string; nombre: string; rol: Rol; activo: boolean }

const ETIQUETA_ROL: Record<Rol, string> = { admin: 'Administrador', kam: 'KAM', socio: 'Socio' }

const VACIO = { email: '', nombre: '', rol: 'kam' as Rol, activo: true }

export default function Usuarios() {
  const yo = usePerfil()
  const [lista, setLista] = useState<Usuario[]>([])
  const [f, setF] = useState(VACIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
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
      setAbierto(false)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
    }
  }

  const cerrar = () => { setAbierto(false); setEditando(null); setF(VACIO); setError(null) }
  const nuevo = () => { setEditando(null); setF(VACIO); setError(null); setAbierto(true) }
  const editar = (u: Usuario) => {
    setAbierto(true)
    setEditando(u.id)
    setF({ email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo })
  }
  const visibles = lista.filter((u) => coincide(busqueda, u.nombre, u.email))
  const columnas: Columna<Usuario>[] = [
    { clave: 'nombre', valor: (u) => u.nombre },
    { clave: 'email', valor: (u) => u.email },
    { clave: 'rol', valor: (u) => ETIQUETA_ROL[u.rol] },
    { clave: 'activo', valor: (u) => (u.activo ? 'Sí' : 'No') },
  ]
  const { filas, orden, alternar } = useOrden(visibles, columnas)
  const cab = { orden, onAlternar: alternar }

  return (
    <section>
      <h2>Usuarios</h2>
      {!abierto && <p><button type="button" className="boton" onClick={nuevo}>Añadir usuario</button></p>}
      <PanelPlegable abierto={abierto} titulo={editando == null ? 'Añadir usuario' : 'Editar usuario'}>
      <form className="formulario en-linea" onSubmit={guardar}>
        <label>Email
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label>Nombre
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </label>
        <label>Rol
          <select value={f.rol} disabled={esYo} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
            <option value="admin">Administrador</option>
            <option value="kam">KAM</option>
            <option value="socio">Socio</option>
          </select>
        </label>
        <label className="casilla">
          <input type="checkbox" checked={f.activo} disabled={esYo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo
        </label>
        <button className="boton" type="submit">{editando == null ? 'Añadir' : 'Guardar cambios'}</button>
        <button className="boton secundario" type="button" onClick={cerrar}>Cancelar</button>
      </form>
      {esYo && <p className="nota">No puedes cambiar tu propio rol ni desactivarte: pídeselo a otro administrador.</p>}
      </PanelPlegable>
      <div className="filtros"><Buscador valor={busqueda} onCambio={setBusqueda} /></div>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? <p className="nota">Cargando…</p> : lista.length === 0 ? <p className="nota">No hay usuarios.</p> : visibles.length === 0 ? <p className="nota">Sin resultados</p> : (
        <table className="tabla">
          <thead>
            <tr>
              <CabeceraOrdenable clave="nombre" {...cab}>Nombre</CabeceraOrdenable>
              <CabeceraOrdenable clave="email" {...cab}>Email</CabeceraOrdenable>
              <CabeceraOrdenable clave="rol" {...cab}>Rol</CabeceraOrdenable>
              <CabeceraOrdenable clave="activo" {...cab}>Activo</CabeceraOrdenable>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td><td>{u.email}</td><td>{ETIQUETA_ROL[u.rol]}</td><td>{u.activo ? 'Sí' : 'No'}</td>
                <td className="acciones">
                  <button className="boton secundario pequeno" onClick={() => editar(u)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
