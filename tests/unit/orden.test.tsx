import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ordenar, useOrden, type Columna } from '../../src/app/comun/orden';
import { CabeceraOrdenable } from '../../src/app/comun/CabeceraOrdenable';

type F = { id: number; v: string | number | Date | null | undefined };
const col: Columna<F>[] = [{ clave: 'v', valor: (f) => f.v }];
const filas = (vs: F['v'][]): F[] => vs.map((v, i) => ({ id: i, v }));
const vals = (fs: F[]) => fs.map((f) => f.v);

describe('ordenar', () => {
  it('texto: insensible a acentos y mayúsculas', () => {
    const r = vals(ordenar(filas(['beta', 'Álvaro', 'alfa']), col, { clave: 'v', dir: 'asc' }));
    expect(r[2]).toBe('beta');
    expect(r.slice(0, 2).sort()).toEqual(['alfa', 'Álvaro'].sort());
  });
  it('números desc', () => {
    expect(vals(ordenar(filas([10, 2, 33]), col, { clave: 'v', dir: 'desc' }))).toEqual([33, 10, 2]);
  });
  it('fechas ISO', () => {
    const r = vals(ordenar(filas(['2026-03-01', '2025-12-31', '2026-01-15']), col, { clave: 'v', dir: 'asc' }));
    expect(r).toEqual(['2025-12-31', '2026-01-15', '2026-03-01']);
  });
  it('timestamps ISO completos', () => {
    const r = vals(ordenar(filas(['2026-10-30T10:00:00Z', '2026-10-29T23:00:00Z']), col, { clave: 'v', dir: 'asc' }));
    expect(r).toEqual(['2026-10-29T23:00:00Z', '2026-10-30T10:00:00Z']);
  });
  it('strings numéricos se ordenan numéricamente', () => {
    expect(vals(ordenar(filas(['120.50', '9.00', '10']), col, { clave: 'v', dir: 'asc' }))).toEqual(['9.00', '10', '120.50']);
  });
  it('número frente a string numérico', () => {
    expect(vals(ordenar(filas([9, '10.5']), col, { clave: 'v', dir: 'asc' }))).toEqual([9, '10.5']);
    expect(vals(ordenar(filas(['10.5', 9]), col, { clave: 'v', dir: 'asc' }))).toEqual([9, '10.5']);
  });
  it('Date', () => {
    const a = new Date('2026-01-01'), b = new Date('2025-01-01');
    expect(vals(ordenar(filas([a, b]), col, { clave: 'v', dir: 'asc' }))).toEqual([b, a]);
  });
  it('vacíos al final en asc y desc', () => {
    const f = filas([3, null, 1, undefined, '']);
    const asc = vals(ordenar(f, col, { clave: 'v', dir: 'asc' }));
    expect(asc.slice(0, 2)).toEqual([1, 3]);
    expect(asc.slice(2)).toEqual([null, undefined, '']);
    const desc = vals(ordenar(f, col, { clave: 'v', dir: 'desc' }));
    expect(desc.slice(0, 2)).toEqual([3, 1]);
    expect(desc.slice(2)).toEqual([null, undefined, '']);
  });
  it('estable en empates, también en desc', () => {
    const f = filas([1, 1, 1]);
    expect(ordenar(f, col, { clave: 'v', dir: 'asc' }).map((x) => x.id)).toEqual([0, 1, 2]);
    expect(ordenar(f, col, { clave: 'v', dir: 'desc' }).map((x) => x.id)).toEqual([0, 1, 2]);
  });
  it('null devuelve la entrada tal cual', () => {
    const f = filas([3, 1, 2]);
    expect(ordenar(f, col, null)).toBe(f);
  });
});

function Demo() {
  const { filas: fs, orden, alternar } = useOrden(filas([3, 1, 2]), col);
  return (
    <table>
      <thead>
        <tr>
          <CabeceraOrdenable clave="v" orden={orden} onAlternar={alternar}>Valor</CabeceraOrdenable>
        </tr>
      </thead>
      <tbody>
        {fs.map((f) => (
          <tr key={f.id}><td>{String(f.v)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

describe('useOrden + CabeceraOrdenable', () => {
  it('asc → desc → original', () => {
    render(<Demo />);
    const th = screen.getByRole('columnheader');
    const btn = screen.getByRole('button');
    const orden = () => screen.getAllByRole('cell').map((c) => c.textContent);
    expect(th.hasAttribute('aria-sort')).toBe(false);
    fireEvent.click(btn);
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    expect(btn.textContent).toContain('▲');
    expect(btn.querySelector('[aria-hidden="true"]')!.textContent).toContain('▲');
    expect(orden()).toEqual(['1', '2', '3']);
    fireEvent.click(btn);
    expect(th.getAttribute('aria-sort')).toBe('descending');
    expect(btn.textContent).toContain('▼');
    expect(orden()).toEqual(['3', '2', '1']);
    fireEvent.click(btn);
    expect(th.hasAttribute('aria-sort')).toBe(false);
    expect(orden()).toEqual(['3', '1', '2']);
  });
});

describe('useOrden reactividad', () => {
  function Prueba({ fs, ext }: { fs: F[]; ext: number }) {
    const cols: Columna<F>[] = [{ clave: 'v', valor: (f) => (ext ? -(f.v as number) : (f.v as number)) }];
    const { filas: r, alternar } = useOrden(fs, cols);
    return (
      <div>
        <button onClick={() => alternar('v')}>ord</button>
        <span data-testid="r">{r.map((f) => f.v).join(',')}</span>
      </div>
    );
  }
  it('reordena con nuevas filas y con columnas que leen estado externo', () => {
    const a = filas([3, 1, 2]);
    const { rerender } = render(<Prueba fs={a} ext={0} />);
    fireEvent.click(screen.getByText('ord'));
    expect(screen.getByTestId('r').textContent).toBe('1,2,3');
    const b = filas([5, 4, 6]);
    rerender(<Prueba fs={b} ext={0} />);
    expect(screen.getByTestId('r').textContent).toBe('4,5,6');
    rerender(<Prueba fs={b} ext={1} />);
    expect(screen.getByTestId('r').textContent).toBe('6,5,4');
    rerender(<Prueba fs={a} ext={1} />);
    expect(screen.getByTestId('r').textContent).toBe('3,2,1');
  });
});
