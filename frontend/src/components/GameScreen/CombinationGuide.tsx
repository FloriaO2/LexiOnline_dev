import React, { useState, useEffect } from 'react';
import './CombinationGuide.css';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';

// 이미지 프리로딩 함수
const preloadImages = (imageUrls: string[]): Promise<void[]> => {
  return Promise.all(
    imageUrls.map(url => 
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      })
    )
  );
};

interface CombinationGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onShowGameGuide: () => void;
  gameMode: 'easyMode' | 'normal';
}

const CombinationGuide: React.FC<CombinationGuideProps> = ({ isOpen, onClose, onShowGameGuide, gameMode }) => {
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // 이미지 프리로딩
  useEffect(() => {
    const loadImages = async () => {
      try {
        console.log('CombinationGuide 이미지 프리로딩 시작...');
        await preloadImages([sunImage, moonImage, starImage, cloudImage]);
        console.log('CombinationGuide 이미지 프리로딩 완료!');
        setImagesLoaded(true);
      } catch (error) {
        console.error('CombinationGuide 이미지 프리로딩 실패:', error);
        setImagesLoaded(true);
      }
    };
    
    loadImages();
  }, []);

  if (!isOpen) return null;

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

  const renderCard = (value: number, color: string) => {
    const displayColor = getDisplayColor(color, gameMode);
    const cardImage = getCardImage(displayColor);
    
    return (
      <div className={`guide-card ${displayColor}`}>
        {gameMode === 'normal' && imagesLoaded && cardImage && (
          <img src={cardImage} alt={displayColor} className="guide-card-image" />
        )}
        <span className="guide-card-value">{value}</span>
      </div>
    );
  };

  return (
    <div className="combination-guide-overlay" onClick={onClose}>
      <div className="combination-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-header">
          <h2>LexiOnline</h2>
          <div className="header-buttons">
            <button className="game-guide-btn" onClick={onShowGameGuide} title="게임 가이드북">
              💡
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="guide-content">
          {/* 싱글 */}
          <div className="combination-section">
            <h3>싱글 (한 개의 타일)</h3>
            <div className="combination-example">
              {renderCard(13, 'black')}
              <span className="comparison-arrow">&#60;</span>
              {renderCard(13, 'bronze')}
              <span className="comparison-arrow">&#60;</span>
              {renderCard(13, 'silver')}
              <span className="comparison-arrow">&#60;</span>
              {renderCard(13, 'gold')}
            </div>
          </div>

          {/* 원페어 */}
          <div className="combination-section">
            <h3>원페어 (같은 수 2개)</h3>
            <div className="combination-example">
              <div className="pair-group">
                {renderCard(4, 'silver')}
                {renderCard(4, 'bronze')}
              </div>
              <span className="comparison-arrow">&#60;</span>
              <div className="pair-group">
                {renderCard(11, 'gold')}
                {renderCard(11, 'black')}
              </div>
            </div>
          </div>

          {/* 트리플 */}
          <div className="combination-section">
            <h3>트리플 (같은 수 3개)</h3>
            <div className="combination-example">
              <div className="triple-group">
                {renderCard(5, 'silver')}
                {renderCard(5, 'gold')}
                {renderCard(5, 'black')}
              </div>
              <span className="comparison-arrow">&#60;</span>
              <div className="triple-group">
                {renderCard(7, 'silver')}
                {renderCard(7, 'bronze')}
                {renderCard(7, 'black')}
              </div>
            </div>
          </div>

          {/* 스트레이트 */}
          <div className="combination-section">
            <h3>스트레이트 (연속된 수 5개)</h3>
            <div className="combination-example">
              <div className="straight-group">
                {renderCard(1, 'gold')}
                {renderCard(2, 'silver')}
                {renderCard(3, 'bronze')}
                {renderCard(4, 'black')}
                {renderCard(5, 'silver')}
              </div>
            </div>
          </div>

          {/* 플러쉬 */}
          <div className="combination-section">
            <h3>플러쉬 (같은 모양 5개)</h3>
            <div className="combination-example">
              <div className="flush-group">
                {renderCard(1, 'gold')}
                {renderCard(15, 'gold')}
                {renderCard(13, 'gold')}
                {renderCard(6, 'gold')}
                {renderCard(3, 'gold')}
              </div>
            </div>
          </div>

          {/* 풀 하우스 */}
          <div className="combination-section">
            <h3>풀 하우스 (같은 수 3개 + 같은 수 2개)</h3>
            <div className="combination-example">
              <div className="fullhouse-group">
                <div className="triple-part">
                  {renderCard(8, 'silver')}
                  {renderCard(8, 'bronze')}
                  {renderCard(8, 'black')}
                </div>
                <div className="pair-part">
                  {renderCard(3, 'gold')}
                  {renderCard(3, 'bronze')}
                </div>
              </div>
            </div>
          </div>

          {/* 포 카드 */}
          <div className="combination-section">
            <h3>포 카드 (같은 수 4개 + 원하는 타일 1개)</h3>
            <div className="combination-example">
              <div className="fourcard-group">
                <div className="four-part">
                  {renderCard(15, 'gold')}
                  {renderCard(15, 'bronze')}
                  {renderCard(15, 'silver')}
                  {renderCard(15, 'black')}
                </div>
                <div className="kicker-part">
                  {renderCard(10, 'black')}
                </div>
              </div>
            </div>
          </div>

          {/* 스트레이트 플러쉬 */}
          <div className="combination-section">
            <h3>스트레이트 플러쉬 (모양이 같은 연속된 수 5개)</h3>
            <div className="combination-example">
              <div className="straightflush-group">
                {renderCard(5, 'black')}
                {renderCard(6, 'black')}
                {renderCard(7, 'black')}
                {renderCard(8, 'black')}
                {renderCard(9, 'black')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinationGuide; 