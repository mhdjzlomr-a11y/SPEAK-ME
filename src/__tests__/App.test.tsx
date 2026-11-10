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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: 'Oh nice! Who did you meet at the office?',
                      hasCorrection: true,
                      correctedSentence: 'Yesterday I went to the office.',
                      explanation: 'Use past tense "went" when talking about yesterday.',
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
    );

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

    expect(screen.getByText(/Grammar & Phrasing Tip/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Yesterday I went to the office\./i)
    ).toBeInTheDocument();
  });
});
