import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const GoogleUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
