/**
 * Utilities
 *
 * General-purpose, cross-cutting utility functions.
 *
 * - Used for app-wide operations, data fetching, DOM and state utilities, and helpers that are not specific to a single feed entry or tag.
 * - Functions here are not tightly coupled to the UI handling.
 * - Examples: modal state, link parsing, global data fetchers, date formatting, etc.
 */

/*****************************************
 *
 * INDEX
 * - Modal utilities
 * - Link utilities
 * - State & settings utilities
 * - Data utilities
 *
 ****************************************/



/*****************************************
 * BEGIN "GENERAL UTILITIES"
 * General utility functions.
 ****************************************/

function isTextAllCaps(text) {
  // Check if a given text is all uppercase, ignoring non-letter characters.
  return /^[^a-z]*[A-Z][^a-z]*$/.test(text);
}

function formatTextToSentenceCase(text) {
  if (!text || typeof text !== 'string') return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/*****************************************
 * END "GENERAL UTILITIES"
 ****************************************/


/*****************************************
 * BEGIN "MODAL UTILITIES"
 * For handling video modal state and modes.
 ****************************************/

function getModalVideo() {
  return document.getElementById(app.modal.id.root);
}

function getModalMode() {
  return app.state.modal.mode; // 'miniplayer', 'fullscreen', or null
}

function isModeFullscreen() {
  return getModalMode() === 'fullscreen';
}

function isModeMiniplayer() {
  return getModalMode() === 'miniplayer';
}

function setModeState(mode) {
  if (mode !== 'miniplayer' && mode !== 'fullscreen' && mode !== null) return;
  return app.state.modal.mode = mode;
}

function getModalState() {
  return app.state.modal.active; // true = modal is active. Miniplayer does not count as active.
}

function setModalState(boolean) {
  return app.state.modal.active = boolean; // true = modal is active
}

/*****************************************
 * END "MODAL UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "LINK UTILITIES"
 * For handling link updates.
 ****************************************/

function updateAnchorLink(newUrl, anchorElement) {
  // Update anchor link href to a custom URL.
  if (anchorElement && anchorElement.tagName === 'A') {
    anchorElement.setAttribute('href', newUrl);
  }
}

function updateSidenavLinks() {
  // Update sidenav links for custom links.

  // Sort 'Watch later' by 'User modified 9→1': most recently added/modified feed items first.
  // TODO: refactor hardcoded classList.contains to use global `app` references.
  isWatchLaterSortModified = document.body.classList.contains('youlag-sort-watch_later--user-modified');

  if (!isWatchLaterSortModified) return;

  if (isWatchLaterSortModified) {
    updateAnchorLink(
      '/i/?a=normal&get=s&sort=lastUserModified&order=DESC',
      document.querySelector('#aside_feed #sidebar .category.favorites > a')
    );
  }
}

function updateAddFeedLink() {
  // Add a custom query param to the 'Add new feed' with the current category id, 
  // allowing auto-selection of the category in the 'add new feed' dropdown.

  const page = getCurrentPage();
  if (page.name === 'category') {
    // Use parentId if present, otherwise use id
    const categoryIdSource = page.parentId || page.id;
    const categoryId = categoryIdSource && categoryIdSource.startsWith('c_') ? categoryIdSource.match(/^c_(\d+)$/) : null;
    updateAnchorLink(
      `/i/?c=subscription&a=add&yl_category_id=${categoryId ? categoryId[1] : ''}`,
      document.querySelector('#btn-add')
    );
    return;
  }
}

function getVideoIdFromUrl(url) {
  // Match video ID from various sources, including YouTube, Invidious, Piped, and thumbnail URLs like ytimg.com/vi/[VIDEO_ID]/[quality].jpg

  // Standard video URL patterns
  const regex = /(?:\/|^)(?:shorts\/|v\/|e(?:mbed)?\/|\S*?[?&]v=|\S*?[?&]id=|v=)([a-zA-Z0-9_-]{11})(?:[\/\?]|$)/;
  let match = url.match(regex);
  if (match) return match[1];

  // YouTube thumbnail URL pattern: ytimg.com/vi/[VIDEO_ID]/[quality].jpg
  const thumbRegex = /ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\//;
  match = url.match(thumbRegex);
  if (match) return match[1];

  return '';
}

function getBaseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch (error) {
    console.error('Invalid URL:', error);
    return '';
  }
}

