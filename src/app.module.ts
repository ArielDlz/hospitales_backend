import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HospitalModule } from './modules/hospital/hospital.module';
import { AspiranteModule } from './modules/aspirante/aspirante.module';
import { UsuarioAdministrativoModule } from './modules/usuario-administrativo/usuario-administrativo.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';

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
        SMTP_HOST: Joi.string().allow('').default(''),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().allow('').default(''),
        SMTP_PASS: Joi.string().allow('').default(''),
        MAIL_FROM: Joi.string().allow('').default(''),
        PRIMER_ACCESO_DOMAIN: Joi.string().allow('').default(''),
        PRIMER_ACCESO_PLACEHOLDER: Joi.string().allow('').default('pendiente'),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
