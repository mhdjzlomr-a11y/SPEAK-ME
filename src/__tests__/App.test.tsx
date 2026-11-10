import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

describe('App integration flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: vi.fn(),
        cancel: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    // Simple SpeechSynthesisUtterance polyfill for jsdom
    if (typeof window.SpeechSynthesisUtterance === 'undefined') {
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
        class {
          text: string;
          rate = 1;
          pitch = 1;
          lang = 'en-US';
          voice: SpeechSynthesisVoice | null = null;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor(text: string) {
            this.text = text;
          }
        };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows onboarding when API key is missing, saves key in Settings, and completes a conversation turn with grammar feedback', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        reply: 'Oh nice! Who did you meet at the office?',
                        replyMalayalam: 'നല്ലത്! ഓഫീസിൽ വെച്ച് ആരെയാണ് കണ്ടത്?',
                        hasCorrection: true,
                        correctedSentence: 'Yesterday I went to the office.',
                        explanation: 'Use past tense "went" when talking about yesterday.',
                        explanationMalayalam: 'ഇന്നലത്തെ കാര്യം പറയുമ്പോൾ "went" ഉപയോഗിക്കുക.',
                        betterAlternative: 'I went into the office yesterday.',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValue(new Response('{}', { status: 404 }));

    render(<App />);

    expect(
      screen.getByText(/Add your free Google Gemini API key/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add API Key/i }));

    const keyInput = screen.getByLabelText(/Google Gemini API Key/i);
    fireEvent.change(keyInput, { target: { value: 'AIzaTestKey123' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    const textInput = screen.getByLabelText(/Type an English message/i);
    fireEvent.change(textInput, { target: { value: 'Yesterday I go to office.' } });
    fireEvent.submit(textInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('Oh nice! Who did you meet at the office?')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('നല്ലത്! ഓഫീസിൽ വെച്ച് ആരെയാണ് കണ്ടത്?')
    ).toBeInTheDocument();
    expect(screen.getByText(/Grammar & Phrasing Tip/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Yesterday I went to the office\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText('ഇന്നലത്തെ കാര്യം പറയുമ്പോൾ "went" ഉപയോഗിക്കുക.')
    ).toBeInTheDocument();
  });

  it('automatically switches to Gemini Voice Mic when browser SpeechRecognition fires a network error', async () => {
    window.localStorage.setItem(
      'speakme_settings_v1',
      JSON.stringify({ apiKey: 'AIzaTestKey123', sttMode: 'auto' })
    );

    const stopTrackMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrackMock }],
        }),
      },
    });

    class MockMediaRecorder {
      static isTypeSupported = () => true;
      state: RecordingState = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;

    class FailingSpeechRecognition {
      continuous = true;
      interimResults = true;
      lang = 'en-US';
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onerror?.({ error: 'network' });
        this.onend?.();
      }
      stop() {}
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      FailingSpeechRecognition;

    render(<App />);

    const micButton = screen.getByRole('button', { name: /Tap mic to speak English/i });
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText(/Recording voice/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/Speech recognition needs an internet connection/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(stopTrackMock).toHaveBeenCalled();

    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('toggles between dark theme and white (light) theme', () => {
    render(<App />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const toggleToLight = screen.getByRole('button', { name: /Switch to White theme/i });
    fireEvent.click(toggleToLight);

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    const toggleToDark = screen.getByRole('button', { name: /Switch to Dark theme/i });
    fireEvent.click(toggleToDark);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('allows retrying a failed message inline after temporary server overload', async () => {
    window.localStorage.setItem(
      'speakme_settings_v1',
      JSON.stringify({ apiKey: 'AIzaTestKey123' })
    );

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        reply: "I'm doing wonderful! How is your day?",
                        replyMalayalam: 'എനിക്ക് സുഖമാണ്! നിങ്ങളുടെ ദിവസം എങ്ങനെയുണ്ട്?',
                        hasCorrection: false,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValue(new Response('{}', { status: 404 }));

    render(<App />);

    const textInput = screen.getByLabelText(/Type an English message/i);
    fireEvent.change(textInput, { target: { value: 'How are you' } });
    fireEvent.submit(textInput.closest('form')!);

    const retryButton = await screen.findByRole('button', { name: /Retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(
        screen.getByText("I'm doing wonderful! How is your day?")
      ).toBeInTheDocument();
    });
  });
});
