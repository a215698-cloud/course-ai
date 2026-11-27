import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Menu, Plus } from 'lucide-react';
import { TRANSLATIONS } from './i18n/translations';
import {
  ImportanceLevel,
  MessageSource,
  PersonalMemory,
  PrivacySettings,
  SecretaryState,
  TaskCategory,
  UILanguage,
} from './types/secretary';
import { ActiveTab, Sidebar } from './components/Sidebar';
import { CaptureModal } from './components/CaptureModal';
import { OverviewView } from './components/OverviewView';
import { InboxView } from './components/InboxView';
import { TasksView } from './components/TasksView';
import { CalendarView } from './components/CalendarView';
import { ChatView } from './components/ChatView';
import { MemoryPrivacyView } from './components/MemoryPrivacyView';
import { AndroidBridgeView } from './components/AndroidBridgeView';
import { getRelativeDeadlineLabel } from './utils/dateUtils';

export default function App() {
  const [state, setState] = useState<SecretaryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [language, setLanguage] = useState<UILanguage>(() => {
    const saved = localStorage.getItem('kairo_lang');
    return saved === 'zh' || saved === 'ms' ? saved : 'en';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('kairo_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [runningCrossAnalysis, setRunningCrossAnalysis] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const notifiedTasksRef = useRef<Set<string>>(new Set());

  const t = TRANSLATIONS[language];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  useEffect(() => {
    localStorage.setItem('kairo_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('kairo_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/state');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load workspace');
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  // Proactive deadline alert watcher (browser Notifications API if granted)
  useEffect(() => {
    if (!state || !state.privacy.proactiveRemindersEnabled) return;
    if (notificationPermission !== 'granted') return;

    for (const task of state.tasks) {
      if (task.status === 'completed' || task.reminderDismissed || !task.dueDate) continue;
      if (notifiedTasksRef.current.has(task.id)) continue;
      const rel = getRelativeDeadlineLabel(task.dueDate, task.dueTime, language);
      if (rel.isOverdue || rel.isUrgent) {
        notifiedTasksRef.current.add(task.id);
        try {
          new Notification(`Kairo: ${task.title}`, {
            body: `${rel.label}${task.location ? ` · ${task.location}` : ''}`,
          });
        } catch {
          // Ignore environments blocking Notification constructor
        }
      }
    }
  }, [state, notificationPermission, language]);

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      showToast('Browser deadline alerts enabled.');
    }
  };

  const apiMutate = async (url: string, options: RequestInit, toastMsg?: string) => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    if (data.state) {
      setState(data.state);
    } else if (data.messages && data.tasks) {
      setState(data);
    }
    if (toastMsg) showToast(toastMsg);
    return data;
  };

  const handleIngest = async (payload: {
    source: MessageSource;
    sender: string;
    chatTitle: string;
    rawText: string;
  }) => {
    const data = await apiMutate(
      '/api/messages/ingest',
      {
        method: 'POST',
        body: JSON.stringify({ ...payload, uiLanguage: language }),
      },
      'Message analyzed and saved.'
    );
    if (data.message?.id) {
      setSelectedMessageId(data.message.id);
    }
  };

  const handleGenerateBriefing = async () => {
    setGeneratingBriefing(true);
    try {
      await apiMutate(
        '/api/briefings/generate',
        {
          method: 'POST',
          body: JSON.stringify({ uiLanguage: language }),
        },
        'Daily AI briefing updated.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate briefing.');
    } finally {
      setGeneratingBriefing(false);
    }
  };

  const handleRunCrossAnalysis = async () => {
    setRunningCrossAnalysis(true);
    try {
      const res = await apiMutate('/api/ai/cross-analyze', {
        method: 'POST',
        body: JSON.stringify({ uiLanguage: language }),
      });
      showToast(
        res.newAlertsCount > 0
          ? `Detected ${res.newAlertsCount} new schedule update(s).`
          : 'Schedule cross-analysis complete: no new conflicts.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cross-analysis failed.');
    } finally {
      setRunningCrossAnalysis(false);
    }
  };

  const pageMeta: Record<ActiveTab, { title: string; subtitle: string }> = {
    overview: { title: t.overview.title, subtitle: t.overview.subtitle },
    inbox: { title: t.inbox.title, subtitle: t.inbox.subtitle },
    tasks: { title: t.tasks.title, subtitle: t.tasks.subtitle },
    calendar: { title: t.calendar.title, subtitle: t.calendar.subtitle },
    chat: { title: t.chat.title, subtitle: t.chat.subtitle },
    memory: { title: t.memory.title, subtitle: t.memory.subtitle },
    android: { title: t.android.title, subtitle: t.android.subtitle },
  };

  if (loading && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2.5 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>{t.common.loading}</span>
        </div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void fetchState()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const current = state!;
  const counts = {
    unreadMessages: current.messages.filter((m) => !m.read).length,
    openTasks: current.tasks.filter((task) => task.status !== 'completed').length,
    pendingChanges: current.scheduleChanges.filter((c) => c.status === 'pending').length,
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={language}
        onLanguageChange={setLanguage}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        t={t}
        counts={counts}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Top Header Bar */}
        <header className="h-16 px-4 sm:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                {pageMeta[activeTab].title}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.actions.captureMessage}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              state={current}
              language={language}
              t={t}
              generatingBriefing={generatingBriefing}
              runningCrossAnalysis={runningCrossAnalysis}
              onGenerateBriefing={handleGenerateBriefing}
              onRunCrossAnalysis={handleRunCrossAnalysis}
              onApplyScheduleChange={async (id) => {
                await apiMutate(`/api/schedule-changes/${id}/apply`, { method: 'POST' }, 'Schedule updated.');
              }}
              onDismissScheduleChange={async (id) => {
                await apiMutate(`/api/schedule-changes/${id}/dismiss`, { method: 'POST' });
              }}
              onToggleTaskStatus={async (id, status) => {
                await apiMutate(`/api/tasks/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ status }),
                });
              }}
              onDismissReminder={async (id) => {
                await apiMutate(`/api/tasks/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ reminderDismissed: true }),
                });
              }}
              onRequestNotifications={requestNotifications}
              notificationPermission={notificationPermission}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'inbox' && (
            <InboxView
              state={current}
              t={t}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              onOpenCapture={() => setCaptureOpen(true)}
              onIngest={handleIngest}
              onLoadSamples={async () => {
                const res = await apiMutate(
                  '/api/messages/load-samples',
                  {
                    method: 'POST',
                    body: JSON.stringify({ uiLanguage: language }),
                  }
                );
                showToast(
                  res.addedCount > 0
                    ? `Loaded ${res.addedCount} sample message(s).`
                    : 'Sample messages already present.'
                );
              }}
              onRunCrossAnalysis={handleRunCrossAnalysis}
              onMarkRead={async (id, read) => {
                await apiMutate(`/api/messages/${id}/read`, {
                  method: 'PATCH',
                  body: JSON.stringify({ read }),
                });
              }}
              onDeleteMessage={async (id) => {
                await apiMutate(`/api/messages/${id}`, { method: 'DELETE' }, 'Message deleted.');
                if (selectedMessageId === id) setSelectedMessageId(null);
              }}
              onNavigate={setActiveTab}
              runningCrossAnalysis={runningCrossAnalysis}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              state={current}
              language={language}
              t={t}
              onCreateTask={async (payload: {
                title: string;
                description: string;
                category: TaskCategory;
                priority: ImportanceLevel;
                dueDate: string;
                dueTime: string;
                location: string;
              }) => {
                await apiMutate(
                  '/api/tasks',
                  {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  },
                  'Task added.'
                );
              }}
              onToggleStatus={async (id, status) => {
                await apiMutate(`/api/tasks/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ status }),
                });
              }}
              onDeleteTask={async (id) => {
                await apiMutate(`/api/tasks/${id}`, { method: 'DELETE' }, 'Task deleted.');
              }}
              onInspectSourceMessage={(msgId) => {
                setSelectedMessageId(msgId);
                setActiveTab('inbox');
              }}
            />
          )}

          {activeTab === 'calendar' && <CalendarView state={current} t={t} />}

          {activeTab === 'chat' && (
            <ChatView
              state={current}
              t={t}
              onSendMessage={async (message) => {
                await apiMutate('/api/ai/chat', {
                  method: 'POST',
                  body: JSON.stringify({ message, uiLanguage: language }),
                });
              }}
              onApplySuggestedAction={async (chatMessageId, actionIndex) => {
                await apiMutate(
                  '/api/ai/chat/apply-action',
                  {
                    method: 'POST',
                    body: JSON.stringify({ chatMessageId, actionIndex }),
                  },
                  'Saved to workspace.'
                );
              }}
              onClearChat={async () => {
                await apiMutate('/api/ai/chat', { method: 'DELETE' });
              }}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryPrivacyView
              state={current}
              t={t}
              onAddMemory={async (payload: {
                key: string;
                content: string;
                category: PersonalMemory['category'];
              }) => {
                await apiMutate(
                  '/api/memories',
                  {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  },
                  'Memory saved.'
                );
              }}
              onDeleteMemory={async (id) => {
                await apiMutate(`/api/memories/${id}`, { method: 'DELETE' }, 'Memory removed.');
              }}
              onUpdatePrivacy={async (patch: Partial<PrivacySettings>) => {
                await apiMutate('/api/privacy', {
                  method: 'PATCH',
                  body: JSON.stringify(patch),
                });
              }}
              onResetWorkspace={async (mode) => {
                await apiMutate(
                  '/api/reset',
                  {
                    method: 'POST',
                    body: JSON.stringify({ mode }),
                  },
                  'Workspace cleared.'
                );
              }}
            />
          )}

          {activeTab === 'android' && <AndroidBridgeView t={t} />}
        </main>
      </div>

      <CaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onIngest={handleIngest}
        t={t}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
