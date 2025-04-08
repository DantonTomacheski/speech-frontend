// src/components/RealTimeTranscription.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RecordingStatus, WebSocketMessage, TranscriptionData, ErrorData } from '../types';
import MessageBox from './MessageBox';
import TranscriptionDisplay from './TranscriptionDisplay';
import Controls from './Controls';

// --- Constants ---
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8081';
const BUFFER_SIZE = 2048; // Audio buffer size (ScriptProcessorNode buffer size)
const TARGET_SAMPLE_RATE = 48000; // Define target sample rate - MUST MATCH BACKEND EXPECTATION

console.log(`[Config] Frontend configured. WebSocket URL: ${WEBSOCKET_URL}, Target Sample Rate: ${TARGET_SAMPLE_RATE} Hz, Buffer Size: ${BUFFER_SIZE}`);

/**
 * @function RealTimeTranscription
 * @description Main component managing audio capture, WebSocket connection,
 * and real-time transcription state. Includes fixes for React 19/StrictMode remounting issues.
 * @returns {React.ReactElement} The React element.
 */
const RealTimeTranscription: React.FC = () => {
    // --- State ---
    const [status, setStatus] = useState<RecordingStatus>(RecordingStatus.Inactive);
    const [finalTranscription, setFinalTranscription] = useState<string>('');
    const [interimTranscription, setInterimTranscription] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false); // UI state for recording

    // --- Refs ---
    const socketRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const inputStreamRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const isRecordingRef = useRef<boolean>(false); // Internal logic state for recording
    const isCleanupScheduledRef = useRef<boolean>(false); // Flag to prevent double cleanup
    const mountIdRef = useRef<number>(0); // Unique ID for each mount instance
    const mountTimestampRef = useRef<number>(0); // Timestamp of the current mount
    const isStrictModeUnmountRef = useRef<boolean>(false); // Flag to indicate the first unmount in StrictMode

    // --- Callback Functions ---

    // Utility to show temporary error messages
    const showMessage = useCallback((message: string) => {
        console.log(`[UI] Displaying message: "${message}"`);
        setErrorMessage(message);
    }, []);

    // Helper to get WebSocket state name
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

    // WebSocket closing function (made more robust)
    const closeWebSocket = useCallback((currentMountId: number, reasonSuffix: string = "") => {
        const reason = `Client stopping transcription ${reasonSuffix}`.trim();
        console.log(`[WebSocket Close] Mount #${currentMountId} - closeWebSocket called. Reason: ${reason}`);

        if (!socketRef.current) {
            console.log(`[WebSocket Close] Mount #${currentMountId} - No active WebSocket connection found.`);
            return;
        }

        const ws = socketRef.current; // Capture current socket
        const currentState = ws.readyState;
        console.log(`[WebSocket Close] Mount #${currentMountId} - Attempting to close WebSocket. Current state: ${currentState} (${getWebSocketStateName(currentState)})`);

        // Prevent closing if already closing or closed
        if (currentState === WebSocket.CLOSING || currentState === WebSocket.CLOSED) {
            console.log(`[WebSocket Close] Mount #${currentMountId} - WebSocket already closing or closed.`);
            if (socketRef.current === ws) {
                 socketRef.current = null; // Ensure ref is nullified
            }
            return;
        }

        // Remove listeners immediately
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        // Detach the main onclose handler to prevent it from running again for this explicit close
        ws.onclose = () => {
             console.log(`[WebSocket Close] Mount #${currentMountId} - Inner onclose for explicit close (Code: ${ws.readyState}). Socket ref is now null.`);
             // Ensure ref is nullified after close completes
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
             // Nullify the main ref immediately after *initiating* close
             if (socketRef.current === ws) {
                socketRef.current = null;
             }
        };

        if (currentState === WebSocket.OPEN) {
            console.log(`[WebSocket Close] Mount #${currentMountId} - Sending 'stopStreaming' command.`);
            try {
                ws.send(JSON.stringify({ command: 'stopStreaming' }));
                setTimeout(initiateClose, 50); // Short delay for command send
            } catch (sendError) {
                console.error(`[WebSocket Close] Mount #${currentMountId} - Error sending 'stopStreaming', closing immediately:`, sendError);
                initiateClose();
            }
        } else {
            console.log(`[WebSocket Close] Mount #${currentMountId} - Socket not OPEN, closing directly.`);
            initiateClose();
        }

    }, [getWebSocketStateName]); // Dependency


    // Audio cleanup function (made more robust)
    const cleanupAudio = useCallback((currentMountId: number) => {
        console.log(`[Audio Cleanup] Mount #${currentMountId} - Cleaning up audio resources...`);
        let cleaned = false;

        // 1. Stop media stream tracks first
        if (mediaStreamRef.current) {
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Stopping media stream tracks.`);
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
            cleaned = true;
        }

        // 2. Disconnect and nullify ScriptProcessorNode *before* closing context
        if (processorRef.current) {
            const processor = processorRef.current; // Capture ref
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Detaching onaudioprocess and disconnecting script processor node.`);
            // CRITICAL FIX: Remove the event listener *before* disconnecting
            processor.onaudioprocess = null;
            try {
                 processor.disconnect();
            } catch (e) {
                 console.warn(`[Audio Cleanup] Mount #${currentMountId} - Error disconnecting processor (might be harmless):`, e);
            }
            // Nullify ref only if it hasn't changed
            if(processorRef.current === processor) {
                 processorRef.current = null;
            }
            cleaned = true;
        }

        // 3. Disconnect input stream node
        if (inputStreamRef.current) {
             const inputStream = inputStreamRef.current; // Capture ref
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

        // 4. Close AudioContext if it exists and is running/suspended
        if (audioContextRef.current) {
            const context = audioContextRef.current; // Capture ref
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
                    // Ensure ref is cleared even if closing failed, only if it's the same context
                    if (audioContextRef.current === context) {
                        audioContextRef.current = null;
                    }
                });
            } else {
                 console.log(`[Audio Cleanup] Mount #${currentMountId} - AudioContext was already closed.`);
                 // Ensure ref is cleared if it points to the already closed context
                 if (audioContextRef.current === context) {
                      audioContextRef.current = null;
                 }
            }
        }

        // 5. Ensure recording state refs/state are false
        if (isRecordingRef.current) {
            console.log(`[Audio Cleanup] Mount #${currentMountId} - Setting internal recording state to false.`);
            isRecordingRef.current = false;
        }
        // Use functional update for UI state to avoid stale closures
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
    }, []); // Dependencies removed as it should be stable


    // Combined cleanup function
    const cleanupResources = useCallback((currentMountId: number, reasonSuffix: string = "") => {
        console.log(`[Cleanup] Mount #${currentMountId} - Initiating resource cleanup. Reason suffix: "${reasonSuffix}"`);
        // Prevent cleanup from running multiple times concurrently for the same mount
        if (isCleanupScheduledRef.current) {
             console.log(`[Cleanup] Mount #${currentMountId} - Cleanup already scheduled or running, skipping.`);
             return;
        }
        isCleanupScheduledRef.current = true;
        console.log(`[Cleanup] Mount #${currentMountId} - Cleanup lock acquired.`);

        // Cleanup order: Audio first, then WebSocket
        cleanupAudio(currentMountId);
        closeWebSocket(currentMountId, reasonSuffix);

        // Reset internal recording state just in case
        isRecordingRef.current = false;
        setIsRecording(false); // Ensure UI state matches

        // Update status if not already in error/inactive
        setStatus(prevStatus => {
            if (prevStatus !== RecordingStatus.Error && prevStatus !== RecordingStatus.Inactive) {
                console.log(`[Cleanup] Mount #${currentMountId} - Setting status to Inactive.`);
                return RecordingStatus.Inactive;
            }
            return prevStatus;
        });

        console.log(`[Cleanup] Mount #${currentMountId} - Resource cleanup process complete.`);
        // Release the lock after a short delay
        setTimeout(() => {
            console.log(`[Cleanup] Mount #${currentMountId} - Releasing cleanup lock.`);
            isCleanupScheduledRef.current = false;
        }, 100);

    }, [cleanupAudio, closeWebSocket]);


    // Main function to stop recording
    const stopRecording = useCallback((currentMountId: number) => {
        console.log(`[Action] Mount #${currentMountId} - Stop recording requested.`);

        if (!isRecordingRef.current) {
            console.warn(`[Action] Mount #${currentMountId} - Stop requested, but internal state indicates not recording. Running cleanup just in case.`);
             cleanupResources(currentMountId, "(stop requested when not recording)");
            return;
        }

        console.log(`[Action] Mount #${currentMountId} - Proceeding with stopping recording... Setting status to STOPPING.`);
        setStatus(RecordingStatus.Stopping);
        isRecordingRef.current = false; // Set internal state immediately
        setIsRecording(false); // Update UI state

        // Initiate cleanup
        cleanupResources(currentMountId, "(stop requested)");

        console.log(`[Action] Mount #${currentMountId} - Stop recording process finished initiating cleanup.`);

    }, [cleanupResources]); // Depends on cleanupResources


    // --- Audio Processing ---
    const audioPacketCounter = useRef(0);
    const lastLogTime = useRef(Date.now());

    const handleAudioProcess = useCallback((event: AudioProcessingEvent) => {
        const currentMountId = mountIdRef.current; // Get current mount ID for context

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
                 stopRecording(currentMountId); // Use current mount ID
             }
            return;
        }

        audioPacketCounter.current++;
        const audioData = event.inputBuffer.getChannelData(0);

        try {
            const bufferToSend = audioData.buffer;
            ws.send(bufferToSend);
            if (audioPacketCounter.current % 200 === 0) {
                // console.log(`[Audio Processing] Mount #${currentMountId} - Sent audio packet #${audioPacketCounter.current}`); // Reduce logging
            }
        } catch (sendError) {
            console.error(`[WebSocket] Mount #${currentMountId} - Error sending audio data:`, sendError);
            stopRecording(currentMountId); // Use current mount ID
        }
    }, [getWebSocketStateName, stopRecording]); // Added stopRecording dependency


    // --- Audio Initialization ---
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
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) throw new Error("Browser does not support Web Audio API.");

            const context = new AudioContext(contextOptions);
            // Check if mount changed *during* context creation (unlikely but possible)
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
                     cleanupAudio(currentMountId); // Clean up partially initialized resources
                     return;
                 }
                console.log(`[Audio Init] Mount #${currentMountId} - AudioContext resumed. State: ${context.state}`);
                if (context.state !== 'running') throw new Error(`AudioContext could not be resumed. State: ${context.state}`);
            }

            console.log(`[Audio Init] Mount #${currentMountId} - Requesting microphone access...`);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                 // Consider adding echo cancellation if needed
                 // echoCancellation: true,
                 // autoGainControl: true,
                 // noiseSuppression: true
            }, video: false });
             if (currentMountId !== mountIdRef.current) {
                 console.warn(`[Audio Init] Mount #${currentMountId} - Aborting after getUserMedia: No longer the active mount. Stopping tracks.`);
                 stream.getTracks().forEach(track => track.stop());
                 cleanupAudio(currentMountId);
                 return;
             }
            mediaStreamRef.current = stream;
            console.log(`[Audio Init] Mount #${currentMountId} - Microphone access granted.`);

            inputStreamRef.current = context.createMediaStreamSource(stream);
            console.warn("[Audio Init] Using deprecated ScriptProcessorNode. Consider AudioWorklet.");
            const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
            processor.onaudioprocess = handleAudioProcess; // Assign callback first
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
            cleanupAudio(currentMountId); // Use failing mount ID for cleanup context
        }
    }, [showMessage, cleanupAudio, handleAudioProcess]);


    // --- WebSocket Connection ---
    const connectWebSocket = useCallback((currentMountId: number) => {
        console.log(`[WebSocket Connect] Mount #${currentMountId} - connectWebSocket called.`);

         if (currentMountId !== mountIdRef.current) {
             console.warn(`[WebSocket Connect] Mount #${currentMountId} - Aborting: No longer the active mount (current is #${mountIdRef.current}).`);
             return;
         }

        if (socketRef.current) {
            console.warn(`[WebSocket Connect] Mount #${currentMountId} - WebSocket already exists (State: ${getWebSocketStateName(socketRef.current.readyState)}). Cleaning up old socket first.`);
            closeWebSocket(currentMountId, "(superseded)"); // Pass reason suffix
        }

        setStatus(RecordingStatus.Connecting);
        console.log(`[WebSocket Connect] Mount #${currentMountId} - Attempting to connect to ${WEBSOCKET_URL}...`);
        setFinalTranscription('');
        setInterimTranscription('');

        try {
            const ws = new WebSocket(WEBSOCKET_URL);
            // Add mount ID to instance for debugging
            (ws as any)._mountId = currentMountId;
            socketRef.current = ws; // Assign ref immediately

            ws.onopen = () => {
                const wsMountId = (ws as any)._mountId;
                console.log(`[WebSocket Connect] Mount #${wsMountId} - ðŸŸ¢ Connection opened.`);

                 if (wsMountId !== mountIdRef.current) {
                     console.warn(`[WebSocket Connect] Mount #${wsMountId} - WS opened, but no longer the active mount (current is #${mountIdRef.current}). Closing connection.`);
                     if (socketRef.current === ws) {
                         closeWebSocket(wsMountId, "(opened on obsolete mount)");
                     } else {
                          // If ref already changed, just close this specific ws instance
                          ws.close(1000, "Opened on obsolete mount");
                     }
                     return;
                 }
                 console.log(`[WebSocket Connect] Mount #${wsMountId} - Socket open, proceeding to initialize audio.`);
                initializeAudio(wsMountId); // Pass the correct mount ID
            };

            ws.onmessage = (event) => {
                 const wsMountId = (ws as any)._mountId;
                 if (wsMountId !== mountIdRef.current || socketRef.current !== ws) {
                     console.warn(`[WebSocket Message] Mount #${wsMountId} - Received message for an old/inactive socket instance. Ignoring.`);
                     return;
                 }

                // console.log(`[WebSocket Message] Mount #${wsMountId} - <<< Message received.`); // Reduce logging
                try {
                    if (typeof event.data !== 'string') {
                        console.warn(`[WebSocket Message] Mount #${wsMountId} - Received non-string message:`, event.data); return;
                    }
                    let messageData;
                    try { messageData = JSON.parse(event.data); } catch (e) { console.error(`[WebSocket Message] Mount #${wsMountId} - Failed JSON parse:`, e); return; }

                    // console.log(`[WebSocket Message] Mount #${wsMountId} - Parsed data:`, messageData); // Reduce logging

                    if (messageData && typeof messageData === 'object') {
                        if ('error' in messageData) {
                            const errorData = messageData as ErrorData;
                            console.error(`ðŸ”´ [WebSocket Message] Mount #${wsMountId} - SERVER ERROR:`, errorData.error);
                            showMessage(`Erro do servidor: ${errorData.error}`);
                            stopRecording(mountIdRef.current); // Stop current active recording
                        } else if ('transcript' in messageData) {
                            const transcriptionData = messageData as TranscriptionData;
                            if (transcriptionData.isFinal) {
                                // console.log(`[WebSocket Message] Mount #${wsMountId} - ðŸŸ¢ Final: "${transcriptionData.transcript}"`); // Reduce logging
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
                 // onclose will handle cleanup
            };

            ws.onclose = (event) => {
                 const wsMountId = (ws as any)._mountId;
                 // Only process close event if it belongs to the currently tracked socket OR if socketRef is already null (meaning cleanup was initiated)
                 if (socketRef.current !== null && socketRef.current !== ws) {
                     console.warn(`[WebSocket Close] Mount #${wsMountId} - Received close event for an old/inactive socket instance (Code: ${event.code}). Ignoring.`);
                     return;
                 }

                console.log(`[WebSocket Close] Mount #${wsMountId} - Connection closed. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);

                const wasRecording = isRecordingRef.current;

                // Nullify the ref *only if* it currently points to this closing socket
                if (socketRef.current === ws) {
                    console.log(`[WebSocket Close] Mount #${wsMountId} - Nullifying socketRef.`);
                    socketRef.current = null;
                }

                // Ensure recording state is false
                if (isRecordingRef.current) isRecordingRef.current = false;
                setIsRecording(false);

                // Attempt audio cleanup only if this close event corresponds to the *active* mount ID
                // or if it's a close event for a socket that was being actively used (even if mount ID changed slightly before close)
                if (wsMountId === mountIdRef.current || wasRecording) {
                    if (audioContextRef.current || mediaStreamRef.current || processorRef.current || inputStreamRef.current) {
                        console.log(`[WebSocket Close] Mount #${wsMountId} - Initiating audio cleanup as resources might exist for active/previous recording.`);
                        cleanupAudio(wsMountId); // Use the ID associated with the closing socket for context
                    } else {
                         console.log(`[WebSocket Close] Mount #${wsMountId} - No audio resources detected, skipping cleanup.`);
                    }
                } else {
                     console.log(`[WebSocket Close] Mount #${wsMountId} - Close event for non-active mount, skipping audio cleanup.`);
                }

                 // Determine final UI status
                 setStatus(prevStatus => {
                     if (prevStatus === RecordingStatus.Error && event.code !== 1000) { return RecordingStatus.Error; } // Don't override error unless clean close
                     if (event.code === 1000) { // Clean close
                         console.log(`[WebSocket Close] Mount #${wsMountId} - Clean closure. Setting status to Inactive.`);
                         return RecordingStatus.Inactive;
                     } else if (wasRecording) { // Unexpected close while recording
                         console.warn(`[WebSocket Close] Mount #${wsMountId} - Unexpected closure (Code: ${event.code}) while recording. Setting status to Error.`);
                         showMessage(`Conexão perdida inesperadamente (Cód: ${event.code}).`);
                         return RecordingStatus.Error;
                     } else { // Unexpected close while not recording
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


    // --- Effect for Initialization and Cleanup ---
    useEffect(() => {
        const currentMountId = Date.now();
        const currentTimestamp = Date.now();
        mountIdRef.current = currentMountId;
        mountTimestampRef.current = currentTimestamp;
        isCleanupScheduledRef.current = false;
        // Reset strict mode flag on new mount
        isStrictModeUnmountRef.current = false;

        console.log(`[React Lifecycle] ===== Component MOUNT #${currentMountId} =====`);

        // Detect if this is the *second* mount in StrictMode
        const isSecondMount = mountCounterRef.current === 1 && (Date.now() - mountTimestampRef.current < 100); // Check if previous mount was very recent
        if (isSecondMount) {
             console.log(`[React Lifecycle] Mount #${currentMountId} - Detected as likely second mount in StrictMode.`);
        }
        mountCounterRef.current++; // Increment after check

        return () => {
            const unmountTimestamp = Date.now();
            const timeSinceMount = unmountTimestamp - mountTimestampRef.current;
            console.log(`[React Lifecycle] ===== Component UNMOUNT #${currentMountId} (after ${timeSinceMount}ms) =====`);

            // Detect if this is the *first* unmount in StrictMode
            // Condition: It's the first mount instance (mountCounterRef was 1 before increment)
            // AND the unmount happens very quickly after mount
             const isLikelyStrictModeUnmount = mountCounterRef.current === 1 && timeSinceMount < 500; // Adjust threshold if needed

            if (isLikelyStrictModeUnmount) {
                console.warn(`[React Lifecycle] Unmount #${currentMountId} - Detected as likely FIRST unmount in StrictMode. Skipping cleanup.`);
                isStrictModeUnmountRef.current = true; // Set flag
                // Crucially, DO NOT call cleanupResources here
            } else {
                 console.log(`[React Lifecycle] Unmount #${currentMountId} - Performing cleanup (Not detected as StrictMode first unmount).`);
                 // Initiate cleanup using the ID of the mount instance that is unmounting
                 cleanupResources(currentMountId, "(final unmount)");
            }
        };
    }, [cleanupResources]); // Depend only on the stable cleanup function

     // Counter ref to track mount count across renders but reset outside useEffect
     const mountCounterRef = useRef(0);
     useEffect(() => {
          // Reset mount counter when the component *truly* unmounts (not just StrictMode)
          return () => {
               mountCounterRef.current = 0;
          }
     },[])


    // --- Button Handlers ---
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


    // --- Rendering ---
    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto mt-8 border border-gray-200">
            <h1 className="text-xl md:text-2xl font-bold mb-6 text-center text-gray-800">
                🎙️ Transcrição React em Tempo Real (Fix v2) 🎙️
            </h1>

            {/* Controls Component */}
            <Controls
                onStart={handleStart}
                onStop={handleStop}
                isRecording={isRecording} // Pass UI recording state
                status={status}
            />

            {/* Transcription Display Component */}
            <TranscriptionDisplay
                finalTranscription={finalTranscription}
                interimTranscription={interimTranscription}
                status={status}
                isRecording={isRecording} // Pass UI recording state
            />

            {/* Message Box for Errors/Info */}
            <MessageBox message={errorMessage} onClose={() => setErrorMessage(null)} />

            {/* Optional: Display State for Debugging */}
            <div className="text-xs text-gray-500 text-center mt-4">
                 Mount ID: {mountIdRef.current} |
                 WS State: {getWebSocketStateName(socketRef.current?.readyState)} |
                 Audio State: {audioContextRef.current?.state ?? 'N/A'} |
                 Rec Ref: {isRecordingRef.current ? 'Yes' : 'No'} |
                 UI Rec: {isRecording ? 'Yes' : 'No'} |
                 Status: {status}
            </div>
        </div>
    );
};

export default RealTimeTranscription;
