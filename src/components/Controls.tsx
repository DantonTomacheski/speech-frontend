import React from 'react';
import { RecordingStatus } from '../types';
interface ControlsProps {
  onStart: () => void;
  onStop: () => void;
  isRecording: boolean;
  status: RecordingStatus;
}

const Controls: React.FC<ControlsProps> = ({
  onStart,
  onStop,
  isRecording,
  status,
}) => {
  const isStartDisabled = isRecording || 
    status === RecordingStatus.Connecting || 
    status === RecordingStatus.Initializing || 
    status === RecordingStatus.Stopping;
    
  const isStopDisabled = !isRecording || 
    status === RecordingStatus.Stopping ||
    status === RecordingStatus.Inactive;

  const getStatusClass = () => {
    switch (status) {
      case RecordingStatus.Recording:
        return 'text-indigo-700 font-medium';
      case RecordingStatus.Connecting:
      case RecordingStatus.Initializing:
        return 'text-blue-700 font-medium';
      case RecordingStatus.Stopping:
        return 'text-amber-700 font-medium';
      case RecordingStatus.Error:
        return 'text-red-700 font-medium';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="mb-8">
      <div className="flex justify-center space-x-6 mb-5">
        <button
          id="startButton"
          onClick={onStart}
          disabled={isStartDisabled}
          className={`
            py-3 px-8 rounded-full font-medium text-sm sm:text-base focus:outline-none
            transition-all duration-300 ease-in-out flex items-center justify-center min-w-[140px]
            glassmorphism
            ${isStartDisabled
              ? 'text-gray-500 cursor-not-allowed opacity-50' 
              : 'text-accent-turquoise hover:shadow-glow-turquoise' 
            }
            ${status === RecordingStatus.Recording ? 'hidden' : ''}
          `}
          aria-label="Iniciar gravação de áudio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          Iniciar
        </button>
        
        <button
          id="stopButton"
          onClick={onStop}
          disabled={isStopDisabled}
          className={`
            py-3 px-8 rounded-full font-medium text-sm sm:text-base focus:outline-none
            transition-all duration-300 ease-in-out flex items-center justify-center min-w-[140px]
            ${isStopDisabled
              ? 'text-gray-500 cursor-not-allowed opacity-50' 
              : 'text-accent-red border border-accent-red hover:bg-accent-red hover:text-white hover:shadow-glow-red' 
            }
            ${!isRecording ? 'hidden' : ''}
          `}
          aria-label="Parar gravação de áudio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          Parar
        </button>
      </div>
      
      {isRecording && (
        <div className="flex justify-center space-x-4">
          <button 
            className="p-2 rounded-full bg-gray-800 text-text-secondary hover:text-accent-turquoise transition-colors"
            aria-label="Save recording"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          
          <button 
            className="p-2 rounded-full bg-gray-800 text-text-secondary hover:text-accent-red transition-colors"
            aria-label="Delete recording"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Controls;