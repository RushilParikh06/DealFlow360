"use strict";
// A port is how one owner's module calls another owner's without importing it.
// B2 must never write quotations.status itself (plan.md invariant 5), so B2
// depends on this interface and B1 provides the implementation.
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUOTE_STATE_PORT = void 0;
exports.QUOTE_STATE_PORT = 'QUOTE_STATE_PORT';
//# sourceMappingURL=ports.js.map