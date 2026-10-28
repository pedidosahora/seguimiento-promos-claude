import { cleanup, render, screen } from '@testing-library/react'
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
