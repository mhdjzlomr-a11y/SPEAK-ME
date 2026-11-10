# SpeakMe — AI English Speaking Partner

Practice speaking English naturally in real time using free browser **Web Speech APIs** (Speech-to-Text & Text-to-Speech) paired with the **Google Gemini API** for conversational responses and instant grammar feedback.

## Features

- **Real-time Voice Conversation:** Speak using your browser microphone (`SpeechRecognition`) and hear natural replies spoken aloud (`speechSynthesis`).
- **Instant Grammar & Phrasing Feedback:** Every turn checks your sentence for grammar or phrasing improvements, explains why, suggests natural alternatives, and lets you listen to the corrected version.
- **Roleplay Scenarios & Levels:** Choose from *Free Talk*, *Daily Routine*, *Job Interview*, *Travel & Airport*, *Café & Ordering*, and *Office & Meetings* across *Beginner*, *Intermediate*, and *Advanced* levels.
- **Learner-Friendly Audio Controls:** Adjustable speaking speed (`0.75x–1.25x`), `0.8x Slow` replay on any reply, hands-free auto-continue mode, tap-to-interrupt, and accent selection (`en-US`, `en-IN`, `en-GB`, `en-AU`).
- **Text Fallback:** Works even in browsers without Web Speech STT or quiet environments.
- **Zero Backend Required:** Your Gemini API key stays in browser `localStorage` (BYOK) and calls Google Gemini directly.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the dev server:**
   ```bash
   npm run dev
   ```
3. **Add a free Gemini API key:**
   - Create a free API key at [Google AI Studio](https://aistudio.google.com/apikey).
   - Open **Settings** in SpeakMe, paste your key, and click **Test Key**.

## Scripts

- `npm run dev` — Start local development server
- `npm run build` — Type-check (`tsc -b`) and create production bundle in `dist/`
- `npm test` — Run unit & component tests with Vitest

## Browser Support

- **Speech-to-Text (Microphone):** Supported in Chromium browsers (Google Chrome, Microsoft Edge, Brave, Android Chrome) on `localhost` or `https://`.
- **Text-to-Speech & Text Input:** Supported across all modern browsers.

## Deploying to GitHub Pages / Vercel

Because `vite.config.ts` uses `base: './'`, the built `dist/` folder can be hosted directly on **GitHub Pages**, **Vercel**, or **Netlify** with zero extra server configuration.
