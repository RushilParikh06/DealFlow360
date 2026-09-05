// GROUP OWNED. Success is { success: true, data }. Handlers return plain data
// and never build the envelope themselves.

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: true; data: T }> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<{ success: true; data: T }> {
    return next.handle().pipe(map((data) => ({ success: true as const, data })));
  }
}
