import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AspiranteLoginDto } from './dto/aspirante-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import { FlowStepNavigationResponseDto } from './dto/flow-step-navigation-response.dto';
import { Public } from './decorators/public.decorator';
import { AspiranteOnlyGuard } from './guards/aspirante-only.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login de administradores y evaluadores' })
  @ApiResponse({
    status: 200,
    description: 'Token JWT generado',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async loginAdmin(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto);
  }

  @Public()
  @Post('aspirante/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login de aspirantes (requiere slug del hospital)' })
  @ApiResponse({
    status: 200,
    description: 'Token JWT generado',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async loginAspirante(@Body() dto: AspiranteLoginDto) {
    return this.authService.loginAspirante(dto);
  }

  @Public()
  @Get('aspirante/validar-token')
  @ApiOperation({
    summary: 'Validar token de primer acceso (por tenant). Requiere slug.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token válido o no',
    schema: {
      oneOf: [
        {
          properties: { valido: { type: 'boolean', example: true }, hospitalNombre: { type: 'string' }, slug: { type: 'string' } },
        },
        { properties: { valido: { type: 'boolean', example: false } } },
      ],
    },
  })
  async validarToken(
    @Query('token') token: string,
    @Query('slug') slug: string,
  ) {
    return this.authService.validarToken(token ?? '', slug ?? '');
  }

  @Public()
  @Post('aspirante/activar-cuenta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar cuenta con token de primer acceso (por tenant)' })
  @ApiResponse({
    status: 200,
    description: 'Cuenta activada. Incluye accessToken para login automático.',
  })
  @ApiResponse({ status: 400, description: 'Token inválido, expirado o datos no coinciden' })
  async activarCuenta(@Body() dto: ActivarCuentaDto) {
    return this.authService.activarCuenta(dto);
  }

  @Post('aspirante/next-step')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AspiranteOnlyGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Avanzar un paso en el flujo (order_id + 1). Si no existe siguiente paso, no actualiza BD ni token (fin de flujo).',
  })
  @ApiOkResponse({ type: FlowStepNavigationResponseDto })
  @ApiResponse({ status: 403, description: 'No es token de aspirante' })
  async nextFlowStep(@CurrentUser() user: JwtPayloadAspirante) {
    return this.authService.nextFlowStep(user);
  }

  @Post('aspirante/previous-step')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AspiranteOnlyGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Retroceder un paso en el flujo (order_id - 1). Si order_id actual es 1, no actualiza (inicio de flujo).',
  })
  @ApiOkResponse({ type: FlowStepNavigationResponseDto })
  @ApiResponse({ status: 403, description: 'No es token de aspirante' })
  async previousFlowStep(@CurrentUser() user: JwtPayloadAspirante) {
    return this.authService.previousFlowStep(user);
  }
}
