// src/components/Controls.tsx
import React from 'react';
import { RecordingStatus } from '../types'; // Importa o enum de status

/**
 * @interface ControlsProps
 * @description Propriedades para o componente Controls.
 * @property {() => void} onStart - Função chamada ao clicar no botão Iniciar.
 * @property {() => void} onStop - Função chamada ao clicar no botão Parar.
 * @property {boolean} isRecording - Indica se a gravação está ativa (para habilitar/desabilitar botões).
 * @property {RecordingStatus} status - O status atual da gravação/conexão.
 */
interface ControlsProps {
  onStart: () => void;
  onStop: () => void;
  isRecording: boolean;
  status: RecordingStatus;
}

/**
 * @function Controls
 * @description Componente funcional para os botões de controle (Iniciar/Parar) e exibição de status.
 * @param {ControlsProps} props - As propriedades do componente.
 * @returns {React.ReactElement} O elemento React.
 */
const Controls: React.FC<ControlsProps> = ({
  onStart,
  onStop,
  isRecording,
  status,
}) => {
  // Determina se o botão Iniciar deve estar desabilitado
  const isStartDisabled = isRecording || 
    status === RecordingStatus.Connecting || 
    status === RecordingStatus.Initializing || 
    status === RecordingStatus.Stopping;
    
  // Determina se o botão Parar deve estar desabilitado
  const isStopDisabled = !isRecording || 
    status === RecordingStatus.Stopping ||
    status === RecordingStatus.Inactive;

  // Obtém a classe CSS para o indicador de status
  const getStatusClass = () => {
    switch (status) {
      case RecordingStatus.Recording:
        return 'text-green-600 font-medium';
      case RecordingStatus.Connecting:
      case RecordingStatus.Initializing:
        return 'text-blue-600 font-medium animate-pulse';
      case RecordingStatus.Stopping:
        return 'text-orange-600 font-medium';
      case RecordingStatus.Error:
        return 'text-red-600 font-medium';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="mb-6">
      {/* Container para os botões */}
      <div className="flex justify-center space-x-4 mb-4">
        {/* Botão Iniciar Gravação */}
        <button
          id="startButton"
          onClick={onStart}
          disabled={isStartDisabled} // Desabilita com base no estado
          className={`
            py-2 px-6 rounded-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-opacity-75
            transition-all duration-300 ease-in-out shadow-md hover:shadow-lg
            ${isStartDisabled
              ? 'bg-gray-400 cursor-not-allowed' // Estilo desabilitado
              : 'bg-green-500 hover:bg-green-600 focus:ring-green-400 transform hover:-translate-y-0.5' // Estilo habilitado
            }
            ${status === RecordingStatus.Recording ? 'hidden' : ''}
          `}
        >
          Iniciar Gravação
        </button>
        
        {/* Botão Parar Gravação */}
        <button
          id="stopButton"
          onClick={onStop}
          disabled={isStopDisabled} // Desabilita com base no estado
          className={`
            py-2 px-6 rounded-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-opacity-75
            transition-all duration-300 ease-in-out shadow-md hover:shadow-lg
            ${isStopDisabled
              ? 'bg-gray-400 cursor-not-allowed' // Estilo desabilitado
              : 'bg-red-500 hover:bg-red-600 focus:ring-red-400 transform hover:-translate-y-0.5' // Estilo habilitado
            }
            ${!isRecording ? 'hidden' : ''}
          `}
        >
          Parar Gravação
        </button>
      </div>
      
      {/* Exibição do Status */}
      <div id="status" className={`text-center ${getStatusClass()}`}>
        Status: {status} {/* Exibe o status recebido via props */}
        
        {/* Indicador visual de atividade durante estados de transição */}
        {(status === RecordingStatus.Connecting || 
          status === RecordingStatus.Initializing) && (
          <span className="inline-block ml-2">
            <span className="animate-bounce">•</span>
            <span className="animate-bounce delay-75">•</span>
            <span className="animate-bounce delay-150">•</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default Controls;