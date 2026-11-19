import * as s from '@strling-lang/strling/simply';

export const asciiDigit = () => s.between('0', '9');
export const asciiLower = () => s.between('a', 'z');
export const asciiHex = () => s.inChars(asciiDigit(), s.between('A', 'F'));
export const fixedDigits = (count: number) => asciiDigit().rep(count);

export const decimalDate = () =>
  s.merge(fixedDigits(4), '-', fixedDigits(2), '-', fixedDigits(2));

export function choices(values: readonly [string, ...string[]]): s.Pattern {
  const [first, ...remaining] = values;
  return remaining.length ? s.anyOf(first, ...remaining) : s.lit(first);
}
