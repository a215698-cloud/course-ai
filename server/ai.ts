import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  DailyBriefing,
  ImportanceLevel,
  PersonalMemory,
  SecretaryState,
  SecretaryTask,
  UILanguage,
} from '../src/types/secretary.ts';

import { formatTimestampMYT, getKualaLumpurParts, KUALA_LUMPUR_TZ } from './timezone.ts';

export class AiServiceError extends Error {
  public readonly statusCode: number;
  public readonly errorCode = 'AI_SERVICE_ERROR';

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'AiServiceError';
    this.statusCode = statusCode;
  }
}

export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiServiceError(
      'GEMINI_API_KEY is not configured on the server. Configure it in AI Studio Secrets or Cloud Run environment variables.',
      503
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getTodayIso(): string {
  return getKualaLumpurParts().isoDate;
}

function getCurrentContextLine(): string {
  const kl = getKualaLumpurParts();
  return `${kl.isoDate} (${kl.weekday}) ${kl.time24} [${KUALA_LUMPUR_TZ} / UTC+8]`;
}

function getLanguageName(lang: UILanguage): string {
  if (lang === 'zh') return 'Simplified Chinese (简体中文)';
  if (lang === 'ms') return 'Bahasa Melayu';
  return 'English';
}

function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED');
}

async function generateJsonWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    thinkingLevel: ThinkingLevel;
    responseSchema: Record<string, unknown>;
  }
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: params.contents,
        config: {
          thinkingConfig: { thinkingLevel: params.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      });
      return (response.text ?? '').trim();
    } catch (err) {
      lastErr = err;
      if (!isTransientAiError(err)) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        throw new AiServiceError(`Gemini AI request failed: ${rawMsg}`, 502);
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 700));
      }
    }
  }

  try {
    const fallback = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: params.contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      },
    });
    return (fallback.text ?? '').trim();
  } catch (fallbackErr) {
    if (isTransientAiError(fallbackErr) || isTransientAiError(lastErr)) {
      throw new AiServiceError('Gemini AI is temporarily busy (503). Please try again in a few seconds.', 503);
    }
    const rawMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    throw new AiServiceError(`Gemini AI fallback request failed: ${rawMsg}`, 502);
  }
}

export interface AnalyzedMessageResult {
  detectedLanguages: string[];
  summary: string;
  importance: ImportanceLevel;
  importanceReason: string;
  entities: {
    dates: string[];
    times: string[];
    locations: string[];
    people: string[];
    actionItems: string[];
  };
  extractedTasks: Array<{
    title: string;
    description: string;
    category: 'assignment' | 'meeting' | 'task' | 'reminder';
    priority: ImportanceLevel;
    dueDate: string | null;
    dueTime: string | null;
    location: string | null;
  }>;
  scheduleChange: {
    detected: boolean;
    title: string;
    changeType: 'rescheduled' | 'location_changed' | 'cancelled' | 'conflict' | 'new_requirement';
    summary: string;
    previousValue: string;
    newValue: string;
    targetTaskId: string | null;
    proposedDueDate: string | null;
    proposedDueTime: string | null;
    proposedLocation: string | null;
  } | null;
}

