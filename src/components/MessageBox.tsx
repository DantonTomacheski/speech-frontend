import React from 'react';
interface MessageBoxProps {
  message: string | null;
  onClose: () => void;
}

const MessageBox: React.FC<MessageBoxProps> = ({ message, onClose }) => {
  if (!message) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 glassmorphism border border-accent-red bg-primary-dark/90 text-white p-5 z-50 max-w-md transition-all duration-300 animate-fade-in-scale"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent-red/20 text-accent-red">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 pr-8">
          <h3 className="text-lg font-semibold text-accent-red">Erro</h3>
          <div className="mt-1 text-sm text-text-secondary">{message}</div>
        </div>
        
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 inline-flex items-center justify-center rounded-full bg-primary-dark/50 text-text-secondary hover:text-white focus:outline-none transition-colors"
          aria-label="Fechar mensagem de erro"
        >
          <span className="sr-only">Fechar</span>
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent-red/30">
        <div className="h-full bg-accent-red animate-shrink-width"></div>
      </div>
    </div>
  );
};

export default MessageBox;
