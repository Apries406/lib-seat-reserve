export interface IUser {
  id: string;
  nickname: string;
  avatar?: string;
  creditScore: number;
  creditLevel: CreditScoreLevel;
  canReserve: boolean;
}

export enum CreditScoreLevel {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface ICreditScoreDetail {
  id: string;
  userId: string;
  changeAmount: number;
  reason: string;
  beforeScore: number;
  afterScore: number;
  reservationId?: string | null;
  createdAt: string;
}

export interface IAuthState {
  user: IUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
}
