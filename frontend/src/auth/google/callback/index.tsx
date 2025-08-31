import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { JSX } from 'react';
import '../../../screens/LobbyScreen/LobbyScreen.css';

export default function GoogleOAuthCallback(): JSX.Element {
  const navigate = useNavigate();
  const effectRan = useRef(false);

  useEffect(() => {
    // StrictMode에서 두 번 실행되는 것을 방지
    if (effectRan.current === true) {
      return;
    }
    effectRan.current = true;

    console.log('[OAuthCallback] 컴포넌트 실행');

    const urlParams = new URLSearchParams(window.location.search);
    
    if (!urlParams.has('code')) {
      console.log('[OAuthCallback] Authorization code가 없음, 인증 실패');
      navigate('/login');
      return;
    }

    console.log('[OAuthCallback] URL 쿼리 파라미터 파싱 완료:', window.location.search);

    const returnedState = urlParams.get('state');
    const savedState = sessionStorage.getItem('oauth_state');
    const authCode = urlParams.get('code');

    console.log('[OAuthCallback] returnedState:', returnedState);
    console.log('[OAuthCallback] savedState(sessionStorage):', savedState);
    console.log('[OAuthCallback] authCode:', authCode);

    if (returnedState !== savedState) {
      console.warn('[OAuthCallback] state 불일치, 잘못된 접근');
      alert('잘못된 접근입니다');

      // URL을 정리합니다.
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('[OAuthCallback] URL 정리 완료');

      navigate('/login');
      return;
    }

    sessionStorage.removeItem('oauth_state');
    console.log('[OAuthCallback] 세션 저장소의 oauth_state 제거');

    if (authCode) {
      fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode }),
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
          // URL 정리는 로그인 성공 후 여기서 단 한 번만
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[OAuthCallback] URL 정리 완료');
          navigate('/');
        })
        .catch((err) => {
          console.error('서버 로그인 실패:', err);
          alert('로그인에 실패했습니다.');
          // URL 정리는 오류 시에도 단 한 번만
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[OAuthCallback] URL 정리 완료');
          navigate('/login');
        });
    } else {
      console.error('[OAuthCallback] authorization code가 없음');
      alert('로그인에 실패했습니다.');
      // URL 정리도 단 한 번만
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('[OAuthCallback] URL 정리 완료');
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
    </div>
  );
}
