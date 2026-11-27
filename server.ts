import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AiServiceError,
  analyzeMessageWithAI,
  chatWithSecretaryAI,
  generateDailyBriefingAI,
  isGeminiConfigured,
  runCrossMessageAnalysisAI,
} from './server/ai.ts';
import {
  claimInitialPasscode,
  extractBearerToken,
  getEnvPasscode,
  isAuthClaimed,
  issueSessionToken,
  requireAuth,
  verifyAccessPasscode,
  verifySessionToken,
} from './server/auth.ts';
import {
  buildDefaultState,
  buildIcsFeed,
  createId,
  getStorageInfo,
  mutateStore,
  readStore,
  redactSensitiveText,
  writeStore,
} from './server/store.ts';
import { getKualaLumpurParts, KUALA_LUMPUR_TZ } from './server/timezone.ts';
import {
  ChatMessage,
  DailyBriefing,
  ImportanceLevel,
  IngestedMessage,
  MessageSource,
  PersonalMemory,
  PrivacySettings,
  ScheduleChangeAlert,
  SecretaryTask,
  TaskCategory,
  TaskStatus,
  UILanguage,
} from './src/types/secretary.ts';

const PORT = Number(process.env.PORT) || 3000;
const ANDROID_COMPANION_DIR = path.resolve(process.cwd(), 'android-companion');
const ALLOWED_COMPANION_FILES = new Set([
  'AndroidManifest.xml',
  'SecretaryNotificationListenerService.kt',
  'IngestionModels.kt',
  'README.md',
]);

const VALID_SOURCES = new Set<MessageSource>(['whatsapp', 'wechat', 'email', 'sms', 'manual']);
const VALID_LANGS = new Set<UILanguage>(['en', 'zh', 'ms']);

