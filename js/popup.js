// 公共认证检查函数 - 减少重复代码
// 在 Electron 环境中，我们通过 webview 加载站点并在其中完成登录，
// 因此无需在渲染层提前做跨域的会话检查。
const IS_ELECTRON = !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron);
const AuthCheckers = {
  // ChatGPT通用认证检查
  chatgptAuth: async (baseUrl = 'https://chatgpt.com') => {
    try {
      // Electron 环境下直接允许渲染，让用户在右侧 webview 内登录
      if (IS_ELECTRON) {
        return { state: 'authorized' };
      }
      const res = await fetch(`${baseUrl}/api/auth/session`);
      if (res.status === 403) {
        return {
          state: 'cloudflare',
          message: `Please login and pass Cloudflare at <a href="${baseUrl}" target="_blank" rel="noreferrer">${baseUrl}</a>`
        };
      }
      const data = await res.json();
      if (!res.ok || !data.accessToken) {
        return {
          state: 'unauthorized',
          message: `Please login at <a href="${baseUrl}" target="_blank" rel="noreferrer">${baseUrl}</a> first`
        };
      }
      return { state: 'authorized' };
    } catch (e) {
      console.error('ChatGPT session check failed:', e);
      return { state: 'error', message: 'Error checking session.' };
    }
  }
};

const PROVIDERS = {
  chatgpt: {
    label: 'ChatGPT',
    icon: 'images/providers/chatgpt.svg',
    baseUrl: 'https://chatgpt.com',
    iframeUrl: 'https://chatgpt.com/chat',
    authCheck: () => AuthCheckers.chatgptAuth()
  },
  codex: {
    label: 'ChatGPT Codex',
    icon: 'images/providers/codex.svg',
    baseUrl: 'https://chatgpt.com/codex',
    iframeUrl: 'https://chatgpt.com/codex',
    authCheck: () => AuthCheckers.chatgptAuth()
  },
  perplexity: {
    label: 'Perplexity',
    icon: 'images/providers/perplexity.png',
    baseUrl: 'https://www.perplexity.ai',
    iframeUrl: 'https://www.perplexity.ai/',
    authCheck: null
  },
  genspark: {
    label: 'Genspark',
    icon: 'images/providers/genspark.png',
    baseUrl: 'https://www.genspark.ai',
    iframeUrl: 'https://www.genspark.ai/agents?type=moa_chat',
    authCheck: null
  },
  tongyi: {
    label: '通义千问',
    icon: 'images/providers/tongyi.png',
    baseUrl: 'https://www.tongyi.com',
    iframeUrl: 'https://www.tongyi.com/',
    authCheck: null
  },
  doubao: {
    label: '豆包',
    icon: 'images/providers/doubao.png',
    baseUrl: 'https://www.doubao.com',
    iframeUrl: 'https://www.doubao.com/',
    authCheck: null
  },
  gemini: {
    label: 'Gemini',
    icon: 'images/providers/gemini.png',
    baseUrl: 'https://gemini.google.com',
    iframeUrl: 'https://gemini.google.com/app',
    authCheck: null // render directly; login handled by site
  },
  google: {
    label: 'Google',
    icon: 'images/providers/google.png',
    baseUrl: 'https://www.google.com',
    // User-requested AI/UDM search entry
    iframeUrl: 'https://www.google.com/search?udm=50&aep=46&source=25q2-US-SearchSites-Site-CTA',
    authCheck: null
  },
  aistudio: {
    label: 'AI Studio',
    icon: 'images/providers/google.png',
    baseUrl: 'https://aistudio.google.com',
    iframeUrl: 'https://aistudio.google.com/apps',
    authCheck: null
  },
  claude: {
    label: 'Claude',
    icon: 'images/providers/claude.png',
    baseUrl: 'https://claude.ai',
    iframeUrl: 'https://claude.ai',
    authCheck: null
  },
  deepseek: {
    label: 'DeepSeek',
    icon: 'images/providers/deepseek.png',
    baseUrl: 'https://chat.deepseek.com',
    iframeUrl: 'https://chat.deepseek.com/',
    authCheck: null
  },
  grok: {
    label: 'Grok',
    icon: 'images/providers/grok.png',
    baseUrl: 'https://grok.com',
    iframeUrl: 'https://grok.com/',
    authCheck: null
  },
  notebooklm: {
    label: 'NotebookLM',
    icon: 'images/providers/notebooklm.png',
    baseUrl: 'https://notebooklm.google.com',
    iframeUrl: 'https://notebooklm.google.com/',
    authCheck: null
  },
  ima: {
    label: 'IMA',
    icon: 'images/providers/ima.jpeg', // 使用新的熊猫图标
    baseUrl: 'https://ima.qq.com',
    iframeUrl: 'https://ima.qq.com/',
    authCheck: null
  },
  attention_local: {
    label: 'Attention (Local)',
    icon: 'images/时间管道.JPG',
    baseUrl: 'vendor/attention/index.html',
    iframeUrl: 'vendor/attention/index.html',
    authCheck: null
  },
  mubu: {
    label: '幕布',
    icon: 'images/providers/mubu.png',
    baseUrl: 'https://mubu.com',
    iframeUrl: 'https://mubu.com/app/edit/home/5zT4WuoDoc0',
    authCheck: null // 幕布通过网站处理登录
  },
  excalidraw: {
    label: 'Excalidraw',
    icon: 'images/providers/excalidraw.svg',
    baseUrl: 'https://excalidraw.com',
    iframeUrl: 'https://excalidraw.com/',
    authCheck: null // Excalidraw 无需登录
  }
};

// Debug logging helper (set to false to silence in production)
const DEBUG = true;
// 镜像模式：以插件 sync/*.json 为唯一真源，不向 sync 写回，不自动追加历史
const SYNC_MIRROR_FROM_PLUGIN = true;
try { window.AI_SYNC_WRITE_ENABLED = !SYNC_MIRROR_FROM_PLUGIN; } catch (_) {}
const dbg = (...args) => { try { if (DEBUG) console.log('[AISidebar]', ...args); } catch (_) {} };

// Custom provider helpers (for Add AI)
async function loadCustomProviders() {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(['customProviders'], (res) => {
        const arr = Array.isArray(res.customProviders) ? res.customProviders : [];
        resolve(arr);
      });
    } catch (_) { resolve([]); }
  });
}
async function saveCustomProviders(list) {
  try { chrome.storage?.local.set({ customProviders: list }); } catch (_) {}
}

// No built-in prompt overlay

// Overrides (per-provider), e.g., force useWebview true/false
const getOverrides = async () => {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(['aiProviderOverrides'], (res) => {
        resolve(res.aiProviderOverrides || {});
      });
    } catch (_) { resolve({}); }
  });
};
const setOverride = async (key, patch) => {
  try {
    const all = await getOverrides();
    const cur = all[key] || {};
    all[key] = { ...cur, ...patch };
    chrome.storage?.local.set({ aiProviderOverrides: all });
  } catch (_) {}
};
// Build effective provider config with overrides.
// 在 Electron 下默认使用 webview 以绕过站点的 X-Frame-Options / CSP 限制。
const effectiveConfig = (baseMap, key, overrides) => {
  const base = (baseMap && baseMap[key]) || PROVIDERS[key];
  const ovr = (overrides && overrides[key]) || {};
  const merged = { ...(base || {}), ...(ovr || {}) };
  if (IS_ELECTRON) merged.useWebview = true;
  return merged;
};
const clearOverride = async (key) => {
  try {
    const all = await getOverrides();
    if (all[key]) { delete all[key]; }
    chrome.storage?.local.set({ aiProviderOverrides: all });
  } catch (_) {}
};

const getProvider = async () => {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(['provider'], (res) => {
        resolve(res.provider || 'chatgpt');
      });
    } catch (_) {
      resolve('chatgpt');
    }
  });
};

const setProvider = async (key) => {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.set({ provider: key }, () => resolve());
    } catch (_) {
      resolve();
    }
  });
};

// Save and restore current URL for each provider
const saveProviderUrl = async (providerKey, url) => {
  try {
    const data = await chrome.storage?.local.get(['providerUrls']);
    const urls = data?.providerUrls || {};
    urls[providerKey] = url;
    await chrome.storage?.local.set({ providerUrls: urls });
  } catch (_) {}
};

const getProviderUrl = async (providerKey) => {
  try {
    const data = await chrome.storage?.local.get(['providerUrls']);
    return data?.providerUrls?.[providerKey] || null;
  } catch (_) {
    return null;
  }
};


const getProviderOrder = async () => {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(['providerOrder'], (res) => {
        const builtins = Object.keys(PROVIDERS);
        let order = Array.isArray(res.providerOrder) ? res.providerOrder.slice() : [];
        // append any new built-ins not in stored order
        builtins.forEach((k)=>{ if (!order.includes(k)) order.push(k); });
        resolve(order);
      });
    } catch (_) {
      resolve(Object.keys(PROVIDERS));
    }
  });
};

const saveProviderOrder = async (order) => {
  try { chrome.storage?.local.set({ providerOrder: order }); } catch (_) {}
};

// Star shortcut key management
const getStarShortcut = async () => {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(['starShortcut'], (res) => {
        resolve(res.starShortcut || { key: 'l', ctrl: true, shift: false, alt: false });
      });
    } catch (_) {
      resolve({ key: 'l', ctrl: true, shift: false, alt: false });
    }
  });
};

const setStarShortcut = async (shortcut) => {
  try {
    await chrome.storage?.local.set({ starShortcut: shortcut });
  } catch (_) {}
};

// Button shortcuts management
const defaultButtonShortcuts = {
  openInTab: { key: 'o', ctrl: true, shift: false, alt: false },
  searchBtn: { key: 'f', ctrl: true, shift: true, alt: false },
  historyBtn: { key: 'h', ctrl: true, shift: false, alt: false },
  favoritesBtn: { key: 'l', ctrl: true, shift: false, alt: false }
};

const getButtonShortcuts = async () => {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(['buttonShortcuts'], (res) => {
        resolve(res.buttonShortcuts || defaultButtonShortcuts);
      });
    } catch (_) {
      resolve(defaultButtonShortcuts);
    }
  });
};

const setButtonShortcuts = async (shortcuts) => {
  try {
    await chrome.storage?.local.set({ buttonShortcuts: shortcuts });
  } catch (_) {}
};

const matchesShortcut = (event, shortcut) => {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt
  );
};

// Cache embedded elements per provider to preserve state between switches
const cachedFrames = {};
// Cache simple meta for frames (e.g., expected origin)
const cachedFrameMeta = {}; // { [providerKey]: { origin: string } }
// Track the latest known URL and title inside each provider frame (from content script)
const currentUrlByProvider = {};   // { [providerKey]: string }
const currentTitleByProvider = {}; // { [providerKey]: string }

