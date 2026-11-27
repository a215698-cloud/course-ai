import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, PlusCircle, Send, Trash2 } from 'lucide-react';
import { SecretaryState } from '../types/secretary';
import { Translations } from '../i18n/translations';

interface ChatViewProps {
  state: SecretaryState;
  t: Translations;
  onSendMessage: (text: string) => Promise<void>;
  onApplySuggestedAction: (chatMessageId: string, actionIndex: number) => Promise<void>;
  onClearChat: () => Promise<void>;
}

export const ChatView: React.FC<ChatViewProps> = ({
  state,
  t,
  onSendMessage,
  onApplySuggestedAction,
  onClearChat,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatHistory.length]);

  const handleSubmit = async (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || sending) return;
    if (!textToSend) setInput('');
    setSending(true);
    setError(null);
    try {
      await onSendMessage(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach AI secretary.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[calc(100vh-11rem)] min-h-[520px]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">{t.chat.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.chat.subtitle}</p>
        </div>
        {state.chatHistory.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.chat.clearChat}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {state.chatHistory.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 space-y-6">
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
              Ask Kairo in English, 中文, or Bahasa Melayu. Responses are grounded in your inbox messages, deadlines, schedule alerts, and personal memory.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {t.chat.quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSubmit(prompt)}
                  className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          state.chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                }`}
              >
                {msg.content}
              </div>

              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-2xl">
                  {msg.suggestedActions.map((act, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={act.applied}
                      onClick={() => onApplySuggestedAction(msg.id, idx)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        act.applied
                          ? 'border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {act.applied ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mx-6 mb-2 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.chat.placeholder}
          className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t.actions.send}
        </button>
      </form>
    </div>
  );
};
