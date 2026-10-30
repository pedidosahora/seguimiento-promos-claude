import { describe, expect, it } from 'vitest'
import { fmtEntero, fmtImporte, fmtPct } from '../../src/dominio/formato'

const n = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('formato', () => {
  it('fmtEntero', () => {
    expect(n(fmtEntero(1260))).toBe('1.260')
    expect(n(fmtEntero(0))).toBe('0')
    expect(fmtEntero(null)).toBe('—')
  })
  it('fmtImporte', () => {
    expect(n(fmtImporte(1260))).toBe('1.260,00 €')
    expect(n(fmtImporte('2985.5'))).toBe('2.985,50 €')
    expect(fmtImporte(undefined)).toBe('—')
    expect(fmtImporte('')).toBe('—')
  })
  it('fmtPct', () => {
    expect(n(fmtPct(0.844))).toBe('84 %')
    expect(n(fmtPct(1.2))).toBe('120 %')
    expect(fmtPct(null)).toBe('—')
  })
})
