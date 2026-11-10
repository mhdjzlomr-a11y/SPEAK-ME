import { Mic, Moon, RotateCcw, Settings, Sun } from 'lucide-react';
import { LEVELS, SCENARIOS } from '../constants/scenarios';
import type { ConversationLevel, ScenarioId, ThemeMode } from '../types/conversation';

interface HeaderProps {
  scenario: ScenarioId;
  level: ConversationLevel;
  theme: ThemeMode;
  hasApiKey: boolean;
  hasMessages: boolean;
  onScenarioChange: (scenario: ScenarioId) => void;
  onLevelChange: (level: ConversationLevel) => void;
  onToggleTheme: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export function Header({
  scenario,
  level,
  theme,
  hasApiKey,
  hasMessages,
  onScenarioChange,
  onLevelChange,
  onToggleTheme,
  onNewChat,
  onOpenSettings,
}: HeaderProps) {
  const controlClasses =
    'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">
              SpeakMe
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
              AI English Speaking Partner
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="scenario-select">
            Practice Scenario
          </label>
          <select
            id="scenario-select"
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value as ScenarioId)}
            className={controlClasses}
            title="Choose practice topic"
          >
            {SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="level-select">
            English Level
          </label>
          <select
            id="level-select"
            value={level}
            onChange={(e) => onLevelChange(e.target.value as ConversationLevel)}
            className={controlClasses}
            title="Choose English level"
          >
            {LEVELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            aria-label={theme === 'dark' ? 'Switch to White theme' : 'Switch to Dark theme'}
            title={theme === 'dark' ? 'Switch to White theme' : 'Switch to Dark theme'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {hasMessages && (
            <button
              type="button"
              onClick={onNewChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Start new conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Open Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
            {!hasApiKey && (
              <span
                className="h-2 w-2 rounded-full bg-amber-400"
                title="Gemini API key needed"
              />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
