import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleDriveOauth } from './google-drive-oauth.entity';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { AuthModule } from '../auth/auth.module';
import { SuperuserGuard } from '../auth/guards/superuser.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoogleDriveOauth, UsuarioAdministrativo]),
    AuthModule,
  ],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveService, SuperuserGuard],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
