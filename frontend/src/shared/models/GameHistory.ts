// shared/models/GameHistory.ts
export interface PlayerInfo {
  userId: number;
  nickname: string;
  score: number;
  rank: number;
  rating_mu_change: number;
}

export interface GameHistory {
  id: number;
  gameId: string;
  playedAt: string; // DateTime을 ISO 문자열로 받는 경우
  playerCount: number;
  totalRounds: number;
  roomType?: string;
  roomTitle?: string;
  
  // Player 1 정보
  player1_userId: number;
  player1_nickname: string;
  player1_rank: number;
  player1_score: number;
  player1_rating_mu_change: number;
  
  // Player 2 정보
  player2_userId: number;
  player2_nickname: string;
  player2_rank: number;
  player2_score: number;
  player2_rating_mu_change: number;
  
  // Player 3 정보 (옵션)
  player3_userId?: number;
  player3_nickname?: string;
  player3_rank?: number;
  player3_score?: number;
  player3_rating_mu_change?: number;
  
  // Player 4 정보 (옵션)
  player4_userId?: number;
  player4_nickname?: string;
  player4_rank?: number;
  player4_score?: number;
  player4_rating_mu_change?: number;
  
  // Player 5 정보 (옵션)
  player5_userId?: number;
  player5_nickname?: string;
  player5_rank?: number;
  player5_score?: number;
  player5_rating_mu_change?: number;
  
  // 편의를 위한 계산된 필드들 (프론트엔드에서 사용)
  playerInfos?: PlayerInfo[]; // 모든 플레이어 정보 (닉네임, userId, 점수, 순위, 레이팅 변화)
}