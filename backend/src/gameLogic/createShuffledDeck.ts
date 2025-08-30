// src/gameLogic/createShuffledDeck.ts
export function createShuffledDeck(maxNumber: number): number[] {
  const deckSize = 4 * maxNumber;
  const deck = [];
  for (let i = 0; i < deckSize; i++) {
    deck.push(i);
  }

  // Fisher-Yates 셔플
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
