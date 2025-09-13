// backend/src/gameLogic/calculateRatings.ts
// Dynamic import for ES Module compatibility

export interface RatingData {
  playerId: string;
  userId: number | null;
  score: number;
  rank: number;
  nickname: string;
  rating_mu_before: number;
  rating_sigma_before: number;
}

export interface RatingResult extends RatingData {
  rating_mu_after: number;
  rating_sigma_after: number;
}


/**
 * TrueSkill 기반 레이팅 계산
 * 정확한 소숫점 계산으로 레이팅 변동을 계산합니다.
 */
export async function calculateRatings(players: RatingData[]): Promise<RatingResult[]> {
  // Dynamic import for ES Module compatibility
  const { rate, Rating } = await import('ts-trueskill');
  
  // Rating 클래스의 인스턴스 타입 정의
  type RatingInstance = InstanceType<typeof Rating>;
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
  const teams: RatingInstance[][] = [];
  
  sortedRanks.forEach(rank => {
    const groupPlayers = rankGroups[rank];
    const team: RatingInstance[] = groupPlayers.map(player => 
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

  return results;
}
