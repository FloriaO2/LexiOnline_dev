import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import LobbyScreen from './screens/LobbyScreen/LobbyScreen';
import WaitingScreen from './screens/WaitingScreen/WaitingScreen';
import GameScreen from './components/GameScreen/GameScreen';
import ResultScreen from './screens/ResultScreen/ResultScreen';
import FinalResultScreen from './screens/FinalResultScreen/FinalResultScreen';
import ColyseusService from './services/ColyseusService';
import GoogleOAuthCallback from './auth/google/callback';
import OrientationWarning from './components/OrientationWarning/OrientationWarning';

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('lobby');
  const [playerCount, setPlayerCount] = useState<number>(5); // 기본값 5명
  const [roundResult, setRoundResult] = useState<any>(null); // 라운드 결과 저장
  const [finalResult, setFinalResult] = useState<any>(null); // 최종 결과 저장

  // URL 경로에 따라 화면 상태 설정
  useEffect(() => {
    const path = location.pathname;
    
    // 저장된 방 정보 확인
    const savedRoomInfo = sessionStorage.getItem('room_info');
    
    if (path === '/waiting') {
      setCurrentScreen('waiting');
    } else if (path === '/game') {
      setCurrentScreen('game');
    } else if (path === '/result') {
      setCurrentScreen('result');
    } else if (path === '/final-result') {
      setCurrentScreen('finalResult');
    } else if (savedRoomInfo && path === '/') {
      // 저장된 방 정보가 있고 루트 경로인 경우 대기실로 이동
      console.log('저장된 방 정보 발견. 대기실로 이동합니다.');
      setCurrentScreen('waiting');
      navigate('/waiting');
    } else {
      // 저장된 방 정보가 없거나 다른 경로인 경우 로비로 이동
      if (savedRoomInfo && path !== '/') {
        console.log('저장된 방 정보가 있지만 다른 경로입니다. 방 정보를 삭제합니다.');
        sessionStorage.removeItem('room_info');
      }
      setCurrentScreen('lobby');
    }

    const room = ColyseusService.getRoom();
    if (room) {
      room.onMessage('gameReset', (message) => {
        console.log('App.tsx: 게임 상태 초기화 수신:', message);
        // 세션 스토리지 정리
        sessionStorage.removeItem('room_info');
        // 로비 화면으로 이동
        handleScreenChange('lobby');
      });
    }

  }, [location.pathname, navigate]);

  const handleScreenChange = (screen: ScreenType, result?: any) => {
    setCurrentScreen(screen);
    if (screen === 'result') {
      setRoundResult(result);
    } else if (screen === 'finalResult') {
      setFinalResult(result);
    }
    // 화면 변경 시 URL도 업데이트
    switch (screen) {
      case 'waiting':
        navigate('/waiting');
        break;
      case 'game':
        navigate('/game');
        break;
      case 'result':
        navigate('/result');
        break;
      case 'finalResult':
        navigate('/final-result');
        break;
      default:
        navigate('/');
        break;
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'lobby':
        return <LobbyScreen onScreenChange={handleScreenChange} />;
      case 'waiting':
        return <WaitingScreen onScreenChange={handleScreenChange} playerCount={playerCount} setPlayerCount={setPlayerCount} />;
      case 'game':
        return <GameScreen onScreenChange={handleScreenChange} playerCount={playerCount} />;
      case 'result':
        return <ResultScreen onScreenChange={handleScreenChange} playerCount={playerCount} roundResult={roundResult} />;
      case 'finalResult':
        return <FinalResultScreen onScreenChange={handleScreenChange} finalScores={finalResult} />;
      default:
        return <LobbyScreen onScreenChange={handleScreenChange} />;
    }
  };

  return renderScreen();
}

function App() {
  const [isPortrait, setIsPortrait] = useState(false);

  // 화면 방향 감지
  useEffect(() => {
    const checkOrientation = () => {
      const isPortraitMode = window.innerHeight > window.innerWidth;
      setIsPortrait(isPortraitMode);
    };

    // 초기 체크
    checkOrientation();

    // 화면 크기 변경 및 회전 감지
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      // orientationchange 이벤트 후 약간의 지연을 두고 체크
      setTimeout(checkOrientation, 100);
    });

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // 모바일에서 브라우저 UI 숨김 처리
  useEffect(() => {
    const handleMobileViewport = () => {
      // 모바일 기기 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      
      if (isMobile || isSmallScreen) {
        // 뷰포트 높이 동적 조정을 위한 CSS 변수 설정
        const updateViewportHeight = () => {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        // 초기 설정
        updateViewportHeight();
        
        // 화면 크기 변경 시 업데이트 (브라우저 UI 숨김/표시 시)
        window.addEventListener('resize', updateViewportHeight);
        window.addEventListener('orientationchange', () => {
          setTimeout(updateViewportHeight, 100);
        });
        
        // 스크롤 시 브라우저 UI 숨김 유도 (iOS Safari 등)
        let ticking = false;
        const handleScroll = () => {
          if (!ticking) {
            requestAnimationFrame(() => {
              // 최상단으로 스크롤하여 주소창 숨김 유도
              if (window.scrollY > 0) {
                window.scrollTo(0, 1);
                setTimeout(() => window.scrollTo(0, 0), 0);
              }
              ticking = false;
            });
            ticking = true;
          }
        };
        
        // 터치 이벤트로 브라우저 UI 숨김 유도
        document.addEventListener('touchstart', handleScroll, { passive: true });
        
        // 정리 함수
        return () => {
          window.removeEventListener('resize', updateViewportHeight);
          window.removeEventListener('orientationchange', updateViewportHeight);
          document.removeEventListener('touchstart', handleScroll);
        };
      }
    };
    
    handleMobileViewport();
  }, []);

  return (
    <Router>
      <div className="App">
        {isPortrait && <OrientationWarning />}
        <Routes>
          <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
