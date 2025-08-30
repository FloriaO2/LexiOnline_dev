import React, { useState, useEffect, useRef } from 'react';
import './ResultScreen.css';
import ColyseusService from '../../services/ColyseusService';

// #region Interfaces
interface PlayerScore {
  playerId: string;
  score: number;
  nickname: string;
  scoreDiff: number;
  remainingTiles: number;
}

interface ComprehensiveResult {
  scores: PlayerScore[];
  round: number;
  isGameEnd: boolean;
  scoreBeforeCalculation: Array<{ playerId: string; score: number }>;
  scoreMatrix: { [key: string]: { [key: string]: number } };
  finalHands: { [key: string]: number[] };
  maxNumber: number;
}

interface ResultScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult') => void;
  playerCount: number;
  roundResult: ComprehensiveResult | null;
}
// #endregion

// #region Helper Functions for Verification
const getTwosCount = (hand: number[], maxNumber: number): number => {
  let count = 0;
  hand.forEach(card => {
    // 카드 값이 2인 경우: card % maxNumber === 1
    if (card % maxNumber === 1) {
      count++;
    }
  });
  return count;
};
// #endregion

// #region AnimatedNumber Component
const AnimatedNumber: React.FC<{
  value: number;
  isAnimating: boolean;
  direction: 'up' | 'down';
}> = ({ value, isAnimating, direction }) => {
  const [displayValue, setDisplayValue] = React.useState(value);
  const [isRunning, setIsRunning] = React.useState(false);

  React.useEffect(() => {
    if (isAnimating && !isRunning) {
      setIsRunning(true);
      const startValue = displayValue;
      const endValue = value;
      const startTime = Date.now();
      const duration = 1500; // 화살표 애니메이션과 동일한 지속시간
      
      // 중간 값들을 생성 (빠르게 휘리릭 지나가는 효과)
      const intermediateValues: number[] = [];
      const steps = 25; // 더 부드러운 애니메이션을 위해 단계 증가
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const easeProgress = 1 - Math.pow(1 - progress, 2); // easeOutQuad
        const intermediateValue = Math.round(startValue + (endValue - startValue) * easeProgress);
        intermediateValues.push(intermediateValue);
      }
      
      const stepDuration = duration / steps;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const step = Math.floor(elapsed / stepDuration);
        
        if (step < intermediateValues.length) {
          setDisplayValue(intermediateValues[step]);
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
          setIsRunning(false);
        }
      };
      
      requestAnimationFrame(animate);
    } else if (!isAnimating) {
      setDisplayValue(value);
    }
  }, [value, isAnimating, isRunning, displayValue]);

  return (
    <div className="animated-number">
      {displayValue}
    </div>
  );
};
// #endregion

// #region AnimatedArrow Component
const AnimatedArrow: React.FC<{
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  visible: boolean;
  amount?: number;
}> = ({ from, to, visible, amount }) => {
  const ARROW_RADIUS = 35;
  const ARROW_HEAD_SIZE = 25;
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (visible) {
      setProgress(0);
      const startTime = Date.now();
      const duration = 1500;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(elapsed / duration, 1);
        setProgress(newProgress);
        
        if (newProgress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    } else {
      setProgress(0);
    }
  }, [from, to, visible]);

  if (!from || !to || !visible) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const startX = from.x + Math.cos(angle) * ARROW_RADIUS;
  const startY = from.y + Math.sin(angle) * ARROW_RADIUS;
  const endX = to.x - Math.cos(angle) * ARROW_RADIUS;
  const endY = to.y - Math.sin(angle) * ARROW_RADIUS;
  
  const currentEndX = startX + (endX - startX) * progress;
  const currentEndY = startY + (endY - startY) * progress;
  const arrowHeadX = currentEndX + (ARROW_HEAD_SIZE * 0.4) * Math.cos(angle);
  const arrowHeadY = currentEndY + (ARROW_HEAD_SIZE * 0.4) * Math.sin(angle);

  // 코인 숫자의 위치 계산 (화살표를 따라 이동)
  const coinProgress = Math.min(progress * 1.2, 1); // 화살표보다 조금 빠르게 이동
  const coinX = startX + (endX - startX) * coinProgress;
  const coinY = startY + (endY - startY) * coinProgress;

  return (
    <>
      <svg className="arrow-svg" width="600" height="600" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 20 }}>
        <line x1={startX} y1={startY} x2={currentEndX} y2={currentEndY} stroke="#ffd700" strokeWidth={7} strokeLinecap="round" />
        <polygon
          points={`${arrowHeadX},${arrowHeadY} ${arrowHeadX - ARROW_HEAD_SIZE * Math.cos(angle - 0.35)},${arrowHeadY - ARROW_HEAD_SIZE * Math.sin(angle - 0.35)} ${arrowHeadX - ARROW_HEAD_SIZE * Math.cos(angle + 0.35)},${arrowHeadY - ARROW_HEAD_SIZE * Math.sin(angle + 0.35)}`}
          fill="#ffd700"
        />
      </svg>
      {amount && (
        <div 
          className="coin-amount"
          style={{
            position: 'absolute',
            left: coinX,
            top: coinY,
            zIndex: 25,
            transform: 'translate(-50%, -50%)',
            animation: progress >= 0.8 ? 'coinArrive 0.5s ease-out' : 'coinFloat 1.5s ease-in-out infinite',
            opacity: progress >= 0.8 ? 0.8 : 1
          }}
        >
          {amount}
        </div>
      )}
    </>
  );
};
// #endregion