function asUiLanguage(val: unknown): UILanguage {
  return typeof val === 'string' && VALID_LANGS.has(val as UILanguage) ? (val as UILanguage) : 'en';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sendRouteError(res: Response, err: unknown): void {
  if (err instanceof AiServiceError) {
    res.status(err.statusCode).json({
      error: err.message,
      errorCode: err.errorCode,
    });
    return;
  }
  res.status(500).json({ error: getErrorMessage(err) });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const kl = getKualaLumpurParts();
    const storage = getStorageInfo();
    res.json({
      ok: true,
      service: 'kairo-secretary',
      timezone: KUALA_LUMPUR_TZ,
      serverTimeMYT: kl.isoOffset,
      aiConfigured: isGeminiConfigured(),
      authRequired: true,
      authClaimed: isAuthClaimed(),
      envPasscodeConfigured: getEnvPasscode() !== null,
      storageEngine: storage.engine,
      persistentVolumeConfigured: storage.persistentVolumeConfigured,
      runningOnCloudRun: storage.runningOnCloudRun,
    });
  });

  app.get('/api/auth/status', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const session = verifySessionToken(token);
    res.json({
      authRequired: true,
      claimed: isAuthClaimed(),
      envOverride: getEnvPasscode() !== null,
      authenticated: Boolean(session),
    });
  });

  app.post('/api/auth/claim', (req: Request, res: Response) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const result = claimInitialPasscode(passcode);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Unable to claim workspace passcode.' });
    }
    const token = issueSessionToken('workspace-owner');
    res.status(201).json({
      token,
      claimed: true,
      authenticated: true,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    if (!isAuthClaimed()) {
      return res.status(400).json({ error: 'Workspace passcode is not set yet. Claim a passcode first.' });
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode || !verifyAccessPasscode(passcode)) {
      return res.status(401).json({ error: 'Incorrect workspace passcode.' });
    }
    const token = issueSessionToken('workspace-owner');
    res.json({
      token,
      claimed: true,
      authenticated: true,
    });
  });

  app.get('/api/state', requireAuth, async (_req: Request, res: Response) => {
    try {
      const state = await readStore();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/messages/ingest', requireAuth, async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const source = typeof body.source === 'string' && VALID_SOURCES.has(body.source as MessageSource)
        ? (body.source as MessageSource)
        : 'manual';
      const sender = typeof body.sender === 'string' && body.sender.trim() ? body.sender.trim().slice(0, 120) : 'Unknown Sender';
      const chatTitle = typeof body.chatTitle === 'string' && body.chatTitle.trim() ? body.chatTitle.trim().slice(0, 120) : undefined;
      const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
      const receivedAt = typeof body.receivedAt === 'string' && !Number.isNaN(Date.parse(body.receivedAt))
        ? body.receivedAt
        : getKualaLumpurParts().isoOffset;
      const uiLanguage = asUiLanguage(body.uiLanguage);

      if (!rawText || rawText.length > 10000) {
        return res.status(400).json({ error: 'Message text is required and must be under 10,000 characters.' });
      }

      const currentState = await readStore();

      if (!currentState.privacy.enabledSources[source]) {
        return res.status(403).json({
          error: `Source "${source}" is paused in Privacy Controls. Enable it in Memory & Privacy to ingest messages from ${source}.`,
          blockedByPrivacy: 'source_disabled',
        });
      }

      const isSenderBlocked = currentState.privacy.blockedSenders.some(
        (blocked) => blocked.trim().toLowerCase() === sender.toLowerCase()
      );
      if (isSenderBlocked) {
        return res.status(403).json({
          error: `Sender "${sender}" is on your Privacy Blocklist.`,
          blockedByPrivacy: 'sender_blocked',
        });
      }

      const redactedText = currentState.privacy.redactSensitiveInfo ? redactSensitiveText(rawText) : rawText;

      const aiResult = await analyzeMessageWithAI({
        text: redactedText,
        source,
        sender,
        chatTitle,
        receivedAt,
        uiLanguage,
        existingTasks: currentState.tasks,
        memories: currentState.memories,
      });

      const messageId = createId('msg');
      const nowIso = getKualaLumpurParts().isoOffset;

      const createdTasks: SecretaryTask[] = (aiResult.extractedTasks || []).map((t) => ({
        id: createId('task'),
        title: t.title.slice(0, 180),
        description: t.description.slice(0, 800),
        category: t.category,
        status: 'pending',
        priority: t.priority,
        dueDate: t.dueDate || null,
        dueTime: t.dueTime || null,
        location: t.location || null,
        sourceMessageId: messageId,
        sourceApp: source,
        sourceSender: sender,
        reminderMinutesBefore: 30,
        reminderDismissed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      const newMessage: IngestedMessage = {
        id: messageId,
        source,
        sender,
        chatTitle,
        rawText: currentState.privacy.storeRawMessages ? rawText : redactedText,
        redactedText,
        receivedAt,
        detectedLanguages: aiResult.detectedLanguages?.length ? aiResult.detectedLanguages : ['Unknown'],
        summary: aiResult.summary,
        importance: aiResult.importance,
        importanceReason: aiResult.importanceReason,
        entities: aiResult.entities,
        linkedTaskIds: createdTasks.map((t) => t.id),
        isSample: false,
        read: false,
      };

      const detectedChanges: ScheduleChangeAlert[] = [];
      if (aiResult.scheduleChange?.detected) {
        detectedChanges.push({
          id: createId('chg'),
          title: aiResult.scheduleChange.title,
          changeType: aiResult.scheduleChange.changeType,
          summary: aiResult.scheduleChange.summary,
          previousValue: aiResult.scheduleChange.previousValue,
          newValue: aiResult.scheduleChange.newValue,
          targetTaskId: aiResult.scheduleChange.targetTaskId || null,
          proposedDueDate: aiResult.scheduleChange.proposedDueDate || null,
          proposedDueTime: aiResult.scheduleChange.proposedDueTime || null,
          proposedLocation: aiResult.scheduleChange.proposedLocation || null,
          sourceMessageIds: [messageId],
          status: 'pending',
          detectedAt: nowIso,
        });
      }

      const nextState = await mutateStore((state) => ({
        ...state,
        messages: [newMessage, ...state.messages],
        tasks: [...createdTasks, ...state.tasks],
        scheduleChanges: [...detectedChanges, ...state.scheduleChanges],
      }));

      res.status(201).json({
        message: newMessage,
        createdTasks,
        detectedChanges,
        state: nextState,
      });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.post('/api/messages/load-samples', requireAuth, async (req: Request, res: Response) => {
    try {
      const uiLanguage = asUiLanguage(req.body?.uiLanguage);
      const defaults = buildDefaultState();
      const extraRaw = [
        {
          source: 'wechat' as MessageSource,
          sender: '张教授 (Prof. Zhang)',
          chatTitle: 'Research Lab Weekly',
          rawText: '明天下午3点的组会改到线上 Zoom 进行，link 我等下发群里。请大家准备好上周的实验数据。',
        },
        {
          source: 'whatsapp' as MessageSource,
          sender: 'Pn. Nadia (Academic Office)',
          chatTitle: 'FTSM Admin Notice',
          rawText: 'Salam sejahtera pelajar tahun akhir, tarikh akhir serahan borang pengesahan projek adalah pada hari Isnin depan sebelum jam 5.00 petang di Pejabat Dekan.',
        },
      ];

      const currentState = await readStore();
      const existingRawTexts = new Set(currentState.messages.map((m) => m.rawText));
      const newMessages: IngestedMessage[] = [];
      const newTasks: SecretaryTask[] = [];
      const newChanges: ScheduleChangeAlert[] = [];

      // Restore starter messages if missing
      for (const starterMsg of defaults.messages) {
        if (!existingRawTexts.has(starterMsg.rawText)) {
          newMessages.push({ ...starterMsg, id: createId('msg') });
        }
      }

      // Analyze extra trilingual samples using live Gemini AI
      for (const item of extraRaw) {
        if (existingRawTexts.has(item.rawText)) continue;
        const aiResult = await analyzeMessageWithAI({
          text: item.rawText,
          source: item.source,
          sender: item.sender,
          chatTitle: item.chatTitle,
          uiLanguage,
          existingTasks: [...currentState.tasks, ...newTasks],
          memories: currentState.memories,
        });
        const msgId = createId('msg');
        const nowIso = getKualaLumpurParts().isoOffset;
        const tasks = (aiResult.extractedTasks || []).map((t) => ({
          id: createId('task'),
          title: t.title,
          description: t.description,
          category: t.category,
          status: 'pending' as TaskStatus,
          priority: t.priority,
          dueDate: t.dueDate || null,
          dueTime: t.dueTime || null,
          location: t.location || null,
          sourceMessageId: msgId,
          sourceApp: item.source,
          sourceSender: item.sender,
          reminderMinutesBefore: 30,
          reminderDismissed: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
        newTasks.push(...tasks);
        newMessages.push({
          id: msgId,
          source: item.source,
          sender: item.sender,
          chatTitle: item.chatTitle,
          rawText: item.rawText,
          redactedText: item.rawText,
          receivedAt: nowIso,
          detectedLanguages: aiResult.detectedLanguages,
          summary: aiResult.summary,
          importance: aiResult.importance,
          importanceReason: aiResult.importanceReason,
          entities: aiResult.entities,
          linkedTaskIds: tasks.map((t) => t.id),
          isSample: true,
          read: false,
        });
        if (aiResult.scheduleChange?.detected) {
          newChanges.push({
            id: createId('chg'),
            title: aiResult.scheduleChange.title,
            changeType: aiResult.scheduleChange.changeType,
            summary: aiResult.scheduleChange.summary,
            previousValue: aiResult.scheduleChange.previousValue,
            newValue: aiResult.scheduleChange.newValue,
            targetTaskId: aiResult.scheduleChange.targetTaskId || null,
            proposedDueDate: aiResult.scheduleChange.proposedDueDate || null,
            proposedDueTime: aiResult.scheduleChange.proposedDueTime || null,
            proposedLocation: aiResult.scheduleChange.proposedLocation || null,
            sourceMessageIds: [msgId],
            status: 'pending',
            detectedAt: nowIso,
          });
        }
      }

      const nextState = await mutateStore((state) => ({
        ...state,
        messages: [...newMessages, ...state.messages],
        tasks: [...newTasks, ...state.tasks],
        scheduleChanges: [...newChanges, ...state.scheduleChanges],
      }));

      res.json({ addedCount: newMessages.length, state: nextState });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.patch('/api/messages/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const read = typeof req.body?.read === 'boolean' ? req.body.read : true;
      const nextState = await mutateStore((state) => ({
        ...state,
        messages: state.messages.map((m) => (m.id === id ? { ...m, read } : m)),
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.delete('/api/messages/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const nextState = await mutateStore((state) => ({
        ...state,
        messages: state.messages.filter((m) => m.id !== id),
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
      if (!title) {
        return res.status(400).json({ error: 'Task title is required.' });
      }
      const nowIso = getKualaLumpurParts().isoOffset;
      const newTask: SecretaryTask = {
        id: createId('task'),
        title,
        description: typeof body.description === 'string' ? body.description.trim().slice(0, 800) : '',
        category: (['assignment', 'meeting', 'task', 'reminder'].includes(body.category) ? body.category : 'task') as TaskCategory,
        status: 'pending',
        priority: (['critical', 'high', 'normal', 'low'].includes(body.priority) ? body.priority : 'normal') as ImportanceLevel,
        dueDate: typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null,
        dueTime: typeof body.dueTime === 'string' && body.dueTime ? body.dueTime : null,
        location: typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null,
        sourceMessageId: null,
        sourceApp: 'manual',
        sourceSender: 'Manual Entry',
        reminderMinutesBefore: Number(body.reminderMinutesBefore) || 30,
        reminderDismissed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const nextState = await mutateStore((state) => ({
        ...state,
        tasks: [newTask, ...state.tasks],
      }));
      res.status(201).json({ task: newTask, state: nextState });
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.patch('/api/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body ?? {};
      const nowIso = getKualaLumpurParts().isoOffset;
      const nextState = await mutateStore((state) => ({
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== id) return task;
          return {
            ...task,
            title: typeof body.title === 'string' ? body.title.trim().slice(0, 180) : task.title,
            description: typeof body.description === 'string' ? body.description.trim().slice(0, 800) : task.description,
            status: (['pending', 'in_progress', 'completed'].includes(body.status) ? body.status : task.status) as TaskStatus,
            priority: (['critical', 'high', 'normal', 'low'].includes(body.priority) ? body.priority : task.priority) as ImportanceLevel,
            dueDate: body.dueDate !== undefined ? body.dueDate || null : task.dueDate,
            dueTime: body.dueTime !== undefined ? body.dueTime || null : task.dueTime,
            location: body.location !== undefined ? body.location || null : task.location,
            reminderDismissed: typeof body.reminderDismissed === 'boolean' ? body.reminderDismissed : task.reminderDismissed,
            updatedAt: nowIso,
          };
        }),
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const nextState = await mutateStore((state) => ({
        ...state,
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/schedule-changes/:id/apply', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const nowIso = getKualaLumpurParts().isoOffset;
      const nextState = await mutateStore((state) => {
        const change = state.scheduleChanges.find((c) => c.id === id);
        if (!change) return state;

        let updatedTasks = state.tasks;
        if (change.targetTaskId && state.tasks.some((t) => t.id === change.targetTaskId)) {
          updatedTasks = state.tasks.map((t) => {
            if (t.id !== change.targetTaskId) return t;
            return {
              ...t,
              dueDate: change.proposedDueDate ?? t.dueDate,
              dueTime: change.proposedDueTime ?? t.dueTime,
              location: change.proposedLocation ?? t.location,
              description: `${t.description} [Updated: ${change.summary}]`.trim(),
              status: change.changeType === 'cancelled' ? 'completed' : t.status,
              updatedAt: nowIso,
            };
          });
        } else if (change.proposedDueDate || change.proposedDueTime || change.proposedLocation) {
          const created: SecretaryTask = {
            id: createId('task'),
            title: change.title,
            description: change.summary,
            category: 'meeting',
            status: 'pending',
            priority: 'high',
            dueDate: change.proposedDueDate,
            dueTime: change.proposedDueTime,
            location: change.proposedLocation,
            sourceMessageId: change.sourceMessageIds[0] || null,
            sourceApp: 'assistant',
            sourceSender: 'Schedule Change Analysis',
            reminderMinutesBefore: 30,
            reminderDismissed: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          updatedTasks = [created, ...state.tasks];
        }

        return {
          ...state,
          tasks: updatedTasks,
          scheduleChanges: state.scheduleChanges.map((c) => (c.id === id ? { ...c, status: 'applied' } : c)),
        };
      });
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/schedule-changes/:id/dismiss', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const nextState = await mutateStore((state) => ({
        ...state,
        scheduleChanges: state.scheduleChanges.map((c) => (c.id === id ? { ...c, status: 'dismissed' } : c)),
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/ai/cross-analyze', requireAuth, async (req: Request, res: Response) => {
    try {
      const uiLanguage = asUiLanguage(req.body?.uiLanguage);
      const currentState = await readStore();
      const detected = await runCrossMessageAnalysisAI({ state: currentState, uiLanguage });
      const nowIso = getKualaLumpurParts().isoOffset;

      const newAlerts: ScheduleChangeAlert[] = detected.map((d) => ({
        id: createId('chg'),
        title: d.title,
        changeType: d.changeType,
        summary: d.summary,
        previousValue: d.previousValue,
        newValue: d.newValue,
        targetTaskId: d.targetTaskId || null,
        proposedDueDate: d.proposedDueDate || null,
        proposedDueTime: d.proposedDueTime || null,
        proposedLocation: d.proposedLocation || null,
        sourceMessageIds: d.sourceMessageIds || [],
        status: 'pending',
        detectedAt: nowIso,
      }));

      const nextState = await mutateStore((state) => ({
        ...state,
        scheduleChanges: [...newAlerts, ...state.scheduleChanges],
        lastCrossAnalysisAt: nowIso,
      }));

      res.json({ newAlertsCount: newAlerts.length, state: nextState });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.post('/api/briefings/generate', requireAuth, async (req: Request, res: Response) => {
    try {
      const uiLanguage = asUiLanguage(req.body?.uiLanguage);
      const currentState = await readStore();
      const generated = await generateDailyBriefingAI({ state: currentState, uiLanguage });
      const briefing: DailyBriefing = {
        id: createId('brief'),
        ...generated,
        generatedAt: getKualaLumpurParts().isoOffset,
      };
      const nextState = await mutateStore((state) => ({
        ...state,
        briefings: [briefing, ...state.briefings.slice(0, 14)],
      }));
      res.json({ briefing, state: nextState });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.post('/api/ai/chat', requireAuth, async (req: Request, res: Response) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      const uiLanguage = asUiLanguage(req.body?.uiLanguage);
      if (!message || message.length > 4000) {
        return res.status(400).json({ error: 'Chat message is required (max 4,000 chars).' });
      }
      const currentState = await readStore();
      const aiReply = await chatWithSecretaryAI({ message, state: currentState, uiLanguage });
      const nowIso = getKualaLumpurParts().isoOffset;

      const userMsg: ChatMessage = {
        id: createId('chat'),
        role: 'user',
        content: message,
        createdAt: nowIso,
      };
      const assistantMsg: ChatMessage = {
        id: createId('chat'),
        role: 'assistant',
        content: aiReply.reply,
        createdAt: getKualaLumpurParts().isoOffset,
        suggestedActions: aiReply.suggestedActions.map((a) => ({ ...a, applied: false })),
      };

      const nextState = await mutateStore((state) => ({
        ...state,
        chatHistory: [...state.chatHistory, userMsg, assistantMsg].slice(-60),
      }));

      res.json({ state: nextState });
    } catch (err) {
      sendRouteError(res, err);
    }
  });

  app.post('/api/ai/chat/apply-action', requireAuth, async (req: Request, res: Response) => {
    try {
      const { chatMessageId, actionIndex } = req.body ?? {};
      const nowIso = getKualaLumpurParts().isoOffset;

      const nextState = await mutateStore((state) => {
        const msg = state.chatHistory.find((m) => m.id === chatMessageId);
        const action = msg?.suggestedActions?.[Number(actionIndex)];
        if (!action || action.applied) return state;

        let tasks = state.tasks;
        let memories = state.memories;

        if (action.type === 'create_task') {
          const cat = action.payload.category;
          const validCat = (['assignment', 'meeting', 'task', 'reminder'].includes(cat) ? cat : 'task') as TaskCategory;
          const newTask: SecretaryTask = {
            id: createId('task'),
            title: action.payload.titleOrKey || action.label,
            description: action.payload.detailOrContent || '',
            category: validCat,
            status: 'pending',
            priority: 'normal',
            dueDate: action.payload.dueDate || null,
            dueTime: action.payload.dueTime || null,
            location: action.payload.location || null,
            sourceMessageId: null,
            sourceApp: 'assistant',
            sourceSender: 'AI Secretary Chat',
            reminderMinutesBefore: 30,
            reminderDismissed: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          tasks = [newTask, ...tasks];
        } else if (action.type === 'save_memory') {
          const cat = action.payload.category;
          const validMemCat = (
            ['preference', 'contact', 'course_project', 'routine', 'fact'].includes(cat) ? cat : 'fact'
          ) as PersonalMemory['category'];
          const newMem: PersonalMemory = {
            id: createId('mem'),
            category: validMemCat,
            key: action.payload.titleOrKey || 'Remembered Note',
            content: action.payload.detailOrContent || action.label,
            source: 'ai_suggested',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          memories = [newMem, ...memories];
        }

        const updatedChat = state.chatHistory.map((m) => {
          if (m.id !== chatMessageId || !m.suggestedActions) return m;
          return {
            ...m,
            suggestedActions: m.suggestedActions.map((a, idx) =>
              idx === Number(actionIndex) ? { ...a, applied: true } : a
            ),
          };
        });

        return {
          ...state,
          tasks,
          memories,
          chatHistory: updatedChat,
        };
      });

      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.delete('/api/ai/chat', requireAuth, async (_req: Request, res: Response) => {
    try {
      const nextState = await mutateStore((state) => ({ ...state, chatHistory: [] }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/memories', requireAuth, async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const key = typeof body.key === 'string' ? body.key.trim().slice(0, 120) : '';
      const content = typeof body.content === 'string' ? body.content.trim().slice(0, 1000) : '';
      if (!key || !content) {
        return res.status(400).json({ error: 'Both memory title/key and content are required.' });
      }
      const category = (
        ['preference', 'contact', 'course_project', 'routine', 'fact'].includes(body.category)
          ? body.category
          : 'fact'
      ) as PersonalMemory['category'];
      const nowIso = getKualaLumpurParts().isoOffset;
      const memory: PersonalMemory = {
        id: createId('mem'),
        category,
        key,
        content,
        source: 'user',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const nextState = await mutateStore((state) => ({
        ...state,
        memories: [memory, ...state.memories],
      }));
      res.status(201).json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.delete('/api/memories/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const nextState = await mutateStore((state) => ({
        ...state,
        memories: state.memories.filter((m) => m.id !== id),
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.patch('/api/privacy', requireAuth, async (req: Request, res: Response) => {
    try {
      const patch = req.body as Partial<PrivacySettings>;
      const nextState = await mutateStore((state) => ({
        ...state,
        privacy: {
          ...state.privacy,
          enabledSources: patch.enabledSources
            ? { ...state.privacy.enabledSources, ...patch.enabledSources }
            : state.privacy.enabledSources,
          redactSensitiveInfo:
            typeof patch.redactSensitiveInfo === 'boolean'
              ? patch.redactSensitiveInfo
              : state.privacy.redactSensitiveInfo,
          storeRawMessages:
            typeof patch.storeRawMessages === 'boolean'
              ? patch.storeRawMessages
              : state.privacy.storeRawMessages,
          proactiveRemindersEnabled:
            typeof patch.proactiveRemindersEnabled === 'boolean'
              ? patch.proactiveRemindersEnabled
              : state.privacy.proactiveRemindersEnabled,
          blockedSenders: Array.isArray(patch.blockedSenders)
            ? patch.blockedSenders.map((s) => String(s).trim()).filter(Boolean).slice(0, 100)
            : state.privacy.blockedSenders,
        },
      }));
      res.json(nextState);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.get('/api/calendar/export.ics', requireAuth, async (_req: Request, res: Response) => {
    try {
      const state = await readStore();
      const ics = buildIcsFeed(state.tasks);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="kairo-schedule.ics"');
      res.send(ics);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.get('/api/export', requireAuth, async (_req: Request, res: Response) => {
    try {
      const state = await readStore();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="kairo-secretary-backup.json"');
      res.send(JSON.stringify(state, null, 2));
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post('/api/reset', requireAuth, async (req: Request, res: Response) => {
    try {
      const mode = req.body?.mode === 'empty' ? 'empty' : 'defaults';
      if (mode === 'empty') {
        const current = await readStore();
        const emptyState = await writeStore({
          messages: [],
          tasks: [],
          scheduleChanges: [],
          memories: [],
          briefings: [],
          chatHistory: [],
          privacy: current.privacy,
          lastCrossAnalysisAt: null,
        });
        return res.json(emptyState);
      }
      const next = await writeStore(buildDefaultState());
      res.json(next);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.get('/api/android-companion/:filename', requireAuth, async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      if (!ALLOWED_COMPANION_FILES.has(filename)) {
        return res.status(404).json({ error: 'Companion file not found.' });
      }
      const targetPath = path.resolve(ANDROID_COMPANION_DIR, filename);
      if (!targetPath.startsWith(ANDROID_COMPANION_DIR + path.sep)) {
        return res.status(403).json({ error: 'Invalid path.' });
      }
      const content = await fs.readFile(targetPath, 'utf-8');
      res.json({ filename, content });
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kairo AI Secretary server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
