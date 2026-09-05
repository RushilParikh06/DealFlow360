// B1 owned. plan.md section 8: POST /auth/login | /auth/signup | /auth/refresh.
// The only endpoints in the API that do not require a bearer token.
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
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

  /**
   * Who the bearer token belongs to. The token carries only an id and a role,
   * so without this the UI can say "signed in" but never say as whom.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() actor: AuthUser) {
    return this.auth.me(actor.id);
  }
}
