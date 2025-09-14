// shared/models/GameHistory.ts
export interface PlayerInfo {
  userId: number;
  nickname: string;
  score: number;
  rank: number;
  rating_mu_before: number;
  rating_mu_after: number;
  rating_mu_change: number;
}

export interface GameHistory {
  id: number;
  userId: number;
  playedAt: string; // DateTime을 ISO 문자열로 받는 경우
  playerCount: number;
  rank: number;
  score: number;
  scoresAll: number[]; // 모든 참가자 점수 배열 (예: [100, 70, 50])
  rating_mu_before: number;
  rating_sigma_before: number;
  rating_mu_after: number;
  rating_sigma_after: number;
  gameId?: string | null; // 옵셔널 (nullable)
  
  // 추가된 필드들 - 전적 열람용
  rating_mu_change: number; // 레이팅 변화값 (예: +1.02)
  playerInfos: PlayerInfo[]; // 모든 플레이어 정보 (닉네임, userId, 점수, 순위, 레이팅 변화)
}