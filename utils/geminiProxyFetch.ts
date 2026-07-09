const GEMINI_API_HOST = 'generativelanguage.googleapis.com';
const SERVICE_WORKER_CLEANUP_FLAG = 'growup-service-worker-cleanup-v1';

function rewriteGeminiUrl(url: string): string {
  try {
    const parsedUrl = new URL(url, window.location.href);

    if (parsedUrl.hostname !== GEMINI_API_HOST) {
      return url;
    }

    return `${window.location.origin}/api-proxy${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return url;
  }
}

function installGeminiProxyFetch() {
  if (typeof window === 'undefined' || !window.fetch) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (input instanceof Request) {
      const rewrittenUrl = rewriteGeminiUrl(input.url);
      const request = rewrittenUrl === input.url ? input : new Request(rewrittenUrl, input);
      return originalFetch(request, init);
    }

    if (input instanceof URL) {
      return originalFetch(rewriteGeminiUrl(input.toString()), init);
    }

    if (typeof input === 'string') {
      return originalFetch(rewriteGeminiUrl(input), init);
    }

    return originalFetch(input, init);
  };
}

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

installGeminiProxyFetch();
unregisterLegacyServiceWorkers();
