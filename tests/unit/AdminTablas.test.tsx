import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const datos = vi.hoisted(() => ({
  promociones: [
    { id: 'p1', tag: 'BETA', espacio: 'UFS', estado: 'publicada', mecanica: '2x1', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-31' },
    { id: 'p2', tag: 'ALFA', espacio: 'TMICC', estado: 'borrador', mecanica: null, fecha_inicio: '2026-01-10', fecha_fin: '2026-02-20' },
  ],
  concesiones: [
    { id: 20, razon_social: 'Bodegas Ñandú', nombre_comercial: 'El Ñandú', kam_id: 'k1', territorio_id: 1, activa: true },
    { id: 10, razon_social: 'Zumos Pérez', nombre_comercial: null, kam_id: null, territorio_id: 2, activa: true },
  ],
  perfiles: [
    { id: 'k1', email: 'zoe@pro.agency', nombre: 'Zoe', rol: 'kam', activo: true },
    { id: 'a1', email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin', activo: true },
  ],
  territorios: [{ id: 1, nombre: 'Norte' }, { id: 2, nombre: 'Centro' }],
  permisos_extra: [
    { id: 'x1', perfil_id: 'k1', concesion_id: 20, espacio: null, caduca: '2026-12-31' },
    { id: 'x2', perfil_id: 'a1', concesion_id: null, espacio: 'UFS', caduca: '2026-06-30' },
  ],
  seguimiento: [] as unknown[],
}))

vi.mock('../../src/lib/supabase', () => {
  const crear = (tabla: keyof typeof datos) => {
    const resultado = { data: datos[tabla], error: null }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'eq', 'in']) b[m] = () => b
    b.single = () => Promise.resolve({ data: (datos[tabla] as unknown[])[0], error: null })
    b.then = (ok: (r: typeof resultado) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(resultado).then(ok, ko)
    return b
  }
  return { supabase: { from: (t: keyof typeof datos) => crear(t) } }
})

import Admin from '../../src/app/admin/Admin'
import Concesiones from '../../src/app/admin/Concesiones'
import Convocatoria from '../../src/app/admin/Convocatoria'
import Permisos from '../../src/app/admin/Permisos'
import Usuarios from '../../src/app/admin/Usuarios'
import { SesionContext } from '../../src/app/auth/useSesion'

const perfil = { id: 'a1', user_id: 'x', email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' as const, activo: true }
const envolver = (ui: React.ReactNode, ruta = '/') =>
  render(
    <SesionContext.Provider value={{ cargando: false, perfil }}>
      <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
    </SesionContext.Provider>,
  )
const primeraFila = (nombre: string) => within(screen.getAllByRole('row')[1]).getByText(nombre)
const ordenarPor = (nombre: RegExp) => fireEvent.click(screen.getByRole('button', { name: nombre }))

describe('Admin promociones', () => {
  afterEach(cleanup)

  it('TAG es enlace a la ficha y muestra Mecánica y Vigencia; ordena', async () => {
    envolver(<Routes><Route path="/admin/*" element={<Admin />} /></Routes>, '/admin/promociones')
    await waitFor(() => expect(screen.getByText('BETA')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'BETA' })).toHaveAttribute('href', '/ufs/BETA')
    expect(screen.getByRole('link', { name: 'ALFA' })).toHaveAttribute('href', '/tmicc/ALFA')
    expect(screen.getByRole('button', { name: /Mecánica/ })).toBeInTheDocument()
    expect(screen.getByText('01/03/2026 – 31/03/2026')).toBeInTheDocument()
    expect(primeraFila('BETA')).toBeInTheDocument()
    ordenarPor(/^TAG/)
    expect(primeraFila('ALFA')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Editar' })[0]).toHaveClass('boton', 'secundario', 'pequeno')
  })
})

describe('Concesiones', () => {
  afterEach(cleanup)

  it('el formulario no se ve hasta pulsar «Añadir concesión» y se cierra con Cancelar', async () => {
    envolver(<Concesiones />)
    await waitFor(() => expect(screen.getByText('Zumos Pérez')).toBeInTheDocument())
    expect(screen.queryByLabelText('Razón social')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir concesión' }))
    expect(screen.getByRole('heading', { name: 'Añadir concesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Razón social')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Razón social')).not.toBeInTheDocument()
  })

  it('«Editar» abre el panel relleno y ordenar no lo cierra', async () => {
    envolver(<Concesiones />)
    await waitFor(() => expect(screen.getByText('Zumos Pérez')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])
    expect(screen.getByRole('heading', { name: 'Editar concesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Razón social')).toHaveValue('Zumos Pérez')
    ordenarPor(/^Código/)
    expect(screen.getByRole('heading', { name: 'Editar concesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Razón social')).toHaveValue('Zumos Pérez')
    expect(primeraFila('Zumos Pérez')).toBeInTheDocument()
  })

  it('ordena por código y busca sin distinguir tildes ni mayúsculas', async () => {
    envolver(<Concesiones />)
    await waitFor(() => expect(screen.getByText('Zumos Pérez')).toBeInTheDocument())
    expect(primeraFila('Bodegas Ñandú')).toBeInTheDocument()
    ordenarPor(/^Código/)
    expect(primeraFila('Zumos Pérez')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar')).toHaveAttribute('placeholder', 'Buscar…')
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'PEREZ' } })
    expect(screen.getByText('Zumos Pérez')).toBeInTheDocument()
    expect(screen.queryByText('Bodegas Ñandú')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'inexistente' } })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })
})

describe('Usuarios (tablas)', () => {
  afterEach(cleanup)

  it('muestra roles legibles, ordena y oculta el formulario hasta «Añadir usuario»', async () => {
    envolver(<Usuarios />)
    await waitFor(() => expect(screen.getByText('Zoe')).toBeInTheDocument())
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('KAM')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(primeraFila('Zoe')).toBeInTheDocument()
    ordenarPor(/^Nombre/)
    expect(primeraFila('Adm')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir usuario' }))
    expect(screen.getByRole('heading', { name: 'Añadir usuario' })).toBeInTheDocument()
  })

  it('«Editar» abre «Editar usuario» relleno y el buscador filtra por email', async () => {
    envolver(<Usuarios />)
    await waitFor(() => expect(screen.getByText('Zoe')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    expect(screen.getByRole('heading', { name: 'Editar usuario' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Zoe')
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'ADM@' } })
    expect(screen.queryByText('Zoe', { selector: 'td' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Editar usuario' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'zzz' } })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })
})

describe('Permisos', () => {
  afterEach(cleanup)

  it('formulario plegado tras «Añadir permiso» y tabla ordenable por caducidad', async () => {
    envolver(<Permisos />)
    await waitFor(() => expect(screen.getByText('Zoe')).toBeInTheDocument())
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir permiso' }))
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument()
    expect(primeraFila('Zoe')).toBeInTheDocument()
    ordenarPor(/^Caduca/)
    expect(primeraFila('Adm')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Quitar' })[0]).toHaveClass('boton', 'secundario', 'pequeno')
  })
})

describe('Convocatoria', () => {
  afterEach(cleanup)

  it('ordena por razón social', async () => {
    envolver(
      <Routes><Route path="/admin/promociones/:id/convocatoria" element={<Convocatoria />} /></Routes>,
      '/admin/promociones/p1/convocatoria',
    )
    await waitFor(() => expect(screen.getByText('Zumos Pérez')).toBeInTheDocument())
    expect(primeraFila('Bodegas Ñandú')).toBeInTheDocument()
    ordenarPor(/^Razón social/)
    ordenarPor(/^Razón social/)
    expect(primeraFila('Zumos Pérez')).toBeInTheDocument()
  })
})