// ---- History store helpers ----
const HISTORY_KEY = 'aiLinkHistory';
const TITLE_MAX_LEN = 50;
// When set, renderHistoryPanel will start inline edit for this URL
let __pendingInlineEditUrl = null;
// When true, the inline edit that starts should close panel on Enter
let __pendingInlineEditCloseOnEnter = false;
// Persist history panel search across re-renders
let __historySearchQuery = '';

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function deriveTitle(provider, url, rawTitle) {
  try {
    const label = historyProviderLabel(provider) || '';
    const t = (rawTitle || '').trim();
    // Filter out generic or unhelpful titles
    const blacklist = ['recent','google gemini','gemini','conversation with gemini'];
    if (t && !blacklist.includes(t.toLowerCase())) {
      if (!label) return t;
      const containsLabel = t.toLowerCase().includes(label.toLowerCase());
      // Be more permissive so titles like "ChatGPT chat" are accepted
      const extraThreshold = (provider === 'chatgpt') ? 2 : 5;
      if (!containsLabel || t.length > label.length + extraThreshold) return t;
    }
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    let id = parts[parts.length - 1] || '';
    if (provider === 'chatgpt') {
      const idx = parts.indexOf('c');
      if (idx >= 0 && parts[idx + 1]) id = parts[idx + 1];
    } else if (provider === 'gemini') {
      const idx = parts.indexOf('app');
      if (idx >= 0 && parts[idx + 1]) id = parts[idx + 1];
    }
    const shortId = id ? id.slice(0, 8) : '';
    return [label || provider, shortId].filter(Boolean).join(' ');
  } catch (_) { return rawTitle || historyProviderLabel(provider) || provider || 'Conversation'; }
}
// clampTitle函数用于将传入的标题字符串s截断到最大长度max（默认是TITLE_MAX_LEN全局常量）以内，
// 如果字符串长度超过max，会在末尾加上省略号“…”；如果发生异常则返回原始输入。
function clampTitle(s, max = TITLE_MAX_LEN) {
  try {
    const str = String(s || '').trim();
    if (str.length <= max) return str;
    return str.slice(0, Math.max(0, max - 1)) + '…';
  } catch (_) { return s; }
}

// loadHistory是异步函数，用于加载历史会话数据（即AI聊天历史）。
// 优先从window.HistoryDB（IndexedDB实现，较新且推荐的历史存储方案）获取，如果存在HistoryDB，则先尝试迁移从chrome.storage.local的老数据，再直接从HistoryDB获取所有历史记录。
// 如果没有HistoryDB实现（比如还没升级数据），则降级回老的chrome.storage.local方式，读取HISTORY_KEY键对应的数据数组，不存在则返回空数组。
async function loadHistory() {
  try {
    if (window.HistoryDB) {
      await window.HistoryDB.migrateFromStorageIfAny();
      return await window.HistoryDB.getAll();
    }
  } catch (_) {}
  // Fallback to chrome.storage.local legacy (should be gone after migration)
  try {
    const res = await new Promise((r)=> chrome.storage?.local.get([HISTORY_KEY], (v)=> r(v||{})));
    const arr = Array.isArray(res[HISTORY_KEY]) ? res[HISTORY_KEY] : [];
    return arr;
  } catch (_) { return []; }
}
async function saveHistory(list) {
  try {
    if (window.HistoryDB) {
      await window.HistoryDB.replace(Array.isArray(list) ? list : []);
      return;
    }
  } catch (_) {}
  try { await chrome.storage?.local.set({ [HISTORY_KEY]: list }); } catch (_) {}
}
async function addHistory(entry) {
  try {
    if (window.HistoryDB) {
      const suggested = typeof entry.title === 'string' ? entry.title : '';
      const title = clampTitle(entry && entry.needsTitle ? suggested : deriveTitle(entry.provider, entry.url, suggested));
      await window.HistoryDB.add({ ...entry, title, time: Date.now() });
      return await window.HistoryDB.getAll();
    }
  } catch (_) {}
  // Legacy fallback
  try {
    const list = await loadHistory();
    const filtered = list.filter((x)=> x && x.url !== entry.url);
    const suggested = typeof entry.title === 'string' ? entry.title : '';
    const title = clampTitle(entry && entry.needsTitle ? suggested : deriveTitle(entry.provider, entry.url, suggested));
    const next = [{...entry, title, time: Date.now()}].concat(filtered).slice(0, 500);
    await saveHistory(next);
    return next;
  } catch (_) { return null; }
}
function isDeepLink(providerKey, href) {
  try {
    if (!href) return false;
    const u = new URL(href);
    if (providerKey === 'chatgpt') {
      // ChatGPT deep links: /c/<id> (primary), sometimes include conversationId in query
      if (/\/c\/[a-z0-9-]+/i.test(u.pathname)) return true;
      if (u.searchParams && u.searchParams.get('conversationId')) return true;
      return false;
    }
    if (providerKey === 'gemini') return /\/app\//.test(u.pathname) && u.pathname !== '/app';
    if (providerKey === 'perplexity') return /\/search\//.test(u.pathname);
    if (providerKey === 'deepseek') return /(\/sessions\/|\/s\/|\/chat)/.test(u.pathname);
    if (providerKey === 'notebooklm') {
      // NotebookLM uses a variety of routes; treat any non-root path as a deep link
      return (u.pathname && u.pathname !== '/' && u.pathname !== '/u/0' && u.pathname !== '/u/1');
    }
    if (providerKey === 'google') {
      // Consider Google deep link when search query present
      return (u.hostname === 'www.google.com' && u.pathname === '/search' && !!u.searchParams.get('q'));
    }
  } catch (_) {}
  return false;
}
function historyProviderLabel(key) {
  const m = PROVIDERS[key];
  return (m && m.label) || key;
}
function normalizeUrlAttr(s) {
  if (!s) return s;
  // Decode common HTML entity for '&' to match stored URL
  return s.replace(/&amp;/g, '&');
}

