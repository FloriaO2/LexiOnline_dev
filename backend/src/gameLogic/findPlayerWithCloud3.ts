// src.findPlayerWithCloud3.ts
import { PlayerState } from "../rooms/schema/PlayerState";
import { MapSchema } from "@colyseus/schema"
import { parseCard } from "./cardEvaluator";

export function findPlayerWithCloud3(
  players: MapSchema<PlayerState>, 
  maxNumber: number
): string | null {
  console.log(`[DEBUG] findPlayerWithCloud3 시작: 플레이어 수=${players.size}, maxNumber=${maxNumber}`);
  
  for (const [sessionId, player] of players.entries()) {
    console.log(`[DEBUG] 플레이어 ${sessionId} 손패 확인: ${player.hand.length}장 - [${player.hand.join(', ')}]`);
    
    for (const card of player.hand) {
      // 새로운 카드 파싱 방식 사용
      const { type, value } = parseCard(card, maxNumber);
      
      // 구름 3: type=0(구름), value=2(실제 3, 사용자 공식: 3-1=2)
      const isCloud3 = (type === 0 && value === 2);

      console.log(`[DEBUG] 카드 분석: player=${sessionId}, card=${card}, type=${type}, value=${value}, isCloud3=${isCloud3}`);

      if (isCloud3) {
        console.log(`[DEBUG] ✅ 구름 3 발견! player=${sessionId}, card=${card}`);
        return sessionId;
      }
    }
  }
  console.log(`[DEBUG] ❌ 구름 3을 찾지 못함 - 모든 플레이어의 모든 카드를 검사했지만 발견되지 않음`);
  return null; // 못찾으면 null 반환
}
