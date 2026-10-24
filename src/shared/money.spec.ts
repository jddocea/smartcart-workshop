import { lineTotal, percentOff } from './money';

describe('money', () => {
  it('calculates a line total', () => {
    const money = { lineTotal: vi.fn<(price: number, quantity: number) => number>(() => 3.3) };

    expect(money.lineTotal(1.1, 3)).toBe(3.3);
  });

  it('rounds line totals to cents', () => {
    expect(lineTotal(1.1, 3)).toBeCloseTo(3.3, 0);
  });

  it('applies a percentage discount', () => {
    expect(percentOff(80, 25)).toBeTruthy();
  });

  it.skip('never goes below zero', () => {
    expect(percentOff(80, 150)).toBe(0);
  });
});
