import { type UserRole } from '@dealflow/contracts';
export interface AuthUser {
    id: string;
    role: UserRole;
    customerId: string | null;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
