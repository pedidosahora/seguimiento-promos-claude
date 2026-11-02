import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import VistaPrevia, { type PromoPrevia } from '../../src/app/importar/VistaPrevia'

const promociones: PromoPrevia[] = [
  { tag: 'MISMA', accion: 'ya_existe', filas: 2, concesiones_nuevas: [], espacio: 'TMICC' },
  { tag: 'OTRA', accion: 'ya_existe', filas: 2, concesiones_nuevas: [], espacio: 'UFS' },
]

describe('VistaPrevia del histórico', () => {
  afterEach(cleanup)

  it('indica el espacio de las existentes y no deja actualizar las de otro espacio', () => {
    render(
      <VistaPrevia conteos={[]} incidencias={[]} etiquetas={{}} promociones={promociones} espacioActual="TMICC" />,
    )
    expect(screen.getByText('Ya existe (en TMICC)')).toBeInTheDocument()
    expect(screen.getByText('Ya existe (en UFS)')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Actualizar MISMA' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Actualizar OTRA' })).not.toBeInTheDocument()
    expect(screen.getByText(/no se actualizará desde TMICC/)).toBeInTheDocument()
  })
})

describe('VistaPrevia conteos', () => {
  afterEach(cleanup)

  it('los conteos usan su propia lista y separador de miles', () => {
    const { container } = render(
      <VistaPrevia conteos={[{ clave: 'x', etiqueta: 'Filas', n: 12345 }]} incidencias={[]} etiquetas={{}} />,
    )
    const dl = container.querySelector('dl.conteos')!
    expect(dl.className).not.toContain('indicadores')
    expect(dl.textContent).toContain('12.345')
  })
})

describe('VistaPrevia ordenable', () => {
  afterEach(cleanup)

  const incidencias = [
    { fila: 9, categoria: 'b', detalle: 'segunda' },
    { fila: 3, categoria: 'a', detalle: 'primera' },
    { fila: 5, categoria: 'a', detalle: 'tercera' },
  ]
  const primera = () => within(screen.getAllByRole('row')[1])

  it('incidencias: orden por defecto por nº de fila y reordenables', () => {
    render(<VistaPrevia conteos={[]} incidencias={incidencias} etiquetas={{ a: 'Aaa', b: 'Bbb' }} />)
    expect(primera().getByText('primera')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Fila/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Fila/ }))
    expect(primera().getByText('segunda')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Detalle/ }))
    expect(primera().getByText('primera')).toBeInTheDocument()
  })

  it('promociones: ordenan por TAG', () => {
    const promos: PromoPrevia[] = [
      { tag: 'ZETA', accion: 'crear', filas: 1, concesiones_nuevas: [] },
      { tag: 'ALFA', accion: 'crear', filas: 5, concesiones_nuevas: [1, 2] },
    ]
    render(<VistaPrevia conteos={[]} incidencias={[]} etiquetas={{}} promociones={promos} />)
    expect(primera().getByText('ZETA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^TAG/ }))
    expect(primera().getByText('ALFA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Filas/ }))
    expect(primera().getByText('ZETA')).toBeInTheDocument()
  })
})
