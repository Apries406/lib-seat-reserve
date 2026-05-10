import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  deviceFingerprint?: string;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nickname: string;
    avatar: string;
    creditScore: number;
    creditLevel: string;
    canReserve: boolean;
  };
}