function matchURL(text) {
  // Find URLs in e.g. video description.
  if (!text || typeof text !== 'string') return [];
  let textWithoutAnchors = text.replace(/<a [^>]*href=["'][^"']+["'][^>]*>.*?<\/a>/gi, '');
  let urlPattern = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#@?=&%]/g;
  let matches = textWithoutAnchors.match(urlPattern);
  return matches ? matches : [];
}

function appendUrl(text) {
  // Append URLs anchor tags for URLs found in the video description, ignore existing potential anchor tags.
  if (!text || typeof text !== 'string') return text;
  let urlPattern = /https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#@?=&%]/g;
  let parts = text.split(/(<a [^>]*>.*?<\/a>)/gi);
  for (let i = 0; i < parts.length; i++) {
    // Only replace in non-anchor segments
    if (!/^<a [^>]*>.*<\/a>$/i.test(parts[i])) {
      parts[i] = parts[i].replace(urlPattern, function (url) {
        return '<a href="' + url + '" target="_blank">' + url + '</a>';
      });
    }
  }
  return parts.join('');
}

function sanitizeExtractedVideoUrl(content) {
  // Sanitize the extracted video URL, which sometimes might end up being an actual HTML tag.
  // Ensure that the content return is a valid URL string.

  const str = String(content);
  if (/^https?:\/\//.test(str.trim())) {
    // If it's a valid URL string, return as is
    return str.trim();
  }

  // Try to extract href attribute from HTML tag
  const hrefMatch = str.match(/href=["']([^"'>]+)["']/);
  if (hrefMatch && hrefMatch[1]) {
    return hrefMatch[1];
  }

  return '';
}

function appendOriginalSrc(element) {
  // Update lazyloaded content, where `data-original` stores the original src.
  // This is required as the content may not have been fully loaded during extraction for modal usage. 

  if (!element) return element;

  let root;
  if (typeof element === 'string') {
    const temp = document.createElement('div');
    temp.innerHTML = element;
    root = temp;
  }
  else if (element instanceof Element) {
    root = element.cloneNode(true);
  }
  else {
    return element;
  }

  const elementsLazyloaded = root.querySelectorAll('[data-original]');
  elementsLazyloaded.forEach(el => {
    const srcOriginal = el.getAttribute('data-original');
    if (srcOriginal) {
      el.setAttribute('src', srcOriginal);
    }
  });

  if (typeof element === 'string') {
    return root.innerHTML;
  }
  return root;
}


function getVideoScreencap(youtubeId) {
  // Returns the Dearrow thumbnail URL synchronously (no fallback check).
  if (!youtubeId) return '';
  return `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${youtubeId}`;
}

