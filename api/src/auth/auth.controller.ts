import {Controller,Post,Get,Body,HttpCode,HttpStatus,} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './types/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {} 

  // Token olmadan giriş yapılabilir
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Token sahibi kendi bilgilerini görüntüler
  @ApiBearerAuth('access-token')
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }
}
