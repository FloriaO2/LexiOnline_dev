import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import './GameScreen.css';
import coinImage from '../../coin.png';
import cardImage from '../../card.png';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';
import CombinationGuide from './CombinationGuide';
import GameGuide from './GameGuide';
import CombinationWheel from './CombinationWheel';
import ColyseusService from '../../services/ColyseusService';
import Toast from '../Toast/Toast';

interface GameScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult', result?: any) => void;
  playerCount: number;
}

interface Player {
  id: string;
  nickname: string;
  score: number;
  remainingTiles: number;
  isCurrentPlayer: boolean;
  sessionId: string;
  hasPassed: boolean;
}

interface GameState {
  players: Map<string, Player>;
  playerOrder: string[];
  currentPlayerIndex: number;
  lastCards: number[];
  lastType: number;
  lastMadeType: number;
  lastHighestValue: number;
  round: number;
  totalRounds: number;
  easyMode: boolean;
  maxNumber: number;
}

// 애니메이션된 남은 패 개수 컴포넌트
const AnimatedRemainingTiles: React.FC<{ count: number }> = ({ count }) => {
  const countMotion = useMotionValue(0);
  const displayCount = useTransform(countMotion, (value: number) => 
    String(Math.round(value)).padStart(2, '0')
  );

  useEffect(() => {
    countMotion.set(count);
  }, [count, countMotion]);

  return (
    <motion.span>
      {displayCount}
    </motion.span>
  );
};

