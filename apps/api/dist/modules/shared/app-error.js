"use strict";
// GROUP OWNED. One error envelope, one stable code constant (plan.md invariant 8).
// Throw AppError everywhere. The filter turns it into the documented body and
// picks the HTTP status from the code table, so no handler chooses a status.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const contracts_1 = require("@dealflow/contracts");
class AppError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
    get status() {
        return contracts_1.ERROR_HTTP_STATUS[this.code] ?? 500;
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app-error.js.map