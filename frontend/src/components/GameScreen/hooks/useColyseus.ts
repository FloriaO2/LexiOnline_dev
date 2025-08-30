import { useEffect } from 'react';
import ColyseusService from '../../../services/ColyseusService';
import { Player, Card } from './useGameLogic';

interface ColyseusProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult', result?: any) => void;
  setPlayers: (players: Player[]) => void;
  setMySessionId: (sessionId: string) => void;
  setAndSortHand: (hand: Card[]) => void;
  setGameMode: (mode: 'easyMode' | 'normal') => void;
  setBoardCards: (cards: any) => void;
}

export const useColyseus = ({
  onScreenChange,
  setPlayers,
  setMySessionId,
  setAndSortHand,
  setGameMode,
  setBoardCards
}: ColyseusProps) => {
  useEffect(() => {
    const room = ColyseusService.getRoom();
    if (!room) {
      onScreenChange('lobby');
      return;
    }

    setMySessionId(room.sessionId);

    const onStateChange = (state: any) => {
      const myPlayer = state.players.get(room.sessionId);
      if (myPlayer) {
        setGameMode(myPlayer.easyMode ? 'easyMode' : 'normal');
      }

      if (state.players && state.playerOrder) {
        const playerList: Player[] = Array.from(state.playerOrder as Iterable<string>).map((sessionId: string, index: number) => {
          const player = state.players.get(sessionId);
          return {
            id: index.toString(),
            nickname: player.nickname || '익명',
            score: player.score || 0,
            remainingTiles: player.hand ? player.hand.length : 0,
            isCurrentPlayer: sessionId === room.sessionId,
            sessionId: sessionId,
            hasPassed: player.hasPassed || false
          };
        });
        setPlayers(playerList);
      }
    };

    room.onStateChange(onStateChange);

    room.onMessage('roundStart', (message: any) => {
      if (message.hand) {
        const maxNumber = message.maxNumber || 13;
        const handCards = message.hand.map((cardNumber: number, index: number) => ({
          id: index,
          value: (cardNumber % maxNumber) + 1,
          color: ['black', 'bronze', 'silver', 'gold'][Math.floor(cardNumber / maxNumber)],
          originalNumber: cardNumber
        }));
        setAndSortHand(handCards);
      }
    });

    room.onMessage('submitted', (message: any) => {
      if (message.playerId === room.sessionId) {
        const myPlayer = room.state.players.get(room.sessionId);
        if (myPlayer && myPlayer.hand) {
          const maxNumber = room.state.maxNumber || 13;
          const handCards = myPlayer.hand.map((cardNumber: number, index: number) => ({
            id: index,
            value: (cardNumber % maxNumber) + 1,
            color: ['black', 'bronze', 'silver', 'gold'][Math.floor(cardNumber / maxNumber)],
            originalNumber: cardNumber
          }));
          setAndSortHand(handCards);
        }
      }
    });

    room.onMessage('roundEnded', (message: any) => {
      setBoardCards([]);
      onScreenChange('result', message);
    });

    return () => {
      room.onStateChange.remove(onStateChange);
    };
  }, [onScreenChange, setPlayers, setMySessionId, setAndSortHand, setGameMode, setBoardCards]);
};
