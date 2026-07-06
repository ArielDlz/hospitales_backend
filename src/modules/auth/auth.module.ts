import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { AspiranteOnlyGuard } from './guards/aspirante-only.guard';
import { TenantScopeGuard } from './guards/tenant-scope.guard';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { EvaluadorTenant } from '../usuario-administrativo/entities/evaluador-tenant.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { EvaluationFlowStep } from '../aspirante/evaluation-flow-step.entity';
import { Hospital } from '../hospital/hospital.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsuarioAdministrativo,
      EvaluadorTenant,
      Aspirante,
      EvaluationFlowStep,
      Hospital,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string>('JWT_EXPIRES_IN', '7d');
        const opts: JwtModuleOptions = {
          secret: config.get<string>('JWT_SECRET')!,
          signOptions: { expiresIn: expiresIn as '7d' | '24h' | '15m' | '1d' },
        };
        return opts;
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    AdminOnlyGuard,
    AspiranteOnlyGuard,
    TenantScopeGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    AdminOnlyGuard,
    AspiranteOnlyGuard,
    TenantScopeGuard,
  ],
})
export class AuthModule {}
