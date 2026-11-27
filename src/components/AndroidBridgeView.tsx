import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Download, FileCode2 } from 'lucide-react';
import { Translations } from '../i18n/translations';

interface AndroidBridgeViewProps {
  t: Translations;
}

const COMPANION_FILES = [
  'SecretaryNotificationListenerService.kt',
  'AndroidManifest.xml',
  'IngestionModels.kt',
  'README.md',
] as const;

export const AndroidBridgeView: React.FC<AndroidBridgeViewProps> = ({ t }) => {
  const [selectedFile, setSelectedFile] = useState<string>(COMPANION_FILES[0]);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/android-companion/${encodeURIComponent(selectedFile)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && typeof data.content === 'string') {
          setFileContent(data.content);
        }
      })
      .catch(() => {
        if (active) setFileContent('// Unable to load companion file.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedFile]);

  const handleCopy = async () => {
    if (!fileContent) return;
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampleCurlPayload = JSON.stringify(
    {
      source: 'whatsapp',
      sender: 'Dr. Lim Wei Jian',
      chatTitle: 'FYP Group',
      rawText: 'Reminder: submit progress log by 5pm today.',
      receivedAt: new Date().toISOString(),
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* Honest Platform Boundary Notice */}
      <section className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/70 rounded-xl p-6">
        <div className="flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.android.limitationTitle}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.android.limitationBody}
            </p>
          </div>
        </div>
      </section>

      {/* Kotlin Source Explorer */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-slate-500" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.android.blueprintTitle}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 px-6 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          {COMPANION_FILES.map((file) => (
            <button
              key={file}
              type="button"
              onClick={() => setSelectedFile(file)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                selectedFile === file
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {file}
            </button>
          ))}
        </div>

        <pre className="p-6 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed max-h-[460px]">
          {loading ? 'Loading...' : fileContent}
        </pre>
      </section>

      {/* REST API Contract */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t.android.testEndpointTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your native Kotlin service posts authorized WeChat (<code className="font-mono">com.tencent.mm</code>) and WhatsApp (<code className="font-mono">com.whatsapp</code>) notifications as JSON to this endpoint:
        </p>
        <pre className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
          {sampleCurlPayload}
        </pre>
      </section>
    </div>
  );
};
