import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.test' })

const URL = process.env.API_URL ?? 'http://127.0.0.1:54421'
const PASSWORD = "test-local-1234"
const ANON_KEY = process.env.ANON_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? ''

const opciones = { auth: { persistSession: false, autoRefreshToken: false } }

function exigirEntorno(): void {
  if (!ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error(
      'Falta .env.test: ejecuta npm run env:test con Supabase local arrancado',
    )
  }
}

/** Cliente con service role: salta RLS. */
export function admin(): SupabaseClient {
  exigirEntorno()
  return createClient(URL, SERVICE_ROLE_KEY, opciones)
}

/** Crea un usuario de prueba confirmado (contraseña local de pruebas). */
export async function crearUsuario(datos: {
  email: string
  nombre: string
  rol: string
}): Promise<{ perfilId: string; userId: string }> {
  const a = admin()
  const { data, error } = await a.auth.admin.createUser({
    email: datos.email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  const { data: perfil, error: e } = await a
    .from('perfiles')
    .insert({
      email: datos.email,
      nombre: datos.nombre,
      rol: datos.rol,
      user_id: data.user.id,
    })
    .select('id')
    .single()
  if (e) throw e
  return { perfilId: perfil.id, userId: data.user.id }
}

/** Cliente autenticado como el usuario indicado (respeta RLS). */
export async function clienteComo(email: string): Promise<SupabaseClient> {
  exigirEntorno()
  const cliente = createClient(URL, ANON_KEY, opciones)
  const { error } = await cliente.auth.signInWithPassword({
    email,
    password: PASSWORD,
  })
  if (error) throw error
  return cliente
}

/** Tablas de dominio en orden de borrado (hijas primero). Cada tarea añade las suyas al principio. */
const TABLAS_DOMINIO: { tabla: string; columna: string }[] = [
  { tabla: 'permisos_extra', columna: 'id' },
  { tabla: 'concesiones', columna: 'id' },
  { tabla: 'perfiles', columna: 'id' },
  { tabla: 'territorios', columna: 'id' },
]

/** Vacía las tablas de dominio y borra los usuarios de prueba. */
export async function resetDatos(): Promise<void> {
  const a = admin()
  for (const { tabla, columna } of TABLAS_DOMINIO) {
    // PostgREST exige un filtro en DELETE; not-null equivale a "todas las filas".
    const { error: e } = await a.from(tabla).delete().not(columna, 'is', null)
    if (e) throw e
  }
  const { data, error } = await a.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  for (const u of data.users) {
    const { error: e } = await a.auth.admin.deleteUser(u.id)
    if (e) throw e
  }
}
