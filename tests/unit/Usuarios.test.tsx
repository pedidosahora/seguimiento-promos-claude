import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const perfiles = vi.hoisted(() => [
  { id: 'yo', email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin', activo: true },
  { id: 'otra', email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam', activo: true },
])

vi.mock('../../src/lib/supabase', () => {
  const resultado = { data: perfiles, error: null }
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'order']) b[m] = () => b
  b.then = (ok: (r: typeof resultado) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, ko)
  return { supabase: { from: () => b } }
})

import Usuarios from '../../src/app/admin/Usuarios'
import { SesionContext } from '../../src/app/auth/useSesion'

function montar() {
  const perfil = { id: 'yo', user_id: 'x', email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' as const, activo: true }
  return render(
    <SesionContext.Provider value={{ cargando: false, perfil }}>
      <Usuarios />
    </SesionContext.Provider>,
  )
}

describe('Usuarios', () => {
  afterEach(cleanup)

  it('al editarse a sí mismo no puede cambiar rol ni desactivarse', async () => {
    montar()
    await waitFor(() => expect(screen.getByText('Adm')).toBeInTheDocument())
    const editar = screen.getAllByRole('button', { name: 'Editar' })
    fireEvent.click(editar[0])
    expect(screen.getByLabelText('Rol')).toBeDisabled()
    expect(screen.getByLabelText('Activo')).toBeDisabled()
    expect(screen.getByText(/No puedes cambiar tu propio rol/)).toBeInTheDocument()
  })

  it('al editar a otra persona los controles siguen activos', async () => {
    montar()
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])
    expect(screen.getByLabelText('Rol')).toBeEnabled()
    expect(screen.getByLabelText('Activo')).toBeEnabled()
    expect(screen.queryByText(/No puedes cambiar tu propio rol/)).not.toBeInTheDocument()
  })
})
