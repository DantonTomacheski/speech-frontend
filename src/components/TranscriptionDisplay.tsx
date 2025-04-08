// src/components/TranscriptionDisplay.tsx
import React, { useRef, useEffect } from 'react';
import { RecordingStatus } from '../types'; // Importa o enum de status

/**
 * @interface TranscriptionDisplayProps
 * @description Propriedades para o componente TranscriptionDisplay.
 * @property {string} finalTranscription - O texto final acumulado da transcrição.
 * @property {string} interimTranscription - O texto interino atual da transcrição.
 * @property {RecordingStatus} status - O status atual da gravação
 * @property {boolean} isRecording - Indica se a gravação está ativa
 */
interface TranscriptionDisplayProps {
  finalTranscription: string;
  interimTranscription: string;
  status: RecordingStatus;
  isRecording: boolean;
}

/**
 * @function TranscriptionDisplay
 * @description Componente funcional para exibir a transcrição final e interina.
 * Inclui auto-scroll para o final quando novo texto final é adicionado.
 * @param {TranscriptionDisplayProps} props - As propriedades do componente.
 * @returns {React.ReactElement} O elemento React.
 */
const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  finalTranscription,
  interimTranscription,
  status,
  isRecording
}) => {
  // Ref para o container de transcrição para permitir o scroll programático
  const containerRef = useRef<HTMLDivElement>(null);

  // Efeito para rolar para o final sempre que a transcrição final mudar
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [finalTranscription, interimTranscription]); // Dependência: executa quando finalTranscription ou interimTranscription muda

  // Determina a mensagem a ser exibida com base no status atual
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
      ref={containerRef} // Associa a ref ao elemento div
      className={`
        h-72 overflow-y-auto border border-gray-300 p-4 rounded-lg text-lg text-gray-800 leading-relaxed mb-4
        ${status === RecordingStatus.Recording ? 'bg-green-50' : 'bg-gray-50'}
      `} // Muda a cor de fundo quando está gravando
      aria-live="polite" // Melhora a acessibilidade para leitores de tela
    >
      {/* Exibe a mensagem apropriada com base no status */}
      <p>{getStatusMessage()}</p>
      
      {/* Exibe a transcrição interina com cor diferente */}
      {interimTranscription && (
        <p className="text-gray-500">{interimTranscription}</p>
      )}
      
      {/* Indicador visual de gravação ativa */}
      {status === RecordingStatus.Recording && (
        <div className="fixed bottom-4 left-4 flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-red-500 font-medium">Gravando</span>
        </div>
      )}
    </div>
  );
};

export default TranscriptionDisplay;