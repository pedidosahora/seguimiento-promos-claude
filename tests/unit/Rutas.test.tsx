import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const estado = vi.hoisted(() => ({
  resultadoPerfil: {} as { data: unknown; error: unknown },
  signOut: vi.fn(() => Promise.resolve({ error: null })),
}))

vi.mock('../../src/lib/supabase', () => {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) b[m] = () => b
  b.maybeSingle = () => Promise.resolve(estado.resultadoPerfil)
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
        signOut: estado.signOut,
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => b,
    },
  }
})

import Rutas from '../../src/app/rutas'

const montar = () =>
  render(
    <MemoryRouter>
      <Rutas />
    </MemoryRouter>,
  )

describe('Rutas / sesión', () => {
  afterEach(() => {
    cleanup()
    estado.signOut.mockClear()
  })

  it('error al cargar el perfil: mensaje con Reintentar, no "sin acceso"', async () => {
    estado.resultadoPerfil = { data: null, error: { message: 'fallo de red' } }
    montar()
    await waitFor(() =>
      expect(screen.getByText('No se ha podido cargar tu perfil.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/no tiene acceso/)).not.toBeInTheDocument()
  })

  it('consulta correcta sin perfil: pantalla sin acceso', async () => {
    estado.resultadoPerfil = { data: null, error: null }
    montar()
    await waitFor(() =>
      expect(
        screen.getByText('Tu cuenta no tiene acceso. Pide alta a administración'),
      ).toBeInTheDocument(),
    )
  })

  it('la pantalla de error de perfil tiene Salir que cierra sesión', async () => {
    estado.resultadoPerfil = { data: null, error: { message: 'fallo de red' } }
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    expect(estado.signOut).toHaveBeenCalledTimes(1)
  })

  it('la pantalla sin acceso tiene Salir que cierra sesión', async () => {
    estado.resultadoPerfil = { data: null, error: null }
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    expect(estado.signOut).toHaveBeenCalledTimes(1)
  })
})
