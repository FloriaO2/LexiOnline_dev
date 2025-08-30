// src.findPlayerWithCloud3.ts
import { PlayerState } from "../rooms/schema/PlayerState";
import { MapSchema } from "@colyseus/schema"

export function findPlayerWithCloud3(
  players: MapSchema<PlayerState>, 
  maxNumber: number
): string | null {
  for (const [sessionId, player] of players.entries()) {
    for (const card of player.hand) {
      // 구름3 카드는 카드 번호 11 (black 색상, 값 3)
      // 카드 번호 = (값-1) * 4 + 색상인덱스
      // 값 3, 색상 black(3) = (3-1) * 4 + 3 = 2 * 4 + 3 = 11
      const type = Math.floor(card / maxNumber);
      const number = (card + maxNumber - 2) % maxNumber;

      if (type === 0 && number === 0) { // 구름 3: type=0, 내부 number=0


      // if (card === 11) {
        return sessionId;
      // }
      }
    }
  }
  return null; // 못찾으면 null 반환
}
