"use strict";
// GROUP OWNED. Every failure leaves the process in the shape from plan.md
// section 8, including the ones nobody wrote a handler for.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("./app-error");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const res = host.switchToHttp().getResponse();
        if (exception instanceof app_error_1.AppError) {
            const body = {
                success: false,
                error: { code: exception.code, message: exception.message, details: exception.details },
            };
            res.status(exception.status).json(body);
            return;
        }
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const raw = exception.getResponse();
            const message = typeof raw === 'string' ? raw : (Array.isArray(raw?.message) ? raw.message.join('; ') : String(raw?.message ?? exception.message));
            const code = status === 400
                ? contracts_1.ErrorCode.VALIDATION_FAILED
                : status === 401
                    ? contracts_1.ErrorCode.UNAUTHENTICATED
                    : status === 403
                        ? contracts_1.ErrorCode.FORBIDDEN
                        : status === 404
                            ? contracts_1.ErrorCode.NOT_FOUND
                            : contracts_1.ErrorCode.VALIDATION_FAILED;
            const body = { success: false, error: { code, message } };
            res.status(status).json(body);
            return;
        }
        this.logger.error(exception instanceof Error ? exception.stack : String(exception));
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL', message: 'Unexpected server error.' },
        });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map