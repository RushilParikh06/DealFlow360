"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_1 = require("./jwt");
const SECRET = 'test-secret';
const claims = { sub: 'usr_1', role: 'SALES_REP', customerId: null, typ: 'access' };
describe('jwt', () => {
    it('round-trips a payload', () => {
        const token = (0, jwt_1.signJwt)(claims, SECRET, '15m');
        const payload = (0, jwt_1.verifyJwt)(token, SECRET);
        expect(payload.sub).toBe('usr_1');
        expect(payload.role).toBe('SALES_REP');
    });
    it('carries the token type so access and refresh are not interchangeable', () => {
        expect((0, jwt_1.verifyJwt)((0, jwt_1.signJwt)(claims, SECRET, '15m'), SECRET).typ).toBe('access');
        expect((0, jwt_1.verifyJwt)((0, jwt_1.signJwt)({ ...claims, typ: 'refresh' }, SECRET, '7d'), SECRET).typ).toBe('refresh');
    });
    it('rejects a token signed with a different secret', () => {
        const token = (0, jwt_1.signJwt)(claims, SECRET, '15m');
        expect(() => (0, jwt_1.verifyJwt)(token, 'other-secret')).toThrow();
    });
    it('rejects a tampered payload', () => {
        const token = (0, jwt_1.signJwt)(claims, SECRET, '15m');
        const [header, , signature] = token.split('.');
        const forgedBody = Buffer.from(JSON.stringify({ sub: 'usr_2', role: 'ADMIN', exp: 9_999_999_999 })).toString('base64url');
        expect(() => (0, jwt_1.verifyJwt)(`${header}.${forgedBody}.${signature}`, SECRET)).toThrow();
    });
    it('rejects an expired token', () => {
        const token = (0, jwt_1.signJwt)(claims, SECRET, '0s');
        expect(() => (0, jwt_1.verifyJwt)(token, SECRET)).toThrow();
    });
    it('parses ttl units', () => {
        expect((0, jwt_1.ttlToSeconds)('30s')).toBe(30);
        expect((0, jwt_1.ttlToSeconds)('15m')).toBe(900);
        expect((0, jwt_1.ttlToSeconds)('7d')).toBe(604800);
    });
});
//# sourceMappingURL=jwt.spec.js.map