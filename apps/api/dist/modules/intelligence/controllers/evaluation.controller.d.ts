import type { EvaluationResponse } from '@dealflow/contracts';
import { type AuthUser } from '../../shared/current-user';
import { EvaluationHistoryQueryDto } from '../dto/evaluate.dto';
import { EvaluationService } from '../services/evaluation.service';
export declare class EvaluationController {
    private readonly evaluations;
    constructor(evaluations: EvaluationService);
    /**
     * Idempotent. Same quote + same lines + same policies => same inputHash => the
     * existing evaluation comes back instead of a duplicate row. Safe to call from
     * a line-edit autosave, which is exactly how the UI will use it.
     */
    evaluate(id: string, actor: AuthUser): Promise<EvaluationResponse>;
    latest(id: string): Promise<EvaluationResponse | null>;
    history(id: string, query: EvaluationHistoryQueryDto): Promise<EvaluationResponse[]>;
}
