import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../../src/importar/leerExcel', () => ({
  leerHoja: () => [
    ['ID', 'CONCESION', 'KAM PRO', 'TERRITORIO'],
    [9100, 'Alfa SL', 'Ana', 'Norte'],
  ],
}))

import Importar from '../../src/app/importar/Importar'

function archivo() {
  const f = new File([new Uint8Array([1])], 'x.xlsx')
  // jsdom no implementa File.arrayBuffer
  ;(f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () => Promise.resolve(new ArrayBuffer(1))
  return f
}

describe('Importar', () => {
  afterEach(() => {
    cleanup()
    rpc.mockReset()
  })

  it('no muestra Confirmar hasta que llega la vista previa', async () => {
    let resolver: (v: unknown) => void = () => undefined
    rpc.mockReturnValue(new Promise((r) => (resolver = r)))
    render(<MemoryRouter><Importar /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Arrastra el Excel/), { target: { files: [archivo()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }))
    await screen.findByText(/Analizando/)
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    resolver({ data: { crear: 1, actualizar: 0, sin_cambios: 0, errores: [] }, error: null })
    expect(await screen.findByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('muestra el error de la base de datos tal cual', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Solo un administrador puede importar' } })
    render(<MemoryRouter><Importar /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/Arrastra el Excel/), { target: { files: [archivo()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Solo un administrador puede importar'))
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('muestra la ayuda del tipo elegido', () => {
    render(<MemoryRouter><Importar /></MemoryRouter>)
    expect(screen.getByText('Excel con columnas ID, CONCESION, KAM PRO, TERRITORIO')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de importación'), { target: { value: 'usos' } })
    expect(
      screen.getByText('Exportación de la plataforma con Id, Concesión, Tag, Usos, GSV y Fecha actualización'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de importación'), { target: { value: 'historico' } })
    expect(
      screen.getByText('Hoja de seguimiento por bloques (una promoción por bloque). Solo se lee la primera hoja del libro'),
    ).toBeInTheDocument()
  })

  it('muestra el nombre del archivo elegido y admite soltarlo', () => {
    render(<MemoryRouter><Importar /></MemoryRouter>)
    expect(screen.getByText('Arrastra el Excel aquí o pulsa para elegirlo')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Arrastra el Excel/), { target: { files: [archivo()] } })
    expect(screen.getByText('x.xlsx')).toBeInTheDocument()
    cleanup()
    render(<MemoryRouter><Importar /></MemoryRouter>)
    const zona = screen.getByText('Arrastra el Excel aquí o pulsa para elegirlo').closest('label')!
    const f = new File([new Uint8Array([1])], 'soltado.xlsx')
    fireEvent.drop(zona, { dataTransfer: { files: [f] } })
    expect(screen.getByText('soltado.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled()
  })
})
