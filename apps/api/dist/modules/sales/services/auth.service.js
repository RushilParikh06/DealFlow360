"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// B1 owned. POST /auth/login | /auth/signup | /auth/refresh (plan.md section 8).
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
const password_1 = require("../auth/password");
const jwt_1 = require("../auth/jwt");
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '7d';
const secret = () => process.env.JWT_SECRET ?? 'dev-only-change-me';
function hashToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
let AuthService = class AuthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async issueTokens(user) {
        const claims = { sub: user.id, role: user.role, customerId: user.customerId };
        const accessToken = (0, jwt_1.signJwt)({ ...claims, typ: 'access' }, secret(), ACCESS_TTL);
        const refreshToken = (0, jwt_1.signJwt)({ ...claims, typ: 'refresh' }, secret(), REFRESH_TTL);
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: hashToken(refreshToken),
                expiresAt: new Date(Date.now() + (0, jwt_1.ttlToSeconds)(REFRESH_TTL) * 1000),
            },
        });
        return { accessToken, refreshToken };
    }
    /** Internal signup only - SALES_REP by default. Customer accounts are provisioned separately. */
    async signup(email, name, password) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.VALIDATION_FAILED, 'An account with this email already exists.', { email });
        }
        const user = await this.prisma.user.create({
            data: { email, name, passwordHash: (0, password_1.hashPassword)(password), role: contracts_1.UserRole.SALES_REP },
        });
        return this.issueTokens({ id: user.id, role: user.role, customerId: user.customerId });
    }
    async login(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !(0, password_1.verifyPassword)(password, user.passwordHash)) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Invalid email or password.');
        }
        return this.issueTokens({ id: user.id, role: user.role, customerId: user.customerId });
    }
    async refresh(refreshToken) {
        const payload = (0, jwt_1.verifyJwt)(refreshToken, secret());
        if (payload.typ !== 'refresh') {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Not a refresh token.');
        }
        const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
        if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Refresh token is invalid or revoked.');
        }
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'User no longer exists.');
        }
        // rotate: revoke the used token, issue a new pair
        await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
        return this.issueTokens({ id: user.id, role: user.role, customerId: user.customerId });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map