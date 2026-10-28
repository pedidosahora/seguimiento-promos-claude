import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type Perfil = Database['public']['Tables']['perfiles']['Row']

export interface EstadoSesion {
  cargando: boolean
  /** null si no hay sesión o el usuario no tiene perfil activo. */
  perfil: Perfil | null
  /** true si hay sesión de Auth (con o sin perfil). */
  haySesion?: boolean
}

export const SesionContext = createContext<EstadoSesion>({ cargando: true, perfil: null })

/** Perfil del usuario autenticado, disponible bajo <SesionContext.Provider>. */
export function usePerfil(): Perfil | null {
  return useContext(SesionContext).perfil
}

async function cargarPerfil(sesion: Session | null): Promise<Perfil | null> {
  if (!sesion) return null
  const { data } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', sesion.user.id)
    .eq('activo', true)
    .maybeSingle()
  return (data as Perfil | null) ?? null
}

export function useSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>({ cargando: true, perfil: null })

  useEffect(() => {
    let vivo = true
    const aplicar = async (sesion: Session | null) => {
      const perfil = await cargarPerfil(sesion)
      if (vivo) setEstado({ cargando: false, perfil, haySesion: !!sesion })
    }
    supabase.auth.getSession().then(({ data }) => aplicar(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      // Fuera del callback para no bloquear el cliente de Auth con consultas.
      setTimeout(() => void aplicar(sesion), 0)
    })
    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return estado
}
