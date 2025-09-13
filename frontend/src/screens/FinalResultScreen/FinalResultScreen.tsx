import React from 'react';
import './FinalResultScreen.css';
import ColyseusService from '../../services/ColyseusService';

interface FinalPlayerScore {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
  rating_mu_after?: number;
  rating_sigma_after?: number;
  rating_mu_before?: number;
  rating_sigma_before?: number;
}

interface FinalResultScreenProps {
  finalScores: FinalPlayerScore[];
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult') => void;
}

const FinalResultScreen: React.FC<FinalResultScreenProps> = ({ finalScores, onScreenChange }) => {
  
  // finalScores가 배열이 아닌 경우 빈 배열로 처리
  const safeFinalScores = Array.isArray(finalScores) ? finalScores : [];
  const sortedScores = [...safeFinalScores].sort((a, b) => a.rank - b.rank);

  const handleBackToLobby = () => {
    ColyseusService.disconnect();
    onScreenChange('lobby');
  };

  const getRatingChange = (player: FinalPlayerScore) => {
    if (player.rating_mu_before === undefined || player.rating_mu_after === undefined) {
      return null;
    }
    const change = player.rating_mu_after - player.rating_mu_before;
    
    // 자동 우승의 경우 점수 조정을 +0으로 표시
    if (Math.abs(change) < 0.001) {
      return '+0.00';
    }
    
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  return (
    <div className="final-result-screen">
      <div className="final-result-container">
        <h1 className="final-title">최종 결과</h1>
        <div className="final-player-list">
          {sortedScores.map((player, index) => {
            const rank = player.rank;
            const rankColors = ['gold', 'silver', 'bronze', 'black', 'gray'];
            const rankColor = rankColors[rank - 1] || 'gray';
            const ratingChange = getRatingChange(player);

            return (
              <div key={player.playerId} className={`final-player-item rank-${rank}`}>
                <span className={`final-rank ${rankColor}`}>{rank}</span>
                <span className="final-nickname">{player.nickname}</span>
                <div className="final-score-details">
                  <span className="final-score">
                    {player.rating_mu_after !== undefined ? `${player.rating_mu_after.toFixed(2)}` : player.score}
                  </span>
                  {ratingChange && (
                     <span className={`rating-change ${parseFloat(ratingChange) >= 0 ? 'positive' : 'negative'}`}>
                       ({ratingChange})
                     </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="final-controls">
          <button className="btn btn-secondary" onClick={handleBackToLobby}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalResultScreen;
