import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const estado = vi.hoisted(() => ({ cargas: 0 }))

vi.mock('../../src/lib/supabase', () => {
  const promo = {
    id: 'p1', tag: 'T1', espacio: 'TMICC', mecanica: 'm', fecha_inicio: '2026-01-01',
    fecha_fin: '2026-02-01', estado: 'publicada', umbral_cupos: '0.80',
  }
  const fila = {
    id: 'f1', promocion_id: 'p1', concesion_id: 9100, estado: 'pendiente', fecha_aceptacion: null,
    fecha_activacion: null, cupos: 10, usos: 0, gsv: 0, fecha_dato: null, sms: 'pending',
    email: 'pending', actualizado_en: '2026-10-01T10:00:00Z',
    concesiones: { razon_social: 'Alfa SL', nombre_comercial: 'Alfa', kam_id: 'u1', territorios: null, kam: null },
  }
  const construir = (tabla: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) b[m] = () => b
    b.maybeSingle = () =>
      Promise.resolve({ data: tabla === 'promociones' ? promo : { convocadas: 1, presentadas: 1, usos: 0, gsv: 0 }, error: null })
    b.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (tabla === 'seguimiento') estado.cargas += 1
      return Promise.resolve({ data: [fila], error: null }).then(ok, ko)
    }
    return b
  }
  return { supabase: { from: construir, rpc: () => Promise.resolve({ data: [9100], error: null }) } }
})

vi.mock('../../src/app/promocion/servicio', async (original) => {
  const real = await original<typeof import('../../src/app/promocion/servicio')>()
  return {
    ...real,
    guardarFila: vi.fn(() => Promise.reject(new real.ConflictoError('Esta fila ha cambiado; recarga'))),
  }
})

// La tabla AG Grid no es el objeto de esta prueba: un stub dispara la edición.
vi.mock('../../src/app/promocion/TablaSeguimiento', () => ({
  default: ({ filas, onEditar }: { filas: { id: string }[]; onEditar: (f: unknown, c: string, v: unknown) => void }) => (
    <button onClick={() => onEditar(filas[0], 'estado', 'acepta')}>editar</button>
  ),
}))

import Promocion from '../../src/app/promocion/Promocion'
import { SesionContext } from '../../src/app/auth/useSesion'

describe('Promocion', () => {
  afterEach(cleanup)

  it('el aviso de conflicto sigue visible tras la recarga', async () => {
    const perfil = { id: 'u1', user_id: 'x', email: 'a@pro.agency', nombre: 'A', rol: 'kam' as const, activo: true }
    render(
      <SesionContext.Provider value={{ cargando: false, perfil }}>
        <MemoryRouter initialEntries={['/tmicc/T1']}>
          <Routes>
            <Route path="/:espacio/:tag" element={<Promocion />} />
          </Routes>
        </MemoryRouter>
      </SesionContext.Provider>,
    )
    fireEvent.click(await screen.findByText('editar'))
    await waitFor(() => expect(estado.cargas).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Esta fila ha cambiado; recarga'))
    // y sigue ahí cuando la recarga ha terminado
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('alert')).toHaveTextContent('Esta fila ha cambiado; recarga')
  })
})
