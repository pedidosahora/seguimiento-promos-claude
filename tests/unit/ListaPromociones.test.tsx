import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const estadoMock = vi.hoisted(() => ({ rechazar: false }))

const promociones = [
  {
    id: 'p1', tag: 'TMICC-VIEJA', espacio: 'TMICC', marca: 'TMICC', mecanica: '2x1',
    fecha_inicio: '2020-01-01', fecha_fin: '2020-02-01', estado: 'publicada',
  },
  {
    id: 'p2', tag: 'CAMP-FUTURA', espacio: 'CAMPANAS', marca: 'UFS', mecanica: '10% dto',
    fecha_inicio: '2090-01-01', fecha_fin: '2099-12-31', estado: 'publicada',
  },
]
const resumen = [
  { promocion_id: 'p1', presentadas: '4', pct_aceptacion: '0.5', activas: '1', usos: '10', gsv: '120.50' },
  { promocion_id: 'p2', presentadas: '3', pct_aceptacion: null, activas: '0', usos: '0', gsv: '0' },
]

vi.mock('../../src/lib/supabase', () => {
  const construir = (tabla: string) => {
    const resultado = { data: tabla === 'promociones' ? promociones : resumen, error: null }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in']) b[m] = () => b
    b.then = (ok: (r: typeof resultado) => unknown, ko?: (e: unknown) => unknown) =>
      (estadoMock.rechazar ? Promise.reject(new Error('red caída')) : Promise.resolve(resultado)).then(ok, ko)
    return b
  }
  return { supabase: { from: construir } }
})

import ListaPromociones from '../../src/app/promociones/ListaPromociones'
import { SesionContext } from '../../src/app/auth/useSesion'

function montar(rol: 'admin' | 'kam', ruta: string) {
  const perfil = { id: 'u1', user_id: 'x', email: 'a@pro.agency', nombre: 'A', rol, activo: true }
  return render(
    <SesionContext.Provider value={{ cargando: false, perfil }}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/:espacio" element={<ListaPromociones />} />
        </Routes>
      </MemoryRouter>
    </SesionContext.Provider>,
  )
}

describe('ListaPromociones', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    cleanup()
    estadoMock.rechazar = false
  })

  it('admin ve la insignia Vencida', async () => {
    montar('admin', '/todos')
    await waitFor(() => expect(screen.getByText('TMICC-VIEJA')).toBeInTheDocument())
    expect(screen.getAllByText('Vencida')).toHaveLength(1)
  })

  it('kam no ve la insignia Vencida', async () => {
    montar('kam', '/todos')
    await waitFor(() => expect(screen.getByText('TMICC-VIEJA')).toBeInTheDocument())
    expect(screen.queryByText('Vencida')).not.toBeInTheDocument()
  })

  it('en /todos muestra la columna Espacio con Campañas', async () => {
    montar('kam', '/todos')
    await waitFor(() => expect(screen.getByText('CAMP-FUTURA')).toBeInTheDocument())
    expect(screen.getByRole('columnheader', { name: 'Espacio' })).toBeInTheDocument()
    expect(screen.getByText('Campañas')).toBeInTheDocument()
  })

  it('si la carga falla muestra el error y deja de cargar', async () => {
    estadoMock.rechazar = true
    montar('kam', '/todos')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('red caída'))
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })
})
