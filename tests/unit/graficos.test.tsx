import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import BarrasHorizontales from '../../src/app/analisis/BarrasHorizontales'
import BarrasMensuales from '../../src/app/analisis/BarrasMensuales'
import Indicadores from '../../src/app/analisis/Indicadores'
import type { Metricas } from '../../src/analisis/agregar'

afterEach(cleanup)
const f = (v: number | null) => (v == null ? '—' : `${v} u`)

describe('BarrasHorizontales', () => {
  const datos = [
    { etiqueta: 'B', valor: 5 },
    { etiqueta: 'A', valor: 10 },
    { etiqueta: 'N', valor: null },
    { etiqueta: 'C', valor: 2 },
  ]

  it('ordena desc, excluye nulos y limita a max', () => {
    const { container } = render(<BarrasHorizontales datos={datos} formato={f} titulo="T" max={2} />)
    const filas = container.querySelectorAll('.barra-fila')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveAttribute('title', 'A: 10 u')
    expect(filas[1]).toHaveAttribute('title', 'B: 5 u')
  })

  it('valor directo solo en la mayor; ancho proporcional', () => {
    const { container } = render(<BarrasHorizontales datos={datos} formato={f} titulo="T" max={15} />)
    expect(container.querySelectorAll('.barra-valor')).toHaveLength(1)
    expect(screen.getByText('10 u')).toBeInTheDocument()
    const rellenos = container.querySelectorAll<HTMLElement>('.barra-relleno')
    expect(rellenos[0].style.width).toBe('100%')
    expect(rellenos[1].style.width).toBe('50%')
  })

  it('aria-label resumen', () => {
    render(<BarrasHorizontales datos={datos} formato={f} titulo="Usos" max={15} />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Usos: 3 grupos; mayor A 10 u')
  })

  it('vacío muestra mensaje', () => {
    render(<BarrasHorizontales datos={[{ etiqueta: 'x', valor: null }]} formato={f} titulo="T" max={15} />)
    expect(screen.getByText('No hay datos con estos filtros')).toBeInTheDocument()
  })
})

describe('BarrasMensuales', () => {
  const datos = [
    { mes: '2026-03', etiqueta: 'mar 26', valor: 5 },
    { mes: '2026-01', etiqueta: 'ene 26', valor: 10 },
    { mes: '2026-02', etiqueta: 'feb 26', valor: 0 },
  ]

  it('una barra por mes en orden cronológico con tooltip', () => {
    const { container } = render(<BarrasMensuales datos={datos} formato={f} titulo="Mes" />)
    const cols = container.querySelectorAll('.mes-col')
    expect(cols).toHaveLength(3)
    expect(Array.from(cols).map((c) => c.querySelector('title')?.textContent)).toEqual([
      'ene 26: 10 u',
      'feb 26: 0 u',
      'mar 26: 5 u',
    ])
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Mes: 3 meses; mayor ene 26 10 u')
  })

  it('alturas proporcionales', () => {
    const { container } = render(<BarrasMensuales datos={datos} formato={f} titulo="Mes" />)
    const h = Array.from(container.querySelectorAll('.mes-barra')).map((b) => Number(b.getAttribute('data-altura')))
    expect(h[1]).toBe(0)
    expect(h[2] / h[0]).toBeCloseTo(0.5)
    expect(h[0]).toBeGreaterThan(0)
  })

  it('vacío muestra mensaje', () => {
    render(<BarrasMensuales datos={[]} formato={f} titulo="Mes" />)
    expect(screen.getByText('No hay datos con estos filtros')).toBeInTheDocument()
  })
})

describe('Indicadores', () => {
  const m: Metricas = {
    promociones: 4, convocadas: 1200, presentadas: 3, aceptadas: 2, activas: 2, pendientes: 1, rechazadas: 0,
    pctAceptacion: 0.84, pctActivacion: null, cupos: 10, usos: 5, pctCupos: 0.5, gsv: 1234.5, gsvUso: null,
  }
  it('muestra los 8 valores formateados y — para nulos', () => {
    const { container } = render(<Indicadores m={m} />)
    expect(container.querySelectorAll('dd')).toHaveLength(8)
    expect(screen.getByText('1.200')).toBeInTheDocument()
    expect(screen.getByText('84 %')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('50 %')).toBeInTheDocument()
    expect(screen.getByText(/1\.234,50/)).toBeInTheDocument()
  })
})
