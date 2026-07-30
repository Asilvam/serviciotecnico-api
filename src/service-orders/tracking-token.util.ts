import { createHmac, timingSafeEqual } from 'node:crypto';

function signatureFor(encodedOrderId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(encodedOrderId)
    .digest('base64url');
}

export function createTrackingToken(orderId: string, secret: string): string {
  const encodedOrderId = Buffer.from(orderId, 'utf8').toString('base64url');
  return `${encodedOrderId}.${signatureFor(encodedOrderId, secret)}`;
}

export function readTrackingToken(
  token: string,
  secret: string,
): string | undefined {
  const [encodedOrderId, suppliedSignature, extra] = token.split('.');
  if (!encodedOrderId || !suppliedSignature || extra) {
    return undefined;
  }

  const expectedSignature = signatureFor(encodedOrderId, secret);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return undefined;
  }

  try {
    const orderId = Buffer.from(encodedOrderId, 'base64url').toString('utf8');
    return /^[a-f\d]{24}$/i.test(orderId) ? orderId : undefined;
  } catch {
    return undefined;
  }
}
