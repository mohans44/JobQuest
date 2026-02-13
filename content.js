(() => {
  if (window.__getJobScraperInstalled) {
    return;
  }
  window.__getJobScraperInstalled = true;

  const clean = (value) => {
    if (!value) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  };

  const parseJson = (text) => {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  };

  const flattenJsonLd = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) {
      return payload.flatMap(flattenJsonLd);
    }
    if (typeof payload !== 'object') {
      return [];
    }
    if (Array.isArray(payload['@graph'])) {
      return payload['@graph'].flatMap(flattenJsonLd);
    }
    return [payload];
  };

  const extractFromJsonLd = () => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const parsed = parseJson(script.textContent || '');
      const entities = flattenJsonLd(parsed);
      for (const entity of entities) {
        if (!entity || entity['@type'] !== 'JobPosting') continue;

        const title = clean(entity.title);
        let company = '';
        if (typeof entity.hiringOrganization === 'string') {
          company = clean(entity.hiringOrganization);
        } else if (entity.hiringOrganization && typeof entity.hiringOrganization === 'object') {
          company = clean(entity.hiringOrganization.name);
        }

        if (title || company) {
          return { title, company };
        }
      }
    }
    return { title: '', company: '' };
  };

  const extractFromMeta = () => {
    const ogTitle = clean(document.querySelector('meta[property="og:title"]')?.content);
    const ogSite = clean(document.querySelector('meta[property="og:site_name"]')?.content);
    return { title: ogTitle, company: ogSite };
  };

  const bySelectors = (selectors) => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const value = clean(el?.textContent || el?.innerText);
      if (value) return value;
    }
    return '';
  };

  const siteSpecific = (hostname) => {
    const data = { title: '', company: '' };

    if (hostname.includes('linkedin.com')) {
      data.title = bySelectors([
        '.job-details-jobs-unified-top-card__job-title h1',
        '.job-details-jobs-unified-top-card__job-title',
        'h1',
      ]);
      data.company = bySelectors([
        '.job-details-jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__primary-description-container a',
      ]);
    } else if (hostname.includes('greenhouse.io')) {
      data.title = bySelectors(['.app-title', 'h1']);
      data.company = bySelectors(['.company-name', '.company']);
    } else if (hostname.includes('lever.co')) {
      data.title = bySelectors(['.posting-headline h2', '.posting-headline h1', 'h1']);
      data.company = bySelectors(['.posting-categories .sort-by-team', '.posting-categories .sort-by-office']);
    } else if (hostname.includes('workday')) {
      data.title = bySelectors(["[data-automation-id='jobPostingHeader']", 'h1']);
      data.company = bySelectors(["[data-automation-id='company']", "[data-automation-id='locations']"]);
    } else if (hostname.includes('indeed.com')) {
      data.title = bySelectors(["h1[data-testid='jobsearch-JobInfoHeader-title']", 'h1']);
      data.company = bySelectors(["[data-testid='inlineHeader-companyName']", "[data-testid='company-name']"]);
    } else if (hostname.includes('glassdoor.com')) {
      data.title = bySelectors(["[data-test='job-title']", 'h1']);
      data.company = bySelectors(["[data-test='employer-name']"]);
    } else if (hostname.includes('wellfound.com') || hostname.includes('angel.co')) {
      data.title = bySelectors(['h1']);
      data.company = bySelectors(["[data-test='JobPageHeader-CompanyName'] a", "[data-test='JobPageHeader-CompanyName']"]);
    }

    return data;
  };

  const parseCompanyFromDocumentTitle = (title, pageTitle) => {
    const text = clean(pageTitle);
    if (!text) return '';

    for (const token of [' - ', ' | ', ' at ']) {
      if (!text.includes(token)) continue;
      const parts = text.split(token).map(clean).filter(Boolean);
      if (parts.length < 2) continue;
      if (!title) return parts[parts.length - 1];
      const candidate = parts.find((part) => part !== title);
      if (candidate) return candidate;
    }
    return '';
  };

  const extractJobId = (url) => {
    if (!url) return null;

    if (url.includes('linkedin.com')) {
      const match = url.match(/currentJobId=(\d+)/) || url.match(/view\/(\d+)/) || url.match(/jobs\/view\/(\d+)/);
      if (match) return `linkedin-${match[1]}`;
    }

    if (url.includes('greenhouse.io')) {
      const match = url.match(/jobs\/(\d+)/);
      if (match) return `greenhouse-${match[1]}`;
    }

    if (url.includes('lever.co')) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const candidate = parts[parts.length - 1];
      if (candidate && candidate.length > 5) return `lever-${candidate}`;
    }

    if (url.includes('workday')) {
      const match = url.match(/job\/.+\/(.+)$/);
      if (match) return `workday-${clean(match[1])}`;
    }

    return null;
  };

  const stripCompanyFromTitle = (title, company) => {
    if (!title || !company) return title;
    return clean(
      title
        .replace(` - ${company}`, '')
        .replace(` at ${company}`, '')
        .replace(` | ${company}`, '')
    );
  };

  const getJobDetails = () => {
    const url = window.location.href;
    const hostname = window.location.hostname;

    let title = '';
    let company = '';

    const ld = extractFromJsonLd();
    title = title || ld.title;
    company = company || ld.company;

    const meta = extractFromMeta();
    title = title || meta.title;
    company = company || meta.company;

    const site = siteSpecific(hostname);
    title = title || site.title;
    company = company || site.company;

    title = title || bySelectors(['h1']);

    if (!company) {
      company = parseCompanyFromDocumentTitle(title, document.title);
    }

    title = stripCompanyFromTitle(clean(title), clean(company));
    company = clean(company);

    return {
      title,
      company,
      url,
      date: new Date().toISOString().slice(0, 10),
      jobId: extractJobId(url),
    };
  };

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action !== 'scrape_job') return false;

    try {
      sendResponse(getJobDetails());
    } catch (_error) {
      sendResponse({
        title: '',
        company: '',
        url: window.location.href,
        date: new Date().toISOString().slice(0, 10),
        jobId: null,
      });
    }

    return true;
  });
})();
