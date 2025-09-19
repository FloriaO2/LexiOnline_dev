// src/gameLogic/createShuffledDeck.ts
export function createShuffledDeck(maxNumber: number): number[] {
  const deck = [];
  
  // 카드 생성: type * maxNumber + value 방식
  // type: 0=구름, 1=별, 2=달, 3=해
  // value: 실제 n → 데이터 n-1 (사용자 공식)
  
  for (let type = 0; type < 4; type++) {
    for (let actualNumber = 1; actualNumber <= maxNumber; actualNumber++) {
      const value = actualNumber - 1; // 실제 n → 데이터 n-1
      const cardId = type * maxNumber + value;
      deck.push(cardId);
    }
  }

  console.log(`[DEBUG] 덱 생성: maxNumber=${maxNumber}, 총 카드 수=${deck.length}`);
  
  // Fisher-Yates 셔플
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