export async function analyzeMessageWithAI(params: {
  text: string;
  source: string;
  sender: string;
  chatTitle?: string;
  receivedAt?: string;
  uiLanguage: UILanguage;
  existingTasks: SecretaryTask[];
  memories: PersonalMemory[];
}): Promise<AnalyzedMessageResult> {
  const ai = getGeminiClient();
  const todayIso = getTodayIso();
  const currentContext = getCurrentContextLine();
  const receivedMyt = params.receivedAt ? formatTimestampMYT(params.receivedAt) : currentContext;

  const tasksContext = params.existingTasks
    .filter((t) => t.status !== 'completed')
    .slice(0, 25)
    .map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      location: t.location,
    }));

  const memoryContext = params.memories.slice(0, 20).map((m) => `${m.key} (${m.category}): ${m.content}`);

  const prompt = `Analyze the following incoming message for a personal AI secretary.
Timezone: ${KUALA_LUMPUR_TZ} (UTC+8).
Current Reference Date & Time (Malaysia Time): ${currentContext}.
Message Received At (Malaysia Time): ${receivedMyt}.
Preferred Summary Language: ${getLanguageName(params.uiLanguage)}.
Source App: ${params.source}
Sender: ${params.sender}
Chat/Group Title: ${params.chatTitle || 'Direct'}

Message Content (may be English, Chinese, Malay, or mixed-language/rojak):
"""
${params.text}
"""

Personal Memory Context:
${memoryContext.length > 0 ? memoryContext.join('\n') : 'None'}

Existing Open Tasks & Meetings (check if this message modifies, reschedules, moves, or cancels any of these):
${JSON.stringify(tasksContext)}

Instructions:
1. Understand English, Chinese, Malay, and mixed-language slang/rojak accurately (e.g. "esok" = tomorrow, "lusa" = day after tomorrow, "pukul 4 petang" = 16:00, "下周四" = next Thursday, "kat" = at).
2. Always resolve ALL relative dates and times strictly in ${KUALA_LUMPUR_TZ} (UTC+8) based on the message arrival date and current reference ${currentContext}. Convert dates into exact YYYY-MM-DD (relative to ${todayIso} in MYT) and times into 24-hour HH:mm. Never shift dates to UTC.
3. Write the "summary" and "importanceReason" in ${getLanguageName(params.uiLanguage)} while preserving exact proper nouns, room names, and course codes.
4. Classify importance as critical, high, normal, or low.
5. Extract actionable tasks, assignments, meetings, or reminders. Use null (or empty string if absent) when date/time/location is not specified.
6. If this message modifies/reschedules/cancels an existing open task/meeting OR announces a change ("moved to", "postponed", "改到", "ditunda", "tukar bilik"), set scheduleChange.detected = true and match targetTaskId if applicable.`;

  const rawJson = await generateJsonWithFallback(ai, {
    contents: prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        detectedLanguages: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        summary: { type: Type.STRING },
        importance: {
          type: Type.STRING,
          enum: ['critical', 'high', 'normal', 'low'],
        },
        importanceReason: { type: Type.STRING },
        entities: {
          type: Type.OBJECT,
          properties: {
            dates: { type: Type.ARRAY, items: { type: Type.STRING } },
            times: { type: Type.ARRAY, items: { type: Type.STRING } },
            locations: { type: Type.ARRAY, items: { type: Type.STRING } },
            people: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['dates', 'times', 'locations', 'people', 'actionItems'],
        },
        extractedTasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: {
                type: Type.STRING,
                enum: ['assignment', 'meeting', 'task', 'reminder'],
              },
              priority: {
                type: Type.STRING,
                enum: ['critical', 'high', 'normal', 'low'],
              },
              dueDate: { type: Type.STRING, nullable: true },
              dueTime: { type: Type.STRING, nullable: true },
              location: { type: Type.STRING, nullable: true },
            },
            required: ['title', 'description', 'category', 'priority'],
          },
        },
        scheduleChange: {
          type: Type.OBJECT,
          properties: {
            detected: { type: Type.BOOLEAN },
            title: { type: Type.STRING },
            changeType: {
              type: Type.STRING,
              enum: ['rescheduled', 'location_changed', 'cancelled', 'conflict', 'new_requirement'],
            },
            summary: { type: Type.STRING },
            previousValue: { type: Type.STRING },
            newValue: { type: Type.STRING },
            targetTaskId: { type: Type.STRING, nullable: true },
            proposedDueDate: { type: Type.STRING, nullable: true },
            proposedDueTime: { type: Type.STRING, nullable: true },
            proposedLocation: { type: Type.STRING, nullable: true },
          },
          required: ['detected', 'title', 'changeType', 'summary', 'previousValue', 'newValue'],
        },
      },
      required: ['detectedLanguages', 'summary', 'importance', 'importanceReason', 'entities', 'extractedTasks', 'scheduleChange'],
    },
  });

  const parsed = JSON.parse(rawJson || '{}') as AnalyzedMessageResult;
  if (!parsed.scheduleChange?.detected) {
    parsed.scheduleChange = null;
  }
  return parsed;
}

