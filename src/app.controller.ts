import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check / mensaje de bienvenida' })
  @ApiResponse({ status: 200, description: 'Mensaje de bienvenida' })
  getHello(): string {
    return this.appService.getHello();
  }
}
