import { DealHealthSeverity } from '@dealflow/contracts';
export declare class DealHealthQueryDto {
    severity?: (typeof DealHealthSeverity)[keyof typeof DealHealthSeverity];
    includeResolved?: string;
}
