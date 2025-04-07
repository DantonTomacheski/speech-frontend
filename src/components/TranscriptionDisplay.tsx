// src/components/TranscriptionDisplay.tsx
import React, { useRef, useEffect } from 'react';

/**
 * @interface TranscriptionDisplayProps
 * @description Propriedades para o componente TranscriptionDisplay.
 * @property {string} finalTranscription - O texto final acumulado da transcrição.
 * @property {string} interimTranscription - O texto interino atual da transcrição.
 */
interface TranscriptionDisplayProps {
  finalTranscription: string;
  interimTranscription: string;
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
}) => {
  // Ref para o container de transcrição para permitir o scroll programático
  const containerRef = useRef<HTMLDivElement>(null);

  // Efeito para rolar para o final sempre que a transcrição final mudar
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [finalTranscription]); // Dependência: executa quando finalTranscription muda

  return (
    <div
      ref={containerRef} // Associa a ref ao elemento div
      className="h-72 overflow-y-auto border border-gray-300 p-4 bg-gray-50 rounded-lg text-lg text-gray-800 leading-relaxed mb-4" // Estilos Tailwind
      aria-live="polite" // Melhora a acessibilidade para leitores de tela
    >
      {/* Exibe a transcrição final */}
      <p>{finalTranscription || 'Aguardando transcrição...'}</p>
      {/* Exibe a transcrição interina com cor diferente */}
      <p className="text-gray-500">{interimTranscription}</p>
    </div>
  );
};

export default TranscriptionDisplay;

