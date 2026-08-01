type Environment = Record<string, unknown>;

const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;
const PRINT_PROFILE_VALUES = ['thermal_escpos', 'system_pdf'] as const;
const PAPER_SIZE_VALUES = ['A4', 'LETTER'] as const;

function optionalString(
  environment: Environment,
  key: string,
): string | undefined {
  const value = environment[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${key} debe ser texto.`);
  }
  return value.trim();
}

function isPlaceholderSecret(value?: string): boolean {
  return Boolean(
    !value ||
    value === 'changeme' ||
    value === 'tu_token_seguro' ||
    value?.startsWith('replace-'),
  );
}

function requiredSecret(environment: Environment, key: string): string {
  const value = optionalString(environment, key);
  if (isPlaceholderSecret(value)) {
    throw new Error(`${key} debe configurarse con un secreto seguro.`);
  }
  return value as string;
}

function integerValue(
  environment: Environment,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = environment[key] ?? fallback;
  if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    throw new Error(`${key} debe ser un número.`);
  }
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return value;
}

function enumValue<T extends string>(
  environment: Environment,
  key: string,
  allowedValues: readonly T[],
  fallback: T,
): T {
  const value = optionalString(environment, key) ?? fallback;
  if (!allowedValues.includes(value as T)) {
    throw new Error(`${key} debe ser uno de: ${allowedValues.join(', ')}.`);
  }
  return value as T;
}

function corsOrigins(environment: Environment): string {
  const configured = optionalString(environment, 'CORS_ORIGINS');
  if (!configured) {
    return [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://st.serviciosasm.cl',
      'https://serviciotecnico-front.pages.dev',
    ].join(',');
  }

  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS debe contener al menos un origen.');
  }
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error(`CORS_ORIGINS contiene un origen inválido: ${origin}.`);
    }
  }
  return origins.join(',');
}

export function validateEnvironment(input: Environment): Environment {
  const environment = { ...input };
  const nodeEnvironment = enumValue(
    environment,
    'NODE_ENV',
    NODE_ENV_VALUES,
    'development',
  );

  if (nodeEnvironment === 'test') {
    environment.JWT_SECRET ??= 'test-only-jwt-secret';
    environment.PRINT_TOKEN ??= 'test-only-print-token';
    environment.TRACKING_SECRET ??= 'test-only-tracking-secret';
  }

  const jwtSecret = requiredSecret(environment, 'JWT_SECRET');
  const printToken = requiredSecret(environment, 'PRINT_TOKEN');
  const configuredTrackingSecret = optionalString(
    environment,
    'TRACKING_SECRET',
  );
  const trackingSecret = !isPlaceholderSecret(configuredTrackingSecret)
    ? requiredSecret(environment, 'TRACKING_SECRET')
    : jwtSecret;

  if (
    nodeEnvironment === 'production' &&
    !optionalString(environment, 'MONGODB_URI')
  ) {
    throw new Error('MONGODB_URI es obligatorio en producción.');
  }

  return {
    ...environment,
    NODE_ENV: nodeEnvironment,
    PORT: integerValue(environment, 'PORT', 3500, 1, 65535),
    CORS_ORIGINS: corsOrigins(environment),
    JWT_SECRET: jwtSecret,
    PRINT_TOKEN: printToken,
    TRACKING_SECRET: trackingSecret,
    TRACKING_RETENTION_DAYS: integerValue(
      environment,
      'TRACKING_RETENTION_DAYS',
      30,
      1,
      3650,
    ),
    MONGODB_URI:
      optionalString(environment, 'MONGODB_URI') ?? 'mongodb://localhost:27017',
    MONGODB_DB: optionalString(environment, 'MONGODB_DB') ?? 'serviciotecnico',
    DEFAULT_PRINTER_ID:
      optionalString(environment, 'DEFAULT_PRINTER_ID') ?? 'default-printer',
    PRINT_PROFILE: enumValue(
      environment,
      'PRINT_PROFILE',
      PRINT_PROFILE_VALUES,
      'thermal_escpos',
    ),
    SYSTEM_PAPER_SIZE: enumValue(
      environment,
      'SYSTEM_PAPER_SIZE',
      PAPER_SIZE_VALUES,
      'LETTER',
    ),
    PRINT_ACK_TIMEOUT_MS: integerValue(
      environment,
      'PRINT_ACK_TIMEOUT_MS',
      5000,
      100,
      60000,
    ),
    PUBLIC_TRACKING_BASE_URL:
      optionalString(environment, 'PUBLIC_TRACKING_BASE_URL') ??
      'http://localhost:5173',
    SWAGGER_PATH: optionalString(environment, 'SWAGGER_PATH') ?? 'api',
    SWAGGER_TITLE:
      optionalString(environment, 'SWAGGER_TITLE') ?? 'Servicio Tecnico API',
    SWAGGER_DESCRIPTION:
      optionalString(environment, 'SWAGGER_DESCRIPTION') ??
      'API para gestion de servicio tecnico',
    SWAGGER_VERSION: optionalString(environment, 'SWAGGER_VERSION') ?? '1.0',
  };
}
