import React, { useState, useEffect } from 'react';
import './GameHistoryModal.css';

interface Player {
  userId: number;
  nickname: string;
  profileImageUrl?: string;
  rank: number;
  score: number;
  ratingChange: number;
  ratingBefore: number;
  ratingAfter: number;
}

interface GameHistory {
  gameId: string;
  playedAt: string;
  playerCount: number;
  duration: number;
  myRank: number;
  myScore: number;
  myRatingChange: number;
  myRatingBefore: number;
  myRatingAfter: number;
  players: Player[];
}

interface User {
  nickname: string;
  profileImageUrl?: string;
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  rating_mu: number;
}

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
}

const GameHistoryModal: React.FC<GameHistoryModalProps> = ({ isOpen, onClose, token }) => {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<GameHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && token) {
      loadGameHistory();
    }
  }, [isOpen, token]);

  const loadGameHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const apiUrl = process.env.REACT_APP_API_URL || 
        (isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
      
      const response = await fetch(`${apiUrl}/api/user/games`, {
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

  if (!isOpen) return null;

  return (
    <div className="game-history-modal-overlay" onClick={onClose}>
      <div className="game-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>전적 보기</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>전적을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button className="retry-button" onClick={loadGameHistory}>
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* 유저 통계 섹션 */}
              {user && (
                <div className="game-history-user-stats-section">
                  <div className="game-history-user-profile">
                    {user.profileImageUrl && (
                      <img 
                        src={user.profileImageUrl} 
                        alt="profile" 
                        className="game-history-user-profile-image" 
                      />
                    )}
                    <div className="game-history-user-info">
                      <h3 className="game-history-user-nickname">{user.nickname}</h3>
                      <p className="game-history-user-rating">Rating: {user.rating_mu.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="user-record">
                    <div className="record-item">
                      <span className="record-label">총 게임</span>
                      <span className="record-value">{user.totalGames}회</span>
                    </div>
                    <div className="record-item">
                      <span className="record-label">승</span>
                      <span className="record-value wins">{user.wins}승</span>
                    </div>
                    <div className="record-item">
                      <span className="record-label">무</span>
                      <span className="record-value draws">{user.draws}무</span>
                    </div>
                    <div className="record-item">
                      <span className="record-label">패</span>
                      <span className="record-value losses">{user.losses}패</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 게임 목록 섹션 */}
              <div className="games-section">
                <h3>게임 기록</h3>
                {games.length === 0 ? (
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
                              플레이 시간: {formatDuration(game.duration)}
                            </div>
                          </div>
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
                            <div className="players-list">
                              <h4>참가자 정보</h4>
                              {game.players.map((player) => (
                                <div key={player.userId} className="player-item">
                                  <div className="player-profile">
                                    <span className="player-rank-icon">
                                      {getRankIcon(player.rank)}
                                    </span>
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
                              ))}
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
    </div>
  );
};

export default GameHistoryModal;