// Normalize URL for robust equality checks (align with HistoryDB.removeByUrl)
function normalizeUrlForMatch(uStr) {
  try {
    const u = new URL(String(uStr));
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    if (u.search && u.search.length > 1) {
      const sp = new URLSearchParams(u.search);
      const sorted = new URLSearchParams();
      Array.from(sp.keys()).sort().forEach(k => {
        const vals = sp.getAll(k);
        vals.sort().forEach(v => sorted.append(k, v));
      });
      u.search = sorted.toString() ? `?${sorted.toString()}` : '';
    }
    if (u.pathname === '/') u.pathname = '';
    return u.toString();
  } catch (_) {
    return String(uStr || '');
  }
}
async function renderHistoryPanel() {
  try {
    const panel = document.getElementById('historyPanel');
    if (!panel) return;
    const list = await loadHistory();
    const favList = await loadFavorites();
    const favSet = new Set((favList||[]).map(x=> normalizeUrlForMatch(x.url)));
    const rows = (list || []).map((it)=>{
      const date = new Date(it.time||Date.now());
      const ds = date.toLocaleString();
      // Always show an informative title. If storage carries needsTitle with empty title,
      // fall back to a derived title so the row never appears blank.
      const titleToShow = clampTitle((it && it.title && it.title.trim())
        ? it.title
        : (deriveTitle(it.provider, it.url, '') || ''));
      const escTitle = titleToShow.replace(/[<>]/g,'');
      const isStarred = favSet.has(normalizeUrlForMatch(it.url));
      const starClass = isStarred ? 'hp-star active' : 'hp-star';
      const starTitle = isStarred ? 'Unstar' : 'Star';
      return `<div class="hp-item" data-url="${escapeAttr(it.url)}">
        <span class="hp-provider">${historyProviderLabel(it.provider||'')}</span>
        <span class="hp-title" data-url="${escapeAttr(it.url)}" title="${escTitle}">${escTitle}</span>
        <span class="hp-time">${ds}</span>
        <span class="hp-actions">
          <button class="hp-open" data-url="${escapeAttr(it.url)}" data-provider="${it.provider||''}">Open</button>
          <button class="hp-copy" data-url="${escapeAttr(it.url)}">Copy</button>
          <button class="hp-rename" data-url="${escapeAttr(it.url)}">Rename</button>
          <button class="${starClass}" data-url="${escapeAttr(it.url)}" title="${starTitle}">★</button>
        </span>
      </div>`;
    }).join('');
    panel.innerHTML = `<div class=\"hp-header\">\n      <span>History</span>\n      <span class=\"hp-actions\">\n        <button id=\"hp-add-current\">Add Current</button>\n        <button id=\"hp-clear-all\">Clear</button>\n        <button id=\"hp-close\">Close</button>\n      </span>\n    </div>\n    <div class=\"hp-search-row\">\n      <span class=\"hp-search-icon\">🔍</span>\n      <input id=\"hp-search-input\" class=\"hp-search-input\" type=\"text\" placeholder=\"搜索\" />\n    </div>\n    <div class=\"hp-list\">${rows || ''}</div>`;
    // events
    panel.querySelector('#hp-close')?.addEventListener('click', ()=> { try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}; panel.style.display='none'; });
    panel.querySelector('#hp-clear-all')?.addEventListener('click', async ()=>{ await saveHistory([]); renderHistoryPanel(); });
    panel.querySelector('#hp-add-current')?.addEventListener('click', async ()=>{
      try {
        const a = document.getElementById('openInTab');
        const href = a && a.href;
        const provider = (await getProvider())||'chatgpt';
        if (href) {
          __pendingInlineEditUrl = href;
          __pendingInlineEditCloseOnEnter = true;
          const suggested = (currentTitleByProvider[provider] || document.title || '').trim();
          await addHistory({ url: href, provider, title: suggested, needsTitle: true });
          renderHistoryPanel();
        }
      } catch (_) {}
    });
    panel.querySelectorAll('.hp-open')?.forEach((btn)=>{
      btn.addEventListener('click', async (e)=>{
        try {
          const raw = e.currentTarget.getAttribute('data-url');
          const url = normalizeUrlAttr(raw);
          const providerKey = e.currentTarget.getAttribute('data-provider');
          if (!url) return;
          // 确保恢复 BrowserView，再进行跳转
          try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
          
          // Load the URL in the sidebar
          const container = document.getElementById('iframe');
          const overrides = await getOverrides();
          const customProviders = await loadCustomProviders();
          const ALL = { ...PROVIDERS };
          (customProviders || []).forEach((c) => { ALL[c.key] = c; });
          
          // Switch to the provider if specified, otherwise stay on current
          if (providerKey && ALL[providerKey]) {
            await setProvider(providerKey);
            const p = effectiveConfig(ALL, providerKey, overrides);
            
            // Update the Open in Tab button
            const openInTab = document.getElementById('openInTab');
            if (openInTab) {
              openInTab.dataset.url = url;
              try { openInTab.title = url; } catch (_) {}
            }
            
            // Load the frame
            if (p.authCheck) {
              const auth = await p.authCheck();
              if (auth.state === 'authorized') {
                await ensureFrame(container, providerKey, p);
              } else {
                renderMessage(container, auth.message || 'Please login.');
              }
            } else {
              await ensureFrame(container, providerKey, p);
            }
            
            // Navigate the frame to the URL
            const frame = cachedFrames[providerKey];
            if (frame && frame.contentWindow) {
              try {
                frame.contentWindow.location.href = url;
              } catch (err) {
                // Fallback: reload frame with new URL
                frame.src = url;
              }
            }
            
            // Update UI
            renderProviderTabs(providerKey);
            // Update Star button state for the newly opened URL
            await updateStarButtonState();
          }
          
          // Close the history panel（并保证退出覆盖模式）
          try { document.getElementById('historyBackdrop')?.remove(); } catch (_) {}
          panel.style.display = 'none';
        } catch (err) {
          console.error('Error opening history item in sidebar:', err);
        }
      });
    });
    panel.querySelectorAll('.hp-copy')?.forEach((btn)=>{
      btn.addEventListener('click', async (e)=>{
        try {
          const raw = e.currentTarget.getAttribute('data-url');
          const url = normalizeUrlAttr(raw);
          await navigator.clipboard.writeText(url);
        } catch (_) {}
      });
    });
    // Remove action removed by request; Clear-all remains available
    // Star/unstar from history list - only toggle star, don't open Favorites panel
    panel.querySelectorAll('.hp-star')?.forEach((btn)=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation(); // Prevent event bubbling
        const url = e.currentTarget.getAttribute('data-url');
        const isActive = e.currentTarget.classList.contains('active');
        const provider = (await getProvider())||'chatgpt';
        const normalizedUrl = normalizeUrlForMatch(url);
        if (isActive) {
          // Unstar
          const favs = await loadFavorites();
          await saveFavorites(favs.filter((x)=> normalizeUrlForMatch(x.url) !== normalizedUrl));
        } else {
          // Star - no inline edit, just add to favorites silently
          const suggested = (currentTitleByProvider[provider] || document.title || '').trim();
          await addFavorite({ url, provider, title: suggested, needsTitle: false });
        }
        // Update history panel to show new star state
        renderHistoryPanel();
        // Update the Star button in toolbar if this URL is currently displayed
        try {
          const openInTab = document.getElementById('openInTab');
          const currentUrl = openInTab && openInTab.dataset.url;
          if (currentUrl && normalizeUrlForMatch(currentUrl) === normalizedUrl) {
            await updateStarButtonState();
          }
        } catch (_) {}
      });
    });
    const beginInlineEdit = (titleEl, options) => {
      try {
        const row = titleEl.closest('.hp-item');
        const url = normalizeUrlAttr(row?.getAttribute('data-url'));
        const orig = titleEl.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = orig;
        input.className = 'hp-title-input';
        titleEl.replaceWith(input);
        input.focus(); input.select();
        const closeOnEnter = !!(options && options.closeOnEnter);
        const finish = async (save, how) => {
          try {
            const newTitle = save ? (input.value || '').trim() : orig;
            const list = await loadHistory();
            const idx = list.findIndex((x)=> x.url === url);
            if (idx >= 0 && save && newTitle) {
              // Clear needsTitle once a custom title is saved and clamp length
              list[idx] = { ...list[idx], title: clampTitle(newTitle), needsTitle: false };
              await saveHistory(list);
            }
          } catch (_) {}
          renderHistoryPanel();
          // If this inline edit was initiated by Add Current and Enter was pressed, close panel
          try {
            if (how === 'enter' && closeOnEnter) {
              if (typeof window.hideHistoryPanel === 'function') {
                window.hideHistoryPanel();
              } else {
                const p = document.getElementById('historyPanel');
                if (p) p.style.display = 'none';
                try { document.getElementById('historyBackdrop')?.remove(); } catch (_) {}
              }
            }
          } catch (_) {}
        };
        input.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter') finish(true, 'enter');
          if (e.key === 'Escape') finish(false, 'escape');
        });
        input.addEventListener('blur', ()=> finish(true, 'blur'));
      } catch (_) {}
    };
    panel.querySelectorAll('.hp-title')?.forEach((el)=>{
      el.addEventListener('click', ()=> beginInlineEdit(el));
    });
    panel.querySelectorAll('.hp-rename')?.forEach((btn)=>{
      btn.addEventListener('click', (e)=>{
        const row = e.currentTarget.closest('.hp-item');
        const titleEl = row?.querySelector('.hp-title');
        if (titleEl) beginInlineEdit(titleEl);
      });
    });

    // --- Search controls (always visible below header) ---
    try {
      const searchInput = panel.querySelector('#hp-search-input');
      const filterRows = (qRaw) => {
        const q = (qRaw || '').toLowerCase();
        __historySearchQuery = qRaw || '';
        let matchCount = 0;
        panel.querySelectorAll('.hp-item')?.forEach((row)=>{
          const title = (row.querySelector('.hp-title')?.textContent || '').toLowerCase();
          const url = (row.getAttribute('data-url') || '').toLowerCase();
          const provider = (row.querySelector('.hp-provider')?.textContent || '').toLowerCase();
          const ok = !q || title.includes(q) || url.includes(q) || provider.includes(q);
          row.style.display = ok ? 'flex' : 'none';
          if (ok) matchCount++;
        });
        const emptyId = 'hp-search-empty';
        let empty = panel.querySelector('#'+emptyId);
        if (matchCount === 0 && (panel.querySelectorAll('.hp-item').length > 0)) {
          if (!empty) {
            empty = document.createElement('div');
            empty.id = emptyId;
            empty.style.padding = '8px 12px';
            empty.style.color = '#64748b';
            empty.textContent = 'No matches';
            panel.querySelector('.hp-list')?.appendChild(empty);
          }
        } else if (empty && matchCount > 0) {
          empty.remove();
        }
      };
      if (searchInput) {
        searchInput.value = __historySearchQuery;
        let __searchDebounce = null;
        searchInput.addEventListener('input', (e)=>{
          const v = e.currentTarget.value;
          if (__searchDebounce) clearTimeout(__searchDebounce);
          __searchDebounce = setTimeout(()=> filterRows(v), 80);
        });
        // If we are about to start an inline rename (after clicking Add Current),
        // do NOT steal focus to the search box. Keep focus on the rename input.
        if (!__pendingInlineEditUrl) {
          setTimeout(()=>{ try { searchInput.focus(); searchInput.select(); } catch(_){} }, 0);
        }
        filterRows(__historySearchQuery);
      }
    } catch (_) {}

    // If we have a pending inline edit request (from toolbar Add), start it now
    if (__pendingInlineEditUrl) {
      try {
        const row = panel.querySelector(`.hp-item[data-url="${CSS.escape(__pendingInlineEditUrl)}"]`);
        const titleEl = row?.querySelector('.hp-title');
        if (titleEl) beginInlineEdit(titleEl, { closeOnEnter: !!__pendingInlineEditCloseOnEnter });
      } catch (_) { /* no-op */ }
      __pendingInlineEditUrl = null;
      __pendingInlineEditCloseOnEnter = false;
    }
  } catch (_) {}
}

// ---- Favorites store helpers ----
const FAVORITES_KEY = 'aiFavoriteLinks';
let __pendingFavInlineEditUrl = null;
let __pendingFavCloseOnEnter = false;
let __favSearchQuery = '';

// 获取当前展示 URL（Electron BrowserView 优先）
async function getCurrentDisplayedUrl() {
  try {
    if (IS_ELECTRON && window.electronAPI?.getCurrentUrl) {
      const url = await window.electronAPI.getCurrentUrl();
      if (url) return url;
    }
  } catch (_) {}
  try {
    const openInTab = document.getElementById('openInTab');
    if (openInTab && openInTab.dataset && openInTab.dataset.url) return openInTab.dataset.url;
  } catch (_) {}
  try {
    const iframeContainer = document.getElementById('iframe');
    const activeFrame = iframeContainer?.querySelector('[data-provider]:not([style*="display: none"])');
    if (activeFrame && activeFrame.src) return activeFrame.src;
  } catch (_) {}
  try {
    const key = await getProvider();
    if (key && currentUrlByProvider && currentUrlByProvider[key]) return currentUrlByProvider[key];
  } catch (_) {}
  return '';
}

// Update star button state based on current URL
async function updateStarButtonState() {
  try {
    const starBtn = document.getElementById('starBtn');
    if (!starBtn) return;
    const currentUrl = await getCurrentDisplayedUrl();
    if (!currentUrl) {
      starBtn.textContent = '☆';
      starBtn.classList.remove('starred');
      return;
    }
    const normalizedCurrent = normalizeUrlForMatch(currentUrl);
    const favList = await loadFavorites();
    const isStarred = (favList || []).some(fav => normalizeUrlForMatch(fav.url) === normalizedCurrent);
    if (isStarred) {
      starBtn.textContent = '★';
      starBtn.classList.add('starred');
    } else {
      starBtn.textContent = '☆';
      starBtn.classList.remove('starred');
    }
  } catch (_) {}
}

// Deprecated: kept for backwards compatibility, but Favorites button no longer shows star
async function updateStarredButtonState() {
  await updateStarButtonState();
}
async function loadFavorites() {
  try {
    const res = await new Promise((r)=> chrome.storage?.local.get([FAVORITES_KEY], (v)=> r(v||{})));
    const arr = Array.isArray(res[FAVORITES_KEY]) ? res[FAVORITES_KEY] : [];
    return arr;
  } catch (_) { return []; }
}
async function saveFavorites(list) {
  try { await chrome.storage?.local.set({ [FAVORITES_KEY]: list }); } catch (_) {}
  try {
    if (!SYNC_MIRROR_FROM_PLUGIN && IS_ELECTRON && window.electronAPI?.sync?.write) {
      window.electronAPI.sync.write('favorites', list || []);
    }
  } catch (_) {}
}

async function saveFavoritesLocalOnly(list) {
  try { await chrome.storage?.local.set({ [FAVORITES_KEY]: list || [] }); } catch (_) {}
}
async function addFavorite(entry) {
  try {
    const list = await loadFavorites();
    const filtered = list.filter((x)=> x && x.url !== entry.url);
    const suggested = typeof entry.title === 'string' ? entry.title : '';
    const title = clampTitle(entry && entry.needsTitle
      ? suggested
      : deriveTitle(entry.provider, entry.url, suggested));
    const next = [{...entry, title, time: Date.now()}].concat(filtered).slice(0, 500);
    await saveFavorites(next);
    return next;
  } catch (_) { return null; }
}

