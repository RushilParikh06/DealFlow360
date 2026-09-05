import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { type Observable } from 'rxjs';
export declare class ResponseInterceptor<T> implements NestInterceptor<T, {
    success: true;
    data: T;
}> {
    intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<{
        success: true;
        data: T;
    }>;
}
