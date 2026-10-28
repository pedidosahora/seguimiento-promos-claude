import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ETIQUETA_ENVIO, ETIQUETA_ESTADO } from '../../dominio/etiquetas'
import { nivelAlertaCupos, pctCupos } from '../../dominio/calculos'
import { textoFechaHora, textoPctCupos } from './celdas'
import type { FilaGrid } from './servicio'

interface Comentario {
  id: string
  texto: string
  creado_en: string
  autor_id: string | null
}
interface EntradaHistorial {
  id: number
  accion: string
  cambios: Record<string, { antes: unknown; despues: unknown }>
  autor_id: string | null
  fecha: string
  deshecho: boolean
}

const ETIQUETA_CAMPO: Record<string, string> = {
  estado: 'Estado',
  sms: 'SMS',
  email: 'Email',
  cupos: 'Cupos',
  usos: 'Usos',
  gsv: 'GSV',
  fecha_aceptacion: 'F. aceptación',
  fecha_activacion: 'F. activación',
  fecha_dato: 'Fecha del dato',
}

function textoValor(campo: string, v: unknown): string {
  if (v == null) return '—'
  if (campo === 'estado') return ETIQUETA_ESTADO[v as keyof typeof ETIQUETA_ESTADO] ?? String(v)
  if (campo === 'sms' || campo === 'email') return ETIQUETA_ENVIO[v as keyof typeof ETIQUETA_ENVIO] ?? String(v)
  if (campo === 'fecha_aceptacion' || campo === 'fecha_activacion') return textoFechaHora(String(v))
  return String(v)
}

interface Props {
  fila: FilaGrid
  umbral: number
  editable: boolean
  esAdmin: boolean
  perfilId: string
  onCerrar: () => void
  /** Pide a la pantalla recargar esta fila tras deshacer. */
  onDeshecho: (id: string) => Promise<void>
}

