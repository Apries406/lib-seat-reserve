import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'seat-reserve-secret-key-2024';

    try {
      const payload = jwt.verify(token, secret) as { sub: string; openid: string };
      request.user = { userId: payload.sub, openid: payload.openid };
      return true;
    } catch {
      throw new UnauthorizedException('无效的认证令牌');
    }
  }
}
