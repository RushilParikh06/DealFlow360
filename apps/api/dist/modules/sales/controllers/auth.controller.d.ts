import { LoginDto, RefreshDto, SignupDto } from '../dto/auth.dto';
import { AuthService, type TokenPair } from '../services/auth.service';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    signup(dto: SignupDto): Promise<TokenPair>;
    login(dto: LoginDto): Promise<TokenPair>;
    refresh(dto: RefreshDto): Promise<TokenPair>;
}
