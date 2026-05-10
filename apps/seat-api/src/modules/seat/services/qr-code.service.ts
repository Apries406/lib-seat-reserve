import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'seat-reserve-secret-key-2024';
const QR_PREFIX = 'seat';

@Injectable()
export class QrCodeService {
  generateSeatQrToken(seatId: number): string {
    const payload = `seatId=${seatId}&type=seat`;
    const signature = createHmac('sha256', QR_SECRET).update(payload).digest('hex').slice(0, 16);
    return `${QR_PREFIX}:${seatId}:${signature}`;
  }

  verifySeatQrToken(token: string): { valid: boolean; seatId?: number; reason?: string } {
    if (!token || !token.startsWith(`${QR_PREFIX}:`)) {
      return { valid: false, reason: '二维码格式错误' };
    }

    const parts = token.split(':');
    if (parts.length !== 3) {
      return { valid: false, reason: '二维码格式错误' };
    }

    const [, seatIdStr, signature] = parts;
    const seatId = Number(seatIdStr);
    if (!Number.isFinite(seatId) || seatId <= 0) {
      return { valid: false, reason: '二维码格式错误' };
    }

    const expectedSignature = createHmac('sha256', QR_SECRET)
      .update(`seatId=${seatId}&type=seat`)
      .digest('hex')
      .slice(0, 16);

    if (signature !== expectedSignature) {
      return { valid: false, reason: '二维码无效或已篡改' };
    }

    return { valid: true, seatId };
  }
}
