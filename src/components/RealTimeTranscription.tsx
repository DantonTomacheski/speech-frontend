import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RecordingStatus, WebSocketMessage, TranscriptionData, ErrorData } from '../types';
import MessageBox from './MessageBox';
import TranscriptionDisplay from './TranscriptionDisplay';
import Controls from './Controls';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8081';
const BUFFER_SIZE = 2048;
const TARGET_SAMPLE_RATE = 48000;

console.log(`[Config] Frontend configured. WebSocket URL: ${WEBSOCKET_URL}, Target Sample Rate: ${TARGET_SAMPLE_RATE} Hz, Buffer Size: ${BUFFER_SIZE}`);

const RealTimeTranscription: React.FC = () => {
    const [status, setStatus] = useState<RecordingStatus>(RecordingStatus.Inactive);
    const [finalTranscription, setFinalTranscription] = useState<string>('');
    const [interimTranscription, setInterimTranscription] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);

    const socketRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const inputStreamRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const isCleanupScheduledRef = useRef<boolean>(false);
    const mountIdRef = useRef<number>(0);
    const mountTimestampRef = useRef<number>(0);
    const isStrictModeUnmountRef = useRef<boolean>(false);

    const showMessage = useCallback((message: string) => {
        console.log(`[UI] Displaying message: "${message}"`);
        setErrorMessage(message);
    }, []);

    const getWebSocketStateName = useCallback((state: number | undefined): string => {
        if (state === undefined) return 'N/A';
        switch (state) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }, []);

    const closeWebSocket = useCallback((currentMountId: number, reasonSuffix: string = "") => {
        const reason = `Client stopping transcription ${reasonSuffix}`.trim();
        console.log(`[WebSocket Close] Mount #${currentMountId} - closeWebSocket called. Reason: ${reason}`);

        if (!socketRef.current) {
            console.log(`[WebSocket Close] Mount #${currentMountId} - No active WebSocket connection found.`);
            return;
        }

        const ws = socketRef.current;
        const currentState = ws.readyState;
        console.log(`[WebSocket Close] Mount #${currentMountId} - Attempting to close WebSocket. Current state: ${currentState} (${getWebSocketStateName(currentState)})`);

        if (currentState === WebSocket.CLOSING || currentState === WebSocket.CLOSED) {
            console.log(`[WebSocket Close] Mount #${currentMountId} - WebSocket already closing or closed.`);
            if (socketRef.current === ws) {
                 socketRef.current = null;
            }
            return;
        }

        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = () => {
             console.log(`[WebSocket Close] Mount #${currentMountId} - Inner onclose for explicit close (Code: ${ws.readyState}). Socket ref is now null.`);
             if (socketRef.current === ws) {
                  socketRef.current = null;
             }
        };

        const initiateClose = () => {
             if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
                console.log(`[WebSocket Close] Mount #${currentMountId} - Calling ws.close(1000, "${reason}")`);
                try {
                    ws.close(1000, reason);
                } catch (closeError) {
                    console.error(`[WebSocket Close] Mount #${currentMountId} - Error calling ws.close():`, closeError);
                }
             } else {
                 console.log(`[WebSocket Close] Mount #${currentMountId} - Socket state changed before explicit close: ${getWebSocketStateName(ws.readyState)}`);
             }
             if (socketRef.current === ws) {
                socketRef.current = null;
             }
        };

        if (currentState === WebSocket.OPEN) {
            console.log(`[WebSocket Close] Mount #${currentMountId} - Sending 'stopStreaming' command.`);
            try {
                ws.send(JSON.stringify({ command: 'stopStreaming' }));
                setTimeout(initiateClose, 50);
            } catch (sendError) {
                console.error(`[WebSocket Close] Mount #${currentMountId} - Error sending 'stopStreaming', closing immediately:`, sendError);
                initiateClose();
            }
        } else {
            console.log(`[WebSocket Close] Mount #${currentMountId} - Socket not OPEN, closing directly.`);
            initiateClose();
        }

    }, [getWebSocketStateName]);

    const cleanupAudio = useCallback((currentMountId: number) => {
        console.log(`[Audio Cleanup] Mount #${currentMountId} - Cleaning up audio resources...`);
        let cleaned = false;

        if (mediaStreamRef.current) {
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Stopping media stream tracks.`);
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
            cleaned = true;
        }

        if (processorRef.current) {
            const processor = processorRef.current;
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Detaching onaudioprocess and disconnecting script processor node.`);
            processor.onaudioprocess = null;
            try {
                 processor.disconnect();
            } catch (e) {
                 console.warn(`[Audio Cleanup] Mount #${currentMountId} - Error disconnecting processor (might be harmless):`, e);
            }
            if(processorRef.current === processor) {
                 processorRef.current = null;
            }
            cleaned = true;
        }

        if (inputStreamRef.current) {
             const inputStream = inputStreamRef.current;
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Disconnecting input stream node.`);
             try {
                 inputStream.disconnect();
            } catch (e) {
                 console.warn(`[Audio Cleanup] Mount #${currentMountId} - Error disconnecting input stream (might be harmless):`, e);
            }
             if(inputStreamRef.current === inputStream) {
                  inputStreamRef.current = null;
             }
            cleaned = true;
        }

        if (audioContextRef.current) {
            const context = audioContextRef.current;
            const currentState = context.state;
            console.log(`[Audio Cleanup] Mount #${currentMountId} - AudioContext found (state: ${currentState}).`);
            if (currentState !== 'closed') {
                console.log(`[Audio Cleanup] Mount #${currentMountId} - Attempting to close AudioContext.`);
                cleaned = true;
                context.close().then(() => {
                    console.log(`[Audio Cleanup] Mount #${currentMountId} - AudioContext closed successfully.`);
                }).catch(err => {
                    console.error(`[Audio Cleanup] Mount #${currentMountId} - Error closing AudioContext:`, err);
                }).finally(() => {
                    if (audioContextRef.current === context) {
                        audioContextRef.current = null;
                    }
                });
            } else {
                 console.log(`[Audio Cleanup] Mount #${currentMountId} - AudioContext was already closed.`);
                 if (audioContextRef.current === context) {
                      audioContextRef.current = null;
                 }
            }
        }

        if (isRecordingRef.current) {
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Setting internal recording state to false.`);
            isRecordingRef.current = false;
        }
        setIsRecording(prev => {
            if (prev) {
                console.log(`[Audio Cleanup] Mount #${currentMountId} - Setting UI recording state to false.`);
                return false;
            }
            return prev;
        });

        if (cleaned) {
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Audio resources cleanup finished.`);
        } else {
            console.log(`[Audio Cleanup] Mount #${currentMountId} - No active audio resources found to clean up.`);
        }
    }, []);

    const cleanupResources = useCallback((currentMountId: number, reasonSuffix: string = "") => {
        console.log(`[Cleanup] Mount #${currentMountId} - Initiating resource cleanup. Reason suffix: "${reasonSuffix}"`);
        if (isCleanupScheduledRef.current) {
             console.log(`[Cleanup] Mount #${currentMountId} - Cleanup already scheduled or running, skipping.`);
             return;
        }
        isCleanupScheduledRef.current = true;
        console.log(`[Cleanup] Mount #${currentMountId} - Cleanup lock acquired.`);

        cleanupAudio(currentMountId);
        closeWebSocket(currentMountId, reasonSuffix);

        isRecordingRef.current = false;
        setIsRecording(false);

        setStatus(prevStatus => {
            if (prevStatus !== RecordingStatus.Error && prevStatus !== RecordingStatus.Inactive) {
                console.log(`[Cleanup] Mount #${currentMountId} - Setting status to Inactive.`);
                return RecordingStatus.Inactive;
            }
            return prevStatus;
        });

        console.log(`[Cleanup] Mount #${currentMountId} - Resource cleanup process complete.`);
        setTimeout(() => {
            console.log(`[Cleanup] Mount #${currentMountId} - Releasing cleanup lock.`);
            isCleanupScheduledRef.current = false;
        }, 100);

    }, [cleanupAudio, closeWebSocket]);

    const stopRecording = useCallback((currentMountId: number) => {
        console.log(`[Action] Mount #${currentMountId} - Stop recording requested.`);

        if (!isRecordingRef.current) {
            console.warn(`[Action] Mount #${currentMountId} - Stop requested, but internal state indicates not recording. Running cleanup just in case.`);
             cleanupResources(currentMountId, "(stop requested when not recording)");
            return;
        }

        console.log(`[Action] Mount #${currentMountId} - Proceeding with stopping recording... Setting status to STOPPING.`);
        setStatus(RecordingStatus.Stopping);
        isRecordingRef.current = false;
        setIsRecording(false);

        cleanupResources(currentMountId, "(stop requested)");

        console.log(`[Action] Mount #${currentMountId} - Stop recording process finished initiating cleanup.`);

    }, [cleanupResources]);

    const audioPacketCounter = useRef(0);
    const lastLogTime = useRef(Date.now());

    const handleAudioProcess = useCallback((event: AudioProcessingEvent) => {
        const currentMountId = mountIdRef.current;

        if (!isRecordingRef.current) {
            if (Date.now() - lastLogTime.current > 5000) {
                 console.warn(`[Audio Processing] Mount #${currentMountId} - Skipping audio processing - isRecordingRef is false.`);
                 lastLogTime.current = Date.now();
            }
            return;
        }

        const ws = socketRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
             if (Date.now() - lastLogTime.current > 2000) {
                 console.warn(`[Audio Processing] Mount #${currentMountId} - Skipping: WebSocket not open. State: ${ws ? getWebSocketStateName(ws.readyState) : "No socket"}`);
                 lastLogTime.current = Date.now();
             }
             if (isRecordingRef.current && (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
                 console.error(`[Audio Processing] Mount #${currentMountId} - WebSocket closed/closing unexpectedly while recording! Forcing stop.`);
                 stopRecording(currentMountId);
             }
            return;
        }

        audioPacketCounter.current++;
        const audioData = event.inputBuffer.getChannelData(0);
        
        const bufferLength = audioData.length;
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
            sumSquares += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        
        const scaledVolume = Math.min(100, Math.max(20, rms * 700));
        
        setAudioLevels(prev => {
            const newLevels = [...prev];
            const indexToUpdate = Math.floor(Math.random() * 5);
            newLevels[indexToUpdate] = scaledVolume;
            return newLevels;
        });

        try {
            const bufferToSend = audioData.buffer;
            ws.send(bufferToSend);
            if (audioPacketCounter.current % 200 === 0) {
            }
        } catch (sendError) {
            console.error(`[WebSocket] Mount #${currentMountId} - Error sending audio data:`, sendError);
            stopRecording(currentMountId);
        }
    }, [getWebSocketStateName, stopRecording]);

    interface ExtendedWindow extends Window {
        webkitAudioContext?: typeof AudioContext;
    }

    const initializeAudio = useCallback(async (currentMountId: number) => {
        console.log(`[Audio Init] Mount #${currentMountId} - Initializing audio...`);

        if (currentMountId !== mountIdRef.current) {
             console.warn(`[Audio Init] Mount #${currentMountId} - Aborting: No longer the active mount (current is #${mountIdRef.current}).`);
             return;
        }
        if (isRecordingRef.current) {
            console.warn(`[Audio Init] Mount #${currentMountId} - Already recording (ref check). Aborting.`);
            return;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            console.warn(`[Audio Init] Mount #${currentMountId} - AudioContext exists and not closed. Cleaning up first.`);
            cleanupAudio(currentMountId);
            await new Promise(resolve => setTimeout(resolve, 100));
             if (currentMountId !== mountIdRef.current) {
                 console.warn(`[Audio Init] Mount #${currentMountId} - Aborting after cleanup delay: No longer the active mount.`);
                 return;
             }
        }

        setStatus(RecordingStatus.Initializing);

        try {
            console.log(`[Audio Init] Mount #${currentMountId} - Requesting AudioContext with sample rate: ${TARGET_SAMPLE_RATE} Hz`);
            const contextOptions: AudioContextOptions = { sampleRate: TARGET_SAMPLE_RATE };
            const AudioContext = window.AudioContext || (window as ExtendedWindow).webkitAudioContext;
            if (!AudioContext) throw new Error("Browser does not support Web Audio API.");

            const context = new AudioContext(contextOptions);
             if (currentMountId !== mountIdRef.current) {
                 console.warn(`[Audio Init] Mount #${currentMountId} - Aborting after context creation: No longer the active mount. Closing context.`);
                 context.close().catch(e => console.error("Error closing obsolete context:", e));
                 return;
             }
            audioContextRef.current = context;

            console.log(`[Audio Init] Mount #${currentMountId} - Actual AudioContext sample rate: ${context.sampleRate} Hz.`);
            if (context.sampleRate !== TARGET_SAMPLE_RATE) {
                console.warn(`[Audio Init] Mount #${currentMountId} - WARNING: Sample rate mismatch! Browser: ${context.sampleRate}, Target: ${TARGET_SAMPLE_RATE}. Ensure backend matches browser rate.`);
            }

            if (context.state === 'suspended') {
                console.log(`[Audio Init] Mount #${currentMountId} - AudioContext suspended, attempting resume...`);
                await context.resume();
                 if (currentMountId !== mountIdRef.current) {
                     console.warn(`[Audio Init] Mount #${currentMountId} - Aborting after context resume: No longer the active mount.`);
                     cleanupAudio(currentMountId);
                     return;
                 }
                console.log(`[Audio Init] Mount #${currentMountId} - AudioContext resumed. State: ${context.state}`);
            }

            if (context.state !== 'running') throw new Error(`AudioContext is not running. State: ${context.state}`);

            console.log(`[Audio Init] Mount #${currentMountId} - Requesting microphone access...`);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {}, video: false });
             if (currentMountId !== mountIdRef.current) {
                 console.warn(`[Audio Init] Mount #${currentMountId} - Aborting after getUserMedia: No longer the active mount. Stopping tracks.`);
                 stream.getTracks().forEach(track => track.stop());
                 cleanupAudio(currentMountId);
                 return;
             }
            mediaStreamRef.current = stream;
            console.log(`[Audio Init] Mount #${currentMountId} - Microphone access granted.`);

            inputStreamRef.current = context.createMediaStreamSource(stream);
                        const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
            processor.onaudioprocess = handleAudioProcess;
            processorRef.current = processor;

            inputStreamRef.current.connect(processor);
            processor.connect(context.destination);
            console.log(`[Audio Init] Mount #${currentMountId} - Audio nodes connected.`);

             if (currentMountId !== mountIdRef.current) {
                 console.warn(`[Audio Init] Mount #${currentMountId} - Aborting before setting final state: No longer the active mount. Cleaning up.`);
                 cleanupAudio(currentMountId);
                 return;
             }
            console.log(`[Audio Init] Mount #${currentMountId} - Initialization complete. Setting recording state.`);
            isRecordingRef.current = true;
            setIsRecording(true);
            setStatus(RecordingStatus.Recording);

        } catch (err) {
            console.error(`[Audio Init] Mount #${currentMountId} - Error initializing audio:`, err);
            const error = err as Error;
            let userMessage = `Error initializing audio: ${error.message || 'Unknown error'}.`;
              if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                userMessage = 'Microphone access denied. Please grant permission in your browser settings.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                userMessage = 'No microphone found. Please ensure a microphone is connected and enabled.';
            } else if (error.name === 'NotSupportedError') {
                userMessage = `Audio configuration not supported (e.g., requested sample rate ${TARGET_SAMPLE_RATE}Hz). Try a different rate or browser.`;
            } else if (error.message.includes("sampleRate")) {
                userMessage = `Could not set requested sample rate (${TARGET_SAMPLE_RATE}Hz). ${error.message}`;
            }

            showMessage(userMessage);
            setStatus(RecordingStatus.Error);
            isRecordingRef.current = false;
            setIsRecording(false);
            cleanupAudio(currentMountId);
        }
    }, [showMessage, cleanupAudio, handleAudioProcess]);

    const connectWebSocket = useCallback((currentMountId: number) => {
        console.log(`[WebSocket Connect] Mount #${currentMountId} - connectWebSocket called.`);

         if (currentMountId !== mountIdRef.current) {
             console.warn(`[WebSocket Connect] Mount #${currentMountId} - Aborting: No longer the active mount (current is #${mountIdRef.current}).`);
             return;
         }

        if (socketRef.current) {
            console.warn(`[WebSocket Connect] Mount #${currentMountId} - WebSocket already exists (State: ${getWebSocketStateName(socketRef.current.readyState)}). Cleaning up old socket first.`);
            closeWebSocket(currentMountId, "(superseded)");
        }

        setStatus(RecordingStatus.Connecting);
        console.log(`[WebSocket Connect] Mount #${currentMountId} - Attempting to connect to ${WEBSOCKET_URL}...`);
        setFinalTranscription('');
        setInterimTranscription('');

        try {
            const ws = new WebSocket(WEBSOCKET_URL);
            (ws as any)._mountId = currentMountId;
            socketRef.current = ws;

            ws.onopen = () => {
                const wsMountId = (ws as any)._mountId;
                console.log(`[WebSocket Connect] Mount #${wsMountId} - ðŸŸ¢ Connection opened.`);

                 if (wsMountId !== mountIdRef.current) {
                     console.warn(`[WebSocket Connect] Mount #${wsMountId} - WS opened, but no longer the active mount (current is #${mountIdRef.current}). Closing connection.`);
                     if (socketRef.current === ws) {
                         closeWebSocket(wsMountId, "(opened on obsolete mount)");
                     } else {
                          ws.close(1000, "Opened on obsolete mount");
                     }
                     return;
                 }
                 console.log(`[WebSocket Connect] Mount #${wsMountId} - Socket open, proceeding to initialize audio.`);
                initializeAudio(wsMountId);
            };

            ws.onmessage = (event) => {
                 const wsMountId = (ws as any)._mountId;
                 if (wsMountId !== mountIdRef.current || socketRef.current !== ws) {
                     console.warn(`[WebSocket Message] Mount #${wsMountId} - Received message for an old/inactive socket instance. Ignoring.`);
                     return;
                 }

                try {
                    if (typeof event.data !== 'string') {
                        console.warn(`[WebSocket Message] Mount #${wsMountId} - Received non-string message:`, event.data); return;
                    }
                    let messageData;
                    try { messageData = JSON.parse(event.data); } catch (e) { console.error(`[WebSocket Message] Mount #${wsMountId} - Failed JSON parse:`, e); return; }

                    if (messageData && typeof messageData === 'object') {
                        if ('error' in messageData) {
                            const errorData = messageData as ErrorData;
                            console.error(`ðŸ"´ [WebSocket Message] Mount #${wsMountId} - SERVER ERROR:`, errorData.error);
                            showMessage(`Erro do servidor: ${errorData.error}`);
                            stopRecording(mountIdRef.current);
                        } else if ('transcript' in messageData) {
                            const transcriptionData = messageData as TranscriptionData;
                            if (transcriptionData.isFinal) {
                                setFinalTranscription(prev => prev + transcriptionData.transcript + ' ');
                                setInterimTranscription('');
                            } else {
                                setInterimTranscription(transcriptionData.transcript);
                            }
                        } else {
                            console.warn(`[WebSocket Message] Mount #${wsMountId} - Unknown message format:`, messageData);
                        }
                    } else {
                         console.warn(`[WebSocket Message] Mount #${wsMountId} - Received non-object message data:`, messageData);
                    }
                } catch (error) {
                    console.error(`[WebSocket Message] Mount #${wsMountId} - Error processing message:`, error);
                    showMessage('Erro ao processar resposta do servidor.');
                }
            };

            ws.onerror = (event) => {
                 const wsMountId = (ws as any)._mountId;
                 if (wsMountId !== mountIdRef.current || socketRef.current !== ws) {
                     console.warn(`[WebSocket Error] Mount #${wsMountId} - Received error for an old/inactive socket instance. Ignoring.`);
                     return;
                 }
                console.error(`[WebSocket Error] Mount #${wsMountId} - WebSocket error occurred.`, event);
                showMessage('WebSocket connection error. Check backend/console.');
                setStatus(RecordingStatus.Error);
                isRecordingRef.current = false;
                setIsRecording(false);
            };

            ws.onclose = (event) => {
                 const wsMountId = (ws as any)._mountId;
                 if (socketRef.current !== null && socketRef.current !== ws) {
                     console.warn(`[WebSocket Close] Mount #${wsMountId} - Received close event for an old/inactive socket instance (Code: ${event.code}). Ignoring.`);
                     return;
                 }

                console.log(`[WebSocket Close] Mount #${wsMountId} - Connection closed. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);

                const wasRecording = isRecordingRef.current;

                if (socketRef.current === ws) {
                    console.log(`[WebSocket Close] Mount #${wsMountId} - Nullifying socketRef.`);
                    socketRef.current = null;
                }

                if (isRecordingRef.current) isRecordingRef.current = false;
                setIsRecording(false);

                if (wsMountId === mountIdRef.current || wasRecording) {
                    if (audioContextRef.current || mediaStreamRef.current || processorRef.current || inputStreamRef.current) {
                        console.log(`[WebSocket Close] Mount #${wsMountId} - Initiating audio cleanup as resources might exist for active/previous recording.`);
                        cleanupAudio(wsMountId);
                    } else {
                         console.log(`[WebSocket Close] Mount #${wsMountId} - No audio resources detected, skipping cleanup.`);
                    }
                } else {
                     console.log(`[WebSocket Close] Mount #${wsMountId} - Close event for non-active mount, skipping audio cleanup.`);
                }

                 setStatus(prevStatus => {
                     if (prevStatus === RecordingStatus.Error && event.code !== 1000) { return RecordingStatus.Error; }
                     if (event.code === 1000) {
                         console.log(`[WebSocket Close] Mount #${wsMountId} - Clean closure. Setting status to Inactive.`);
                         return RecordingStatus.Inactive;
                     } else if (wasRecording) {
                         console.warn(`[WebSocket Close] Mount #${wsMountId} - Unexpected closure (Code: ${event.code}) while recording. Setting status to Error.`);
                         showMessage(`Conexão perdida inesperadamente (Cód: ${event.code}).`);
                         return RecordingStatus.Error;
                     } else {
                         console.log(`[WebSocket Close] Mount #${wsMountId} - Connection closed unexpectedly (Code: ${event.code}) while not recording. Setting status to Inactive.`);
                          if (!errorMessage) { showMessage(`Conexão fechada (Cód: ${event.code}).`); }
                         return RecordingStatus.Inactive;
                     }
                 });
            };

        } catch (error) {
            console.error(`[WebSocket Connect] Mount #${currentMountId} - Failed to create WebSocket:`, error);
            showMessage("Could not create WebSocket connection.");
            setStatus(RecordingStatus.Error);
            socketRef.current = null;
            isRecordingRef.current = false;
            setIsRecording(false);
        }
    }, [initializeAudio, showMessage, cleanupAudio, stopRecording, closeWebSocket, getWebSocketStateName, errorMessage]);

    useEffect(() => {
        const currentMountId = Date.now();
        const currentTimestamp = Date.now();
        mountIdRef.current = currentMountId;
        mountTimestampRef.current = currentTimestamp;
        isCleanupScheduledRef.current = false;
        isStrictModeUnmountRef.current = false;

        console.log(`[React Lifecycle] ===== Component MOUNT #${currentMountId} =====`);

        const isSecondMount = mountCounterRef.current === 1 && (Date.now() - mountTimestampRef.current < 100);
        if (isSecondMount) {
             console.log(`[React Lifecycle] Mount #${currentMountId} - Detected as likely second mount in StrictMode.`);
        }
        mountCounterRef.current++;

        return () => {
            const unmountTimestamp = Date.now();
            const timeSinceMount = unmountTimestamp - mountTimestampRef.current;
            console.log(`[React Lifecycle] ===== Component UNMOUNT #${currentMountId} (after ${timeSinceMount}ms) =====`);

             const isLikelyStrictModeUnmount = mountCounterRef.current === 1 && timeSinceMount < 500;

            if (isLikelyStrictModeUnmount) {
                console.warn(`[React Lifecycle] Unmount #${currentMountId} - Detected as likely FIRST unmount in StrictMode. Skipping cleanup.`);
                isStrictModeUnmountRef.current = true;
            } else {
                 console.log(`[React Lifecycle] Unmount #${currentMountId} - Performing cleanup (Not detected as StrictMode first unmount).`);
                 cleanupResources(currentMountId, "(final unmount)");
            }
        };
    }, [cleanupResources]);

     const mountCounterRef = useRef(0);
     useEffect(() => {
          return () => {
               mountCounterRef.current = 0;
          }
     },[])

    const handleStart = () => {
        const currentMountId = mountIdRef.current;
        console.log(`[Action] Mount #${currentMountId} - Start button clicked.`);
        if (status === RecordingStatus.Connecting ||
            status === RecordingStatus.Initializing ||
            status === RecordingStatus.Recording ||
            status === RecordingStatus.Stopping) {
            console.warn(`[Action] Mount #${currentMountId} - Start ignored, status is '${status}'.`);
            return;
        }
        if (errorMessage) setErrorMessage(null);
        connectWebSocket(currentMountId);
    };

    const handleStop = () => {
         const currentMountId = mountIdRef.current;
        console.log(`[Action] Mount #${currentMountId} - Stop button clicked.`);
        stopRecording(currentMountId);
    };

    return (
      <div className="w-full flex flex-col items-center justify-center">
            
            <header className="mb-8 text-center relative">
                <div className={`relative inline-flex items-center justify-center p-5 mb-4 rounded-full w-28 h-28 
                    ${isRecording 
                      ? 'bg-gradient-to-br from-accent-red to-accent-red/70 animate-pulse-recording' 
                      : 'bg-gradient-to-br from-accent-turquoise/30 to-transparent animate-pulse-glow'}`}>
                    
                    <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-dark to-primary rounded-full z-10">
                        {isRecording && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-24 h-24 flex justify-between items-center">
                                    {audioLevels.map((level, i) => (
                                        <div 
                                            key={i} 
                                            className="w-1 bg-accent-red rounded-full wave-bar"
                                            style={{
                                                height: `${level}%`,
                                                animationDelay: `${i * 0.1}s`,
                                            }}
                                        ></div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {isRecording && (
                          <div className="absolute -top-1 -right-1 bg-accent-red text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-glow-red">
                            REC
                          </div>
                        )}
                        
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                            className={`w-10 h-10 ${isRecording ? 'text-white' : 'text-accent-turquoise'} drop-shadow-lg z-20`}>
                          <path fillRule="evenodd" d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm-1.5 3a1.5 1.5 0 0 1 3 0v7a1.5 1.5 0 0 1-3 0V5z" clipRule="evenodd" />
                          <path d="M8.25 8a.75.75 0 0 0-1.5 0v4a5.25 5.25 0 1 0 10.5 0V8a.75.75 0 0 0-1.5 0v4a3.75 3.75 0 1 1-7.5 0V8z" />
                          <path d="M10.5 17.55a7.5 7.5 0 0 0 3 0V20.5h-3v-2.95z" />
                        </svg>
                    </div>
                </div>
            </header>

            <Controls
                onStart={handleStart}
                onStop={handleStop}
                isRecording={isRecording}
                status={status}
            />

            <TranscriptionDisplay
                finalTranscription={finalTranscription}
                interimTranscription={interimTranscription}
                status={status}
                isRecording={isRecording}
            />

            <MessageBox message={errorMessage} onClose={() => setErrorMessage(null)} />

            <div className="flex items-center justify-between w-full max-w-md mt-6 px-3">
                <div className="flex items-center text-sm text-text-secondary">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                        status === RecordingStatus.Recording ? 'bg-accent-red animate-pulse' : 
                        status === RecordingStatus.Connecting || status === RecordingStatus.Initializing ? 'bg-accent-blue animate-pulse' : 
                        'bg-text-secondary'
                    }`}></div>
                    <span>{status}</span>
                </div>
                
                {isRecording && (
                    <div className="text-accent-red text-sm font-semibold font-mono">
                        00:00:00
                    </div>
                )}
            </div>

            <div className="text-xs text-gray-500 text-center mt-4 hidden">
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
                    <span>Mount ID: {mountIdRef.current}</span>
                    <span>•</span>
                    <span>WS: {getWebSocketStateName(socketRef.current?.readyState)}</span>
                    <span>•</span>
                    <span>Audio: {audioContextRef.current?.state ?? 'N/A'}</span>
                    <span>•</span>
                    <span>Rec: {isRecordingRef.current ? 'Yes' : 'No'}</span>
                </div>
            </div>
        </div>
    );
};

export default RealTimeTranscription;