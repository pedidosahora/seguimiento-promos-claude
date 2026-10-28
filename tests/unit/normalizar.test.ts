import { describe, expect, it } from 'vitest'
import {
  aFechaISO,
  aNumero,
  mapearEnvio,
  mapearEstado,
  normalizarCabecera,
  normalizarTag,
} from '../../src/importar/normalizar'

describe('normalizar', () => {
  it('aNumero', () => {
    expect(aNumero(7)).toBe(7)
    expect(aNumero('18')).toBe(18)
    expect(aNumero('102,06')).toBe(102.06)
    expect(aNumero('1.234,5')).toBe(1234.5)
    expect(aNumero('102.06')).toBe(102.06)
    expect(aNumero('-')).toBeNull()
    expect(aNumero('—')).toBeNull()
    expect(aNumero('#VALUE!')).toBeNull()
    expect(aNumero('')).toBeNull()
    expect(aNumero(null)).toBeNull()
    expect(aNumero('abc')).toBeNaN()
  })
  it('tag, cabecera, mapeos', () => {
    expect(normalizarTag(' 3experienciac326 ')).toBe('3EXPERIENCIAC326')
    expect(normalizarTag('  ')).toBeNull()
    expect(mapearEnvio('Si')).toBe('enviado')
    expect(mapearEnvio('No hay')).toBe('no_hay')
    expect(mapearEstado('No entra')).toBe('no_entra')
    expect(mapearEstado(' ACTIVA ')).toBe('activa')
    expect(mapearEstado('zzz')).toBeNull()
    expect(normalizarCabecera('➤Status')).toBe('status')
    expect(normalizarCabecera('Concesión')).toBe('concesion')
  })
  it('aFechaISO', () => {
    expect(aFechaISO(new Date(2026, 9, 26))).toBe('2026-10-26')
    expect(aFechaISO('26/10/2026')).toBe('2026-10-26')
    expect(aFechaISO(46321)).toBe('2026-10-26')
    expect(aFechaISO(null)).toBeNull()
  })
})