export async function runCrossMessageAnalysisAI(params: {
  state: SecretaryState;
  uiLanguage: UILanguage;
}): Promise<
  Array<{
    title: string;
    changeType: 'rescheduled' | 'location_changed' | 'cancelled' | 'conflict' | 'new_requirement';
    summary: string;
    previousValue: string;
    newValue: string;
    targetTaskId: string | null;
    proposedDueDate: string | null;
    proposedDueTime: string | null;
    proposedLocation: string | null;
    sourceMessageIds: string[];
  }>
> {
  const ai = getGeminiClient();
  const currentContext = getCurrentContextLine();

  const msgs = params.state.messages.slice(0, 20).map((m) => ({
    id: m.id,
    source: m.source,
    sender: m.sender,
    receivedAtMYT: formatTimestampMYT(m.receivedAt),
    text: m.redactedText,
  }));

  const tasks = params.state.tasks
    .filter((t) => t.status !== 'completed')
    .slice(0, 25)
    .map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      location: t.location,
    }));

  const existingChanges = params.state.scheduleChanges.map((c) => c.summary);

  const prompt = `Perform a cross-message schedule analysis for the user.
Timezone: ${KUALA_LUMPUR_TZ} (UTC+8).
Today's Date & Time (Malaysia Time): ${currentContext}.
Output Language: ${getLanguageName(params.uiLanguage)}.

Messages:
${JSON.stringify(msgs)}

Open Tasks & Meetings:
${JSON.stringify(tasks)}

Personal Memories & Preferences:
${params.state.memories.map((m) => `${m.key}: ${m.content}`).join('\n')}

Already Recorded Alerts (do NOT duplicate these):
${JSON.stringify(existingChanges)}

Find ONLY new, genuine schedule conflicts, overlapping meeting times, venue/time changes across messages, or clashes with personal memory preferences. Resolve all dates/times in ${KUALA_LUMPUR_TZ} (UTC+8). If none exist, return an empty array.`;

  const rawJson = await generateJsonWithFallback(ai, {
    contents: prompt,
    thinkingLevel: ThinkingLevel.MEDIUM,
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          changeType: {
            type: Type.STRING,
            enum: ['rescheduled', 'location_changed', 'cancelled', 'conflict', 'new_requirement'],
          },
          summary: { type: Type.STRING },
          previousValue: { type: Type.STRING },
          newValue: { type: Type.STRING },
          targetTaskId: { type: Type.STRING, nullable: true },
          proposedDueDate: { type: Type.STRING, nullable: true },
          proposedDueTime: { type: Type.STRING, nullable: true },
          proposedLocation: { type: Type.STRING, nullable: true },
          sourceMessageIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['title', 'changeType', 'summary', 'previousValue', 'newValue', 'sourceMessageIds'],
      },
    },
  });

  return JSON.parse(rawJson || '[]');
}

export async function generateDailyBriefingAI(params: {
  state: SecretaryState;
  uiLanguage: UILanguage;
}): Promise<Omit<DailyBriefing, 'id' | 'generatedAt'>> {
  const ai = getGeminiClient();
  const currentContext = getCurrentContextLine();

  const openTasks = params.state.tasks.filter((t) => t.status !== 'completed');
  const recentMsgs = params.state.messages.slice(0, 12).map((m) => ({
    source: m.source,
    sender: m.sender,
    importance: m.importance,
    summary: m.summary,
    receivedAtMYT: formatTimestampMYT(m.receivedAt),
  }));
  const pendingChanges = params.state.scheduleChanges.filter((c) => c.status === 'pending');

  const prompt = `Create a crisp, executive Daily AI Briefing for ${currentContext} (${KUALA_LUMPUR_TZ}) in ${getLanguageName(params.uiLanguage)}.

Open Tasks & Deadlines:
${JSON.stringify(openTasks)}

Recent Important Messages:
${JSON.stringify(recentMsgs)}

Pending Schedule Changes:
${JSON.stringify(pendingChanges)}

Personal Memory & Preferences:
${params.state.memories.map((m) => `- ${m.key}: ${m.content}`).join('\n')}

Return an actionable, calm, well-structured briefing without fluff, treating all dates/times strictly in ${KUALA_LUMPUR_TZ} (UTC+8).`;

  const rawJson = await generateJsonWithFallback(ai, {
    contents: prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        overview: { type: Type.STRING },
        topPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
        scheduleSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
        watchouts: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['headline', 'overview', 'topPriorities', 'scheduleSummary', 'watchouts'],
    },
  });

  const parsed = JSON.parse(rawJson || '{}');
  return {
    date: getTodayIso(),
    language: params.uiLanguage,
    headline: parsed.headline,
    overview: parsed.overview,
    topPriorities: parsed.topPriorities || [],
    scheduleSummary: parsed.scheduleSummary || [],
    watchouts: parsed.watchouts || [],
  };
}

