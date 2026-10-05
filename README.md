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

For phone sharing, host the app at a public HTTPS address, then create a QR code from the Viewer. Anyone who scans it can open the selected built-in model without signing in. The phone must be able to reach the address and use a supported WebXR browser; after scanning, tap **Start AR placement**, then tap a detected surface to place the model. Local uploads are not shared.

Sign-in is a local demo state. Model files selected on the Upload page are validated and queued only in the current page session; no backend or persistent model storage is configured.

The Model Assistant answers from the engine's local part metadata and built-in model facts, and can run viewer commands. It does not call a hosted generative AI service; connecting one requires a backend endpoint and API credentials.

The Library includes interactive engine/mechanism demos, including the 349.32 cc single-cylinder liquid-cooled DOHC Duke engine. Its selectable assembly covers the cylinder, four-valve head, camshafts, piston/crank, clutch and gearbox, intake/exhaust, radiator, coolant loop, ignition, and sump. Start the engine in the Viewer to animate the four-stroke cycle, valve timing, spark, and coolant flow; the Duke controls include adjustable RPM and live cycle telemetry.
