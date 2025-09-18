import React, { useState, useEffect } from 'react';
import './GameHistoryModal.css';

interface Player {
  userId: number;
  nickname: string;
  profileImageUrl?: string;
  rank: number;
  score: number;
  ratingChange: number;
}

interface GameHistory {
  gameId: string;
  playedAt: string;
  playerCount: number;
  roomTitle?: string;
  duration: number;
  myRank: number;
  myScore: number;
  myRatingChange: number;
  players: Player[];
}

interface User {
  id: number;
  nickname: string;
  profileImageUrl?: string;
  totalGames: number;
  result_wins: number;
  result_draws: number;
  result_losses: number;
  rating_mu: number;
  allowGameHistoryView?: boolean; // 전적 공개 허용 여부
}

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  targetUserId?: number; // 다른 유저의 전적을 볼 때 사용
  onPlayerClick?: (userId: number) => void; // 플레이어 클릭 시 호출되는 콜백
  isNested?: boolean; // 중첩된 모달인지 여부 (크기 조정용)
  isFromRanking?: boolean; // 랭킹탭에서 들어온 경우인지 여부
}

const GameHistoryModal: React.FC<GameHistoryModalProps> = ({ isOpen, onClose, token, targetUserId, onPlayerClick, isNested = false, isFromRanking = false }) => {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<GameHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  
  // 중첩된 모달 상태 (다른 유저의 전적을 볼 때)
  const [nestedModalUserId, setNestedModalUserId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && token) {
      loadGameHistory();
    }
  }, [isOpen, token, targetUserId]);

  const loadGameHistory = async () => {
    setIsLoading(true);
    setError(null);
    setPrivacyMessage(null);
    
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const apiUrl = process.env.REACT_APP_API_URL || 
        (isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
      
      // targetUserId가 있으면 특정 유저의 전적을 조회, 없으면 내 전적을 조회
      let endpoint = targetUserId ? `/api/user/games/${targetUserId}` : '/api/user/games';
      
      // 랭킹탭에서 들어온 경우 쿼리 파라미터 추가
      if (targetUserId && isFromRanking) {
        endpoint += '?fromRanking=true';
      }
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        headers: { 
          Authorization: `Bearer ${token}` 
        },
      });
      
      if (!response.ok) {
        throw new Error('전적 정보를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      setUser(data.user);
      setGames(data.games);
      
      // 전적 공개가 비활성화된 경우 메시지 설정
      if (data.message && data.message === '전적 공개를 허용하지 않았습니다.') {
        setPrivacyMessage(data.message);
      }
    } catch (err) {
      console.error('전적 로드 실패:', err);
      setError(err instanceof Error ? err.message : '전적을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}월 ${day}일 ${hours}:${minutes}`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRatingChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  const toggleGameExpansion = (gameId: string) => {
    setExpandedGameId(expandedGameId === gameId ? null : gameId);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRatingChangeColor = (change: number) => {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  };

  // 현재 팝업 주인의 userId (targetUserId가 있으면 해당 유저, 없으면 내 계정)
  const getCurrentModalOwnerId = () => {
    if (targetUserId) {
      return targetUserId;
    }
    // 내 계정의 경우, user 정보에서 id를 가져옴
    return user?.id;
  };

  if (!isOpen) return null;

  return (
    <div className={`game-history-modal-overlay ${isNested ? 'nested' : ''}`} onClick={onClose}>
      <div className={`game-history-modal ${isNested ? 'nested' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {targetUserId ? `${user?.nickname || '유저'}의 전적 보기` : '내 전적 보기'}
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="game-history-loading-container">
              <div className="game-history-loading-spinner"></div>
              <p>전적을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="game-history-error-container">
              <p className="game-history-error-message">{error}</p>
              <button className="game-history-retry-button" onClick={loadGameHistory}>
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* 유저 통계 섹션 */}
              {user && (
                <div className="game-history-user-stats-section">
                  <div className="game-history-user-profile">
                    {user.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt="profile" 
                        className="game-history-user-profile-image" 
                      />
                    ) : (
                      <div className="game-history-user-profile-image game-history-user-profile-image-default"></div>
                    )}
                    <div className="game-history-user-info">
                      <h3 className="game-history-user-nickname">{user.nickname}</h3>
                      <p className="game-history-user-rating">
                        Rating: {user.rating_mu ? user.rating_mu.toFixed(2) : '?'}
                      </p>
                    </div>
                  </div>
                  <div className="user-record">
                    <div className="record-item">
                      <span className="record-label">총 게임</span>
                      <span className="record-value">
                        {privacyMessage && !isFromRanking ? '?회' : `${user.totalGames}회`}
                      </span>
                    </div>
                    <div className="record-item">
                      <span className="record-label">승</span>
                      <span className="record-value wins">
                        {privacyMessage && !isFromRanking ? '?승' : `${user.result_wins}승`}
                      </span>
                    </div>
                    <div className="record-item">
                      <span className="record-label">무</span>
                      <span className="record-value draws">
                        {privacyMessage && !isFromRanking ? '?무' : `${user.result_draws}무`}
                      </span>
                    </div>
                    <div className="record-item">
                      <span className="record-label">패</span>
                      <span className="record-value losses">
                        {privacyMessage && !isFromRanking ? '?패' : `${user.result_losses}패`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 게임 목록 섹션 */}
              <div className="games-section">
                <h3>게임 기록</h3>
                {privacyMessage ? (
                  <div className="privacy-restricted">
                    <div className="privacy-icon">🔒</div>
                    <p className="privacy-message">{privacyMessage}</p>
                    <p className="privacy-description">
                      이 유저는 전적 공개를 허용하지 않았습니다.
                    </p>
                  </div>
                ) : games.length === 0 ? (
                  <div className="no-games">
                    <p>아직 게임 기록이 없습니다.</p>
                  </div>
                ) : (
                  <div className="games-list">
                    {games.map((game) => (
                      <div key={game.gameId} className="game-item">
                        {/* 간이 전적 박스 */}
                        <div 
                          className="game-summary"
                          onClick={() => toggleGameExpansion(game.gameId)}
                        >
                          <div className="game-basic-info">
                            <div className="game-time">
                              {formatDateTime(game.playedAt)}
                            </div>
                            <div className="game-duration">
                              플레이 시간 {formatDuration(game.duration)}
                            </div>
                          </div>
                          {game.roomTitle && (
                            <div className="game-room-title">
                              {game.roomTitle}
                            </div>
                          )}
                          <div className="game-result">
                            <div className="my-rank">
                              {getRankIcon(game.myRank)}
                            </div>
                            <div className={`game-history-rating-change ${getRatingChangeColor(game.myRatingChange)}`}>
                              {formatRatingChange(game.myRatingChange)}
                            </div>
                          </div>
                          <div className="expand-icon">
                            {expandedGameId === game.gameId ? '▲' : '▼'}
                          </div>
                        </div>

                        {/* 자세한 전적 박스 (아코디언) */}
                        {expandedGameId === game.gameId && (
                          <div className="game-details">
                            <div className="game-history-players-list">
                              <h4>참가자 정보</h4>
                              {game.players.map((player) => {
                                const currentModalOwnerId = getCurrentModalOwnerId();
                                const isModalOwner = player.userId === currentModalOwnerId;
                                const canClick = !isNested && !isModalOwner;
                                
                                return (
                                  <div 
                                    key={player.userId} 
                                    className={`player-item ${canClick ? 'clickable' : ''} ${isModalOwner ? 'modal-owner' : ''}`}
                                    onClick={() => {
                                      if (canClick) {
                                        setNestedModalUserId(player.userId);
                                      }
                                    }}
                                  >
                                  <div className="player-profile">
                                    <span className="player-rank-icon">
                                      {getRankIcon(player.rank)}
                                    </span>
                                    {player.profileImageUrl ? (
                                      <img 
                                        src={player.profileImageUrl} 
                                        alt="profile" 
                                        className="player-profile-image" 
                                      />
                                    ) : (
                                      <div className="player-profile-placeholder">
                                        {player.nickname.charAt(0)}
                                      </div>
                                    )}
                                    <span className="player-nickname">{player.nickname}</span>
                                  </div>
                                  <div className="player-stats">
                                    <span className="player-score">
                                      {player.score}점
                                    </span>
                                    <span className={`game-history-player-rating-change ${getRatingChangeColor(player.ratingChange)}`}>
                                      {formatRatingChange(player.ratingChange)}
                                    </span>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 중첩된 모달 (다른 유저의 전적) */}
      {nestedModalUserId && (
        <GameHistoryModal
          isOpen={true}
          onClose={() => setNestedModalUserId(null)}
          token={token}
          targetUserId={nestedModalUserId}
          isNested={true}
          isFromRanking={false} // 중첩된 모달은 항상 내 전적에서 클릭한 경우
        />
      )}
    </div>
  );
};

export default GameHistoryModal;
