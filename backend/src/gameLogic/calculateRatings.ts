// backend/src/gameLogic/calculateRatings.ts
import { Rating, rate } from 'ts-trueskill';

export interface RatingData {
  playerId: string;
  userId: number | null;
  score: number;
  rank: number;
  rating_mu_before: number;
  rating_sigma_before: number;
}

export interface RatingResult extends RatingData {
  rating_mu_after: number;
  rating_sigma_after: number;
}

/**
 * players: rank, 기존 mu/sigma가 포함된 플레이어 배열
 * 반환값: 각 플레이어에 calc된 mu, sigma가 포함된 배열
 */
export function calculateRatings(players: RatingData[]): RatingResult[] {
  
  // 1. players 배열에서 rating 객체 배열 생성
  // ts-trueskill의 Rating(mu, sigma) 타입 생성
  const ratings = players.map(player => new Rating(player.rating_mu_before, player.rating_sigma_before));

  // 2. 순위 배열 생성 (0이 1등, 1이 2등, ...)
  // rank는 1부터 시작하므로 0-based index로 변환
  // 순위를 낮은 숫자가 실력 높은 1등으로 처리함
  const ranks = players.map(p => p.rank - 1);

  // 3. rate 함수 호출, players 모두가 한 팀이 아니라 개인별 rating 배열을 단일 배열로 전달
  // ts-trueskill rate() API는 teams 배열과 ranks 배열을 받는데,
  // 개인전은 각자 1명짜리 팀이므로 각 원소를 단일원소 배열로 감싸 배열로 만듦
  const rated = rate(ratings.map(r => [r]), ranks).flat();

  // 4. 결과를 기존 players 배열과 매칭시켜 리턴
  return players.map((player, idx) => {
    const updatedRating = rated[idx];
    return {
      ...player,
      rating_mu_after: updatedRating.mu,
      rating_sigma_after: updatedRating.sigma,
    };
  });
}
