# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Youlag is a FreshRSS extension (PHP + vanilla JS + SCSS) that overrides the FreshRSS UI to provide a video-centric experience for YouTube RSS feeds and a modernized article reading view.

## Build commands

```bash
npm install           # Install dependencies
npm run build         # Minify JS + compile SCSS → dist/ (production zip)
npm run watch         # Dev mode: unminified JS + sass --watch, with optional file sync to FreshRSS
npm run build-js      # JS only (terser)
npm run build-css     # SCSS only (sass)
```

No test suite exists (`npm test` exits with an error by default).

## Dev environment setup

Copy `.env.example` to `.env`. Set `FRESHRSS_DEV_FOLDER` to your local FreshRSS extensions path and `FRESHRSS_DEV_FOLDER_FILE_SYNC=true` to have `npm run watch` automatically sync changes there. Without this, `watch` still compiles but doesn't copy files.

## Architecture

### PHP side (`extension.php`, `configure.phtml`)

`extension.php` is the FreshRSS extension entry point. It:
- Registers `nav_entries` hooks that inject small `<div>` elements into the page carrying user settings as `data-*` attributes (e.g. `data-yl-category-whitelist`, `data-yl-miniplayer-swipe-enabled`). This is the primary bridge from PHP settings to the JS frontend.
- Registers `entry_before_display` to rewrite YouTube URLs to Invidious when configured.
- Registers `entry_before_insert` to optionally block YouTube Shorts before they are saved to the DB.
- Forces specific FreshRSS user config values (theme, topline layout, etc.) that Youlag's CSS depends on.

`configure.phtml` renders the settings form; `handleConfigureAction()` in `extension.php` saves values to `FreshRSS_Context::userConf()`.

### JS side (`src/`)

All JS files are concatenated in order (defined in `scripts/build.js` and `scripts/watch.js`) into a single `static/script.min.js`. There is no module system — all functions are global.

File responsibilities:
| File | Role |
|---|---|
| `global.js` | `window.app` — all global state, constants, type definitions (IDs, class names, breakpoints) |
| `db.js` | IndexedDB wrapper for caching DeArrow API responses and video durations |
| `utilities.js` | General-purpose helpers (DOM queries, URL params, layout detection); `isLayoutVideo()` / `isLayoutArticle()` determine the current page mode; `markVideoFeedItems()` stamps `data-yl-is-video="true"` on video entries |
| `helpers.js` | Per-entry logic: extracting video data from DOM, tag management, category whitelist checks; `extractFeedItemData()` sets `isVideoFeedItem` by detecting YouTube/Invidious URLs |
| `ui.js` | Click listeners, popstate, article/video open/close flows; `setupArticleThreePaneLayout()` builds the resizable article-list + content side-by-side pane |
| `ui-modals.js` | Video/article modal rendering and content population |
| `ui-video-control.js` | YouTube iframe API integration (playback, chapters, autoplay) |
| `ui-modes.js` | Fullscreen ↔ miniplayer mode transitions |
| `forms.js` | Settings page interactions and form helpers |
| `events.js` | `init()` entry point — called on page load; orchestrates feature setup |
| `debug.js` | Debug panel and logging (only active when debug mode is on) |

### CSS (`src/theme.scss`)

Single SCSS file compiled to `static/theme.min.css`. Youlag overrides the FreshRSS `Mapco` theme.

### Build output

`npm run build` produces `dist/youlag-{version}.zip` containing `xExtension-Youlag/` — the exact folder structure needed for FreshRSS's extensions directory.

## Key conventions

- **Settings bridge**: PHP writes user settings as `data-*` attributes on injected `<div>` elements. JS reads these from the DOM during `init()`. New settings require a PHP hook method, a DOM element in the PHP output, and a corresponding JS reader.
- **Global state**: All runtime state lives in `app.state.*` (defined in `global.js`). Check there before searching for where state is managed.
- **No module system**: All functions are globally scoped. When adding a function, place it in the most semantically appropriate file; there's no import/export.
- **Version injection**: `app.metadata.version` is a placeholder `'X.Y.Z'` in source; `build.js`/`watch.js` replace it at compile time from `metadata.json`.
- **DeArrow integration**: The `dearrow` IndexedDB store (4-week TTL) caches thumbnail/title replacement data from `sponsor.ajay.app`.
- **Auto-detect video feeds**: PHP checks `FreshRSS_Context::$feed` URL for YouTube/Invidious patterns and emits `data-yl-is-video-feed="true"` on the injected settings div. JS calls `markVideoFeedItems()` to stamp individual entries. The `isVideoFeedItem` field on the video object reflects per-entry detection (handles mixed feeds, e.g. when the YouTube Video Feed extension is installed).
- **Three-pane article layout**: Controlled by the `yl_article_three_pane_enabled` user setting. PHP injects `<div id="yl_article_three_pane_enabled" data-yl-article-three-pane-enabled="…">`. JS reads it in `setupArticleThreePaneLayout()` (called only when `isLayoutArticle()`) to build a draggable resizer between the feed list and the article content pane. State tracked via `app.state.youlag.threePaneInit`.
