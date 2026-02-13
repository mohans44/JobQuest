document.addEventListener('DOMContentLoaded', async () => {
  const companyInput = document.getElementById('company');
  const titleInput = document.getElementById('title');
  const urlInput = document.getElementById('url');
  const dateInput = document.getElementById('date');
  const statusSelect = document.getElementById('status');
  const saveBtn = document.getElementById('save-btn');
  const manualBtn = document.getElementById('add-manual-btn');
  const jobsList = document.getElementById('jobs-list');
  const exportBtn = document.getElementById('export-csv-btn');
  const dashBtn = document.getElementById('open-dashboard');
  const rescanBtn = document.getElementById('rescan-btn');
  const msgArea = document.getElementById('msg-area');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  const DEFAULT_COLUMNS = ['Applied', 'Assessment', 'Under Review', 'Interview', 'Offer', 'Rejected'];
  const STATUS_STYLE = {
    Applied: { light: 'background-color: rgb(220 252 231 / 0.8); border-color: rgb(187 247 208); color: rgb(15 23 42);', dark: 'background-color: rgb(22 163 74 / 0.32); border-color: rgb(74 222 128 / 0.55); color: rgb(241 245 249);' },
    Assessment: { light: 'background-color: rgb(219 234 254 / 0.8); border-color: rgb(191 219 254); color: rgb(15 23 42);', dark: 'background-color: rgb(59 130 246 / 0.32); border-color: rgb(147 197 253 / 0.55); color: rgb(241 245 249);' },
    'Under Review': { light: 'background-color: rgb(254 249 195 / 0.8); border-color: rgb(253 224 71 / 0.5); color: rgb(15 23 42);', dark: 'background-color: rgb(245 158 11 / 0.32); border-color: rgb(252 211 77 / 0.55); color: rgb(241 245 249);' },
    Interview: { light: 'background-color: rgb(224 231 255 / 0.8); border-color: rgb(199 210 254); color: rgb(15 23 42);', dark: 'background-color: rgb(6 182 212 / 0.32); border-color: rgb(103 232 249 / 0.55); color: rgb(241 245 249);' },
    Offer: { light: 'background-color: rgb(209 250 229 / 0.8); border-color: rgb(110 231 183); color: rgb(15 23 42);', dark: 'background-color: rgb(16 185 129 / 0.32); border-color: rgb(110 231 183 / 0.55); color: rgb(241 245 249);' },
    Rejected: { light: 'background-color: rgb(254 226 226 / 0.8); border-color: rgb(252 165 165); color: rgb(15 23 42);', dark: 'background-color: rgb(239 68 68 / 0.32); border-color: rgb(252 165 165 / 0.55); color: rgb(241 245 249);' },
  };

  let statusOptions = [...DEFAULT_COLUMNS];

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
    renderJobs();
  }

  function showMsg(text, tone = 'ok') {
    msgArea.textContent = text;
    const tones = {
      ok: 'rgb(22 163 74)',
      warn: 'rgb(217 119 6)',
      error: 'rgb(220 38 38)',
    };
    msgArea.style.color = tones[tone] || tones.ok;
    msgArea.classList.remove('opacity-0');
    msgArea.classList.add('opacity-100');
    setTimeout(() => {
      msgArea.classList.remove('opacity-100');
      msgArea.classList.add('opacity-0');
    }, 2200);
  }

  function normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
      const u = new URL(rawUrl.trim());
      const blocked = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gh_jid'];
      blocked.forEach((key) => u.searchParams.delete(key));
      u.hash = '';
      return u.toString();
    } catch (_error) {
      return rawUrl.trim();
    }
  }

  async function loadColumns() {
    const { kanbanColumns } = await getStorage(['kanbanColumns']);
    statusOptions = Array.isArray(kanbanColumns) && kanbanColumns.length ? kanbanColumns : [...DEFAULT_COLUMNS];
    if (!kanbanColumns) {
      await setStorage({ kanbanColumns: statusOptions });
    }
    statusSelect.innerHTML = statusOptions.map((status) => `<option value="${status}">${status}</option>`).join('');
    if (!statusOptions.includes(statusSelect.value)) {
      statusSelect.value = statusOptions[0];
    }
  }

  async function loadJobsFromStorage() {
    const { jobs } = await getStorage(['jobs']);
    return Array.isArray(jobs) ? jobs : [];
  }

  function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function createStatusOptions(selected) {
    return statusOptions
      .map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`)
      .join('');
  }

  function getStatusStyle(status) {
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const style = STATUS_STYLE[status] || STATUS_STYLE.Applied;
    return style[mode];
  }

  async function renderJobs() {
    const jobs = await loadJobsFromStorage();
    jobsList.innerHTML = '';

    if (!jobs.length) {
      jobsList.innerHTML = '<div class="panel-soft p-4 text-center text-xs text-slate-500">No tracked jobs yet.</div>';
      return;
    }

    jobs.forEach((job) => {
      const card = document.createElement('article');
      card.className = 'panel p-3 shadow-card';

      const pillStyle = getStatusStyle(job.status);
      card.innerHTML = `
        <div class="mb-2 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <a href="${job.url || '#'}" target="_blank" rel="noreferrer" class="block truncate text-sm font-semibold hover:text-blue-600" title="${job.title || ''}">${job.title || 'Untitled role'}</a>
            <p class="truncate text-xs text-slate-500 dark:text-slate-300">${job.company || 'Unknown company'}</p>
          </div>
          <button class="icon-btn delete-job h-8 w-8 p-0" data-id="${job.id}" title="Delete" aria-label="Delete">×</button>
        </div>
        <div class="flex items-center justify-between gap-2 border-t pt-2 text-[11px]">
          <span class="text-slate-500 dark:text-slate-300">${job.date || ''}</span>
          <select class="status-pill status-select" data-id="${job.id}" style="${pillStyle}">
            ${createStatusOptions(job.status)}
          </select>
        </div>
      `;

      card.querySelector('.delete-job').addEventListener('click', async (event) => {
        const { id } = event.currentTarget.dataset;
        await deleteJob(id);
      });

      card.querySelector('.status-select').addEventListener('change', async (event) => {
        const { id } = event.currentTarget.dataset;
        await updateStatus(id, event.currentTarget.value);
      });

      jobsList.appendChild(card);
    });
  }

  async function deleteJob(id) {
    if (!confirm('Delete this job entry?')) return;
    const jobs = await loadJobsFromStorage();
    const nextJobs = jobs.filter((job) => job.id !== id);
    await setStorage({ jobs: nextJobs });
    await renderJobs();
  }

  async function updateStatus(id, status) {
    const jobs = await loadJobsFromStorage();
    const index = jobs.findIndex((job) => job.id === id);
    if (index === -1) return;
    jobs[index].status = status;
    await setStorage({ jobs });
    await renderJobs();
  }

  function sendMessageToTab(tabId, payload) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || null);
      });
    });
  }

  function injectContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  async function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0]));
    });
  }

  function hydrateForm(scraped) {
    if (scraped?.company) companyInput.value = scraped.company;
    if (scraped?.title) titleInput.value = scraped.title;
    if (scraped?.url) urlInput.value = scraped.url;
    if (scraped?.jobId) {
      saveBtn.dataset.scrapedJobId = scraped.jobId;
    } else {
      delete saveBtn.dataset.scrapedJobId;
    }
  }

  async function scrapeActiveTab(showFeedback = true) {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) return;

    if (activeTab.url && /^https?:\/\//.test(activeTab.url)) {
      if (!urlInput.value) urlInput.value = activeTab.url;
    }

    try {
      let scraped;
      try {
        scraped = await sendMessageToTab(activeTab.id, { action: 'scrape_job' });
      } catch (_firstError) {
        await injectContentScript(activeTab.id);
        scraped = await sendMessageToTab(activeTab.id, { action: 'scrape_job' });
      }

      if (scraped) {
        hydrateForm(scraped);
      }

      if (showFeedback) {
        showMsg(scraped?.title || scraped?.company ? 'Job details captured.' : 'Page scanned. Enter missing details manually.', 'ok');
      }
    } catch (_error) {
      if (showFeedback) {
        showMsg('Unable to scan this page (restricted or unsupported).', 'warn');
      }
    }
  }

  async function saveJob() {
    const company = companyInput.value.trim();
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();

    if (!company || !title) {
      showMsg('Company and role title are required.', 'error');
      return;
    }

    const job = {
      id: Date.now().toString(),
      jobId: saveBtn.dataset.scrapedJobId || null,
      company,
      title,
      url,
      date: formatDate(dateInput.value),
      status: statusSelect.value || statusOptions[0],
    };

    const jobs = await loadJobsFromStorage();
    const normalizedCurrent = normalizeUrl(job.url);

    const duplicate = jobs.some((entry) => {
      if (job.jobId && entry.jobId && job.jobId === entry.jobId) return true;
      if (!normalizedCurrent) return false;
      return normalizeUrl(entry.url) === normalizedCurrent;
    });

    if (duplicate) {
      showMsg('This job is already tracked.', 'warn');
      return;
    }

    const updated = [job, ...jobs];
    await setStorage({ jobs: updated });
    await renderJobs();
    showMsg('Job saved.', 'ok');
  }

  async function exportJobs() {
    const jobs = await loadJobsFromStorage();
    if (!jobs.length) {
      showMsg('No jobs to export.', 'warn');
      return;
    }

    const csv = [
      'Company,Title,Status,Date,URL',
      ...jobs.map((job) => `"${job.company}","${job.title}","${job.status}","${job.date}","${job.url}"`),
    ].join('\n');

    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = 'job_applications.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function resetForm() {
    companyInput.value = '';
    titleInput.value = '';
    urlInput.value = '';
    dateInput.valueAsDate = new Date();
    statusSelect.value = statusOptions[0];
    delete saveBtn.dataset.scrapedJobId;
  }

  themeToggleBtn.addEventListener('click', toggleTheme);
  rescanBtn.addEventListener('click', () => {
    scrapeActiveTab(true);
  });
  saveBtn.addEventListener('click', saveJob);
  manualBtn.addEventListener('click', resetForm);
  exportBtn.addEventListener('click', exportJobs);

  dashBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  dateInput.valueAsDate = new Date();
  await initTheme();
  await loadColumns();
  await renderJobs();
  await scrapeActiveTab(false);
});
