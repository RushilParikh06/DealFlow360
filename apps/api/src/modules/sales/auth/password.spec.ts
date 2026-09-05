import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the correct password', () => {
    const stored = hashPassword('correct-horse-battery-staple');
    expect(verifyPassword('correct-horse-battery-staple', stored)).toBe(true);
  });

  it('rejects the wrong password', () => {
    const stored = hashPassword('correct-horse-battery-staple');
    expect(verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('salts each hash differently', () => {
    expect(hashPassword('same-password')).not.toEqual(hashPassword('same-password'));
  });

  it('rejects a malformed stored value instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-real-hash')).toBe(false);
  });
});
