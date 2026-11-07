import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

describe('CreateCustomerDto', () => {
  it('normalizes and accepts a valid Chilean RUT', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      name: 'Juan Pérez',
      email: 'juan@example.com',
      rut: '12.345.678-5',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.rut).toBe('12345678-5');
  });

  it.each([
    ['alejandro silva monsalve', 'Alejandro Silva Monsalve'],
    ['  ALEJANDRO   SILVA  MONSALVE ', 'Alejandro Silva Monsalve'],
    ['josé muñoz pérez', 'José Muñoz Pérez'],
    ["maría-josé o'connor", "María-José O'Connor"],
  ])('formats the customer name %s', async (name, expected) => {
    const dto = plainToInstance(CreateCustomerDto, { name });
    expect(dto.name).toBe(expected);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an invalid Chilean RUT', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      name: 'Juan Pérez',
      email: 'juan@example.com',
      rut: '12.345.678-9',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'rut' })]),
    );
  });
  it.each([
    { name: 'Solo nombre' },
    { name: 'Solo nombre', email: '', rut: '' },
    { name: 'Solo nombre', email: '   ', rut: '   ' },
  ])('accepts optional contact fields: %o', async (input) => {
    const dto = plainToInstance(CreateCustomerDto, input);
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBeUndefined();
    expect(dto.rut).toBeUndefined();
  });

  it('still rejects a supplied invalid email', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      name: 'Cliente',
      email: 'incorrecto',
    });
    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'email' })]),
    );
  });

  it.each([undefined, '', '   '])(
    'rejects a missing or blank name: %s',
    async (name) => {
      const dto = plainToInstance(CreateCustomerDto, { name });
      expect(await validate(dto)).toEqual(
        expect.arrayContaining([expect.objectContaining({ property: 'name' })]),
      );
    },
  );
});
