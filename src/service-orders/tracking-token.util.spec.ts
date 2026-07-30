import { createTrackingToken, readTrackingToken } from './tracking-token.util';

describe('tracking token', () => {
  const secret = 'test-tracking-secret';

  it('round-trips a valid order id', () => {
    const orderId = '67d0f4a5f99f719467f91a07';
    expect(
      readTrackingToken(createTrackingToken(orderId, secret), secret),
    ).toBe(orderId);
  });

  it('rejects a modified signature', () => {
    const token = createTrackingToken('67d0f4a5f99f719467f91a07', secret);
    expect(readTrackingToken(`${token.slice(0, -1)}x`, secret)).toBeUndefined();
  });
});
