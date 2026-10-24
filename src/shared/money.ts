/** Price of one cart line, in US dollars. */
export function lineTotal(price: number, quantity: number): number {
  return price * quantity;
}

/** `amount` with `percent`% taken off, e.g. percentOff(80, 25) === 60. */
export function percentOff(amount: number, percent: number): number {
  return amount - (amount * percent) / 100;
}
