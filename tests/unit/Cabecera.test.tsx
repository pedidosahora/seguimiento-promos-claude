import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Cabecera from '../../src/app/promocion/Cabecera'

describe('Cabecera', () => {
  afterEach(cleanup)

  it('muestra Activas, Pendientes y Cupos junto a los indicadores existentes', () => {
    render(
      <Cabecera
        promo={{ tag: 'T1', espacio: 'TMICC', mecanica: '2x1', fecha_inicio: null, fecha_fin: null, estado: 'publicada' }}
        indicadores={{
          convocadas: 10, presentadas: 8, activas: 3, pendientes: 2, cupos: 1500,
          pct_aceptacion: 0.5, pct_pendientes: 0.25, pct_rechazo: 0.25, pct_activacion: 0.375,
          usos: 700, gsv: 1234.5,
        }}
        pestana="todas"
        onPestana={vi.fn()}
      />,
    )
    const valor = (k: string) => screen.getByText(k).nextElementSibling?.textContent
    expect(valor('Activas')).toBe('3')
    expect(valor('Pendientes')).toBe('2')
    expect(valor('Cupos')).toBe((1500).toLocaleString('es-ES'))
    expect(valor('Convocadas')).toBe('10')
    expect(valor('% activación')).toBe('38 %')
  })
})
