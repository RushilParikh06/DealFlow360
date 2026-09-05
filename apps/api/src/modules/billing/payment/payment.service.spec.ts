import { applyPayment } from './payment.service';
import { AppError } from '../../operations/types';

describe('applyPayment', () => {
  it('a partial payment leaves the invoice partially paid', () => {
    const result = applyPayment(10000, 0, 4000);
    expect(result.newPaidMinor).toBe(4000);
    expect(result.status).toBe('PARTIALLY_PAID');
  });

  it('paying the remaining balance marks it paid', () => {
    expect(applyPayment(10000, 4000, 6000).status).toBe('PAID');
  });

  it('overpayment is rejected rather than silently accepted', () => {
    expect(() => applyPayment(10000, 4000, 7000)).toThrow(AppError);
    try {
      applyPayment(10000, 4000, 7000);
    } catch (e) {
      expect((e as AppError).code).toBe('VALIDATION_FAILED');
    }
  });

  it('a zero or negative payment is rejected', () => {
    expect(() => applyPayment(10000, 0, 0)).toThrow();
    expect(() => applyPayment(10000, 0, -100)).toThrow();
  });
});
