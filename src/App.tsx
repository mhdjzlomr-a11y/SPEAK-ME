import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationFeed } from './components/ConversationFeed';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { VoiceControlDock } from './components/VoiceControlDock';
import { getScenarioById } from './constants/scenarios';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { GeminiApiError, sendConversationTurn } from './services/gemini';
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const speech = useSpeechSynthesis();

  // Keep a ref to recognition start so TTS onEnd callback never captures stale closures.
  const startListeningRef = useRef<() => void>(() => {});

  const speakReplyWithAutoContinue = useCallback(
    (text: string, messageId: string) => {
      const currentSettings = settingsRef.current;
      speech.speak(text, {
        id: messageId,
        rate: currentSettings.ttsRate,
        preferredVoiceURI: currentSettings.ttsVoiceURI,
        preferredLang: currentSettings.sttLang,
        onEnd: () => {
          if (settingsRef.current.autoListen) {
            window.setTimeout(() => {
              startListeningRef.current();
            }, 250);
          }
        },
      });
    },
    [speech]
  );

  const handleTurnSubmit = useCallback(
    async (rawText: string) => {
      const userText = rawText.trim();
      if (!userText) return;

      const currentSettings = settingsRef.current;
      if (!currentSettings.apiKey.trim()) {
        setApiError('Add your free Google Gemini API key in Settings first.');
        setIsSettingsOpen(true);
        return;
      }

      // Stop any active audio before starting a new AI turn.
      speech.stop();
      setApiError(null);

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        text: userText,
        timestamp: Date.now(),
      };

      const priorHistory = messagesRef.current;
      setMessages((prev) => [...prev, userMessage]);
      setIsThinking(true);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await sendConversationTurn({
          apiKey: currentSettings.apiKey,
          model: currentSettings.model,
          history: priorHistory,
          userMessage: userText,
          level: currentSettings.level,
          scenario: currentSettings.scenario,
          signal: controller.signal,
        });

        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          text: result.reply,
          timestamp: Date.now(),
        };

        setMessages((prev) =>
          prev
            .map((msg) =>
              msg.id === userMessage.id
                ? { ...msg, feedback: result.feedback }
                : msg
            )
            .concat(assistantMessage)
        );
        setIsThinking(false);

        speakReplyWithAutoContinue(result.reply, assistantMessage.id);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setIsThinking(false);
          return;
        }

        const friendlyError =
          err instanceof GeminiApiError
            ? err.message
            : 'Something went wrong getting an AI reply. Please try again.';

        setIsThinking(false);
        setApiError(friendlyError);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, error: friendlyError } : msg
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

  const recognition = useSpeechRecognition({
    lang: settings.sttLang,
    autoSendOnSilence: settings.autoSendOnSilence,
    onFinalTranscript: handleTurnSubmit,
  });

  startListeningRef.current = () => {
    if (recognition.isSupported && !isThinking) {
      speech.stop();
      recognition.start();
    }
  };

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const voiceState: VoiceState = isThinking
    ? 'thinking'
    : speech.isSpeaking
    ? 'speaking'
    : recognition.isListening
    ? 'listening'
    : 'idle';

  const handleMicAction = () => {
    setApiError(null);
    recognition.clearError();

    if (voiceState === 'listening') {
      recognition.stopAndSubmit();
      return;
    }

    if (voiceState === 'thinking') {
      abortControllerRef.current?.abort();
      setIsThinking(false);
      return;
    }

    if (voiceState === 'speaking') {
      // Interrupt AI speech immediately and begin listening for the user.
      speech.stop();
      if (recognition.isSupported) {
        recognition.start();
      }
      return;
    }

    if (!settings.apiKey.trim()) {
      setApiError('Add your free Google Gemini API key in Settings before speaking.');
      setIsSettingsOpen(true);
      return;
    }

    recognition.start();
  };

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    setIsThinking(false);
    recognition.abort();
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
    const scenarioDef = getScenarioById(settings.scenario);
    const greetingMsg: ChatMessage = {
      id: createMessageId(),
      role: 'assistant',
      text: scenarioDef.starterPrompt,
      timestamp: Date.now(),
    };
    setMessages([greetingMsg]);
    speakReplyWithAutoContinue(scenarioDef.starterPrompt, greetingMsg.id);
  };

  const handleSpeakText = (text: string, speechId: string, rate?: number) => {
    recognition.abort();
    speech.speak(text, {
      id: speechId,
      rate: rate ?? settings.ttsRate,
      preferredVoiceURI: settings.ttsVoiceURI,
      preferredLang: settings.sttLang,
    });
  };

  const combinedError = apiError ?? recognition.error;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <Header
        scenario={settings.scenario}
        level={settings.level}
        hasApiKey={Boolean(settings.apiKey.trim())}
        hasMessages={messages.length > 0}
        onScenarioChange={handleScenarioChange}
        onLevelChange={handleLevelChange}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ConversationFeed
        messages={messages}
        scenario={settings.scenario}
        hasApiKey={Boolean(settings.apiKey.trim())}
        isThinking={isThinking}
        activeSpeechId={speech.activeId}
        ttsRate={settings.ttsRate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onStartWithGreeting={handleStartWithGreeting}
        onSpeakText={handleSpeakText}
        onStopSpeaking={speech.stop}
      />

      <VoiceControlDock
        voiceState={voiceState}
        isSpeechSupported={recognition.isSupported}
        interimText={recognition.interimText}
        finalText={recognition.finalText}
        autoListen={settings.autoListen}
        errorMessage={combinedError}
        onDismissError={() => {
          setApiError(null);
          recognition.clearError();
        }}
        onMicAction={handleMicAction}
        onCancelListening={recognition.abort}
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
          onSave={(updated) => setSettings(updated)}
          onTestVoice={(voiceURI, rate, lang) =>
            speech.speak(
              'Hello! I am SpeakMe, your English speaking partner. Let us practice together!',
              {
                id: 'voice-preview',
                rate,
                preferredVoiceURI: voiceURI,
                preferredLang: lang,
              }
            )
          }
        />
      )}
    </div>
  );
}

export default App;
