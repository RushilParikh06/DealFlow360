import { hashEvaluationInput } from '../hash';
import { CAT_SERVICES, goldPolicies, input, line } from './fixtures';

describe('evaluation input hash', () => {
  const base = input([line({ quoteLineId: 'l1', discountBps: 1000 }), line({ quoteLineId: 'l2', discountBps: 500 })]);

  it('is stable across repeated calls', () => {
    expect(hashEvaluationInput(base)).toBe(hashEvaluationInput(base));
  });

  it('ignores the order lines arrive in', () => {
    const reordered = input([...base.lines].reverse());
    expect(hashEvaluationInput(reordered)).toBe(hashEvaluationInput(base));
  });

  it('changes when a discount changes', () => {
    const edited = input([line({ quoteLineId: 'l1', discountBps: 1400 }), base.lines[1]!]);
    expect(hashEvaluationInput(edited)).not.toBe(hashEvaluationInput(base));
  });

  it('changes when a ceiling is edited in the policy screen', () => {
    const tightened = input(base.lines, [
      { ...goldPolicies[0]!, maxDiscountBps: 700 },
      ...goldPolicies.slice(1),
    ]);
    // otherwise the admin screen would edit a policy and the cached evaluation
    // would keep showing the old score, which is exactly the demo that dies
    expect(hashEvaluationInput(tightened)).not.toBe(hashEvaluationInput(base));
  });

  it('changes when a line moves to a different category', () => {
    const moved = input([line({ quoteLineId: 'l1', discountBps: 1000, categoryId: CAT_SERVICES }), base.lines[1]!]);
    expect(hashEvaluationInput(moved)).not.toBe(hashEvaluationInput(base));
  });
});
