import { BadRequestException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { DeviceCatalogService } from './device-catalog.service';

const brandId = new ObjectId().toHexString();
const modelId = new ObjectId().toHexString();
function setup() {
  const brands = {
    findOne: jest.fn().mockResolvedValue({
      _id: new ObjectId(brandId),
      name: 'Samsung',
      active: true,
    }),
    find: jest.fn().mockResolvedValue([]),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const models = {
    findOne: jest.fn().mockResolvedValue({
      _id: new ObjectId(modelId),
      brandId,
      name: 'Galaxy A04',
      active: true,
      category: 'phone',
    }),
    find: jest.fn().mockResolvedValue([]),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const service = new DeviceCatalogService(brands as never, models as never);
  return { service, brands, models };
}
describe('device catalog integration', () => {
  it('orders brands by the published world shipment ranking across pages', async () => {
    const { service, brands } = setup();
    const rows = [
      'ZTE',
      'vivo',
      'Xiaomi',
      'Samsung',
      'Apple',
      'OPPO',
      'Motorola',
    ].map((name) => ({ _id: new ObjectId(), name, active: true }));
    brands.find.mockResolvedValue(rows);
    const first = await service.listBrands({ limit: 3 });
    expect(first.items.map((item) => item.name)).toEqual([
      'SAMSUNG',
      'APPLE',
      'XIAOMI',
    ]);
    const second = await service.listBrands({
      limit: 3,
      after: first.nextCursor!,
    });
    expect(second.items.map((item) => item.name)).toEqual([
      'OPPO',
      'VIVO',
      'MOTOROLA',
    ]);
    const third = await service.listBrands({
      limit: 3,
      after: second.nextCursor!,
    });
    expect(third.items.map((item) => item.name)).toEqual(['ZTE']);
    expect(third.nextCursor).toBeNull();
  });
  it('learns manual phone names using unique upserts and never reactivates existing entries', async () => {
    const { service, brands, models } = setup();
    await service.rememberManual({
      deviceType: 'CELULAR',
      deviceBrand: 'samsung',
      deviceModel: 'Nuevo Modelo',
    });
    await service.rememberManual({
      deviceType: 'CELULAR',
      deviceBrand: ' SAMSUNG ',
      deviceModel: 'NUEVO MODELO',
    });
    expect(brands.updateOne.mock.calls[0][0]).toEqual(
      brands.updateOne.mock.calls[1][0],
    );
    expect(models.updateOne.mock.calls[0][0]).toEqual(
      models.updateOne.mock.calls[1][0],
    );
    expect(models.updateOne.mock.calls[0][1]).toHaveProperty(
      '$setOnInsert.name',
      'NUEVO MODELO',
    );
    expect(models.updateOne.mock.calls[0][1]).not.toHaveProperty('$set');
    brands.findOne.mockResolvedValue({
      _id: new ObjectId(brandId),
      name: 'Samsung',
      active: false,
    });
    models.updateOne.mockClear();
    await service.rememberManual({
      deviceType: 'CELULAR',
      deviceBrand: 'Samsung',
      deviceModel: 'Otro Modelo',
    });
    expect(models.updateOne).not.toHaveBeenCalled();
  });
  it('does not grow the phone catalog for other categories or complete catalog selections', async () => {
    const { service, brands, models } = setup();
    await service.rememberManual({
      deviceType: 'NOTEBOOK',
      deviceBrand: 'Marca',
      deviceModel: 'Modelo',
    });
    await service.rememberManual({
      deviceType: 'CELULAR',
      deviceBrandId: brandId,
      deviceModelId: modelId,
    });
    expect(brands.updateOne).not.toHaveBeenCalled();
    expect(models.updateOne).not.toHaveBeenCalled();
  });
  it('preserves legacy text with no catalog lookups', async () => {
    const { service, brands } = setup();
    await expect(
      service.resolveOrder({
        deviceType: 'CELULAR',
        deviceBrand: 'marca histórica',
      }),
    ).resolves.toEqual({});
    expect(brands.findOne).not.toHaveBeenCalled();
  });
  it('derives canonical snapshots and never infers a variant', async () => {
    const { service } = setup();
    await expect(
      service.resolveOrder({
        deviceType: 'CELULAR',
        deviceBrandId: brandId,
        deviceModelId: modelId,
        deviceBrand: 'forged',
        deviceModel: 'forged',
      }),
    ).resolves.toEqual({ deviceBrand: 'SAMSUNG', deviceModel: 'GALAXY A04' });
  });
  it('rejects a model from another brand', async () => {
    const { service, models } = setup();
    models.findOne.mockResolvedValue({
      name: 'Galaxy A04',
      active: true,
      category: 'phone',
      brandId: new ObjectId().toHexString(),
    });
    await expect(
      service.resolveOrder({
        deviceType: 'CELULAR',
        deviceBrandId: brandId,
        deviceModelId: modelId,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects a model without a brand', async () => {
    await expect(
      setup().service.resolveOrder({
        deviceType: 'CELULAR',
        deviceModelId: modelId,
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects inactive brands and non-phone selections', async () => {
    const { service, brands } = setup();
    brands.findOne.mockResolvedValue({ name: 'Samsung', active: false });
    await expect(
      service.resolveOrder({ deviceType: 'CELULAR', deviceBrandId: brandId }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.resolveOrder({ deviceType: 'TABLET', deviceBrandId: brandId }),
    ).rejects.toThrow(BadRequestException);
  });
  it('does not revalidate inactive catalog references when other order fields change', async () => {
    const { service, brands } = setup();
    await expect(
      service.resolveUpdate(
        { deviceType: 'CELULAR', deviceBrandId: brandId },
        {},
      ),
    ).resolves.toEqual({});
    expect(brands.findOne).not.toHaveBeenCalled();
  });
  it('clears stale references when legacy clients change free-text brand', async () => {
    const { service } = setup();
    await expect(
      service.resolveUpdate(
        {
          deviceType: 'CELULAR',
          deviceBrand: 'Samsung',
          deviceBrandId: brandId,
          deviceModelId: modelId,
        },
        { deviceBrand: 'manual' },
      ),
    ).resolves.toEqual({ deviceBrandId: null, deviceModelId: null });
  });
  it('retains brand-only selections with manual model text', async () => {
    const { service } = setup();
    await expect(
      service.resolveOrder({
        deviceType: 'CELULAR',
        deviceBrandId: brandId,
        deviceModel: 'manual',
      }),
    ).resolves.toEqual({ deviceBrand: 'SAMSUNG' });
  });
});
