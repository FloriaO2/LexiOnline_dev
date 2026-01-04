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
  const value = card % maxNumber;
  
  // value를 실제 숫자로 변환: value + 1
  const actualNumber = value + 1;
  
  console.log(`[DEBUG] 카드 파싱: card=${card} = ${['구름','별','달','태양'][type]} ${actualNumber} (type=${type}, value=${value})`);
  return { type, value };
}

// value 기준 순위: 실제 숫자 3,4,5,...,maxNumber, 1, 2 순서 (maxNumber가 1보다 높음)
// value: 실제 n → 데이터 n-1, 즉 value 0=실제1, value 1=실제2, ..., value (maxNumber-1)=실제 maxNumber
// 실제 순위는 3<4<5<...<maxNumber<1<2 순서
// 공식: (actualNumber + maxNumber - 3) % maxNumber
// 예시 (maxNumber=13): 3->0, 4->1, ..., 12->9, 13->10, 1->11, 2->12
export function getValueRank(value: number, maxNumber: number): number {
  const actualNumber = value + 1; // value를 실제 숫자로 변환
  return (actualNumber + maxNumber - 3) % maxNumber;
}

// 카드의 최종 비교값 계산: type * maxNumber + value (사용자 요구사항)
export function getCardCompareValue(value: number, type: number, maxNumber: number): number {
  return type * maxNumber + value;
}

export function isStraightWithException(values: number[], maxNumber: number): boolean {
  console.log(`[DEBUG] 스트레이트 검사 시작: values=[${values.join(', ')}], maxNumber=${maxNumber}`);

  // value를 실제 숫자로 변환: 사용자 공식 value + 1
  const actualNumbers = values.map(v => v + 1).sort((a, b) => a - b);
  
  console.log(`[DEBUG] 실제 숫자로 변환: [${actualNumbers.join(', ')}]`);

  // Check for normal consecutive straight
  let isConsecutive = true;
  for (let i = 0; i < actualNumbers.length - 1; i++) {
    if (actualNumbers[i+1] - actualNumbers[i] !== 1) {
      isConsecutive = false;
      break;
    }
  }
  if (isConsecutive) {
    console.log(`[DEBUG] 일반 연속 스트레이트 확인됨.`);
    return true;
  }

  // Check for mountain straight: 10-11-12-1-2 (실제 숫자 기준)
  // value 기준으로는: 9, 10, 11, 0, 1
  const sortedValues = [...values].sort((a, b) => a - b);
  const isMountain = values.length === 5 && 
    sortedValues.includes(0) && sortedValues.includes(1) && // 1, 2
    sortedValues.includes(maxNumber - 3) && sortedValues.includes(maxNumber - 2) && sortedValues.includes(maxNumber - 1); // 10, 11, 12
  
  if (isMountain) {
    console.log(`[DEBUG] 마운틴 스트레이트 (10-11-12-1-2) 확인됨.`);
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
    const { type, value } = parseCard(card, maxNumber);
    return { type, value };
  });

  const firstValue = parsed[0].value;
  if (!parsed.every(c => c.value === firstValue)) return { type: MADE_NONE, value: 0, valid: false };

  const maxType = Math.max(...parsed.map(c => c.type));
  
  // Simple combo도 value 순위 기반으로 비교
  const valueRank = getValueRank(firstValue, maxNumber);
  const compareValue = valueRank * maxNumber * 4 + maxType; // 순위 기반 비교값
  
  // 실제 카드 숫자로 변환해서 로그 출력 (사용자 공식: value + 1)
  const actualNumber = firstValue + 1;
  
  const typeNames = ['구름', '별', '달', '태양'];
  console.log(`[DEBUG] Simple combo 평가: ${typeNames[maxType] || 'Unknown'} ${actualNumber} - len=${len}, firstValue=${firstValue}, valueRank=${valueRank}, maxType=${maxType}, compareValue=${compareValue}`);
  
  return { type: len, value: compareValue, valid: true };
}

