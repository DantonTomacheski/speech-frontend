// src/components/RealTimeTranscription.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RecordingStatus, WebSocketMessage, TranscriptionData, ErrorData } from '../types'; // Importa tipos e enum
import MessageBox from './MessageBox';
import TranscriptionDisplay from './TranscriptionDisplay';
import Controls from './Controls';

// --- Constantes ---
// Certifique-se que a porta aqui corresponde à porta do backend (8081 no seu caso)
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8081';
const BUFFER_SIZE = 2048; // Tamanho do buffer de áudio

/**
 * @function RealTimeTranscription
 * @description Componente principal que gerencia a captura de áudio,
 * conexão WebSocket e estado da transcrição em tempo real.
 * @returns {React.ReactElement} O elemento React.
 */
const RealTimeTranscription: React.FC = () => {
  // --- Estados ---
  const [status, setStatus] = useState<RecordingStatus>(RecordingStatus.Inactive);
  const [finalTranscription, setFinalTranscription] = useState<string>('');
  const [interimTranscription, setInterimTranscription] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Refs ---
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputStreamRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // --- Funções de Callback ---

  const showMessage = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  // Função de limpeza de áudio (mantida estável com useCallback e sem dependências externas)
  const cleanupAudio = useCallback(() => {
    console.log("Limpando recursos de áudio...");
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (inputStreamRef.current) {
      inputStreamRef.current.disconnect();
      inputStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      // Verifica o estado antes de fechar para evitar warnings se já estiver fechado
      audioContextRef.current.close().then(() => {
           console.log("AudioContext fechado.");
           audioContextRef.current = null;
      }).catch(console.error);
    } else {
         audioContextRef.current = null; // Garante que a ref seja limpa mesmo se já estava fechado
    }
    isRecordingRef.current = false;
    console.log("Recursos de áudio limpos.");
  }, []); // Sem dependências externas, referência estável

  // Função de fechamento do WebSocket (mantida estável)
  const closeWebSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log("Enviando comando 'stopStreaming' e fechando WebSocket...");
      try {
        socketRef.current.send(JSON.stringify({ command: 'stopStreaming' }));
        socketRef.current.close(1000, "Client initiated stop");
      } catch (error) {
        console.error("Erro ao enviar comando/fechar WebSocket:", error);
      }
    }
    // Limpa a referência APÓS tentar fechar, não importa o estado
    socketRef.current = null;
  }, []); // Sem dependências externas, referência estável

  // Função principal para parar a gravação
  // *** CORREÇÃO: Removido 'status' das dependências ***
  const stopRecording = useCallback(() => {
    // Usa a ref para verificar o estado atual, mais confiável que o estado React durante transições rápidas
    if (!isRecordingRef.current) {
        console.log("Tentativa de parar gravação quando isRecordingRef.current é false.");
        return; // Evita chamadas múltiplas ou em estados inadequados
    }
    console.log("Parando gravação...");
    setStatus(RecordingStatus.Stopping); // Atualiza o estado da UI para indicar parada
    isRecordingRef.current = false; // Atualiza a ref imediatamente

    cleanupAudio();
    closeWebSocket();

    // Atraso para garantir que a UI atualize antes de voltar para Inativo
    // Usamos um timeout para garantir que o estado 'Stopping' seja visível
    // e que as limpezas tenham chance de ocorrer antes de voltar para 'Inactive'.
    const timer = setTimeout(() => {
        // Verifica se ainda estamos parando e se o socket foi limpo
        // para evitar conflito se o usuário clicar em iniciar novamente muito rápido
        if (!isRecordingRef.current && socketRef.current === null) {
             setStatus(RecordingStatus.Inactive);
             console.log("Gravação completamente parada. Estado: Inativo.");
        }
    }, 150);

    // Retorna uma função de limpeza para o caso de o componente ser desmontado
    // ou a função ser chamada novamente antes do timeout completar.
    return () => clearTimeout(timer);

  }, [cleanupAudio, closeWebSocket]); // Depende apenas das funções de limpeza estáveis

  // --- Processamento de Áudio ---
  const handleAudioProcess = useCallback((event: AudioProcessingEvent) => {
    if (!isRecordingRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    const audioData = event.inputBuffer.getChannelData(0);
    // Verifica se o socket ainda está aberto antes de enviar (segurança extra)
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
       socketRef.current.send(audioData.buffer);
    }
  }, []); // Sem dependências externas, estável

  // --- Inicialização do Áudio ---
  const initializeAudio = useCallback(async () => {
    // Adiciona verificação extra do estado do AudioContext
    if (isRecordingRef.current || (audioContextRef.current && audioContextRef.current.state !== 'closed')) {
        console.warn("Tentativa de inicializar áudio quando já ativo ou contexto não fechado.");
        // Se o contexto não estiver fechado, tenta limpar antes de prosseguir
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            cleanupAudio(); // Tenta limpar primeiro
            // Espera um pouco para a limpeza ocorrer antes de tentar novamente (opcional)
            await new Promise(resolve => setTimeout(resolve, 50));
        } else {
             return; // Evita inicialização múltipla se isRecordingRef for true
        }
    }

    setStatus(RecordingStatus.Initializing);
    console.log("Inicializando áudio...");

    try {
      // Cria um NOVO AudioContext a cada inicialização para garantir um estado limpo
      const context = new AudioContext();
      audioContextRef.current = context; // Armazena a referência ao novo contexto

      // Verifica se o contexto precisa ser retomado (interação do usuário pode ser necessária)
      if (context.state === 'suspended') {
        console.log("AudioContext suspenso, tentando retomar...");
        await context.resume();
        console.log("AudioContext retomado.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      inputStreamRef.current = context.createMediaStreamSource(stream);

      // ATENÇÃO: createScriptProcessor é obsoleto! Usar AudioWorklet em produção.
      console.warn("[Deprecation] The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead. (https://bit.ly/audio-worklet)");
      const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processor.onaudioprocess = handleAudioProcess;
      processorRef.current = processor;

      inputStreamRef.current.connect(processor);
      processor.connect(context.destination);

      isRecordingRef.current = true;
      setStatus(RecordingStatus.Recording);
      console.log("Áudio inicializado e gravação iniciada. Sample Rate:", context.sampleRate);
      // IMPORTANTE: Verifique se context.sampleRate corresponde ao `sampleRateHertz` no backend!

    } catch (err) {
      console.error('Erro ao inicializar áudio:', err);
      const error = err as Error;
      showMessage(`Erro ao acessar microfone: ${error.message}. Verifique as permissões.`);
      setStatus(RecordingStatus.Error);
      cleanupAudio(); // Limpa recursos em caso de erro na inicialização
    }
  }, [showMessage, cleanupAudio, handleAudioProcess]); // Depende apenas de callbacks estáveis

  // --- Conexão WebSocket ---
  // Deixamos 'status' aqui pois é lido no onclose.
  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
        console.warn("Tentativa de conectar WebSocket quando já existe uma instância.");
        return;
    }
    setStatus(RecordingStatus.Connecting);
    console.log(`Conectando ao WebSocket em ${WEBSOCKET_URL}...`);

    setFinalTranscription('');
    setInterimTranscription('');

    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket conectado.');
        // Inicia áudio APÓS conexão WS bem-sucedida
        initializeAudio();
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          if ('error' in data) {
            const errorData = data as ErrorData;
            console.error('Erro recebido do servidor:', errorData.error);
            showMessage(`Erro do servidor: ${errorData.error}`);
            stopRecording(); // Para tudo
          }
          else if ('transcript' in data) {
            const transcriptionData = data as TranscriptionData;
            if (transcriptionData.isFinal) {
              setFinalTranscription(prev => prev + transcriptionData.transcript + ' ');
              setInterimTranscription('');
            } else {
              setInterimTranscription(transcriptionData.transcript);
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem do WebSocket:', error);
          showMessage('Erro ao processar resposta do servidor.');
        }
      };

      ws.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        showMessage('Erro na conexão WebSocket. Verifique se o servidor backend está rodando.');
        setStatus(RecordingStatus.Error);
        // Não chama stopRecording aqui diretamente, pois onclose será chamado em seguida
      };

      ws.onclose = (event) => {
        console.log(`WebSocket desconectado: ${event.code} ${event.reason}`);
        // Limpa a referência do socket independentemente do motivo
        socketRef.current = null;
        // Verifica se a desconexão NÃO foi iniciada pelo botão 'Parar' (código 1000)
        // e se o estado atual indica que deveria estar conectado/gravando.
        if (event.code !== 1000 && (status === RecordingStatus.Recording || status === RecordingStatus.Connecting || status === RecordingStatus.Initializing)) {
             setStatus(RecordingStatus.Disconnected);
             showMessage(`Conexão perdida: ${event.reason || 'Verifique o servidor'}`);
             // Chama cleanupAudio diretamente em vez de stopRecording para evitar loops
             cleanupAudio();
             setStatus(RecordingStatus.Inactive); // Volta para inativo após limpeza
        } else if (status !== RecordingStatus.Inactive && status !== RecordingStatus.Stopping) {
             // Se foi uma parada normal (código 1000) ou já estava parando,
             // apenas garante que o estado final seja Inativo se ainda não for.
             setStatus(RecordingStatus.Inactive);
        }
      };

    } catch (error) {
        console.error("Falha ao criar WebSocket:", error);
        showMessage("Não foi possível conectar ao servidor WebSocket.");
        setStatus(RecordingStatus.Error);
        socketRef.current = null;
    }
  }, [initializeAudio, showMessage, stopRecording, status, cleanupAudio]); // Adicionado cleanupAudio

  // --- Efeito de Limpeza ---
  // *** CORREÇÃO: Removido stopRecording das dependências ***
  // Este efeito agora só roda ao montar e desmontar o componente.
  useEffect(() => {
      return () => {
          console.log("Componente desmontando, limpando recursos...");
          // Chama as funções de limpeza diretamente ao desmontar
          cleanupAudio();
          closeWebSocket();
      };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio, closeWebSocket]); // Depende apenas das funções de limpeza estáveis

  // --- Handlers de Botão ---
  const handleStart = () => {
    // Adiciona verificação de status para evitar cliques múltiplos rápidos
    if (status !== RecordingStatus.Inactive && status !== RecordingStatus.Error && status !== RecordingStatus.Disconnected) {
        console.warn("Botão Iniciar clicado, mas o estado atual é:", status);
        return;
    }
    connectWebSocket(); // Inicia o processo
  };

  const handleStop = () => {
    // A verificação principal agora está dentro de stopRecording usando isRecordingRef
    stopRecording(); // Chama a função de parada
  };

  // --- Renderização ---
  return (
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        🎤 Transcrição React em Tempo Real 🎤
      </h1>

      <Controls
        onStart={handleStart}
        onStop={handleStop}
        // A lógica de desabilitar botões pode ser baseada apenas no status agora
        isRecording={status === RecordingStatus.Recording || status === RecordingStatus.Initializing}
        status={status}
      />

      <TranscriptionDisplay
        finalTranscription={finalTranscription}
        interimTranscription={interimTranscription}
      />

      <MessageBox message={errorMessage} onClose={() => setErrorMessage(null)} />
    </div>
  );
};

export default RealTimeTranscription;