async function renderFavoritesPanel() {
  try {
    const panel = document.getElementById('favoritesPanel');
    if (!panel) return;
    const list = await loadFavorites();
    const rows = (list || []).map((it)=>{
      const date = new Date(it.time||Date.now());
      const ds = date.toLocaleString();
      const titleToShow = clampTitle((it && it.title && it.title.trim())
        ? it.title
        : (deriveTitle(it.provider, it.url, '') || ''));
      const escTitle = titleToShow.replace(/[<>]/g,'');
      return `<div class="fp-item" data-url="${it.url}">
        <span class="fp-provider">${historyProviderLabel(it.provider||'')}</span>
        <span class="fp-title" data-url="${it.url}" title="${escTitle}">${escTitle}</span>
        <span class="fp-time">${ds}</span>
        <span class="fp-actions-row">
          <button class="fp-open" data-url="${it.url}" data-provider="${it.provider||''}">Open</button>
          <button class="fp-copy" data-url="${it.url}">Copy</button>
          <button class="fp-rename" data-url="${it.url}">Rename</button>
          <button class="fp-remove" data-url="${it.url}">Remove</button>
        </span>
      </div>`;
    }).join('');
    panel.innerHTML = `<div class=\"fp-header\">\n      <span>Favorites</span>\n      <span class=\"fp-actions\">\n        <button id=\"fp-add-current\">Add Current</button>\n        <button id=\"fp-clear-all\">Clear</button>\n        <button id=\"fp-close\">Close</button>\n      </span>\n    </div>\n    <div class=\"fp-search-row\">\n      <span class=\"fp-search-icon\">🔍</span>\n      <input id=\"fp-search-input\" class=\"fp-search-input\" type=\"text\" placeholder=\"搜索\" />\n    </div>\n    <div class=\"fp-list\">${rows || ''}</div>`;

    panel.querySelector('#fp-close')?.addEventListener('click', ()=> { try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}; panel.style.display='none'; });
    panel.querySelector('#fp-clear-all')?.addEventListener('click', async ()=>{ await saveFavorites([]); renderFavoritesPanel(); });
    
    panel.querySelector('#fp-add-current')?.addEventListener('click', async ()=>{
      try {
        const href = await getCurrentDisplayedUrl();
        const provider = (await getProvider())||'chatgpt';
        if (href) {
          __pendingFavInlineEditUrl = href;
          __pendingFavCloseOnEnter = true;
          const suggested = (currentTitleByProvider[provider] || document.title || '').trim();
          await addFavorite({ url: href, provider, title: suggested, needsTitle: true });
          renderFavoritesPanel();
        }
      } catch (_) {}
    });
    panel.querySelectorAll('.fp-open')?.forEach((btn)=>{
      btn.addEventListener('click', async (e)=>{
        try {
          const url = e.currentTarget.getAttribute('data-url');
          const providerKey = e.currentTarget.getAttribute('data-provider');
          if (!url) return;
          // 确保恢复 BrowserView，再进行跳转
          try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
          
          // Load the URL in the sidebar
          const container = document.getElementById('iframe');
          const overrides = await getOverrides();
          const customProviders = await loadCustomProviders();
          const ALL = { ...PROVIDERS };
          (customProviders || []).forEach((c) => { ALL[c.key] = c; });
          
          // Switch to the provider if specified, otherwise stay on current
          if (providerKey && ALL[providerKey]) {
            await setProvider(providerKey);
            const p = effectiveConfig(ALL, providerKey, overrides);
            
            // Update the Open in Tab button
            const openInTab = document.getElementById('openInTab');
            if (openInTab) {
              openInTab.dataset.url = url;
              try { openInTab.title = url; } catch (_) {}
            }
            
            // Load the frame
            if (p.authCheck) {
              const auth = await p.authCheck();
              if (auth.state === 'authorized') {
                await ensureFrame(container, providerKey, p);
              } else {
                renderMessage(container, auth.message || 'Please login.');
              }
            } else {
              await ensureFrame(container, providerKey, p);
            }
            
            // Navigate the frame to the URL
            const frame = cachedFrames[providerKey];
            if (frame && frame.contentWindow) {
              try {
                frame.contentWindow.location.href = url;
              } catch (err) {
                // Fallback: reload frame with new URL
                frame.src = url;
              }
            }
            
            // Update UI
            renderProviderTabs(providerKey);
            // Update Star button state for the newly opened URL
            await updateStarButtonState();
          }
          
          // Close the favorites panel（并保证退出覆盖模式）
          try { document.getElementById('favoritesBackdrop')?.remove(); } catch (_) {}
          panel.style.display = 'none';
        } catch (err) {
          console.error('Error opening favorite in sidebar:', err);
        }
      });
    });
    panel.querySelectorAll('.fp-copy')?.forEach((btn)=>{
      btn.addEventListener('click', async (e)=>{
        try { await navigator.clipboard.writeText(e.currentTarget.getAttribute('data-url')); } catch (_) {}
      });
    });
    panel.querySelectorAll('.fp-remove')?.forEach((btn)=>{
      btn.addEventListener('click', async (e)=>{
        const url = e.currentTarget.getAttribute('data-url');
        const list = await loadFavorites();
        await saveFavorites(list.filter((x)=> x.url !== url));
        renderFavoritesPanel();
      });
    });
    const beginInlineEdit = (titleEl, options) => {
      try {
        const row = titleEl.closest('.fp-item');
        const url = row?.getAttribute('data-url');
        const orig = titleEl.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = orig;
        input.className = 'fp-title-input';
        titleEl.replaceWith(input);
        input.focus(); input.select();
        const closeOnEnter = !!(options && options.closeOnEnter);
        const finish = async (save, how) => {
          try {
            const newTitle = save ? (input.value || '').trim() : orig;
            const list = await loadFavorites();
            const idx = list.findIndex((x)=> x.url === url);
            if (idx >= 0 && save && newTitle) {
              list[idx] = { ...list[idx], title: clampTitle(newTitle) };
              await saveFavorites(list);
            }
          } catch (_) {}
          renderFavoritesPanel();
          try {
            if (how === 'enter' && closeOnEnter) {
              const p = document.getElementById('favoritesPanel');
              if (p) p.style.display = 'none';
              try { document.getElementById('favoritesBackdrop')?.remove(); } catch (_) {}
            }
          } catch (_) {}
        };
        input.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter') finish(true, 'enter');
          if (e.key === 'Escape') finish(false, 'escape');
        });
        input.addEventListener('blur', ()=> finish(true, 'blur'));
      } catch (_) {}
    };
    panel.querySelectorAll('.fp-title')?.forEach((el)=>{
      el.addEventListener('click', ()=> beginInlineEdit(el));
    });
    panel.querySelectorAll('.fp-rename')?.forEach((btn)=>{
      btn.addEventListener('click', (e)=>{
        const row = e.currentTarget.closest('.fp-item');
        const titleEl = row?.querySelector('.fp-title');
        if (titleEl) beginInlineEdit(titleEl);
      });
    });

    // Search
    try {
      const searchInput = panel.querySelector('#fp-search-input');
      const filterRows = (qRaw) => {
        const q = (qRaw || '').toLowerCase();
        __favSearchQuery = qRaw || '';
        let matchCount = 0;
        panel.querySelectorAll('.fp-item')?.forEach((row)=>{
          const title = (row.querySelector('.fp-title')?.textContent || '').toLowerCase();
          const url = (row.getAttribute('data-url') || '').toLowerCase();
          const provider = (row.querySelector('.fp-provider')?.textContent || '').toLowerCase();
          const ok = !q || title.includes(q) || url.includes(q) || provider.includes(q);
          row.style.display = ok ? 'flex' : 'none';
          if (ok) matchCount++;
        });
        const emptyId = 'fp-search-empty';
        let empty = panel.querySelector('#'+emptyId);
        if (matchCount === 0 && (panel.querySelectorAll('.fp-item').length > 0)) {
          if (!empty) {
            empty = document.createElement('div');
            empty.id = emptyId;
            empty.style.padding = '8px 12px';
            empty.style.color = '#64748b';
            empty.textContent = 'No matches';
            panel.querySelector('.fp-list')?.appendChild(empty);
          }
        } else if (empty && matchCount > 0) {
          empty.remove();
        }
      };
      if (searchInput) {
        searchInput.value = __favSearchQuery;
        let __searchDebounce = null;
        searchInput.addEventListener('input', (e)=>{
          const v = e.currentTarget.value;
          if (__searchDebounce) clearTimeout(__searchDebounce);
          __searchDebounce = setTimeout(()=> filterRows(v), 80);
        });
        if (!__pendingFavInlineEditUrl) {
          setTimeout(()=>{ try { searchInput.focus(); searchInput.select(); } catch(_){} }, 0);
        }
        filterRows(__favSearchQuery);
      }
    } catch (_) {}

    if (__pendingFavInlineEditUrl) {
      try {
        const row = panel.querySelector(`.fp-item[data-url="${CSS.escape(__pendingFavInlineEditUrl)}"]`);
        const titleEl = row?.querySelector('.fp-title');
        if (titleEl) beginInlineEdit(titleEl, { closeOnEnter: !!__pendingFavCloseOnEnter });
      } catch (_) {}
      __pendingFavInlineEditUrl = null;
      __pendingFavCloseOnEnter = false;
    }
  } catch (_) {}
}

const showOnlyFrame = (container, key) => {
  const nodes = container.querySelectorAll('[data-provider]');
  nodes.forEach((el) => {
    el.style.display = el.dataset.provider === key ? 'block' : 'none';
  });
};


let __suppressNextFrameFocus = false; // when true, do not focus iframe/webview on switch (e.g., Tab cycling)

const ensureFrame = async (container, key, provider) => {
  // 在 Electron BrowserView 模式下，我们不需要创建 iframe/webview
  // 而是通过 IPC 通知主进程切换 BrowserView
  if (IS_ELECTRON) {
    dbg('ensureFrame (Electron BrowserView mode):', key);
    
    // 通知主进程切换到这个 provider
    if (window.electronAPI && window.electronAPI.switchProvider) {
      const targetUrl = provider.baseUrl || provider.iframeUrl || '';
      window.electronAPI.switchProvider({ key, url: targetUrl });
    }
    
    // 更新 Open in Tab 按钮
    try {
      const openInTab = document.getElementById('openInTab');
      if (openInTab) {
        // 从主进程获取当前 URL
        if (window.electronAPI && window.electronAPI.getCurrentUrl) {
          window.electronAPI.getCurrentUrl().then(url => {
            if (url) {
              openInTab.dataset.url = url;
              openInTab.title = url;
            } else {
              openInTab.dataset.url = provider.baseUrl || provider.iframeUrl;
              openInTab.title = provider.baseUrl || provider.iframeUrl;
            }
          });
        } else {
          openInTab.dataset.url = provider.baseUrl || provider.iframeUrl;
          openInTab.title = provider.baseUrl || provider.iframeUrl;
        }
      }
    } catch (_) {}
    
    // 隐藏消息覆盖层
    const msg = document.getElementById('provider-msg');
    if (msg) msg.style.display = 'none';
    
    return;
  }
  
  // 原有的 iframe/webview 逻辑（非 Electron 环境）
  if (!cachedFrames[key]) {
    const useWebview = !!provider.useWebview;
    const tag = useWebview ? 'webview' : 'iframe';
    const view = document.createElement(tag);
    view.setAttribute('data-provider', key);
    view.id = 'ai-frame-' + key;
    view.tabIndex = 0;
    if (tag === 'iframe') {
      view.scrolling = 'auto';
      view.frameBorder = '0';
      // Allow typical login flows (popups, redirects, storage access)
      view.allow = [
        'fullscreen',
        'clipboard-read',
        'clipboard-write',
        'geolocation',
        'camera',
        'microphone',
        'display-capture'
      ].join('; ');
    } else {
      // webview specific attributes
      // persist partition so login state survives reloads
      view.setAttribute('partition', 'persist:ai-panel');
      view.setAttribute('allowpopups', '');
      // Minimal newwindow handling: open in a normal tab (more stable across Chrome versions)
      view.addEventListener('newwindow', (e) => {
        try {
          const url = e.targetUrl || provider.baseUrl;
          window.open(url, '_blank');
          if (e.preventDefault) e.preventDefault();
        } catch (_) {}
      });
      // If a site still blocks embedding, surface a friendly message
      view.addEventListener('loadabort', (e) => {
        try {
          const reason = e.reason || 'blocked';
          const msg = 'This site refused to load in the panel (' + reason + '). ' +
                      'Click Open in Tab to use it directly.';
          const container = document.getElementById('iframe');
          renderMessage(container, msg);
        } catch (_) {}
      });
    }
    // Try to restore last visited URL for this provider
    const savedUrl = await getProviderUrl(key);
    let urlToLoad = provider.iframeUrl;
    if (savedUrl) {
      urlToLoad = savedUrl;
      dbg('ensureFrame:', key, 'restored URL:', savedUrl);
    }
    view.src = urlToLoad;
    dbg('ensureFrame:', key, 'final URL:', urlToLoad);
    view.style.width = '100%';
    view.style.height = '100%';
    container.appendChild(view);
    cachedFrames[key] = view;
    // Update Open in Tab immediately to at least the initial URL
    try {
      const openInTab = document.getElementById('openInTab');
      if (openInTab && typeof view.src === 'string') {
        openInTab.dataset.url = view.src;
      }
    } catch (_) {}
    // Record expected origin for this provider (for message validation)
    try {
      const origin = new URL(provider.baseUrl || provider.iframeUrl).origin;
      cachedFrameMeta[key] = { origin };
      // Initialize with initial URL as a fallback until content script reports
      currentUrlByProvider[key] = provider.iframeUrl || provider.baseUrl || '';
    } catch (_) {
      cachedFrameMeta[key] = { origin: '' };
    }
    if (!__suppressNextFrameFocus) {
      const focusHandler = () => { try { view.focus(); } catch(_) {} };
      if (tag === 'iframe') {
        view.addEventListener('load', focusHandler);
      } else {
        view.addEventListener('contentload', focusHandler);
      }
    }
  }
  // hide message overlay if any
  const msg = document.getElementById('provider-msg');
  if (msg) msg.style.display = 'none';
  showOnlyFrame(container, key);
  if (!__suppressNextFrameFocus) {
    try { cachedFrames[key].focus(); } catch(_) {}
  }
};

