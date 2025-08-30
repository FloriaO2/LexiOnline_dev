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
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