const ResultScreen: React.FC<ResultScreenProps> = ({ onScreenChange, playerCount, roundResult: comprehensiveResult }) => {
  // #region State & Derived Values
  const [transferMessage, setTransferMessage] = useState('결과 집계 중...');
  const [currentTransferStep, setCurrentTransferStep] = useState(-1);
  const [showArrow, setShowArrow] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  
  const initialScores = comprehensiveResult?.scoreBeforeCalculation;
  const scoreMatrix = comprehensiveResult?.scoreMatrix;
  const rankedPlayers = comprehensiveResult?.scores || [];
  const finalHands = comprehensiveResult?.finalHands;
  const maxNumber = comprehensiveResult?.maxNumber;
  
  const [displayScores, setDisplayScores] = useState<{ [playerId: string]: number }>({});
  const [playerComponents, setPlayerComponents] = useState<{ [playerId: string]: number }>({});
  const [transfers, setTransfers] = useState<Array<{ giverId: string; receiverId: string; amount: number }>>([]);
  const [isReadyForAnimation, setIsReadyForAnimation] = useState(false);
  const [actualPlayerCount] = useState(() => (comprehensiveResult?.scores || []).length || playerCount);
  
  // 애니메이션 상태 관리
  const [scoreAnimations, setScoreAnimations] = useState<{ [playerId: string]: { isAnimating: boolean; direction: 'up' | 'down' } }>({});

  const playerRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [centers, setCenters] = useState<{ [key: string]: { x: number; y: number } | null }>({});
  // #endregion

  // #region useEffects
  useEffect(() => {
    const scores: { [playerId: string]: number } = {};
    if (initialScores) {
      initialScores.forEach(p => {
        scores[p.playerId] = p.score;
      });
      setDisplayScores(scores);
      setIsReadyForAnimation(false);
      setCurrentTransferStep(-1);
      setShowButtons(false);
      setTransferMessage('결과 집계 중...');
    }

    if (comprehensiveResult && finalHands && maxNumber && rankedPlayers) {
      const components: { [key: string]: number } = {};
      rankedPlayers.forEach(p => {
        const hand = finalHands[p.playerId];
        if (hand) {
          const twosCount = getTwosCount(hand, maxNumber);
          components[p.playerId] = p.remainingTiles * (2 ** twosCount);
        } else {
          components[p.playerId] = 0;
        }
      });
      setPlayerComponents(components);
    }
  }, [comprehensiveResult]);

  useEffect(() => {
    if (!rankedPlayers.length) return;
    const newCenters: { [key: string]: { x: number; y: number } | null } = {};
    for (let i = 0; i < rankedPlayers.length; i++) {
      const player = rankedPlayers[i];
      const key = `player${i}`;
      const playerBox = playerRefs.current[key];
      const layout = layoutRef.current;
      if (playerBox && layout) {
        // tile-count 클래스를 찾아서 그 중심점을 계산
        const tileCountElement = playerBox.querySelector('.tile-count');
        if (tileCountElement) {
          const tileCountRect = tileCountElement.getBoundingClientRect();
          const layoutRect = layout.getBoundingClientRect();
          newCenters[player.playerId] = {
            x: tileCountRect.left + tileCountRect.width / 2 - layoutRect.left,
            y: tileCountRect.top + tileCountRect.height / 2 - layoutRect.top,
          };
        } else {
          // tile-count를 찾을 수 없는 경우 기존 방식 사용
          const tileRect = playerBox.getBoundingClientRect();
          const layoutRect = layout.getBoundingClientRect();
          newCenters[player.playerId] = {
            x: tileRect.left + tileRect.width / 2 - layoutRect.left,
            y: tileRect.top + tileRect.height / 2 - layoutRect.top,
          };
        }
      }
    }
    setCenters(newCenters);
    const timer = setTimeout(() => {
        if (Object.keys(newCenters).length === rankedPlayers.length) {
            setIsReadyForAnimation(true);
        }
    }, 100);
    return () => clearTimeout(timer);
  }, [rankedPlayers]);

  useEffect(() => {
    if (scoreMatrix) {
      const newTransfers: Array<{ giverId: string; receiverId: string; amount: number }> = [];
      for (const giverId in scoreMatrix) {
        for (const receiverId in scoreMatrix[giverId]) {
          const amount = scoreMatrix[giverId][receiverId];
          if (amount > 0) {
            newTransfers.push({ giverId, receiverId, amount });
          }
        }
      }
      setTransfers(newTransfers);
    }
  }, [scoreMatrix]);

  useEffect(() => {
    if (!isReadyForAnimation || !initialScores || !comprehensiveResult || !finalHands || !maxNumber) {
      return;
    }

    // If animation is ready but there are no transfers, end immediately.
    if (transfers.length === 0) {
      setTransferMessage('결과 집계 완료!');
      setShowArrow(false);
      // Run verification even if there are no transfers
      console.log("--- VERIFICATION ---");
      const beScoreDiffs: {[key: string]: number} = {};
      comprehensiveResult.scores.forEach(p => beScoreDiffs[p.playerId] = p.scoreDiff);
      let allMatch = true;
      for(const p of rankedPlayers) {
        if (beScoreDiffs[p.playerId] !== 0) {
          allMatch = false;
        }
      }
      console.log("Verification successful (no transfers):", allMatch);
      // --- END VERIFICATION ---
      setTimeout(() => setShowButtons(true), 2000);
      return;
    }
    
    const totalSteps = transfers.length;
    const playerMap = new Map(rankedPlayers.map(p => [p.playerId, p]));
    let animationTimeout: NodeJS.Timeout;

    const runAnimationStep = (step: number) => {
      if (step >= totalSteps) {
        // Animation finished
        setTransferMessage('결과 집계 완료!');
        setShowArrow(false);

        // --- VERIFICATION LOGIC ---
        console.log("--- VERIFICATION ---");
        const feScoreDiffs: {[key: string]: number} = {};
        rankedPlayers.forEach(p => feScoreDiffs[p.playerId] = 0);

        const playerComponents: {[key: string]: number} = {};
        rankedPlayers.forEach(p => {
          const hand = finalHands[p.playerId];
          if (hand) {
            const twosCount = getTwosCount(hand, maxNumber);
            playerComponents[p.playerId] = p.remainingTiles * (2 ** twosCount);
          } else {
            playerComponents[p.playerId] = 0;
          }
        });

        for (let i = 0; i < rankedPlayers.length; i++) {
          for (let j = i + 1; j < rankedPlayers.length; j++) {
            const playerA = rankedPlayers[i];
            const playerB = rankedPlayers[j];
            
            const scoreA = playerComponents[playerA.playerId];
            const scoreB = playerComponents[playerB.playerId];
            const diff = scoreA - scoreB;

            // The player with the higher component pays the one with the lower component.
            // So, the one with the higher component loses points, and the one with the lower component gains points.
            feScoreDiffs[playerA.playerId] -= diff;
            feScoreDiffs[playerB.playerId] += diff;
          }
        }
        
        const beScoreDiffs: {[key: string]: number} = {};
        comprehensiveResult.scores.forEach(p => beScoreDiffs[p.playerId] = p.scoreDiff);

        let allMatch = true;
        for(const playerId in feScoreDiffs) {
          if(Math.round(feScoreDiffs[playerId]) !== Math.round(beScoreDiffs[playerId])) {
            console.log(`Mismatch for ${playerId}: FE: ${feScoreDiffs[playerId]}, BE: ${beScoreDiffs[playerId]}`);
            allMatch = false;
          }
        }
        console.log("Verification successful:", allMatch);
        // --- END VERIFICATION ---

        setTimeout(() => setShowButtons(true), 2000);
        return;
      }

      // Run current step logic
      setCurrentTransferStep(step);
      const transfer = transfers[step];
      const giver = playerMap.get(transfer.giverId);
      const receiver = playerMap.get(transfer.receiverId);

      if (giver && receiver) {
        setTransferMessage(`<span class="guide-tag">${giver.nickname}</span> 님이 <span class="guide-tag">${receiver.nickname}</span> 님에게 코인 전달`);
        
        // 애니메이션 상태 설정
        setScoreAnimations(prev => ({
          ...prev,
          [giver.playerId]: { isAnimating: true, direction: 'down' },
          [receiver.playerId]: { isAnimating: true, direction: 'up' }
        }));
        
        setDisplayScores(currentScores => {
          const newScores = { ...currentScores };
          newScores[giver.playerId] -= transfer.amount;
          newScores[receiver.playerId] += transfer.amount;
          return newScores;
        });
        setShowArrow(true);
        
        // 애니메이션 완료 후 상태 초기화 (화살표 애니메이션과 동일한 타이밍)
        setTimeout(() => {
          setScoreAnimations(prev => ({
            ...prev,
            [giver.playerId]: { isAnimating: false, direction: 'down' },
            [receiver.playerId]: { isAnimating: false, direction: 'up' }
          }));
        }, 1500);
      } else {
        setShowArrow(false);
      }

      // Schedule next step
      animationTimeout = setTimeout(() => runAnimationStep(step + 1), 2500);
    };

    // Start the animation
    runAnimationStep(0);

    return () => {
      clearTimeout(animationTimeout);
    };
  }, [isReadyForAnimation, comprehensiveResult, transfers]);
  // #endregion

  // #region Handlers
  const handlePlayAgain = () => {
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('readyForNextRound', {});
      onScreenChange('game');
    }
  };

  const handleShowFinalResult = () => {
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('requestFinalResult', {});
    }
  };

  const handleBackToLobby = () => {
    ColyseusService.disconnect();
    onScreenChange('lobby');
  };
  // #endregion

  // #region Render
  const getArrowProps = () => {
    if (!showArrow || currentTransferStep < 0 || transfers.length <= currentTransferStep) {
      return { from: null, to: null, visible: false, amount: undefined };
    }
  
    const transfer = transfers[currentTransferStep];
    if (transfer) {
      return {
        from: centers[transfer.giverId] || null,
        to: centers[transfer.receiverId] || null,
        visible: true,
        amount: transfer.amount,
      };
    }
    
    return { from: null, to: null, visible: false, amount: undefined };
  };

  return (
    <div className="result-screen">
      <div className="result-container">
        <div className="opponent-section">
          <div className={`circular-layout players-${actualPlayerCount}`} ref={layoutRef}>
            {rankedPlayers.map((player, index) => {
              const rank = index + 1;
              const rankColors = ['gold', 'silver', 'bronze', 'black', 'gray'];
              const rankColor = rankColors[index] || 'gray';
              
              return (
                <div key={player.playerId} className="player-box" ref={el => { playerRefs.current[`player${index}`] = el; }}>
                  <div className="player-placeholder">{player.nickname}</div>
                  <div className="tiles-info">
                    <span className="remaining-count">{playerComponents[player.playerId] ?? 0}개</span>
                    <div className={`tile-count ${rankColor}`}>
                      <AnimatedNumber 
                        value={displayScores[player.playerId] ?? 0}
                        isAnimating={scoreAnimations[player.playerId]?.isAnimating || false}
                        direction={scoreAnimations[player.playerId]?.direction || 'up'}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <AnimatedArrow {...getArrowProps()} />
          </div>
        </div>

        {!showButtons && (
          <div className={`transfer-info ${transferMessage === '결과 집계 완료!' ? 'complete-message' : ''}`}>
            <span dangerouslySetInnerHTML={{ __html: transferMessage }}></span>
          </div>
        )}

        {showButtons && (
          <div className="controls">
            {comprehensiveResult?.isGameEnd ? (
              <button className="btn btn-primary" onClick={handleShowFinalResult}>
                최종 결과 보기
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handlePlayAgain}>
                다음 라운드
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleBackToLobby}>
              로비로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
  // #endregion
};

export default ResultScreen;
