import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { SecretaryState, UILanguage } from '../types/secretary';
import { Translations } from '../i18n/translations';
import { formatSourceName, getRelativeDeadlineLabel, importanceTextColor } from '../utils/dateUtils';
import { ActiveTab } from './Sidebar';

interface OverviewViewProps {
  state: SecretaryState;
  language: UILanguage;
  t: Translations;
  generatingBriefing: boolean;
  runningCrossAnalysis: boolean;
  onGenerateBriefing: () => Promise<void>;
  onRunCrossAnalysis: () => Promise<void>;
  onApplyScheduleChange: (id: string) => Promise<void>;
  onDismissScheduleChange: (id: string) => Promise<void>;
  onToggleTaskStatus: (id: string, nextStatus: 'completed' | 'pending') => Promise<void>;
  onDismissReminder: (id: string) => Promise<void>;
  onRequestNotifications: () => void;
  notificationPermission: string;
  onNavigate: (tab: ActiveTab) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  language,
  t,
  generatingBriefing,
  runningCrossAnalysis,
  onGenerateBriefing,
  onRunCrossAnalysis,
  onApplyScheduleChange,
  onDismissScheduleChange,
  onToggleTaskStatus,
  onDismissReminder,
  onRequestNotifications,
  notificationPermission,
  onNavigate,
}) => {
  const openTasks = state.tasks.filter((task) => task.status !== 'completed');
  const importantMessages = state.messages.filter((m) => m.importance === 'critical' || m.importance === 'high');
  const pendingChanges = state.scheduleChanges.filter((c) => c.status === 'pending');
  const latestBriefing = state.briefings[0] || null;

  const sortedDeadlines = [...openTasks]
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return `${a.dueDate} ${a.dueTime || '23:59'}`.localeCompare(`${b.dueDate} ${b.dueTime || '23:59'}`);
    })
    .slice(0, 6);

  const proactiveReminders = sortedDeadlines.filter((task) => {
    if (task.reminderDismissed || !task.dueDate) return false;
    const rel = getRelativeDeadlineLabel(task.dueDate, task.dueTime, language);
    return rel.isOverdue || rel.isUrgent;
  });

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="text-left p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.statsActiveTasks}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {openTasks.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inbox')}
          className="text-left p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.statsImportantMsgs}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {importantMessages.length}
          </p>
        </button>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.statsScheduleAlerts}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
            {pendingChanges.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('memory')}
          className="text-left p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.statsMemories}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {state.memories.length}
          </p>
        </button>
      </div>

      {/* Main Grid: Daily AI Briefing + Schedule Change Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Daily Briefing Card */}
        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.overview.briefingTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {latestBriefing ? `${latestBriefing.date} · ${latestBriefing.language.toUpperCase()}` : t.overview.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onGenerateBriefing}
                disabled={generatingBriefing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {generatingBriefing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingBriefing ? t.overview.generatingBriefing : t.actions.generateBriefing}
              </button>
            </div>

            {latestBriefing ? (
              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {latestBriefing.headline}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {latestBriefing.overview}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      {t.overview.topPriorities}
                    </h4>
                    <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {latestBriefing.topPriorities.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-mono text-xs text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                            0{idx + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      {t.overview.todaySchedule}
                    </h4>
                    <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {latestBriefing.scheduleSummary.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 mt-1 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {latestBriefing.watchouts.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                      {t.overview.watchouts}
                    </h4>
                    <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {latestBriefing.watchouts.map((w, idx) => (
                        <li key={idx}>· {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {t.overview.briefingEmpty}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Cross-Message Schedule Changes & Proactive Reminders */}
        <section className="xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.overview.scheduleChanges}
              </h2>
              <button
                type="button"
                onClick={onRunCrossAnalysis}
                disabled={runningCrossAnalysis}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${runningCrossAnalysis ? 'animate-spin' : ''}`} />
                {t.actions.runCrossAnalysis}
              </button>
            </div>

            {pendingChanges.length === 0 ? (
              <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
                No pending schedule conflicts or changes detected across your messages.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingChanges.map((change) => (
                  <div key={change.id} className="py-4 first:pt-3 last:pb-0 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          {change.changeType.replace('_', ' ')}
                        </p>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                          {change.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{change.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <span className="line-through">{change.previousValue}</span>
                      <ArrowRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-slate-900 dark:text-slate-100 font-medium">{change.newValue}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onApplyScheduleChange(change.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t.actions.applyChange}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissScheduleChange(change.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t.actions.dismiss}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proactive Reminders Queue */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t.overview.proactiveReminders}
                </h2>
              </div>
              {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={onRequestNotifications}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  {t.actions.enableBrowserAlerts}
                </button>
              )}
            </div>

            {proactiveReminders.length === 0 ? (
              <p className="py-5 text-sm text-slate-500 dark:text-slate-400">
                No urgent reminders triggered right now.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {proactiveReminders.map((task) => {
                  const rel = getRelativeDeadlineLabel(task.dueDate, task.dueTime, language);
                  return (
                    <div key={task.id} className="py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span className={rel.isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                            {rel.label}
                          </span>
                          {task.location && (
                            <>
                              <span className="mx-1.5">·</span>
                              <span>{task.location}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDismissReminder(task.id)}
                        className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap shrink-0"
                      >
                        {t.actions.dismiss}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Upcoming Deadlines Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.overview.urgentDeadlines}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            {t.nav.tasks} →
          </button>
        </div>

        {sortedDeadlines.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t.tasks.emptyDesc}</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedDeadlines.map((task) => {
              const rel = getRelativeDeadlineLabel(task.dueDate, task.dueTime, language);
              return (
                <div
                  key={task.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleTaskStatus(task.id, 'completed')}
                      aria-label={`Mark ${task.title} complete`}
                      className="mt-0.5 w-4 h-4 rounded border border-slate-300 dark:border-slate-600 hover:border-blue-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{task.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className={importanceTextColor(task.priority)}>{t.common[task.priority]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.tasks[task.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {formatSourceName(task.sourceApp)}
                          {task.sourceSender ? ` (${task.sourceSender})` : ''}
                        </span>
                        {task.location && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {task.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 sm:pl-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-mono tabular-nums ${
                        rel.isOverdue
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : rel.isUrgent
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {rel.isOverdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                      {rel.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
