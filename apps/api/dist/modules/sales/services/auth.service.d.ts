import { PrismaService } from '../../shared/prisma.service';
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
export declare class AuthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private issueTokens;
    /** Internal signup only - SALES_REP by default. Customer accounts are provisioned separately. */
    signup(email: string, name: string, password: string): Promise<TokenPair>;
    login(email: string, password: string): Promise<TokenPair>;
    refresh(refreshToken: string): Promise<TokenPair>;
}