// 5장 족보 평가
export function evaluateMade(cards: number[], maxNumber: number): MadeEvalResult {
  if (cards.length !== 5) return { type: MADE_NONE, value: 0, valid: false };

  const parsed = cards.map(card => parseCard(card, maxNumber));
  const values = parsed.map(c => c.value);
  const types = parsed.map(c => c.type);

  const valueCount = new Map<number, number>();
  const typeCount = new Map<number, number>();
  values.forEach(v => valueCount.set(v, (valueCount.get(v) || 0) + 1));
  types.forEach(t => typeCount.set(t, (typeCount.get(t) || 0) + 1));

  const isFlush = typeCount.size === 1;
  const isStraight = isStraightWithException(values, maxNumber);

  let four = false, three = false, two = false;
  for (const count of valueCount.values()) {
    if (count === 4) four = true;
    else if (count === 3) three = true;
    else if (count === 2) two = true;
  }
  
  console.log(`[DEBUG] 족보 판별: isFlush=${isFlush}, isStraight=${isStraight}, typeCount.size=${typeCount.size}`);
  console.log(`[DEBUG] 값 분포:`, Array.from(valueCount.entries()));
  console.log(`[DEBUG] 색상 분포:`, Array.from(typeCount.entries()));
  console.log(`[DEBUG] three=${three}, two=${two}, four=${four}`);
  
  // 각 카드의 실제 숫자 출력
  const actualNumbers = values.map(v => v + 1);
  console.log(`[DEBUG] 실제 숫자들: [${actualNumbers.join(', ')}]`);

  // 스트레이트와 플러쉬: 가장 높은 수(value rank 기준)를 찾아서 순위 결정
  if (isFlush && isStraight) {
    let bestValue = -1, bestType = -1;
    let bestRank = -1;
    for (let i = 0; i < values.length; i++) {
      const rank = getValueRank(values[i], maxNumber);
      if (rank > bestRank || (rank === bestRank && types[i] > bestType)) {
        bestRank = rank;
        bestValue = values[i];
        bestType = types[i];
      }
    }
    
    // 스트레이트 플러쉬는 가장 높은 카드의 순위로 비교
    const compareValue = bestRank * maxNumber * 4 + bestType; // 순위 기반 비교값
    
    console.log(`[DEBUG] 스트레이트 플러쉬 평가: bestValue=${bestValue}, bestRank=${bestRank}, bestType=${bestType}, compareValue=${compareValue}`);
    
    return { type: MADE_STRAIGHTFLUSH, value: compareValue, valid: true };
  }
  
  // 포카드: 4개짜리 조합의 수로 비교
  if (four) {
    let fourValue = [...valueCount.entries()].find(([v, c]) => c === 4)![0];
    let maxType = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i] === fourValue && types[i] > maxType) maxType = types[i];
    }
    
    // 포카드는 4개짜리의 value 순위로 비교해야 함
    const fourRank = getValueRank(fourValue, maxNumber);
    const compareValue = fourRank * maxNumber * 4 + maxType; // 순위 기반 비교값
    
    console.log(`[DEBUG] 포카드 평가: fourValue=${fourValue}, fourRank=${fourRank}, maxType=${maxType}, compareValue=${compareValue}`);
    
    return { type: MADE_FOURCARDS, value: compareValue, valid: true };
  }
  
  // 풀하우스: 3개짜리 조합의 수로 비교
  if (three && two) {
    let threeValue = [...valueCount.entries()].find(([v, c]) => c === 3)![0];
    let maxType = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i] === threeValue && types[i] > maxType) maxType = types[i];
    }
    
    // 풀하우스는 3개짜리의 value 순위로 비교해야 함
    const threeRank = getValueRank(threeValue, maxNumber);
    const compareValue = threeRank * maxNumber * 4 + maxType; // 순위 기반 비교값
    
    console.log(`[DEBUG] 풀하우스 평가: threeValue=${threeValue}, threeRank=${threeRank}, maxType=${maxType}, compareValue=${compareValue}`);
    
    return { type: MADE_FULLHOUSE, value: compareValue, valid: true };
  }
  
  // 플러쉬: 가장 높은 수로 비교
  if (isFlush) {
    let bestValue = -1, bestType = -1;
    let bestRank = -1;
    for (let i = 0; i < values.length; i++) {
      const rank = getValueRank(values[i], maxNumber);
      if (rank > bestRank || (rank === bestRank && types[i] > bestType)) {
        bestRank = rank;
        bestValue = values[i];
        bestType = types[i];
      }
    }
    
    // 플러쉬는 가장 높은 카드의 순위로 비교
    const compareValue = bestRank * maxNumber * 4 + bestType; // 순위 기반 비교값
    
    console.log(`[DEBUG] 플러쉬 평가: bestValue=${bestValue}, bestRank=${bestRank}, bestType=${bestType}, compareValue=${compareValue}`);
    
    return { type: MADE_FLUSH, value: compareValue, valid: true };
  }
  
  // 스트레이트: 가장 높은 수로 비교
  if (isStraight) {
    let bestValue = -1, bestType = -1;
    let bestRank = -1;
    for (let i = 0; i < values.length; i++) {
      const rank = getValueRank(values[i], maxNumber);
      if (rank > bestRank || (rank === bestRank && types[i] > bestType)) {
        bestRank = rank;
        bestValue = values[i];
        bestType = types[i];
      }
    }
    
    // 스트레이트는 가장 높은 카드의 순위로 비교
    const compareValue = bestRank * maxNumber * 4 + bestType; // 순위 기반 비교값
    
    console.log(`[DEBUG] 스트레이트 평가: bestValue=${bestValue}, bestRank=${bestRank}, bestType=${bestType}, compareValue=${compareValue}`);
    
    return { type: MADE_STRAIGHT, value: compareValue, valid: true };
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
