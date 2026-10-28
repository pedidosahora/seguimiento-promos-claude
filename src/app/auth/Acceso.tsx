import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export default function Acceso() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

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
