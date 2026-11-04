import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { PanelPlegable } from '../comun/PanelPlegable'
import { useOrden, type Columna } from '../comun/orden'
import { ETIQUETA_ESPACIO } from '../../dominio/etiquetas'

interface Permiso { id: string; perfil_id: string; concesion_id: number | null; espacio: string | null; caduca: string | null }
interface Perfil { id: string; nombre: string }
interface Conc { id: number; razon_social: string }

const VACIO = { perfil_id: '', tipo: 'concesion', concesion_id: '', espacio: 'TMICC', caduca: '' }

export default function Permisos() {
  const [lista, setLista] = useState<Permiso[]>([])
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [concs, setConcs] = useState<Conc[]>([])
  const [f, setF] = useState(VACIO)
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [p, pe, c] = await Promise.all([
        supabase.from('permisos_extra').select('*').order('caduca'),
        supabase.from('perfiles').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('concesiones').select('id, razon_social').order('id'),
      ])
      const fallo = p.error ?? pe.error ?? c.error
      if (fallo) setError(fallo.message)
      setLista((p.data ?? []) as Permiso[])
      setPerfiles((pe.data ?? []) as Perfil[])
      setConcs((c.data ?? []) as Conc[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido cargar los permisos')
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
    if (!f.perfil_id) return setError('Elige un usuario')
    if (f.tipo === 'concesion' && !f.concesion_id) return setError('Elige una concesión')
    const fila = {
      perfil_id: f.perfil_id,
      concesion_id: f.tipo === 'concesion' ? Number(f.concesion_id) : null,
      espacio: f.tipo === 'espacio' ? (f.espacio as 'TMICC' | 'UFS' | 'CAMPANAS') : null,
      caduca: f.caduca || null,
    }
    try {
      const { error: e } = await supabase.from('permisos_extra').insert(fila)
      if (e) return setError(e.message)
      setF(VACIO)
      setAbierto(false)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar')
    }
  }

  async function quitar(id: string) {
    setError(null)
    try {
      const { error: e } = await supabase.from('permisos_extra').delete().eq('id', id)
      if (e) return setError(e.message)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido quitar')
    }
  }

  const nomPerfil = (id: string) => perfiles.find((p) => p.id === id)?.nombre ?? id
  const destino = (p: Permiso) =>
    p.concesion_id != null
      ? `Concesión ${p.concesion_id} · ${concs.find((c) => c.id === p.concesion_id)?.razon_social ?? ''}`
      : `Espacio ${ETIQUETA_ESPACIO[p.espacio as keyof typeof ETIQUETA_ESPACIO] ?? p.espacio}`

  const columnas: Columna<Permiso>[] = [
    { clave: 'usuario', valor: (p) => nomPerfil(p.perfil_id) },
    { clave: 'destino', valor: (p) => destino(p) },
    { clave: 'caduca', valor: (p) => p.caduca },
  ]
  const { filas, orden, alternar } = useOrden(lista, columnas)
  const cab = { orden, onAlternar: alternar }
  const cerrar = () => { setAbierto(false); setF(VACIO); setError(null) }

  return (
    <section>
      <h2>Permisos extra</h2>
      {!abierto && <p><button type="button" className="boton" onClick={() => { setF(VACIO); setError(null); setAbierto(true) }}>Añadir permiso</button></p>}
      <PanelPlegable abierto={abierto} titulo="Añadir permiso">
      <form className="formulario en-linea" onSubmit={guardar}>
        <label>Usuario
          <select value={f.perfil_id} onChange={(e) => setF({ ...f, perfil_id: e.target.value })}>
            <option value="">Elige…</option>
            {perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label>Tipo
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="concesion">Concesión</option>
            <option value="espacio">Espacio</option>
          </select>
        </label>
        {f.tipo === 'concesion' ? (
          <label>Concesión
            <select value={f.concesion_id} onChange={(e) => setF({ ...f, concesion_id: e.target.value })}>
              <option value="">Elige…</option>
              {concs.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.razon_social}</option>)}
            </select>
          </label>
        ) : (
          <label>Espacio
            <select value={f.espacio} onChange={(e) => setF({ ...f, espacio: e.target.value })}>
              {Object.entries(ETIQUETA_ESPACIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
        <label>Caduca (opcional)
          <input type="date" value={f.caduca} onChange={(e) => setF({ ...f, caduca: e.target.value })} />
        </label>
        <button className="boton" type="submit">Añadir</button>
        <button className="boton secundario" type="button" onClick={cerrar}>Cancelar</button>
      </form>
      </PanelPlegable>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? <p className="nota">Cargando…</p> : lista.length === 0 ? <p className="nota">No hay permisos extra.</p> : (
        <table className="tabla">
          <thead>
            <tr>
              <CabeceraOrdenable clave="usuario" {...cab}>Usuario</CabeceraOrdenable>
              <CabeceraOrdenable clave="destino" {...cab}>Acceso a</CabeceraOrdenable>
              <CabeceraOrdenable clave="caduca" {...cab}>Caduca</CabeceraOrdenable>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id}>
                <td>{nomPerfil(p.perfil_id)}</td><td>{destino(p)}</td>
                <td>{p.caduca ? p.caduca.split('-').reverse().join('/') : 'Sin caducidad'}</td>
                <td className="acciones"><button className="boton secundario pequeno peligro" onClick={() => void quitar(p.id)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
