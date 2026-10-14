# Default success audio

The default is a gentle synthesized chime. To replace it for everyone, add a short audio file here (for example `success.mp3`) and set `public/feedback-sounds.json` to `{"schemaVersion":1,"success":"/feedback-audio/success.mp3"}`. Keep the clip under 5 MB and 10 seconds. Use a file you have permission to distribute. The file is served locally with the app.

Learners can override it in Encouragement settings with a local browser upload, or mute it and adjust volume. Their uploaded clip lives in IndexedDB and is never sent to a server. Restoring the default removes that browser override.
