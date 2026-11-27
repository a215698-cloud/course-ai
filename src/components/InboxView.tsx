import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  MailOpen,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { IngestedMessage, MessageSource, SecretaryState } from '../types/secretary';
import { Translations } from '../i18n/translations';
import { formatSourceName, importanceTextColor, parseWhatsAppTxtExport } from '../utils/dateUtils';
import { ActiveTab } from './Sidebar';

interface InboxViewProps {
  state: SecretaryState;
  t: Translations;
  selectedMessageId: string | null;
  onSelectMessage: (id: string | null) => void;
  onOpenCapture: () => void;
  onIngest: (payload: {
    source: MessageSource;
    sender: string;
    chatTitle: string;
    rawText: string;
  }) => Promise<void>;
  onLoadSamples: () => Promise<void>;
  onRunCrossAnalysis: () => Promise<void>;
  onMarkRead: (id: string, read: boolean) => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
  onNavigate: (tab: ActiveTab) => void;
  runningCrossAnalysis: boolean;
}

export const InboxView: React.FC<InboxViewProps> = ({
  state,
  t,
  selectedMessageId,
  onSelectMessage,
  onOpenCapture,
  onIngest,
  onLoadSamples,
  onRunCrossAnalysis,
  onMarkRead,
  onDeleteMessage,
  onNavigate,
  runningCrossAnalysis,
}) => {
  const [filter, setFilter] = useState<'all' | 'important' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [importingTxt, setImportingTxt] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMessages = state.messages.filter((m) => {
    if (filter === 'important' && m.importance !== 'critical' && m.importance !== 'high') return false;
    if (filter === 'unread' && m.read) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.sender.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.redactedText.toLowerCase().includes(q) ||
        (m.chatTitle || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeMessage: IngestedMessage | null =
    filteredMessages.find((m) => m.id === selectedMessageId) || filteredMessages[0] || null;

  const linkedTasks = activeMessage
    ? state.tasks.filter((task) => task.sourceMessageId === activeMessage.id)
    : [];

  const handleLoadSamples = async () => {
    setLoadingSamples(true);
    setImportError(null);
    try {
      await onLoadSamples();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to load sample messages.');
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingTxt(true);
    setImportError(null);
    try {
      const text = await file.text();
      const parsedEntries = parseWhatsAppTxtExport(text);
      for (const entry of parsedEntries) {
        await onIngest({
          source: 'whatsapp',
          sender: entry.sender,
          chatTitle: file.name.replace(/\.txt$/i, ''),
          rawText: entry.text,
        });
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import chat log.');
    } finally {
      setImportingTxt(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'important', 'unread'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {key === 'all' ? t.inbox.filterAll : key === 'important' ? t.inbox.filterImportant : t.inbox.filterUnread}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sender, summary..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 w-52"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importingTxt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            {importingTxt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {t.actions.importChatLog}
          </button>

          <button
            type="button"
            onClick={handleLoadSamples}
            disabled={loadingSamples}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            {loadingSamples ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {t.actions.loadSamplePack}
          </button>

          <button
            type="button"
            onClick={onRunCrossAnalysis}
            disabled={runningCrossAnalysis}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningCrossAnalysis ? 'animate-spin' : ''}`} />
            {t.actions.runCrossAnalysis}
          </button>
        </div>
      </div>

      {importError && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {importError}
        </div>
      )}

      {filteredMessages.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.inbox.emptyTitle}
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {t.inbox.emptyDesc}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenCapture}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              {t.actions.captureMessage}
            </button>
            <button
              type="button"
              onClick={handleLoadSamples}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t.actions.loadSamplePack}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Message List */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {filteredMessages.map((msg) => {
              const selected = activeMessage?.id === msg.id;
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    onSelectMessage(msg.id);
                    if (!msg.read) void onMarkRead(msg.id, true);
                  }}
                  className={`w-full text-left p-4 transition-colors ${
                    selected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={importanceTextColor(msg.importance)}>{t.common[msg.importance]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatSourceName(msg.source)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{msg.detectedLanguages.join('/')}</span>
                    </div>
                    <span className="font-mono tabular-nums shrink-0">
                      {new Date(msg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className={`mt-1.5 text-sm truncate ${msg.read ? 'font-medium text-slate-800 dark:text-slate-200' : 'font-semibold text-slate-900 dark:text-white'}`}>
                    {msg.sender}
                    {msg.chatTitle ? ` · ${msg.chatTitle}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {msg.summary}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detail Inspector */}
          {activeMessage && (
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className={importanceTextColor(activeMessage.importance)}>
                      {t.common[activeMessage.importance]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatSourceName(activeMessage.source)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {new Date(activeMessage.receivedAt).toLocaleString()}
                    </span>
                    {activeMessage.isSample && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Sample Test Entry</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {activeMessage.sender}
                    {activeMessage.chatTitle ? ` — ${activeMessage.chatTitle}` : ''}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMarkRead(activeMessage.id, !activeMessage.read)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <MailOpen className="w-3.5 h-3.5" />
                    {activeMessage.read ? 'Mark Unread' : 'Mark Read'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMessage(activeMessage.id)}
                    aria-label="Delete message"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* AI Summary */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">AI Summary</p>
                <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">{activeMessage.summary}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{activeMessage.importanceReason}</p>
              </div>

              {/* Extracted Entities */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                  {t.inbox.extractedEntities}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Dates & Times: </span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {[...activeMessage.entities.dates, ...activeMessage.entities.times].join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Locations: </span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {activeMessage.entities.locations.join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">People: </span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {activeMessage.entities.people.join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Languages: </span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {activeMessage.detectedLanguages.join(' + ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Linked Tasks */}
              {linkedTasks.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t.inbox.linkedTasks}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('tasks')}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t.nav.tasks} →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {linkedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              task.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {task.title}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                          {task.dueDate || '—'} {task.dueTime || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Original / Redacted Text */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t.inbox.originalText}
                  </p>
                  {state.privacy.redactSensitiveInfo && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t.inbox.redactedNote}
                    </span>
                  )}
                </div>
                <p className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {activeMessage.redactedText}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
