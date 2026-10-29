import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

// Si Google o Supabase rechazan el acceso, vuelven a la web con el error en la query o en el fragmento.
function errorDeVuelta(): string | null {
  for (const p of [
    new URLSearchParams(window.location.search),
    new URLSearchParams(window.location.hash.slice(1)),
  ]) {
    if (p.get('error')) {
      const detalle = p.get('error_description') ?? p.get('error')
      return `No se ha podido entrar con Google (${detalle}). Vuelve a intentarlo y, si sigue fallando, avisa a administración.`
    }
  }
  return null
}

export default function Acceso() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(errorDeVuelta)

  // Solo se limpia la dirección si trae un error: un #access_token correcto lo procesa Supabase.
  useEffect(() => {
    if (errorDeVuelta()) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const entrarConGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { queryParams: { hd: 'pro.agency' } },
    })
    if (error) setMensaje(error.message)
  }

  const enviarEnlace = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setMensaje(error ? error.message : 'Enlace enviado. Revisa el correo (en local, Inbucket).')
  }

  return (
    <main className="acceso">
      <h1>Seguimiento de promociones</h1>
      <button className="boton" onClick={entrarConGoogle}>Entrar con Google</button>
      {import.meta.env.DEV && (
        <form onSubmit={enviarEnlace} className="acceso-dev">
          <label>
            Email (solo desarrollo)
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="boton secundario" type="submit">Enviar enlace</button>
        </form>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
    </main>
  )
}
