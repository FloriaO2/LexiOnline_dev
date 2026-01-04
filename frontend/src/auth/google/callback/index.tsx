import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JSX } from 'react';
import '../../../screens/LobbyScreen/LobbyScreen.css';
import '../../../components/Toast/Toast.css';
import Toast from '../../../components/Toast/Toast';

export default function GoogleOAuthCallback(): JSX.Element {
  const navigate = useNavigate();
  const effectRan = useRef(false);
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
    // StrictMode에서 두 번 실행되는 것을 방지
    if (effectRan.current === true) {
      return;
    }
    effectRan.current = true;

    console.log('[OAuthCallback] 컴포넌트 실행');

    if (!window.location.hash) {
      console.log('[OAuthCallback] URL 해시가 없음, 인증 실패');
      navigate('/login');
      return;
    }

    const params = new URLSearchParams(window.location.hash.substring(1));

    console.log('[OAuthCallback] URL 해시 파싱 완료:', window.location.hash);

    const returnedState = params.get('state');
    const savedState = sessionStorage.getItem('oauth_state');

    console.log('[OAuthCallback] returnedState:', returnedState);
    console.log('[OAuthCallback] savedState(sessionStorage):', savedState);

    if (returnedState !== savedState) {
      console.warn('[OAuthCallback] state 불일치, 잘못된 접근');
      showToast('잘못된 접근입니다', 'error');

      // 해시는 여기서도 제거해줍니다.
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      console.log('[OAuthCallback] URL 해시 제거 완료');

      navigate('/login');
      return;
    }

    sessionStorage.removeItem('oauth_state');
    console.log('[OAuthCallback] 세션 저장소의 oauth_state 제거');

    const idToken = params.get('id_token');
    console.log('[OAuthCallback] id_token:', idToken);

    if (idToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      const apiUrl = process.env.REACT_APP_API_URL || 
        //(isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
        (isProduction ? 'https://lexionlinedev-production.up.railway.app' : 'http://localhost:2567');
      fetch(`${apiUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errorMsg = await res.text();
            throw new Error(errorMsg || '로그인 실패');
          }
          return res.json();
        })
        .then((data) => {
          // 로그인 성공 처리
          sessionStorage.setItem('access_token', data.token);
          // 해시 제거는 로그인 성공 후 여기서 단 한 번만
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          console.log('[OAuthCallback] URL 해시 제거 완료');
          navigate('/');
        })
        .catch((err) => {
          console.error('서버 로그인 실패:', err);
          showToast('로그인에 실패했습니다.', 'error');
          // 해시 제거는 오류 시에도 단 한 번만
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          console.log('[OAuthCallback] URL 해시 제거 완료');
          navigate('/login');
        });
    } else {
      console.error('[OAuthCallback] id_token이 없음');
      showToast('로그인에 실패했습니다.', 'error');
      // 해시 제거도 단 한 번만
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      console.log('[OAuthCallback] URL 해시 제거 완료');
      navigate('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lobby-screen">
      <div className="loading-container">
        <div className="loading-spinner-large"></div>
        <p style={{ 
          margin: 0, 
          opacity: 0.8, 
          fontSize: '1.2vw', 
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          fontWeight: '400'
        }}>
          인증 처리 중...
        </p>
      </div>
      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={closeToast} 
      />
    </div>
  );
}
