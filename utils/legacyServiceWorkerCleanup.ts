const SERVICE_WORKER_CLEANUP_FLAG = 'growup-service-worker-cleanup-v1';

// 이전 버전에서 Gemini 요청을 중계하던 서비스 워커가 남아 있으면
// 개인 API 키 요청까지 예전 프록시로 보낼 수 있으므로 한 번 정리한다.
function unregisterLegacyServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      if (registrations.length === 0) {
        return;
      }

      await Promise.all(registrations.map((registration) => registration.unregister()));

      if (navigator.serviceWorker.controller && sessionStorage.getItem(SERVICE_WORKER_CLEANUP_FLAG) !== 'done') {
        sessionStorage.setItem(SERVICE_WORKER_CLEANUP_FLAG, 'done');
        window.location.reload();
      }
    } catch (error) {
      console.warn('Failed to unregister legacy service workers:', error);
    }
  });
}

unregisterLegacyServiceWorkers();
