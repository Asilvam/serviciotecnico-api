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
});
