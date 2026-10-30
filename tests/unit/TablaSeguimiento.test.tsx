import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import {
  claseCelda,
  esEditable,
  isoALocal,
  localAIso,
  textoGsvUso,
  textoPctCupos,
  validarCambio,
} from '../../src/app/promocion/celdas'
import TablaSeguimiento from '../../src/app/promocion/TablaSeguimiento'
import type { FilaGrid } from '../../src/app/promocion/servicio'

function fila(extra: Partial<FilaGrid> = {}): FilaGrid {
  return {
    id: 'f1', promocion_id: 'p1', concesion_id: 9100, estado: 'pendiente',
    fecha_aceptacion: null, fecha_activacion: null, cupos: 50, usos: 0, gsv: 0,
    fecha_dato: null, sms: 'pending', email: 'pending', actualizado_en: '2026-10-01T10:00:00Z', cupos_revisado_en: null,
    nombre: 'Alfa', kam_id: 'k1', kam_nombre: 'Ana', territorio: 'Norte',
    ...extra,
  }
}

describe('lógica de celdas', () => {
  it('cupos=0 y usos=3: %Cupos es — y sin alerta', () => {
    const f = fila({ cupos: 0, usos: 3 })
    expect(textoPctCupos(f.usos, f.cupos)).toBe('—')
    expect(claseCelda('pct_cupos', f, { editable: true, esAdmin: false, umbral: 0.8 })).not.toMatch(/alerta/)
  })

  it('usos=51 y cupos=50: 102 % con alerta-agotado', () => {
    const f = fila({ cupos: 50, usos: 51 })
    expect(textoPctCupos(f.usos, f.cupos)).toBe('102 %')
    expect(claseCelda('pct_cupos', f, { editable: true, esAdmin: false, umbral: 0.8 })).toContain('alerta-agotado')
  })

  it('cerca del umbral: alerta-cerca', () => {
    const f = fila({ cupos: 50, usos: 42 })
    expect(claseCelda('pct_cupos', f, { editable: true, esAdmin: false, umbral: 0.8 })).toContain('alerta-cerca')
  })

  it('fila ajena sin permiso: no-editable', () => {
    const f = fila()
    expect(claseCelda('estado', f, { editable: false, esAdmin: false, umbral: 0.8 })).toContain('no-editable')
    expect(claseCelda('estado', f, { editable: true, esAdmin: false, umbral: 0.8 })).not.toContain('no-editable')
  })

  it('usos y GSV solo los edita admin; el resto, con permiso sobre la fila', () => {
    expect(esEditable('usos', { editable: true, esAdmin: false })).toBe(false)
    expect(esEditable('gsv', { editable: true, esAdmin: false })).toBe(false)
    expect(esEditable('usos', { editable: false, esAdmin: true })).toBe(true)
    expect(esEditable('estado', { editable: true, esAdmin: false })).toBe(true)
    expect(esEditable('estado', { editable: false, esAdmin: false })).toBe(false)
    expect(esEditable('pct_cupos', { editable: true, esAdmin: true })).toBe(false)
  })

  it('GSV/uso es — cuando no hay usos', () => {
    expect(textoGsvUso(100, 0)).toBe('—')
    expect(textoGsvUso(null, 3)).toBe('—')
    expect(textoGsvUso(100, 4)).toMatch(/25,00/)
  })

  it('validarCambio: enteros no negativos y enums', () => {
    expect(validarCambio('cupos', '12')).toEqual({ valor: 12 })
    expect(validarCambio('cupos', null)).toEqual({ valor: null })
    expect(validarCambio('cupos', -1)).toHaveProperty('error')
    expect(validarCambio('cupos', 1.5)).toHaveProperty('error')
    expect(validarCambio('gsv', 10.5)).toEqual({ valor: 10.5 })
    expect(validarCambio('estado', 'activa')).toEqual({ valor: 'activa' })
    expect(validarCambio('estado', 'inventado')).toHaveProperty('error')
    expect(validarCambio('sms', 'enviado')).toEqual({ valor: 'enviado' })
  })

  it('fechas: ida y vuelta entre ISO y hora local', () => {
    const iso = '2026-10-05T08:30:00.000Z'
    expect(localAIso(isoALocal(iso))).toBe(iso)
    expect(isoALocal(null)).toBeNull()
    expect(localAIso(null)).toBeNull()
    expect(localAIso('')).toBeNull()
  })

  it('valor de dateTimeString con hora: se interpreta en hora local, no como 00:00Z', () => {
    // formato que devuelve el editor de fecha y hora con cellDataType dateTimeString
    expect(localAIso('2026-10-05T09:30:00')).toBe(new Date(2026, 9, 5, 9, 30, 0).toISOString())
    expect(isoALocal(new Date(2026, 9, 5, 9, 30, 0).toISOString())).toBe('2026-10-05T09:30:00')
  })
})

