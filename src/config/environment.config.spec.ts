import { validateEnvironment } from './environment.config';

describe('validateEnvironment', () => {
  it('normalizes defaults and numeric values', () => {
    const result = validateEnvironment({
      NODE_ENV: 'development',
      JWT_SECRET: 'jwt-secret-for-tests',
      PRINT_TOKEN: 'print-secret-for-tests',
      PORT: '3600',
      PRINT_ACK_TIMEOUT_MS: '2500',
    });

    expect(result).toEqual(
      expect.objectContaining({
        PORT: 3600,
        PRINT_ACK_TIMEOUT_MS: 2500,
        PRINT_PROFILE: 'thermal_escpos',
        SYSTEM_PAPER_SIZE: 'LETTER',
        TRACKING_RETENTION_DAYS: 30,
        TRACKING_SECRET: 'jwt-secret-for-tests',
      }),
    );
  });

  it('rejects unsupported printer profiles', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        JWT_SECRET: 'jwt-secret-for-tests',
        PRINT_TOKEN: 'print-secret-for-tests',
        PRINT_PROFILE: 'unknown',
      }),
    ).toThrow('PRINT_PROFILE');
  });

  it('rejects placeholder secrets', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: 'changeme',
        PRINT_TOKEN: 'print-secret-for-tests',
        MONGODB_URI: 'mongodb://database/serviciotecnico',
      }),
    ).toThrow('JWT_SECRET');
  });

  it('never uses a tracking placeholder and falls back to JWT_SECRET', () => {
    const result = validateEnvironment({
      NODE_ENV: 'development',
      JWT_SECRET: 'jwt-secret-for-tests',
      PRINT_TOKEN: 'print-secret-for-tests',
      TRACKING_SECRET: 'replace-with-a-different-long-random-secret',
    });

    expect(result.TRACKING_SECRET).toBe('jwt-secret-for-tests');
  });

  it('requires the database URI in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: 'jwt-secret-for-tests',
        PRINT_TOKEN: 'print-secret-for-tests',
      }),
    ).toThrow('MONGODB_URI');
  });
});
