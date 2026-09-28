# AURA Engineering Lab

A browser-based engineering dashboard with a Three.js engine viewer and local demo workspace.

## Project layout

- `index.html` — app shell, landing page, and workspace markup.
- `css/styles.css` — landing, dashboard, responsive layout, and component styles.
- `js/engine.js` — Three.js scene, engine parts, camera, selection, and simulation controls.
- `js/models.js` — predefined library model and component presets.
- `js/voice.js` — speech input/output and text command parsing.
- `js/xr.js` — model QR sharing and WebXR launch controls.
- `js/workspace.js` — demo session, navigation, dashboard, library, upload queue, and profile.

## Run

Open `index.html` in a modern browser. Three.js and Space Grotesk are loaded from CDNs, so an internet connection is needed for those resources.

For phone sharing, open the app from a network-reachable address and enter that address in the QR dialog. Do not use `localhost` or a `file:` URL in the QR. WebXR AR requires a supported mobile browser and a secure HTTPS origin; scanning the QR opens the selected model, then tap **View in AR** to start placement.

Sign-in is a local demo state. Model files selected on the Upload page are validated and queued only in the current page session; no backend or persistent model storage is configured.

The Model Assistant answers from the engine's local part metadata and built-in model facts, and can run viewer commands. It does not call a hosted generative AI service; connecting one requires a backend endpoint and API credentials.
