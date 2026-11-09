import { BadRequestException } from '@nestjs/common';

export function todayInChile(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function deliveryCalendarDate(value?: string | Date | null): string {
  if (!value) return '';
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}
export function validateEstimatedDelivery(
  value?: string | Date | null,
  previous?: string | Date | null,
  now = new Date(),
): void {
  const date = deliveryCalendarDate(value);
  if (!date || date === deliveryCalendarDate(previous)) return;
  if (date < todayInChile(now))
    throw new BadRequestException(
      'La fecha estimada no puede ser anterior a hoy.',
    );
}
