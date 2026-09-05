"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionFulfillment = transitionFulfillment;
const types_1 = require("../../operations/types");
// Plan.md section 7. BACKORDERED can be entered from reservation (stock came up
// short) and left once inventory arrives, re-joining the normal path.
const TRANSITIONS = {
    ORDER_CONFIRMED: ['INVENTORY_RESERVED', 'BACKORDERED'],
    INVENTORY_RESERVED: ['PICKING', 'BACKORDERED'],
    PICKING: ['PACKED'],
    PACKED: ['SHIPPED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    BACKORDERED: ['INVENTORY_RESERVED'],
};
/** The only function allowed to move a fulfillment between states. */
function transitionFulfillment(from, to) {
    if (!TRANSITIONS[from].includes(to)) {
        throw new types_1.AppError('QUOTE_INVALID_STATE', `cannot move fulfillment from ${from} to ${to}`, { from, to });
    }
    return to;
}
//# sourceMappingURL=fulfillment-state.service.js.map