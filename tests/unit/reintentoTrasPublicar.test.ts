import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const html = readFileSync('index.html', 'utf8')
const codigo = /<script>([\s\S]*?)<\/script>/.exec(html)![1]

function arrancar(inicial: Record<string, string> = {}) {
  const guardado = new Map(Object.entries(inicial))
  const oyentes: Record<string, (e: { target?: unknown }) => void> = {}
  const raiz = { textContent: '' }
  const reload = vi.fn()
  const pendientes: (() => void)[] = []
  new Function('addEventListener', 'sessionStorage', 'location', 'document', 'setTimeout', codigo)(
    (tipo: string, f: (e: { target?: unknown }) => void) => { oyentes[tipo] = f },
    {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => guardado.set(k, v),
      removeItem: (k: string) => guardado.delete(k),
    },
    { reload },
    { getElementById: () => raiz },
    (f: () => void) => pendientes.push(f),
  )
  return {
    guardado, raiz, reload,
    falla: (target: unknown) => oyentes.error({ target }),
    carga: () => oyentes.load({}),
    esperar: () => pendientes.forEach((f) => f()),
  }
}

const JS_RETIRADO = { tagName: 'SCRIPT', src: 'https://x.test/assets/index-viejo.js' }

describe('reintento tras publicar', () => {
  it('si no carga el código de la app, espera y recarga', () => {
    const p = arrancar()
    p.falla(JS_RETIRADO)
    expect(p.reload).not.toHaveBeenCalled()
    p.esperar()
    expect(p.reload).toHaveBeenCalledTimes(1)
    expect(p.guardado.get('recargas-tras-publicar')).toBe('1')
  })

  it('tras dos recargas deja de recargar y avisa', () => {
    const p = arrancar({ 'recargas-tras-publicar': '2' })
    p.falla(JS_RETIRADO)
    p.esperar()
    expect(p.reload).not.toHaveBeenCalled()
    expect(p.raiz.textContent).toBe('Se está publicando una versión nueva. Recarga en unos segundos.')
  })

  it('JS y CSS fallidos en la misma carga cuentan como una sola recarga', () => {
    const p = arrancar()
    p.falla(JS_RETIRADO)
    p.falla({ tagName: 'LINK', href: 'https://x.test/assets/index-viejo.css' })
    p.esperar()
    expect(p.reload).toHaveBeenCalledTimes(1)
    expect(p.guardado.get('recargas-tras-publicar')).toBe('1')
  })

  it('ignora errores de otros recursos', () => {
    const p = arrancar()
    p.falla({ tagName: 'IMG', src: 'https://x.test/assets/foto.png' })
    p.falla({ tagName: 'SCRIPT', src: 'https://otro.test/widget.js' })
    p.falla(window)
    p.esperar()
    expect(p.reload).not.toHaveBeenCalled()
  })

  it('una carga correcta pone el contador a cero', () => {
    const p = arrancar({ 'recargas-tras-publicar': '1' })
    p.carga()
    expect(p.guardado.has('recargas-tras-publicar')).toBe(false)
  })
})
