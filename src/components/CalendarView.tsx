import React, { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, MapPin } from 'lucide-react';
import { SecretaryState } from '../types/secretary';
import { Translations } from '../i18n/translations';
import { buildGoogleCalendarUrl, formatSourceName, getTodayIso } from '../utils/dateUtils';

interface CalendarViewProps {
  state: SecretaryState;
  t: Translations;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ state, t }) => {
  const todayIso = getTodayIso();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [cursorDate, setCursorDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();

  const daysGrid = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ iso: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, day: d });
    }
    return cells;
  }, [year, month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof state.tasks>();
    for (const task of state.tasks) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) || [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [state.tasks]);

  const selectedDayTasks = (tasksByDate.get(selectedDate) || []).sort((a, b) =>
    (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59')
  );

  const monthLabel = cursorDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">{t.calendar.exportHint}</p>
        <a
          href="/api/calendar/export.ics"
          download="kairo-schedule.ics"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          {t.actions.exportIcs}
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Month Grid */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">{monthLabel}</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCursorDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(todayIso);
                }}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t.calendar.today}
              </button>
              <button
                type="button"
                onClick={() => setCursorDate(new Date(year, month - 1, 1))}
                aria-label="Previous month"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursorDate(new Date(year, month + 1, 1))}
                aria-label="Next month"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mt-4 text-center text-xs font-medium text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mt-1">
            {daysGrid.map((cell, idx) => {
              if (!cell.iso || !cell.day) {
                return <div key={idx} className="h-20 rounded-lg" />;
              }
              const dayTasks = tasksByDate.get(cell.iso) || [];
              const openCount = dayTasks.filter((item) => item.status !== 'completed').length;
              const isSelected = cell.iso === selectedDate;
              const isToday = cell.iso === todayIso;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso!)}
                  className={`h-20 p-2 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isToday
                        ? 'text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {openCount > 0 && (
                    <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400 truncate">
                      {openCount} due
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">{selectedDate}</p>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {selectedDate === todayIso ? t.calendar.today : selectedDate}
            </h3>
          </div>

          {selectedDayTasks.length === 0 ? (
            <p className="py-8 text-sm text-slate-500 dark:text-slate-400">{t.calendar.noEventsDay}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedDayTasks.map((task) => (
                <div key={task.id} className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-semibold ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                        {task.dueTime || 'All day'} · {t.tasks[task.category]} · {formatSourceName(task.sourceApp)}
                      </p>
                    </div>
                  </div>
                  {task.location && (
                    <p className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {task.location}
                    </p>
                  )}
                  <div>
                    <a
                      href={buildGoogleCalendarUrl(task)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      {t.actions.addToGoogleCal}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
