# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

| Command | Purpose |
|---------|---------|
| `npm run electron:dev` | Development mode (React dev server + Electron with hot reload) |
| `npm start` | React dev server only (port 3000) |
| `npm run electron:tsc` | Compile electron/ TypeScript to build/electron/ |
| `npm run electron:build` | Full build (React + Electron TypeScript) |
| `npm run dist` | Build distributable for current platform |
| `npm run dist-all` | Build for macOS, Windows, and Linux |
| `npm run lint` | ESLint on src/ |
| `npm test` | Jest tests (via react-scripts) |
| `npm run tsc` | TypeScript type-check (src/) |

Node version is pinned via Volta (18.17.1). Use `npm ci --legacy-peer-deps` for clean installs.

## Architecture

**Electron + React app** with pandoc integration for document conversion. Two distinct TypeScript compilation targets:

### Electron Main Process (`electron/`)
- Compiled with `tsc -p electron` → `build/electron/` (ES5, CommonJS)
- Entry: `electron/main.ts` → `build/electron/main.js` (package.json `"main"`)
- Window management, native menus, file I/O, pandoc subprocess calls, auto-updates
- `preload.ts` exposes `ipcApi` to renderer via `contextBridge`

### React Renderer (`src/`)
- Built with react-scripts (CRA) → `build/` (ES2019, ESNext modules)
- Entry: `src/index.tsx` renders `<App />` or `<ModalChooseFormat />` based on URL param
- State: `useReducer` pattern in `src/appState/` (AppState type, Action union, appStateReducer)

### IPC Bridge
- **Main → Renderer**: `ipcMain.on`/`handle` dispatches Actions to the reducer
- **Renderer → Main**: `ipcApi.send` for window control, file ops; `ipcApi.chooseFormat` for export dialog
- All IPC channels defined in `electron/preload.ts`

### Preview Rendering (`src/renderPreview/`)
- markdown-it converts markdown to HTML with `data-source-line` attributes
- Content rendered in sandboxed iframes (`public/previewFrame.html`, `previewFramePaged.html`)
- Paginated mode uses pagedjs polyfill for PDF-like page breaks
- `scrolling.ts` handles bidirectional scroll sync between editor and preview (known performance issues on large docs — see `ANALYSIS.md`)

### Pandoc Integration (`electron/pandoc/`)
- `export.ts` builds pandoc CLI commands from YAML frontmatter options
- `import.ts` converts non-markdown files to markdown via pandoc
- Pandoc must be installed separately on the system

### Settings & Data
- `electron/dataDir.ts` manages platform-specific data directory (read/write)
- `electron/settings.ts` persists settings (currently `autoUpdateApp` boolean)
- Settings loaded at app startup, written via `saveSettings()`

## Key Patterns

- **Platform-specific UI**: CSS class `.\_macOS` added at runtime; toolbar renders native window controls on macOS
- **Editor**: CodeMirror 5 with `yaml-frontmatter` mode (markdown body + YAML header)
- **View modes**: `ViewSplit` type controls layout — `'onlyEditor' | 'split' | 'onlyPreview'`
- **Throttled rendering**: Preview re-renders are throttled to avoid performance issues
- **Auto-updates**: electron-updater checks GitHub releases from `ExactDoug/panwriter`

## Distribution

electron-builder config in `package.json` under `"build"`:
- macOS: DMG + ZIP (universal: arm64 + x64)
- Windows: NSIS installer (x64 + arm64)
- Linux: AppImage (x64 + arm64)
- File associations: .md, .markdown, .txt, .html, .docx, .odt, .tex
