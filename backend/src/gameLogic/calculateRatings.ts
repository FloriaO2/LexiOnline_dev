// backend/src/gameLogic/calculateRatings.ts

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
 * Simple rating calculation without ts-trueskill dependency
 * This is a temporary implementation for deployment
 */
export function calculateRatings(players: RatingData[]): RatingResult[] {
  // Simple rating adjustment based on rank
  // Higher rank (lower number) gets positive adjustment
  // Lower rank (higher number) gets negative adjustment
  
  return players.map((player) => {
    const rankAdjustment = (players.length - player.rank + 1) * 5; // Simple adjustment
    const newMu = Math.max(25, player.rating_mu_before + rankAdjustment);
    const newSigma = Math.max(8.33, player.rating_sigma_before - 0.5); // Slightly decrease uncertainty
    
    return {
      ...player,
      rating_mu_after: newMu,
      rating_sigma_after: newSigma,
    };
  });
}
