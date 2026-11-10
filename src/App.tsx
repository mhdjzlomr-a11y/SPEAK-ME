import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationFeed } from './components/ConversationFeed';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { VoiceControlDock } from './components/VoiceControlDock';
import { getScenarioById } from './constants/scenarios';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import {
  GeminiApiError,
  sendAudioConversationTurn,
  sendConversationTurn,
} from './services/gemini';
import type {
  AppSettings,
  ChatMessage,
  ConversationLevel,
  ScenarioId,
  VoiceState,
} from './types/conversation';
import {
  clearMessages,
  loadMessages,
  loadSettings,
  saveMessages,
  saveSettings,
} from './utils/storage';

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [isThinking, setIsThinking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [browserSttBlocked, setBrowserSttBlocked] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const speech = useSpeechSynthesis();
  const startListeningRef = useRef<() => void>(() => {});

  const buildVoiceOptions = useCallback(
    (
      sourceSettings: AppSettings,
      speechId: string,
      rateOverride?: number,
      onEnd?: () => void
    ) => ({
      id: speechId,
      rate: rateOverride ?? sourceSettings.ttsRate,
      voiceEngine: sourceSettings.voiceEngine,
      apiKey: sourceSettings.apiKey,
      geminiVoiceName: sourceSettings.geminiVoiceName,
      preferredVoiceURI: sourceSettings.ttsVoiceURI,
      preferredLang: sourceSettings.sttLang,
      onEnd,
    }),
    []
  );

  const speakReplyWithAutoContinue = useCallback(
    (text: string, messageId: string) => {
      speech.speak(
        text,
        buildVoiceOptions(settingsRef.current, messageId, undefined, () => {
          if (settingsRef.current.autoListen) {
            window.setTimeout(() => {
              startListeningRef.current();
            }, 250);
          }
        })
      );
    },
    [buildVoiceOptions, speech]
  );

  const runTutorTurn = useCallback(
    async (options: {
      placeholderText: string;
      existingMessageId?: string;
      removePlaceholderOnError: boolean;
      execute: (
        currentSettings: AppSettings,
        priorHistory: ChatMessage[],
        signal: AbortSignal
      ) => Promise<{
        transcript?: string;
        reply: string;
        replyMalayalam?: string;
        feedback: ChatMessage['feedback'];
      }>;
    }) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.apiKey.trim()) {
        setApiError('Add your free Google Gemini API key in Settings first.');
        setIsSettingsOpen(true);
        return;
      }

      speech.unlock();
      speech.stop();
      setApiError(null);

      const targetId = options.existingMessageId ?? createMessageId();
      const priorHistory = options.existingMessageId
        ? messagesRef.current.filter((msg) => msg.id !== targetId)
        : messagesRef.current;

      if (options.existingMessageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === targetId ? { ...msg, error: undefined } : msg
          )
        );
      } else {
        const userMessage: ChatMessage = {
          id: targetId,
          role: 'user',
          text: options.placeholderText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      setIsThinking(true);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await options.execute(
          currentSettings,
          priorHistory,
          controller.signal
        );

        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          text: result.reply,
          malayalamText: result.replyMalayalam,
          timestamp: Date.now(),
        };

        setMessages((prev) =>
          prev
            .map((msg) =>
              msg.id === targetId
                ? {
                    ...msg,
                    text: result.transcript ?? msg.text,
                    feedback: result.feedback,
                    error: undefined,
                  }
                : msg
            )
            .concat(assistantMessage)
        );
        setIsThinking(false);

        speakReplyWithAutoContinue(result.reply, assistantMessage.id);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setIsThinking(false);
          if (options.removePlaceholderOnError) {
            setMessages((prev) => prev.filter((msg) => msg.id !== targetId));
          }
          return;
        }

        const friendlyError =
          err instanceof GeminiApiError
            ? err.message
            : 'Something went wrong getting an AI reply. Please try again.';

        setIsThinking(false);
        setApiError(friendlyError);
        setMessages((prev) =>
          options.removePlaceholderOnError
            ? prev.filter((msg) => msg.id !== targetId)
            : prev.map((msg) =>
                msg.id === targetId ? { ...msg, error: friendlyError } : msg
              )
        );

        if (
          err instanceof GeminiApiError &&
          (err.code === 'missing-key' || err.code === 'invalid-key')
        ) {
          setIsSettingsOpen(true);
        }
      }
    },
    [speakReplyWithAutoContinue, speech]
  );

  const handleRetryMessage = useCallback(
    async (failedMessage: ChatMessage) => {
      if (isThinking) return;
      const text = failedMessage.text.trim();
      if (!text) return;

      await runTutorTurn({
        placeholderText: text,
        existingMessageId: failedMessage.id,
        removePlaceholderOnError: false,
        execute: (currentSettings, priorHistory, signal) =>
          sendConversationTurn({
            apiKey: currentSettings.apiKey,
            model: currentSettings.model,
            history: priorHistory,
            userMessage: text,
            level: currentSettings.level,
            scenario: currentSettings.scenario,
            signal,
          }),
      });
    },
    [isThinking, runTutorTurn]
  );

  const handleTurnSubmit = useCallback(
    async (rawText: string) => {
      const userText = rawText.trim();
      if (!userText) return;

      await runTutorTurn({
        placeholderText: userText,
        removePlaceholderOnError: false,
        execute: (currentSettings, priorHistory, signal) =>
          sendConversationTurn({
            apiKey: currentSettings.apiKey,
            model: currentSettings.model,
            history: priorHistory,
            userMessage: userText,
            level: currentSettings.level,
            scenario: currentSettings.scenario,
            signal,
          }),
      });
    },
    [runTutorTurn]
  );

  const handleAudioSubmit = useCallback(
    async (audioBase64: string, mimeType: string) => {
      await runTutorTurn({
        placeholderText: 'Processing voice recording...',
        removePlaceholderOnError: true,
        execute: (currentSettings, priorHistory, signal) =>
          sendAudioConversationTurn({
            apiKey: currentSettings.apiKey,
            model: currentSettings.model,
            history: priorHistory,
            audioBase64,
            mimeType,
            level: currentSettings.level,
            scenario: currentSettings.scenario,
            signal,
          }),
      });
    },
    [runTutorTurn]
  );

  const audioRecorder = useAudioRecorder({
    onAudioReady: handleAudioSubmit,
  });

  const handleBrowserSttNetworkError = useCallback(() => {
    if (settingsRef.current.sttMode !== 'auto' || !audioRecorder.isSupported) {
      return false;
    }
    setBrowserSttBlocked(true);
    void audioRecorder.start();
    return true;
  }, [audioRecorder]);

  const recognition = useSpeechRecognition({
    lang: settings.sttLang,
    autoSendOnSilence: settings.autoSendOnSilence,
    onFinalTranscript: handleTurnSubmit,
    onNetworkError: handleBrowserSttNetworkError,
  });

  const usingAudioFallback =
    settings.sttMode === 'gemini-audio' ||
    (settings.sttMode === 'auto' && (!recognition.isSupported || browserSttBlocked));

  const isVoiceSupported =
    settings.sttMode === 'browser'
      ? recognition.isSupported
      : settings.sttMode === 'gemini-audio'
      ? audioRecorder.isSupported
      : recognition.isSupported || audioRecorder.isSupported;

  const beginListening = useCallback(() => {
    if (isThinking) return;
    speech.stop();
    if (usingAudioFallback) {
      void audioRecorder.start();
    } else {
      recognition.start();
    }
  }, [audioRecorder, isThinking, recognition, speech, usingAudioFallback]);

  startListeningRef.current = beginListening;

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute(
        'content',
        settings.theme === 'dark' ? '#020617' : '#ffffff'
      );
    }
  }, [settings]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const isListeningNow = recognition.isListening || audioRecorder.isRecording;

  const voiceState: VoiceState = isThinking
    ? 'thinking'
    : speech.isSpeaking
    ? 'speaking'
    : isListeningNow
    ? 'listening'
    : 'idle';

  const handleMicAction = () => {
    speech.unlock();
    setApiError(null);
    recognition.clearError();
    audioRecorder.clearError();

    if (voiceState === 'listening') {
      if (audioRecorder.isRecording) {
        audioRecorder.stopAndSubmit();
      } else {
        recognition.stopAndSubmit();
      }
      return;
    }

    if (voiceState === 'thinking') {
      abortControllerRef.current?.abort();
      setIsThinking(false);
      return;
    }

    if (voiceState === 'speaking') {
      speech.stop();
      if (isVoiceSupported) {
        beginListening();
      }
      return;
    }

    if (!settings.apiKey.trim()) {
      setApiError('Add your free Google Gemini API key in Settings before speaking.');
      setIsSettingsOpen(true);
      return;
    }

    beginListening();
  };

  const handleCancelListening = () => {
    recognition.abort();
    audioRecorder.abort();
  };

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    setIsThinking(false);
    recognition.abort();
    audioRecorder.abort();
    speech.stop();
    setApiError(null);
    setMessages([]);
    clearMessages();
  };

  const handleScenarioChange = (scenario: ScenarioId) => {
    setSettings((prev) => ({ ...prev, scenario }));
    if (messages.length > 0) {
      handleNewChat();
    }
  };

  const handleLevelChange = (level: ConversationLevel) => {
    setSettings((prev) => ({ ...prev, level }));
  };

  const handleStartWithGreeting = () => {
    speech.unlock();
    const scenarioDef = getScenarioById(settings.scenario);
    const greetingMsg: ChatMessage = {
      id: createMessageId(),
      role: 'assistant',
      text: scenarioDef.starterPrompt,
      malayalamText: scenarioDef.starterPromptMl,
      timestamp: Date.now(),
    };
    setMessages([greetingMsg]);
    speakReplyWithAutoContinue(scenarioDef.starterPrompt, greetingMsg.id);
  };

  const handleSpeakText = (text: string, speechId: string, rate?: number) => {
    speech.unlock();
    recognition.abort();
    audioRecorder.abort();
    speech.speak(text, buildVoiceOptions(settings, speechId, rate));
  };

  const combinedError = apiError ?? recognition.error ?? audioRecorder.error;

  return (
    <div className="flex h-[100dvh] flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        scenario={settings.scenario}
        level={settings.level}
        theme={settings.theme}
        hasApiKey={Boolean(settings.apiKey.trim())}
        hasMessages={messages.length > 0}
        onScenarioChange={handleScenarioChange}
        onLevelChange={handleLevelChange}
        onToggleTheme={() =>
          setSettings((prev) => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark',
          }))
        }
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ConversationFeed
        messages={messages}
        scenario={settings.scenario}
        hasApiKey={Boolean(settings.apiKey.trim())}
        showMalayalam={settings.showMalayalamTranslation}
        isThinking={isThinking}
        activeSpeechId={speech.activeId}
        ttsRate={settings.ttsRate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartWithGreeting={handleStartWithGreeting}
        onSpeakText={handleSpeakText}
        onStopSpeaking={speech.stop}
        onRetryMessage={handleRetryMessage}
      />

      <VoiceControlDock
        voiceState={voiceState}
        isVoiceSupported={isVoiceSupported}
        isAudioRecorderActive={audioRecorder.isRecording}
        recordingSeconds={audioRecorder.elapsedSeconds}
        usingAudioFallback={usingAudioFallback}
        interimText={recognition.interimText}
        finalText={recognition.finalText}
        autoListen={settings.autoListen}
        errorMessage={combinedError}
        onDismissError={() => {
          setApiError(null);
          recognition.clearError();
          audioRecorder.clearError();
        }}
        onMicAction={handleMicAction}
        onCancelListening={handleCancelListening}
        onToggleAutoListen={() =>
          setSettings((prev) => ({ ...prev, autoListen: !prev.autoListen }))
        }
        onSendText={handleTurnSubmit}
      />

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          settings={settings}
          voices={speech.voices}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(updated) => {
            if (updated.sttMode !== settings.sttMode) {
              setBrowserSttBlocked(false);
            }
            setSettings(updated);
          }}
          onTestVoice={(draft) => {
            speech.unlock();
            speech.speak(
              'Hello! I am SpeakMe, your English speaking partner. Let us practice together!',
              buildVoiceOptions(draft, 'voice-preview')
            );
          }}
        />
      )}
    </div>
  );
}

export default App;