async function getVideoScreencapWithFallback(youtubeId) {
  // Resolves to the best available thumbnail URL.
  // 1. Try DeArrow. If it loads, return it.
  // 2. Try YouTube 1.jpg. If it loads and is NOT the placeholder, return it.
  // 3. Fallback to hqdefault.jpg.

  if (!youtubeId) return '';
  const dearrowUrl = getVideoScreencap(youtubeId);
  const youtubeScreencapUrl = `https://img.youtube.com/vi/${youtubeId}/1.jpg`;
  const youtubeThumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  
  // For determining if `1.jpg` is YouTube's placeholder image or not.
  // Hashes the pixels image corners and center only to cover most cases while being more performant.
  const youtubeThumbnailPlaceholderHash = 4395;

  function getImageHash(img) {
    // determine if image is YouTube's placeholder image or actual thumbnail/screencap,
    // YouTube always returns an image (even on 404). 
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const w = img.naturalWidth, h = img.naturalHeight;
    const data = ctx.getImageData(0, 0, w, h).data;

    function pixelSum(x, y) {
      const idx = (y * w + x) * 4;
      return data[idx] + data[idx+1] + data[idx+2] + data[idx+3];
    }
    
    let hash = 0;
    hash += pixelSum(0, 0); // top-left
    hash += pixelSum(w-1, 0); // top-right
    hash += pixelSum(0, h-1); // bottom-left
    hash += pixelSum(w-1, h-1); // bottom-right
    hash += pixelSum(Math.floor(w/2), Math.floor(h/2)); // center
    return hash;
  }

  // Try DeArrow first
  try {
    await new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dearrowUrl;
    });
    return dearrowUrl;
  } catch (e) {
    // DeArrow failed, try YouTube screencap
    try {
      const url = youtubeScreencapUrl;
      const img = await new Promise((resolve, reject) => {
        const i = new window.Image();
        i.crossOrigin = 'Anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      // If screencap endpoint return YouTube's placeholder thumbnail, fallback to original thumbnail.
      if (img.naturalWidth === 120 && img.naturalHeight === 90) {
        const hash = getImageHash(img);
        if (hash !== youtubeThumbnailPlaceholderHash) {
          return youtubeScreencapUrl;
        }
      }
    } catch (e2) {
      // Fallback to hqdefault in return
    }
    
    return youtubeThumbnailUrl;
  }
}

function markVideoFeedItems() {
  // Determine if it's a video source and then mark it as such.
  // Checks if the feed entry consist of links: YouTube, custom Invidious instance.
  const feedEntries = document.querySelectorAll(`${app.frss.el.feedRoot} ${app.frss.el.entry}`);
  if (!feedEntries || feedEntries.length === 0) return false;
  const invidiousSetting = document.querySelector(`${app.frss.el.feedRoot} ${app.frss.el.entry}[data-yl-invidious-instance]`);
  const invidiousInstanceUrl = invidiousSetting ? invidiousSetting.getAttribute('data-yl-invidious-instance') : null;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;

  // For every feed entry that has attr [data-link="videoUrl"] matching either YouTube or the custom Invidious instance, mark as video source.
  let isVideo = false;
  for (const entry of feedEntries) {
    const videoUrl = entry.getAttribute('data-link');
    if (videoUrl && (youtubeRegex.test(videoUrl) || (invidiousInstanceUrl && videoUrl.startsWith(invidiousInstanceUrl)))) {
      entry.setAttribute('data-yl-is-video', 'true');
      isVideo = true;
    }
  }
  return isVideo;
}

/*****************************************
 * END "LINK UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "STATE & SETTINGS UTILITIES"
 * To get and set various states.
 ****************************************/

function getAttrValue(attr, element) {
  // Helper to get any value of a data attribute. Where element is optional, defaults to using it as querySelector on document.
  const el = element || document;
  const value = el.querySelector(`[${attr}]`)?.getAttribute(attr);
  return value;
}

function isMobile() {
  return window.innerWidth <= app.breakpoints.desktop_md_max;
}

function getRelatedVideosSetting() {
  return document.querySelector('#yl_related_videos_source')?.getAttribute('data-yl-related-videos-source') || 'none';
}

function getHistoryPopstate() {
  return app.state.popstate.added; // true = history state for modal/article has been added
}

function setHistoryPopstate(state) {
  state = !!state;
  return app.state.popstate.added = state; // true = history state for modal/article has been added
}

function pushHistoryState(key, value = true) {
  // Pushes a new state to the history for modal close/back navigation.
  if (getModalState() && !getHistoryPopstate()) {
    const state = {};
    state[key] = value;
    history.pushState(state, '', '');
    setHistoryPopstate(true);
  }
}

function resetHistoryState() {
  // Fully resets the browser history state to null for the current URL.
  history.replaceState(null, '', location.href);
}

function getCurrentPage() {
  // Returns an object with details about the current page.
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const classPrefix = 'yl-page-';
  const fullUrl = window.location.href;
  const urlPath = window.location.origin + window.location.pathname;

  function prefixClasses(classString) {
    return classString.split(' ').map(cls => classPrefix + cls).join(' ');
  }

  let pageObject = {
    ...app.types.pageObject,
    url: fullUrl,
    urlPath: urlPath,
  }

  const routes = [
    {
      path: '/i/',
      match: () => urlParams.get('a') === 'normal' && urlParams.has('search'),
      className: 'search_results',
      name: 'search_results',
      id: null,
    },
    {
      path: '/i/',
      // Home page: no 'get' or 'c' param
      match: () => !urlParams.has('get') && !urlParams.has('c'),
      className: 'home',
      name: 'home',
      id: null,
    },
    {
      path: '/i/',
      match: () => urlParams.get('c') === 'extension',
      className: 'extension',
      name: 'extension',
      id: null,
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 'i',
      className: 'important',
      name: 'important',
      id: () => urlParams.get('get'),
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 's',
      className: 'watch_later',
      name: 'watch_later',
      id: () => urlParams.get('get'),
    },
    {
      path: '/i/',
      match: () => urlParams.get('get') === 'T',
      className: 'playlists',
      name: 'playlists',
      id: () => urlParams.get('get'),
    },
    {
      path: '/i/',
      match: () => /^t_\d+$/.test(urlParams.get('get') || ''),
      className: () => {
        const n = (urlParams.get('get') || '').substring(2);
        return `playlists t_${n}`;
      },
      name: 'playlists',
      id: () => urlParams.get('get'),
    },
    {
      path: '/i/',
      // Category page: get param starts with c_
      match: () => urlParams.get('get') && urlParams.get('get').startsWith('c_'),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category c_${n}`;
      },
      name: 'category',
      id: () => urlParams.get('get'),
    },
    {
      path: '/i/',
      match: () => (urlParams.get('get') && urlParams.get('get').startsWith('f_')),
      className: () => {
        const n = urlParams.get('get').substring(2);
        return `category`;
      },
      name: 'category',
      id: () => urlParams.get('get'),
    },
  ];

  for (const route of routes) {
    if (path === route.path && route.match()) {
      const classString = typeof route.className === 'function' ? route.className() : route.className;
      const nameString = route.name || (typeof route.className === 'string' ? route.className : '');
      const idValue = typeof route.id === 'function' ? route.id() : route.id;
      pageObject.name = nameString;
      pageObject.class = prefixClasses(classString);
      pageObject.id = idValue;
      if (
        idValue &&
        typeof getSubpageParentId === 'function' &&
        (idValue.startsWith('f_') || idValue.startsWith('t_'))
      ) {
        const parent = getSubpageParentId(idValue);
        pageObject.parentId = parent || '';
      }
      return pageObject;
    }
  }

  return pageObject;
}

function isFeedPage() {
  // Determine if the current page is a feed page.
  const feedPageNames = new Set([
    'home',
    'important',
    'watch_later',
    'playlists',
    'category',
    'search_results',
  ]);
  const page = getCurrentPage();
  return feedPageNames.has(page.name);
}

function isWatchLaterPage() {
  const page = getCurrentPage();
  return page.name === 'watch_later';
}

function getFeedRoot() {
  return document.querySelector(app.frss.el.feedRoot);
}

function getLayout() {
  return app.state.page.layout; // 'video' or 'article'
}

function setLayout(layout) {
  if (layout !== 'video' && layout !== 'article') return;
  app.state.page.layout = layout; // 'video' or 'article'
}

function isLayoutVideo() {
  return getLayout() === 'video';
}

function isLayoutArticle() {
  return getLayout() === 'article';
}

function isVideoLabelsEnabled() {
  // If user has enabled video labels setting, where "Favorites" becomes "Watch Later", and "My Labels" becomes "Playlists".
  return document.getElementById('yl_video_labels')?.getAttribute('data-yl-video-labels') === 'true';
}

function getToolbarStickyState() {
  return app.state.page.toolbarSticky;
}

function setToolbarStickyState(state) {
  app.state.page.toolbarSticky = state;
}

function getRelativeDate(date) {
  // Convert e.g. `2025-12-26T20:31:19+01:00` to a relative date string like "2 days ago".
  // NOTE: FreshRSS provides attr `datetime` in the DOM.

  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];
  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

function shouldUseScreencapThumbnail() {
  const setting = document.querySelector('#yl_feed_thumbnail_screencap_enabled');
  if (!setting) return false;
  const shouldUseScreencapThumbnail = setting.getAttribute('data-yl-feed-thumbnail-screencap-enabled');
  return shouldUseScreencapThumbnail === 'true';
}

/*****************************************
 * END "STATE UTILITIES"
 ****************************************/



/*****************************************
 * BEGIN "DATA UTILITIES"
 * For fetching and parsing remote or dynamic content.
 ****************************************/

async function fetchRelatedItems(category = 'watch_later', order = 'rand', limit = 10) {
  // Fetch related entries to show up e.g. in the Youlag "Related/random videos" section in the video modal.

  /**
   * HACK: This fetches the entire feed page, parses the HTML, and manually structures it into a JSON object.
   * This is a workaround due to having issues setting up a custom extension api endpoint.
   * By default, only 10 items are returned.
   */

  limit = Math.min(Math.max(limit, 1), 10);

  const getParamMap = {
    'subscriptions': '', // Home
    'watch_later': 'get=s',
    'playlists': 'get=T',
  };

  let getParam = getParamMap[category] || '';
  if (typeof category === 'string' && category.startsWith('f_')) {
    getParam = `get=${category}`;
  }

  try {
    const response = await fetch(`/i/?a=normal&${getParam}&sort=${order}`);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const stream = doc.querySelector(`${app.frss.el.feedRoot}`);

    if (!stream) {
      console.warn('Fetching related entries: #stream not found');
      return;
    }

    const items = Array.from(stream.querySelectorAll(app.frss.el.entry)).slice(0, limit);
    const mapped = items.map((item) => {
      const entryId = item.getAttribute('data-entry') || '';
      return {
        ...app.types.videoObject, // Sets default values for the other non-assigned properties in videoObject
        feedItem: item, // Original DOM element reference, utilized later by `extractFeedItemData()` when clicked.

        // The minimal data is used for displaying related videos.
        entryId,
        website_name: item.querySelector('.website .websiteName')?.textContent?.trim() || '',
        thumbnail: item.querySelector('.thumbnail img')?.src || '',
        title: item.querySelector('.title')?.textContent?.trim() || '',
        date: item.querySelector('.titleAuthorSummaryDate .date time')?.getAttribute('datetime') || '',
        external_link: item.querySelector('.titleAuthorSummaryDate a')?.href || '',
      };
    });
    const uniqueEntryIds = new Set();
    const videoObjects = mapped.filter(entry => {
      // Remove potential duplicates when using 'rand' order, and the feed has limited amount of entries.
      if (!entry.entryId || uniqueEntryIds.has(entry.entryId)) return false;
      uniqueEntryIds.add(entry.entryId);
      return true;
    });
    return videoObjects;
  } catch (e) {
    console.error('Fetching related entries error:', e);
  }
}

async function fetchManageFeedOptions(feedId, categoryId) {
  // DEPRECATED 2026-02-06: Replaced with `setupManageFeedButton()` under `renderToolbar()`.

  // Fetch feed management options HTML for the "Manage feed" modal.
  // Returns the HTML string for the modal form, or null on error.
  if (!feedId || !categoryId) return null;
  const url = '/i/?c=subscription&a=feed&id=' + encodeURIComponent(feedId) + '&get=' + encodeURIComponent(categoryId) + '&from=normal&ajax=1';
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const html = await response.text();
    return html;
  }
  catch (e) {
    console.error('Error fetching manage feed options:', e);
    return null;
  }
}

/*****************************************
 * END "DATA UTILITIES"
 ****************************************/
