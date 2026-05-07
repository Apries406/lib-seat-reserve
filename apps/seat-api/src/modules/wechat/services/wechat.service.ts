import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface WechatSessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly code2SessionUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('wechat.appId');
    this.appSecret = this.configService.get<string>('wechat.appSecret');
    this.code2SessionUrl = this.configService.get<string>('wechat.code2SessionUrl');
  }

  async code2Session(code: string): Promise<WechatSessionResult> {
    const url = `${this.code2SessionUrl}?appid=${this.appId}&secret=${this.appSecret}&js_code=${code}&grant_type=authorization_code`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const result: WechatSessionResult = JSON.parse(data);
              if (result.errcode) {
                this.logger.error(`WeChat code2Session failed: ${result.errcode} ${result.errmsg}`);
                reject(new InternalServerErrorException('微信登录失败，请稍后重试'));
              } else {
                resolve(result);
              }
            } catch (error) {
              reject(new InternalServerErrorException('解析微信响应失败'));
            }
          });
        })
        .on('error', (err) => {
          this.logger.error(`WeChat API request failed: ${err.message}`);
          reject(new InternalServerErrorException('微信服务不可用'));
        });
    });
  }
}
