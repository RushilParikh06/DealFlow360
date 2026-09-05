import { routeApprovals } from '../routing';

const thresholds = { requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 };

describe('approval routing', () => {
  it('auto approves at exactly zero excess', () => {
    const d = routeApprovals(0, 0, thresholds);
    expect(d.approvalRequired).toBe(false);
    expect(d.requiredApprovals).toEqual([]);
  });

  it('sends one basis point of excess to the manager', () => {
    expect(routeApprovals(1, 1, thresholds).requiredApprovals).toEqual(['SALES_MANAGER']);
  });

  it('treats the finance threshold as exclusive', () => {
    expect(routeApprovals(500, 500, thresholds).requiredApprovals).toEqual(['SALES_MANAGER']);
    expect(routeApprovals(501, 501, thresholds).requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
  });

  it('routes on whichever of blend and worst line is higher', () => {
    expect(routeApprovals(600, 0, thresholds).requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
    expect(routeApprovals(0, 600, thresholds).requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
    expect(routeApprovals(600, 900, thresholds).governingExcessBps).toBe(900);
  });

  it('honours a policy that lets a manager pass small overages alone', () => {
    // an admin raises the manager threshold to 200 bps in the policy screen
    const relaxed = { requiresManagerAboveBps: 200, requiresFinanceAboveBps: 500 };
    expect(routeApprovals(150, 150, relaxed).approvalRequired).toBe(false);
    expect(routeApprovals(250, 250, relaxed).requiredApprovals).toEqual(['SALES_MANAGER']);
  });

  it('always explains itself', () => {
    expect(routeApprovals(900, 900, thresholds).reason).toContain('finance threshold');
    expect(routeApprovals(0, 0, thresholds).reason).toContain('within its own category ceiling');
  });
});
