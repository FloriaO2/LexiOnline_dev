// shared/models/User.ts
import { GameHistory } from './GameHistory';

export interface User {
  id: number;
  googleId: string;
  nickname: string;
  profileImageUrl?: string;
  rating_mu: number;
  rating_sigma: number;
  createdAt: string; // DateTime을 문자열 ISO 형식으로 받는 경우
  updatedAt: string;
  lastLoginAt?: string;
  
  // 게임 통계 (간단한 win/draw/lose 시스템)
  totalGames: number;
  result_wins: number;
  result_draws: number;
  result_losses: number;
  allowGameHistoryView: boolean; // 전적 공개 허용 여부

  gameHistories: GameHistory[];
}
