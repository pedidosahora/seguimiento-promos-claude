import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Acceso from './auth/Acceso'
import { SesionContext, useSesion, usePerfil } from './auth/useSesion'
import Layout from './Layout'
import ListaPromociones from './promociones/ListaPromociones'

// Marcadores de posición: las tareas 10, 11 y 12 sustituyen estos elementos.
const Pendiente = ({ titulo }: { titulo: string }) => <p>{titulo}: próximamente.</p>

function SoloAdmin({ children }: { children: ReactElement }) {
  return usePerfil()?.rol === 'admin' ? children : <Navigate to="/todos" replace />
}

export default function Rutas() {
  const sesion = useSesion()
  if (sesion.cargando) return <p className="aviso">Cargando…</p>
  if (sesion.error) {
    return (
      <div className="aviso" role="alert">
        <p>No se ha podido cargar tu perfil.</p>
        <button className="boton" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    )
  }
  if (!sesion.haySesion) return <Acceso />
  if (!sesion.perfil) {
    return <p className="aviso">Tu cuenta no tiene acceso. Pide alta a administración</p>
  }
  return (
    <SesionContext.Provider value={sesion}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/todos" replace />} />
          <Route path="/admin/*" element={<SoloAdmin><Pendiente titulo="Administración" /></SoloAdmin>} />
          <Route path="/importar" element={<SoloAdmin><Pendiente titulo="Importar" /></SoloAdmin>} />
          <Route path="/concesion/:id" element={<Pendiente titulo="Concesión" />} />
          <Route path="/:espacio" element={<ListaPromociones />} />
          <Route path="/:espacio/:tag" element={<Pendiente titulo="Promoción" />} />
        </Route>
      </Routes>
    </SesionContext.Provider>
  )
}
