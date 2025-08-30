import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CardDealAnimation.css';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';

interface CardDealAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
  playerCount: number;
  cardsPerPlayer: number;
  myPlayerIndex: number;
  myHand: Array<{
    id: number;
    value: number;
    color: string;
  }>;
  onPlayerCardReceived?: (playerIndex: number) => void;
  onMyCardDealt?: (cardIndex: number) => void;
  gameMode: 'easyMode' | 'normal';
}

interface Card {
  id: string;
  playerIndex: number;
  cardIndex: number;
  isDealt: boolean;
  isFlipped: boolean;
  isArrived: boolean; // 목적지에 도착했는지 여부
}

const CardDealAnimation: React.FC<CardDealAnimationProps> = ({
  isVisible,
  onComplete,
  playerCount,
  cardsPerPlayer,
  myPlayerIndex,
  myHand,
  onPlayerCardReceived,
  onMyCardDealt,
  gameMode
}) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [dealtCount, setDealtCount] = useState(0);
  const [isDealing, setIsDealing] = useState(false);
  const [showCenterDeck, setShowCenterDeck] = useState(true);

  // 카드 색상 매핑 (초보모드 ↔ 일반모드)
  const colorMapping = {
    'gold': 'sun',    // 금색 ↔ 태양 (빨강)
    'silver': 'moon', // 은색 ↔ 달 (초록)
    'bronze': 'star', // 동색 ↔ 별 (노랑)
    'black': 'cloud'  // 검정색 ↔ 구름 (파랑)
  };

  // 현재 모드에 맞는 카드 색상 반환
  const getDisplayColor = (originalColor: string, mode: 'easyMode' | 'normal') => {
    if (mode === 'easyMode') {
      return originalColor;
    } else {
      return colorMapping[originalColor as keyof typeof colorMapping] || originalColor;
    }
  };

  // 카드 색상에 따른 이미지 반환
  const getCardImage = (color: string) => {
    switch (color) {
      case 'sun':
        return sunImage;
      case 'moon':
        return moonImage;
      case 'star':
        return starImage;
      case 'cloud':
        return cloudImage;
      default:
        return null;
    }
  };

  // 카드 초기화 (라운드 로빈 분배용)
  useEffect(() => {
    if (isVisible && playerCount > 0 && cardsPerPlayer > 0) {
      console.log('CardDealAnimation 초기화:', {
        isVisible,
        playerCount,
        cardsPerPlayer,
        myPlayerIndex
      });
      
      const initialCards: Card[] = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
          initialCards.push({
            id: `${playerIndex}-${i}`,
            playerIndex,
            cardIndex: i,
            isDealt: false,
            isFlipped: false,
            isArrived: false
          });
        }
      }
      setCards(initialCards);
      setDealtCount(0);
      setIsDealing(false);
      setShowCenterDeck(true);
      
      console.log('초기화된 카드 수:', initialCards.length);
    }
  }, [isVisible, playerCount, cardsPerPlayer]);

  // 카드 분배 시작 (라운드 로빈)
  useEffect(() => {
    if (isVisible && cards.length > 0 && !isDealing) {
      console.log('카드 분배 시작:', {
        cardsLength: cards.length,
        isDealing,
        myPlayerIndex
      });
      setIsDealing(true);
      startDealing();
    }
    // eslint-disable-next-line
  }, [isVisible, cards.length, isDealing]);

  const startDealing = () => {
    let currentIndex = 0;
    const total = cards.length;

    const dealNextCard = () => {
      if (currentIndex >= total) {
        setTimeout(() => {
          onComplete();
        }, 500);
        return;
      }
      
      const card = cards[currentIndex];
      
      // 마지막 카드가 출발하는 즉시 중앙 카드더미 숨기기
      if (currentIndex === total - 1) {
        setShowCenterDeck(false);
      }
      
      // 카드 분배 시작
      setCards(prev => prev.map((c, idx) =>
        idx === currentIndex ? { ...c, isDealt: true } : c
      ));

      if (card.playerIndex === myPlayerIndex) {
        // 내 카드: 분배 완료 콜백
        if (onMyCardDealt) {
          onMyCardDealt(card.cardIndex);
        }
      } else {
        // 다른 유저 카드: 남은 패 개수 증가 콜백
        if (onPlayerCardReceived) {
          onPlayerCardReceived(card.playerIndex);
        }
      }
      
      setDealtCount(prev => prev + 1);
      currentIndex++;
      setTimeout(dealNextCard, 60);
    };
    dealNextCard();
  };

  // 중앙 카드더미 위치 계산
  const centerPosition = {
    x: window.innerWidth / 2 - ((3.5 * window.innerWidth) / 100) / 2, // 3.5vw/2
    y: window.innerHeight / 2 - ((5 * window.innerWidth) / 100) / 2 // 5vw/2
  };

  // 각 플레이어 위치 계산 (직선 이동)
  const getPlayerPosition = (playerIndex: number) => {
    if (playerIndex === myPlayerIndex) {
      // 내 위치는 getMyCardPosition에서 처리
      return getMyCardPosition(cards.filter(c => c.playerIndex === myPlayerIndex && c.isDealt).length);
    } else {
      // 나를 제외한 다른 플레이어들의 위치를 동적으로 계산
      const otherPlayers = Array.from({ length: playerCount }, (_, i) => i).filter(i => i !== myPlayerIndex);
      const playerIndexInOthers = otherPlayers.indexOf(playerIndex);
      
      // 디버깅용 로그
      console.log('CardDealAnimation Debug:', {
        playerCount,
        myPlayerIndex,
        playerIndex,
        otherPlayers,
        playerIndexInOthers
      });
      
      if (playerIndexInOthers === -1) {
        // 예상치 못한 플레이어 인덱스인 경우 기본 위치 반환
        return { x: (22 * window.innerWidth) / 100, y: (15 * window.innerHeight) / 100 };
      }
      
      // 플레이어 수에 따라 위치 조정
      let positions: Array<{ x: number; y: number }> = [];
      
      if (playerCount === 3) {
        // 3명: 2갈래 (나 제외 2명) - 맨 위 2줄 사용
        positions = [
          { x: (22 * window.innerWidth) / 100, y: (10 * window.innerHeight) / 100 }, // 첫 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (20 * window.innerHeight) / 100 }, // 두 번째 플레이어
        ];
      } else if (playerCount === 4) {
        // 4명: 4갈래 (나 제외 3명 + 나 포함 4명 모두 표시)
        positions = [
          { x: (22 * window.innerWidth) / 100, y: (10 * window.innerHeight) / 100 }, // 첫 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (20 * window.innerHeight) / 100 }, // 두 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (30 * window.innerHeight) / 100 }, // 세 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (40 * window.innerHeight) / 100 }, // 네 번째 플레이어 (나)
        ];
      } else if (playerCount === 5) {
        // 5명: 4갈래 (나 제외 4명)
        positions = [
          { x: (22 * window.innerWidth) / 100, y: (8 * window.innerHeight) / 100 },  // 첫 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (18 * window.innerHeight) / 100 }, // 두 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (28 * window.innerHeight) / 100 }, // 세 번째 플레이어
          { x: (22 * window.innerWidth) / 100, y: (38 * window.innerHeight) / 100 }, // 네 번째 플레이어
        ];
      }
      
      return positions[playerIndexInOthers] || { x: (22 * window.innerWidth) / 100, y: (15 * window.innerHeight) / 100 };
    }
  };

  // 내 카드 위치 계산 (손패 영역)
  const getMyCardPosition = (cardIndex: number) => {
    // 실제 게임 화면의 .my-hand 영역 위치 계산
    const myHandElement = document.querySelector('.my-hand');
    
    if (myHandElement) {
      const handRect = myHandElement.getBoundingClientRect();
      
      // .my-hand 내부에서의 카드 위치 계산 (동적 크기)
      const cardWidth = (3.5 * window.innerWidth) / 100; // 3.5vw를 px로 변환
      const cardGap = 4; // gap between cards (4px)
      const cardSpacing = cardWidth + cardGap;
      
      // .my-hand의 시작 위치에서 카드 인덱스에 따른 위치 계산 (왼쪽 위로 조정)
      const cardX = handRect.left + (cardIndex * cardSpacing) - (0 * window.innerWidth) / 100; // 3vw 왼쪽으로
      const cardY = handRect.top - (4 * window.innerHeight) / 100; // 4vh 위쪽으로 이동
      
      return {
        x: cardX,
        y: cardY
      };
    }
    
    // 폴백: 기존 계산 방식 (동적 크기 적용) - 왼쪽 위로 이동
    const cardWidth = (3.5 * window.innerWidth) / 100;
    const cardGap = 4;
    const cardSpacing = cardWidth + cardGap;
    const baseX = (10 * window.innerWidth) / 100 - (myHand.length * cardSpacing) / 2; // 10vw 왼쪽으로 이동
    return {
      x: baseX + cardIndex * cardSpacing,
      y: (10 * window.innerHeight) / 100 // 10vh 위쪽으로 이동
    };
  };

      if (!isVisible || playerCount === 0 || cardsPerPlayer === 0) {
    console.log('CardDealAnimation 숨김');
    return null;
  }
    
    console.log('CardDealAnimation 렌더링:', {
      cardsLength: cards.length,
      isDealing,
      myPlayerIndex,
      playerCount
    });

  return (
    <div className="card-deal-animation">
      <AnimatePresence>
        {cards.map((card, idx) => {
          const isMyCard = card.playerIndex === myPlayerIndex;
          const targetPosition = isMyCard
            ? getMyCardPosition(card.cardIndex)
            : getPlayerPosition(card.playerIndex);
          return (
            <motion.div
              key={card.id}
              className={`dealing-card ${isMyCard ? 'my-card' : 'other-card'}`}
              initial={{
                x: centerPosition.x,
                y: centerPosition.y,
                rotateY: 0,
                scale: 1
              }}
              animate={{
                x: card.isDealt ? targetPosition.x : centerPosition.x,
                y: card.isDealt ? targetPosition.y : centerPosition.y,
                rotateY: 180, // 내 카드도 항상 뒷면으로 유지
                scale: 1,
                opacity: card.isDealt ? (isMyCard ? (card.isArrived ? 0 : 0.3) : (card.isArrived ? 0 : 1)) : (showCenterDeck ? 1 : 0)
              }}
              transition={{
                duration: 0.25,
                ease: 'easeOut',
                opacity: { duration: 0 } // opacity는 즉시 변경 (애니메이션 없음)
              }}
              onAnimationComplete={() => {
                if (card.isDealt && !card.isArrived) {
                  if (isMyCard) {
                    // 내 카드가 목적지에 도착하면 isArrived를 true로 설정하여 완전히 사라지게 함
                    setCards(prev => prev.map((c) =>
                      c.id === card.id ? { ...c, isArrived: true } : c
                    ));
                    
                    // hand-tile 활성화 콜백
                    if (onMyCardDealt) {
                      setTimeout(() => {
                        onMyCardDealt(card.cardIndex);
                      }, 200); // 200ms 지연
                    }
                  } else {
                    // 다른 플레이어 카드만 isArrived를 true로 설정하여 사라지게 함
                    setCards(prev => prev.map((c) =>
                      c.id === card.id ? { ...c, isArrived: true } : c
                    ));
                  }
                }
              }}
              style={{
                position: 'absolute',
                zIndex: 1000
              }}
            >
              {/* 카드 뒷면 */}
              <div className="card-back" />
              {/* 내 카드 앞면 표시 로직 주석처리 */}
              {/* {isMyCard && card.isFlipped && (
                <div 
                  className={`card-front ${(() => {
                    const cardData = myHand[card.cardIndex];
                    if (!cardData) return '';
                    const displayColor = getDisplayColor(cardData.color, gameMode);
                    return displayColor;
                  })()}`}
                >
                  <div className="card-content">
                    {(() => {
                      const cardData = myHand[card.cardIndex];
                      if (!cardData) return null;
                      const displayColor = getDisplayColor(cardData.color, gameMode);
                      const cardImage = getCardImage(displayColor);
                      return (
                        <>
                          {cardImage && (
                            <img src={cardImage} alt={displayColor} className="card-image" />
                          )}
                          <span className="card-value">{cardData.value}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )} */}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default CardDealAnimation; 