const GameScreen: React.FC<GameScreenProps> = ({ onScreenChange, playerCount }) => {
  const [currentCombination, setCurrentCombination] = useState<string>('');
  const [gameMode, setGameMode] = useState<'easyMode' | 'normal'>('easyMode');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [boardCards, setBoardCards] = useState<Array<{
    id: number;
    value: number;
    color: string;
    isNew: boolean;
    row: number;
    col: number;
    playerId?: string;
    turnId?: number; // 같은 턴에 등록된 패인지 구분
    submitTime?: number; // 제출 시간 (최근 패 표시용)
  }>>([]);
  const [sortedHand, setSortedHand] = useState<Array<{
    id: number;
    value: number;
    color: string;
    originalNumber: number;
  }>>([]);

  const [boardSize, setBoardSize] = useState({ rows: 4, cols: 15 });
  const [showCombinationGuide, setShowCombinationGuide] = useState(false);
  const [showGameGuide, setShowGameGuide] = useState(false);
  
  const [isGameStarted, setIsGameStarted] = useState(false);
  
  // 드래그 앤 드롭 관련 상태
  const [draggedCard, setDraggedCard] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [cardOffsets, setCardOffsets] = useState<{ [key: number]: number }>({});
  const handRef = useRef<HTMLDivElement>(null);
  const lastDropPositionRef = useRef<number>(-1);
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 대기 중인 패 저장 (공간 부족으로 제출하지 못한 패)
  const [pendingCards, setPendingCards] = useState<Array<{
    id: number;
    value: number;
    color: string;
    submitTime?: number; // 제출 시간 (최근 패 표시용)
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 다음 라운드 대기 상태
  const [waitingForNextRound, setWaitingForNextRound] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [showBoardMask, setShowBoardMask] = useState(false);
  
  // Toast 상태
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });
  
  // 모드 변경 중 상태 (정렬 순서 보호용) - useRef 사용하여 즉시 반영
  const isModeChangingRef = useRef(false);
  // 정렬이 완료되었는지 추적 (onStateChange에서 sortedHand 업데이트 방지용)
  const hasBeenSortedRef = useRef(false);
  
  // 게임 상태 (lastType, lastMadeType 등)
  const [gameState, setGameState] = useState<{
    lastType: number;
    lastMadeType: number;
    lastHighestValue: number;
    currentTurnId: number; // 현재 턴 ID
    maxNumber: number; // 백엔드에서 받은 maxNumber
    round: number; // 현재 라운드
    totalRounds: number; // 전체 라운드 수
  }>({
    lastType: 0,
    lastMadeType: 0,
    lastHighestValue: -1,
    currentTurnId: 0,
    maxNumber: 13, // 최초 진입시만 임시, 이후엔 항상 백엔드 값으로 갱신
    round: 1,
    totalRounds: 5
  });
  
  // 플레이어 정보 (백엔드에서 동적으로 가져옴)
  const [players, setPlayers] = useState<Player[]>([]);
  const [mySessionId, setMySessionId] = useState<string>('');
  const [myHand, setMyHand] = useState<Array<{
    id: number;
    value: number;
    color: string;
    originalNumber: number;
  }>>([]);

  // sessionStorage에서 정렬 순서를 불러와 적용하는 함수
  const applySavedSortOrder = (handCards: Array<{ id: number; value: number; color: string; originalNumber: number; }>) => {
    const room = ColyseusService.getRoom();
    if (!room || !mySessionId) return handCards;

    const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
    const savedOrderJSON = sessionStorage.getItem(sortOrderKey);

    if (savedOrderJSON) {
      try {
        const savedOrder: number[] = JSON.parse(savedOrderJSON);
        const handCardMap = new Map(handCards.map(card => [card.originalNumber, card]));
        
        const sorted = savedOrder
          .map(originalNumber => handCardMap.get(originalNumber))
          .filter((card): card is { id: number; value: number; color: string; originalNumber: number; } => card !== undefined);

        const remainingCards = handCards.filter(card => !savedOrder.includes(card.originalNumber));
        
        return [...sorted, ...remainingCards];
      } catch (e) {
        console.error("Failed to parse sort order from sessionStorage", e);
        sessionStorage.removeItem(sortOrderKey); // Remove corrupted data
        return handCards;
      }
    }

    return handCards; // No saved order, return original
  };

  // 손패를 설정하고 저장된 순서에 따라 정렬하는 함수
  const setAndSortHand = (handCards: Array<{ id: number; value: number; color: string; originalNumber: number; }>) => {
    const sorted = applySavedSortOrder(handCards);
    setMyHand(sorted);
    setSortedHand(sorted);
    console.log("set and sort hand");
  };

  // Colyseus 연결 초기화
  useEffect(() => {
    const room = ColyseusService.getRoom();
    if (!room) {
      console.error('방에 연결되지 않았습니다.');
      onScreenChange('lobby');
      return;
    }

    // 내 세션 ID 저장
    setMySessionId(room.sessionId);

    // 게임 화면 진입 시 즉시 플레이어 정보 요청
    room.send("requestPlayerInfo");

    // 게임 화면에 진입했을 때 다음 라운드 대기 상태인지 확인 (round가 2 이상일 때만)
    if (room.state.round > 1 && !room.state.players.get(room.sessionId)?.readyForNextRound) {
      setWaitingForNextRound(true);
      // 현재 준비 상태 요청
      room.send('requestReadyStatus');
    }

    // 게임 상태 구독
    room.onStateChange((state) => {
      console.log('게임 상태 변경:', state);

      // 개인의 easyMode 설정에 따라 gameMode를 설정
      const myPlayer = state.players.get(room.sessionId);
      if (myPlayer) {
        setGameMode(myPlayer.easyMode ? 'easyMode' : 'normal');
      }
      
      // 플레이어 정보 업데이트
      if (state.players && state.playerOrder) {
        const playerList: Player[] = [];
        
        // playerOrder 순서대로 플레이어 정보 구성
        state.playerOrder.forEach((sessionId: string, index: number) => {
          const player = state.players.get(sessionId);
          if (player) {
            playerList.push({
              id: index.toString(),
              nickname: player.nickname || '익명',
              score: player.score || 0,
              remainingTiles: player.hand ? player.hand.length : 0,
              isCurrentPlayer: sessionId === room.sessionId,
              sessionId: sessionId,
              hasPassed: player.hasPassed || false
            });
          }
        });
        
        setPlayers(playerList);
        
        // 백엔드 상태로부터 모든 플레이어의 남은 카드 수 동기화
        syncPlayerRemainingCards();
        
        // 게임 상태 업데이트 (lastType, lastMadeType, lastHighestValue, maxNumber)
        setGameState({
          lastType: state.lastType || 0,
          lastMadeType: state.lastMadeType || 0,
          lastHighestValue: state.lastHighestValue || -1,
          currentTurnId: gameState.currentTurnId,
          maxNumber: state.maxNumber || 13,
          round: state.round || 1,
          totalRounds: state.totalRounds || 5
        });
        
        // 게임이 이미 시작되었고 손패가 있다면 손패만 업데이트 (애니메이션 없이)
        const myPlayer = state.players.get(room.sessionId);
        if (myPlayer && myPlayer.hand && myPlayer.hand.length > 0) {
          const maxNumber = state.maxNumber || 13;
          const handCards = myPlayer.hand.map((cardNumber: number, index: number) => {
            const color = getCardColorFromNumber(cardNumber, maxNumber);
            const value = getCardValueFromNumber(cardNumber, maxNumber);
            return {
              id: index,
              value: value,
              color: color,
              originalNumber: cardNumber
            };
          });
          
          setAndSortHand(handCards);
        }
      }
    });

    // 게임 메시지 수신
    room.onMessage('playerInfoResponse', (message) => {
      console.log('플레이어 정보 응답:', message);
      
      // 플레이어 정보 설정
      const playerList: Player[] = message.players.map((p: any) => ({
        id: p.sessionId,
        nickname: p.nickname,
        score: p.score,
        remainingTiles: p.remainingTiles,
        isCurrentPlayer: p.isCurrentPlayer,
        sessionId: p.sessionId,
        hasPassed: p.hasPassed || false
      }));
      
      setPlayers(playerList);
      
      // 게임이 이미 시작되었고 손패가 있다면 손패만 업데이트 (애니메이션 없이)
      if (message.isGameStarted && message.myHand && message.myHand.length > 0) {
        const maxNumber = message.maxNumber || 13;
        const handCards = message.myHand.map((cardNumber: number, index: number) => {
          const color = getCardColorFromNumber(cardNumber, maxNumber);
          const value = getCardValueFromNumber(cardNumber, maxNumber);
          return {
            id: index,
            value: value,
            color: color,
            originalNumber: cardNumber
          };
        });
        
        setAndSortHand(handCards);
      }
    });

    room.onMessage('gameEnded', (message) => {
      console.log('게임 종료:', message);
      onScreenChange('finalResult', message.finalScores);
    });

    room.onMessage('finalResult', (message) => {
      console.log('최종 결과 수신:', message);
      onScreenChange('finalResult', message.finalScores);
    });

    room.onMessage('roundEnded', (message) => {
      console.log('라운드 종료:', message);
      setBoardCards([]);
      setBoardSize({ rows: 4, cols: 15 });
      setPendingCards([]);
      onScreenChange('result', message);
    });

    // 다음 라운드 준비 완료 신호 수신
    room.onMessage('readyForNextRound', (message) => {
      console.log('플레이어가 다음 라운드 준비 완료:', message);
      const newReadyPlayers = new Set(readyPlayers);
      newReadyPlayers.add(message.playerId);
      setReadyPlayers(newReadyPlayers);
    });

    // 모든 플레이어가 다음 라운드 준비 완료
    room.onMessage('allPlayersReadyForNextRound', () => {
      console.log('모든 플레이어가 다음 라운드 준비 완료');
      setWaitingForNextRound(false);
      setReadyPlayers(new Set());
    });

    // 준비 상태 응답
    room.onMessage('readyStatusResponse', (message) => {
      console.log('준비 상태 응답:', message);
      const newReadyPlayers = new Set(message.readyPlayers as string[]);
      setReadyPlayers(newReadyPlayers);
    });

    // 다음 라운드 대기 상태 시작
    room.onMessage('waitingForNextRound', () => {
      console.log('다음 라운드 대기 상태 시작');
      setWaitingForNextRound(true);
      setReadyPlayers(new Set());
      room.send('requestReadyStatus');
    });

    room.onMessage('roundStart', (message) => {
      console.log('라운드 시작:', message);
      console.log('현재 라운드:', room.state.round);
      console.log('message.hand 존재 여부:', !!message.hand);
      console.log('message.hand 길이:', message.hand?.length);
      
      // 새 라운드 시작 시 보드 상태 초기화 (15X4로 리셋)
      setBoardCards([]);
      setBoardSize({ rows: 4, cols: 15 });
      setPendingCards([]);
      console.log('새 라운드 시작 - 보드 크기 리셋: 4x15');
      
      if (message.hand) {
        const maxNumber = message.maxNumber || 13;
        const handCards = message.hand.map((cardNumber: number, index: number) => {
          const color = getCardColorFromNumber(cardNumber, maxNumber);
          const value = getCardValueFromNumber(cardNumber, maxNumber);
          return {
            id: index,
            value: value,
            color: color,
            originalNumber: cardNumber
          };
        });
        
        setAndSortHand(handCards);
      }

      if (message.allPlayers) {
        const updatedPlayers: Player[] = message.allPlayers.map((p: any) => ({
          id: p.sessionId,
          nickname: p.nickname,
          score: p.score,
          remainingTiles: p.remainingTiles,
          isCurrentPlayer: p.isCurrentPlayer,
          sessionId: p.sessionId
        }));
        setPlayers(updatedPlayers);
      }
    });

    room.onMessage('submitted', (message) => {
      console.log('카드 제출:', message);
      
      const submittedMaxNumber = room?.state?.maxNumber ?? gameState.maxNumber;
      
      // 서버로부터 받은 보드 크기 정보 동기화
      if (message.boardSize) {
        console.log(`[DEBUG] 서버에서 받은 보드 크기: ${message.boardSize.rows}x${message.boardSize.cols}`);
        setBoardSize({ rows: message.boardSize.rows, cols: message.boardSize.cols });
      }
      
      if (message.position) {
        const submittedCards = message.cards.map((cardNumber: number, index: number) => {
          const color = getCardColorFromNumber(cardNumber, submittedMaxNumber);
          const value = getCardValueFromNumber(cardNumber, submittedMaxNumber);
          return {
            id: Date.now() + index + Math.random(),
            value: value,
            color: color,
            playerId: message.playerId,
            row: message.position.row,
            col: message.position.col + index,
            isNew: true,
            turnId: message.turnId || gameState.currentTurnId,
            submitTime: Date.now()
          };
        });
        
        setBoardCards(prev => [...prev, ...submittedCards]);
      } else {
        console.error('[ERROR] 백엔드에서 position 정보가 전송되지 않았습니다.');
        showToast('게임 보드 동기화 오류가 발생했습니다.', 'error');
      }
      
      if (message.playerId === room.sessionId) {
        const myPlayer = room.state.players.get(room.sessionId);
        if (myPlayer && myPlayer.hand) {
          const maxNumber = room.state.maxNumber || 13;
          const handCards = myPlayer.hand.map((cardNumber: number, index: number) => {
            const color = getCardColorFromNumber(cardNumber, maxNumber);
            const value = getCardValueFromNumber(cardNumber, maxNumber);
            return {
              id: index,
              value: value,
              color: color,
              originalNumber: cardNumber
            };
          });
          
          setAndSortHand(handCards);
        }
      }
      
      syncPlayerRemainingCards();
      
      const currentRoom = ColyseusService.getRoom();
      if (currentRoom) {
        setGameState(prev => ({
          ...prev,
          lastType: currentRoom.state.lastType || 0,
          lastMadeType: currentRoom.state.lastMadeType || 0,
          lastHighestValue: currentRoom.state.lastHighestValue || -1,
          maxNumber: currentRoom.state.maxNumber || 13,
          round: currentRoom.state.round || 1,
          totalRounds: currentRoom.state.totalRounds || 5
        }));
      }
      
      setIsSubmitting(false);
    });

    room.onMessage('pass', (message) => {
      console.log('패스:', message);
      syncPlayerRemainingCards();
    });

    room.onMessage('playerPassed', (message) => {
      console.log('플레이어 패스:', message);
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.sessionId === message.playerId 
            ? { ...player, hasPassed: message.hasPassed }
            : player
        )
      );
    });

    room.onMessage('passReset', (message) => {
      console.log('패스 리셋:', message);
      setPlayers(prevPlayers => 
        prevPlayers.map(player => ({ ...player, hasPassed: false }))
      );
    });

    room.onMessage('cycleEnded', (message) => {
      console.log('사이클 종료:', message);
      setBoardCards(prev => 
        prev.map(card => card.isNew ? { ...card, isNew: false } : card)
      );
      
      if (gameMode === 'normal') {
        setShowBoardMask(true);
        setTimeout(() => {
          setShowBoardMask(false);
        }, 1500);
      }

      setGameState(prev => ({
        ...prev,
        lastType: 0,
        lastMadeType: 0,
        lastHighestValue: -1,
        currentTurnId: prev.currentTurnId + 1,
      }));
    });

    room.onMessage('turnChanged', (message) => {
      console.log('턴 변경:', message);
      setGameState(prev => ({
        ...prev,
        currentTurnId: prev.currentTurnId + 1
      }));
      
      if (message.allPlayers) {
        const updatedPlayers: Player[] = message.allPlayers.map((p: any) => ({
          id: p.sessionId,
          nickname: p.nickname,
          score: p.score,
          remainingTiles: p.remainingTiles,
          isCurrentPlayer: p.isCurrentPlayer,
          sessionId: p.sessionId
        }));
        setPlayers(updatedPlayers);
        
        const currentPlayer = updatedPlayers.find(p => p.isCurrentPlayer);
        const isMyTurn = currentPlayer && currentPlayer.sessionId === room.sessionId;
      }
    });

    room.onMessage('submitRejected', (message) => {
      console.log('카드 제출 거부:', message);
      showToast('카드 제출이 거부되었습니다: ' + message.reason, 'error');
      setIsSubmitting(false);
    });

    room.onMessage('noCard', (message) => {
      console.log('카드 없음 오류:', message);
      showToast('보유하지 않은 카드를 제출하려고 했습니다: ' + message.reason, 'error');
      setIsSubmitting(false);
    });

    room.onMessage('passRejected', (message) => {
      console.log('패스 거부:', message);
      showToast('패스가 거부되었습니다: ' + message.reason, 'error');
    });

    room.onMessage('invalidPlayer', (message) => {
      console.log('플레이어 정보 오류:', message);
      showToast('플레이어 정보가 유효하지 않습니다: ' + message.reason, 'error');
    });

    room.onMessage('gameStarted', (message) => {
      console.log('게임 시작:', message);
      setIsGameStarted(true);
      const myPlayer = room.state.players.get(room.sessionId);
      if (myPlayer) {
        setGameMode(myPlayer.easyMode ? 'easyMode' : 'normal');
      }
      
    });

    return () => {
      room.onLeave(() => {
        console.log('게임에서 나갔습니다.');
      });
    };
  }, [onScreenChange, mySessionId]);

  // 카드 색상 매핑 (초보모드 ↔ 일반모드)
  const colorMapping = {
    'gold': 'sun',    // 금색 ↔ 태양 (빨강)
    'silver': 'moon', // 은색 ↔ 달 (초록)
    'bronze': 'star', // 동색 ↔ 별 (노랑)
    'black': 'cloud'  // 검정색 ↔ 구름 (파랑)
  };

  // 모드에 따른 카드 색상 결정 (게임 시작 시 한 번만)
  const getCardColor = () => {
    return ['black', 'bronze', 'silver', 'gold'][Math.floor(Math.random() * 4)];
  };

  // 현재 모드에 맞는 카드 색상 반환 (메모이제이션)
  const getDisplayColor = useMemo(() => {
    return (originalColor: string, mode: 'easyMode' | 'normal') => {
      if (mode === 'easyMode') {
        return originalColor;
      } else {
        return colorMapping[originalColor as keyof typeof colorMapping] || originalColor;
      }
    };
  }, [gameMode]); // gameMode가 변경될 때만 함수 재생성

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

  // 현재 플레이어가 자신인지 확인하는 함수
  const room = ColyseusService.getRoom();
  
  const isMyTurn = useMemo(() => {
    if (!room) return false;
    
    if (room.state && room.state.playerOrder && room.state.nowPlayerIndex !== undefined) {
      const currentPlayerSessionId = room.state.playerOrder[room.state.nowPlayerIndex];
      return currentPlayerSessionId === room.sessionId;
    }
    
    const currentPlayer = players.find(p => p.isCurrentPlayer);
    return currentPlayer && currentPlayer.sessionId === room.sessionId;
  }, [room?.state?.playerOrder, room?.state?.nowPlayerIndex, room?.sessionId, players]);


  // 카드 번호를 색상으로 변환 (올바른 매핑)
  const getCardColorFromNumber = (cardNumber: number, maxNumber: number): string => {
    const safeMaxNumber = maxNumber && maxNumber > 0 ? maxNumber : 13;
    const colorIndex = Math.floor(cardNumber / safeMaxNumber);
    const colors = ['black', 'bronze', 'silver', 'gold'];
    return colors[colorIndex] || 'black';
  };

  // 카드 번호를 값으로 변환 (실제 카드 값)
  const getCardValueFromNumber = (cardNumber: number, maxNumber: number): number => {
    const safeMaxNumber = maxNumber && maxNumber > 0 ? maxNumber : 13;
    return (cardNumber % safeMaxNumber) + 1;
  };

  // 카드의 실제 순서 값을 계산하는 함수 (백엔드의 getValue와 일치)
  const getCardOrderValue = (cardNumber: number): number => {
    const room = ColyseusService.getRoom();
    const maxNumber = room?.state?.maxNumber || 13;
    const { type, number } = parseCard(cardNumber, maxNumber);
    return getValue(number, type, maxNumber);
  };



  // 백엔드의 parseCard 함수와 동일한 로직
  const parseCard = (card: number, maxNumber: number) => {
    const type = Math.floor(card / maxNumber);
    const number = (card + maxNumber - 2) % maxNumber;
    return { type, number };
  };

  // 백엔드의 getOrderIndex 함수와 동일한 로직
  const getOrderIndex = (n: number, maxNumber: number): number => {
    if (n === 0) return maxNumber - 2;
    if (n === 1) return maxNumber - 1;
    return n - 2;
  };

  // 백엔드의 getValue 함수와 동일한 로직
  const getValue = (number: number, type: number, maxNumber: number): number => {
    return getOrderIndex(number, maxNumber) * maxNumber + type;
  };

  // 백엔드의 evaluateSimpleCombo에서 사용하는 잘못된 계산 방식 (디버깅용)
  const getWrongValue = (number: number, type: number, maxNumber: number): number => {
    return number * maxNumber + type;
  };

  // 백엔드의 evaluateSimpleCombo에서 사용하는 계산 방식 (실제 사용됨)
  const getSimpleComboValue = (cardNumber: number): number => {
    const room = ColyseusService.getRoom();
    const maxNumber = room?.state?.maxNumber || 13;
    const { type, number } = parseCard(cardNumber, maxNumber);
    return number * maxNumber + type;
  };

  // lastType을 한국어로 변환하는 함수
  const getLastTypeText = (lastType: number): string => {
    switch (lastType) {
      case 0:
        return '없음';
      case 1:
        return '싱글';
      case 2:
        return '원페어';
      case 3:
        return '트리플';
      case 4:
        return '포카드';
      case 5:
        return '메이드';
      default:
        return '알 수 없음';
    }
  };

  // lastMadeType을 한국어로 변환하는 함수
  const getLastMadeTypeText = (lastMadeType: number): string => {
    switch (lastMadeType) {
      case 0:
        return '없음';
      case 1:
        return '스트레이트';
      case 2:
        return '플러시';
      case 3:
        return '풀하우스';
      case 4:
        return '포카드';
      case 5:
        return '스트레이트플러시';
      default:
        return '알 수 없음';
    }
  };

  // 현재 조합 텍스트를 생성하는 함수
  const getCurrentCombinationText = (): string => {
    if (gameState.lastType === 0) {
      return '미등록';
    }
    
    if (gameState.lastType === 5) {
      return getLastMadeTypeText(gameState.lastMadeType);
    } else {
      return getLastTypeText(gameState.lastType);
    }
  };

  // 현재 게임 상태의 디버깅 정보를 출력하는 함수
  const debugGameState = (): string => {
    const room = ColyseusService.getRoom();
    const maxNumber = room?.state?.maxNumber || 13;
    
    return `게임상태: lastType=${gameState.lastType}, lastMadeType=${gameState.lastMadeType}, lastHighestValue=${gameState.lastHighestValue}, maxNumber=${maxNumber}`;
  };

  // --- START: 백엔드 로직과 동기화된 카드 평가 함수들 ---

  const MADE_NONE = 0;
  const MADE_STRAIGHT = 1;
  const MADE_FLUSH = 2;
  const MADE_FULLHOUSE = 3;
  const MADE_FOURCARDS = 4;
  const MADE_STRAIGHTFLUSH = 5;

  interface MadeEvalResult {
    type: number;
    value: number;
    valid: boolean;
  }

  // 백엔드의 isStraightWithException 함수와 동일한 로직
  const isStraightWithException = (numbers: number[], maxNumber: number): boolean => {
    const remappedNumbers = numbers.map(n => (n + 2) % maxNumber).sort((a, b) => a - b);

    let isConsecutive = true;
    for (let i = 0; i < remappedNumbers.length - 1; i++) {
      if (remappedNumbers[i+1] - remappedNumbers[i] !== 1) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) return true;

    const mountainStraight = [0, maxNumber - 4, maxNumber - 3, maxNumber - 2, maxNumber - 1].sort((a,b) => a-b);
    const isMountain = remappedNumbers.length === mountainStraight.length && remappedNumbers.every((val, index) => val === mountainStraight[index]);
    if (isMountain) return true;

    return false;
  }

  // 백엔드의 evaluateSimpleCombo 함수와 동일한 로직
  const evaluateSimpleCombo = (cards: number[], maxNumber: number): MadeEvalResult => {
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

  // 백엔드의 evaluateMade 함수와 동일한 로직
  const evaluateMade = (cards: number[], maxNumber: number): MadeEvalResult => {
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
    for (const count of Array.from(numCount.values())) {
      if (count === 4) four = true;
      else if (count === 3) three = true;
      else if (count === 2) two = true;
    }

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
      let fourNumber = Array.from(numCount.entries()).find(([n, c]) => c === 4)![0];
      let maxType = -1;
      for (let i = 0; i < numbers.length; i++) if (numbers[i] === fourNumber && types[i] > maxType) maxType = types[i];
      return { type: MADE_FOURCARDS, value: getValue(fourNumber, maxType, maxNumber), valid: true };
    }
    if (three && two) {
      let threeNumber = Array.from(numCount.entries()).find(([n, c]) => c === 3)![0];
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

  // --- END: 백엔드 로직과 동기화된 카드 평가 함수들 ---

  // 카드 제출 가능 여부를 확인하는 함수 (백엔드 로직 기반으로 재작성)
  const canSubmitCards = (cardNumbers: number[]): { canSubmit: boolean; reason: string } => {
    if (cardNumbers.length === 0) {
      return { canSubmit: false, reason: "카드를 선택해주세요." };
    }

    const room = ColyseusService.getRoom();
    if (!room || !room.state) {
        return { canSubmit: false, reason: "게임 서버에 연결되지 않았습니다." };
    }
    const maxNumber = room.state.maxNumber || 13;
    const { lastType, lastMadeType, lastHighestValue } = room.state;

    // 현재 제출한 카드 평가
    let evaluationResult: { type: number; value: number; valid: boolean; madeType?: number };

    if (cardNumbers.length >= 1 && cardNumbers.length <= 3) {
        const simpleResult = evaluateSimpleCombo(cardNumbers, maxNumber);
        evaluationResult = { ...simpleResult, madeType: MADE_NONE };
    } else if (cardNumbers.length === 5) {
        const madeResult = evaluateMade(cardNumbers, maxNumber);
        evaluationResult = { type: 5, value: madeResult.value, valid: madeResult.valid, madeType: madeResult.type };
    } else {
        return { canSubmit: false, reason: `잘못된 카드 개수입니다.` };
    }

    if (!evaluationResult.valid) {
        return { canSubmit: false, reason: "유효한 조합이 아닙니다." };
    }

    // 사이클의 첫 턴
    if (lastType === 0) {
        return { canSubmit: true, reason: "첫 턴 제출 가능" };
    }

    const currentType = evaluationResult.type;
    const currentValue = evaluationResult.value;
    const currentMadeType = evaluationResult.madeType || MADE_NONE;

    // 경우 1: 현재 제출이 '메이드' (5장)
    if (currentType === 5) {
        if (lastType === 5) { // 이전에도 '메이드'였을 경우
            if (currentMadeType > lastMadeType) {
                return { canSubmit: true, reason: "더 높은 족보" };
            }
            if (currentMadeType === lastMadeType && currentValue > lastHighestValue) {
                return { canSubmit: true, reason: "같은 족보, 더 높은 값" };
            }
            return { canSubmit: false, reason: `더 낮은 족보 또는 값입니다.` };
        }
        // 이전이 '심플 콤보'였을 경우, '메이드'가 항상 이김
        return { canSubmit: true, reason: "메이드가 이전 조합보다 높음" };
    }

    // 경우 2: 현재 제출이 '심플 콤보' (1~3장)
    if (currentType >= 1 && currentType <= 3) {
        if (lastType === 5) { // 이전이 '메이드'였을 경우
            return { canSubmit: false, reason: "더 높은 조합의 패만 낼 수 있습니다." };
        }
        if (currentType !== lastType) {
            return { canSubmit: false, reason: `이전과 같은 ${lastType}장의 카드를 내야 합니다.` };
        }
        if (currentValue > lastHighestValue) {
            return { canSubmit: true, reason: "더 높은 값" };
        }
        return { canSubmit: false, reason: `이전보다 높은 값을 내야 합니다.` };
    }

    return { canSubmit: false, reason: "알 수 없는 오류가 발생했습니다." };
  };

  // 디버깅용: 카드 정보 출력 함수
  const debugCardInfo = (cardNumber: number): string => {
    const room = ColyseusService.getRoom();
    const maxNumber = room?.state?.maxNumber || 13;
    const { type, number } = parseCard(cardNumber, maxNumber);
    const orderValue = getCardOrderValue(cardNumber);
    const color = getCardColorFromNumber(cardNumber, maxNumber);
    const value = getCardValueFromNumber(cardNumber, maxNumber);
    const orderIndex = getOrderIndex(number, maxNumber);
    
    // 백엔드의 evaluateSimpleCombo에서 사용하는 계산 방식
    const simpleComboValue = getSimpleComboValue(cardNumber);
    
    return `카드${cardNumber}: 색상=${color}, 숫자=${value}, type=${type}, number=${number}, orderIndex=${orderIndex}, 올바른순서값=${orderValue}, 실제순서값=${simpleComboValue}`;
  };

  // Toast 표시 함수
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    });
  };

  // Toast 닫기 함수
  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  // 백엔드 상태로부터 모든 플레이어의 남은 카드 수 동기화
  const syncPlayerRemainingCards = () => {
    const room = ColyseusService.getRoom();
    if (!room) return;
    
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        const backendPlayer = room.state.players.get(player.sessionId);
        return {
          ...player,
          remainingTiles: backendPlayer && backendPlayer.hand ? backendPlayer.hand.length : 0
        };
      })
    );
  };

  // 정렬된 손패 초기화
  useEffect(() => {
    setSortedHand([...myHand]);
  }, [myHand]);






  // 대기 중인 패들을 보드에 배치하는 함수
  const submitPendingCards = () => {
    if (pendingCards.length === 0) return;
    
    console.log('submitPendingCards 호출됨, 현재 보드 크기:', boardSize);
    
    // 대기 중인 패들을 보드에 추가 (기존 카드는 전혀 건드리지 않음)
    const newCards = pendingCards.map((card, index) => ({
      ...card,
      isNew: true,
      row: -1,
      col: -1,
      turnId: gameState.currentTurnId,
      submitTime: Date.now() // 제출 시간 기록
    }));
    
    // 랜덤 위치 찾기 (기존 카드들과 겹치지 않고 좌우 여백 한 칸씩 필수)
    const findRandomPosition = (currentBoardSize = boardSize) => {
      // 가능한 모든 위치를 찾아서 랜덤하게 선택
      const availablePositions: Array<{ row: number; col: number }> = [];
      
      // 모든 행에서 시도
      for (let row = 0; row < currentBoardSize.rows; row++) {
        // 해당 행의 모든 기존 카드 위치 확인
        const rowCards = boardCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
        
        // 해당 행에 카드가 없으면 모든 위치가 가능
        if (rowCards.length === 0) {
          if (newCards.length <= currentBoardSize.cols) {
            for (let startCol = 0; startCol <= currentBoardSize.cols - newCards.length; startCol++) {
              availablePositions.push({ row, col: startCol });
            }
          }
          continue;
        }
        
        // 기존 카드들 사이의 빈 공간 찾기
        for (let startCol = 0; startCol <= currentBoardSize.cols - newCards.length; startCol++) {
          let canPlace = true;
          
          // 1. 새로운 카드들이 들어갈 위치에 기존 카드가 있는지 확인
          for (let i = 0; i < newCards.length; i++) {
            const col = startCol + i;
            const existingCard = rowCards.find(c => c.col === col);
            if (existingCard) {
              canPlace = false;
              break;
            }
          }
          
          if (!canPlace) continue;
          
          // 2. 좌측 여백 확인 (새로운 카드들 왼쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
          const leftCard = rowCards.find(c => c.col === startCol - 1);
          if (leftCard) {
            canPlace = false;
            continue;
          }
          
          // 3. 우측 여백 확인 (새로운 카드들 오른쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
          const rightCard = rowCards.find(c => c.col === startCol + newCards.length);
          if (rightCard) {
            canPlace = false;
            continue;
          }
          
          if (canPlace) {
            availablePositions.push({ row, col: startCol });
          }
        }
      }
      
      // 가능한 위치가 있으면 랜덤하게 선택
      if (availablePositions.length > 0) {
        const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        
        // 위치 할당
        newCards.forEach((card, index) => {
          card.row = randomPosition.row;
          card.col = randomPosition.col + index;
        });
        return true;
      }
      
      return false;
    };
    
    const success = findRandomPosition();
    
    if (success) {
      setBoardCards(prev => [...prev, ...newCards]);
      setPendingCards([]); // 대기 중인 패 제거
    } else {
      // 보드 확장 시도 (15x4 → 20x5 → 25x6 순서)
      const expanded = expandBoard();
      if (expanded) {
        console.log('submitPendingCards: 보드 확장 성공, 확장 후 다시 시도');
        // 확장 후 즉시 다시 시도 (useEffect에서 처리됨)
        return;
      }
      
      // 모든 확장이 완료된 후에만 여백 압축 시도
      const compressAndPlace = () => {
        console.log('submitPendingCards compressAndPlace 시작, newCards 길이:', newCards.length);
        
        // 압축은 실제로는 하지 않고, 단순히 새로운 카드를 배치할 수 있는지만 확인
        for (let targetRow = 0; targetRow < boardSize.rows; targetRow++) {
          const rowCards = boardCards.filter(c => c.row === targetRow).sort((a, b) => a.col - b.col);
          console.log(`submitPendingCards 행 ${targetRow}의 카드 수:`, rowCards.length);
          
          // 해당 행에 카드가 없으면 바로 배치 가능
          if (rowCards.length === 0) {
            console.log(`submitPendingCards 행 ${targetRow}가 비어있어서 바로 배치`);
            newCards.forEach((card, index) => {
              card.row = targetRow;
              card.col = index;
            });
            setBoardCards(prev => [...prev, ...newCards]);
            return true;
          }
          
          // 해당 행에 새로운 카드를 배치할 수 있는지 확인 (압축 없이)
          // 가능한 모든 위치를 찾아서 랜덤하게 선택
          const availablePositions: number[] = [];
          
          for (let col = 0; col <= boardSize.cols - newCards.length; col++) {
            let canPlace = true;
            
            // 해당 위치에 카드가 있는지 확인
            for (let i = 0; i < newCards.length; i++) {
              const existingCard = rowCards.find(c => c.col === col + i);
              if (existingCard) {
                canPlace = false;
                break;
              }
            }
            
            if (canPlace) {
              // 기존 카드들과의 여백 확인 (좌우 한 칸 이상 여백 필요)
              const leftCard = rowCards.find(c => c.col === col - 1);
              const rightCard = rowCards.find(c => c.col === col + newCards.length);
              
              // 좌우에 기존 카드가 있으면 여백이 있어야 함
              if (leftCard || rightCard) {
                console.log(`submitPendingCards 위치 ${col}에서 좌우 여백 문제로 배치 불가`);
                continue; // 이 위치는 사용할 수 없음
              }
              
              availablePositions.push(col);
            }
          }
          
          // 가능한 위치가 있으면 랜덤하게 선택
          if (availablePositions.length > 0) {
            const randomCol = availablePositions[Math.floor(Math.random() * availablePositions.length)];
            console.log(`submitPendingCards 위치 ${randomCol}에 새로운 카드 배치 성공 (랜덤 선택)`);
            
            // 새로운 카드들 배치
            newCards.forEach((card, index) => {
              card.row = targetRow;
              card.col = randomCol + index;
            });
            
            // 새로운 카드만 추가 (기존 카드는 전혀 건드리지 않음)
            setBoardCards(prev => [...prev, ...newCards]);
            return true;
          }
          
          console.log(`submitPendingCards 행 ${targetRow}에서 배치 실패`);
        }
        
        return false;
      };
      
      const compressedSuccess = compressAndPlace();
      if (compressedSuccess) {
        console.log('submitPendingCards: 압축 성공');
        setPendingCards([]); // 대기 중인 패 제거
      } else {
        console.log('submitPendingCards: 모든 방법 실패, 현재 보드 크기:', boardSize);
      }
    }
  };

  // 여백 압축 및 배치 처리 (기존 패를 절대 건드리지 않음)
  const handleCompressionAndPlacement = (newCards: Array<{
    id: number;
    value: number;
    color: string;
    isNew: boolean;
    row: number;
    col: number;
    turnId?: number;
  }>) => {
    console.log('handleCompressionAndPlacement 시작, newCards 길이:', newCards.length);
    
    // 압축은 실제로는 하지 않고, 단순히 새로운 카드를 배치할 수 있는지만 확인
    for (let targetRow = 0; targetRow < boardSize.rows; targetRow++) {
      const rowCards = boardCards.filter(c => c.row === targetRow).sort((a, b) => a.col - b.col);
      console.log(`행 ${targetRow}의 카드 수:`, rowCards.length);
      
      // 해당 행에 카드가 없으면 바로 배치 가능
      if (rowCards.length === 0) {
        console.log(`행 ${targetRow}가 비어있어서 바로 배치`);
        const positionedCards = newCards.map((card, index) => ({
          ...card,
          row: targetRow,
          col: index
        }));
        setBoardCards(prev => [...prev, ...positionedCards]);
        setPendingCards([]);
        return;
      }
      
      // 해당 행에 새로운 카드를 배치할 수 있는지 확인 (압축 없이)
      // 가능한 모든 위치를 찾아서 랜덤하게 선택
      const availablePositions: number[] = [];
      
      for (let col = 0; col <= boardSize.cols - newCards.length; col++) {
        let canPlace = true;
        
        // 해당 위치에 카드가 있는지 확인
        for (let i = 0; i < newCards.length; i++) {
          const existingCard = rowCards.find(c => c.col === col + i);
          if (existingCard) {
            canPlace = false;
            break;
          }
        }
        
        if (canPlace) {
          // 기존 카드들과의 여백 확인 (좌우 한 칸 이상 여백 필요)
          const leftCard = rowCards.find(c => c.col === col - 1);
          const rightCard = rowCards.find(c => c.col === col + newCards.length);
          
          // 좌우에 기존 카드가 있으면 여백이 있어야 함
          if (leftCard || rightCard) {
            console.log(`위치 ${col}에서 좌우 여백 문제로 배치 불가`);
            continue; // 이 위치는 사용할 수 없음
          }
          
          availablePositions.push(col);
        }
      }
      
      // 가능한 위치가 있으면 랜덤하게 선택
      if (availablePositions.length > 0) {
        const randomCol = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        console.log(`위치 ${randomCol}에 새로운 카드 배치 성공 (랜덤 선택)`);
        
        const positionedCards = newCards.map((card, index) => ({
          ...card,
          row: targetRow,
          col: randomCol + index
        }));
        
        // 새로운 카드만 추가 (기존 카드는 전혀 건드리지 않음)
        setBoardCards(prev => [...prev, ...positionedCards]);
        setPendingCards([]);
        return;
      }
      
      console.log(`행 ${targetRow}에서 배치 실패`);
    }
    
    // 모든 행에서 실패한 경우
    console.log('모든 시도 실패, 대기 중인 패에 유지');
  };

  // 보드 확장 함수
  const expandBoard = () => {
    if (boardSize.rows === 4 && boardSize.cols === 15) {
      console.log('15x4에서 20x5로 확장');
      setBoardSize({ rows: 5, cols: 20 });
      return true;
    } else if (boardSize.rows === 5 && boardSize.cols === 20) {
      console.log('20x5에서 25x6으로 확장');
      setBoardSize({ rows: 6, cols: 25 });
      return true;
    }
    return false;
  };



  // 보드 크기가 변경될 때 대기 중인 패 자동 제출
  useEffect(() => {
    if (pendingCards.length > 0) {
      console.log('useEffect: 보드 크기 변경 감지, submitPendingCards 호출');
      setTimeout(() => {
        submitPendingCards();
      }, 100);
    }
  }, [boardSize]);


  const handleCardSelect = (cardId: number) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // 선택된 모든 카드 해제
  const handleResetSelection = () => {
    setSelectedCards([]);
  };

  // 드래그 시작 핸들러
  const handleDragStart = (e: React.DragEvent, cardId: number) => {
    // 정렬 애니메이션 중이면 드래그 차단
    if (isSorting) {
      e.preventDefault();
      return;
    }
    
    setDraggedCard(cardId);
    setIsDragging(true);
    lastDropPositionRef.current = -1; // 드래그 시작시 초기화
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', cardId.toString());
    
    // 드래그 이미지 설정
    const cardElement = e.currentTarget as HTMLElement;
    const dragImage = cardElement.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '1';
    dragImage.style.transform = 'rotate(5deg) scale(1.1)';
    dragImage.style.zIndex = '1000';
    document.body.appendChild(dragImage);
    
    e.dataTransfer.setDragImage(dragImage, 25, 30);
    
    // 드래그 이미지 제거
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  // 마우스 위치를 기준으로 가장 가까운 삽입 위치를 계산하는 함수 (절대 위치 기준)
  const calculateDropPosition = (e: React.DragEvent): number => {
    if (!handRef.current) return 0;
    
    const rect = handRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // console.log('[DEBUG] 📐 calculateDropPosition 호출:', {
    //  mouseX: mouseX.toFixed(2),
    //  clientX: e.clientX,
    //  rectLeft: rect.left
    // });
    
    if (sortedHand.length === 0) return 0;
    
    // my-hand 컨테이너의 패딩과 gap 정보
    const containerPadding = 4; // CSS의 padding
    const cardGap = 4; // CSS의 gap
    
    // 첫 번째 카드 요소의 크기를 기준으로 계산 (모든 카드가 동일한 크기)
    const firstCard = handRef.current.children[0] as HTMLElement;
    if (!firstCard) return 0;
    
    const cardWidth = firstCard.offsetWidth;
    const cardSpacing = cardWidth + cardGap;
    
    // 각 카드의 절대 위치 계산 (이동 애니메이션과 무관한 기본 위치)
    const boundaries: number[] = [];
    
    for (let i = 0; i < sortedHand.length; i++) {
      // 카드의 기본 절대 위치 계산
      const cardStartX = containerPadding + (i * cardSpacing);
      const cardCenterX = cardStartX + (cardWidth / 2);
      
      if (i === 0) {
        // 첫 번째 카드 앞쪽 경계
        boundaries.push(cardStartX);
      }
      
      // 각 카드의 중앙점을 경계로 추가
      boundaries.push(cardCenterX);
    }
    
    // 마지막 카드 뒤쪽 경계
    if (sortedHand.length > 0) {
      const lastCardStartX = containerPadding + ((sortedHand.length - 1) * cardSpacing);
      boundaries.push(lastCardStartX + cardWidth);
    }
    
    // 마우스 위치가 어느 구간에 속하는지 판단
    // boundaries 배열: [카드0앞, 카드0중앙, 카드1중앙, 카드2중앙, ..., 마지막카드뒤]
    
    for (let i = 0; i < boundaries.length - 1; i++) {
      const leftBoundary = boundaries[i];
      const rightBoundary = boundaries[i + 1];
      
      // 마우스가 현재 구간 안에 있는지 확인
      if (mouseX >= leftBoundary && mouseX <= rightBoundary) {
        // i번째 구간에 속함
        const resultPosition = i === 0 ? 0 : i;
        // console.log(`[DEBUG] 🎯 구간 ${i} 매치: ${leftBoundary.toFixed(2)} <= ${mouseX.toFixed(2)} <= ${rightBoundary.toFixed(2)} -> dropPosition: ${resultPosition}`);
        return resultPosition;
      }
    }
    
    // 마지막 구간을 벗어난 경우 (마지막 카드 뒤)
    // console.log(`[DEBUG] 🎯 마지막 구간 벗어남 -> dropPosition: ${sortedHand.length}`);
    return sortedHand.length;
  };

  // 드래그 오버 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedCard === null) {
      // console.log('[DEBUG] ❌ draggedCard가 null - 함수 종료');
      return;
    }
    
    const dropPosition = calculateDropPosition(e);
    
    // console.log('[DEBUG] 🎯 드래그 오버 호출:', {
    //  dropPosition,
    //  lastPosition: lastDropPositionRef.current,
    //  draggedCard,
    //  현재시간: Date.now()
    //});
    
    // 같은 위치라면 불필요한 계산 스킵 (강력한 차단)
    if (lastDropPositionRef.current === dropPosition) {
      // console.log('[DEBUG] 💥 같은 위치이므로 완전 차단! dropPosition:', dropPosition);
      return;
    }
    
    // console.log('[DEBUG] 🔄 위치 변경 감지 - 새로운 처리 시작:', {
    //  from: lastDropPositionRef.current,
    //  to: dropPosition
    // });
    
    // ⚡ 핵심 수정: lastDropPositionRef를 즉시 업데이트하여 중복 호출 방지
    lastDropPositionRef.current = dropPosition;
    
    // 이전 타이머가 있다면 클리어
    if (dragOverTimeoutRef.current) {
      // console.log('[DEBUG] 🗑️ 이전 타이머 클리어');
      clearTimeout(dragOverTimeoutRef.current);
    }
    
    // 짧은 지연을 두어 너무 빈번한 호출 방지
    dragOverTimeoutRef.current = setTimeout(() => {
      // console.log('[DEBUG] ⚡ 타이머 실행 시작 - dropPosition:', dropPosition);
      
      setDragOverIndex(dropPosition);
      
      // 드래그 중에 다른 카드들의 위치를 미리 계산하여 보여주기
      const draggedIndex = sortedHand.findIndex(card => card.id === draggedCard);
      if (draggedIndex === -1) {
        // console.log('[DEBUG] ❌ draggedIndex 찾기 실패');
        return;
      }
      
      // console.log('[DEBUG] 📍 드래그 정보:', {
      //  draggedIndex,
      //  dropPosition,
      //  같은위치체크: draggedIndex === dropPosition,
      //  인접위치체크: draggedIndex === dropPosition - 1
      // });
      
      // 같은 위치에 있으면 오프셋 초기화
      if (draggedIndex === dropPosition || draggedIndex === dropPosition - 1) {
        // console.log('[DEBUG] 🔄 같은/인접 위치 - 오프셋 초기화 실행');
        setCardOffsets({});
        return;
      }
      
      // 각 카드의 이동 거리 계산 (드래그된 카드 제외)
      const offsets: { [key: number]: number } = {};
      const cardWidth = handRef.current ? handRef.current.children[0]?.clientWidth || 0 : 0;
      const gap = 4; // CSS의 gap과 동일
      const cardSpacing = cardWidth + gap;
      
      // console.log('[DEBUG] 📏 스페이싱 정보:', { cardWidth, gap, cardSpacing });
      
      // 드래그된 카드보다 뒤에 있는 카드들이 앞으로 이동하는 경우 (뒤→앞 드래그)
      if (dropPosition < draggedIndex) {
        // console.log('[DEBUG] 🎯 뒤→앞 드래그 감지');
        for (let i = dropPosition; i < draggedIndex; i++) {
          const card = sortedHand[i];
          if (card && card.id !== draggedCard) {
            offsets[card.id] = cardSpacing; // 한 칸씩 뒤로 이동
            // console.log(`[DEBUG] 📦 카드 ${card.id} 뒤로 이동: +${cardSpacing}px`);
          }
        }
      }
      // 드래그된 카드보다 앞에 있는 카드들이 뒤로 이동하는 경우 (앞→뒤 드래그)
      else if (dropPosition > draggedIndex) {
        // console.log('[DEBUG] 🎯 앞→뒤 드래그 감지');
        for (let i = draggedIndex + 1; i < dropPosition; i++) {
          const card = sortedHand[i];
          if (card && card.id !== draggedCard) {
            offsets[card.id] = -cardSpacing; // 한 칸씩 앞으로 이동
            // console.log(`[DEBUG] 📦 카드 ${card.id} 앞으로 이동: -${cardSpacing}px`);
          }
        }
      }
      
      // console.log('[DEBUG] 🎨 최종 오프셋 적용:', Object.keys(offsets).length > 0 ? offsets : '빈 오프셋');
      setCardOffsets(offsets);
    }, 10); // 10ms 지연
  };

  // 드래그 리브 핸들러 - 비활성화 (드래그 중 카드 이동으로 인한 오작동 방지)
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // console.log('[DEBUG] 🚪 드래그 리브 호출됨 - 하지만 무시함 (오작동 방지)');
    // 아무것도 하지 않음 - 드래그 중 카드 이동으로 인한 영역 벗어남은 무시
  };

  // 드롭 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (draggedCard === null) return;
    
    const draggedIndex = sortedHand.findIndex(card => card.id === draggedCard);
    if (draggedIndex === -1) return;
    
    const dropPosition = calculateDropPosition(e);
    
    // 같은 위치에 드롭한 경우 무시
    if (draggedIndex === dropPosition || draggedIndex === dropPosition - 1) {
      setDraggedCard(null);
      setDragOverIndex(null);
      setIsDragging(false);
      setCardOffsets({}); // 오프셋 초기화
      lastDropPositionRef.current = -1; // 위치 참조 초기화
      
      // 타이머 정리
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
        dragOverTimeoutRef.current = null;
      }
      return;
    }
    
    // 카드 순서 변경
    const newHand = [...sortedHand];
    const [draggedItem] = newHand.splice(draggedIndex, 1);
    
    // 삽입 위치 조정 (드래그된 카드가 제거되었으므로)
    const adjustedDropPosition = dropPosition > draggedIndex ? dropPosition - 1 : dropPosition;
    newHand.splice(adjustedDropPosition, 0, draggedItem);
    
    // sessionStorage에 정렬 순서 저장
    const room = ColyseusService.getRoom();
    if (room && mySessionId) {
      const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
      const cardNumbers = newHand.map(card => card.originalNumber);
      sessionStorage.setItem(sortOrderKey, JSON.stringify(cardNumbers));
    }
    
    // 다른 카드들은 이미 드래그 중에 이동했으므로, 즉시 새로운 배열로 업데이트
    // 드래그된 카드만 현재 위치에 "뿅" 나타나게 됨
    setSortedHand(newHand);
    setCardOffsets({});
    setDraggedCard(null);
    setDragOverIndex(null);
    setIsDragging(false);
    lastDropPositionRef.current = -1; // 위치 참조 초기화
    
    // 타이머 정리
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }
  };

  // 드래그 엔드 핸들러
  const handleDragEnd = () => {
    // console.log('[DEBUG] 🏁 드래그 엔드 - 모든 상태 정리');
    // 드래그가 끝나면 상태 초기화 (드롭이 되지 않은 경우)
    setDraggedCard(null);
    setDragOverIndex(null);
    setIsDragging(false);
    // console.log('[DEBUG] 🧹 드래그 엔드에서 완전 정리: 오프셋 초기화');
    setCardOffsets({}); // 카드 오프셋도 초기화
    lastDropPositionRef.current = -1; // 위치 참조도 초기화
    
    // 타이머 정리
    if (dragOverTimeoutRef.current) {
      // console.log('[DEBUG] 🗑️ 드래그 엔드에서 타이머 정리');
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }
  };

  const handlePass = () => {
    // 턴 체크 - 자신의 차례가 아니면 함수 실행 중단
    if (!isMyTurn) {
      console.log('[DEBUG] handlePass - 자신의 차례가 아님, 함수 실행 중단');
      return;
    }
    
    // 내가 pass를 눌렀을 때는 선택된 카드들을 해제
    setSelectedCards([]);
    
    // 내 pass 상태를 즉시 업데이트
    const room = ColyseusService.getRoom();
    if (room) {
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.sessionId === room.sessionId 
            ? { ...player, hasPassed: true }
            : player
        )
      );
      
      room.send('pass');
    }
  };

  // 제출할 카드를 정렬하는 함수
  const sortCardsForSubmission = (cardNumbers: number[]): number[] => {
    const room = ColyseusService.getRoom();
    const maxNumber = room?.state?.maxNumber || 13;
    const isEasyMode = room?.state?.easyMode || false;
    
    // 색상 순서 정의
    const colorOrder = isEasyMode 
      ? ['black', 'bronze', 'silver', 'gold']  // 초보모드
      : ['cloud', 'star', 'moon', 'sun'];     // 일반모드
    
    return cardNumbers.sort((a, b) => {
      // 먼저 숫자로 정렬 (오름차순)
      const aValue = getCardValueFromNumber(a, maxNumber);
      const bValue = getCardValueFromNumber(b, maxNumber);
      
      if (aValue !== bValue) {
        return aValue - bValue;
      }
      
      // 숫자가 같다면 색상으로 정렬
      const aColor = getCardColorFromNumber(a, maxNumber);
      const bColor = getCardColorFromNumber(b, maxNumber);
      const aColorIndex = colorOrder.indexOf(aColor);
      const bColorIndex = colorOrder.indexOf(bColor);
      
      return aColorIndex - bColorIndex;
    });
  };

  const handleSubmitCards = () => {
    // 중복 제출 방지
    if (isSubmitting) {
      console.log('[DEBUG] handleSubmitCards - 이미 제출 중, 중복 호출 방지');
      return;
    }
    
    // 턴 체크 - 자신의 차례가 아니면 함수 실행 중단
    if (!isMyTurn) {
      console.log('[DEBUG] handleSubmitCards - 자신의 차례가 아님, 함수 실행 중단');
      return;
    }
    
    if (selectedCards.length === 0) {
      showToast('제출할 카드를 선택해주세요.', 'error');
      return;
    }
    
    setIsSubmitting(true);

    // 선택된 카드들을 백엔드로 전송
    const room = ColyseusService.getRoom();
    if (room) {
      // 카드 번호로 변환 (백엔드 형식)
      const cardNumbers = selectedCards.map(cardId => {
        // sortedHand에서 선택된 카드의 정보를 가져오기
        const selectedCard = sortedHand.find(c => c.id === cardId);
        if (!selectedCard) {
          console.error('선택된 카드를 찾을 수 없습니다:', cardId);
          return null;
        }
        
        // originalNumber를 직접 사용 (더 안전한 방법)
        if (selectedCard.originalNumber !== undefined) {
          console.log(`[DEBUG] selectedCard.originalNumber 사용: ${selectedCard.originalNumber}`);
          return selectedCard.originalNumber;
        }
        
        // 백엔드에서 직접 손패 정보를 가져와서 카드 번호 찾기 (fallback)
        const room = ColyseusService.getRoom();
        if (room) {
          const myPlayer = room.state.players.get(room.sessionId);
          if (myPlayer && myPlayer.hand) {
            console.log('[DEBUG] 백엔드 손패에서 카드 찾기:', myPlayer.hand);
            // 백엔드 손패에서 해당 카드의 번호 찾기
            for (const cardNumber of myPlayer.hand) {
              const maxNumber = room.state.maxNumber || 13;
              const color = getCardColorFromNumber(cardNumber, maxNumber);
              const value = getCardValueFromNumber(cardNumber, maxNumber);
              console.log(`[DEBUG] 비교: cardNumber=${cardNumber}, color=${color}, value=${value} vs selectedCard.color=${selectedCard.color}, selectedCard.value=${selectedCard.value}`);
              if (color === selectedCard.color && value === selectedCard.value) {
                console.log(`[DEBUG] 매칭된 카드 번호: ${cardNumber}`);
                return cardNumber;
              }
            }
          }
        }
        
        console.error('백엔드에서 카드 번호를 찾을 수 없습니다:', selectedCard);
        return null;
      }).filter(num => num !== null);

      // 카드를 정렬하여 제출
      const sortedCardNumbers = sortCardsForSubmission(cardNumbers);

      console.log('[DEBUG] 제출하려는 카드들:', {
        selectedCards,
        cardNumbers,
        sortedCardNumbers,
        myHand: myHand.map(c => ({ id: c.id, value: c.value, color: c.color, originalNumber: c.originalNumber })),
        sortedHand: sortedHand.map(c => ({ id: c.id, value: c.value, color: c.color }))
      });

      // 디버깅: 각 카드의 상세 정보 출력
      sortedCardNumbers.forEach(cardNumber => {
        console.log(debugCardInfo(cardNumber));
      });

      // 디버깅: 현재 게임 상태 출력
      console.log(debugGameState());

      // 제출 가능 여부 확인
      const validation = canSubmitCards(sortedCardNumbers);
      console.log(`[DEBUG] 제출 검증: ${validation.reason}`);
      
      if (!validation.canSubmit) {
        showToast(`제출 불가: ${validation.reason}`, 'error');
        setIsSubmitting(false);
        return;
      }

      // 백엔드에 submit 메시지 전송
      console.log(`[DEBUG] submit 메시지 전송: sessionId=${room.sessionId}, submitCards=${sortedCardNumbers.join(', ')}`);
      room.send('submit', { submitCards: sortedCardNumbers });
      
      // 선택 상태 초기화 (백엔드 응답 대기)
      setSelectedCards([]);
    }
    
    // 제출 완료 후 플래그 리셋
    setIsSubmitting(false);
  };

  const handleSortByNumber = () => {
    // 이미 정렬 중이면 중복 실행 방지
    if (isSorting) {
      return;
    }
    
    setIsSorting(true);
    
    const colorOrder = gameMode === 'easyMode'
      ? ['black', 'bronze', 'silver', 'gold']
      : ['cloud', 'star', 'moon', 'sun'];
    
    const sorted = [...sortedHand].sort((a, b) => {
      // 먼저 숫자로 정렬
      if (a.value !== b.value) {
        return a.value - b.value;
      }
      // 숫자가 같으면 색상으로 정렬
      const aDisplayColor = getDisplayColor(a.color, gameMode);
      const bDisplayColor = getDisplayColor(b.color, gameMode);
      const aIndex = colorOrder.indexOf(aDisplayColor);
      const bIndex = colorOrder.indexOf(bDisplayColor);
      return aIndex - bIndex;
    });
    
    // sessionStorage에 정렬 순서 저장
    const room = ColyseusService.getRoom();
    if (room && mySessionId) {
      const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
      const cardNumbers = sorted.map(card => card.originalNumber);
      sessionStorage.setItem(sortOrderKey, JSON.stringify(cardNumbers));
    }
    
    const offsets: { [key: number]: number } = {};
    sortedHand.forEach((card, currentIndex) => {
      const newIndex = sorted.findIndex(c => c.id === card.id);
      if (newIndex !== currentIndex) {
        const cardWidth = handRef.current ? handRef.current.children[0]?.clientWidth || 0 : 0;
        const gap = 6;
        const cardSpacing = cardWidth + gap;
        offsets[card.id] = (newIndex - currentIndex) * cardSpacing + 6;
      }
    });
    
    setCardOffsets(offsets);
    
    setTimeout(() => {
      setSortedHand(sorted);
      setCardOffsets({});
      setIsSorting(false);
    }, 800);
  };

  const handleSortByColor = () => {
    // 이미 정렬 중이면 중복 실행 방지
    if (isSorting) {
      return;
    }
    
    setIsSorting(true);
    
    const colorOrder = gameMode === 'easyMode'
      ? ['black', 'bronze','silver', 'gold']
      : ['cloud', 'star', 'moon', 'sun'];
    const sorted = [...sortedHand].sort((a, b) => {
      const aDisplayColor = getDisplayColor(a.color, gameMode);
      const bDisplayColor = getDisplayColor(b.color, gameMode);
      const aIndex = colorOrder.indexOf(aDisplayColor);
      const bIndex = colorOrder.indexOf(bDisplayColor);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.value - b.value;
    });
    
    // sessionStorage에 정렬 순서 저장
    const room = ColyseusService.getRoom();
    if (room && mySessionId) {
      const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
      const cardNumbers = sorted.map(card => card.originalNumber);
      sessionStorage.setItem(sortOrderKey, JSON.stringify(cardNumbers));
    }
    
    const offsets: { [key: number]: number } = {};
    sortedHand.forEach((card, currentIndex) => {
      const newIndex = sorted.findIndex(c => c.id === card.id);
      if (newIndex !== currentIndex) {
        const cardWidth = handRef.current ? handRef.current.children[0]?.clientWidth || 0 : 0;
        const gap = 6;
        const cardSpacing = cardWidth + gap;
        offsets[card.id] = (newIndex - currentIndex) * cardSpacing;
      }
    });
    
    setCardOffsets(offsets);
    
    setTimeout(() => {
      setSortedHand(sorted);
      setCardOffsets({});
      setIsSorting(false);
    }, 800);
  };



  const handleViewCombinations = () => {
    setShowCombinationGuide(true);
  };

  const handleModeChange = () => {
    const newMode = gameMode === 'easyMode' ? 'normal' : 'easyMode';
    setGameMode(newMode);
    
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('easyMode', { easyMode: newMode === 'easyMode' });
    }
  };

  return (
    <div className="game-screen">

      {/* 다음 라운드 대기 팝업 */}
      {waitingForNextRound && (
        <div className="waiting-popup-overlay">
          <div className="waiting-popup">
            <div className="waiting-spinner"></div>
            <h3>다른 유저들을 기다리는 중입니다...</h3>
            <p>모든 플레이어가 준비되면 다음 라운드가 시작됩니다.</p>
            <div className="ready-players">
              <p>준비 완료: {readyPlayers.size} / {players.length}명</p>
              <div className="ready-list">
                {players.map(player => (
                  <span 
                    key={player.sessionId} 
                    className={`ready-indicator ${readyPlayers.has(player.sessionId) ? 'ready' : 'waiting'}`}
                  >
                    {player.nickname}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="game-container">

        
        {/* 상단 좌측 - 다른 플레이어 정보 */}
        <div className="top-left-section">
          <div className="other-players">
            {(() => {
              const room = ColyseusService.getRoom();
              const playerOrder = room?.state?.playerOrder || [];
              const nowPlayerIndex = room?.state?.nowPlayerIndex || 0;
              
              const otherPlayers = players.filter(player => player.sessionId !== mySessionId);
              const sortedOtherPlayers = otherPlayers.sort((a, b) => {
                const aIndex = playerOrder.indexOf(a.sessionId);
                const bIndex = playerOrder.indexOf(b.sessionId);
                
                const myIndex = playerOrder.indexOf(mySessionId);
                const aRelativeIndex = (aIndex - myIndex + playerOrder.length) % playerOrder.length;
                const bRelativeIndex = (bIndex - myIndex + playerOrder.length) % playerOrder.length;
                
                return aRelativeIndex - bRelativeIndex;
              });
              
              return sortedOtherPlayers.map((player) => {
                const currentPlayerSessionId = playerOrder[nowPlayerIndex];
                const isCurrentTurn = player.sessionId === currentPlayerSessionId;
                
                return (
                  <div key={player.id} className="player-info-container">
                    <div className={`player-info-box ${isCurrentTurn ? 'current-turn' : ''} ${player.hasPassed ? 'passed' : ''}`}>
                      <div className="player-info">
                        <div className="player-nickname">
                          {player.nickname}
                        </div>
                        <div className="player-coins">
                          <img src={coinImage} alt="코인" className="coin-icon" />
                          {player.score}
                        </div>
                      </div>
                      {player.hasPassed && (
                        <div className="pass-overlay">
                          <span className="pass-text">
                            PASS
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="remaining-tiles-count">
                      <img src={cardImage} alt="카드" className="card-icon" />
                      <AnimatedRemainingTiles count={player.remainingTiles} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* 중앙 - 게임 보드 */}
        <div className="game-board-section">
          {showBoardMask && <div className="board-mask"></div>}
          <div 
            className="game-board"
            style={{ '--board-cols': boardSize.cols } as React.CSSProperties}
          >
            {Array.from({ length: boardSize.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="board-row">
                {Array.from({ length: boardSize.cols }, (_, colIndex) => {
                  const card = boardCards.find(c => c.row === rowIndex && c.col === colIndex);
                  
                  const cardsWithTurnId = boardCards.filter(c => c.turnId !== undefined);
                  const maxTurnId = cardsWithTurnId.length > 0 ? Math.max(...cardsWithTurnId.map(c => c.turnId!)) : 0;
                  const isMostRecent = card && card.turnId && card.turnId === maxTurnId;
                  
                  return (
                    <div key={colIndex} className="board-slot">
                      {card && (
                        <div className={`board-card ${getDisplayColor(card.color, gameMode)} ${isMostRecent ? 'new-card' : ''}`}>
                          {getCardImage(getDisplayColor(card.color, gameMode)) && (
                            <img 
                              src={getCardImage(getDisplayColor(card.color, gameMode))!} 
                              alt={getDisplayColor(card.color, gameMode)} 
                              className="card-image"
                            />
                          )}
                          <span className="card-value">{card.value || '?'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 - 내 정보 및 컨트롤 */}
        <div className="bottom-section">
          {/* 하단 상단 - 내 정보 및 컨트롤 */}
          <div className="bottom-top">
            {/* 좌측 - 내 정보 */}
            <div className="my-info">
              <div className={`my-info-box ${isMyTurn ? 'current-turn' : ''} ${players.find(p => p.sessionId === mySessionId)?.hasPassed ? 'passed' : ''}`}>
                <div className="my-nickname">
                  {players.find(p => p.sessionId === mySessionId)?.nickname || '닉네임'}
                </div>
                <div className="my-stats">
                  <span className="my-coins">
                    <img src={coinImage} alt="코인" className="coin-icon" />
                    {players.find(p => p.sessionId === mySessionId)?.score || 0}
                  </span>
                  <span className="my-tiles">
                    <img src={cardImage} alt="카드" className="card-icon" />
                    <AnimatedRemainingTiles count={sortedHand.length} />
                  </span>
                </div>
                {players.find(p => p.sessionId === mySessionId)?.hasPassed && (
                  <div className="pass-overlay">
                    <span className="pass-text">
                      PASS
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 중앙 - 라운드, 현재 조합 및 버튼들 */}
            <div className="center-controls">
              <div className="round-info-inline">
                <span className="round-text-inline">
                  라운드 {gameState.round} / {ColyseusService.getRoom()?.state?.totalRounds || gameState.totalRounds}
                </span>
              </div>
              <div className="current-combination">
                <CombinationWheel 
                  currentCombination={getCurrentCombinationText()}
                  lastType={gameState.lastType}
                  lastMadeType={gameState.lastMadeType}
                />
              </div>
              <div className="control-buttons">
                <button 
                  className="control-btn" 
                  onClick={handleViewCombinations}
                >
                  족보보기
                </button>
                <button 
                  className="control-btn" 
                  onClick={handleModeChange}
                >
                  {gameMode === 'easyMode' ? '초보모드' : '일반모드'}
                </button>
              </div>
            </div>

            {/* 우측 - Drop/Pass 버튼 */}
            <div className="action-buttons">
              <button 
                className={`action-btn drop-btn ${!isMyTurn || isSubmitting ? 'disabled' : ''}`} 
                onClick={(e) => {
                  e.preventDefault();
                  if (!isMyTurn || isSubmitting) {
                    return;
                  }
                  handleSubmitCards();
                }}
                disabled={!isMyTurn || isSubmitting}
                title={!isMyTurn ? '다른 플레이어의 차례입니다' : isSubmitting ? '제출 중입니다' : '카드를 제출합니다'}
              >
                Submit
              </button>
              <button 
                className={`action-btn pass-btn ${!isMyTurn ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isMyTurn) {
                    return;
                  }
                  handlePass();
                }}
                disabled={!isMyTurn}
                title={!isMyTurn ? '다른 플레이어의 차례입니다' : '패스합니다'}
              >
                Pass
              </button>
            </div>
          </div>

          {/* 하단 하단 - 내 손패 및 정렬 버튼 */}
          <div className="bottom-bottom">
            {/* 내 손패 */}
            <div 
              className="my-hand" 
              ref={handRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {sortedHand.map((tile, index) => (
                <div 
                  key={tile.id} 
                  className={`hand-tile ${getDisplayColor(tile.color, gameMode)} ${selectedCards.includes(tile.id) ? 'selected' : ''} ${draggedCard === tile.id ? 'dragging' : ''} ${isSorting ? 'sorting' : ''} ${isDragging && draggedCard !== tile.id && cardOffsets[tile.id] !== undefined ? 'dragging-preview' : ''}`}
                  style={(isSorting || (isDragging && cardOffsets[tile.id] !== undefined)) ? {
                    transform: `translateX(${cardOffsets[tile.id]}px)`
                  } : {}}
                  onClick={() => handleCardSelect(tile.id)}
                  draggable={!isSorting}
                  onDragStart={(e: React.DragEvent) => handleDragStart(e, tile.id)}
                  onDragEnd={handleDragEnd}
                >
                  {/* 카드 분배 애니메이션 중에는 뒷면만 표시 */}
                  {getCardImage(getDisplayColor(tile.color, gameMode)) && (
                    <img 
                      src={getCardImage(getDisplayColor(tile.color, gameMode))!} 
                      alt={getDisplayColor(tile.color, gameMode)} 
                      className="card-image"
                    />
                  )}
                  <span className="tile-value">{tile.value || '?'}</span>
                </div>
              ))}
            </div>
            {/* 정렬 버튼들 */}
            <div className="sort-buttons">
              {selectedCards.length > 0 && (
                <button 
                  className="sort-btn reset-btn" 
                  onClick={handleResetSelection}
                >
                  Reset
                </button>
              )}
              <div className="sort-buttons-group">
                <button 
                  className="sort-btn" 
                  onClick={handleSortByNumber}
                >
                  숫자정렬
                </button>
                <button 
                  className="sort-btn" 
                  onClick={handleSortByColor}
                >
                  색상정렬
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>
      
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
      
      {/* Toast 알림 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
        duration={2000}
        showCloseButton={false}
        className="game-toast"
      />
    </div>
  );
};

export default GameScreen;
