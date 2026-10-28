import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Admin from './admin/Admin'
import Acceso from './auth/Acceso'
import { SesionContext, useSesion, usePerfil } from './auth/useSesion'
import Importar from './importar/Importar'
import Layout from './Layout'
import FichaConcesion from './promocion/FichaConcesion'
import Promocion from './promocion/Promocion'
import ListaPromociones from './promociones/ListaPromociones'

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
        <button className="boton secundario" onClick={() => void supabase.auth.signOut()}>Salir</button>
      </div>
    )
  }
  if (!sesion.haySesion) return <Acceso />
  if (!sesion.perfil) {
    return (
      <div className="aviso">
        <p>Tu cuenta no tiene acceso. Pide alta a administración</p>
        <button className="boton secundario" onClick={() => void supabase.auth.signOut()}>Salir</button>
      </div>
    )
  }
  return (
    <SesionContext.Provider value={sesion}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/todos" replace />} />
          <Route path="/admin/*" element={<SoloAdmin><Admin /></SoloAdmin>} />
          <Route path="/importar" element={<SoloAdmin><Importar /></SoloAdmin>} />
          <Route path="/concesion/:id" element={<FichaConcesion />} />
          <Route path="/:espacio" element={<ListaPromociones />} />
          <Route path="/:espacio/:tag" element={<Promocion />} />
        </Route>
      </Routes>
    </SesionContext.Provider>
  )
}
