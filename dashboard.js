document.addEventListener('DOMContentLoaded', async () => {
  const kanbanBoard = document.getElementById('kanban-board');
  const listView = document.getElementById('list-view');
  const listTbody = document.getElementById('list-tbody');
  const viewKanbanBtn = document.getElementById('view-kanban');
  const viewListBtn = document.getElementById('view-list');
  const searchInput = document.getElementById('search-input');
  const totalCountEl = document.getElementById('total-count');
  const exportBtn = document.getElementById('export-csv-btn');
  const currentDateEl = document.getElementById('current-date');
  const addColumnBtn = document.getElementById('add-column-btn');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  const DEFAULT_COLUMNS = ['Applied', 'Under Review', 'Assessment', 'Interview', 'Offer', 'Rejected'];
  const DEFAULT_COLUMN_WIDTH = 296;
  const MIN_COLUMN_WIDTH = 240;
  const MAX_COLUMN_WIDTH = 520;
  const DEFAULT_NEW_SECTION_COLOR = '#6366f1';

  const DEFAULT_SECTION_COLORS = {
    Applied: '#3b82f6',
    'Under Review': '#f59e0b',
    Assessment: '#8b5cf6',
    Interview: '#06b6d4',
    Offer: '#10b981',
    Rejected: '#ef4444',
  };

  let allJobs = [];
  let kanbanColumns = [...DEFAULT_COLUMNS];
  let kanbanColumnWidths = {};
  let kanbanSectionColors = { ...DEFAULT_SECTION_COLORS };
  let view = 'kanban';
  let draggedCardId = null;

  function clampWidth(value) {
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, value));
  }

  function widthForColumn(status) {
    const raw = Number(kanbanColumnWidths[status]);
    if (Number.isNaN(raw) || raw <= 0) return DEFAULT_COLUMN_WIDTH;
    return clampWidth(raw);
  }

  function hexToRgb(hex) {
    const safe = (hex || '').replace('#', '').trim();
    if (!/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(safe)) return null;

    const full = safe.length === 3
      ? safe.split('').map((ch) => ch + ch).join('')
      : safe;

    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return { r, g, b };
  }

  function colorFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return {
        bg: 'rgb(219 234 254 / 0.75)',
        text: 'rgb(29 78 216)',
        border: 'rgb(147 197 253)',
      };
    }

    const isDark = document.documentElement.classList.contains('dark');
    const luminance = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
    const text = isDark ? 'rgb(241 245 249)' : 'rgb(15 23 42)';
    const bgAlpha = isDark ? 0.32 : 0.18;
    const borderAlpha = isDark ? 0.55 : 0.5;

    return {
      bg: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${bgAlpha})`,
      text,
      border: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${borderAlpha})`,
    };
  }

  function sectionColor(status) {
    return kanbanSectionColors[status] || DEFAULT_NEW_SECTION_COLOR;
  }

  function statusStyle(status) {
    return colorFromHex(sectionColor(status));
  }

  function getStorage(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function setStorage(payload) {
    return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
  }

  function renderThemeIcon(isDark) {
    themeIcon.innerHTML = isDark
      ? '<svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.4"></path><path d="M12 19.6V22"></path><path d="M4.93 4.93l1.7 1.7"></path><path d="M17.37 17.37l1.7 1.7"></path><path d="M2 12h2.4"></path><path d="M19.6 12H22"></path><path d="M4.93 19.07l1.7-1.7"></path><path d="M17.37 6.63l1.7-1.7"></path></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"></path></svg>';
  }

  async function initTheme() {
    const { theme } = await getStorage(['theme']);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = theme ? theme === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', useDark);
    renderThemeIcon(useDark);
  }

  async function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    renderThemeIcon(isDark);
    await setStorage({ theme: isDark ? 'dark' : 'light' });
    render();
  }

  function updateDateLabel() {
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function filteredJobs() {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) return [...allJobs];
    return allJobs.filter((job) => {
      const company = (job.company || '').toLowerCase();
      const title = (job.title || '').toLowerCase();
      return company.includes(term) || title.includes(term);
    });
  }

  function makeStatusOptions(selected) {
    return kanbanColumns
      .map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`)
      .join('');
  }

  function setActiveNav() {
    const baseBtn = 'btn-secondary inline-flex w-full justify-start gap-2';
    viewKanbanBtn.className = `${baseBtn}${view === 'kanban' ? ' ring-2 ring-slate-300 dark:ring-slate-600' : ''}`;
    viewListBtn.className = `${baseBtn}${view === 'list' ? ' ring-2 ring-slate-300 dark:ring-slate-600' : ''}`;

    kanbanBoard.classList.toggle('hidden', view !== 'kanban');
    listView.classList.toggle('hidden', view !== 'list');
  }

  function attachColumnResize(handle, column, status) {
    let startX = 0;
    let startWidth = 0;

    const onMove = (event) => {
      const delta = event.clientX - startX;
      const nextWidth = clampWidth(startWidth + delta);
      column.style.width = `${nextWidth}px`;
      column.style.minWidth = `${nextWidth}px`;
      kanbanColumnWidths[status] = nextWidth;
    };

    const onUp = async () => {
      handle.classList.remove('is-active');
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      await setStorage({ kanbanColumnWidths });
    };

    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      startX = event.clientX;
      startWidth = column.getBoundingClientRect().width;
      handle.classList.add('is-active');
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  function attachColorPicker(colorBtn, colorInput, status) {
    colorBtn.addEventListener('click', () => {
      colorInput.click();
    });

    colorInput.addEventListener('input', async (event) => {
      const nextColor = event.currentTarget.value;
      kanbanSectionColors[status] = nextColor;
      await setStorage({ kanbanSectionColors });
      render();
    });
  }

  function renderKanban() {
    const jobs = filteredJobs();
    kanbanBoard.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'flex h-full min-w-max gap-2 pb-1 pr-2';

    kanbanColumns.forEach((status) => {
      const style = statusStyle(status);
      const cards = jobs.filter((job) => job.status === status);
      const width = widthForColumn(status);
      const colorHex = sectionColor(status);

      const col = document.createElement('section');
      col.className = 'kanban-column';
      col.dataset.status = status;
      col.style.width = `${width}px`;
      col.style.minWidth = `${width}px`;

      col.innerHTML = `
        <header class="mb-2 flex items-center justify-between gap-1 px-1 py-1">
          <span class="status-pill" style="background-color: ${style.bg}; color: ${style.text}; border-color: ${style.border};">${status}</span>
          <div class="flex items-center gap-1">
            <span class="rounded-full border px-2 py-0.5 text-[11px] text-slate-500">${cards.length}</span>
            <button class="color-dot-btn section-color-btn" title="Change section color" aria-label="Change section color">
              <span class="h-3 w-3 rounded-full border border-white/50" style="background-color:${colorHex}"></span>
            </button>
            <input type="color" class="section-color-input" value="${colorHex}" aria-label="Section color">
          </div>
        </header>
        <div class="drop-zone min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-1"></div>
        <div class="column-resize-handle" title="Drag to resize"></div>
      `;

      const zone = col.querySelector('.drop-zone');
      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('ring-2', 'ring-blue-300');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('ring-2', 'ring-blue-300'));
      zone.addEventListener('drop', async (event) => {
        event.preventDefault();
        zone.classList.remove('ring-2', 'ring-blue-300');
        if (!draggedCardId) return;
        await updateJobStatus(draggedCardId, status);
        draggedCardId = null;
      });

      const resizeHandle = col.querySelector('.column-resize-handle');
      attachColumnResize(resizeHandle, col, status);

      const colorBtn = col.querySelector('.section-color-btn');
      const colorInput = col.querySelector('.section-color-input');
      attachColorPicker(colorBtn, colorInput, status);

      cards.forEach((job) => {
        zone.appendChild(createKanbanCard(job));
      });

      grid.appendChild(col);
    });

    kanbanBoard.appendChild(grid);
  }

  function createKanbanCard(job) {
    const card = document.createElement('article');
    card.className = 'panel cursor-grab p-2.5 shadow-card';
    card.draggable = true;
    card.dataset.id = job.id;

    card.innerHTML = `
      <div class="mb-1.5 flex items-start justify-between gap-2">
        <div class="min-w-0">
          <a href="${job.url || '#'}" target="_blank" rel="noreferrer" class="card-title block truncate text-sm font-semibold hover:text-blue-600" title="${job.title || ''}">${job.title || 'Untitled role'}</a>
          <p class="mt-1 truncate text-xs text-slate-500">${job.company || 'Unknown company'}</p>
        </div>
        <button class="icon-btn delete-job h-8 w-8" data-id="${job.id}" aria-label="Delete" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
          </svg>
        </button>
      </div>
      <div class="mt-2 flex items-center justify-between border-t pt-2 text-[11px]">
        <span class="inline-flex items-center gap-1 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v6l4 2"></path>
          </svg>
          <span>${job.date || ''}</span>
        </span>
        <span class="inline-flex items-center gap-1 text-slate-500">
          <span class="h-1.5 w-1.5 rounded-full" style="background-color:${sectionColor(job.status)}"></span>
          <span>${job.status}</span>
        </span>
      </div>
    `;

    card.addEventListener('dragstart', () => {
      draggedCardId = job.id;
      card.classList.add('opacity-50');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-50');
      draggedCardId = null;
    });

    card.querySelector('.delete-job').addEventListener('click', async (event) => {
      const { id } = event.currentTarget.dataset;
      await deleteJob(id);
    });

    return card;
  }

  function renderList() {
    const jobs = filteredJobs();
    listTbody.innerHTML = '';

    if (!jobs.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td class="p-4 text-sm text-slate-500" colspan="5">No matching jobs.</td>';
      listTbody.appendChild(emptyRow);
      return;
    }

    jobs.forEach((job) => {
      const style = statusStyle(job.status);
      const row = document.createElement('tr');
      row.className = 'transition hover:bg-slate-50 dark:hover:bg-slate-800/30';
      row.innerHTML = `
        <td class="border-b p-4 font-semibold text-slate-800 dark:text-slate-100">${job.company || ''}</td>
        <td class="border-b p-4"><a href="${job.url || '#'}" target="_blank" rel="noreferrer" class="text-blue-600 hover:text-blue-500">${job.title || ''}</a></td>
        <td class="border-b p-4 text-xs text-slate-500 dark:text-slate-300">${job.date || ''}</td>
        <td class="border-b p-4">
          <select class="status-pill status-select w-full" data-id="${job.id}" style="background-color: ${style.bg}; color: ${style.text}; border-color: ${style.border};">
            ${makeStatusOptions(job.status)}
          </select>
        </td>
        <td class="border-b p-4 text-right">
          <button class="icon-btn delete-job" data-id="${job.id}" aria-label="Delete" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
              <path d="M3 6h18"></path>
              <path d="M8 6V4h8v2"></path>
              <path d="M19 6l-1 14H6L5 6"></path>
            </svg>
          </button>
        </td>
      `;

      row.querySelector('.status-select').addEventListener('change', async (event) => {
        const { id } = event.currentTarget.dataset;
        await updateJobStatus(id, event.currentTarget.value);
      });

      row.querySelector('.delete-job').addEventListener('click', async (event) => {
        const { id } = event.currentTarget.dataset;
        await deleteJob(id);
      });

      listTbody.appendChild(row);
    });
  }

  function updateStats() {
    totalCountEl.textContent = String(allJobs.length);
  }

  async function updateJobStatus(id, status) {
    const index = allJobs.findIndex((job) => job.id === id);
    if (index === -1) return;
    allJobs[index].status = status;
    await setStorage({ jobs: allJobs });
    render();
  }

  async function deleteJob(id) {
    if (!confirm('Delete this job entry?')) return;
    allJobs = allJobs.filter((job) => job.id !== id);
    await setStorage({ jobs: allJobs });
    render();
  }

  function exportCsv() {
    if (!allJobs.length) return;
    const csv = [
      'Company,Title,Status,Date,URL',
      ...allJobs.map((job) => `"${job.company}","${job.title}","${job.status}","${job.date}","${job.url}"`),
    ].join('\n');

    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = 'job_tracker_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function addColumn() {
    const name = prompt('Enter section name');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed || kanbanColumns.includes(trimmed)) return;

    const color = prompt('Section color hex (optional, e.g. #6366f1)', DEFAULT_NEW_SECTION_COLOR) || DEFAULT_NEW_SECTION_COLOR;

    kanbanColumns.push(trimmed);
    kanbanColumnWidths[trimmed] = DEFAULT_COLUMN_WIDTH;
    kanbanSectionColors[trimmed] = color;
    await setStorage({ kanbanColumns, kanbanColumnWidths, kanbanSectionColors });
    render();
  }

  async function loadData() {
    const data = await getStorage(['jobs', 'kanbanColumns', 'kanbanColumnWidths', 'kanbanSectionColors']);
    allJobs = Array.isArray(data.jobs) ? data.jobs : [];
    kanbanColumns = Array.isArray(data.kanbanColumns) && data.kanbanColumns.length
      ? data.kanbanColumns
      : [...DEFAULT_COLUMNS];
    kanbanColumnWidths = data.kanbanColumnWidths && typeof data.kanbanColumnWidths === 'object'
      ? data.kanbanColumnWidths
      : {};

    kanbanSectionColors = {
      ...DEFAULT_SECTION_COLORS,
      ...(data.kanbanSectionColors && typeof data.kanbanSectionColors === 'object' ? data.kanbanSectionColors : {}),
    };

    if (!data.kanbanColumns) {
      await setStorage({ kanbanColumns });
    }
  }

  function render() {
    updateStats();
    setActiveNav();
    renderKanban();
    if (view === 'list') {
      renderList();
    }
  }

  viewKanbanBtn.addEventListener('click', () => {
    view = 'kanban';
    render();
  });

  viewListBtn.addEventListener('click', () => {
    view = 'list';
    render();
  });

  searchInput.addEventListener('input', render);
  exportBtn.addEventListener('click', exportCsv);
  addColumnBtn.addEventListener('click', addColumn);
  themeToggleBtn.addEventListener('click', toggleTheme);

  updateDateLabel();
  await initTheme();
  await loadData();
  render();
});
