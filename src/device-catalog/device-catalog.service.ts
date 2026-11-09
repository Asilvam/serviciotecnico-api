import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { DeviceBrand, DeviceModel } from './catalog.entity';
import { catalogName, compareBrands } from './catalog-ordering';
import { catalogKey, prefixPattern } from './catalog-utils';
import { CatalogQueryDto } from './catalog.dto';

type DeviceInput = {
  deviceType?: string;
  deviceBrand?: string;
  deviceModel?: string | null;
  deviceBrandId?: string | null;
  deviceModelId?: string | null;
};
function id(value: string) {
  if (!ObjectId.isValid(value))
    throw new BadRequestException('Identificador de catálogo inválido.');
  return new ObjectId(value);
}
function view<T extends { _id: ObjectId }>(entity: T) {
  const { _id, ...rest } = entity;
  const fields = rest as Record<string, unknown>;
  return {
    ...rest,
    ...(typeof fields.name === 'string'
      ? { name: catalogName(fields.name) }
      : {}),
    ...(typeof fields.brandName === 'string'
      ? { brandName: catalogName(fields.brandName) }
      : {}),
    id: _id.toHexString(),
  };
}
@Injectable()
export class DeviceCatalogService implements OnModuleInit {
  private readonly logger = new Logger(DeviceCatalogService.name);
  constructor(
    @InjectRepository(DeviceBrand) private brands: MongoRepository<DeviceBrand>,
    @InjectRepository(DeviceModel) private models: MongoRepository<DeviceModel>,
  ) {}
  async onModuleInit() {
    await Promise.all([
      this.brands.createCollectionIndex(
        { normalizedName: 1 },
        { unique: true, name: 'catalog_brand_name' },
      ),
      this.models.createCollectionIndex(
        { brandId: 1, normalizedName: 1 },
        { unique: true, name: 'catalog_model_name' },
      ),
      this.models.createCollectionIndex(
        { active: 1, brandId: 1, searchKeys: 1 },
        { name: 'catalog_model_search' },
      ),
    ]);
  }
  async listBrands(query: CatalogQueryDto) {
    const where: Record<string, unknown> = { active: true };
    if (query.q?.trim())
      where.normalizedName = { $regex: prefixPattern(query.q) };
    const rows = await this.brands.find({ where });
    rows.sort(
      (a, b) =>
        compareBrands(a, b) ||
        a._id.toHexString().localeCompare(b._id.toHexString()),
    );
    return this.rankedPage(rows, query);
  }
  async listModels(query: CatalogQueryDto) {
    if (!query.brandId) throw new BadRequestException('Selecciona una marca.');
    const where: Record<string, unknown> = {
      active: true,
      brandId: query.brandId,
      category: 'phone',
    };
    if (query.q?.trim()) where.searchKeys = { $regex: prefixPattern(query.q) };
    if (query.after) where._id = { $gt: id(query.after) };
    return this.page(
      await this.models.find({
        where,
        order: { _id: 'ASC' },
        take: query.limit + 1,
      }),
      query.limit,
    );
  }
  private rankedPage<T extends { _id: ObjectId }>(
    rows: T[],
    query: CatalogQueryDto,
  ) {
    let offset = 0;
    if (query.after) {
      const cursor = rows.findIndex(
        (row) => row._id.toHexString() === query.after,
      );
      if (cursor < 0)
        throw new BadRequestException('La lista cambió. Reinicia la búsqueda.');
      offset = cursor + 1;
    }
    return this.page(rows.slice(offset, offset + query.limit + 1), query.limit);
  }
  private page<T extends { _id: ObjectId }>(rows: T[], limit: number) {
    const items = rows.slice(0, limit);
    return {
      items: items.map(view),
      nextCursor: rows.length > limit ? items.at(-1)?._id.toHexString() : null,
    };
  }
  async getBrand(brandId: string) {
    const brand = await this.brands.findOne({ where: { _id: id(brandId) } });
    if (!brand) throw new NotFoundException('Marca no encontrada.');
    return { ...brand, name: catalogName(brand.name) };
  }
  async getModel(modelId: string) {
    const model = await this.models.findOne({ where: { _id: id(modelId) } });
    if (!model) throw new NotFoundException('Modelo no encontrado.');
    return { ...model, name: catalogName(model.name) };
  }
  /** Resolve only explicit catalog selections, never rewrite legacy order snapshots on read. */
  async resolveOrder(input: DeviceInput) {
    if (!input.deviceBrandId && !input.deviceModelId) return {};
    if (catalogKey(input.deviceType ?? '') !== 'celular')
      throw new BadRequestException(
        'El catálogo aplica a la categoría CELULAR.',
      );
    if (!input.deviceBrandId)
      throw new BadRequestException(
        'El modelo requiere una marca de catálogo.',
      );
    const brand = await this.getBrand(input.deviceBrandId);
    if (!brand.active)
      throw new BadRequestException('La marca está desactivada.');
    let deviceModel = input.deviceModel;
    if (input.deviceModelId) {
      const model = await this.getModel(input.deviceModelId);
      if (
        !model.active ||
        model.category !== 'phone' ||
        model.brandId !== input.deviceBrandId
      )
        throw new BadRequestException(
          'El modelo no está disponible o no pertenece a la marca.',
        );
      deviceModel = model.name;
    }
    return {
      deviceBrand: brand.name,
      ...(input.deviceModelId ? { deviceModel } : {}),
    };
  }
  async rememberManual(input: DeviceInput): Promise<void> {
    if (
      catalogKey(input.deviceType ?? '') !== 'celular' ||
      (input.deviceBrandId && input.deviceModelId)
    )
      return;
    const name = catalogName(input.deviceBrand ?? '');
    if (!name || name.length > 120) return;
    try {
      if (!input.deviceBrandId) {
        try {
          await this.brands.updateOne(
            { normalizedName: catalogKey(name) },
            {
              $setOnInsert: {
                name,
                normalizedName: catalogKey(name),
                active: true,
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
        }
      }
      const brand = input.deviceBrandId
        ? await this.getBrand(input.deviceBrandId)
        : await this.brands.findOne({
            where: { normalizedName: catalogKey(name) },
          });
      const model = catalogName(input.deviceModel ?? '');
      if (!brand?.active || !model || model.length > 120 || input.deviceModelId)
        return;
      try {
        await this.models.updateOne(
          {
            brandId: brand._id.toHexString(),
            normalizedName: catalogKey(model),
          },
          {
            $setOnInsert: {
              brandId: brand._id.toHexString(),
              name: model,
              normalizedName: catalogKey(model),
              active: true,
              category: 'phone',
              source: 'manual-order',
              variants: [],
              searchKeys: [
                ...new Set([
                  catalogKey(model),
                  ...catalogKey(model).split(' '),
                ]),
              ],
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    } catch {
      this.logger.warn('device_catalog.manual_registration_failed');
    }
  }
  async resolveUpdate(order: DeviceInput, update: DeviceInput) {
    const fields = [
      'deviceType',
      'deviceBrand',
      'deviceModel',
      'deviceBrandId',
      'deviceModelId',
    ] as const;
    if (
      !fields.some(
        (key) => update[key] !== undefined && update[key] !== order[key],
      )
    )
      return {};
    const effective = { ...order, ...update };
    const changedType =
      update.deviceType !== undefined && update.deviceType !== order.deviceType;
    const manualBrandChange =
      update.deviceBrand !== undefined &&
      update.deviceBrand !== order.deviceBrand &&
      update.deviceBrandId === undefined;
    if (changedType || manualBrandChange) {
      if (update.deviceBrandId === undefined) effective.deviceBrandId = null;
      if (update.deviceModelId === undefined) effective.deviceModelId = null;
    }
    if (
      update.deviceBrandId !== undefined &&
      update.deviceBrandId !== order.deviceBrandId &&
      update.deviceModelId === undefined
    )
      effective.deviceModelId = null;
    if (
      update.deviceModel !== undefined &&
      update.deviceModel !== order.deviceModel &&
      update.deviceModelId === undefined
    )
      effective.deviceModelId = null;
    const resolved = await this.resolveOrder(effective);
    return {
      deviceBrandId: effective.deviceBrandId ?? null,
      deviceModelId: effective.deviceModelId ?? null,
      ...resolved,
    };
  }
}
