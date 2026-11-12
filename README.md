# Photomask Coater Line

An offline interactive explainer for a photomask photoresist coating line. Open `Photomask-Coater-Line.html` directly in a modern browser; the page is self-contained and does not require a server or network connection.

The editable runtime and scene sources are included alongside the standalone page. `pack.mjs` rebuilds the standalone HTML from the runtime, template, and scene. `build.mjs` contains the Anatomy-based scene build and audit workflow and expects the Anatomy kit at the local skill path configured for the original authoring environment.

`Coater line工作原理图.png` is the supplied layout reference. See `使用与验证说明.md` and `设计说明.md` for process notes and verification details.

Run `node validate-model.mjs` for the included process and motion model checks (Node.js required). Historical screenshots, logs, and obsolete HTML backups are not included.