export async function chatWithSecretaryAI(params: {
  message: string;
  state: SecretaryState;
  uiLanguage: UILanguage;
}): Promise<{
  reply: string;
  suggestedActions: Array<{
    type: 'create_task' | 'save_memory';
    label: string;
    payload: Record<string, string>;
  }>;
}> {
  const ai = getGeminiClient();
  const currentContext = getCurrentContextLine();

  const recentHistory = params.state.chatHistory
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Secretary'}: ${m.content}`)
    .join('\n');

  const prompt = `You are Kairo, the user's multilingual personal AI secretary (fluent in English, Chinese, and Malay, including mixed-language rojak).
Timezone: ${KUALA_LUMPUR_TZ} (UTC+8).
Current Date & Time (Malaysia Time): ${currentContext}.
Reply in the same language the user used (or ${getLanguageName(params.uiLanguage)} if ambiguous).

Grounded Workspace Context:
Open Tasks & Deadlines:
${JSON.stringify(params.state.tasks.filter((t) => t.status !== 'completed'))}

Recent Messages:
${JSON.stringify(
  params.state.messages.slice(0, 15).map((m) => ({
    id: m.id,
    source: m.source,
    sender: m.sender,
    importance: m.importance,
    summary: m.summary,
    receivedAtMYT: formatTimestampMYT(m.receivedAt),
  }))
)}

Pending Schedule Changes:
${JSON.stringify(params.state.scheduleChanges.filter((c) => c.status === 'pending'))}

Personal Memory Vault:
${JSON.stringify(params.state.memories)}

Recent Conversation:
${recentHistory}

User's Message:
"""
${params.message}
"""

Instructions:
- Answer accurately using ONLY the grounded workspace data and memories above. Cite specific senders, dates, times, or locations when relevant.
- Always interpret relative dates ("today / 今天 / hari ini", "tomorrow / 明天 / esok", weekdays) strictly in ${KUALA_LUMPUR_TZ} (UTC+8) based on ${currentContext}.
- If the user asks you to remember a preference/fact, or asks to add a task/meeting/reminder, include a structured item in suggestedActions (with YYYY-MM-DD dueDate and 24h HH:mm dueTime in MYT) so the UI can let them confirm & save it with one click (or keep suggestedActions empty if none needed).`;

  const rawJson = await generateJsonWithFallback(ai, {
    contents: prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        reply: { type: Type.STRING },
        suggestedActions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['create_task', 'save_memory'] },
              label: { type: Type.STRING },
              titleOrKey: { type: Type.STRING },
              detailOrContent: { type: Type.STRING },
              category: { type: Type.STRING },
              dueDate: { type: Type.STRING, nullable: true },
              dueTime: { type: Type.STRING, nullable: true },
              location: { type: Type.STRING, nullable: true },
            },
            required: ['type', 'label', 'titleOrKey', 'detailOrContent', 'category'],
          },
        },
      },
      required: ['reply', 'suggestedActions'],
    },
  });

  const parsed = JSON.parse(rawJson || '{}') as {
    reply: string;
    suggestedActions?: Array<{
      type: 'create_task' | 'save_memory';
      label: string;
      titleOrKey: string;
      detailOrContent: string;
      category: string;
      dueDate?: string | null;
      dueTime?: string | null;
      location?: string | null;
    }>;
  };

  return {
    reply: parsed.reply || 'Done.',
    suggestedActions: (parsed.suggestedActions || []).map((a) => ({
      type: a.type,
      label: a.label,
      payload: {
        titleOrKey: a.titleOrKey,
        detailOrContent: a.detailOrContent,
        category: a.category,
        dueDate: a.dueDate || '',
        dueTime: a.dueTime || '',
        location: a.location || '',
      },
    })),
  };
}
