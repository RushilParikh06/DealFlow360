"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
// GROUP OWNED.
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("./app-error");
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    const user = ctx.switchToHttp().getRequest().user;
    if (!user)
        throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'No authenticated user on request.');
    return user;
});
//# sourceMappingURL=current-user.js.map