import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/supabase', () => ({ supabase: { from } }))

import FormPromocion from '../../src/app/admin/FormPromocion'

function montar() {
  return render(
    <MemoryRouter initialEntries={['/admin/promociones/nueva']}>
      <Routes>
        <Route path="/admin/promociones/nueva" element={<FormPromocion />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FormPromocion', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('con espacio TMICC la marca está deshabilitada y vale TMICC; en Campañas se puede elegir', () => {
    montar()
    const marca = screen.getByLabelText('Marca') as HTMLSelectElement
    fireEvent.change(screen.getByLabelText('Espacio'), { target: { value: 'TMICC' } })
    expect(marca).toBeDisabled()
    expect(marca.value).toBe('TMICC')
    fireEvent.change(screen.getByLabelText('Espacio'), { target: { value: 'CAMPANAS' } })
    expect(marca).toBeEnabled()
    fireEvent.change(marca, { target: { value: 'UFS' } })
    expect(marca.value).toBe('UFS')
    fireEvent.change(screen.getByLabelText('Espacio'), { target: { value: 'TMICC' } })
    expect(marca.value).toBe('TMICC')
    expect(marca).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Espacio'), { target: { value: 'UFS' } })
    expect(marca.value).toBe('UFS')
    expect(marca).toBeDisabled()
  })

  it('publicar sin fechas muestra qué falta y no llama al cliente', () => {
    montar()
    fireEvent.change(screen.getByLabelText('TAG'), { target: { value: 'X1' } })
    fireEvent.change(screen.getByLabelText('Mecánica'), { target: { value: '2x1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Para publicar faltan: fecha de inicio, fecha de fin',
    )
    expect(from).not.toHaveBeenCalled()
  })
})
