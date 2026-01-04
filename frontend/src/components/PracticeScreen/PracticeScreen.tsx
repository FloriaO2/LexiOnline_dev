import React, { useState, useEffect, useRef } from 'react';
import CombinationWheel from '../GameScreen/CombinationWheel';
import CombinationGuide from '../GameScreen/CombinationGuide';
import GameGuide from '../GameScreen/GameGuide';
import './PracticeScreen.css';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';

interface PracticeScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult' | 'practice') => void;
  maxNumber: 7 | 9 | 13 | 15;
}

interface Card {
  id: string;
  value: number;
  suit: 'sun' | 'moon' | 'star' | 'cloud';
  isSelected: boolean;
  isPlayed: boolean; // 제출된 카드인지 여부
}

interface PlayedCard {
  id: string;
  value: number;
  suit: 'sun' | 'moon' | 'star' | 'cloud';
  isAnimating?: boolean; // 애니메이션 중인지 여부
}

interface GameBoard {
  id: string;
  cards: PlayedCard[];
}

const PracticeScreen: React.FC<PracticeScreenProps> = ({ onScreenChange, maxNumber }) => {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [gameBoards, setGameBoards] = useState<GameBoard[]>([
    { id: 'main', cards: [] },
    { id: 'previous', cards: [] }
  ]);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [gameMode, setGameMode] = useState<'easyMode' | 'normal'>('normal');
  const [showCombinationGuide, setShowCombinationGuide] = useState(false);
  const [showGameGuide, setShowGameGuide] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [pendingFlushSubmission, setPendingFlushSubmission] = useState(false);
  const [showRankGuide, setShowRankGuide] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // 카드 이동 애니메이션 상태
  const [imagesLoaded, setImagesLoaded] = useState(false); // 이미지 로딩 상태
  const mainBoardRef = useRef<HTMLDivElement>(null);
  const previousBoardRef = useRef<HTMLDivElement>(null);

  // 카드 이미지 매핑
  const cardImages = {
    sun: sunImage,
    moon: moonImage,
    star: starImage,
    cloud: cloudImage
  };

  // 카드 색상 매핑 (초보모드 ↔ 일반모드)
  const colorMapping = {
    'gold': 'sun',    // 금색 ↔ 태양 (빨강)
    'silver': 'moon', // 은색 ↔ 달 (초록)
    'bronze': 'star', // 동색 ↔ 별 (노랑)
    'black': 'cloud'  // 검정색 ↔ 구름 (파랑)
  };

  // 현재 모드에 맞는 카드 색상 반환
  const getDisplayColor = (originalSuit: string, mode: 'easyMode' | 'normal'): string => {
    if (mode === 'easyMode') {
      // 초보모드에서는 원본 슈트를 초보모드 색상으로 변환
      const reverseMapping = {
        'sun': 'gold',
        'moon': 'silver', 
        'star': 'bronze',
        'cloud': 'black'
      };
      return reverseMapping[originalSuit as keyof typeof reverseMapping] || originalSuit;
    } else {
      return originalSuit;
    }
  };

  // 이미지 프리로딩 확인
  useEffect(() => {
    const preloadImages = () => {
      const imageUrls = [sunImage, moonImage, starImage, cloudImage];
      let loadedCount = 0;
      
      const checkAllLoaded = () => {
        loadedCount++;
        if (loadedCount === imageUrls.length) {
          setImagesLoaded(true);
        }
      };
      
      imageUrls.forEach(imageUrl => {
        const img = new Image();
        img.onload = checkAllLoaded;
        img.onerror = checkAllLoaded; // 에러가 발생해도 로딩 완료로 처리
        img.src = imageUrl;
      });
    };
    
    preloadImages();
  }, []);

  // 초기 카드 생성 (1-maxNumber, 4가지 슈트)
  useEffect(() => {
    const cards: Card[] = [];
    const suits: ('sun' | 'moon' | 'star' | 'cloud')[] = ['sun', 'moon', 'star', 'cloud'];
    
    suits.forEach(suit => {
      for (let value = 1; value <= maxNumber; value++) {
        cards.push({
          id: `${suit}-${value}`,
          value,
          suit,
          isSelected: false,
          isPlayed: false
        });
      }
    });
    
    setAllCards(cards);
    
    // 알림 메시지 업데이트
    const rankOrder = [];
    for (let i = 3; i <= maxNumber; i++) {
      rankOrder.push(i);
    }
    const normalOrder = rankOrder.join(',');
    setNotificationMessage(`1~${maxNumber}를 사용할 경우 ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>\n아래에서 <span class="highlight-count">윗줄</span>에 있을수록 <span class="highlight-count">패의 순위가 더 높습니다.</span>`);
  }, [maxNumber]);

  // 카드 선택/해제
  const toggleCardSelection = (cardId: string) => {
    setAllCards(prev => prev.map(card => {
      if (card.id === cardId) {
        // 제출된 카드는 선택할 수 없음
        if (card.isPlayed) return card;
        const newSelectionState = !card.isSelected;
        return { ...card, isSelected: newSelectionState };
      }
      return card;
    }));
  };

  // 선택된 카드들을 selectedCards 상태에 동기화
  useEffect(() => {
    const selected = allCards.filter(card => card.isSelected);
    setSelectedCards(selected);
    
    // 선택된 카드 조합이 변경되면 제출 횟수 리셋
    setSubmitCount(0);
    setPendingFlushSubmission(false);
    setShowRankGuide(false);
  }, [allCards]);

  // 카드 조합 검증 및 상세 설명
  const validateCardCombination = (cards: Card[]): { isValid: boolean; message: string } => {
    if (cards.length === 0) {
      return { isValid: false, message: '카드를 선택해주세요.' };
    }

    // 현재 게임보드의 최신 카드 조합
    const currentBoard = gameBoards[0];
    const currentCards = currentBoard.cards;

    // 첫 번째 제출인 경우
    if (currentCards.length === 0) {
      // 단일 카드인 경우
      if (cards.length === 1) {
        const rankOrder = [];
        for (let i = 3; i <= maxNumber; i++) {
          rankOrder.push(i);
        }
        const normalOrder = rankOrder.join(',');
        return { isValid: true, message: `1~${maxNumber}를 사용할 경우, ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>\n아래에서 <span class="highlight-count">윗줄</span>에 있을수록 <span class="highlight-count">패의 순위가 더 높습니다.</span>` };
      }
      
      // 여러 카드인 경우 조합 검증
      const validation = validateCardType(cards);
      if (validation.isValid) {
        const rankOrder = [];
        for (let i = 3; i <= maxNumber; i++) {
          rankOrder.push(i);
        }
        const normalOrder = rankOrder.join(',');
        return { isValid: true, message: `1~${maxNumber}를 사용할 경우, ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>\n아래에서 <span class="highlight-count">윗줄</span>에 있을수록 <span class="highlight-count">패의 순위가 더 높습니다.</span>` };
      } else {
        return validation;
      }
    }

    // 이전 조합과 비교
    const currentCombination = analyzeCardCombination(currentCards);

    // 기존 패 조합과 선택한 패의 개수가 다른 경우 (우선순위 최상위)
    if (currentCards.length !== cards.length) {
      return { isValid: false, message: `기존 조합과 동일하게 <span class="highlight-count">${currentCards.length}개</span>의 패를 제출해야만 합니다.` };
    }

    const newCombination = analyzeCardCombination(cards);

    if (!newCombination.isValid) {
      return newCombination;
    }

    // 조합 순위 비교
    const comparison = compareCombinations(currentCombination, newCombination);
    if (!comparison.isValid) {
      return comparison;
    }

    const rankOrder = [];
    for (let i = 3; i <= maxNumber; i++) {
      rankOrder.push(i);
    }
    const normalOrder = rankOrder.join(',');
    return { isValid: true, message: `1~${maxNumber}를 사용할 경우, ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>` };
  };

  // 카드 타입 검증
  const validateCardType = (cards: Card[]): { isValid: boolean; message: string } => {
    if (cards.length === 1) {
      return { isValid: true, message: '' };
    }

    if (cards.length === 2) {
      // 페어 검증
      const values = cards.map(card => card.value);
      if (values[0] === values[1]) {
        return { isValid: true, message: '' };
      } else {
        return { isValid: false, message: '2장의 패만 제출할 경우, 두 장은 <span class="highlight-count">같은 숫자</span>여야 합니다.' };
      }
    }

    if (cards.length === 3) {
      // 트리플 검증
      const values = cards.map(card => card.value);
      if (values[0] === values[1] && values[1] === values[2]) {
        return { isValid: true, message: '' };
      } else {
        return { isValid: false, message: '3장의 패만 제출할 경우, 세 장은 <span class="highlight-count">같은 숫자</span>여야 합니다.' };
      }
    }

    if (cards.length === 4) {
      // 4장은 유효하지 않은 카드 개수
      return { isValid: false, message: `현재 <span class="highlight-count">${cards.length}장</span>의 패를 제출하려고 시도했으나, 이 게임에는 2장, 3장, 5장의 조합만 존재합니다.\n하단 "족보보기"를 참고해 <span class="highlight-count">유효한 조합</span>을 제출하세요.` };
    }

    if (cards.length === 5) {
      // 5장 조합 검증: 플러쉬, 스트레이트, 풀하우스, 포카드, 스트레이트플러쉬
      const values = cards.map(card => card.value);
      const suits = cards.map(card => card.suit);
      
      // 잘못된 마운틴 패턴 검사
      const invalidMountain = isInvalidMountainPattern(values);
      
      // 값과 색상 분포 계산
      const valueCount = new Map<number, number>();
      const suitCount = new Map<string, number>();
      
      values.forEach(v => valueCount.set(v, (valueCount.get(v) || 0) + 1));
      suits.forEach(s => suitCount.set(s, (suitCount.get(s) || 0) + 1));
      
      const isFlush = suitCount.size === 1;
      const isStraightCheck = isStraight(values);
      
      // 잘못된 마운틴 패턴이 있는 경우 특별한 메시지 반환
      if (invalidMountain.isInvalid) {
        if (isFlush) {
          return { 
            isValid: false, 
            message: `스트레이트플러쉬는 최대 숫자인 ${maxNumber}를 넘어갔을 때, 제일 순위가 높은 <span class="highlight-count">2까지만</span> 사용 가능합니다.\n이를 벗어난 ${highlightInvalidNumbers(invalidMountain.pattern)} 은 스트레이트플러쉬로 <span style="color: red; font-weight: bold;">인정하지 않으며</span>, 추가 설명이 필요하다면 SUBMIT을 다시 눌러주세요.`
          };
        } else {
          return { 
            isValid: false, 
            message: `스트레이트는 최대 숫자인 ${maxNumber}를 넘어갔을 때, 제일 순위가 높은 <span class="highlight-count">2까지만</span> 사용 가능합니다.\n이를 벗어난 ${highlightInvalidNumbers(invalidMountain.pattern)} 은 스트레이트로 <span style="color: red; font-weight: bold;">인정하지 않습니다</span>. 때문에 유효한 조합이 아닙니다.`
          };
        }
      }
      
      // 값 분포 분석
      const counts = Array.from(valueCount.values()).sort((a, b) => b - a);
      const isFourOfKind = counts[0] === 4;
      const isFullHouse = counts[0] === 3 && counts[1] === 2;
      
      if (isFlush && isStraightCheck) {
        return { isValid: true, message: '' }; // 스트레이트플러쉬
      } else if (isFourOfKind) {
        return { isValid: true, message: '' }; // 포카드
      } else if (isFullHouse) {
        return { isValid: true, message: '' }; // 풀하우스
      } else if (isFlush) {
        return { isValid: true, message: '' }; // 플러쉬
      } else if (isStraightCheck) {
        return { isValid: true, message: '' }; // 스트레이트
      } else {
        return { isValid: false, message: '5장의 카드는 유효한 조합(스트레이트, 플러쉬, 풀하우스, 포카드, 스트레이트플러쉬)이어야 합니다.' };
      }
    }

    return { isValid: false, message: `현재 <span class="highlight-count">${cards.length}장</span>의 패를 제출하려고 시도했으나, 이 게임에는 2장, 3장, 5장의 조합만 존재합니다.\n하단 "족보보기"를 참고해 <span class="highlight-count">유효한 조합</span>을 제출하세요.` };
  };

  // 색상 순위 계산 (백엔드 로직과 동일)
  const getColorRank = (suit: string): number => {
    const colorOrder = ['cloud', 'star', 'moon', 'sun']; // 구름 < 별 < 달 < 태양 (낮은 순위부터)
    return colorOrder.indexOf(suit);
  };

  // 숫자 순위 계산 (maxNumber에 따라 동적 조정)
  const getValueRank = (value: number): number => {
    // 3부터 maxNumber까지의 순서, 그 다음 1, 2
    const rankOrder = [];
    for (let i = 3; i <= maxNumber; i++) {
      rankOrder.push(i);
    }
    rankOrder.push(1, 2);
    return rankOrder.indexOf(value);
  };

  // 잘못된 마운틴 패턴 감지
  const isInvalidMountainPattern = (values: number[]): { isInvalid: boolean; pattern: string } => {
    if (values.length !== 5) return { isInvalid: false, pattern: '' };
    
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // 잘못된 마운틴 패턴들
    const invalidPatterns = [
      [maxNumber - 1, maxNumber, 1, 2, 3],
      [maxNumber, 1, 2, 3, 4]
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.every(num => sortedValues.includes(num))) {
        return { isInvalid: true, pattern: pattern.join(' ') };
      }
    }
    
    return { isInvalid: false, pattern: '' };
  };

  // 패턴에서 3, 4를 빨간색으로 강조하는 함수
  const highlightInvalidNumbers = (pattern: string): string => {
    return pattern
      .split(' ')
      .map(num => {
        const numValue = parseInt(num);
        if (numValue === 3 || numValue === 4) {
          return `<span style="color: red; font-weight: bold;">${num}</span>`;
        }
        return num;
      })
      .join(' ');
  };

  // 스트레이트 검증 (백엔드 로직과 동일)
  const isStraight = (values: number[]): boolean => {
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // 일반 연속 스트레이트 검사
    let isConsecutive = true;
    for (let i = 1; i < sortedValues.length; i++) {
      if (sortedValues[i] - sortedValues[i-1] !== 1) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) return true;
    
    // 마운틴 스트레이트 검사 (maxNumber별 특정 패턴)
    if (values.length === 5) {
      // maxNumber별 마운틴 스트레이트 패턴
      if (maxNumber === 7) {
        // 7인 경우: 5,6,7,1,2 패턴
        const pattern = [5, 6, 7, 1, 2];
        if (pattern.every(num => sortedValues.includes(num))) {
          return true;
        }
      } else if (maxNumber === 9) {
        // 9인 경우: 7,8,9,1,2 또는 6,7,8,9,1 패턴
        const pattern1 = [7, 8, 9, 1, 2];
        const pattern2 = [6, 7, 8, 9, 1];
        if (pattern1.every(num => sortedValues.includes(num)) || 
            pattern2.every(num => sortedValues.includes(num))) {
          return true;
        }
      } else if (maxNumber === 13) {
        // 13인 경우: 11,12,13,1,2 또는 10,11,12,13,1 패턴
        const pattern1 = [11, 12, 13, 1, 2];
        const pattern2 = [10, 11, 12, 13, 1];
        if (pattern1.every(num => sortedValues.includes(num)) || 
            pattern2.every(num => sortedValues.includes(num))) {
          return true;
        }
      } else if (maxNumber === 15) {
        // 15인 경우: 13,14,15,1,2 또는 12,13,14,15,1 패턴
        const pattern1 = [13, 14, 15, 1, 2];
        const pattern2 = [12, 13, 14, 15, 1];
        if (pattern1.every(num => sortedValues.includes(num)) || 
            pattern2.every(num => sortedValues.includes(num))) {
          return true;
        }
      }
    }
    
    return false;
  };

  // 카드 조합 분석 (색상 순위 고려)
  const analyzeCardCombination = (cards: PlayedCard[]): { type: string; value: number; isValid: boolean; message: string } => {
    if (cards.length === 1) {
      const card = cards[0];
      const valueRank = getValueRank(card.value);
      const colorRank = getColorRank(card.suit);
      const compareValue = valueRank * 4 + colorRank; // 백엔드와 동일한 비교값 계산
      return { type: 'single', value: compareValue, isValid: true, message: '' };
    }
    
    if (cards.length === 2) {
      const values = cards.map(card => card.value);
      if (values[0] === values[1]) {
        const cardValue = values[0];
        const maxColorRank = Math.max(...cards.map(card => getColorRank(card.suit)));
        const valueRank = getValueRank(cardValue);
        const compareValue = valueRank * 4 + maxColorRank; // 백엔드와 동일한 비교값 계산
        return { type: 'pair', value: compareValue, isValid: true, message: '' };
      }
      return { type: 'invalid', value: 0, isValid: false, message: '2장의 카드는 같은 숫자여야 합니다.' };
    }
    
    if (cards.length === 3) {
      const values = cards.map(card => card.value);
      if (values[0] === values[1] && values[1] === values[2]) {
        const cardValue = values[0];
        const maxColorRank = Math.max(...cards.map(card => getColorRank(card.suit)));
        const valueRank = getValueRank(cardValue);
        const compareValue = valueRank * 4 + maxColorRank; // 백엔드와 동일한 비교값 계산
        return { type: 'triple', value: compareValue, isValid: true, message: '' };
      }
      return { type: 'invalid', value: 0, isValid: false, message: '3장의 카드는 모두 같은 숫자여야 합니다.' };
    }
    
    if (cards.length === 4) {
      // 4장은 유효하지 않은 카드 개수
      return { type: 'invalid', value: 0, isValid: false, message: `현재 <span class="highlight-count">${cards.length}장</span>의 패를 제출하려고 시도했으나, 이 게임에는 2장, 3장, 5장의 조합만 존재합니다.\n하단 "족보보기"를 참고해 <span class="highlight-count">유효한 조합</span>을 제출하세요.` };
    }
    
    if (cards.length === 5) {
      // 5장 조합 분석: 백엔드 로직과 동일
      const values = cards.map(card => card.value);
      const suits = cards.map(card => card.suit);
      
      // 잘못된 마운틴 패턴 검사
      const invalidMountain = isInvalidMountainPattern(values);
      
      // 값과 색상 분포 계산
      const valueCount = new Map<number, number>();
      const suitCount = new Map<string, number>();
      
      values.forEach(v => valueCount.set(v, (valueCount.get(v) || 0) + 1));
      suits.forEach(s => suitCount.set(s, (suitCount.get(s) || 0) + 1));
      
      const isFlush = suitCount.size === 1;
      const isStraightCheck = isStraight(values);
      
      // 잘못된 마운틴 패턴이 있는 경우 특별한 메시지 반환
      if (invalidMountain.isInvalid) {
        if (isFlush) {
          return { 
            type: 'invalid', 
            value: 0, 
            isValid: false, 
            message: `스트레이트플러쉬는 최대 숫자인 ${maxNumber}를 넘어갔을 때, 제일 순위가 높은 <span class="highlight-count">2까지만</span> 사용 가능합니다.\n이를 벗어난 ${highlightInvalidNumbers(invalidMountain.pattern)} 은 스트레이트플러쉬로 <span style="color: red; font-weight: bold;">인정하지 않으며</span>, 추가 설명이 필요하다면 SUBMIT을 다시 눌러주세요.`
          };
        } else {
          return { 
            type: 'invalid', 
            value: 0, 
            isValid: false, 
            message: `스트레이트는 최대 숫자인 ${maxNumber}를 넘어갔을 때, 제일 순위가 높은 <span class="highlight-count">2까지만</span> 사용 가능합니다.\n이를 벗어난 ${highlightInvalidNumbers(invalidMountain.pattern)} 은 스트레이트로 <span style="color: red; font-weight: bold;">인정하지 않습니다</span>. 때문에 유효한 조합이 아닙니다.`
          };
        }
      }
      
      // 값 분포 분석
      const counts = Array.from(valueCount.values()).sort((a, b) => b - a);
      const isFourOfKind = counts[0] === 4;
      const isFullHouse = counts[0] === 3 && counts[1] === 2;
      
      // 스트레이트플러쉬: 가장 높은 카드의 순위와 색상 고려
      if (isFlush && isStraightCheck) {
        let bestValue = -1, bestType = -1;
        let bestRank = -1;
        
        for (let i = 0; i < cards.length; i++) {
          const rank = getValueRank(cards[i].value);
          if (rank > bestRank || (rank === bestRank && getColorRank(cards[i].suit) > bestType)) {
            bestRank = rank;
            bestValue = cards[i].value;
            bestType = getColorRank(cards[i].suit);
          }
        }
        
        const compareValue = bestRank * 4 + bestType;
        return { type: 'straightflush', value: compareValue, isValid: true, message: '' };
      }
      
      // 포카드: 4개짜리 조합의 순위와 최고 색상 고려
      if (isFourOfKind) {
        let fourValue = Array.from(valueCount.entries()).find(([v, c]) => c === 4)![0];
        let maxType = -1;
        
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].value === fourValue && getColorRank(cards[i].suit) > maxType) {
            maxType = getColorRank(cards[i].suit);
          }
        }
        
        const fourRank = getValueRank(fourValue);
        const compareValue = fourRank * 4 + maxType;
        return { type: 'fourcards', value: compareValue, isValid: true, message: '' };
      }
      
      // 풀하우스: 3개짜리 조합의 순위와 최고 색상 고려
      if (isFullHouse) {
        let threeValue = Array.from(valueCount.entries()).find(([v, c]) => c === 3)![0];
        let maxType = -1;
        
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].value === threeValue && getColorRank(cards[i].suit) > maxType) {
            maxType = getColorRank(cards[i].suit);
          }
        }
        
        const threeRank = getValueRank(threeValue);
        const compareValue = threeRank * 4 + maxType;
        return { type: 'fullhouse', value: compareValue, isValid: true, message: '' };
      }
      
      // 플러쉬: 가장 높은 카드의 순위와 색상 고려
      if (isFlush) {
        let bestValue = -1, bestType = -1;
        let bestRank = -1;
        
        for (let i = 0; i < cards.length; i++) {
          const rank = getValueRank(cards[i].value);
          if (rank > bestRank || (rank === bestRank && getColorRank(cards[i].suit) > bestType)) {
            bestRank = rank;
            bestValue = cards[i].value;
            bestType = getColorRank(cards[i].suit);
          }
        }
        
        const compareValue = bestRank * 4 + bestType;
        return { type: 'flush', value: compareValue, isValid: true, message: '' };
      }
      
      // 스트레이트: 가장 높은 카드의 순위와 색상 고려
      if (isStraightCheck) {
        let bestValue = -1, bestType = -1;
        let bestRank = -1;
        
        for (let i = 0; i < cards.length; i++) {
          const rank = getValueRank(cards[i].value);
          if (rank > bestRank || (rank === bestRank && getColorRank(cards[i].suit) > bestType)) {
            bestRank = rank;
            bestValue = cards[i].value;
            bestType = getColorRank(cards[i].suit);
          }
        }
        
        const compareValue = bestRank * 4 + bestType;
        return { type: 'straight', value: compareValue, isValid: true, message: '' };
      }
      
      return { type: 'invalid', value: 0, isValid: false, message: '유효하지 않은 5장 조합입니다.' };
    }
    
    return { type: 'invalid', value: 0, isValid: false, message: '유효하지 않은 카드 조합입니다.' };
  };

  // 조합 비교 (색상 순위 고려)
  const compareCombinations = (current: { type: string; value: number; isValid: boolean; message: string }, newComb: { type: string; value: number; isValid: boolean; message: string }): { isValid: boolean; message: string } => {
    if (!current.isValid) {
      return { isValid: true, message: '' };
    }

    // 조합 타입별 순위 (백엔드와 동일)
    const typeOrder: { [key: string]: number } = { 
      single: 1, 
      pair: 2, 
      triple: 3, 
      straight: 4,    // 스트레이트
      flush: 5,       // 플러쉬  
      fullhouse: 6,   // 풀하우스
      fourcards: 7,   // 포카드
      straightflush: 8 // 스트레이트플러쉬
    };

    if (typeOrder[newComb.type] > typeOrder[current.type]) {
      return { isValid: true, message: '' };
    }

    if (typeOrder[newComb.type] < typeOrder[current.type]) {
      return { 
        isValid: false, 
        message: `현재 조합인 <span class="highlight-count">${getCombinationTypeName(current.type)}</span>와 <span class="highlight-count">같거나 높은 순위</span>의 조합이 필요합니다.\n자세한 조합 순위는 하단 "족보보기"를 클릭해 확인해주세요.`
      };
    }

    // 같은 타입인 경우 색상 순위를 고려한 비교값으로 비교
    if (newComb.value > current.value) {
      return { isValid: true, message: '' };
    } else {
      // 더 구체적인 오류 메시지 제공
      const currentValue = Math.floor(current.value / 4);
      const currentColor = current.value % 4;
      const newValue = Math.floor(newComb.value / 4);
      const newColor = newComb.value % 4;
      
      const valueNames = ['3', '4', '5', '6', '7', '8', '9', '1', '2'];
      const colorNames = gameMode === 'easyMode' 
        ? ['검정색', '동색', '은색', '금색']  // 초보모드
        : ['구름', '별', '달', '태양']; // 일반모드
      
      const currentValueName = valueNames[currentValue];
      const currentColorName = colorNames[currentColor];
      const newValueName = valueNames[newValue];
      const newColorName = colorNames[newColor];
      
      // 풀하우스와 포카드는 특별한 메시지 처리
      if (current.type === 'fullhouse') {
        return {
          isValid: false,
          message: `${getCombinationTypeName(current.type)}는 <span class="highlight-count">3개짜리 패의 값</span>끼리 비교합니다.\n현재 조합에서의 3개짜리 패의 값인 <span class="highlight-count">${currentValueName}</span>보다 순위가 높은 숫자가 3개 조합으로 있어야 합니다.`
        };
      } else if (current.type === 'fourcards') {
        return {
          isValid: false,
          message: `${getCombinationTypeName(current.type)}는 <span class="highlight-count">4개짜리 패의 값</span>끼리 비교합니다.\n현재 조합에서의 4개짜리 패의 값인 <span class="highlight-count">${currentValueName}</span>보다 순위가 높은 숫자가 4개 조합으로 있어야 합니다.`
        };
      } else if (current.type === 'triple') {
        return {
          isValid: false,
          message: `${getCombinationTypeName(current.type)}의 경우, 기존 조합보다 <span class="highlight-count">순위가 더 높은 숫자</span>를 제출해야 합니다.\n현재 기존 조합의 값은 <span class="highlight-count">${currentValueName}</span>이므로 이보다 더 높은 순위의 숫자로 3장을 제출해야 합니다.`
        };
      } else if (current.type === 'pair') {
        return {
          isValid: false,
          message: `${getCombinationTypeName(current.type)}의 경우, 기존 조합에서 <span class="highlight-count">가장 순위가 높은 패</span>와 비교해야 합니다.\n현재 <span class="highlight-count">${currentColorName} ${currentValueName}</span>가 가장 높은 순위이므로, 이보다 더 높은 순위의 패를 포함한 <span class="highlight-count">같은 숫자 2장</span>을 제출해야 합니다.`
        };
      } else {
        return {
          isValid: false,
          message: `${getCombinationTypeName(current.type)}의 경우, 기존 조합에서 <span class="highlight-count">가장 순위가 높은 패</span>와 비교해야 합니다.\n현재 <span class="highlight-count">${currentColorName} ${currentValueName}</span>가 가장 높은 순위이므로, 이보다 더 높은 순위의 패를 포함한 조합을 제출해야 합니다.`
        };
      }
    }
  };

  // 조합 타입 이름
  const getCombinationTypeName = (type: string): string => {
    switch (type) {
      case 'single': return '단일 카드';
      case 'pair': return '페어';
      case 'triple': return '트리플';
      case 'straight': return '스트레이트';
      case 'flush': return '플러쉬';
      case 'fullhouse': return '풀하우스';
      case 'fourcards': return '포카드';
      case 'straightflush': return '스트레이트플러쉬';
      default: return '알 수 없는 조합';
    }
  };

  // 카드 값의 순위 (2가 가장 높음)
  const getHighestValue = (value: number): number => {
    const rankOrder = [3, 4, 5, 6, 7, 8, 9, 1, 2];
    return rankOrder.indexOf(value);
  };

  // 다음 높은 값 찾기
  const getNextHigherValue = (currentValue: number): number => {
    const rankOrder = [3, 4, 5, 6, 7, 8, 9, 1, 2];
    const currentIndex = rankOrder.indexOf(currentValue);
    if (currentIndex < rankOrder.length - 1) {
      return rankOrder[currentIndex + 1];
    }
    return 2; // 가장 높은 값
  };

  // 현재 조합 텍스트 가져오기
  const getCurrentCombinationText = (): string => {
    if (gameBoards[0].cards.length === 0) {
      return '미등록';
    }
    
    const lastBoard = gameBoards[0];
    const combination = analyzeCardCombination(lastBoard.cards);
    return getCombinationTypeNameForWheel(combination.type);
  };

  // 조합 타입을 게임화면과 동일한 형식으로 변환
  const getCombinationTypeNameForWheel = (type: string): string => {
    switch (type) {
      case 'single': return '싱글';
      case 'pair': return '원페어';
      case 'triple': return '트리플';
      case 'straight': return '스트레이트';
      case 'flush': return '플러쉬';
      case 'fullhouse': return '풀하우스';
      case 'fourcards': return '포카드';
      case 'straightflush': return '스트레이트플러쉬';
      default: return '미등록';
    }
  };

  // 족보보기 핸들러
  const handleViewCombinations = () => {
    setShowCombinationGuide(true);
  };

  // 모드 변경 핸들러
  const handleModeChange = () => {
    const newMode = gameMode === 'easyMode' ? 'normal' : 'easyMode';
    setGameMode(newMode);
  };


  // 제출할 카드를 정렬하는 함수
  const sortCardsForSubmission = (cards: Card[]): Card[] => {
    // 색상 순서 정의
    const colorOrder = gameMode === 'easyMode' 
      ? ['black', 'bronze', 'silver', 'gold']  // 초보모드
      : ['cloud', 'star', 'moon', 'sun'];     // 일반모드 (낮은 순위부터)
    
    return cards.sort((a, b) => {
      // 먼저 숫자로 정렬 (오름차순)
      if (a.value !== b.value) {
        return a.value - b.value;
      }
      
      // 숫자가 같다면 색상으로 정렬
      const aColorIndex = colorOrder.indexOf(a.suit);
      const bColorIndex = colorOrder.indexOf(b.suit);
      
      return aColorIndex - bColorIndex;
    });
  };

  // 카드 이동 애니메이션 함수
  const animateCardMovement = async (cardsToMove: PlayedCard[]): Promise<void> => {
    if (cardsToMove.length === 0 || !mainBoardRef.current || !previousBoardRef.current) {
      return;
    }

    setIsAnimating(true);

    // 기존 previous-board의 카드들을 서서히 사라지게 하기
    const existingPreviousCards = previousBoardRef.current?.querySelectorAll('.previous-board-cards .practice-card');
    if (existingPreviousCards && existingPreviousCards.length > 0) {
      existingPreviousCards.forEach((card, index) => {
        const cardElement = card as HTMLElement;
        cardElement.style.transition = 'opacity 0.4s ease-out';
        cardElement.style.opacity = '0';
      });
    }

    // main-board와 previous-board의 위치 정보 가져오기
    const mainBoardRect = mainBoardRef.current.getBoundingClientRect();
    const previousBoardRect = previousBoardRef.current.getBoundingClientRect();

    // main-board와 previous-board의 카드 크기 비율 계산
    const mainCardWidth = 5 * window.innerWidth / 100; // main-board 카드 너비
    const previousCardWidth = 3 * window.innerWidth / 100; // previous-board 카드 너비
    const cardGap = 0.5 * window.innerWidth / 100; // 카드 간격
    
    // 실제 카드 배치 계산 (gap과 정렬 고려)
    const totalMainWidth = (mainCardWidth * cardsToMove.length) + (cardGap * (cardsToMove.length - 1));
    const totalPreviousWidth = (previousCardWidth * cardsToMove.length) + (cardGap * (cardsToMove.length - 1));
    
    // main-board의 카드 배치 중심점 계산
    const mainCardsContainer = mainBoardRef.current?.querySelector('.main-board-cards') as HTMLElement;
    
    if (!mainCardsContainer) {
      setIsAnimating(false);
      return;
    }
    
    const mainCardsRect = mainCardsContainer.getBoundingClientRect();
    
    // previous-board의 카드 배치 중심점 계산 (main-board와 동일한 방식으로)
    const previousCardsContainer = previousBoardRef.current?.querySelector('.previous-board-cards') as HTMLElement;
    
    if (!previousCardsContainer) {
      setIsAnimating(false);
      return;
    }
    
    const previousCardsRect = previousCardsContainer.getBoundingClientRect();
    
    // 실제 카드 배치의 중심점 계산 (컨테이너 중심이 아닌 카드들의 실제 중심)
    const mainBoardCenterX = mainCardsRect.left + mainCardsRect.width / 2;
    const mainBoardCenterY = mainCardsRect.top + mainCardsRect.height / 2;
    const previousBoardCenterX = previousCardsRect.left + previousCardsRect.width / 2;
    const previousBoardCenterY = previousCardsRect.top + previousCardsRect.height / 2;
    
    // 각 카드에 대해 애니메이션 실행
    const animationPromises = cardsToMove.map((card, index) => {
      return new Promise<void>((resolve) => {
        // main-board에서 해당 카드 요소 찾기
        const cardElement = mainBoardRef.current?.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement;
        
        if (!cardElement) {
          resolve();
          return;
        }

        // 카드의 현재 위치와 크기
        const cardRect = cardElement.getBoundingClientRect();
        
        // main-board에서의 카드 중심점
        const mainCardCenterX = cardRect.left + cardRect.width / 2;
        const mainCardCenterY = cardRect.top + cardRect.height / 2;
        
        // main-board에서의 카드 중심점이 전체 패 중심점으로부터 얼마나 떨어져 있는지 계산
        const offsetFromMainCenter = mainCardCenterX - mainBoardCenterX;
        
        // 비율에 따라 previous-board에서의 위치 계산
        const scaleRatio = previousCardWidth / mainCardWidth;
        const previousOffset = offsetFromMainCenter * scaleRatio;
        
        // previous-board에서의 실제 카드 배치 위치 사용 (정확한 계산)
        const previousCardStartX = previousBoardCenterX - (totalPreviousWidth / 2);
        const targetX = previousCardStartX + (index * (previousCardWidth + cardGap));
        const targetY = previousBoardCenterY - (4.3 * window.innerWidth / 100 / 2); // previous-board 카드 높이의 절반
        
        
        
        // 이동 거리 계산 (오차 보정 적용)
        const offsetX = 17; // 우측으로 치우치는 오차, 커질수록 왼쪽
        const offsetY = 29;   // 아래로 치우치는 오차, 커질수록 올라감
        const deltaX = (targetX - cardRect.left) - offsetX;
        const deltaY = (targetY - cardRect.top) - offsetY;
        
        // 크기 변화 계산 (main-board: 5vw x 7.1vw → previous-board: 3vw x 4.3vw)
        const scaleX = (3 * window.innerWidth / 100) / (5 * window.innerWidth / 100);
        const scaleY = (4.3 * window.innerWidth / 100) / (7.1 * window.innerWidth / 100);

        // 애니메이션 적용
        cardElement.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        cardElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
        cardElement.style.opacity = '0.7'; // previous-board와 동일한 반투명도
        cardElement.style.zIndex = '1000';

        // 애니메이션 완료 후 정리
        setTimeout(() => {
          cardElement.style.transition = '';
          cardElement.style.transform = '';
          cardElement.style.zIndex = '';
          resolve();
        }, 600);
      });
    });

    // 모든 애니메이션 완료 대기
    await Promise.all(animationPromises);
    
    // 애니메이션 완료 후 상태 업데이트
    setTimeout(() => {
      setIsAnimating(false);
    }, 100);
  };

  // 카드 제출
  const submitCards = () => {
    const validation = validateCardCombination(selectedCards);
    
    if (!validation.isValid) {
      // 잘못된 마운틴 패턴인지 확인
      const values = selectedCards.map(card => card.value);
      const invalidMountain = isInvalidMountainPattern(values);
      
      if (invalidMountain.isInvalid) {
        // 잘못된 마운틴 패턴인 경우
        const suits = selectedCards.map(card => card.suit);
        const isFlush = new Set(suits).size === 1;
        
        if (isFlush && !pendingFlushSubmission) {
          // 플러쉬로 제출 가능한 경우
          if (submitCount === 0) {
            // 첫 번째 제출: 마운틴 패턴 오류 메시지
            setNotificationMessage(`스트레이트플러쉬는 최대 숫자인 ${maxNumber}를 넘어갔을 때, 제일 순위가 높은 <span class="highlight-count">2까지만</span> 사용 가능합니다.\n이를 벗어난 ${highlightInvalidNumbers(invalidMountain.pattern)} 은 스트레이트플러쉬로 <span style="color: red; font-weight: bold;">인정하지 않으며</span>, 추가 설명이 필요하다면 SUBMIT을 다시 눌러주세요.`);
            setSubmitCount(1);
          } else {
            // 두 번째 제출: 플러쉬로 제출 가능하다는 안내
            setNotificationMessage(`현재는 스트레이트가 인정되지 않아 <span class="highlight-count">플러쉬</span> 상태입니다.\n<span class="highlight-count">플러쉬</span> 조합으로 제출하고 싶다면 SUBMIT을 한번 더 눌러주세요.`);
            setPendingFlushSubmission(true);
            setSubmitCount(2);
          }
        } else if (isFlush && pendingFlushSubmission) {
          // 세 번째 제출: 플러쉬로 제출
          // 플러쉬 조합으로 제출 처리
          const playedCards: PlayedCard[] = selectedCards.map(card => ({
            id: card.id,
            value: card.value,
            suit: card.suit
          }));

          // 애니메이션이 필요한 경우 (기존 패가 있을 때)
          if (gameBoards[0].cards.length > 0) {
            // 애니메이션 실행
            animateCardMovement(gameBoards[0].cards).then(() => {
              // 애니메이션 완료 후 게임보드 업데이트
              setGameBoards(prev => {
                const newBoards = [...prev];
                newBoards[1] = { id: 'previous', cards: [...gameBoards[0].cards] };
                newBoards[0] = { id: 'main', cards: playedCards };
                return newBoards;
              });
            });
            
            // 페이드아웃 완료 후 previous-board 비우기
            setTimeout(() => {
              setGameBoards(prev => {
                const newBoards = [...prev];
                newBoards[1] = { id: 'previous', cards: [] };
                return newBoards;
              });
            }, 400); // 0.4초 후 (페이드아웃 완료 후)
          } else {
            // 애니메이션이 필요 없는 경우 (첫 번째 제출)
            setGameBoards(prev => {
              const newBoards = [...prev];
              newBoards[0] = { id: 'main', cards: playedCards };
              return newBoards;
            });
          }

          setAllCards(prev => prev.map(card => {
            const isSelected = selectedCards.some(selectedCard => selectedCard.id === card.id);
            return isSelected ? { ...card, isPlayed: true, isSelected: false } : card;
          }));
          
          // 기본 알림 메시지로 복원 및 상태 리셋
          const rankOrder = [];
          for (let i = 3; i <= maxNumber; i++) {
            rankOrder.push(i);
          }
          const normalOrder = rankOrder.join(',');
          setNotificationMessage(`1~${maxNumber}를 사용할 경우, ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>`);
          setSubmitCount(0);
          setPendingFlushSubmission(false);
          setShowRankGuide(false);
          return;
        } else {
          // 플러쉬가 아닌 경우: 기존 로직
          if (submitCount % 2 === 0) {
            setNotificationMessage(`스트레이트는 최대 숫자인 ${maxNumber}를 넘어갔을 때, 제일 순위가 높은 <span class="highlight-count">2까지만</span> 사용 가능합니다.\n이를 벗어난 ${highlightInvalidNumbers(invalidMountain.pattern)} 은 스트레이트로 <span style="color: red; font-weight: bold;">인정하지 않습니다</span>. 때문에 유효한 조합이 아닙니다.`);
          } else {
            const currentBoard = gameBoards[0];
            if (currentBoard.cards.length > 0) {
              const currentCombination = analyzeCardCombination(currentBoard.cards);
              setNotificationMessage(`현재 조합인 <span class="highlight-count">${getCombinationTypeName(currentCombination.type)}</span>와 <span class="highlight-count">같거나 높은 순위</span>의 조합이 필요합니다.\n현재는 스트레이트가 인정되지 않아 플러쉬 상태입니다. 자세한 내용은 SUBMIT을 다시 눌러 확인해보세요.`);
            } else {
              setNotificationMessage(validation.message);
            }
          }
          setSubmitCount(prev => prev + 1);
        }
      } else {
        // "가장 순위가 높은 패" 메시지인지 확인
        const isRankGuideMessage = validation.message.includes('가장 순위가 높은 패');
        
        if (isRankGuideMessage) {
          if (showRankGuide) {
            // 두 번째 제출: 순위 가이드 메시지 표시
            setNotificationMessage('아래에서 <span class="highlight-count">윗줄</span>에 있을수록 <span class="highlight-count">패의 순위가 더 높습니다.</span>');
            setShowRankGuide(false);
            setSubmitCount(0);
          } else {
            // 첫 번째 제출: 기본 메시지 표시
            setNotificationMessage(validation.message);
            setShowRankGuide(true);
            setSubmitCount(prev => prev + 1);
          }
        } else {
          setNotificationMessage(validation.message);
          setShowRankGuide(false);
        }
      }
      return;
    }

    // 선택된 카드를 정렬
    const sortedSelectedCards = sortCardsForSubmission([...selectedCards]);

    // 유효한 조합인 경우 게임보드에 추가
    const playedCards: PlayedCard[] = sortedSelectedCards.map(card => ({
      id: card.id,
      value: card.value,
      suit: card.suit
    }));

    // 애니메이션이 필요한 경우 (기존 패가 있을 때)
    if (gameBoards[0].cards.length > 0) {
      // 애니메이션 실행
      animateCardMovement(gameBoards[0].cards).then(() => {
        // 애니메이션 완료 후 게임보드 업데이트
        setGameBoards(prev => {
          const newBoards = [...prev];
          newBoards[1] = { id: 'previous', cards: [...gameBoards[0].cards] };
          newBoards[0] = { id: 'main', cards: playedCards };
          return newBoards;
        });
      });
      
      // 페이드아웃 완료 후 previous-board 비우기
      setTimeout(() => {
        setGameBoards(prev => {
          const newBoards = [...prev];
          newBoards[1] = { id: 'previous', cards: [] };
          return newBoards;
        });
      }, 400); // 0.4초 후 (페이드아웃 완료 후)
    } else {
      // 애니메이션이 필요 없는 경우 (첫 번째 제출)
      setGameBoards(prev => {
        const newBoards = [...prev];
        newBoards[0] = { id: 'main', cards: playedCards };
        return newBoards;
      });
    }

    // 선택된 카드들을 제출된 상태로 변경 (정렬된 순서대로)
    setAllCards(prev => prev.map(card => {
      const isSelected = sortedSelectedCards.some(sortedCard => sortedCard.id === card.id);
      return isSelected ? { ...card, isPlayed: true, isSelected: false } : card;
    }));
    
    // 기본 알림 메시지로 복원 및 submitCount 리셋
    const rankOrder = [];
    for (let i = 3; i <= maxNumber; i++) {
      rankOrder.push(i);
    }
    const normalOrder = rankOrder.join(',');
    setNotificationMessage(`1~${maxNumber}를 사용할 경우, ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>`);
    setSubmitCount(0);
    setPendingFlushSubmission(false);
    setShowRankGuide(false);
  };

  // 리셋 기능
  const resetGame = () => {
    // 모든 카드를 초기 상태로 리셋
    setAllCards(prev => prev.map(card => ({
      ...card,
      isSelected: false,
      isPlayed: false
    })));
    setSelectedCards([]);
    
    // 게임보드 초기화
    setGameBoards([
      { id: 'main', cards: [] },
      { id: 'previous', cards: [] }
    ]);
    
    // 알림 메시지 초기화 및 submitCount 리셋
    const rankOrder = [];
    for (let i = 3; i <= maxNumber; i++) {
      rankOrder.push(i);
    }
    const normalOrder = rankOrder.join(',');
    setNotificationMessage(`1~${maxNumber}를 사용할 경우, ${normalOrder},<span class="highlight-count">1,2</span> 순서대로 순위가 높습니다. <span class="highlight-count">2는 항상 순위가 가장 높습니다.</span>`);
    setSubmitCount(0);
    setPendingFlushSubmission(false);
    setShowRankGuide(false);
  };

  // 카드 렌더링
  const renderCard = (card: Card, isHand: boolean = true) => {
    const displayColor = getDisplayColor(card.suit, gameMode);
    
    return (
      <div
        key={card.id}
        data-card-id={card.id}
        className={`practice-card ${card.isPlayed ? 'played-card' : displayColor} ${card.isSelected ? 'selected' : ''} ${isHand ? 'hand-card' : 'board-card'}`}
        onClick={() => isHand && !card.isPlayed && toggleCardSelection(card.id)}
      >
        {!card.isPlayed && gameMode === 'normal' && <img src={cardImages[card.suit]} alt={card.suit} className="card-suit-image" draggable="false" />}
        {!card.isPlayed && <span className="card-value">{card.value}</span>}
      </div>
    );
  };

  // 게임보드 렌더링
  const renderGameBoard = (board: GameBoard, isMain: boolean = true) => (
    <div 
      ref={isMain ? mainBoardRef : previousBoardRef}
      className={`practice-game-board ${isMain ? 'main-board' : 'previous-board'}`}
    >
      <div className={`board-cards ${isMain ? 'main-board-cards' : 'previous-board-cards'}`}>
        {board.cards.map(card => renderCard(card as Card, false))}
      </div>
    </div>
  );

  return (
    <div className="practice-screen">
      <div className="practice-container">
        {/* 상단 알림 영역 */}
        <div className="practice-notification">
          <div className="notification-content">
            <span className={`guide-tag ${notificationMessage.includes('순서대로 순위가 높습니다') ? 'guide-tag-rank-order' : ''}`}>💡GUIDE</span>
            <span dangerouslySetInnerHTML={{ __html: notificationMessage.replace(/<span class="highlight-count">(.*?)<\/span>/g, '<span class="highlight-count">$1</span>') }}></span>
          </div>
        </div>

        {/* 게임보드 영역 */}
        <div className="practice-game-area">
          {renderGameBoard(gameBoards[0], true)}
          {renderGameBoard(gameBoards[1], false)}
        </div>

        {/* 하단 - 내 정보 및 컨트롤 */}
        <div className="practice-bottom-section">
          {/* 하단 상단 - 내 정보 및 컨트롤 */}
          <div className="practice-bottom-top">
            {/* 좌측 - 내 정보 (RESET 버튼으로 대체) */}
            <div className="practice-reset-btn-box">
              <button className="practice-reset-btn" onClick={resetGame}>
                RESET
              </button>
            </div>

            {/* 중앙 - 라운드, 현재 조합 및 버튼들 */}
            <div className="practice-center-controls">
              <div className="practice-round-info-inline">
                <span className="practice-round-text-inline">
                  연습모드
                </span>
              </div>
              
              <div className="practice-current-combination">
                <CombinationWheel 
                  currentCombination={getCurrentCombinationText()}
                  lastType={gameBoards[0].cards.length > 0 ? 1 : 0}
                  lastMadeType={gameBoards[0].cards.length > 0 ? 1 : 0}
                />
              </div>

              <div className="practice-control-buttons">
                <button 
                  className="practice-control-btn practice-guide-btn" 
                  onClick={handleViewCombinations}
                >
                  족보보기
                </button>
                <button 
                  className="practice-control-btn practice-mode-btn" 
                  onClick={handleModeChange}
                >
                  {gameMode === 'easyMode' ? '초보모드' : '일반모드'}
                </button>
              </div>
            </div>

            {/* 우측 - SUBMIT 버튼 */}
            <div className="practice-submit-btn-box">
              <button 
                className={`practice-submit-btn ${isAnimating ? 'disabled' : ''}`}
                onClick={submitCards}
                disabled={isAnimating}
              >
                SUBMIT
              </button>
            </div>
          </div>
        </div>

        {/* 패 영역 */}
        <div className="practice-hand-area">
          <div className="practice-hand-container">
            {imagesLoaded && ['sun', 'moon', 'star', 'cloud'].map(suit => (
              <div key={suit} className="practice-suit-row">
                {allCards
                  .filter(card => card.suit === suit)
                  .sort((a, b) => a.value - b.value)
                  .map(card => renderCard(card, true))
                }
              </div>
            ))}
          </div>
        </div>

        {/* 홈 버튼 */}
        <button className="practice-back-btn" onClick={() => onScreenChange('lobby')}>
          LOBBY
        </button>

        {/* 족보 가이드 모달 */}
        <CombinationGuide 
          isOpen={showCombinationGuide}
          onClose={() => setShowCombinationGuide(false)}
          onShowGameGuide={() => setShowGameGuide(true)}
          gameMode={gameMode}
        />
        
        {/* 게임 가이드북 모달 */}
        <GameGuide 
          isOpen={showGameGuide}
          onClose={() => setShowGameGuide(false)}
        />
      </div>
    </div>
  );
};

export default PracticeScreen;
