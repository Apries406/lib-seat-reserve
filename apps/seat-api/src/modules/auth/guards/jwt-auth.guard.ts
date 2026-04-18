import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未提供认证令牌');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (token.startsWith('mock_jwt_token_')) {
      const userId = token.replace('mock_jwt_token_', '');
      request.user = { userId, openId: `mock_openid_${userId}` };
      return true;
    }
    
    throw new UnauthorizedException('无效的认证令牌');
  }
}
