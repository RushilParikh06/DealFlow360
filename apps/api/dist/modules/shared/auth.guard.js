"use strict";
// GROUP OWNED - and TEMPORARY in its dev half.
//
// AUTH_MODE=dev still lets anyone exercise a role-guarded endpoint by sending
// two headers, useful for exploring the API without a login round trip:
//
//   x-dev-user-id: usr_manager
//   x-dev-role: SALES_MANAGER
//
// AUTH_MODE=jwt is the real path: B1's guard below verifies the bearer token
// signed by apps/api/src/modules/sales/services/auth.service.ts.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("./app-error");
const jwt_1 = require("../sales/auth/jwt");
const VALID_ROLES = new Set(Object.values(contracts_1.UserRole));
let AuthGuard = class AuthGuard {
    canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        if ((process.env.AUTH_MODE ?? 'dev') === 'dev') {
            const id = req.headers['x-dev-user-id'];
            const role = req.headers['x-dev-role'];
            if (!id || !role) {
                throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'AUTH_MODE=dev requires x-dev-user-id and x-dev-role headers.');
            }
            if (!VALID_ROLES.has(role)) {
                throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, `Unknown role "${role}".`);
            }
            req.user = {
                id,
                role: role,
                customerId: req.headers['x-dev-customer-id'] ?? null,
            };
            return true;
        }
        const auth = req.headers['authorization'];
        if (!auth?.startsWith('Bearer ')) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Missing bearer token.');
        }
        const payload = (0, jwt_1.verifyJwt)(auth.slice('Bearer '.length), process.env.JWT_SECRET ?? 'dev-only-change-me');
        // A refresh token is long-lived and revocable through refresh_tokens; the
        // guard never consults that table, so it must not accept one as a bearer.
        if (payload.typ !== 'access') {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'A refresh token cannot be used as a bearer token.');
        }
        if (!VALID_ROLES.has(payload.role)) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, `Unknown role "${payload.role}".`);
        }
        req.user = { id: payload.sub, role: payload.role, customerId: payload.customerId };
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)()
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map