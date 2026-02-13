# JobQuest Chrome Extension

JobQuest is a modern Chrome extension to track job applications from any job page, with a fast popup capture flow and a full dashboard offering Kanban and list views.

## Features

- One-click scrape of job details from active tab
- Manual add/edit workflow in popup
- Duplicate detection by job ID and normalized URL
- Dashboard with:
  - Kanban view
  - List view
  - Search
  - CSV export
  - Light/Dark mode
  - Adjustable Kanban section widths
  - Per-section color customization

## Project Structure

- `manifest.json` - Chrome extension manifest (MV3)
- `popup.html`, `popup.js` - Extension popup UI and logic
- `dashboard.html`, `dashboard.js` - Full dashboard UI and logic
- `content.js` - Page scraping logic injected into job pages
- `input.css` - Tailwind source styles
- `output.css` - Compiled Tailwind CSS used by UI
- `tailwind.config.js` - Tailwind configuration

## Prerequisites

- Node.js 18+
- npm
- Google Chrome (or Chromium-based browser)

## Install Dependencies

```bash
npm install
```

## Build CSS

```bash
npx tailwindcss -i ./input.css -o ./output.css
```

## Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `/Users/mohansai/Developer/getajob`

## Usage

1. Open a job posting page.
2. Click the JobQuest extension icon.
3. Click rescan if needed, verify fields, then click **Track**.
4. Open dashboard from popup for Kanban/List management.

## Data Storage

All data is stored in `chrome.storage.local`, including:

- jobs
- kanbanColumns
- kanbanColumnWidths
- kanbanSectionColors
- theme

## Development Notes

- Rebuild `output.css` after editing `input.css`.
- Reload the extension from `chrome://extensions/` after code changes.
- If UI classes in JS templates are changed, rebuild CSS to ensure Tailwind includes them.
