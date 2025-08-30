import React from 'react';
import './GameGuide.css';

interface GameGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const GameGuide: React.FC<GameGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="game-guide-overlay" onClick={onClose}>
      <div className="game-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-header">
          <h2>게임 가이드북</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="guide-content">
          <div className="guide-section">
            <h3>🎮 게임 목표</h3>
            <p>모든 카드를 먼저 보드에 배치한 플레이어가 승리합니다!</p>
          </div>

          <div className="guide-section">
            <h3>📋 기본 규칙</h3>
            <ul>
              <li>각 플레이어는 14장의 카드를 받습니다</li>
              <li>최소 3장 이상의 카드로 조합을 만들어야 합니다</li>
              <li>첫 턴에는 30점 이상의 조합을 내야 합니다</li>
              <li>이후 턴에는 기존 조합에 카드를 추가하거나 새로운 조합을 만들 수 있습니다</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>🎯 조합 만들기</h3>
            <ul>
              <li><strong>같은 숫자 조합</strong>: 같은 숫자의 카드들을 모읍니다 (예: 5-5-5)</li>
              <li><strong>연속 숫자 조합</strong>: 연속된 숫자들을 모읍니다 (예: 3-4-5-6-7)</li>
              <li><strong>같은 모양 조합</strong>: 같은 모양의 카드들을 모읍니다 (예: 모두 태양 모양)</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>🔄 게임 진행</h3>
            <ol>
              <li>카드를 선택합니다 (여러 장 선택 가능)</li>
              <li>"Submit" 버튼을 눌러 보드에 배치합니다</li>
              <li>유효한 조합이 아니면 "Pass"를 눌러 턴을 넘깁니다</li>
              <li>모든 카드를 배치하면 승리!</li>
            </ol>
          </div>

          <div className="guide-section">
            <h3>🎨 모드 설명</h3>
            <div className="mode-explanation">
              <div className="mode-item">
                <h4>초보 모드</h4>
                <p>금색, 은색, 동색, 검정색으로 구분</p>
              </div>
              <div className="mode-item">
                <h4>일반 모드</h4>
                <p>태양, 달, 별, 구름 모양으로 구분</p>
              </div>
            </div>
          </div>

          <div className="guide-section">
            <h3>💡 팁</h3>
            <ul>
              <li>높은 점수의 조합을 먼저 내면 유리합니다</li>
              <li>다른 플레이어의 조합에 카드를 추가할 수도 있습니다</li>
              <li>정렬 기능을 활용해서 카드를 효율적으로 관리하세요</li>
              <li>족보를 참고해서 강한 조합을 만드세요</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameGuide; 