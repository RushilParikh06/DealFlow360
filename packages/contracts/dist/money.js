"use strict";
// GROUP OWNED BY PROTOCOL. plan.md invariant 1.
// Money is an integer in minor units plus a currency code. No floats, anywhere.
// Percentages are basis points: 18 percent is 1800.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sum = exports.clamp = exports.asBps = exports.applyBps = exports.roundHalfUp = exports.BPS_SCALE = exports.money = void 0;
const money = (amountMinor, currency) => ({
    amountMinor: Math.round(amountMinor),
    currency,
});
exports.money = money;
exports.BPS_SCALE = 10_000;
/** Half-up rounding that behaves the same for negative values. Never Math.round on money. */
const roundHalfUp = (value) => value >= 0 ? Math.floor(value + 0.5) : -Math.floor(-value + 0.5);
exports.roundHalfUp = roundHalfUp;
/** Apply a basis-point rate to a minor-unit amount and stay an integer. */
const applyBps = (amountMinor, bps) => (0, exports.roundHalfUp)((amountMinor * bps) / exports.BPS_SCALE);
exports.applyBps = applyBps;
/** part / whole expressed in basis points. Returns 0 when whole is 0. */
const asBps = (part, whole) => whole === 0 ? 0 : (0, exports.roundHalfUp)((part * exports.BPS_SCALE) / whole);
exports.asBps = asBps;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
exports.clamp = clamp;
const sum = (values) => values.reduce((a, b) => a + b, 0);
exports.sum = sum;
//# sourceMappingURL=money.js.map