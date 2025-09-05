import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LobbyScreen.css';
import logoImage from '../../logo.png';
import { User } from '../../shared/models/User'
import { GameHistory } from '../../shared/models/GameHistory'
import ColyseusService from '../../services/ColyseusService';
import Toast from '../../components/Toast/Toast';

interface LobbyScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ onScreenChange }) => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('access_token'));
  const [user, setUser] = useState<User | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const apiUrl = process.env.REACT_APP_API_URL || 
      (isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
    fetch(`${apiUrl}/api/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Failed to fetch user info:', res.status, text);
          throw new Error('유저 정보 가져오기 실패');
        }
        return res.json();
      })
      .then(data => {
        console.log('User data received:', data);
        setUser(data.user);
        if (data.user.nickname) {
          setNickname(data.user.nickname);
          sessionStorage.setItem('current_nickname', data.user.nickname);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setUser(null);
        setToken(null);
        sessionStorage.removeItem('access_token');
        setIsLoading(false);
      });
  }, [token]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      showToast('닉네임을 입력해주세요.', 'error');
      return;
    }

    setIsConnecting(true);
    try {
      const authToken = sessionStorage.getItem('access_token');
      const room = await ColyseusService.createRoom({ authToken });
      console.log('방 생성 성공:', room.sessionId);
      
      // 닉네임 설정 및 중복 체크
      room.onMessage('nicknameRejected', (message) => {
        console.error('닉네임 설정 거부:', message.reason);
        showToast(`닉네임 설정 실패: ${message.reason}`, 'error');
        setIsConnecting(false);
        ColyseusService.disconnect();
      });

      room.onMessage('nicknameUpdate', () => {
        // 닉네임 설정 성공 시 대기실로 이동
        onScreenChange('waiting');
      });

      room.send('setNickname', { nickname: nickname.trim() });
    } catch (error) {
      console.error('방 생성 실패:', error);
      showToast('방 생성에 실패했습니다. 다시 시도해주세요.', 'error');
      setIsConnecting(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !roomCode.trim()) {
      showToast('닉네임과 방 코드를 모두 입력해주세요.', 'error');
      return;
    }

    setIsConnecting(true);
    try {
      const authToken = sessionStorage.getItem('access_token');
      const room = await ColyseusService.joinRoom(roomCode, { authToken });
      console.log('방 참가 성공:', room.sessionId);
      
      // 닉네임 설정 및 중복 체크
      room.onMessage('nicknameRejected', (message) => {
        console.error('닉네임 설정 거부:', message.reason);
        showToast(`닉네임 설정 실패: 해당 방에 이미 존재하는 닉네임입니다.`, 'error');
        setIsConnecting(false);
        ColyseusService.disconnect();
      });

      room.onMessage('nicknameUpdate', () => {
        // 닉네임 설정 성공 시 대기실로 이동
        onScreenChange('waiting');
      });

      room.send('setNickname', { nickname: nickname.trim() });
    } catch (error) {
      console.error('방 참가 실패:', error);
      showToast('방 참가에 실패했습니다. 방 코드를 확인해주세요.', 'error');
      setIsConnecting(false);
    }
  };

  const handleLogin = async () => {
    const state = Math.random().toString(36).substring(2);
    const nonce = Math.random().toString(36).substring(2);
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_nonce', nonce);

    try {
      // 백엔드에서 OAuth 설정 정보 가져오기
      const isProduction = process.env.NODE_ENV === 'production';
      const apiUrl = process.env.REACT_APP_API_URL || 
        (isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
      
      const configResponse = await fetch(`${apiUrl}/api/auth/config`);
      const config = await configResponse.json();
      
      const clientId = config.googleClientId;
      const redirectUri = config.googleRedirectUri;
      
      // 디버깅을 위한 로그 추가
      console.log('Google OAuth Debug Info:');
      console.log('Client ID:', clientId);
      console.log('Redirect URI:', redirectUri);
      console.log('Full Auth URL:', `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=${encodeURIComponent('profile email')}&state=${encodeURIComponent(state)}&nonce=${encodeURIComponent(nonce)}&prompt=select_account`);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent('profile email')}` +
        `&state=${encodeURIComponent(state)}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&prompt=select_account`;

      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth 설정을 가져오는데 실패했습니다:', error);
      showToast('로그인 설정을 불러오는데 실패했습니다.', 'error');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
    setNickname('');
  };

  // 로딩 중일 때는 로딩 화면만 표시
  if (isLoading) {
    return (
      <div className="lobby-screen">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <div className={`lobby-container ${token ? 'compact' : ''}`}>
        {/* 헤더 섹션 */}
        <div className={`header-section ${token ? 'compact' : ''}`}>
          <div className={`logo-section ${token ? 'compact' : ''}`}>
            <img src={logoImage} alt="LexiOnline Logo" className={`logo-image ${token ? 'compact' : ''}`} />
          </div>
          
          {/* 사용자 정보 또는 로그인 버튼 */}
          {token && user ? (
            <div className={`user-section compact`}>
              <div className={`user-profile compact`}>
                {user.profileImageUrl && (
                  <img src={user.profileImageUrl} alt="profile" className={`profile-image compact`} />
                )}
                <div className={`user-info compact`}>
                  <h3>{user.nickname || '익명'}</h3>
                  <p>rating: {user.rating_mu ? user.rating_mu.toFixed(2) : '0'}</p>
                </div>
              </div>
              <button className={`btn btn-logout compact`} onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          ) : (
            <div className="login-section">
              <div className="login-card">
                <h3>게임을 시작하려면 로그인하세요.</h3>
                <p>Google 계정으로 간편하게 로그인하고 게임을 즐겨보세요!</p>
                <button className="btn btn-google" onClick={handleLogin}>
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google로 로그인
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 게임 섹션 - 로그인 후에만 표시 */}
        {token && (
          <div className="game-section">
            {/* 탭 네비게이션 */}
            <div className={`tab-navigation ${token ? 'compact' : ''}`}>
              <button 
                className={`tab-button ${activeTab === 'create' ? 'active' : ''} ${token ? 'compact' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                <span className={`tab-icon ${token ? 'compact' : ''}`}>🎮</span>
                방 만들기
              </button>
              <button 
                className={`tab-button ${activeTab === 'join' ? 'active' : ''} ${token ? 'compact' : ''}`}
                onClick={() => setActiveTab('join')}
              >
                <span className={`tab-icon ${token ? 'compact' : ''}`}>🚪</span>
                방 참가하기
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div className={`tab-content ${token ? 'compact' : ''}`}>
              {activeTab === 'create' ? (
                <div className="create-room-tab">
                  <div className={`tab-header ${token ? 'compact' : ''}`}>
                    <h3>새로운 게임 방 만들기</h3>
                    <p>친구들과 함께 즐길 새로운 게임 방을 만들어보세요!</p>
                  </div>
                  
                  <div className={`input-section ${token ? 'compact' : ''}`}>
                    <div className={`input-group ${token ? 'compact' : ''}`}>
                      <label htmlFor="nickname">닉네임</label>
                      <input
                        type="text"
                        id="nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임을 입력하세요"
                        className={`input-field ${token ? 'compact' : ''}`}
                      />
                    </div>
                  </div>

                  <button 
                    className={`btn btn-primary btn-large ${token ? 'compact' : ''}`}
                    onClick={handleCreateRoom}
                    disabled={!nickname.trim() || isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <span className="loading-spinner"></span>
                        연결 중...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">🎯</span>
                        방 만들기
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="join-room-tab">
                  <div className={`tab-header ${token ? 'compact' : ''}`}>
                    <h3>기존 방에 참가하기</h3>
                    <p>친구가 만든 방에 참가하여 게임을 즐겨보세요!</p>
                  </div>
                  
                  <div className={`input-section ${token ? 'compact' : ''}`}>
                    <div className={`input-group ${token ? 'compact' : ''}`}>
                      <label htmlFor="join-nickname">닉네임</label>
                      <input
                        type="text"
                        id="join-nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임을 입력하세요"
                        className={`input-field ${token ? 'compact' : ''}`}
                      />
                    </div>
                    
                    <div className={`input-group ${token ? 'compact' : ''}`}>
                      <label htmlFor="roomCode">방 코드</label>
                      <input
                        type="text"
                        id="roomCode"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        placeholder="방 코드를 입력하세요"
                        className={`input-field ${token ? 'compact' : ''}`}
                      />
                    </div>
                  </div>

                  <button 
                    className={`btn btn-primary btn-large ${token ? 'compact' : ''}`}
                    onClick={handleJoinRoom}
                    disabled={!nickname.trim() || !roomCode.trim() || isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <span className="loading-spinner"></span>
                        연결 중...
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">🎲</span>
                        방 참가하기
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 게임 특징 소개 - 로그인하지 않은 경우에만 표시 */}
        {!user && (
          <div className="features-section">
            <h3>게임 특징</h3>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h4>실시간 플레이</h4>
                <p>실시간으로 친구들과 함께 즐기는 카드 게임</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h4>전략적 사고</h4>
                <p>카드 조합을 통한 전략적 게임 플레이</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🏆</div>
                <h4>순위 시스템</h4>
                <p>실력에 따른 레이팅 시스템</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 토스트 알림 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={2000}
        showCloseButton={false}
      />
    </div>
  );
};

export default LobbyScreen;
