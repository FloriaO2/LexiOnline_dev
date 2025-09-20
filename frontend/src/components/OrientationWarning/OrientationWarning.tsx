import React from 'react';
import './OrientationWarning.css';

const OrientationWarning: React.FC = () => {
  return (
    <div className="orientation-warning">
      <div className="orientation-warning-content">
        <div className="orientation-icon">❌</div>
        <h2>지원하지 않는 형식의 화면입니다.</h2>
        <p>가로 화면으로 돌려주세요.</p>
        <div className="rotation-hint">
          <div className="phone-icon">
            <div className="phone-body"></div>
            <div className="phone-screen"></div>
          </div>
          <div className="arrow">→</div>
          <div className="phone-icon rotated">
            <div className="phone-body"></div>
            <div className="phone-screen"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrientationWarning;