export default function FichaLateral({ fila, umbral, editable, esAdmin, perfilId, onCerrar, onDeshecho }: Props) {
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [historial, setHistorial] = useState<EntradaHistorial[]>([])
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const [c, h, p] = await Promise.all([
      supabase.from('comentarios').select('id, texto, creado_en, autor_id').eq('seguimiento_id', fila.id).order('creado_en', { ascending: false }),
      supabase.from('historial').select('id, accion, cambios, autor_id, fecha, deshecho').eq('tabla', 'seguimiento').eq('fila_id', fila.id).order('fecha', { ascending: false }),
      supabase.from('perfiles').select('id, nombre'),
    ])
    const fallo = c.error ?? h.error ?? p.error
    if (fallo) throw new Error(fallo.message)
    return {
      c: (c.data ?? []) as Comentario[],
      h: (h.data ?? []) as EntradaHistorial[],
      n: Object.fromEntries(((p.data ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre])),
    }
  }, [fila.id])

  // Recarga también cuando la fila cambia desde la tabla (actualizado_en nuevo).
  useEffect(() => {
    let vivo = true
    cargar()
      .then((r) => {
        if (!vivo) return
        setComentarios(r.c)
        setHistorial(r.h)
        setNombres(r.n)
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se ha podido cargar la ficha')
      })
    return () => {
      vivo = false
    }
  }, [cargar, fila.actualizado_en])

  async function comentar(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    setOcupado(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('comentarios').insert({ seguimiento_id: fila.id, texto: t })
      if (err) throw new Error(err.message)
      setTexto('')
      const r = await cargar()
      setComentarios(r.c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el comentario')
    } finally {
      setOcupado(false)
    }
  }

  async function deshacer(id: number) {
    setOcupado(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('deshacer_cambio', { p_id: id })
      if (err) throw new Error(err.message)
      await onDeshecho(fila.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido deshacer')
    } finally {
      setOcupado(false)
    }
  }

  const pct = pctCupos(fila.usos, fila.cupos)
  const nivel = nivelAlertaCupos(fila.usos, fila.cupos, umbral)
  const fmtFechaHora = (iso: string) => textoFechaHora(iso)
  const nombre = (id: string | null) => (id ? (nombres[id] ?? 'Usuario') : 'Sistema')

  return (
    <aside className="ficha" aria-label={`Ficha de ${fila.nombre}`}>
      <div className="ficha-cabecera">
        <h2>{fila.nombre}</h2>
        <button type="button" className="boton secundario" onClick={onCerrar} aria-label="Cerrar ficha">Cerrar</button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <dl className="ficha-datos">
        <div><dt>Nº concesión</dt><dd>{fila.concesion_id}</dd></div>
        <div><dt>KAM</dt><dd>{fila.kam_nombre ?? '—'}</dd></div>
        <div><dt>Territorio</dt><dd>{fila.territorio ?? '—'}</dd></div>
        <div><dt>Estado</dt><dd>{ETIQUETA_ESTADO[fila.estado]}</dd></div>
        <div><dt>SMS / Email</dt><dd>{ETIQUETA_ENVIO[fila.sms]} / {ETIQUETA_ENVIO[fila.email]}</dd></div>
        <div><dt>Usos / Cupos</dt><dd>{fila.usos ?? '—'} / {fila.cupos ?? '—'}</dd></div>
      </dl>
      <div className="cupos">
        <div className="cupos-texto">
          <span>Cupos usados</span>
          <strong className={nivel ? `alerta-${nivel}-texto` : undefined}>
            {nivel === 'agotado' ? '⚠ ' : ''}{textoPctCupos(fila.usos, fila.cupos)}
          </strong>
        </div>
        <div
          className="barra"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct == null ? 0 : Math.min(100, Math.round(pct * 100))}
        >
          <div className={`barra-relleno ${nivel ? `alerta-${nivel}-barra` : ''}`} style={{ width: `${pct == null ? 0 : Math.min(100, pct * 100)}%` }} />
        </div>
      </div>
      <p><Link to={`/concesion/${fila.concesion_id}`}>Ver todas sus promociones</Link></p>

      <section>
        <h3>Comentarios</h3>
        {editable ? (
          <form onSubmit={comentar} className="comentar">
            <textarea
              aria-label="Nuevo comentario"
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe un comentario…"
            />
            <button type="submit" className="boton" disabled={ocupado || !texto.trim()}>Añadir</button>
          </form>
        ) : (
          <p className="nota">Solo lectura: no tienes permiso para comentar en esta fila.</p>
        )}
        {comentarios.length === 0 ? (
          <p className="nota">Sin comentarios.</p>
        ) : (
          <ul className="lista-ficha">
            {comentarios.map((c) => (
              <li key={c.id}>
                <div className="meta">{nombre(c.autor_id)} · {fmtFechaHora(c.creado_en)}</div>
                <div>{c.texto}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Historial</h3>
        {historial.length === 0 ? (
          <p className="nota">Sin cambios registrados.</p>
        ) : (
          <ul className="lista-ficha">
            {historial.map((h) => {
              const puede = h.accion === 'update' && !h.deshecho && (esAdmin || h.autor_id === perfilId)
              return (
                <li key={h.id} className={h.deshecho ? 'deshecho' : undefined}>
                  <div className="meta">
                    {nombre(h.autor_id)} · {fmtFechaHora(h.fecha)}
                    {h.deshecho && ' · deshecho'}
                  </div>
                  {h.accion === 'insert' ? (
                    <div>Fila creada</div>
                  ) : (
                    Object.entries(h.cambios).map(([campo, v]) => (
                      <div key={campo}>
                        {ETIQUETA_CAMPO[campo] ?? campo}: {textoValor(campo, v.antes)} → {textoValor(campo, v.despues)}
                      </div>
                    ))
                  )}
                  {puede && (
                    <button type="button" className="boton secundario pequeno" disabled={ocupado} onClick={() => deshacer(h.id)}>
                      Deshacer
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </aside>
  )
}
