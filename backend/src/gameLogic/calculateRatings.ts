// backend/src/gameLogic/calculateRatings.ts

export interface RatingData {
  playerId: string;
  userId: number | null;
  score: number;
  rank: number;
  rating_mu_before: number;
  rating_sigma_before: number;
  nickname?: string; // 추가된 필드
}

export interface RatingResult extends RatingData {
  rating_mu_after: number;
  rating_sigma_after: number;
}

/**
 * TrueSkill 기반 레이팅 계산 (dynamic import + fallback)
 * players: rank, 기존 mu/sigma가 포함된 플레이어 배열
 * 반환값: 각 플레이어에 calc된 mu, sigma가 포함된 배열
 */
export function calculateRatings(players: RatingData[]): RatingResult[] {
  console.log(`[DEBUG] calculateRatings 시작 - 플레이어 수: ${players.length}`);
  
  try {
    // OpenSkill 패키지 사용 (TrueSkill의 현대적 대안)
    const { rating, rate } = require('openskill');
    console.log(`[DEBUG] openskill 패키지 로드 성공`);
    
    // OpenSkill 레이팅 객체 생성
    const playerRatings = players.map(player => 
      rating({ mu: player.rating_mu_before, sigma: player.rating_sigma_before })
    );
    
    console.log(`[DEBUG] 입력 레이팅:`, playerRatings.map((r, i) => ({
      player: players[i].playerId,
      mu: r.mu, 
      sigma: r.sigma,
      rank: players[i].rank
    })));
    
    // 순위별로 팀 구성 (각자 1명씩 팀)
    // openSkill은 원래 팀대팀 대결 = 1인 1팀인 걸로 계산
    const teams = playerRatings.map(r => [r]);
    const ranks = players.map(p => p.rank - 1); // 0-based ranks
    
    console.log(`[DEBUG] OpenSkill rate 함수 호출 - teams:`, teams.length, 'ranks:', ranks);
    
    // OpenSkill rate 함수 호출
    const newRatings = rate(teams, { rank: ranks });
    
    console.log(`[DEBUG] 계산된 레이팅:`, newRatings.map((team: any, i: number) => ({
      player: players[i].playerId,
      mu: team[0].mu,
      sigma: team[0].sigma
    })));
    
    // 결과 매핑
    const results = players.map((player, idx) => {
      const newRating = newRatings[idx][0]; // 각 팀의 첫 번째(유일한) 플레이어
      return {
        ...player,
        rating_mu_after: newRating.mu,
        rating_sigma_after: newRating.sigma,
      };
    });

    console.log(`[DEBUG] TrueSkill 계산 완료 - 결과 수: ${results.length}`);
    return results;
    
  } catch (error) {
    console.error(`[ERROR] TrueSkill 계산 실패, 간단한 계산으로 대체:`, error);
    
    // TrueSkill 실패 시 간단한 계산으로 대체
    const results = players.map((player) => {
      const rankAdjustment = (players.length - player.rank + 1) * 5;
      const newMu = Math.max(25, player.rating_mu_before + rankAdjustment);
      const newSigma = Math.max(8.33, player.rating_sigma_before - 0.5);
      
      return {
        ...player,
        rating_mu_after: newMu,
        rating_sigma_after: newSigma,
      };
    });
    
    console.log(`[DEBUG] 간단한 레이팅 계산 완료 - 결과 수: ${results.length}`);
    return results;
  }
}