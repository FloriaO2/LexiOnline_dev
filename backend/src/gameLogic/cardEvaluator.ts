// src/gameLogic/cardEvaluator.ts
import { ArraySchema } from "@colyseus/schema";

export const MADE_NONE = 0;
export const MADE_STRAIGHT = 1;
export const MADE_FLUSH = 2;
export const MADE_FULLHOUSE = 3;
export const MADE_FOURCARDS = 4;
export const MADE_STRAIGHTFLUSH = 5;

export interface MadeEvalResult {
  type: number;
  value: number;
  valid: boolean;
}

export function parseCard(card: number, maxNumber: number) {
  const type = Math.floor(card / maxNumber);
  const number = (card + maxNumber - 2) % maxNumber;
  console.log(`[DEBUG] 카드 파싱: card=${card}, maxNumber=${maxNumber}, type=${type}, number=${number}`);
  return { type, number };
}

export function getOrderIndex(n: number, maxNumber: number): number {
  if (n === 0) return maxNumber - 2;
  if (n === 1) return maxNumber - 1;
  return n - 2;
}

export function getValue(number: number, type: number, maxNumber: number): number {
  return getOrderIndex(number, maxNumber) * maxNumber + type;
}

export function isStraightWithException(numbers: number[], maxNumber: number): boolean {
  console.log(`[DEBUG] 스트레이트 검사 시작: numbers=[${numbers.join(', ')}], maxNumber=${maxNumber}`);

  const remappedNumbers = numbers.map(n => (n + 2) % maxNumber).sort((a, b) => a - b);
  console.log(`[DEBUG] 재매핑된 숫자: [${remappedNumbers.join(', ')}]`);

  // Check for normal consecutive straight
  let isConsecutive = true;
  for (let i = 0; i < remappedNumbers.length - 1; i++) {
    if (remappedNumbers[i+1] - remappedNumbers[i] !== 1) {
      isConsecutive = false;
      break;
    }
  }
  if (isConsecutive) {
    console.log(`[DEBUG] 일반 연속 스트레이트 확인됨.`);
    return true;
  }

  // Check for mountain straight (10-J-Q-K-A)
  // Remapped numbers are [9, 10, 11, 12, 0], sorted to [0, 9, 10, 11, 12]
  const mountainStraight = [0, maxNumber - 4, maxNumber - 3, maxNumber - 2, maxNumber - 1];
  const isMountain = remappedNumbers.length === mountainStraight.length && remappedNumbers.every((val, index) => val === mountainStraight[index]);
  if (isMountain) {
    console.log(`[DEBUG] 마운틴 스트레이트 (10-J-Q-K-A) 확인됨.`);
    return true;
  }

  console.log(`[DEBUG] 스트레이트 아님.`);
  return false;
}

// 1~3장 simple combo
export function evaluateSimpleCombo(cards: number[], maxNumber: number): MadeEvalResult {
  const len = cards.length;
  if (![1, 2, 3].includes(len)) return { type: MADE_NONE, value: 0, valid: false };

  const parsed = cards.map(card => {
    const { type, number } = parseCard(card, maxNumber);
    return { type, number, value: number * maxNumber + type };
  });

  const firstNumber = parsed[0].number;
  if (!parsed.every(c => c.number === firstNumber)) return { type: MADE_NONE, value: 0, valid: false };

  const maxType = Math.max(...parsed.map(c => c.type));
  return { type: len, value: firstNumber * maxNumber + maxType, valid: true };
}

// 5장 족보 평가
export function evaluateMade(cards: number[], maxNumber: number): MadeEvalResult {
  if (cards.length !== 5) return { type: MADE_NONE, value: 0, valid: false };

  const parsed = cards.map(card => parseCard(card, maxNumber));
  const numbers = parsed.map(c => c.number).sort((a, b) => a - b);
  const types = parsed.map(c => c.type);

  const numCount = new Map<number, number>();
  const typeCount = new Map<number, number>();
  numbers.forEach(n => numCount.set(n, (numCount.get(n) || 0) + 1));
  types.forEach(t => typeCount.set(t, (typeCount.get(t) || 0) + 1));

  const isFlush = typeCount.size === 1;
  const isStraight = isStraightWithException(numbers, maxNumber);

  let four = false, three = false, two = false;
  for (const count of numCount.values()) {
    if (count === 4) four = true;
    else if (count === 3) three = true;
    else if (count === 2) two = true;
  }
  
  console.log(`[DEBUG] 족보 판별: isFlush=${isFlush}, isStraight=${isStraight}, typeCount.size=${typeCount.size}`);
  console.log(`[DEBUG] 숫자 분포:`, Array.from(numCount.entries()));
  console.log(`[DEBUG] 색상 분포:`, Array.from(typeCount.entries()));
  console.log(`[DEBUG] three=${three}, two=${two}, four=${four}`);

  let bestIndex = -1, bestType = -1, bestNumber = -1;
  for (let i = 0; i < numbers.length; i++) {
    const idx = getOrderIndex(numbers[i], maxNumber);
    if (idx > bestIndex || (idx === bestIndex && types[i] > bestType)) {
      bestIndex = idx;
      bestType = types[i];
      bestNumber = numbers[i];
    }
  }

  if (isFlush && isStraight) {
    return { type: MADE_STRAIGHTFLUSH, value: getValue(bestNumber, bestType, maxNumber), valid: true };
  }
  if (four) {
    let fourNumber = [...numCount.entries()].find(([n, c]) => c === 4)![0];
    let maxType = -1;
    for (let i = 0; i < numbers.length; i++) if (numbers[i] === fourNumber && types[i] > maxType) maxType = types[i];
    return { type: MADE_FOURCARDS, value: getValue(fourNumber, maxType, maxNumber), valid: true };
  }
  if (three && two) {
    let threeNumber = [...numCount.entries()].find(([n, c]) => c === 3)![0];
    let maxType = -1;
    for (let i = 0; i < numbers.length; i++) if (numbers[i] === threeNumber && types[i] > maxType) maxType = types[i];
    return { type: MADE_FULLHOUSE, value: getValue(threeNumber, maxType, maxNumber), valid: true };
  }
  if (isFlush) {
    return { type: MADE_FLUSH, value: getValue(bestNumber, bestType, maxNumber), valid: true };
  }
  if (isStraight) {
    return { type: MADE_STRAIGHT, value: getValue(bestNumber, bestType, maxNumber), valid: true };
  }
  return { type: MADE_NONE, value: 0, valid: false };
}

// 제출 카드 손패에서 제거
export function removeCardsFromHand(playerHand: ArraySchema<number>, submitCards: number[]) {
  for (const card of submitCards) {
    const idx = playerHand.indexOf(card);
    if (idx !== -1) playerHand.splice(idx, 1);
    else console.warn(`Removing card failed: card ${card} not found in hand`);
  }
}
