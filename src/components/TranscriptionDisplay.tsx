import React, { useRef, useEffect } from 'react';
import { RecordingStatus } from '../types';
interface TranscriptionDisplayProps {
  finalTranscription: string;
  interimTranscription: string;
  status: RecordingStatus;
  isRecording: boolean;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  finalTranscription,
  interimTranscription,
  status,
  isRecording
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [finalTranscription, interimTranscription]);

  const getStatusMessage = () => {
    if (isRecording) {
      if (status === RecordingStatus.Connecting) {
        return 'Conectando ao servidor...';
      } else if (status === RecordingStatus.Initializing) {
        return 'Inicializando gravação...';
      } else if (status === RecordingStatus.Recording) {
        return finalTranscription 
          ? finalTranscription 
          : 'Gravando... Fale algo para ver a transcrição.';
      }
    }
    
    return finalTranscription || 'Aguardando transcrição...';
  };

  return (
    <div
      ref={containerRef}
      className="w-full max-w-lg h-60 overflow-y-auto glassmorphism p-5 text-base leading-relaxed mb-6 transition-all duration-300"
      aria-live="polite"
    >
      {isRecording && (
        <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-turquoise via-accent-blue to-accent-red opacity-30 animate-gradient-flow"></div>
        </div>
      )}

      <div className="space-y-4">
        {!finalTranscription && !interimTranscription && (
          <div className="flex items-center justify-center h-full text-center text-text-secondary">
            <div>
              {status === RecordingStatus.Recording ? (
                <div className="space-y-3">
                  <p className="text-lg font-light">Suas palavras vão aparecer aqui</p>
                  <div className="inline-block w-3 h-5 bg-accent-turquoise/30 animate-pulse"></div>
                </div>
              ) : status === RecordingStatus.Connecting || status === RecordingStatus.Initializing ? (
                <div>
                  <div className="loading-dots flex space-x-1 justify-center mb-2">
                    <div className="w-2 h-2 bg-accent-blue rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-accent-blue rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-accent-blue rounded-full animate-bounce delay-150"></div>
                  </div>
                  <p>{getStatusMessage()}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-lg font-light">É só falar que a transcrição vai começar</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {finalTranscription && (
          <div className="space-y-2">
            {finalTranscription.split('. ').map((sentence, index) => (
              sentence && <p key={index} className="text-text-primary font-normal">{sentence.trim() + (sentence.endsWith('.') ? '' : '.')}</p>
            ))}
          </div>
        )}
        
        {interimTranscription && (
          <div className="flex">
            <div className="w-1 h-auto bg-accent-turquoise mr-3 rounded opacity-60"></div>
            <p className="text-accent-turquoise font-light animate-pulse">
              {interimTranscription}
              <span className="inline-block w-2 h-4 bg-accent-turquoise/40 ml-1 animate-pulse"></span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionDisplay;