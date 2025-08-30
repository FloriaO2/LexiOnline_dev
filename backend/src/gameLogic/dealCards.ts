// src/gameLogic/dealCards.ts
export function dealCards(deck: number[], playerCount: number): number[][] {
  const hands: number[][] = Array.from({ length: playerCount }, () => new Array<number>());
  deck.forEach((card, index) => {
    hands[index % playerCount].push(card);
  });
  return hands;
}