const renderMessage = (container, message) => {
  let msg = document.getElementById('provider-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'provider-msg';
    msg.className = 'extension-body';
    container.appendChild(msg);
  }
  msg.innerHTML = '<div class="notice"><div>' + message + '</div></div>';
  msg.style.display = 'flex';
  // hide all frames but keep them mounted
  const nodes = container.querySelectorAll('[data-provider]');
  nodes.forEach((el) => { el.style.display = 'none'; });
};

// 当前拖拽中的 provider key
let __dragKey = null;

const getTabsCollapsed = async () => {
  try {
    const { tabsCollapsed } = await chrome.storage?.local.get(['tabsCollapsed']);
    return !!tabsCollapsed;
  } catch (_) {
    return false;
  }
};
const setTabsCollapsed = async (v) => {
  try { await chrome.storage?.local.set({ tabsCollapsed: !!v }); } catch (_) {}
};

// 渲染底部导航栏（左侧垂直栏）
const renderProviderTabs = async (currentProviderKey) => {
  const tabsContainer = document.getElementById('provider-tabs');
  if (!tabsContainer) return;

  const overrides = await getOverrides();
  tabsContainer.innerHTML = '';

  // 折叠状态与头部
  const collapsed = await getTabsCollapsed();
  tabsContainer.classList.toggle('collapsed', collapsed);
  const header = document.createElement('div');
  header.className = 'tabs-header';
  const toggle = document.createElement('button');
  toggle.className = 'tabs-toggle';
  toggle.title = collapsed ? '展开' : '收起';
  toggle.textContent = collapsed ? '›' : '≡';
  toggle.addEventListener('click', async (e) => {
    e.stopPropagation();
    const nv = !tabsContainer.classList.contains('collapsed');
    tabsContainer.classList.toggle('collapsed', nv);
    await setTabsCollapsed(nv);
    // 不需要重建按钮，但为保持一致刷新头部图标
    renderProviderTabs(currentProviderKey);
  });
  header.appendChild(toggle);
  tabsContainer.appendChild(header);

  // 获取所有提供商的顺序
  let providerOrder = await chrome.storage.local.get('providerOrder').then(r => r.providerOrder || Object.keys(PROVIDERS));
  
  // 确保所有内置提供商都在顺序中
  const allProviderKeys = Object.keys(PROVIDERS);
  allProviderKeys.forEach(key => {
    if (!providerOrder.includes(key)) {
      providerOrder.push(key);
    }
  });
  
  // 加载自定义提供商
  const customProviders = await loadCustomProviders();
  const ALL = { ...PROVIDERS };
  customProviders.forEach((c) => { 
    ALL[c.key] = c; 
    if (!providerOrder.includes(c.key)) providerOrder.push(c.key); 
  });

  // --- DnD 辅助函数 ---
  const clearInsertClasses = () => {
    tabsContainer.querySelectorAll('button.insert-before, button.insert-after')
      .forEach((b)=>{ b.classList.remove('insert-before','insert-after'); });
  };
  const moveKeyToIndex = async (arr, key, idx) => {
    const cur = arr.slice();
    const from = cur.indexOf(key);
    if (from === -1) return arr;
    cur.splice(from, 1);
    if (idx < 0) idx = 0;
    if (idx > cur.length) idx = cur.length;
    cur.splice(idx, 0, key);
    await saveProviderOrder(cur);
    // 重新渲染，保持当前激活不变
    renderProviderTabs(currentProviderKey);
    return cur;
  };

  // 为每个提供商创建标签按钮
  providerOrder.forEach((key) => {
    const cfg = ALL[key] || PROVIDERS[key];
    if (!cfg) return;

    const button = document.createElement('button');
    button.dataset.providerId = key;
    button.title = cfg.label; // 悬停提示
    button.className = key === currentProviderKey ? 'active' : '';
    button.draggable = !collapsed;

    // 添加图标
    if (cfg.icon) {
      const icon = document.createElement('img');
      icon.src = cfg.icon;
      icon.alt = cfg.label;
      icon.className = 'provider-icon';
      icon.onerror = function() {
        const fallback = document.createElement('div');
        fallback.className = 'provider-icon provider-icon-fallback';
        fallback.textContent = cfg.label.charAt(0).toUpperCase();
        fallback.title = cfg.label;
        this.parentNode.replaceChild(fallback, this);
      };
      button.appendChild(icon);
    } else {
      // 如果没有图标，显示首字母
      const fallback = document.createElement('div');
      fallback.className = 'provider-icon provider-icon-fallback';
      fallback.textContent = cfg.label.charAt(0).toUpperCase();
      fallback.title = cfg.label;
      button.appendChild(fallback);
    }

    // 点击切换提供商
    button.addEventListener('click', async () => {
      const container = document.getElementById('iframe');
      const openInTab = document.getElementById('openInTab');
      
      await setProvider(key);
      const p = effectiveConfig(ALL, key, overrides);
      if (openInTab) {
        const preferred = (currentUrlByProvider && currentUrlByProvider[key]) || p.baseUrl;
        openInTab.dataset.url = preferred;
        try { openInTab.title = preferred; } catch (_) {}
      }
      // ensure DNR + host permissions for selected origin
      try { (typeof ensureAccessFor === 'function') && ensureAccessFor(p.baseUrl); } catch(_) {}

      if (p.authCheck) {
        const auth = await p.authCheck();
        if (auth.state === 'authorized') {
          await ensureFrame(container, key, p);
        } else {
          renderMessage(container, auth.message || 'Please login.');
        }
      } else {
        await ensureFrame(container, key, p);
      }

      // 更新活动状态
      renderProviderTabs(key);
      // 更新星号按钮状态
      await updateStarButtonState();
    });

    tabsContainer.appendChild(button);

    // --- 拖拽事件 ---
    button.addEventListener('dragstart', (e) => {
      if (collapsed) return; // 折叠时不启用拖拽
      __dragKey = key;
      button.classList.add('dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', key);
      } catch (_) {}
    });
    button.addEventListener('dragend', () => {
      __dragKey = null;
      button.classList.remove('dragging');
      clearInsertClasses();
    });
    button.addEventListener('dragover', (e) => {
      if (collapsed) return;
      if (!__dragKey || __dragKey === key) return;
      e.preventDefault();
      const rect = button.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      button.classList.toggle('insert-before', before);
      button.classList.toggle('insert-after', !before);
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    });
    button.addEventListener('dragleave', () => {
      button.classList.remove('insert-before','insert-after');
    });
    button.addEventListener('drop', async (e) => {
      if (collapsed) return;
      if (!__dragKey || __dragKey === key) return;
      e.preventDefault();
      const rect = button.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      const fromIdx = providerOrder.indexOf(__dragKey);
      const toIdxBase = providerOrder.indexOf(key);
      if (fromIdx === -1 || toIdxBase === -1) return;
      let insertIdx = before ? toIdxBase : toIdxBase + 1;
      // 调整因移除后的索引偏移
      if (fromIdx < insertIdx) insertIdx -= 1;
      await moveKeyToIndex(providerOrder, __dragKey, insertIdx);
      __dragKey = null;
    });
  });

  // 展开时：使用 sticky 置顶（CSS 负责），不覆盖第一个图标
};

