import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.test' })

const URL = process.env.API_URL ?? 'http://127.0.0.1:54421'
const ANON_KEY = process.env.ANON_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? ''

const opciones = { auth: { persistSession: false, autoRefreshToken: false } }

/** Cliente con service role: salta RLS. */
export function admin(): SupabaseClient {
  return createClient(URL, SERVICE_ROLE_KEY, opciones)
}

/** Crea un usuario de prueba confirmado y devuelve su id. */
export async function crearUsuario(
  email: string,
  password = 'prueba-1234',
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error
  return data.user.id
}

/** Cliente autenticado como el usuario indicado (respeta RLS). */
export async function clienteComo(
  email: string,
  password = 'prueba-1234',
): Promise<SupabaseClient> {
  const cliente = createClient(URL, ANON_KEY, opciones)
  const { error } = await cliente.auth.signInWithPassword({ email, password })
  if (error) throw error
  return cliente
}

/** Borra los usuarios de prueba. Las tareas siguientes ampliarán esto con TRUNCATE de tablas de dominio. */
export async function resetDatos(): Promise<void> {
  const a = admin()
  const { data, error } = await a.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  for (const u of data.users) {
    const { error: e } = await a.auth.admin.deleteUser(u.id)
    if (e) throw e
  }
}
