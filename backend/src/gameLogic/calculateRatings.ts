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
 * TrueSkill 기반 레이팅 계산 (dynamic import 사용)
 * 정확한 소숫점 계산으로 레이팅 변동을 계산합니다.
 */
export async function calculateRatings(players: RatingData[]): Promise<RatingResult[]> {
  console.log(`[DEBUG] calculateRatings 시작 - 플레이어 수: ${players.length}`);
  
  try {
    // Dynamic import for ES module compatibility
    const { rate, Rating } = await import('ts-trueskill');
    console.log(`[DEBUG] ts-trueskill dynamic import 성공`);
    
    // 순위별로 그룹화 (동일 순위 처리)
    const rankGroups: { [rank: number]: RatingData[] } = {};
    players.forEach(player => {
      if (!rankGroups[player.rank]) {
        rankGroups[player.rank] = [];
      }
      rankGroups[player.rank].push(player);
    });

    // 순위별로 정렬된 그룹 생성
    const sortedRanks = Object.keys(rankGroups).map(Number).sort((a, b) => a - b);
    const teams: any[] = [];
    
    sortedRanks.forEach(rank => {
      const groupPlayers = rankGroups[rank];
      const team = groupPlayers.map(player => 
        new Rating(player.rating_mu_before, player.rating_sigma_before)
      );
      teams.push(team);
    });

    // TrueSkill 계산 실행
    const newRatings = rate(teams);

    // 결과 매핑
    const results: RatingResult[] = [];
    let teamIndex = 0;
    
    sortedRanks.forEach(rank => {
      const groupPlayers = rankGroups[rank];
      const teamRatings = newRatings[teamIndex];
      
      groupPlayers.forEach((player, playerIndex) => {
        const newRating = teamRatings[playerIndex];
        results.push({
          ...player,
          rating_mu_after: newRating.mu,
          rating_sigma_after: newRating.sigma,
        });
      });
      
      teamIndex++;
    });

    console.log(`[DEBUG] calculateRatings 완료 - 결과 수: ${results.length}`);
    return results;
    
  } catch (error) {
    console.error(`[ERROR] TrueSkill 계산 실패, 간단한 계산으로 대체:`, error);
    
    // TrueSkill 실패 시 간단한 계산으로 대체
    const results: RatingResult[] = players.map((player) => {
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