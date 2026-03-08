
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import GrowthLogo from './GrowthLogo';
import { useModal } from '../context/ModalContext';

declare const firebase: any;

const Login = (): React.ReactElement => {
  const { showAlert } = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('로그인을 준비하고 있습니다...');

  useEffect(() => {
    // 혹시라도 Redirect 방식으로 시도했다가 돌아온 경우를 대비한 처리 (하위 호환)
    const checkRedirectResult = async () => {
      const protocol = window.location.protocol;
      if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'chrome-extension:') {
          return;
      }

      try {
        const result = await auth.getRedirectResult();
        if (result.user) {
           setIsLoading(true);
           setLoadingMessage('로그인 성공! 잠시만 기다려주세요.');
        }
      } catch (error: any) {
         console.error("Redirect Login Error", error);
      }
    };

    checkRedirectResult();
  }, []);

  const handleLogin = async () => {
    const protocol = window.location.protocol;
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'chrome-extension:') {
        await showAlert("현재 환경(프로토콜)에서는 로그인이 지원되지 않습니다.\n웹 서버(http/https)에서 실행해주세요.");
        return;
    }

    setIsLoading(true);
    setLoadingMessage('인증 창이 열립니다...');

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // [중요] PWA(iOS Standalone)에서도 Popup 방식을 사용합니다.
    // Redirect 방식은 iOS PWA에서 세션 유실/무한 로딩 등 문제가 빈번하므로
    // 최신 iOS에서 지원하는 인앱 브라우저 오버레이(Popup) 방식이 더 안정적입니다.
    auth.signInWithPopup(provider).catch(async (error: any) => {
        setIsLoading(false);
        console.error("Login Error", error);

        if (error.code === 'auth/popup-blocked') {
             await showAlert("팝업이 차단되었습니다.\n설정 > Safari > '팝업 차단'을 해제해주세요.");
        } else if (error.code === 'auth/operation-not-supported-in-this-environment' ||
                   (error.message && error.message.includes('operation is not supported'))) {
             await showAlert("현재 환경에서는 로그인이 지원되지 않습니다.\n브라우저 설정(쿠키/스토리지)을 확인해주세요.");
        } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
             await showAlert(`로그인에 실패했습니다.\n(${error.message})`);
        }
    });
  };

  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center p-4 transition-colors duration-1000">
      <div className="w-full max-w-md bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-base-300/60 relative overflow-hidden">
        
        <div className="flex flex-col items-center mb-8 min-h-[140px] justify-center">
           <GrowthLogo variant="login" />
        </div>

        <h1 className="text-3xl font-bold text-base-content mb-2 tracking-tight">학급 성장 기록장</h1>
        <p className="text-base-content-secondary mb-8">시작하려면 구글 계정으로 로그인해주세요.</p>
        
        {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
                 <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-sm text-base-content font-bold animate-pulse">
                        {loadingMessage}
                    </span>
                </div>
            </div>
        ) : (
            <button
            onClick={handleLogin}
            className="w-full bg-base-100 text-base-content font-semibold py-3.5 px-4 rounded-lg shadow-md hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75 transition duration-300 ease-in-out flex items-center justify-center space-x-3 border border-base-300 active:scale-[0.98]"
            >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="h-6 w-6" />
            <span>Google 계정으로 로그인</span>
            </button>
        )}
      </div>
    </div>
  );
};

export default Login;
