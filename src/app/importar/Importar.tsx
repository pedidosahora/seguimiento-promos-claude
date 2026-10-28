import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ETIQUETA_ESPACIO, type Espacio } from '../../dominio/etiquetas'
import { parsearConcesiones } from '../../importar/concesiones'
import { parsearHistorico } from '../../importar/historico'
import { leerHoja } from '../../importar/leerExcel'
import type { ErrorFila } from '../../importar/tipos'
import { parsearUsos } from '../../importar/usos'
import { supabase } from '../../lib/supabase'
import VistaPrevia, { type Conteo, type Incidencia, type PromoPrevia } from './VistaPrevia'

type Tipo = 'concesiones' | 'usos' | 'historico'
type Marca = 'TMICC' | 'UFS'

const TIPOS: Record<Tipo, string> = {
  concesiones: 'Catálogo de concesiones',
  usos: 'Usos y GSV',
  historico: 'Histórico de seguimiento',
}

const ETIQUETAS_INCIDENCIA: Record<string, string> = {
  archivo: 'Error en el archivo',
  servidor: 'Error de datos',
  aviso: 'Aviso',
  duplicada: 'Duplicada',
  tag_desconocido: 'TAG desconocido',
  concesion_desconocida: 'Concesión desconocida',
  no_convocada: 'No convocada',
  dato_antiguo: 'Dato más antiguo',
  aviso_no_entra: 'Aviso: no entra',
}

const ETIQUETAS_USOS: Record<string, string> = {
  actualiza: 'Se actualizarán',
  sin_cambios: 'Sin cambios',
  aviso_no_entra: 'Aviso: no entra',
  dato_antiguo: 'Datos más antiguos',
  duplicada: 'Duplicadas',
  tag_desconocido: 'TAG desconocido',
  concesion_desconocida: 'Concesión desconocida',
  no_convocada: 'No convocadas',
}

interface Previa {
  conteos: Conteo[]
  incidencias: Incidencia[]
  promociones?: PromoPrevia[]
  antiguos: number
  /** Si Confirmar escribiría algo (si no, se deshabilita). */
  hayCambios: boolean
}

type Preparado =
  | { tipo: 'concesiones'; filas: unknown[] }
  | { tipo: 'usos'; filas: { tag: string }[] }
  | { tipo: 'historico'; datos: { marca: Marca | null; promociones: unknown[] } }

interface Resultado {
  lineas: string[]
  enlaces: { to: string; texto: string }[]
}

const delArchivo = (errores: ErrorFila[]): Incidencia[] =>
  errores.map((e) => ({ fila: e.fila, categoria: 'archivo', detalle: e.motivo }))

const mensaje = (e: unknown, defecto: string) => (e instanceof Error ? e.message : defecto)

