// src/types.ts

/**
 * @interface TranscriptionData
 * @description Define a estrutura dos dados de transcrição recebidos do WebSocket.
 * @property {string} transcript - O texto da transcrição.
 * @property {boolean} isFinal - Indica se a transcrição é final ou interina.
 */
export interface TranscriptionData {
    transcript: string;
    isFinal: boolean;
  }
  
  /**
   * @interface ErrorData
   * @description Define a estrutura dos dados de erro recebidos do WebSocket.
   * @property {string} error - A mensagem de erro.
   */
  export interface ErrorData {
    error: string;
  }
  
  /**
   * @interface WebSocketMessage
   * @description Define a estrutura geral das mensagens recebidas do WebSocket.
   * Pode ser uma transcrição ou um erro.
   */
  export type WebSocketMessage = TranscriptionData | ErrorData;
  
  /**
   * @enum RecordingStatus
   * @description Enum para representar os diferentes estados da gravação/conexão.
   */
  export enum RecordingStatus {
    Inactive = "Inativo",
    Connecting = "Conectando...",
    Initializing = "Iniciando...",
    Recording = "Gravando...",
    Stopping = "Parando...",
    Error = "Erro",
    Disconnected = "Desconectado",
  }
  
  