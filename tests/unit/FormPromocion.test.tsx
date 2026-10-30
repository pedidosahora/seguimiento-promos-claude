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
    fireEvent.change(screen.getByLabelText('TAG *'), { target: { value: 'X1' } })
    fireEvent.change(screen.getByLabelText('Mecánica *'), { target: { value: '2x1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Para publicar faltan: fecha de inicio, fecha de fin',
    )
    expect(from).not.toHaveBeenCalled()
  })

  it('agrupa los campos en cuatro bloques con leyenda y marca los obligatorios', () => {
    const { container } = montar()
    const leyendas = Array.from(container.querySelectorAll('fieldset > legend')).map((l) => l.textContent)
    expect(leyendas).toEqual(['Identificación', 'Contenido', 'Fechas', 'Cupos'])
    expect(screen.getByLabelText('TAG *')).toBeInTheDocument()
    expect(screen.getByLabelText('Mecánica *')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de inicio *')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de fin *')).toBeInTheDocument()
    expect(screen.getByText('* Necesario para publicar')).toBeInTheDocument()
  })

  it('guarda con los mismos datos', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'n1' }, error: null })
    const insert = vi.fn(() => ({ select: () => ({ single }) }))
    from.mockReturnValue({ insert })
    render(
      <MemoryRouter initialEntries={['/admin/promociones/nueva']}>
        <Routes>
          <Route path="/admin/promociones/nueva" element={<FormPromocion />} />
          <Route path="/admin/promociones/:id" element={<p>editada</p>} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText('TAG *'), { target: { value: ' X1 ' } })
    fireEvent.change(screen.getByLabelText('Mecánica *'), { target: { value: '2x1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('editada')
    expect(insert).toHaveBeenCalledWith({
      tag: 'X1', espacio: 'TMICC', marca: 'TMICC', mecanica: '2x1', objetivo: null, canal: null,
      fecha_inicio: null, fecha_fin: null, umbral_cupos: 0.8, revision_cupos: 'ninguna', estado: 'borrador',
    })
  })
})
