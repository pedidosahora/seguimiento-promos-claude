import { useEffect, useRef, useState } from 'react'
import { SIN_DATOS } from './BarrasHorizontales'

type Dato = { mes: string; etiqueta: string; valor: number }

type Props = {
  datos: Dato[]
  formato: (v: number | null) => string
  titulo: string
}

const COL_MIN = 52
const COL_MAX = 120
const ANCHO_MIN_BARRA = 22
const ANCHO_DEF = 720
const ALTO = 150
const ARRIBA = 24
const BASE = ARRIBA + ALTO
const TOTAL_ALTO = BASE + 26
const R = 4

// Barra con las esquinas superiores redondeadas y la base recta sobre la línea base.
function trazo(x: number, h: number, ancho: number): string {
  if (h <= 0) return ''
  const r = Math.min(R, h, ancho / 2)
  const y = BASE - h
  return `M${x},${BASE} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${BASE} Z`
}

/** «ago 2026» → «ago 26» para que las etiquetas no se junten. */
const corta = (e: string) => e.replace(/\s(\d{2})(\d{2})$/, ' $2')

function useAncho() {
  const ref = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(ANCHO_DEF)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const w = el.clientWidth
      if (w > 0) setAncho(w)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ancho }
}

export default function BarrasMensuales({ datos, formato, titulo }: Props) {
  const { ref, ancho: contenedor } = useAncho()
  // El contenedor medido se renderiza siempre, para que el observador se enganche aunque empiece vacío.
  if (datos.length === 0) {
    return (
      <div className="grafico barras-v" ref={ref}>
        <p className="grafico-vacio">{SIN_DATOS}</p>
      </div>
    )
  }
  const meses = [...datos].sort((a, b) => a.mes.localeCompare(b.mes))
  const mayor = meses.reduce((a, b) => (b.valor > a.valor ? b : a), meses[0])
  const tope = mayor.valor > 0 ? mayor.valor : 1
  const n = meses.length
  const col = Math.max(COL_MIN, Math.min(COL_MAX, contenedor / n))
  const ancho = Math.max(contenedor, n * col)
  const inicio = (ancho - n * col) / 2
  const barra = Math.max(ANCHO_MIN_BARRA, Math.min(28, col * 0.5))
  return (
    <div className="grafico barras-v" ref={ref}>
      <svg
        viewBox={`0 0 ${ancho} ${TOTAL_ALTO}`}
        width={ancho}
        height={TOTAL_ALTO}
        role="img"
        aria-label={`${titulo}: ${n} meses; mayor ${mayor.etiqueta} ${formato(mayor.valor)}`}
      >
        <line className="eje-linea" x1={0} x2={ancho} y1={BASE} y2={BASE} />
        <line className="eje-rejilla" x1={0} x2={ancho} y1={BASE - ALTO} y2={BASE - ALTO} />
        {meses.map((d, i) => {
          const x0 = inicio + i * col
          const h = (d.valor / tope) * ALTO
          const x = x0 + (col - barra) / 2
          const primera = i === 0 && n > 1
          const ultima = i === n - 1 && n > 1
          const anclaje = primera ? 'start' : ultima ? 'end' : 'middle'
          const xv = primera ? x0 + 4 : ultima ? x0 + col - 4 : x0 + col / 2
          return (
            <g key={d.mes} className="mes-col">
              <title>{`${d.etiqueta}: ${formato(d.valor)}`}</title>
              <rect className="mes-zona" x={x0} y={0} width={col} height={TOTAL_ALTO} fill="transparent" />
              <path className="mes-barra" d={trazo(x, h, barra)} data-altura={h} />
              {d === mayor && (
                <text className="mes-valor" x={xv} y={BASE - h - 6} textAnchor={anclaje}>
                  {formato(d.valor)}
                </text>
              )}
              <text className="mes-etiqueta" x={x0 + col / 2} y={BASE + 16} textAnchor="middle">
                {corta(d.etiqueta)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
