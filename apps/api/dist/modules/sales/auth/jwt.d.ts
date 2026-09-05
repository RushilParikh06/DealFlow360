export interface JwtPayload {
    sub: string;
    role: string;
    customerId: string | null;
    /** Access and refresh tokens are NOT interchangeable - the guard accepts
     *  'access' only, so a leaked refresh token cannot be used as a bearer
     *  credential and stays revocable through the refresh_tokens table. */
    typ: 'access' | 'refresh';
    exp: number;
}
/** ttl like "15m", "7d", "30s". */
export declare function ttlToSeconds(ttl: string): number;
export declare function signJwt(payload: Omit<JwtPayload, 'exp'>, secret: string, ttl: string): string;
export declare function verifyJwt(token: string, secret: string): JwtPayload;
