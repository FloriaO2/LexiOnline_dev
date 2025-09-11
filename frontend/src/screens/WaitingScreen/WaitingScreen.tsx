import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WaitingScreen.css';
import '../../components/Toast/Toast.css';
import ColyseusService from '../../services/ColyseusService';
import Toast from '../../components/Toast/Toast';

interface Player {
  id: string;
  nickname: string;
  isReady: boolean;
  easyMode: boolean;
}

interface WaitingScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
  setPlayerCount: (count: number) => void;
}

// 커스텀 드롭다운 컴포넌트
const CustomDropdown: React.FC<{
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  disabled?: boolean;
}> = ({ value, onChange, options, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = (optionValue: number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(option => option.value === value);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div 
      ref={dropdownRef}
      className={`custom-dropdown ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <div 
        className="dropdown-header" 
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span>{selectedOption?.label}</span>
        <div className="dropdown-arrow"></div>
      </div>
      {isOpen && (
        <div className="dropdown-options">
          {options.map((option) => (
            <div
              key={option.value}
              className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WaitingScreen: React.FC<WaitingScreenProps> = ({ onScreenChange, playerCount, setPlayerCount }) => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [rounds, setRounds] = useState(3);
  const [easyMode, setEasyMode] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [timeAttackMode, setTimeAttackMode] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [isReady, setIsReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setToast({
      message,
      type,
      isVisible: true,
    });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  useEffect(() => {
    // URL을 /waiting으로 설정
    if (window.location.pathname !== '/waiting') {
      navigate('/waiting');
    }

    // WaitingScreen에서는 로비 방 연결 불필요 (LobbyScreen에서만 처리)

    let room = ColyseusService.getRoom();
    
    // 방에 연결되지 않은 경우, 저장된 방 정보로 재연결 시도
    if (!room) {
      console.log('방에 연결되지 않음. 저장된 방 정보로 재연결 시도...');
      setIsReconnecting(true);
      ColyseusService.reconnectToSavedRoom().then(reconnectedRoom => {
        setIsReconnecting(false);
        if (reconnectedRoom) {
          console.log('저장된 방에 재연결 성공');
          setupRoomListeners(reconnectedRoom);
        } else {
          console.log('저장된 방이 이미 닫혔거나 존재하지 않습니다. 로비로 이동합니다.');
          // URL을 루트로 변경
          navigate('/');
          onScreenChange('lobby');
        }
      });
      return;
    }

    setupRoomListeners(room);
    
    // WaitingScreen에서는 로비 방 연결을 하지 않으므로 해제할 필요 없음
  }, [onScreenChange, navigate]);

  const setupRoomListeners = (room: any) => {
    // 방 코드는 roomId를 사용 (실제 방 참가에 사용 가능한 코드)
    setRoomCode(room.roomId);

    // 초기 상태 로드
    const loadInitialState = () => {
      const state = room.state;
      console.log('초기 방 상태:', state);
      
      if (state.players) {
        const playerList: Player[] = [];
        const seenIds = new Set<string>();
        
        state.players.forEach((player: any, sessionId: string) => {
          // 중복 체크
          if (seenIds.has(sessionId)) {
            console.log('중복 플레이어 ID 발견:', sessionId);
            return;
          }
          seenIds.add(sessionId);
          
          playerList.push({
            id: sessionId,
            nickname: player.nickname || '익명',
            isReady: player.ready || false,
            easyMode: player.easyMode || false,
          });
        });
        setPlayers(playerList);
        console.log('플레이어 목록 업데이트:', playerList);
      }
      
      // 호스트 확인
      setIsHost(state.host === room.sessionId);
      console.log('호스트 여부:', state.host === room.sessionId);
      
      // 라운드 수 설정
      if (state.totalRounds !== undefined) {
        setRounds(state.totalRounds);
        console.log('초기 라운드 수 설정:', state.totalRounds);
      }
      
      // 블라인드 모드 설정
      if (state.blindMode !== undefined) {
        setBlindMode(state.blindMode);
        console.log('초기 블라인드 모드 설정:', state.blindMode);
      }
      
      // 타임어택 모드 설정
      if (state.timeAttackMode !== undefined) {
        setTimeAttackMode(state.timeAttackMode);
        console.log('초기 타임어택 모드 설정:', state.timeAttackMode);
      }
      
      // 시간 제한 설정
      if (state.timeLimit !== undefined) {
        setTimeLimit(state.timeLimit);
        console.log('초기 시간 제한 설정:', state.timeLimit);
      }
    };

    // 초기 상태 로드
    loadInitialState();

    // 방 상태 구독
    room.onStateChange((state: any) => {
      console.log('방 상태 변경:', state);
      if (state.players) {
        const playerList: Player[] = [];
        const seenIds = new Set<string>();
        
        state.players.forEach((player: any, sessionId: string) => {
          // 중복 체크
          if (seenIds.has(sessionId)) {
            console.log('중복 플레이어 ID 발견:', sessionId);
            return;
          }
          seenIds.add(sessionId);
          
          playerList.push({
            id: sessionId,
            nickname: player.nickname || '익명',
            isReady: player.ready || false,
            easyMode: player.easyMode || false,
          });
        });
        setPlayers(playerList);
        console.log('플레이어 목록 업데이트:', playerList);
        
        // 호스트 확인
        setIsHost(state.host === room.sessionId);
        
        // 라운드 수 업데이트
        if (state.totalRounds !== undefined) {
          setRounds(state.totalRounds);
          console.log('라운드 수 업데이트:', state.totalRounds);
        }
        
        // 블라인드 모드 업데이트
        if (state.blindMode !== undefined) {
          setBlindMode(state.blindMode);
          console.log('블라인드 모드 업데이트:', state.blindMode);
        }
        
        // 타임어택 모드 업데이트
        if (state.timeAttackMode !== undefined) {
          setTimeAttackMode(state.timeAttackMode);
          console.log('타임어택 모드 업데이트:', state.timeAttackMode);
        }
        
        // 시간 제한 업데이트
        if (state.timeLimit !== undefined) {
          setTimeLimit(state.timeLimit);
          console.log('시간 제한 업데이트:', state.timeLimit);
        }
        
        // 본인이 그룹에 포함되어 있는지 확인
        const isInGroup = state.players.has(room.sessionId);
        if (!isInGroup) {
          console.log('본인이 그룹에서 제외되었습니다. 로비로 이동합니다.');
          ColyseusService.disconnect();
          navigate('/');
          onScreenChange('lobby');
        }
      }
    });

    // 메시지 수신
    room.onMessage('gameStarted', () => {
      console.log('게임이 시작되었습니다!');
      onScreenChange('game');
    });

    room.onMessage('readyUpdate', (message: any) => {
      console.log('준비 상태 업데이트:', message);
      // 준비 상태 업데이트 시 플레이어 목록도 업데이트
      setPlayers(prevPlayers => {
        const updatedPlayers = prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, isReady: message.ready }
            : player
        );
        console.log(`[DEBUG] readyUpdate: 플레이어 목록 업데이트 - ${message.playerId} 준비 상태: ${message.ready}`);
        console.log(`[DEBUG] readyUpdate: 업데이트된 플레이어 목록:`, updatedPlayers);
        return updatedPlayers;
      });
      
      // 자신의 준비 상태도 업데이트
      if (message.playerId === room.sessionId) {
        console.log(`[DEBUG] readyUpdate: 자신의 준비 상태 업데이트 - ${message.ready}`);
        setIsReady(message.ready);
      }
    });

    room.onMessage('gameReset', () => {
      console.log('게임이 리셋되었습니다.');
    });

    room.onMessage('nicknameUpdate', (message: any) => {
      console.log('닉네임 업데이트:', message);
      // 닉네임 업데이트 시 플레이어 목록도 업데이트
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, nickname: message.nickname }
            : player
        )
      );
    });

    room.onMessage('roundsChanged', (message: any) => {
      console.log('라운드 수 변경:', message);
      setRounds(message.rounds);
    });

    room.onMessage('totalRoundsUpdated', (message: any) => {
      console.log('전체 라운드 수 업데이트:', message);
      setRounds(message.totalRounds);
    });

    room.onMessage('playerEasyModeChanged', (message: any) => {
      console.log('플레이어 이지 모드 변경:', message);
      setPlayers(prevPlayers =>
        prevPlayers.map(p =>
          p.id === message.playerId ? { ...p, easyMode: message.easyMode } : p
        )
      );
    });

    room.onMessage('blindModeChanged', (message: any) => {
      console.log('블라인드 모드 변경:', message);
      setBlindMode(message.blindMode);
    });

    room.onMessage('timeAttackModeChanged', (message: any) => {
      console.log('타임어택 모드 변경:', message);
      setTimeAttackMode(message.timeAttackMode);
    });

    room.onMessage('timeLimitChanged', (message: any) => {
      console.log('시간 제한 변경:', message);
      setTimeLimit(message.timeLimit);
    });

    room.onMessage('changeRejected', (message: any) => {
      console.error('라운드 수 변경 거부:', message.reason);
      showToast('라운드 수 변경이 거부되었습니다: ' + message.reason, 'error');
    });

    room.onMessage('playerJoined', (message: any) => {
      console.log('새 플레이어 입장:', message);
      // playerJoined에서는 새 플레이어를 추가하지 않음
      // playersUpdated 메시지에서 전체 플레이어 목록을 동기화함
      
      // 호스트 변경 확인만 수행
      if (message.isHost) {
        setIsHost(message.playerId === room.sessionId);
      }
    });

    room.onMessage('playerReconnected', (message: any) => {
      console.log('플레이어 재연결:', message);
      // 재연결된 플레이어는 목록에 추가하지 않음 (이미 존재함)
      // 하지만 닉네임이 업데이트되었을 수 있으므로 업데이트
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, nickname: message.nickname }
            : player
        )
      );
    });

    room.onMessage('playerLeft', (message: any) => {
      console.log('플레이어 퇴장:', message);
      // playerLeft에서는 플레이어를 제거하지 않음
      // playersUpdated 메시지에서 전체 플레이어 목록을 동기화함
      
      // 호스트 변경 확인
      if (message.newHost) {
        setIsHost(message.newHost === room.sessionId);
      }
    });

    room.onMessage('playersUpdated', (message: any) => {
      console.log('플레이어 목록 업데이트:', message);
      console.log(`[DEBUG] playersUpdated: 받은 플레이어 목록:`, message.players);
      
      // 전체 플레이어 목록을 서버에서 받은 정보로 업데이트
      const updatedPlayers: Player[] = message.players.map((p: any) => ({
        id: p.playerId,
        nickname: p.nickname,
        isReady: p.isReady, // 서버에서 받은 준비 상태 그대로 사용
        easyMode: p.easyMode || false,
      }));
      
      console.log(`[DEBUG] playersUpdated: 업데이트된 플레이어 목록:`, updatedPlayers);
      setPlayers(updatedPlayers);
      
      // 호스트 정보도 업데이트
      const currentPlayer = message.players.find((p: any) => p.playerId === room.sessionId);
      if (currentPlayer) {
        setIsHost(currentPlayer.isHost);
        // 자신의 준비 상태도 서버 상태와 동기화
        console.log(`[DEBUG] playersUpdated: 자신의 준비 상태 동기화 - ${currentPlayer.isReady}`);
        setIsReady(currentPlayer.isReady);
      }
    });

    // 방에서 나갈 때 정리
    return () => {
      room.onLeave(() => {
        console.log('대기실에서 나갔습니다.');
      });
    };
  };

  const handleReady = () => {
    const room = ColyseusService.getRoom();
    if (room) {
      const newReadyState = !isReady;
      setIsReady(newReadyState);
      room.send('ready', { ready: newReadyState });
    }
  };

  const handleStartGame = () => {
    const room = ColyseusService.getRoom();
    if (room && isHost) {
      room.send('start', { rounds });
    }
  };

  const handleLeaveRoom = () => {
    ColyseusService.disconnect();
    // URL을 루트로 변경
    navigate('/');
    onScreenChange('lobby');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    showToast('방 코드가 복사되었습니다!', 'success');
  };

  const allPlayersReady = players.length > 0 && players.every(player => player.isReady);

  // 재연결 중일 때 로딩 화면 표시
  if (isReconnecting) {
    return (
      <div className="waiting-screen">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>방에 재연결 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-screen">
      <Toast 
        message={toast.message} 
        type={toast.type}
        isVisible={toast.isVisible} 
        onClose={closeToast} 
        showCloseButton={false}
        hideBorder={true}
        isCopyNotification={true}
      />
      <div className="waiting-scroll-container">
        <div className="waiting-container">
        <div className="header">
          <h1>게임 대기실</h1>
          <div className="room-info">
            <span>방 코드: {roomCode}</span>
            <button className="copy-btn" onClick={copyRoomCode}>
              복사
            </button>
          </div>
        </div>

        <div className="players-section">
          <h2>플레이어 목록 ({players.length}명)</h2>
          <div className="players-list">
            {players.length > 0 ? (
              players.map((player) => (
                <div key={player.id} className="player-item">
                  <span className="nickname">{player.nickname}</span>
                  <span className={`status ${player.isReady ? 'ready' : 'waiting'}`}>
                    {player.isReady ? '준비완료' : '대기중'}
                  </span>
                </div>
              ))
            ) : (
              <div className="no-players">
                <p>플레이어가 없습니다...</p>
              </div>
            )}
          </div>
        </div>

        <div className="game-settings">
          <h2>게임 설정</h2>
          <div className="settings-row">
            <div className="rounds-setting">
               <label htmlFor="rounds">라운드 수:</label>
               {isHost ? (
                 <CustomDropdown
                   value={rounds}
                   onChange={(value) => {
                     setRounds(value);
                     const room = ColyseusService.getRoom();
                     if (room) {
                       room.send('changeRounds', { rounds: value });
                     }
                   }}
                   options={[
                     { value: 1, label: '1라운드' },
                     { value: 2, label: '2라운드' },
                     { value: 3, label: '3라운드' },
                     { value: 4, label: '4라운드' },
                     { value: 5, label: '5라운드' },
                   ]}
                 />
               ) : (
                 <div className="rounds-info">
                   <span className="rounds-text">{rounds}라운드</span>
                 </div>
               )}
             </div>
              <div className="blindmode-setting">
              <label>전략 모드:</label>
              {isHost ? (
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="blindMode"
                      value="public"
                      checked={!blindMode}
                      onChange={() => {
                        const room = ColyseusService.getRoom();
                        if (room) {
                          setBlindMode(false);
                          room.send('changeBlindMode', { blindMode: false });
                        }
                      }}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">공개 모드</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="blindMode"
                      value="blind"
                      checked={blindMode}
                      onChange={() => {
                        const room = ColyseusService.getRoom();
                        if (room) {
                          setBlindMode(true);
                          room.send('changeBlindMode', { blindMode: true });
                        }
                      }}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">블라인드 모드</span>
                  </label>
                </div>
              ) : (
                <div className="mode-info">
                  <span className="mode-text">{blindMode ? '블라인드 모드' : '공개 모드'}</span>
                </div>
              )}
            </div>
            <div className="timeattack-setting">
              <label>진행 방식:</label>
              {isHost ? (
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="timeAttackMode"
                      value="free"
                      checked={!timeAttackMode}
                      onChange={() => {
                        const room = ColyseusService.getRoom();
                        if (room) {
                          setTimeAttackMode(false);
                          room.send('changeTimeAttackMode', { timeAttackMode: false });
                        }
                      }}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">프리 모드</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="timeAttackMode"
                      value="timeattack"
                      checked={timeAttackMode}
                      onChange={() => {
                        const room = ColyseusService.getRoom();
                        if (room) {
                          setTimeAttackMode(true);
                          room.send('changeTimeAttackMode', { timeAttackMode: true });
                        }
                      }}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">타임어택 모드</span>
                  </label>
                </div>
              ) : (
                <div className="mode-info">
                  <span className="mode-text">
                    {timeAttackMode ? `타임어택 모드 (${timeLimit}초)` : '프리 모드'}
                  </span>
                </div>
              )}
            </div>
            
            {timeAttackMode && isHost && (
              <div className="timelimit-setting">
                <label>시간 제한:</label>
                <CustomDropdown
                  value={timeLimit}
                  onChange={(value) => {
                    setTimeLimit(value);
                    const room = ColyseusService.getRoom();
                    if (room) {
                      room.send('changeTimeLimit', { timeLimit: value });
                    }
                  }}
                  options={[
                    { value: 10, label: '10초' },
                    { value: 20, label: '20초' },
                    { value: 30, label: '30초' },
                    { value: 40, label: '40초' },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        <div className="controls">
          <button 
            className={`btn ${isReady ? 'btn-ready-active' : 'btn-ready'}`} 
            onClick={handleReady}
          >
            {isReady ? '준비 취소' : '준비하기'}
          </button>
          {isHost && allPlayersReady && players.length >= 2 && (
            <button className="btn btn-start" onClick={handleStartGame}>
              게임 시작
            </button>
          )}
          <button className="btn btn-leave" onClick={handleLeaveRoom}>
            방 나가기
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default WaitingScreen;
