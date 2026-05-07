import { Module } from '@nestjs/common';
import { WechatService } from './services/wechat.service';

@Module({
  providers: [WechatService],
  exports: [WechatService],
})
export class WechatModule {}
