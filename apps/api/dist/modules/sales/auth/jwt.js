"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttlToSeconds = ttlToSeconds;
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
// B1 owned. Plain HMAC-SHA256 JWT (header.payload.signature, base64url) using
// only node:crypto - the stack calls for JWT access/refresh tokens, not for a
// specific library, and this is a dozen lines against adding one.
const node_crypto_1 = require("node:crypto");
const app_error_1 = require("../../shared/app-error");
const contracts_1 = require("@dealflow/contracts");
function base64url(input) {
    return Buffer.from(input).toString('base64url');
}
function sign(data, secret) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(data).digest('base64url');
}
/** ttl like "15m", "7d", "30s". */
function ttlToSeconds(ttl) {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match)
        throw new Error(`invalid ttl "${ttl}"`);
    const value = Number(match[1]);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
    return value * unit;
}
function signJwt(payload, secret, ttl) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const exp = Math.floor(Date.now() / 1000) + ttlToSeconds(ttl);
    const body = base64url(JSON.stringify({ ...payload, exp }));
    const signature = sign(`${header}.${body}`, secret);
    return `${header}.${body}.${signature}`;
}
function verifyJwt(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Malformed token.');
    }
    const [header, body, signature] = parts;
    const expected = sign(`${header}.${body}`, secret);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b)) {
        throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Invalid token signature.');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new app_error_1.AppError(contracts_1.ErrorCode.UNAUTHENTICATED, 'Token expired.');
    }
    return payload;
}
//# sourceMappingURL=jwt.js.map