describe('TablaSeguimiento', () => {
  afterEach(cleanup)

  it('pinta filas con no-editable, — y 102 %', async () => {
    const filas = [
      fila({ id: 'a', nombre: 'Alfa', concesion_id: 9100, cupos: 50, usos: 51 }),
      fila({ id: 'b', nombre: 'Beta', concesion_id: 9101, cupos: 0, usos: 3 }),
    ]
    const { container } = render(
      <div style={{ width: 1600, height: 600 }}>
        <TablaSeguimiento
          filas={filas}
          editables={new Set([9100])}
          esAdmin={false}
          umbral={0.8}
          onEditar={vi.fn()}
          onSeleccion={vi.fn()}
          onAbrirFicha={vi.fn()}
          pruebas
        />
      </div>,
    )
    await waitFor(() => expect(screen.getByText('Alfa')).toBeInTheDocument())
    expect(screen.getByText(/102 %/)).toBeInTheDocument()
    expect(container.querySelector('.alerta-agotado')).not.toBeNull()
    // fila ajena (9101) en gris
    const filaBeta = container.querySelector('[row-id="b"]')!
    expect(filaBeta.querySelector('.no-editable')).not.toBeNull()
    expect(container.querySelector('[row-id="a"] [col-id="estado"].no-editable')).toBeNull()
  })

  const props = {
    editables: new Set([9100]),
    esAdmin: false,
    umbral: 0.8,
    onEditar: vi.fn(),
    onSeleccion: vi.fn(),
    onAbrirFicha: vi.fn(),
    pruebas: true,
  }

  it('⚠ en cerca (amarillo) y en agotado (rojo); nada por debajo del umbral', async () => {
    const filas = [
      fila({ id: 'a', nombre: 'Alfa', concesion_id: 9100, cupos: 50, usos: 51 }),
      fila({ id: 'b', nombre: 'Beta', concesion_id: 9101, cupos: 50, usos: 45 }),
      fila({ id: 'c', nombre: 'Gamma', concesion_id: 9102, cupos: 50, usos: 10 }),
    ]
    const { container } = render(
      <div style={{ width: 1600, height: 600 }}>
        <TablaSeguimiento {...props} filas={filas} />
      </div>,
    )
    await waitFor(() => expect(screen.getByText('Alfa')).toBeInTheDocument())
    const pct = (id: string) => container.querySelector(`[row-id="${id}"] [col-id="pct_cupos"]`)!
    expect(pct('a').textContent).toContain('⚠')
    expect(pct('a').className).toMatch(/alerta-agotado/)
    expect(pct('b').textContent).toContain('⚠')
    expect(pct('b').className).toMatch(/alerta-cerca/)
    expect(pct('c').textContent).not.toContain('⚠')
  })

  it('orden de columnas: selección y Concesión primero; %Cupos, SMS y Email antes de KAM y Territorio', async () => {
    const { container } = render(
      <div style={{ width: 1600, height: 600 }}>
        <TablaSeguimiento {...props} filas={[fila()]} />
      </div>,
    )
    await waitFor(() => expect(screen.getByText('Alfa')).toBeInTheDocument())
    const ids = [...container.querySelectorAll('.ag-header-cell[col-id]')].map((h) => h.getAttribute('col-id'))
    expect(ids.slice(0, 2)).toEqual(['ag-Grid-SelectionColumn', 'concesion'])
    const pos = (id: string) => ids.indexOf(id)
    for (const antes of ['pct_cupos', 'sms', 'email']) {
      expect(pos(antes)).toBeGreaterThan(-1)
      expect(pos(antes)).toBeLessThan(pos('kam'))
      expect(pos(antes)).toBeLessThan(pos('territorio'))
    }
  })

  it('en Mis concesiones se ocultan KAM y Territorio', async () => {
    const { container } = render(
      <div style={{ width: 1600, height: 600 }}>
        <TablaSeguimiento {...props} filas={[fila()]} ocultarKamTerritorio />
      </div>,
    )
    await waitFor(() => expect(screen.getByText('Alfa')).toBeInTheDocument())
    expect(container.querySelector('.ag-header-cell[col-id="kam"]')).toBeNull()
    expect(container.querySelector('.ag-header-cell[col-id="territorio"]')).toBeNull()
    expect(container.querySelector('.ag-header-cell[col-id="email"]')).not.toBeNull()
  })
})