const initializeBar = async () => {
  const container = document.getElementById('iframe');
  const openInTab = document.getElementById('openInTab');

  const currentProviderKey = await getProvider();
  const overrides = await getOverrides();
  const mergedCurrent = effectiveConfig(PROVIDERS, currentProviderKey, overrides) || (PROVIDERS[currentProviderKey] || PROVIDERS.chatgpt);

  // 渲染底部导航栏
  await renderProviderTabs(currentProviderKey);

  // helper: request host permission for a provider URL and add DNR rule
  const ensureAccessFor = (url) => {
    let origin = null;
    try { origin = new URL(url).origin; } catch (_) {}
    if (!origin) return;
    try {
      if (chrome.permissions && chrome.permissions.request) {
        chrome.permissions.request({ origins: [origin + '/*'] }, () => {
          try { chrome.runtime.sendMessage({ type: 'ai-add-host', origin }); } catch (_) {}
        });
      } else {
        try { chrome.runtime.sendMessage({ type: 'ai-add-host', origin }); } catch (_) {}
      }
    } catch (_) {}
  };

  // The rest of this function is now handled by renderProviderTabs
  // No need to build a separate list of providers here.

  // 初始化星号按钮状态（移除 Open in Tab 后依旧可用）
  await updateStarButtonState();

  // 全宽按钮与双击顶部切换（Electron 专用）
  try {
    const fullBtn = document.getElementById('fullscreenBtn');
    if (IS_ELECTRON && window.electronAPI) {
      const updateLabel = (state) => {
        try {
          const on = !!(state && state.isFullWidth);
          if (fullBtn) {
            fullBtn.textContent = on ? '⤡ Exit Full' : '⤢ Full';
            fullBtn.title = on ? '还原到原来的宽度' : '切换为全屏宽度';
          }
        } catch (_) {}
      };
      // 初始状态
      window.electronAPI.getFullWidthState?.().then(updateLabel);
      window.electronAPI.onFullWidthChanged?.(updateLabel);
      // 按钮点击
      if (fullBtn) {
        fullBtn.addEventListener('click', () => {
          try { window.electronAPI.toggleFullWidth?.(); } catch (_) {}
        });
      }
      // 顶部拖拽区双击切换
      const dragZone = document.querySelector('.drag-zone');
      if (dragZone) {
        dragZone.addEventListener('dblclick', (e) => {
          // 避免与工具栏按钮的点击冲突
          if (e.target && (e.target.closest && e.target.closest('.toolbar'))) return;
          try { window.electronAPI.toggleFullWidth?.(); } catch (_) {}
        });
      }
    } else if (fullBtn) {
      // 非 Electron 环境隐藏该按钮
      fullBtn.style.display = 'none';
    }
  } catch (_) {}


  // History button handler
  try {
    const hBtn = document.getElementById('historyBtn');
    const panel = document.getElementById('historyPanel');
  const ensureBackdrop = () => {
      let bd = document.getElementById('historyBackdrop');
      if (!bd) {
        bd = document.createElement('div');
        bd.id = 'historyBackdrop';
        bd.className = 'history-backdrop';
        bd.addEventListener('click', () => hideHistoryPanel());
        // Attach under the same stacking context as the panel to guarantee panel stays above
        const parent = panel.parentNode || document.body;
        parent.appendChild(bd);
      }
      return bd;
    };
    const removeBackdrop = () => {
      const bd = document.getElementById('historyBackdrop');
      if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
    };
    const showHistoryPanel = async () => {
      await renderHistoryPanel();
      panel.style.display = 'block';
      ensureBackdrop();
      try { if (IS_ELECTRON && window.electronAPI?.enterOverlay) window.electronAPI.enterOverlay(); } catch(_){}
    };
    const hideHistoryPanel = () => {
      panel.style.display = 'none';
      removeBackdrop();
      try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
    };
    window.hideHistoryPanel = hideHistoryPanel; // expose for other handlers if needed
    window.showHistoryPanel = showHistoryPanel;

    if (hBtn && panel) {
      hBtn.addEventListener('click', async () => {
        if (panel.style.display === 'none' || !panel.style.display) {
          await showHistoryPanel();
        } else {
          hideHistoryPanel();
        }
      });
    }

  // Close with Escape
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') hideHistoryPanel(); }, true);
  // overlay 模式无需处理窗口尺寸推挤
  } catch (_) {}

  // Favorites button handler
  try {
    const fBtn = document.getElementById('favoritesBtn');
    const panel = document.getElementById('favoritesPanel');
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el.tagName||'').toLowerCase();
      return tag === 'input' || tag === 'textarea' || !!el.isContentEditable;
    };
    const starCurrentAndOpenRename = async () => {
      try {
        const a = document.getElementById('openInTab');
        const href = a && a.href;
        const provider = (await getProvider())||'chatgpt';
        if (href) {
          __pendingFavInlineEditUrl = href;
          __pendingFavCloseOnEnter = true;
          const suggested = (currentTitleByProvider[provider] || document.title || '').trim();
          await addFavorite({ url: href, provider, title: suggested, needsTitle: true });
          return true;
        }
      } catch (_) {}
      return false;
    };
    const ensureBackdrop = () => {
      let bd = document.getElementById('favoritesBackdrop');
      if (!bd) {
        bd = document.createElement('div');
        bd.id = 'favoritesBackdrop';
        bd.className = 'favorites-backdrop';
        bd.addEventListener('click', () => hideFavoritesPanel());
        const parent = panel.parentNode || document.body;
        parent.appendChild(bd);
      }
      return bd;
    };
    const removeBackdrop = () => {
      const bd = document.getElementById('favoritesBackdrop');
      if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
    };
    const showFavoritesPanel = async () => {
      await renderFavoritesPanel();
      panel.style.display = 'block';
      ensureBackdrop();
      try { if (IS_ELECTRON && window.electronAPI?.enterOverlay) window.electronAPI.enterOverlay(); } catch(_){}
    };
    const hideFavoritesPanel = () => {
      panel.style.display = 'none';
      removeBackdrop();
      try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
    };
    window.hideFavoritesPanel = hideFavoritesPanel;
    window.showFavoritesPanel = showFavoritesPanel;

    if (fBtn && panel) {
      // Click Favorites button to toggle favorites panel (show all starred items)
      fBtn.addEventListener('click', async () => {
        if (panel.style.display === 'none' || !panel.style.display) {
          await showFavoritesPanel();
        } else {
          hideFavoritesPanel();
        }
      });
    }

    // Global keyboard shortcut to star current page (customizable)
    let __starShortcut = null;
    (async () => {
      __starShortcut = await getStarShortcut();
    })();
    
    document.addEventListener('keydown', async (e) => {
      try {
        if (!__starShortcut) return;
        if (matchesShortcut(e, __starShortcut)) {
          // Check if user is typing in input/textarea
          const el = document.activeElement;
          const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
          if (tag === 'input' || tag === 'textarea') return; // Allow typing in inputs
          
          e.preventDefault();
          e.stopPropagation();
          
          // Star current page - trigger the star button click
          const starBtn = document.getElementById('starBtn');
          if (starBtn) starBtn.click();
        }
      } catch (_) {}
    }, true);

    // Close with Escape
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') hideFavoritesPanel(); }, true);
  } catch (_) {}

  // Star button handler - toggle star for current page
  try {
    const starBtn = document.getElementById('starBtn');
    if (starBtn) {
      starBtn.addEventListener('click', async () => {
        try {
          const href = await getCurrentDisplayedUrl();
          const provider = (await getProvider()) || 'chatgpt';
          
          if (!href || href === '#') return;
          
          // Check if already starred (normalize for comparison)
          const normalizedHref = normalizeUrlForMatch(href);
          const favList = await loadFavorites();
          const isStarred = (favList || []).some(fav => normalizeUrlForMatch(fav.url) === normalizedHref);
          
          if (isStarred) {
            // Unstar: remove from favorites (use normalized comparison)
            const filtered = favList.filter(fav => normalizeUrlForMatch(fav.url) !== normalizedHref);
            await saveFavorites(filtered);
          } else {
            // Star: add to favorites
            const suggested = (currentTitleByProvider[provider] || document.title || '').trim();
            await addFavorite({ url: href, provider, title: suggested, needsTitle: false });
          }
          
          // Update star button state
          await updateStarButtonState();
          
          // If History panel is open, update it to show new star state
          try {
            const historyPanel = document.getElementById('historyPanel');
            if (historyPanel && historyPanel.style.display !== 'none') {
              await renderHistoryPanel();
            }
          } catch (_) {}
        } catch (err) {
          console.error('Error toggling star:', err);
        }
      });
    }
  } catch (_) {}

  // (Shortcuts button removed)

  // Settings button handler
  try {
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', async () => {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;
        
        const starShortcut = await getStarShortcut();
        const buttonShortcuts = await getButtonShortcuts();
        
        const formatKey = (shortcut) => `${shortcut.ctrl ? 'Ctrl+' : ''}${shortcut.alt ? 'Alt+' : ''}${shortcut.shift ? 'Shift+' : ''}${shortcut.key.toUpperCase()}`;
        
        const shortcutRows = [
          { id: 'openInTab', label: 'Open in Tab', shortcut: buttonShortcuts.openInTab },
          { id: 'searchBtn', label: 'Search', shortcut: buttonShortcuts.searchBtn },
          { id: 'historyBtn', label: 'History', shortcut: buttonShortcuts.historyBtn },
          { id: 'favoritesBtn', label: 'Starred', shortcut: buttonShortcuts.favoritesBtn },
          { id: 'star', label: 'Star Current Page', shortcut: starShortcut }
        ].map(item => `
          <div class="shortcut-row">
            <label>${item.label}:</label>
            <div class="shortcut-input-group">
              <input id="shortcutDisplay-${item.id}" type="text" readonly value="${formatKey(item.shortcut)}" class="shortcut-display">
              <button id="recordShortcutBtn-${item.id}" class="record-btn" data-shortcut-id="${item.id}">Change</button>
            </div>
          </div>
        `).join('');
        
        modal.innerHTML = `
          <div class="settings-modal-backdrop"></div>
          <div class="settings-modal-content">
            <div class="settings-header">
              <h2>Keyboard Shortcuts</h2>
              <button class="settings-close-btn" title="Close">&times;</button>
            </div>
            <div class="settings-body">
              ${shortcutRows}
              <div class="shortcut-info">
                Click "Change" then press your desired key combination.
              </div>
            </div>
          </div>
        `;
        
        modal.style.display = 'flex';
        
        const closeBtn = modal.querySelector('.settings-close-btn');
        const backdrop = modal.querySelector('.settings-modal-backdrop');
        
        const closeModal = () => {
          modal.style.display = 'none';
        };
        
        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);
        
        // Attach event listeners to all record buttons
        modal.querySelectorAll('.record-btn').forEach(recordBtn => {
          recordBtn.addEventListener('click', async () => {
            const shortcutId = recordBtn.getAttribute('data-shortcut-id');
            recordBtn.textContent = 'Listening...';
            recordBtn.disabled = true;
            
            const handleKeyDown = async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const newShortcut = {
                key: e.key,
                ctrl: e.ctrlKey,
                shift: e.shiftKey,
                alt: e.altKey
              };
              
              const newKeyDisplay = `${newShortcut.ctrl ? 'Ctrl+' : ''}${newShortcut.alt ? 'Alt+' : ''}${newShortcut.shift ? 'Shift+' : ''}${newShortcut.key.toUpperCase()}`;
              const display = modal.querySelector(`#shortcutDisplay-${shortcutId}`);
              if (display) display.value = newKeyDisplay;
              
              // Save shortcut based on type
              if (shortcutId === 'star') {
                await setStarShortcut(newShortcut);
                __starShortcut = newShortcut;
              } else {
                const updated = await getButtonShortcuts();
                updated[shortcutId] = newShortcut;
                await setButtonShortcuts(updated);
                __buttonShortcuts = updated; // 更新全局缓存
                
                // 如果是搜索按钮，更新其title
                if (shortcutId === 'searchBtn') {
                  const searchBtn = document.getElementById('searchBtn');
                  if (searchBtn) {
                    const keys = [];
                    if (newShortcut.ctrl) keys.push('Ctrl');
                    if (newShortcut.shift) keys.push('Shift');
                    if (newShortcut.alt) keys.push('Alt');
                    keys.push(newShortcut.key.toUpperCase());
                    searchBtn.title = `Search in page (${keys.join('+')})`;
                  }
                }
              }
              
              recordBtn.textContent = 'Change';
              recordBtn.disabled = false;
              document.removeEventListener('keydown', handleKeyDown, true);
            };
            
            document.addEventListener('keydown', handleKeyDown, true);
          });
        });
      });
    }
  } catch (_) {}

  try { (typeof ensureAccessFor === 'function') && ensureAccessFor(mergedCurrent.baseUrl); } catch(_) {}

  // Helper: cycle provider by direction (-1 prev, +1 next)
  const cycleProvider = async (dir) => {
    try {
      const container = document.getElementById('iframe');
      const openInTab = document.getElementById('openInTab');
      const btns = Array.from(document.querySelectorAll('#provider-tabs button[data-provider-id]'));
      const order = btns.map(b => b.dataset.providerId).filter(Boolean);
      if (!order.length) return;
      const cur = await getProvider();
      let idx = order.indexOf(cur);
      if (idx < 0) idx = 0;
      const nextIdx = (idx + (dir || 1) + order.length) % order.length;
      const nextKey = order[nextIdx];
      const overridesNow = await getOverrides();
      const customProviders = await loadCustomProviders();
      const ALL = { ...PROVIDERS };
      (customProviders || []).forEach((c) => { ALL[c.key] = c; });
      const p = effectiveConfig(ALL, nextKey, overridesNow);
      await setProvider(nextKey);
      if (openInTab) {
        const preferred = (currentUrlByProvider && currentUrlByProvider[nextKey]) || p.baseUrl;
        openInTab.dataset.url = preferred;
        try { openInTab.title = preferred; } catch (_) {}
      }
      try {
        const origin = new URL(p.baseUrl || p.iframeUrl || '').origin;
        if (origin) chrome.runtime.sendMessage({ type: 'ai-add-host', origin });
      } catch (_) {}
      // Avoid focusing inside the frame so Tab stays captured by the panel
      __suppressNextFrameFocus = true;
      if (p.authCheck) {
        const auth = await p.authCheck();
        if (auth.state === 'authorized') {
          await ensureFrame(container, nextKey, p);
        } else {
          renderMessage(container, auth.message || 'Please login.');
        }
      } else {
        await ensureFrame(container, nextKey, p);
      }
      // Reset suppression and bring focus back to the panel container
      __suppressNextFrameFocus = false;
      renderProviderTabs(nextKey);
      try {
        const tabsEl = document.getElementById('provider-tabs');
        if (tabsEl) { tabsEl.tabIndex = -1; tabsEl.focus(); }
        else if (document && document.body && document.body.focus) { document.body.focus(); }
      } catch (_) {}
    } catch (_) {}
  };
  try { window.__AIPanelCycleProvider = cycleProvider; } catch (_) {}

  // Global keyboard shortcut to star current page (customizable, default: Ctrl+L)
  let __starShortcut = null;
  (async () => {
    __starShortcut = await getStarShortcut();
    dbg('Star shortcut loaded:', __starShortcut);
  })();

  document.addEventListener('keydown', async (e) => {
    try {
      if (!__starShortcut) return;
      if (matchesShortcut(e, __starShortcut)) {
        // Check if user is typing in input/textarea
        const el = document.activeElement;
        const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') return; // Allow typing in inputs
        
        e.preventDefault();
        e.stopPropagation();
        
        // Star current page - trigger the star button click
        const starBtn = document.getElementById('starBtn');
        if (starBtn) {
          starBtn.click();
          dbg('Page starred via keyboard shortcut');
        }
      }
    } catch (_) {}
  }, true);

  // Keyboard: Tab to cycle providers (Shift+Tab reverse)
  try {
    document.addEventListener('keydown', async (e) => {
      try {
        if (e.key !== 'Tab') return;
        // Force-bind Tab to provider switching within the side panel
        e.preventDefault();
        e.stopPropagation();
        const dir = e.shiftKey ? -1 : 1;
        await cycleProvider(dir);
      } catch (_) {}
    }, true);
  } catch (_) {}

  // Global keyboard shortcuts for toolbar buttons
  let __buttonShortcuts = await getButtonShortcuts();
  document.addEventListener('keydown', async (e) => {
    try {
      const el = document.activeElement;
      const tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
      // Don't trigger shortcuts when typing in inputs
      if (tag === 'input' || tag === 'textarea') return;
      
      const isShortcutMatch = (shortcut) => {
        return e.key.toLowerCase() === shortcut.key.toLowerCase() &&
               e.ctrlKey === shortcut.ctrl &&
               e.shiftKey === shortcut.shift &&
               e.altKey === shortcut.alt;
      };
      
      // Check Open in Tab
      if (isShortcutMatch(__buttonShortcuts.openInTab)) {
        e.preventDefault();
        const btn = document.getElementById('openInTab');
        if (btn) btn.click();
        return;
      }
      
      // Check Search
      if (isShortcutMatch(__buttonShortcuts.searchBtn)) {
        e.preventDefault();
        const btn = document.getElementById('searchBtn');
        if (btn) btn.click();
        return;
      }
      
      // Check History
      if (isShortcutMatch(__buttonShortcuts.historyBtn)) {
        e.preventDefault();
        const btn = document.getElementById('historyBtn');
        if (btn) btn.click();
        return;
      }
      
      // Check Starred
      if (isShortcutMatch(__buttonShortcuts.favoritesBtn)) {
        e.preventDefault();
        const btn = document.getElementById('favoritesBtn');
        if (btn) btn.click();
        return;
      }
    } catch (_) {}
  }, true);

  // Listen for shortcut updates in settings
  try {
    window.addEventListener('storage', async (e) => {
      if (e.key === 'buttonShortcuts') {
        __buttonShortcuts = await getButtonShortcuts();
      }
    });
  } catch (_) {}

  // Initial render
  if (mergedCurrent.authCheck) {
    const auth = await mergedCurrent.authCheck();
    if (auth.state === 'authorized') {
      await ensureFrame(container, currentProviderKey, mergedCurrent);
    } else {
      renderMessage(container, auth.message || 'Please login.');
    }
  } else {
    await ensureFrame(container, currentProviderKey, mergedCurrent);
  }

  // removed keyboard command & navigation for menu
  // (keyboard command & navigation removed)
};

