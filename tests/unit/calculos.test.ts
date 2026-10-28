import { describe, expect, it } from 'vitest'
import { gsvPorUso, nivelAlertaCupos, pctCupos } from '../../src/dominio/calculos'
import {
  ETIQUETA_ENVIO,
  ETIQUETA_ESPACIO,
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_PROMOCION,
} from '../../src/dominio/etiquetas'

describe('calculos', () => {
  it('pctCupos', () => {
    expect(pctCupos(51, 50)).toBeCloseTo(1.02)
    expect(pctCupos(5, 0)).toBeNull()
    expect(pctCupos(5, null)).toBeNull()
    expect(pctCupos(null, 50)).toBeNull()
  })
  it('gsvPorUso', () => {
    expect(gsvPorUso(416.24, 10)).toBeCloseTo(41.624)
    expect(gsvPorUso(100, 0)).toBeNull()
    expect(gsvPorUso(null, 10)).toBeNull()
  })
  it('nivelAlertaCupos', () => {
    expect(nivelAlertaCupos(50, 50, 0.8)).toBe('agotado')
    expect(nivelAlertaCupos(40, 50, 0.8)).toBe('cerca')
    expect(nivelAlertaCupos(39, 50, 0.8)).toBeNull()
    expect(nivelAlertaCupos(3, 0, 0.8)).toBeNull()
    expect(nivelAlertaCupos(3, null, 0.8)).toBeNull()
  })
})

describe('etiquetas', () => {
  it('textos visibles', () => {
    expect(ETIQUETA_ESTADO.no_entra).toBe('No entra')
    expect(ETIQUETA_ENVIO.no_hay).toBe('No hay')
    expect(ETIQUETA_ESTADO_PROMOCION.archivada).toBe('Archivada')
    expect(ETIQUETA_ESPACIO.CAMPANAS).toBe('Campañas')
  })
})
