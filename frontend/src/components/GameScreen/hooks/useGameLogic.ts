import { useState, useRef } from 'react';
import ColyseusService from '../../../services/ColyseusService';

export interface Player {
  id: string;
  nickname: string;
  score: number;
  remainingTiles: number;
  isCurrentPlayer: boolean;
  sessionId: string;
  hasPassed: boolean;
}

export interface Card {
  id: number;
  value: number;
  color: string;
  originalNumber: number;
  isFlipped?: boolean; // 카드가 뒤집혔는지 (라운드 시작 시 사용)
  isAnimating?: boolean; // 카드 뒤집기 애니메이션 중인지
}

export const useGameLogic = () => {
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
    turnId?: number;
    submitTime?: number;
  }>>([]);
  const [sortedHand, setSortedHand] = useState<Card[]>([]);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [mySessionId, setMySessionId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handRef = useRef<HTMLDivElement>(null);

  const handleSortByNumber = () => {
    const sorted = [...sortedHand].sort((a, b) => a.value - b.value);
    setSortedHand(sorted);
    saveSortOrder(sorted.map(c => c.originalNumber));
  };

  const handleSortByColor = () => {
    const colorOrder = gameMode === 'easyMode'
      ? ['black', 'bronze','silver', 'gold']
      : ['cloud', 'star', 'moon', 'sun'];
    
    const sorted = [...sortedHand].sort((a, b) => {
      const aIndex = colorOrder.indexOf(a.color);
      const bIndex = colorOrder.indexOf(b.color);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.value - b.value;
    });
    setSortedHand(sorted);
    saveSortOrder(sorted.map(c => c.originalNumber));
  };

  const handleDrop = (draggedCard: Card, dropIndex: number) => {
    const draggedIndex = sortedHand.findIndex(card => card.id === draggedCard.id);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    const newHand = [...sortedHand];
    const [draggedItem] = newHand.splice(draggedIndex, 1);
    newHand.splice(dropIndex, 0, draggedItem);
    
    setSortedHand(newHand);
    saveSortOrder(newHand.map(c => c.originalNumber));
  };

  const saveSortOrder = (order: number[]) => {
    const room = ColyseusService.getRoom();
    if (room && mySessionId) {
      const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
      sessionStorage.setItem(sortOrderKey, JSON.stringify(order));
    }
  };

  return {
    gameMode, setGameMode,
    selectedCards, setSelectedCards,
    boardCards, setBoardCards,
    sortedHand, setSortedHand,
    myHand, setMyHand,
    players, setPlayers,
    mySessionId, setMySessionId,
    isSubmitting, setIsSubmitting,
    handRef,
    handleSortByNumber,
    handleSortByColor,
    handleDrop,
    saveSortOrder
  };
};
