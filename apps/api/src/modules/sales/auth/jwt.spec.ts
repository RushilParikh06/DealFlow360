import { signJwt, verifyJwt, ttlToSeconds } from './jwt';

const SECRET = 'test-secret';

describe('jwt', () => {
  it('round-trips a payload', () => {
    const token = signJwt({ sub: 'usr_1', role: 'SALES_REP', customerId: null }, SECRET, '15m');
    const payload = verifyJwt(token, SECRET);
    expect(payload.sub).toBe('usr_1');
    expect(payload.role).toBe('SALES_REP');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signJwt({ sub: 'usr_1', role: 'SALES_REP', customerId: null }, SECRET, '15m');
    expect(() => verifyJwt(token, 'other-secret')).toThrow();
  });

  it('rejects a tampered payload', () => {
    const token = signJwt({ sub: 'usr_1', role: 'SALES_REP', customerId: null }, SECRET, '15m');
    const [header, , signature] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ sub: 'usr_2', role: 'ADMIN', exp: 9_999_999_999 })).toString(
      'base64url',
    );
    expect(() => verifyJwt(`${header}.${forgedBody}.${signature}`, SECRET)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = signJwt({ sub: 'usr_1', role: 'SALES_REP', customerId: null }, SECRET, '0s');
    expect(() => verifyJwt(token, SECRET)).toThrow();
  });

  it('parses ttl units', () => {
    expect(ttlToSeconds('30s')).toBe(30);
    expect(ttlToSeconds('15m')).toBe(900);
    expect(ttlToSeconds('7d')).toBe(604800);
  });
});
