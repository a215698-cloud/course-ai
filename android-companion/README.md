# Kairo Android Companion Handoff

## Why This Directory Exists
Web applications running in browsers or Cloud Run cannot directly bind to Android's `NotificationListenerService`. Rather than simulating or faking Android notification capture, this directory provides the native Kotlin bridge blueprint ready for Android Studio.

## Architecture Plan
1. **Android Device Layer (Kotlin + Jetpack Compose + Room)**
   - `SecretaryNotificationListenerService.kt` listens strictly to authorized packages (`com.tencent.mm` for WeChat and `com.whatsapp` for WhatsApp) after explicit user permission in Android Settings (`ACTION_NOTIFICATION_LISTENER_SETTINGS`).
   - Enforces user privacy rules (source toggles, sender blocklists, local PII redaction) on-device before forwarding.
2. **Backend / AI Layer (This Express + Gemini Server)**
   - Receives payloads at `POST /api/messages/ingest` with exact JSON schema (`source`, `sender`, `chatTitle`, `rawText`, `receivedAt`).
   - Runs multilingual Gemini analysis (English, Chinese, Malay, mixed-language), cross-message schedule-change detection, and persists tasks/deadlines.
3. **Migration Steps**
   - Create an Android Studio Kotlin project (minSdk 26+).
   - Copy `AndroidManifest.xml` service declaration and `SecretaryNotificationListenerService.kt` + `IngestionModels.kt`.
   - Point `INGEST_ENDPOINT` to your hosted backend URL or migrate the Gemini prompt logic into a secured backend proxy for your Android client.
