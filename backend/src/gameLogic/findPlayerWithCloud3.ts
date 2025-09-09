// src.findPlayerWithCloud3.ts
import { PlayerState } from "../rooms/schema/PlayerState";
import { MapSchema } from "@colyseus/schema"
import { parseCard } from "./cardEvaluator";

export function findPlayerWithCloud3(
  players: MapSchema<PlayerState>, 
  maxNumber: number
): string | null {
  for (const [sessionId, player] of players.entries()) {
    for (const card of player.hand) {
      // 프론트엔드와 동일한 방식으로 카드 해석
      const colorIndex = Math.floor(card / maxNumber);
      const value = (card % maxNumber) + 1;
      
      // 색상 매핑: 0=black, 1=bronze, 2=silver, 3=gold
      // 구름 3: 검정(0), 값 3
      const isCloud3 = (colorIndex === 0 && value === 3);

      console.log(`[DEBUG] findPlayerWithCloud3: player=${sessionId}, card=${card}, colorIndex=${colorIndex}, value=${value}, maxNumber=${maxNumber}, isCloud3=${isCloud3}`);

      if (isCloud3) {
        console.log(`[DEBUG] 구름 3 발견: player=${sessionId}, card=${card}`);
        return sessionId;
      }
    }
  }
  console.log(`[DEBUG] 구름 3을 찾지 못함`);
  return null; // 못찾으면 null 반환
}
