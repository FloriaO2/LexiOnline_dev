// shared/models/GameHistory.ts
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
}