// (Global command message listener removed)

// Also close panel on Escape (backdrop version handles outside clicks)
try {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    try { const p = document.getElementById('historyPanel'); if (p) p.style.display = 'none'; } catch (_) {}
    try { document.getElementById('historyBackdrop')?.remove(); } catch (_) {}
  }, true);
} catch (_) {}

  // Listen for URL updates from content scripts inside provider iframes
  window.addEventListener('message', async (event) => {
    try {
      const data = event.data || {};
      if (!data || !data.type) return;
      if (data.type === 'ai-tab-cycle') {
        const dir = (data.dir === 'prev') ? -1 : 1;
        // When message comes from iframe, don't focus the frame after switching
        __suppressNextFrameFocus = true;
        try { if (window.__AIPanelCycleProvider) window.__AIPanelCycleProvider(dir); } catch (_) {}
        __suppressNextFrameFocus = false;
        return;
      }
      if (data.type !== 'ai-url-changed') return;

    // Find which provider frame this message came from by comparing contentWindow
    let matchedKey = null;
    for (const [key, el] of Object.entries(cachedFrames)) {
      try {
        if (el && el.contentWindow === event.source) {
          matchedKey = key;
          break;
        }
      } catch (_) {}
    }
    // No provider matched; ignore stray messages
    if (!matchedKey) { return; }

    // Update current URL for this provider
    if (typeof data.href === 'string' && data.href) {
      // Ignore Gemini internal utility frames to avoid polluting state
      try {
        const u = new URL(data.href);
        if (u.hostname === 'gemini.google.com' && (u.pathname === '/_/' || u.pathname.startsWith('/_/'))) {
          return;
        }
      } catch (_) {}
      currentUrlByProvider[matchedKey] = data.href;
      // Save URL for restoration on next open
      saveProviderUrl(matchedKey, data.href);

      // If this provider is currently visible, update the Open in Tab link
      const openInTab = document.getElementById('openInTab');
      const visible = (cachedFrames[matchedKey] && cachedFrames[matchedKey].style.display !== 'none');
      if (openInTab && visible) {
        openInTab.dataset.url = data.href;
        try { openInTab.title = data.href; } catch (_) {}
        // 更新星号按钮状态
        await updateStarButtonState();
      }

      // Auto-save history for supported providers when a deep link is detected
      try {
        if (isDeepLink(matchedKey, data.href)) {
          addHistory({ url: data.href, provider: matchedKey, title: data.title || '' });
        }
      } catch (_) {}
      // Track last known title for this provider for better Add Current defaults
      try { currentTitleByProvider[matchedKey] = data.title || ''; } catch (_) {}
    }
  } catch (_) {}
});

// 在 Electron BrowserView 模式下，监听 URL 变化
if (IS_ELECTRON && window.electronAPI && window.electronAPI.onBrowserViewUrlChanged) {
  window.electronAPI.onBrowserViewUrlChanged((data) => {
    const { providerKey, url, title } = data;
    dbg('BrowserView URL changed:', providerKey, url, title);
    
    // 更新 URL 缓存
    if (url) {
      currentUrlByProvider[providerKey] = url;
      saveProviderUrl(providerKey, url);
    }
    
    // 更新标题缓存
    if (title) {
      currentTitleByProvider[providerKey] = title;
    }
    
    // 如果是当前激活的 provider，更新 Open in Tab 按钮
    getProvider().then(currentProvider => {
      if (currentProvider === providerKey) {
        // 更新 Star 按钮状态
        updateStarButtonState();
        
        // 镜像模式下不自动追加历史，保持与插件一致
        if (!SYNC_MIRROR_FROM_PLUGIN) {
          if (isDeepLink(providerKey, url)) {
            addHistory({ url, provider: providerKey, title: title || '' });
          }
        }
      }
    });
  });
}

initializeBar();

