import { registerDecorator, type ValidationOptions } from 'class-validator';

export function normalizeChileanRut(value: string): string {
  const compact = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (compact.length < 2) {
    return compact;
  }

  const body = compact.slice(0, -1).replace(/^0+(?=\d)/, '');
  const checkDigit = compact.slice(-1);
  return `${body}-${checkDigit}`;
}

export function isValidChileanRut(value: string): boolean {
  const normalized = normalizeChileanRut(value);
  const match = /^(\d{1,8})-([0-9K])$/.exec(normalized);
  if (!match) {
    return false;
  }

  const [, body, providedCheckDigit] = match;
  if (Number(body) === 0) {
    return false;
  }

  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  const expectedCheckDigit =
    result === 11 ? '0' : result === 10 ? 'K' : String(result);
  return providedCheckDigit === expectedCheckDigit;
}

export function IsChileanRut(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isChileanRut',
      target: object.constructor,
      propertyName,
      options: {
        message: 'El RUT chileno no es válido.',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isValidChileanRut(value);
        },
      },
    });
  };
}
