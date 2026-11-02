import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import FiltrosAnalisis from '../../src/app/analisis/FiltrosAnalisis'
import type { Filtros } from '../../src/analisis/agregar'

const base: Filtros = {
  espacio: null, marca: null, estados: ['publicada', 'cerrada'], desde: null, hasta: null,
  kamId: null, territorio: null, soloKamId: null,
}
const montar = (f: Partial<Filtros>, puedeSoloMias = true) =>
  render(<FiltrosAnalisis filtros={{ ...base, ...f }} onCambio={() => {}} filas={[]} puedeSoloMias={puedeSoloMias} miId="k1" />)

describe('FiltrosAnalisis', () => {
  afterEach(cleanup)

  it('con «Solo mis concesiones» el select KAM queda deshabilitado con pista', () => {
    montar({ soloKamId: 'k1' })
    const kam = screen.getByLabelText('KAM')
    expect(kam).toBeDisabled()
    expect(kam).toHaveAttribute('title', expect.stringContaining('Solo mis concesiones'))
  })

  it('sin «Solo mis concesiones» el select KAM está activo', () => {
    montar({})
    expect(screen.getByLabelText('KAM')).toBeEnabled()
  })

  it('avisa si «desde» es posterior a «hasta»', () => {
    montar({ desde: '2026-10-10', hasta: '2026-10-01' })
    expect(screen.getByText('La fecha "desde" es posterior a "hasta"')).toBeInTheDocument()
  })

  it('sin aviso con fechas coherentes o incompletas', () => {
    montar({ desde: '2026-10-01', hasta: '2026-10-10' })
    expect(screen.queryByText(/posterior a/)).not.toBeInTheDocument()
    cleanup()
    montar({ desde: '2026-10-01' })
    expect(screen.queryByText(/posterior a/)).not.toBeInTheDocument()
  })
})
