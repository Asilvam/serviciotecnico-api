import { validate } from 'class-validator';
import { PrintServiceOrderDto } from './print-service-order.dto';

describe('PrintServiceOrderDto', () => {
  it.each(['thermal_escpos', 'system_pdf'])(
    'accepts the supported profile %s',
    async (printerProfile) => {
      const dto = Object.assign(new PrintServiceOrderDto(), {
        printerProfile,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects no-print and unknown profiles at the API boundary', async () => {
    const dto = Object.assign(new PrintServiceOrderDto(), {
      printerProfile: 'none',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
