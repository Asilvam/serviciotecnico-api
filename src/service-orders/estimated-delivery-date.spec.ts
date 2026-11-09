import { BadRequestException } from '@nestjs/common';
import {
  todayInChile,
  validateEstimatedDelivery,
} from './estimated-delivery-date';
const now = new Date('2026-11-09T12:00:00Z');
describe('estimated delivery calendar date', () => {
  it('uses the Chile day rather than the UTC day at midnight', () => {
    expect(todayInChile(new Date('2026-11-09T02:30:00Z'))).toBe('2026-11-08');
    expect(todayInChile(new Date('2026-11-09T03:30:00Z'))).toBe('2026-11-09');
  });
  it('accepts today and future dates', () => {
    expect(() =>
      validateEstimatedDelivery('2026-11-09', undefined, now),
    ).not.toThrow();
    expect(() =>
      validateEstimatedDelivery('2026-11-10', undefined, now),
    ).not.toThrow();
  });
  it('rejects new or rescheduled dates in the past', () => {
    expect(() =>
      validateEstimatedDelivery('2026-11-08', undefined, now),
    ).toThrow(BadRequestException);
    expect(() =>
      validateEstimatedDelivery('2026-11-07', '2026-11-06', now),
    ).toThrow(BadRequestException);
  });
  it('keeps historical dates unchanged when editing other fields', () => {
    expect(() =>
      validateEstimatedDelivery(
        '2026-11-06',
        new Date('2026-11-06T00:00:00Z'),
        now,
      ),
    ).not.toThrow();
    expect(() =>
      validateEstimatedDelivery(undefined, '2026-11-06', now),
    ).not.toThrow();
  });
});
