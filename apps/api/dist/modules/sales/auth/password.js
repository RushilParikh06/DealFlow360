"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
// B1 owned. Format `scrypt$salt$hash` matches prisma/seed/base.seed.ts's
// placeholder exactly, so seeded users log in without a re-seed.
const node_crypto_1 = require("node:crypto");
const KEY_LEN = 32;
function hashPassword(password) {
    const salt = (0, node_crypto_1.randomBytes)(8).toString('hex');
    return `scrypt$${salt}$${(0, node_crypto_1.scryptSync)(password, salt, KEY_LEN).toString('hex')}`;
}
function verifyPassword(password, stored) {
    const [scheme, salt, hex] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hex)
        return false;
    const expected = Buffer.from(hex, 'hex');
    const actual = (0, node_crypto_1.scryptSync)(password, salt, KEY_LEN);
    return expected.length === actual.length && (0, node_crypto_1.timingSafeEqual)(expected, actual);
}
//# sourceMappingURL=password.js.map