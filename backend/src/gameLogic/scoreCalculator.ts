// src/gameLogic/scoreCalculator.ts
import { MapSchema } from "@colyseus/schema";
import { PlayerState } from "../rooms/schema/PlayerState";

/**
 * 새로운 점수 계산 로직
 * 1. 각 플레이어는 `(보유한 패 개수) * (2 ** 보유한 2의 개수)` 만큼의 점수 구성요소를 가짐.
 * 2. 두 플레이어 간에, 점수 구성요소가 높은 쪽이 낮은 쪽에게 그 차액만큼 점수를 지불함.
 */

function getTwosCount(player: PlayerState, maxNumber: number): number {
  let count = 0;
  player.hand.forEach(card => {
    // 카드 값이 2인 경우: value === 1 (실제 2, 사용자 공식: 2-1=1)
    const value = card % maxNumber;
    if (value === 1) {
      count++;
    }
  });
  return count;
}

export function calculateRoundScores(
  players: MapSchema<PlayerState>,
  maxNumber: number
): Map<string, number> {
  const playerIds = Array.from(players.keys());
  const scoreDiffMap = new Map<string, number>();
  playerIds.forEach(id => scoreDiffMap.set(id, 0));

  const playerComponents = new Map<string, number>();
  playerIds.forEach(id => {
      const player = players.get(id)!;
      const component = player.hand.length * (2 ** getTwosCount(player, maxNumber));
      playerComponents.set(id, component);
  });

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const idA = playerIds[i];
      const idB = playerIds[j];

      const scoreA = playerComponents.get(idA)!;
      const scoreB = playerComponents.get(idB)!;

      const diff = scoreA - scoreB;

      // 점수 구성요소가 높은 쪽이 낮은 쪽에게 점수를 줌 (높은 쪽은 점수 잃음, 낮은 쪽은 점수 얻음)
      // If scoreA > scoreB, A loses points, B gains points.
      scoreDiffMap.set(idA, scoreDiffMap.get(idA)! - diff);
      scoreDiffMap.set(idB, scoreDiffMap.get(idB)! + diff);
    }
  }

  return scoreDiffMap;
}

export function calculateRoundScoreMatrix(
  players: MapSchema<PlayerState>,
  maxNumber: number
): Record<string, Record<string, number>> {
  const playerIds = Array.from(players.keys());
  const scoreMatrix: Record<string, Record<string, number>> = {};

  playerIds.forEach(giverId => {
    scoreMatrix[giverId] = {};
    playerIds.forEach(receiverId => {
      scoreMatrix[giverId][receiverId] = 0;
    });
  });

  const playerComponents = new Map<string, number>();
  playerIds.forEach(id => {
      const player = players.get(id)!;
      const component = player.hand.length * (2 ** getTwosCount(player, maxNumber));
      playerComponents.set(id, component);
  });

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const idA = playerIds[i];
      const idB = playerIds[j];

      const scoreA = playerComponents.get(idA)!;
      const scoreB = playerComponents.get(idB)!;

      if (scoreA > scoreB) {
        // A (higher) pays B (lower)
        const amount = scoreA - scoreB;
        scoreMatrix[idA][idB] = amount; // Giver: A, Receiver: B
      } else if (scoreB > scoreA) {
        // B (higher) pays A (lower)
        const amount = scoreB - scoreA;
        scoreMatrix[idB][idA] = amount; // Giver: B, Receiver: A
      }
    }
  }

  return scoreMatrix;
}
