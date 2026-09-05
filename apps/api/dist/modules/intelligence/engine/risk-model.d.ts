export interface RiskModel {
    /** weightedExcessBps that earns the full blended allocation. */
    blendedFullScaleBps: number;
    blendedMaxPoints: number;
    /** worstLineExcessBps that earns the full worst-line allocation. */
    hardFullScaleBps: number;
    hardMaxPoints: number;
    /** At or above this margin, margin pressure contributes nothing. */
    healthyMarginBps: number;
    /** At or below this margin, margin pressure contributes its whole allocation. */
    criticalMarginBps: number;
    marginMaxPoints: number;
    spreadMaxPoints: number;
    bandHigh: number;
    bandMedium: number;
}
export declare const DEFAULT_RISK_MODEL: RiskModel;
export declare const RISK_MODEL_MAX_POINTS: number;
