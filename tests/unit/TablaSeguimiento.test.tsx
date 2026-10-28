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
    fecha_dato: null, sms: 'pending', email: 'pending', actualizado_en: '2026-10-01T10:00:00Z',
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
})