// ============== 来自后台的消息与待处理队列 ==============
(function initRuntimeMessages() {
  function getActiveProviderFrame() {
    try {
      const iframeContainer = document.getElementById('iframe');
      const el = iframeContainer?.querySelector('[data-provider]:not([style*="display: none"])');
      return el || null;
    } catch (_) { return null; }
  }

  function toast(text, level = 'info') {
    try {
      let box = document.getElementById('aisb-toast');
      if (!box) {
        box = document.createElement('div');
        box.id = 'aisb-toast';
        box.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;background:#111827;color:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:12px;max-width:60%;opacity:.98;';
        document.body.appendChild(box);
      }
      box.textContent = String(text || '');
      box.style.background = level === 'error' ? '#b91c1c' : (level === 'warn' ? '#92400e' : '#111827');
      box.style.display = 'block';
      clearTimeout(toast._t);
      toast._t = setTimeout(()=>{ try { box.style.display = 'none'; } catch (_) {} }, 2200);
    } catch (_) {}
  }

  async function handlePendingFromStorage() {
    try {
      const { aisbPendingInsert, aisbPendingScreenshot, aisbPendingNotify } = await chrome.storage?.local.get(['aisbPendingInsert','aisbPendingScreenshot','aisbPendingNotify']);
      if (aisbPendingNotify && aisbPendingNotify.text) {
        toast(aisbPendingNotify.text, aisbPendingNotify.level || 'info');
        try { await chrome.storage?.local.remove(['aisbPendingNotify']); } catch (_) {}
      }
      if (aisbPendingInsert && aisbPendingInsert.text) {
        routeInsertText(aisbPendingInsert);
        try { await chrome.storage?.local.remove(['aisbPendingInsert']); } catch (_) {}
      }
      if (aisbPendingScreenshot && aisbPendingScreenshot.dataUrl) {
        showScreenshotOverlay(aisbPendingScreenshot);
        try { await chrome.storage?.local.remove(['aisbPendingScreenshot']); } catch (_) {}
      }
    } catch (_) {}
  }

  function routeInsertText(msg) {
    try {
      const target = getActiveProviderFrame();
      if (!target || !target.contentWindow) {
        toast('未找到活动的 AI 面板。', 'warn');
        return;
      }
      // 尽量把焦点转入侧栏与 iframe
      try { window.focus(); } catch (_) {}
      try { document.body.tabIndex = -1; document.body.focus(); } catch (_) {}
      try { target.focus(); } catch (_) {}
      try { target.contentWindow.focus(); } catch (_) {}
      // 追加并要求聚焦
      target.contentWindow.postMessage({ type: 'AI_SIDEBAR_INSERT', text: msg.text || '', mode: 'append', focus: true }, '*');

      // 多次尝试确保焦点最终在输入框（处理面板刚打开或站点懒加载）
      const pokeFocus = () => {
        try {
          target.focus();
          target.contentWindow?.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*');
        } catch (_) {}
      };
      const attempts = [40, 120, 240, 420, 700];
      attempts.forEach((ms)=> setTimeout(pokeFocus, ms));
      toast('已将选中文本注入输入框');
    } catch (e) {
      toast('注入失败：' + String(e), 'error');
    }
  }

  function showScreenshotOverlay(msg) {
    try {
      // 直接将截图发送到活动的 iframe 中
      const target = getActiveProviderFrame();
      if (!target || !target.contentWindow) {
        toast('未找到活动的 AI 面板', 'warn');
        return;
      }
      
      // 发送截图数据到 iframe
      target.contentWindow.postMessage({
        type: 'AI_SIDEBAR_INSERT_IMAGE',
        dataUrl: msg.dataUrl,
        tabTitle: msg.tabTitle || '',
        tabUrl: msg.tabUrl || ''
      }, '*');
      
      toast('截图已加载到输入框');
      
      // 聚焦到 iframe
      try { window.focus(); } catch (_) {}
      try { document.body.tabIndex = -1; document.body.focus(); } catch (_) {}
      try { target.focus(); } catch (_) {}
      try { target.contentWindow.focus(); } catch (_) {}
    } catch (e) {
      toast('加载截图失败：' + String(e), 'error');
    }
  }

  // Receive from background in real time
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (!message || !message.type) return;
        if (message.type === 'aisb.notify') {
          toast(message.text || '', message.level || 'info');
          return;
        }
        if (message.type === 'aisb.insert-text') {
          routeInsertText(message);
          return;
        }
        if (message.type === 'aisb.focus-only') {
          const target = getActiveProviderFrame();
          if (target && target.contentWindow) {
            try { window.focus(); } catch (_) {}
            try { document.body.tabIndex = -1; document.body.focus(); } catch (_) {}
            try { target.focus(); } catch (_) {}
            try { target.contentWindow.focus(); } catch (_) {}
            try { target.contentWindow.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*'); } catch (_) {}
            const poke = () => { try { target.focus(); target.contentWindow?.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*'); } catch (_) {} };
            ;[40,120,240,420,700,1000].forEach(ms => setTimeout(poke, ms));
          }
          return;
        }
        if (message.type === 'aisb.receive-screenshot') {
          showScreenshotOverlay(message);
          return;
        }
        if (message.type === 'aisb.type-proxy') {
          const target = getActiveProviderFrame();
          if (target && target.contentWindow) {
            try { target.focus(); } catch (_) {}
            try { target.contentWindow.focus(); } catch (_) {}
            target.contentWindow.postMessage({ type: 'AI_SIDEBAR_PROXY_TYPE', payload: message.payload || {} }, '*');
          }
          return;
        }
      } catch (_) {}
    });
  } catch (_) {}

  // Drain any pending payloads saved in storage (when panel was closed)
  handlePendingFromStorage();
})();

// ============== 搜索功能 ==============
(function initializeSearch() {
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');
  const searchPrev = document.getElementById('searchPrev');
  const searchNext = document.getElementById('searchNext');
  const searchClose = document.getElementById('searchClose');
  const searchCount = document.getElementById('searchCount');
  const searchBtn = document.getElementById('searchBtn');

  let isSearchVisible = false;
  let currentSearchTerm = '';

  // 顶部预留逻辑移除：采用 overlay 模式，不再推挤 BrowserView

  // 切换搜索框显示/隐藏
  function toggleSearch() {
    isSearchVisible = !isSearchVisible;
    
    if (isSearchVisible) {
      searchBar.style.display = 'block';
      searchInput.focus();
      searchInput.select();
      try { if (IS_ELECTRON && window.electronAPI?.enterOverlay) window.electronAPI.enterOverlay(); } catch(_){}
      
      // 高亮搜索按钮
      if (searchBtn) {
        searchBtn.classList.add('active');
      }
      
      // 如果有之前的搜索词，重新搜索
      if (searchInput.value) {
        performSearch(searchInput.value);
      }
    } else {
      searchBar.style.display = 'none';
      clearSearch();
      try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
      
      // 取消高亮搜索按钮
      if (searchBtn) {
        searchBtn.classList.remove('active');
      }
    }
  }

  // 执行搜索
  function performSearch(term, direction = '') {
    if (!term) {
      clearSearch();
      return;
    }

    currentSearchTerm = term;

    try {
      // 获取当前激活的iframe
      const iframeContainer = document.getElementById('iframe');
      const activeFrame = iframeContainer?.querySelector('[data-provider]:not([style*="display: none"])');
      
      if (activeFrame) {
        // 通过postMessage向iframe发送搜索请求
        try {
          activeFrame.contentWindow.postMessage({
            type: 'AI_SIDEBAR_SEARCH',
            action: direction === 'prev' ? 'findPrevious' : 'findNext',
            term: term
          }, '*');
          
          // 设置搜索状态
          searchCount.textContent = '搜索中...';
          searchInput.style.backgroundColor = '';
          
          // 如果3秒内没有响应，显示降级方案
          setTimeout(() => {
            if (searchCount.textContent === '搜索中...') {
              tryNativeSearch(activeFrame, term, direction);
            }
          }, 500);
        } catch (e) {
          console.log('postMessage失败，尝试原生搜索:', e);
          tryNativeSearch(activeFrame, term, direction);
        }
      }
    } catch (e) {
      console.error('搜索出错:', e);
      searchCount.textContent = '搜索失败';
    }
  }
  
  // 尝试使用原生window.find
  function tryNativeSearch(frame, term, direction) {
    try {
      const iframeWindow = frame.contentWindow;
      
      if (iframeWindow && iframeWindow.find) {
        // 使用window.find API
        const found = iframeWindow.find(
          term,
          false, // caseSensitive
          direction === 'prev', // backwards
          true, // wrapAround
          false, // wholeWord
          false, // searchInFrames
          false  // showDialog
        );
        
        if (found) {
          searchCount.textContent = '已找到';
          searchInput.style.backgroundColor = '';
        } else {
          searchCount.textContent = '未找到';
          searchInput.style.backgroundColor = '#fff3cd';
        }
      } else {
        // 无法使用window.find，显示提示
        searchCount.textContent = '请使用 Cmd/Ctrl+F';
      }
    } catch (e) {
      console.log('原生搜索失败:', e);
      searchCount.textContent = '请使用 Cmd/Ctrl+F';
    }
  }
  
  // 监听来自iframe的搜索结果
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'AI_SIDEBAR_SEARCH_RESULT') {
      const { found, total, current } = event.data;
      
      if (found) {
        if (total > 0) {
          searchCount.textContent = `${current}/${total}`;
        } else {
          searchCount.textContent = '已找到';
        }
        searchInput.style.backgroundColor = '';
      } else {
        searchCount.textContent = '未找到';
        searchInput.style.backgroundColor = '#fff3cd';
      }
    }
  });


  // 清除搜索
  function clearSearch() {
    currentSearchTerm = '';
    searchCount.textContent = '';
    searchInput.style.backgroundColor = '';
    
    try {
      const iframeContainer = document.getElementById('iframe');
      const activeFrame = iframeContainer?.querySelector('[data-provider]:not([style*="display: none"])');
      
      if (activeFrame && activeFrame.contentWindow) {
        // 向iframe发送清除搜索的消息
        try {
          activeFrame.contentWindow.postMessage({
            type: 'AI_SIDEBAR_SEARCH',
            action: 'clear',
            term: ''
          }, '*');
        } catch (_) {}
        
        // 尝试清除选择
        try {
          const selection = activeFrame.contentWindow.getSelection();
          if (selection) {
            selection.removeAllRanges();
          }
        } catch (_) {}
      }
    } catch (e) {
      // 忽略跨域错误
    }
  }

  // 监听 ESC 键关闭搜索
  document.addEventListener('keydown', (e) => {
    // ESC 关闭搜索
    if (e.key === 'Escape' && isSearchVisible) {
      toggleSearch();
    }
  });

  // 搜索输入框事件
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value;
    if (term) {
      performSearch(term);
    } else {
      clearSearch();
    }
  });

  // Enter键搜索下一个
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        performSearch(searchInput.value, 'prev');
      } else {
        performSearch(searchInput.value, 'next');
      }
    }
  });

  // 上一个按钮
  searchPrev.addEventListener('click', () => {
    if (searchInput.value) {
      performSearch(searchInput.value, 'prev');
    }
  });

  // 下一个按钮
  searchNext.addEventListener('click', () => {
    if (searchInput.value) {
      performSearch(searchInput.value, 'next');
    }
  });

  // 关闭按钮
  searchClose.addEventListener('click', () => {
    toggleSearch();
  });

  // 工具栏搜索按钮
  if (searchBtn) {
    // 设置初始快捷键提示
    getButtonShortcuts().then(shortcuts => {
      const sc = shortcuts.searchBtn;
      const keys = [];
      if (sc.ctrl) keys.push('Ctrl');
      if (sc.shift) keys.push('Shift');
      if (sc.alt) keys.push('Alt');
      keys.push(sc.key.toUpperCase());
      searchBtn.title = `Search in page (${keys.join('+')})`;
    });
    
    searchBtn.addEventListener('click', () => {
      toggleSearch();
    });
  }

  dbg('搜索功能已初始化');
})();

// ============== 与插件目录的文件同步（导入 + 监听） ==============
(async function syncImportFromExternalIfAny(){
  try {
    if (!(IS_ELECTRON && window.electronAPI && window.electronAPI.sync)) return;
    // 初次导入：Favorites（镜像）
    try {
      const extFavs = await window.electronAPI.sync.read('favorites');
      if (Array.isArray(extFavs)) {
        await saveFavoritesLocalOnly(extFavs);
      }
    } catch (_) {}
    // 初次导入：History（镜像）
    try {
      const extHist = await window.electronAPI.sync.read('history');
      if (Array.isArray(extHist) && window.HistoryDB && HistoryDB.replace) {
        await HistoryDB.replace(extHist);
      }
    } catch (_) {}
    // 监听文件变更（镜像覆盖）
    try {
      window.electronAPI.sync.onUpdated?.(async (name, data) => {
        try {
          if (name === 'favorites' && Array.isArray(data)) {
            await saveFavoritesLocalOnly(data);
            await updateStarButtonState();
          }
          if (name === 'history' && Array.isArray(data) && window.HistoryDB) {
            await HistoryDB.replace(data);
          }
        } catch (_) {}
      });
    } catch (_) {}
  } catch (_) {}
})();
