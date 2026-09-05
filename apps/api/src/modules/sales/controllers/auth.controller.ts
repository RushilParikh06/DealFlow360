// B1 owned. plan.md section 8: POST /auth/login | /auth/signup | /auth/refresh.
// The only endpoints in the API that do not require a bearer token.
import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto, RefreshDto, SignupDto } from '../dto/auth.dto';
import { AuthService, type TokenPair } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto): Promise<TokenPair> {
    return this.auth.signup(dto.email, dto.name, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }
}
