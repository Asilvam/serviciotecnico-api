import { isValidChileanRut, normalizeChileanRut } from './chilean-rut.util';

describe('Chilean RUT utilities', () => {
  it.each([
    ['12.345.678-5', '12345678-5'],
    ['11.111.111-1', '11111111-1'],
    ['6.123.456-k', '6123456-K'],
  ])('normalizes %s as %s', (input, expected) => {
    expect(normalizeChileanRut(input)).toBe(expected);
  });

  it.each(['12.345.678-5', '11.111.111-1', '6.123.456-K'])(
    'accepts valid RUT %s',
    (rut) => {
      expect(isValidChileanRut(rut)).toBe(true);
    },
  );

  it.each(['', '1', '12.345.678-9', '0-0', '123456789-5'])(
    'rejects invalid RUT %s',
    (rut) => {
      expect(isValidChileanRut(rut)).toBe(false);
    },
  );
});
