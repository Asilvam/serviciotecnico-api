import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

function buildCorsOrigins(configService: ConfigService): string[] {
  return configService
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerTitle = configService.getOrThrow<string>('SWAGGER_TITLE');
  const swaggerDescription = configService.getOrThrow<string>(
    'SWAGGER_DESCRIPTION',
  );
  const swaggerVersion = configService.getOrThrow<string>('SWAGGER_VERSION');
  const swaggerPath = configService.getOrThrow<string>('SWAGGER_PATH');

  const config = new DocumentBuilder()
    .setTitle(swaggerTitle)
    .setDescription(swaggerDescription)
    .setVersion(swaggerVersion)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: `${swaggerTitle} Docs`,
  });

  app.enableCors({
    origin: buildCorsOrigins(configService),
    credentials: true,
  });

  await app.listen(configService.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap();