export default function Importar() {
  const [tipo, setTipo] = useState<Tipo>('concesiones')
  const [espacio, setEspacio] = useState<Espacio>('TMICC')
  const [marca, setMarca] = useState<Marca | ''>('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [trabajando, setTrabajando] = useState<'previa' | 'aplicar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preparado, setPreparado] = useState<Preparado | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [incluirAntiguos, setIncluirAntiguos] = useState(false)
  const [actualizar, setActualizar] = useState<Set<string>>(new Set())
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const necesitaMarca = tipo === 'historico' && espacio === 'CAMPANAS'
  const puedePrevisualizar = !!archivo && trabajando === null && (!necesitaMarca || marca !== '')

  async function previsualizar() {
    if (!archivo) return
    setTrabajando('previa')
    setError(null)
    try {
      const aoa = leerHoja(await archivo.arrayBuffer())
      if (tipo === 'concesiones') {
        const { filas, errores } = parsearConcesiones(aoa)
        const { data, error: err } = await supabase.rpc('importar_concesiones', { filas, aplicar: false })
        if (err) throw new Error(err.message)
        const r = data as { crear: number; actualizar: number; sin_cambios: number; errores: ErrorFila[] }
        setPreparado({ tipo, filas })
        setPrevia({
          conteos: [
            { clave: 'crear', etiqueta: 'Se crearán', n: r.crear },
            { clave: 'actualizar', etiqueta: 'Se actualizarán', n: r.actualizar },
            { clave: 'sin_cambios', etiqueta: 'Sin cambios', n: r.sin_cambios },
            { clave: 'errores', etiqueta: 'Con error', n: errores.length + r.errores.length },
          ],
          incidencias: [
            ...delArchivo(errores),
            ...r.errores.map((e) => ({ fila: e.fila, categoria: 'servidor', detalle: e.motivo })),
          ],
          antiguos: 0,
          hayCambios: r.crear + r.actualizar > 0,
        })
      } else if (tipo === 'usos') {
        const { filas, errores } = parsearUsos(aoa)
        const { data, error: err } = await supabase.rpc('previsualizar_usos', { filas })
        if (err) throw new Error(err.message)
        const r = data as {
          conteos: Record<string, number>
          detalle: { fila: number; categoria: string; detalle: string }[]
        }
        const n = (c: string) => r.conteos[c] ?? 0
        setPreparado({ tipo, filas })
        setPrevia({
          conteos: [
            ...Object.entries(r.conteos).map(([clave, v]) => ({
              clave, etiqueta: ETIQUETAS_USOS[clave] ?? clave, n: v,
            })),
            { clave: 'errores', etiqueta: 'Con error en el archivo', n: errores.length },
          ],
          incidencias: [
            ...delArchivo(errores),
            ...r.detalle.map((d) => ({ fila: d.fila, categoria: d.categoria, detalle: d.detalle })),
          ],
          antiguos: n('dato_antiguo'),
          hayCambios: n('actualiza') + n('aviso_no_entra') + n('dato_antiguo') > 0,
        })
        setIncluirAntiguos(false)
      } else {
        const { promociones, errores } = parsearHistorico(aoa)
        const datos = { marca: necesitaMarca ? marca || null : null, promociones }
        const { data, error: err } = await supabase.rpc('previsualizar_historico', { datos, p_espacio: espacio })
        if (err) throw new Error(err.message)
        const r = data as {
          promociones: PromoPrevia[]
          totales: { crear: number; ya_existe: number; filas: number; concesiones_nuevas: number }
        }
        setPreparado({ tipo, datos })
        setPrevia({
          conteos: [
            { clave: 'crear', etiqueta: 'Promociones a crear', n: r.totales.crear },
            { clave: 'ya_existe', etiqueta: 'Ya existen', n: r.totales.ya_existe },
            { clave: 'filas', etiqueta: 'Filas', n: r.totales.filas },
            { clave: 'conc', etiqueta: 'Concesiones nuevas', n: r.totales.concesiones_nuevas },
            { clave: 'errores', etiqueta: 'Con error en el archivo', n: errores.length },
          ],
          incidencias: [
            ...delArchivo(errores),
            ...r.promociones
              .filter((p) => p.aviso)
              .map((p) => ({ fila: null, categoria: 'aviso', detalle: `${p.tag}: ${p.aviso}` })),
          ],
          promociones: r.promociones,
          antiguos: 0,
          hayCambios: r.totales.crear > 0 || r.totales.ya_existe > 0,
        })
        setActualizar(new Set())
      }
      setPaso(2)
    } catch (e) {
      setError(mensaje(e, 'No se ha podido analizar el archivo'))
    } finally {
      setTrabajando(null)
    }
  }

  async function confirmar() {
    if (!preparado) return
    setTrabajando('aplicar')
    setError(null)
    try {
      if (preparado.tipo === 'concesiones') {
        const { data, error: err } = await supabase.rpc('importar_concesiones', {
          filas: preparado.filas, aplicar: true,
        })
        if (err) throw new Error(err.message)
        const r = data as { crear: number; actualizar: number; sin_cambios: number; errores: unknown[] }
        setResultado({
          lineas: [
            `${r.crear} concesiones creadas`,
            `${r.actualizar} actualizadas`,
            `${r.sin_cambios} sin cambios`,
            `${r.errores.length} con error (no importadas)`,
          ],
          enlaces: [{ to: '/admin/concesiones', texto: 'Ver concesiones' }],
        })
      } else if (preparado.tipo === 'usos') {
        const { data, error: err } = await supabase.rpc('aplicar_usos', {
          filas: preparado.filas, incluir_antiguos: incluirAntiguos,
        })
        if (err) throw new Error(err.message)
        const r = data as { aplicadas: number }
        // Enlaces a las promociones del archivo que existen (si la consulta falla, solo se omiten).
        const tags = [...new Set(preparado.filas.map((f) => f.tag))]
        const { data: ps } = await supabase.from('promociones').select('tag, espacio').in('tag', tags)
        setResultado({
          lineas: [`${r.aplicadas} filas de seguimiento actualizadas`],
          enlaces: (ps ?? []).map((p) => ({
            to: `/${p.espacio.toLowerCase()}/${encodeURIComponent(p.tag)}`,
            texto: p.tag,
          })),
        })
      } else {
        const { data, error: err } = await supabase.rpc('aplicar_historico', {
          datos: preparado.datos, p_espacio: espacio, tags_actualizar: [...actualizar],
        })
        if (err) throw new Error(err.message)
        const r = data as { creadas: number; actualizadas: number; omitidas: number; concesiones_creadas: number }
        setResultado({
          lineas: [
            `${r.creadas} promociones creadas`,
            `${r.actualizadas} actualizadas`,
            `${r.omitidas} omitidas (ya existían)`,
            `${r.concesiones_creadas} concesiones creadas (inactivas)`,
          ],
          enlaces: [{ to: `/${espacio.toLowerCase()}`, texto: `Ver promociones de ${ETIQUETA_ESPACIO[espacio]}` }],
        })
      }
      setPaso(3)
    } catch (e) {
      setError(mensaje(e, 'No se ha podido aplicar la importación'))
    } finally {
      setTrabajando(null)
    }
  }

  function reiniciar() {
    setPaso(1)
    setArchivo(null)
    setPreparado(null)
    setPrevia(null)
    setResultado(null)
    setError(null)
  }

  return (
    <section>
      <h1>Importar</h1>
      <p className="nota">Paso {paso} de 3</p>

      {paso === 1 && (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault()
            void previsualizar()
          }}
        >
          <label>
            Tipo de importación
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {(Object.keys(TIPOS) as Tipo[]).map((t) => (
                <option key={t} value={t}>{TIPOS[t]}</option>
              ))}
            </select>
          </label>
          {tipo === 'historico' && (
            <label>
              Espacio
              <select value={espacio} onChange={(e) => setEspacio(e.target.value as Espacio)}>
                {(Object.keys(ETIQUETA_ESPACIO) as Espacio[]).map((s) => (
                  <option key={s} value={s}>{ETIQUETA_ESPACIO[s]}</option>
                ))}
              </select>
            </label>
          )}
          {necesitaMarca && (
            <label>
              Marca
              <select value={marca} onChange={(e) => setMarca(e.target.value as Marca | '')}>
                <option value="">Elige una marca</option>
                <option value="TMICC">TMICC</option>
                <option value="UFS">UFS</option>
              </select>
            </label>
          )}
          <label>
            Archivo
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>
          <div className="acciones">
            <button type="submit" className="boton" disabled={!puedePrevisualizar}>Previsualizar</button>
            {trabajando === 'previa' && <span className="nota">Analizando…</span>}
          </div>
        </form>
      )}

      {paso === 2 && previa && (
        <>
          <VistaPrevia
            conteos={previa.conteos}
            incidencias={previa.incidencias}
            etiquetas={ETIQUETAS_INCIDENCIA}
            promociones={previa.promociones}
            actualizar={actualizar}
            onActualizar={(tag, marcado) =>
              setActualizar((prev) => {
                const s = new Set(prev)
                if (marcado) s.add(tag)
                else s.delete(tag)
                return s
              })
            }
            antiguos={
              tipo === 'usos'
                ? { n: previa.antiguos, incluir: incluirAntiguos, onCambio: setIncluirAntiguos }
                : undefined
            }
          />
          <div className="acciones">
            <button type="button" className="boton secundario" onClick={reiniciar} disabled={trabajando !== null}>
              Volver
            </button>
            <button
              type="button"
              className="boton"
              onClick={() => void confirmar()}
              disabled={trabajando !== null || !previa.hayCambios}
            >
              Confirmar
            </button>
            {trabajando === 'aplicar' && <span className="nota">Importando…</span>}
          </div>
        </>
      )}

      {paso === 3 && resultado && (
        <div>
          <h2>Importación completada</h2>
          <ul>
            {resultado.lineas.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {resultado.enlaces.length > 0 && (
            <p>
              {resultado.enlaces.map((e, i) => (
                <span key={e.to}>
                  {i > 0 && ' · '}
                  <Link to={e.to}>{e.texto}</Link>
                </span>
              ))}
            </p>
          )}
          <button type="button" className="boton secundario" onClick={reiniciar}>Nueva importación</button>
        </div>
      )}

      {error && <p role="alert" className="error">{error}</p>}
    </section>
  )
}
