
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

type ModalType = 'alert' | 'confirm';

interface ModalOptions {
  title?: string;
  message: ReactNode;
  onConfirm?: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
}

interface ModalContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string, confirmText?: string) => Promise<boolean>;
  showToast: (message: string, duration?: number) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<ModalType>('alert');
  const [options, setOptions] = useState<ModalOptions>({ message: '' });
  const [resolvePromise, setResolvePromise] = useState<((value: any) => void) | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);

  const showAlert = useCallback((message: string, title: string = '알림') => {
    return new Promise<void>((resolve) => {
      setOptions({ message, title, confirmText: '확인' });
      setType('alert');
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const showConfirm = useCallback((message: string, title: string = '확인', confirmText: string = '확인') => {
    return new Promise<boolean>((resolve) => {
      setOptions({ 
        message, 
        title, 
        confirmText, 
        cancelText: '취소' 
      });
      setType('confirm');
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const showToast = useCallback((message: string, duration: number = 2000) => {
      setToastMessage(message);
      setIsToastVisible(true);
      setTimeout(() => {
          setIsToastVisible(false);
          setTimeout(() => setToastMessage(null), 300); // Wait for fade out
      }, duration);
  }, []);

  const handleConfirm = async () => {
    if (options.onConfirm) {
      await options.onConfirm();
    }
    if (resolvePromise) {
      resolvePromise(true);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolvePromise) {
      resolvePromise(false);
    }
    setIsOpen(false);
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}
      
      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-base-100 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-base-300 scale-100 animate-[scaleIn_0.2s_ease-out]">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                 <div className={`p-3 rounded-full shrink-0 ${type === 'confirm' ? 'bg-yellow-100 text-yellow-600' : 'bg-primary/10 text-primary'}`}>
                    {type === 'confirm' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                 </div>
                 <h3 className="text-lg font-bold text-base-content">{options.title}</h3>
              </div>
              <div className="text-base-content-secondary text-sm leading-relaxed whitespace-pre-wrap pl-1">
                {options.message}
              </div>
            </div>
            <div className="bg-base-200/50 px-6 py-4 flex justify-end gap-3 border-t border-base-300/50">
              {type === 'confirm' && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-base-content-secondary hover:bg-base-200 transition-colors"
                >
                  {options.cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-focus shadow-md transition-all hover:shadow-lg active:scale-95"
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
          <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[10000] transition-all duration-300 ease-out ${isToastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-gray-800/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {toastMessage}
              </div>
          </div>
      )}
    </ModalContext.Provider>
  );
};
