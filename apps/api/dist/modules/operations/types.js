"use strict";
// Local to B3 until packages/contracts exists (group-owned, per plan.md section 3).
// Move this file there verbatim once F/B1/B2 scaffold the workspace - do not
// duplicate the definition in billing/, import it from here instead.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.applyBps = applyBps;
exports.addMoney = addMoney;
/** Round-half-up integer bps math. Money is never a float (plan.md #5.1). */
function applyBps(amountMinor, bps) {
    return Math.round((amountMinor * bps) / 10000);
}
function addMoney(a, b) {
    if (a.currency !== b.currency) {
        throw new AppError('VALIDATION_FAILED', `currency mismatch: ${a.currency} vs ${b.currency}`);
    }
    return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}
/** One error shape for the whole B3 surface, matching plan.md section 8's envelope. */
class AppError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}
exports.AppError = AppError;
//# sourceMappingURL=types.js.map