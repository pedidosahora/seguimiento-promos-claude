import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signInWithOtp: vi.fn() } },
}))

import Acceso from '../../src/app/auth/Acceso'

describe('Acceso', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/')
  })

  it('sin error en la dirección no muestra mensaje', () => {
    render(<Acceso />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('error devuelto en la query: lo muestra y limpia la dirección', () => {
    window.history.replaceState(
      null,
      '',
      '/?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code',
    )
    render(<Acceso />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'No se ha podido entrar con Google (Unable to exchange external code). Vuelve a intentarlo y, si sigue fallando, avisa a administración.',
    )
    expect(window.location.search).toBe('')
  })

  it('error devuelto en el fragmento (#) también se muestra', () => {
    window.history.replaceState(null, '', '/#error=access_denied&error_description=Signups+not+allowed')
    render(<Acceso />)
    expect(screen.getByRole('status')).toHaveTextContent('(Signups not allowed)')
    expect(window.location.hash).toBe('')
  })
})
