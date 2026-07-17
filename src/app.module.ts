import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { HospitalModule } from './modules/hospital/hospital.module';
import { AspiranteModule } from './modules/aspirante/aspirante.module';
import { UsuarioAdministrativoModule } from './modules/usuario-administrativo/usuario-administrativo.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { PruebasModule } from './modules/pruebas/pruebas.module';
import { EvaluacionesModule } from './modules/evaluaciones/evaluaciones.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SolicitudesAccesoModule } from './modules/solicitudes-acceso/solicitudes-acceso.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        CORS_ORIGINS: Joi.string().allow('').default(''),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        BREVO_API_KEY: Joi.string().allow('').default(''),
        MAIL_FROM: Joi.string().email().allow('').default('registro@arieldelao.dev'),
        MAIL_FROM_NAME: Joi.string().allow('').default('Registro'),
        ADMIN_NOTIFY_EMAIL: Joi.string().email().allow('').default(''),
        PRIMER_ACCESO_DOMAIN: Joi.string().allow('').default(''),
        PRIMER_ACCESO_PLACEHOLDER: Joi.string().allow('').default('pendiente'),
        ADMIN_LOGIN_DOMAIN: Joi.string().allow('').default('admin.arieldelao.dev'),
        AWS_REGION: Joi.string().default('us-east-2'),
        AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
        AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
        S3_BUCKET: Joi.string().required(),
        S3_PUBLIC_BASE_URL: Joi.string().uri().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        STRIPE_PRICE_ID: Joi.string().required(),
        STRIPE_REQUEST_THREE_D_SECURE: Joi.string()
          .valid('any', 'challenge')
          .default('challenge'),
        STRIPE_BILLING_COUNTRY: Joi.string().length(2).uppercase().default('MX'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 5432),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false, // Esquema gestionado manualmente con SQL
      }),
    }),
    HospitalModule,
    AspiranteModule,
    UsuarioAdministrativoModule,
    AuthModule,
    MailModule,
    PruebasModule,
    EvaluacionesModule,
    PaymentsModule,
    SolicitudesAccesoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
