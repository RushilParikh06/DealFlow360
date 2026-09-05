"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionReservation = transitionReservation;
exports.availableQty = availableQty;
exports.reserveStock = reserveStock;
const types_1 = require("../types");
// Plan.md section 7: "AVAILABLE -> RESERVED -> ALLOCATED -> SHIPPED", cancellation
// releases from RESERVED or ALLOCATED back to AVAILABLE. Anything else throws.
const TRANSITIONS = {
    AVAILABLE: ['RESERVED'],
    RESERVED: ['ALLOCATED', 'RELEASED'],
    ALLOCATED: ['SHIPPED', 'RELEASED'],
    SHIPPED: [],
    RELEASED: ['RESERVED'],
};
/** The only function allowed to move a reservation between states. */
function transitionReservation(from, to) {
    if (!TRANSITIONS[from].includes(to)) {
        throw new types_1.AppError('QUOTE_INVALID_STATE', `cannot move reservation from ${from} to ${to}`, { from, to });
    }
    return to;
}
/** Available stock is derived, never stored (plan.md section 6). */
function availableQty(onHand, reserved) {
    return onHand - reserved;
}
/** Guards a reservation request against the derived available quantity. */
function reserveStock(onHand, reserved, qty) {
    if (qty > availableQty(onHand, reserved)) {
        throw new types_1.AppError('INSUFFICIENT_STOCK', 'not enough stock to reserve', { onHand, reserved, requested: qty });
    }
    return reserved + qty;
}
//# sourceMappingURL=inventory-state.service.js.map