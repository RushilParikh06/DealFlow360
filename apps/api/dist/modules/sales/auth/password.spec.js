"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const password_1 = require("./password");
describe('password hashing', () => {
    it('verifies the correct password', () => {
        const stored = (0, password_1.hashPassword)('correct-horse-battery-staple');
        expect((0, password_1.verifyPassword)('correct-horse-battery-staple', stored)).toBe(true);
    });
    it('rejects the wrong password', () => {
        const stored = (0, password_1.hashPassword)('correct-horse-battery-staple');
        expect((0, password_1.verifyPassword)('wrong-password', stored)).toBe(false);
    });
    it('salts each hash differently', () => {
        expect((0, password_1.hashPassword)('same-password')).not.toEqual((0, password_1.hashPassword)('same-password'));
    });
    it('rejects a malformed stored value instead of throwing', () => {
        expect((0, password_1.verifyPassword)('anything', 'not-a-real-hash')).toBe(false);
    });
});
//# sourceMappingURL=password.spec.js.map