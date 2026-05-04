import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerTitle = process.env.SWAGGER_TITLE ?? 'Servicio Tecnico API';
  const swaggerDescription = process.env.SWAGGER_DESCRIPTION ?? 'API para gestion de servicio tecnico';
  const swaggerVersion = process.env.SWAGGER_VERSION ?? '1.0';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api';

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

  app.enableCors();

  await app.listen(process.env.PORT ?? 3500);
}
void bootstrap();
