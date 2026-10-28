import { describe, expect, it } from 'vitest'
import { leerHoja } from '../../src/importar/leerExcel'
import { exportarSeguimiento, nombreArchivoSeguimiento } from '../../src/exportar/seguimiento'
import type { FilaGrid } from '../../src/app/promocion/servicio'

const fila = (extra: Partial<FilaGrid>): FilaGrid =>
  ({
    id: 'f1', promocion_id: 'p1', concesion_id: 9100, estado: 'no_entra', fecha_aceptacion: null,
    fecha_activacion: null, cupos: 20, usos: 5, gsv: 250, fecha_dato: null, sms: 'enviado',
    email: 'no_hay', actualizado_en: '2026-10-01T10:00:00Z', nombre: 'Alfa SL', kam_id: 'u1',
    kam_nombre: 'Ana', territorio: 'Norte', ...extra,
  }) as FilaGrid

describe('exportarSeguimiento', () => {
  it('escribe cabecera exacta, números como número y etiquetas visibles', async () => {
    const blob = exportarSeguimiento({ tag: 'SEPT1' }, [fila({})])
    const aoa = leerHoja(await blob.arrayBuffer())
    expect(aoa[0]).toEqual([
      'ID', 'Concesión', 'KAM', 'Territorio', 'Estado', 'Aceptación', 'Activación',
      'Cupos', 'Usos', '%Cupos', 'GSV', 'GSV/uso', 'SMS', 'Email',
    ])
    const r = aoa[1]
    expect(r[0]).toBe(9100)
    expect(r[4]).toBe('No entra')
    expect(typeof r[8]).toBe('number')
    expect(r[8]).toBe(5)
    expect(r[9]).toBeCloseTo(0.25)
    expect(r[10]).toBe(250)
    expect(r[11]).toBe(50)
    expect(r[12]).toBe('Enviado')
    expect(r[13]).toBe('No hay')
  })

  it('nombre de archivo con TAG y fecha', () => {
    expect(nombreArchivoSeguimiento('SEPT1', new Date(2026, 9, 28))).toBe('SEPT1_seguimiento_2026-10-28.xlsx')
  })
})
