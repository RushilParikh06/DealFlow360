"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionSubscription = transitionSubscription;
exports.nextBillingDate = nextBillingDate;
const types_1 = require("../../operations/types");
const TRANSITIONS = {
    ACTIVE: ['PAUSED', 'CANCELLED'],
    PAUSED: ['ACTIVE', 'CANCELLED'],
    CANCELLED: [],
};
/** The only function allowed to move a subscription between states. */
function transitionSubscription(from, to) {
    if (!TRANSITIONS[from].includes(to)) {
        throw new types_1.AppError('SUBSCRIPTION_INVALID_STATE', `cannot move subscription from ${from} to ${to}`, { from, to });
    }
    return to;
}
/**
 * Next billing date, cadence in whole months. No proration on plan changes
 * (README limitations) - a change takes effect on the next cycle, not mid-cycle.
 */
function nextBillingDate(from, cadenceMonths) {
    const next = new Date(from);
    next.setMonth(next.getMonth() + cadenceMonths);
    return next;
}
//# sourceMappingURL=subscription.service.js.map