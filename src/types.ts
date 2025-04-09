export interface TranscriptionData {
    transcript: string;
    isFinal: boolean;
  }
  
  export interface ErrorData {
    error: string;
  }
  
  export type WebSocketMessage = TranscriptionData | ErrorData;
  
  export enum RecordingStatus {
    Inactive = "Inativo",
    Connecting = "Conectando...",
    Initializing = "Iniciando...",
    Recording = "Gravando...",
    Stopping = "Parando...",
    Error = "Erro",
    Disconnected = "Desconectado",
  }
  
  