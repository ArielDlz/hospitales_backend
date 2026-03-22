import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function parseCorsOrigins(value: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function isOriginAllowed(origin: string, patterns: string[]): boolean {
  if (!origin || !patterns.length) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    for (const pattern of patterns) {
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2); // *.arieldelao.dev -> arieldelao.dev
        if (host === domain || host.endsWith('.' + domain)) return true;
      } else if (host === pattern || host.endsWith('.' + pattern)) {
        return true;
      } else if (pattern === '*' || host === pattern) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const configService = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS', ''),
  );

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        callback(null, isOriginAllowed(origin, corsOrigins));
      },
      credentials: true,
    });
  }

  const config = new DocumentBuilder()
    .setTitle('Hospitales API')
    .setDescription('API de gestión de hospitales')
    .setVersion('1.0')
    .addTag('hospitales')
    .addTag('aspirantes')
    .addTag('auth')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
  console.log(`Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
