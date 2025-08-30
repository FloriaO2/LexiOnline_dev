// src/gameLogic/calculateRanks.ts

interface PlayerScore {
  score: number;
  playerId: string;
}

export function calculateRanks<T extends PlayerScore>(finalScores: T[]): (T & { rank: number })[] {
  // Sort players by score in descending order, with a secondary sort for stability
  const sortedScores = [...finalScores].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.playerId.localeCompare(b.playerId);
  });

  const scoresWithRank: (T & { rank: number })[] = [];
  if (sortedScores.length === 0) {
    return scoresWithRank;
  }

  let rank = 1;
  for (let i = 0; i < sortedScores.length; i++) {
    // If the current player's score is the same as the previous one, they get the same rank
    if (i > 0 && sortedScores[i].score < sortedScores[i - 1].score) {
      rank = i + 1;
    }
    
    scoresWithRank.push({
      ...sortedScores[i],
      rank: rank,
    });
  }

  return scoresWithRank;
}
