// 公共认证检查函数 - 减少重复代码
// 在 Electron/Capacitor 环境中，我们通过 webview 加载站点并在其中完成登录，
// 因此无需在渲染层提前做跨域的会话检查。
const IS_ELECTRON = !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron);
// Capacitor 检测：检查多种方式
const IS_CAPACITOR = !!(typeof window !== 'undefined' && (
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
  (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web') ||
  (navigator.userAgent.includes('CapacitorJS'))
));
const IS_NATIVE = IS_ELECTRON || IS_CAPACITOR;
console.log('[AISidebar] Environment: IS_ELECTRON=', IS_ELECTRON, 'IS_CAPACITOR=', IS_CAPACITOR, 'IS_NATIVE=', IS_NATIVE);
const AuthCheckers = {
  // ChatGPT通用认证检查
  chatgptAuth: async (baseUrl = 'https://chatgpt.com') => {
    try {
      // Electron/Capacitor 环境下直接允许渲染，让用户在 webview 内登录
      if (IS_NATIVE) {
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
      // 在原生环境下忽略错误，直接加载
      if (IS_NATIVE) {
        return { state: 'authorized' };
      }
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
    // Standard Google search (not AI Mode)
    iframeUrl: 'https://www.google.com',
    authCheck: null
  },
  aistudio: {
    label: 'AI Studio',
    icon: 'images/providers/aistudio.png',
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
  attention: {
    label: 'Attention Tracker',
    icon: 'images/时间管道.JPG',
    baseUrl: 'https://attention-span-tracker.netlify.app',
    iframeUrl: 'https://attention-span-tracker.netlify.app/',
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
  },
  'v0': {
    label: 'v0',
    icon: 'images/providers/v0.svg',
    baseUrl: 'https://v0.app',
    iframeUrl: 'https://v0.app/chat',
    authCheck: null
  }
};

// Debug logging helper (set to false to silence in production)
const DEBUG = true;
// 同步模式：
// - 历史记录：Chrome 插件和 AI 浏览器各自独立，不再通过 sync/history.json 互相覆盖
// - 收藏（favorites）：仍通过 sync/favorites.json 在插件与 AI 浏览器之间双向同步
const SYNC_MIRROR_FROM_PLUGIN = false;
// 关闭 HistoryDB 对 sync/history.json 的写入，避免插件与桌面端互相覆盖
try { window.AI_SYNC_WRITE_ENABLED = false; } catch (_) {}
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
  favoritesBtn: { key: 'l', ctrl: true, shift: false, alt: false },
  // Align: default to Cmd+Shift+A on macOS (no Ctrl)
  alignBtn: { key: 'a', ctrl: false, shift: true, alt: false, meta: true }
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
// Right-side (embedded browser) current state
let __rightCurrentProvider = null; // providerKey currently on right side
let __rightCurrentUrl = null;      // current URL on right side
// Third screen state
let __thirdCurrentProvider = null; // providerKey currently on third screen
let __thirdCurrentUrl = null;      // current URL on third screen
let __activeSide = 'left';         // 'left' | 'right' | 'third' (for UI highlight)
let __threeScreenMode = false;    // 是否处于三分屏模式

// 切换三分屏模式
function toggleThreeScreenMode(enable) {
  try {
    __threeScreenMode = enable;
    const body = document.body;
    const thirdScreen = document.getElementById('thirdScreen');
    const thirdDivider = document.getElementById('thirdDivider');
    const splitDivider = document.getElementById('splitDivider');
    const addressBarThird = document.getElementById('addressBarThird');
    
    if (enable) {
      body.classList.add('three-screen-mode');
      if (thirdScreen) thirdScreen.style.display = 'block';
      if (thirdDivider) {
        thirdDivider.style.display = 'block';
        // 确保第三屏分割线在最上层且可见
        thirdDivider.style.pointerEvents = 'auto';
        thirdDivider.style.zIndex = '2147483647';
        thirdDivider.style.opacity = '';
      }
      // 提前显示左侧分割线，避免第一次进入三屏时短暂缺失
      if (splitDivider && splitDivider.style.display === 'none') {
        splitDivider.style.display = 'block';
        splitDivider.style.pointerEvents = 'auto';
        splitDivider.style.zIndex = '2147483647';
        splitDivider.style.opacity = '';
      }
      // 显示第三屏地址栏
      if (addressBarThird) addressBarThird.style.display = 'block';
      console.log('[Three Screen Mode] Enabled');
      // 三分屏刚开启时，分隔线位置依赖于布局计算。
      // 在某些情况下（例如右侧已开启但不会再次触发回调），
      // 分隔线不会立即更新，导致中间列宽度异常。
      // 主动触发一次“resize”以复用现有的监听逻辑，
      // 让 updateDividerPositionsForThree 等计算立即执行。
      try {
        // 立即计算一次分割线位置，避免首帧不正确
        setTimeout(() => {
          try {
            if (typeof updateDividerPositionsForThree === 'function') updateDividerPositionsForThree();
            window.dispatchEvent(new Event('resize'));
          } catch (_) {}
        }, 30);
      } catch (_) {}
    } else {
      body.classList.remove('three-screen-mode');
      if (thirdScreen) thirdScreen.style.display = 'none';
      if (thirdDivider) thirdDivider.style.display = 'none';
      if (addressBarThird) addressBarThird.style.display = 'none';
      // 清除第三屏状态
      __thirdCurrentProvider = null;
      __thirdCurrentUrl = null;
      // 如果当前激活的是第三屏，切换回左屏
      if (__activeSide === 'third') {
        setActiveSide('left');
      }
      console.log('[Three Screen Mode] Disabled');
    }
    
    // 通知主进程三分屏模式状态变化
    if (IS_ELECTRON && window.electronAPI?.setThreeScreenMode) {
      window.electronAPI.setThreeScreenMode(enable);
      if (enable && window.electronAPI?.setThreeSplitRatios) {
        try {
          const r1 = parseFloat(localStorage.getItem('threeSplitR1') || '0.3333');
          const r2 = parseFloat(localStorage.getItem('threeSplitR2') || '0.3333');
          const safeR1 = isFinite(r1) ? r1 : 1/3;
          const safeR2 = isFinite(r2) ? r2 : 1/3;
          window.electronAPI.setThreeSplitRatios(safeR1, safeR2);
        } catch (_) {}
      }
    }
  } catch (_) {}
}

function setActiveSide(side) {
  try {
    __activeSide = (side === 'third') ? 'third' : (side === 'right') ? 'right' : 'left';
    const tabs = document.getElementById('provider-tabs');
    if (tabs) {
      tabs.classList.remove('side-left', 'side-right', 'side-third');
      if (__activeSide === 'right') {
        tabs.classList.add('side-right');
      } else if (__activeSide === 'third') {
        tabs.classList.add('side-third');
      } else {
        tabs.classList.add('side-left');
      }
    }

    // 轻量同步：只切换样式与高亮，不整列表重渲（避免图标"跳动"）
    try {
      if (__activeSide === 'third') {
        const k = __thirdCurrentProvider || guessProviderKeyByUrl(__thirdCurrentUrl);
        if (k) highlightProviderOnTabs(k, 'third');
      } else if (__activeSide === 'right') {
        const k = __rightCurrentProvider || guessProviderKeyByUrl(__rightCurrentUrl);
        if (k) highlightProviderOnTabs(k, 'right');
      } else {
        getProvider().then((k)=>{ if (k) highlightProviderOnTabs(k, 'left'); });
      }
    } catch (_) {}

    if (IS_ELECTRON && window.electronAPI?.setActiveSide) {
      window.electronAPI.setActiveSide(__activeSide);
    }
  } catch (_) {}
}

// 仅更新左侧按钮的 active 类，避免整列表重建导致抖动
function highlightProviderOnTabs(key) {
  try {
    const tabs = document.getElementById('provider-tabs');
    if (!tabs) return false;
    let found = false;
    tabs.querySelectorAll('button[data-provider-id]')?.forEach((btn) => {
      const isActive = btn.dataset.providerId === key;
      if (isActive) found = true;
      btn.classList.toggle('active', isActive);
    });
    return found;
  } catch (_) { return false; }
}

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
    let t = (rawTitle || '').trim();

    // 针对通用网页（特别是 YouTube 视频链接）做一点标题净化：
    // - 如果 URL 指向 youtube.com / youtu.be
    // - 且标题形如「Some Video Title - YouTube」
    //   则去掉结尾的「- YouTube」，保留真正的视频标题，方便在历史记录中识别。
    try {
      if (url && t) {
        const u = new URL(url);
        const host = (u.hostname || '').replace(/^www\./, '').toLowerCase();
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
          const cleaned = t.replace(/\s*-\s*YouTube$/i, '').trim();
          if (cleaned) t = cleaned;
        }
      }
    } catch (_) {}

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

// 针对右侧/第三屏内嵌浏览器的网页标题做简单清洗：
// - 优先保留站点自己给出的标题，不再用 provider 名或路径推断；
// - 对 YouTube 链接，将「Some Title - YouTube」裁剪为「Some Title」。
function normalizeWebHistoryTitle(url, rawTitle) {
  try {
    let t = (rawTitle || '').trim();
    if (!t) return '';
    try {
      if (url) {
        const u = new URL(url);
        const host = (u.hostname || '').replace(/^www\./, '').toLowerCase();
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
          const cleaned = t.replace(/\s*-\s*YouTube$/i, '').trim();
          if (cleaned) t = cleaned;
        }
      }
    } catch (_) {}
    return clampTitle(t);
  } catch (_) {
    return clampTitle(rawTitle || '');
  }
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

// ---- History Export/Import helpers ----
async function exportHistory() {
  try {
    const list = await loadHistory();
    const dataStr = JSON.stringify(list, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-sidebar-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('导出历史记录失败:', err);
    alert('导出失败：' + String(err));
  }
}

async function importHistory() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) {
          alert('无效的导入文件格式');
          return;
        }
        const current = await loadHistory();
        const currentUrls = new Set(current.map(x => normalizeUrlForMatch(x.url)));
        const newItems = imported.filter(x => x && x.url && !currentUrls.has(normalizeUrlForMatch(x.url)));
        const merged = [...newItems, ...current].slice(0, 500);
        await saveHistory(merged);
        // 面板已改为浮动子窗口，无需调用 renderHistoryPanel
        alert(`已导入 ${newItems.length} 条新记录`);
      } catch (err) {
        console.error('导入历史记录失败:', err);
        alert('导入失败：' + String(err));
      }
    };
    input.click();
  } catch (err) {
    console.error('导入历史记录失败:', err);
    alert('导入失败：' + String(err));
  }
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

// 根据 URL 猜测 provider key（用于右侧内嵌浏览器）
function guessProviderKeyByUrl(href) {
  try {
    if (!href) return null;
    const u = new URL(href);
    const host = (u.hostname || '').replace(/^www\./, '');
    const ALL = PROVIDERS; // 仅从内置列表判断
    for (const [key, p] of Object.entries(ALL)) {
      const candidate = (p.baseUrl || p.iframeUrl || p.url || '').trim();
      if (!candidate) continue;
      try {
        const chost = new URL(candidate).hostname.replace(/^www\./, '');
        if (chost && chost === host) return key;
      } catch (_) {}
    }
    return null;
  } catch (_) { return null; }
}
function historyProviderLabel(key) {
  const m = PROVIDERS[key];
  return (m && m.label) || key;
}
// For history/favorites lists, derive a human-friendly source label.
// 优先使用 provider（ChatGPT、Google 等），如果没有，再根据 URL 显示站点名称（例如 YouTube）。
function historySourceLabel(entry) {
  try {
    if (!entry) return '';
    const url = entry.url || '';
    if (!url) return '';
    const u = new URL(url);
    const host = (u.hostname || '').replace(/^www\./, '').toLowerCase();
    if (!host) return '';

    // 1) 特殊站点：YouTube 一律显示为 "YouTube"，无论 provider 字段是什么
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      return 'YouTube';
    }

    const key = entry.provider || '';
    const base = historyProviderLabel(key);
    if (base) {
      // 2) 仅当 provider 的主机名与当前 URL 匹配时，才使用 provider 名称
      try {
        const p = PROVIDERS[key];
        if (p) {
          const candidate = (p.baseUrl || p.iframeUrl || p.url || '').trim();
          if (candidate) {
            const phost = new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
            if (phost && phost === host) {
              return base;
            }
          }
        }
      } catch (_) {}
    }

    // 3) 兜底：使用域名作为站点标注
    return host;
  } catch (_) {
    return '';
  }
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

// ---- Favorites Export/Import helpers ----
async function exportFavorites() {
  try {
    const list = await loadFavorites();
    const dataStr = JSON.stringify(list, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-sidebar-favorites-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('导出收藏失败:', err);
    alert('导出失败：' + String(err));
  }
}

async function importFavorites() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) {
          alert('无效的导入文件格式');
          return;
        }
        const current = await loadFavorites();
        const currentUrls = new Set(current.map(x => normalizeUrlForMatch(x.url)));
        const newItems = imported.filter(x => x && x.url && !currentUrls.has(normalizeUrlForMatch(x.url)));
        const merged = [...newItems, ...current].slice(0, 500);
        await saveFavorites(merged);
        // 面板已改为浮动子窗口，无需调用 renderFavoritesPanel
        alert(`已导入 ${newItems.length} 条新收藏`);
      } catch (err) {
        console.error('导入收藏失败:', err);
        alert('导入失败：' + String(err));
      }
    };
    input.click();
  } catch (err) {
    console.error('导入收藏失败:', err);
    alert('导入失败：' + String(err));
  }
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
    
    // 通知主进程切换到这个 provider，但不要强制导航到基础 URL
    // 这样可以复用已缓存的 BrowserView，避免在切换/隐藏时触发刷新
    if (window.electronAPI && window.electronAPI.switchProvider) {
      window.electronAPI.switchProvider({ key });
    }
    // 防御性处理：如果之前遗留了覆盖模式（BrowserView 被临时移除），
    // 这里尝试退出覆盖模式以确保视图被重新 attach。
    try { window.electronAPI?.exitOverlay?.(); } catch (_) {}
    
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
  
  // Capacitor/iOS 环境：直接使用 iframe（不使用 Browser 插件）
  // Capacitor 的 WKWebView 需要通过 allowNavigation 配置来允许 iframe 加载
  // 这里不做特殊处理，让它走下面的 iframe 逻辑
  
  // 原有的 iframe/webview 逻辑（非 Electron/Capacitor 环境）
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

// 侧栏始终显示：禁用“折叠”功能
const getTabsCollapsed = async () => false;
const setTabsCollapsed = async (_v) => { try { await chrome.storage?.local.set({ tabsCollapsed: false }); } catch (_) {} };

// 渲染底部导航栏（左侧垂直栏）
const renderProviderTabs = async (currentProviderKey) => {
  const tabsContainer = document.getElementById('provider-tabs');
  if (!tabsContainer) return;

  const overrides = await getOverrides();
  
  // 保存关闭按钮（如果存在）
  const closeBtn = tabsContainer.querySelector('.sidebar-close-btn');
  
  tabsContainer.innerHTML = '';
  
  // 恢复关闭按钮
  if (closeBtn) {
    tabsContainer.appendChild(closeBtn);
  }

  // 折叠状态
  const collapsed = false; // 强制不折叠
  tabsContainer.classList.remove('collapsed');
  
  // 不再需要 tabs-header，避免占用空间
  // 双击最大化功能移到 provider-tabs 容器本身

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
    // 悬停提示：Cmd+点击 = 右侧分屏；Cmd+Shift+点击 = 第三屏
    button.title = `${cfg.label}\n\n💡 提示：\n- Cmd+点击：右侧分屏\n- Cmd+Shift+点击：开启第三屏`;
    button.className = key === currentProviderKey ? 'active' : '';
    if (__rightCurrentProvider === key) button.classList.add('right-active');
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

    // 取消双击触发第三屏，改为 Cmd+Shift+点击

    // 点击切换提供商
    button.addEventListener('click', async (event) => {
      const container = document.getElementById('iframe');
      const openInTab = document.getElementById('openInTab');
      
      // 检测是否按下了Cmd/Ctrl 与 Shift
      const isCommandClick = event.metaKey || event.ctrlKey;
      const isThirdClick = isCommandClick && event.shiftKey;
      
      if (isThirdClick) {
        // Cmd+Shift+点击：第三屏
        console.log('[Third Screen] Cmd+Shift+Click detected for provider:', key);
        if (!__threeScreenMode) toggleThreeScreenMode(true);
        setActiveSide('third');
        if (IS_ELECTRON && window.electronAPI?.openThirdScreen) {
          const p = effectiveConfig(ALL, key, overrides);
          const url = (currentUrlByProvider && currentUrlByProvider[key]) || p.iframeUrl || p.baseUrl;
          if (__thirdCurrentProvider === key) {
            try { window.electronAPI?.focusThirdScreen?.(); } catch (_) {}
          } else {
            window.electronAPI.openThirdScreen(url);
            __thirdCurrentProvider = key; __thirdCurrentUrl = url;
          }
          highlightProviderOnTabs(key, 'third');
        }
        return; // 已处理
      }
      
      if (isCommandClick) {
        // Cmd+点击：触发分屏功能
        console.log('[Split Screen] Cmd+Click detected for provider:', key);
        
        // 设置右侧激活状态
        setActiveSide('right');
        
        // 通知主进程打开分屏模式
        if (IS_ELECTRON && window.electronAPI?.openEmbeddedBrowser) {
          const p = effectiveConfig(ALL, key, overrides);
          const url = (currentUrlByProvider && currentUrlByProvider[key]) || p.iframeUrl || p.baseUrl;
          
          // 检查是否已经在右侧显示相同的provider
          if (__rightCurrentProvider === key) {
            console.log('[Split Screen] Provider already active on right side, refreshing...');
            // 如果已经是右侧的provider，可以选择刷新或重新聚焦
            if (window.electronAPI?.focusEmbeddedBrowser) {
              window.electronAPI.focusEmbeddedBrowser();
            }
          } else {
            // 打开右侧分屏
            window.electronAPI.openEmbeddedBrowser(url);
            
            // 更新右侧激活的provider
            __rightCurrentProvider = key;
            
            console.log('[Split Screen] Opened right panel with provider:', key, 'URL:', url);
          }
          
          // 更新UI状态：添加紫色光圈
          highlightProviderOnTabs(key);
        }
        
        return; // 不执行普通的切换逻辑
      }
      
      // 普通点击：切换左侧provider
      setActiveSide('left');

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

    tabsContainer.appendChild(button);
  });
  // 展开时：使用 sticky 置顶（CSS 负责），不覆盖第一个图标
};

// 仅更新左栏中"右侧激活"的紫色光圈和"第三屏激活"的荧光色光圈，不重建 DOM
function highlightProviderOnTabs(providerKey, side = 'right') {
  try {
    const tabs = document.getElementById('provider-tabs');
    if (!tabs) return;
    const btns = tabs.querySelectorAll('button[data-provider-id]');
    btns.forEach((b) => {
      if (side === 'third') {
        if (providerKey && b.dataset.providerId === providerKey) b.classList.add('third-active');
        else b.classList.remove('third-active');
      } else if (side === 'right') {
        if (providerKey && b.dataset.providerId === providerKey) b.classList.add('right-active');
        else b.classList.remove('right-active');
      } else {
        // 清除所有非左侧的激活状态
        b.classList.remove('right-active', 'third-active');
      }
    });
  } catch (_) {}
}

const initializeBar = async () => {
  const container = document.getElementById('iframe');
  const openInTab = document.getElementById('openInTab');

  // 启动时按“第一行图标”（providerOrder 的第一个）作为默认 Provider
  // 而不是使用历史记录或硬编码 chatgpt，确保与左侧列表顺序一致
  let providerOrder = [];
  try { providerOrder = await getProviderOrder(); } catch (_) { providerOrder = Object.keys(PROVIDERS); }
  const startupKey = (Array.isArray(providerOrder) && providerOrder.length > 0) ? providerOrder[0] : 'chatgpt';
  // 将当前 provider 固定为首个图标，并写回存储，保持 UI 状态同步
  await setProvider(startupKey);
  const currentProviderKey = startupKey;
  const overrides = await getOverrides();
  const mergedCurrent = effectiveConfig(PROVIDERS, currentProviderKey, overrides) || (PROVIDERS[currentProviderKey] || PROVIDERS.chatgpt);

  // 渲染底部导航栏
  await renderProviderTabs(currentProviderKey);
  // 初始高亮为左侧
  setActiveSide('left');

  // 监听窗口尺寸变化，持续把侧边栏实际宽度同步给主进程（带节流 + 可锁定）
  try {
    let __lastSidebarWidth = -1;
    let __lastReportAt = 0;
    const reportSidebarWidth = () => {
      try {
        const el = document.getElementById('provider-tabs');
        if (!el) return;
        // 允许锁定：localStorage.insidebar_lock_sidebar_width = '1' 时不再上报
        try { if (localStorage.getItem('insidebar_lock_sidebar_width') === '1') return; } catch (_) {}
        const w = Math.round(el.offsetWidth || (el.getBoundingClientRect && el.getBoundingClientRect().width) || 0);
        const clamped = Math.max(0, Math.min(120, w));
        const now = Date.now();
        // 变化需超过 2px 且至少 400ms 才上报，避免抖动导致 BrowserView 左移右移
        if (Math.abs(clamped - __lastSidebarWidth) >= 2 && (now - __lastReportAt >= 400)) {
          if (window.electronAPI?.setSidebarWidth) window.electronAPI.setSidebarWidth(clamped);
          __lastSidebarWidth = clamped; __lastReportAt = now;
        }
      } catch (_) {}
    };
    window.addEventListener('resize', reportSidebarWidth);
    reportSidebarWidth();
  } catch (_) {}

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

  // 内嵌浏览器返回按钮和分屏指示器
  try {
    const backBtn = document.getElementById('backBtn');
    const splitDivider = document.getElementById('splitDivider');
    if (backBtn && IS_ELECTRON && window.electronAPI) {
      // 计算顶部安全区域（工具栏等），用于：
      // 1) 让分割线不要覆盖顶部 tab/工具栏
      // 2) 通知主进程给 BrowserView 让出相同的顶部空间
      const applyTopInset = () => {
        try {
          const toolbar = document.querySelector('.toolbar');
          const rect = toolbar ? toolbar.getBoundingClientRect() : { top: 0, height: 48 };
          // 仅用于 BrowserView 顶部边界（左侧 AI 视图从工具栏下边开始）
          const inset = Math.round((rect.top || 0) + (rect.height || 48) + 8);

          // 分割线需要避开“地址栏”区域，否则会遮挡输入
          const addressBarEl = document.getElementById('addressBar');
          const addressBarThirdEl = document.getElementById('addressBarThird');
          let dividerTop = inset;
          if (addressBarEl && addressBarEl.style.display !== 'none') {
            const barRect = addressBarEl.getBoundingClientRect();
            // 地址栏底部再留 4px 呼吸空间
            const barBottomWithGap = Math.round((barRect.top || 0) + (barRect.height || 36) + 4);
            dividerTop = Math.max(dividerTop, barBottomWithGap);
          }
          if (addressBarThirdEl && addressBarThirdEl.style.display !== 'none') {
            const barRect = addressBarThirdEl.getBoundingClientRect();
            const barBottomWithGap = Math.round((barRect.top || 0) + (barRect.height || 36) + 4);
            dividerTop = Math.max(dividerTop, barBottomWithGap);
          }

          // 仅将 dividerTop 写入 CSS 变量，避免改变左侧 BrowserView 的顶部边界
          document.documentElement.style.setProperty('--divider-top', dividerTop + 'px');

          // 将 toolbar inset 告知主进程用于布局（不要包含地址栏高度）
          if (window.electronAPI?.setTopInset) window.electronAPI.setTopInset(inset);
        } catch (_) {}
      };
      // 初始化与窗口变化时都更新一次
      applyTopInset();
      window.addEventListener('resize', () => {
        applyTopInset();
        if (__threeScreenMode) {
          try {
            const thirdDividerEl = document.getElementById('thirdDivider');
            if (thirdDividerEl && splitDivider && splitDivider.style.display !== 'none') {
              // 仅在三分屏打开时更新两条分隔线位置
              const providerTabs = document.getElementById('provider-tabs');
              const sidebarWidth = (providerTabs && (providerTabs.offsetWidth || 60)) || 60;
              const gutter = 24; const halfG = 12;
              const availableWidth = window.innerWidth - sidebarWidth;
              const free = Math.max(0, availableWidth - gutter * 2);
              const col = Math.floor(free / 3);
              const x1 = sidebarWidth + col + halfG;
              const x2 = sidebarWidth + col + gutter + col + halfG;
              splitDivider.style.left = `${x1}px`;
              thirdDividerEl.style.left = `${x2}px`;
              updateAddressBarPosition();
              if (typeof updateAddressBarThirdPosition === 'function') updateAddressBarThirdPosition();
            }
          } catch (_) {}
        }
      });

      // 更新分割线位置（两屏模式，按比例）
      const updateDividerPositionFromRatio = (ratio) => {
        if (!splitDivider) return;
        // 左侧导航栏固定显示，宽度为 60
        const providerTabs = document.getElementById('provider-tabs');
        const sidebarWidth = (providerTabs && (providerTabs.offsetWidth || 60)) || 60;
        const availableWidth = window.innerWidth - sidebarWidth;
        const splitPoint = availableWidth * ratio;
        // 确保分隔线位置精确对齐
        splitDivider.style.left = `${sidebarWidth + splitPoint}px`;
      };

      // 三分屏：定位两条分割线到等分位置（并为地址栏计算右边界）
      const updateDividerPositionsForThree = () => {
        const thirdDivider = document.getElementById('thirdDivider');
        if (!splitDivider || !thirdDivider) return;
        const providerTabs = document.getElementById('provider-tabs');
        const sidebarWidth = (providerTabs && (providerTabs.offsetWidth || 60)) || 60;
        const gutter = 24; const halfG = 12; const minW = 200;
        const availableWidth = window.innerWidth - sidebarWidth;
        const free = Math.max(0, availableWidth - gutter * 2);
        let r1 = 1/3, r2 = 1/3;
        try {
          const s1 = parseFloat(localStorage.getItem('threeSplitR1'));
          const s2 = parseFloat(localStorage.getItem('threeSplitR2'));
          if (!Number.isNaN(s1)) r1 = s1; if (!Number.isNaN(s2)) r2 = s2;
        } catch (_) {}
        // clamp to ensure minW
        const clampByMin = (w) => Math.max(minW, Math.floor(w));
        let leftW = clampByMin(free * r1);
        let midW = clampByMin(free * r2);
        let rightW = Math.max(minW, free - leftW - midW);
        // If overflow, re-balance
        const overflow = leftW + midW + rightW - free;
        if (overflow > 0) {
          const reduce = (want, cur) => { const d = Math.min(want, Math.max(0, cur - minW)); return [cur - d, want - d]; };
          let o = overflow; [leftW, o] = reduce(o, leftW); if (o>0) [midW, o] = reduce(o, midW); if (o>0) [rightW, o] = reduce(o, rightW);
        }
        const x1 = sidebarWidth + leftW + halfG;                   // 第一条分割线中心
        const x2 = sidebarWidth + leftW + gutter + midW + halfG;   // 第二条分割线中心
        splitDivider.style.left = `${x1}px`;
        thirdDivider.style.left = `${x2}px`;

        // 同步中间/第三屏地址栏的水平范围
        try {
          if (typeof updateAddressBarPosition === 'function') updateAddressBarPosition();
          if (typeof updateAddressBarThirdPosition === 'function') updateAddressBarThirdPosition();
        } catch (_) {}
      };
      
      // 地址栏相关元素（中间 + 第三屏）
      const addressBar = document.getElementById('addressBar');
      const addressInput = document.getElementById('addressInput');
      const addressGo = document.getElementById('addressGo');
      const addressBarThird = document.getElementById('addressBarThird');
      const addressInputThird = document.getElementById('addressInputThird');
      const addressGoThird = document.getElementById('addressGoThird');

      // 与右侧相关的交互一律标记 activeSide=right，保证后续 Tab 切换走右侧
      try {
        addressBar?.addEventListener('mousedown', () => setActiveSide('right'));
        addressBar?.addEventListener('focusin', () => setActiveSide('right'));
        addressInput?.addEventListener('focus', () => setActiveSide('right'));
        addressGo?.addEventListener('click', () => setActiveSide('right'));
        addressBarThird?.addEventListener('mousedown', () => setActiveSide('third'));
        addressBarThird?.addEventListener('focusin', () => setActiveSide('third'));
        addressInputThird?.addEventListener('focus', () => setActiveSide('third'));
        addressGoThird?.addEventListener('click', () => setActiveSide('third'));
        const splitDividerEl = document.getElementById('splitDivider');
        splitDividerEl?.addEventListener('mousedown', () => setActiveSide('right'));
        const thirdDividerEl = document.getElementById('thirdDivider');
        thirdDividerEl && (thirdDividerEl.style.pointerEvents = 'auto');
        thirdDividerEl && (thirdDividerEl.style.zIndex = '2147483647');
        thirdDividerEl?.addEventListener('mousedown', () => setActiveSide('third'));
      } catch (_) {}
      
      // 判断输入是否为URL
      const isValidUrl = (string) => {
        try {
          const url = new URL(string);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
          // 检查是否包含常见的URL特征
          return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\./.test(string) || 
                 string.startsWith('http://') || 
                 string.startsWith('https://') ||
                 string.startsWith('www.');
        }
      };
      
      // 将搜索词转换为搜索URL（使用标准 Google 搜索）
      const getSearchUrl = (query) => {
        return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      };
      
      // 处理地址栏导航
      const handleAddressNavigation = () => {
        if (!addressInput || !window.electronAPI) return;
        
        const inputValue = addressInput.value.trim();
        if (!inputValue) return;
        
        let url = inputValue;
        
        // 如果不是有效的URL，则作为搜索查询
        if (!isValidUrl(url)) {
          url = getSearchUrl(url);
        } else {
          // 如果没有协议，添加https://
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
        }
        
        // 导航到URL
        if (window.electronAPI.navigateEmbeddedBrowser) {
          window.electronAPI.navigateEmbeddedBrowser(url);
        }
      };

      // 处理第三屏地址栏导航
      const handleAddressNavigationThird = () => {
        if (!addressInputThird || !window.electronAPI) return;
        const inputValue = addressInputThird.value.trim();
        if (!inputValue) return;
        let url = inputValue;
        if (!isValidUrl(url)) url = getSearchUrl(url);
        else if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        if (window.electronAPI.navigateThirdBrowser) {
          window.electronAPI.navigateThirdBrowser(url);
        }
      };
      
      // 更新地址栏位置（使其位于右侧内容区域）
      const updateAddressBarPosition = () => {
        if (!addressBar || !splitDivider || splitDivider.style.display === 'none') return;
        try {
          const providerTabs = document.getElementById('provider-tabs');
          const sidebarWidth = (providerTabs && (providerTabs.offsetWidth || 60)) || 60;
          const gutter = 24;
          const halfG = 12;

          // 计算第一条分隔线的“中心”坐标
          const rect1 = splitDivider.getBoundingClientRect ? splitDivider.getBoundingClientRect() : null;
          const styleLeft1 = parseFloat(splitDivider.style.left);
          const center1 = Number.isFinite(styleLeft1)
            ? styleLeft1
            : rect1
              ? (rect1.left + (rect1.width || 24) / 2)
              : (sidebarWidth + (window.innerWidth - sidebarWidth) / 3);
          const main = document.getElementById('main-content');
          const mainRect = main && main.getBoundingClientRect ? main.getBoundingClientRect() : null;
          const mainLeft = mainRect ? mainRect.left : sidebarWidth;
          const mainWidth = mainRect ? mainRect.width : (window.innerWidth - sidebarWidth);
          const center1Local = center1 - mainLeft;

          let leftPx = center1Local + 4; // 默认二分屏：从分隔线右侧一点开始
          let rightPx = 8;         // 默认右侧留 8px 呼吸空间

          if (__threeScreenMode) {
            const thirdDivider = document.getElementById('thirdDivider');
            const rect2 = thirdDivider && thirdDivider.getBoundingClientRect ? thirdDivider.getBoundingClientRect() : null;
            const styleLeft2 = thirdDivider ? parseFloat(thirdDivider.style.left) : NaN;
            const center2 = thirdDivider && Number.isFinite(styleLeft2)
              ? styleLeft2
              : rect2
                ? (rect2.left + (rect2.width || 24) / 2)
                : (center1 + ((window.innerWidth - sidebarWidth - gutter * 2) || 0) / 2 + gutter);
            const center2Local = center2 - mainLeft;

            // 中间 BrowserView 的左右边界：
            // 左边界：第一条分隔线中心 + halfG
            // 右边界：第二条分隔线中心 - halfG
            const midLeft = center1Local + halfG;
            const midRight = center2Local - halfG;
            // 地址栏再向内缩 4px，避免贴边
            leftPx = midLeft + 4;
            const rightEdge = midRight - 4;
            rightPx = Math.max(8, Math.floor(mainWidth - rightEdge));
          }

          addressBar.style.left = `${leftPx}px`;
          addressBar.style.right = `${rightPx}px`;
        } catch (_) {}
      };

      // 第三屏地址栏位置：从第二条分割线右侧到窗口右缘
      const updateAddressBarThirdPosition = () => {
        if (!addressBarThird) return;
        try {
          const thirdDivider = document.getElementById('thirdDivider');
          const main = document.getElementById('main-content');
          const mainRect = main && main.getBoundingClientRect ? main.getBoundingClientRect() : null;
          const mainLeft = mainRect ? mainRect.left : 0;
          const gutter = 24;
          const halfG = 12;
          let center2 = 0;
          if (thirdDivider) {
            const rect2 = thirdDivider.getBoundingClientRect ? thirdDivider.getBoundingClientRect() : null;
            const styleLeft2 = parseFloat(thirdDivider.style.left);
            const center2Global = Number.isFinite(styleLeft2)
              ? styleLeft2
              : rect2
                ? (rect2.left + (rect2.width || 24) / 2)
                : 0;
            center2 = center2Global - mainLeft;
          }
          // 右侧 BrowserView 左边界 = 第二条分隔线中心 + halfG
          const paneLeft = center2 + halfG;
          const leftPx = Math.max(0, Math.floor(paneLeft + 4)); // 再缩进 4px
          const rightPx = 8;
          addressBarThird.style.left = `${leftPx}px`;
          addressBarThird.style.right = `${rightPx}px`;
        } catch (_) {}
      };
      
      // 显示/隐藏返回按钮和分屏指示器
      const showBackButton = () => {
        backBtn.style.display = 'inline-flex';
        // 同时显示align按钮
        const alignBtn = document.getElementById('alignBtn');
        if (alignBtn) {
          alignBtn.style.display = 'inline-flex';
        }
        if (splitDivider) {
          splitDivider.style.display = 'block';
          // 确保分割线顶部与工具栏对齐
          applyTopInset();
          // 确保分隔线可以接收事件
          splitDivider.style.pointerEvents = 'auto';
          splitDivider.style.zIndex = '2147483647';
          // 避免曾在 overlay 模式下被设置为透明
          splitDivider.style.opacity = '';
          // 立即更新分割线位置，确保与布局同步
          setTimeout(() => {
            try {
              if (__threeScreenMode) {
                updateDividerPositionsForThree();
                updateAddressBarThirdPosition();
              } else {
                const savedRatio = parseFloat(localStorage.getItem('splitRatio') || '0.5');
                updateDividerPositionFromRatio(savedRatio);
                // 通知主进程同步分屏比例
                if (window.electronAPI?.setSplitRatio) {
                  window.electronAPI.setSplitRatio(savedRatio);
                }
              }
              // 更新地址栏位置
              updateAddressBarPosition();
              updateAddressBarThirdPosition();
              // 再次刷新 divider 顶部，确保避开已显示的地址栏
              applyTopInset();
            } catch (_) {}
          }, 50);
        }
        // 显示地址栏
        if (addressBar) {
          addressBar.style.display = 'block';
          // 延迟更新位置，确保分隔线位置已设置
          setTimeout(() => {
            updateAddressBarPosition();
          }, 100);
        }
        if (__threeScreenMode && addressBarThird) {
          addressBarThird.style.display = 'block';
          setTimeout(() => { updateAddressBarThirdPosition(); }, 100);
        }
      };
      const hideBackButton = () => {
        backBtn.style.display = 'none';
        // 同时隐藏align按钮
        const alignBtn = document.getElementById('alignBtn');
        if (alignBtn) {
          alignBtn.style.display = 'none';
        }
        if (splitDivider) {
          splitDivider.style.display = 'none';
        }
        // 隐藏地址栏
        if (addressBar) {
          addressBar.style.display = 'none';
        }
        // 恢复 divider 顶部到仅工具栏高度
        applyTopInset();
      };
      
      // 监听内嵌浏览器事件
      window.electronAPI.onEmbeddedBrowserOpened?.((data) => {
        showBackButton();
        setActiveSide('right');
        // 如果提供了URL，更新地址栏并同步右侧状态
        if (data && data.url) {
          try { addressInput && (addressInput.value = data.url); } catch (_) {}
          try {
            __rightCurrentUrl = data.url;
            const k = guessProviderKeyByUrl(data.url);
            if (k) { __rightCurrentProvider = k; highlightProviderOnTabs(k); }
          } catch (_) {}
        } else {
          // 无 URL 时，尽量用现有记录刷新一次指示
          try {
            const k = __rightCurrentProvider || guessProviderKeyByUrl(__rightCurrentUrl);
            if (k) highlightProviderOnTabs(k);
          } catch (_) {}
        }
      });
      window.electronAPI.onEmbeddedBrowserClosed?.(() => {
        // 如果三分屏仍然开启（第三屏存在），保留 Return 按钮用于关闭第三屏
        if (__threeScreenMode) {
          try {
            // 隐藏与右侧相关的 UI，但保留返回按钮
            const addressBar = document.getElementById('addressBar');
            if (addressBar) addressBar.style.display = 'none';
            const splitDivider = document.getElementById('splitDivider');
            if (splitDivider) splitDivider.style.display = 'none';
            // 确保返回按钮仍可用
            backBtn.style.display = 'inline-flex';
          } catch (_) {}
        } else {
          hideBackButton();
          setActiveSide('left');
        }
        __rightCurrentProvider = null;
        try { highlightProviderOnTabs(null); } catch (_) {}
      });

      // 监听第三屏打开/关闭事件：同步三分屏 UI 状态
      try {
        // 第三屏真正打开时，无论是通过 Cmd+Shift+点击还是其它路径，
        // 都在这里统一补齐三分屏的分割线与地址栏状态，避免竞态导致竖线缺失。
        window.electronAPI.onThirdOpened?.(() => {
          try {
            __threeScreenMode = true;
            const body = document.body;
            body.classList.add('three-screen-mode');
            const splitDividerEl = document.getElementById('splitDivider');
            const thirdDivider = document.getElementById('thirdDivider');
            const addressBarThird = document.getElementById('addressBarThird');
            if (splitDividerEl) {
              splitDividerEl.style.display = 'block';
              splitDividerEl.style.pointerEvents = 'auto';
              splitDividerEl.style.zIndex = '2147483647';
              splitDividerEl.style.opacity = '';
            }
            if (thirdDivider) {
              thirdDivider.style.display = 'block';
              thirdDivider.style.pointerEvents = 'auto';
              thirdDivider.style.zIndex = '2147483647';
              thirdDivider.style.opacity = '';
            }
            if (addressBarThird) addressBarThird.style.display = 'block';
            // 统一重新计算两条竖线和地址栏的位置
            setTimeout(() => {
              try {
                if (typeof updateDividerPositionsForThree === 'function') updateDividerPositionsForThree();
                updateAddressBarPosition();
                if (typeof updateAddressBarThirdPosition === 'function') updateAddressBarThirdPosition();
                applyTopInset();
              } catch (_) {}
            }, 40);
          } catch (_) {}
        });

        window.electronAPI.onThirdClosed?.(() => {
          try {
            __threeScreenMode = false;
            const body = document.body;
            body.classList.remove('three-screen-mode');
            const thirdDivider = document.getElementById('thirdDivider');
            if (thirdDivider) thirdDivider.style.display = 'none';
            const addressBarThird = document.getElementById('addressBarThird');
            if (addressBarThird) addressBarThird.style.display = 'none';
            // 回到右侧为激活侧
            setActiveSide('right');
          } catch (_) {}
        });
      } catch (_) {}
      
      // 监听内嵌浏览器URL变化，更新地址栏并写入统一历史记录
      if (addressInput && window.electronAPI) {
        window.electronAPI.onEmbeddedBrowserUrlChanged?.((data) => {
          try {
            if (data && data.url && addressInput) {
              addressInput.value = data.url;
            }
            if (data && data.url) {
              __rightCurrentUrl = data.url;
              const k = guessProviderKeyByUrl(data.url);
              if (k) {
                __rightCurrentProvider = k;
                highlightProviderOnTabs(k);
              }
              const providerKey = k || '';
              const title = normalizeWebHistoryTitle(data.url, data.title || '');
              // needsTitle: true 表示直接使用网页自己的标题，不再用 deriveTitle 推断，
              // 避免后续被左侧 Provider 标题覆盖，保证右侧视频/网页标题稳定。
              addHistory({ url: data.url, provider: providerKey, title, needsTitle: true });
            }
          } catch (_) {}
        });
      }

      // 监听第三屏 URL 变化，更新第三屏地址栏并写入统一历史记录
      if (addressInputThird && window.electronAPI?.onThirdBrowserUrlChanged) {
        window.electronAPI.onThirdBrowserUrlChanged((data) => {
          try {
            if (data && data.url && addressInputThird) {
              addressInputThird.value = data.url;
            }
            if (data && data.url) {
              const k = guessProviderKeyByUrl(data.url);
              const providerKey = k || '';
              const title = normalizeWebHistoryTitle(data.url, data.title || '');
              addHistory({ url: data.url, provider: providerKey, title, needsTitle: true });
            }
          } catch (_) {}
        });
      }
      
      // 地址栏事件处理（中间）
      if (addressInput && addressGo && window.electronAPI) {
        // 点击"前往"按钮
        addressGo.addEventListener('click', handleAddressNavigation);
        
        // 按Enter键导航
        addressInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddressNavigation();
          }
        });

        // Tab 锁定按钮（右侧 / 第三屏）
        const tabLockRightBtn = document.getElementById('tabLockRight');
        const tabLockThirdBtn = document.getElementById('tabLockThird');
        const renderTabLock = (side) => {
          const lockedRight = (side === 'right');
          const lockedThird = (side === 'third');
          if (tabLockRightBtn) {
            tabLockRightBtn.classList.toggle('active', !!lockedRight);
            tabLockRightBtn.textContent = lockedRight ? 'Locked ▶︎' : 'Lock ▶︎';
            tabLockRightBtn.title = lockedRight ? '已锁定 Tab 到右侧（再次点击解锁）' : '锁定 Tab 到右侧';
          }
          if (tabLockThirdBtn) {
            tabLockThirdBtn.classList.toggle('active', !!lockedThird);
            tabLockThirdBtn.textContent = lockedThird ? 'Locked ▶︎' : 'Lock ▶︎';
            tabLockThirdBtn.title = lockedThird ? '已锁定 Tab 到第三屏（再次点击解锁）' : '锁定 Tab 到第三屏';
          }
        };

        const initTabLockState = () => {
          if (IS_ELECTRON && window.electronAPI?.getTabLock) {
            window.electronAPI.getTabLock().then((payload) => {
              let side = (payload && payload.side) || payload || null;
              // 若主进程没有锁定，但本地有记忆，则恢复（兼容旧版本仅 right/left）
              if ((side === null || side === undefined) && typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('tabLockSide');
                if (saved === 'right' || saved === 'left' || saved === 'third') {
                  try { window.electronAPI.setTabLock(saved); side = saved; } catch (_) {}
                }
              }
              renderTabLock(side);
            });
            window.electronAPI.onTabLockChanged?.((payload) => {
              const side = (payload && payload.side) || payload || null;
              renderTabLock(side);
            });
          } else {
            renderTabLock(localStorage.getItem('tabLockSide'));
          }
        };

        if (tabLockRightBtn || tabLockThirdBtn) {
          initTabLockState();
        }

        const toggleLock = async (targetSide) => {
          try {
            if (!IS_ELECTRON || !window.electronAPI?.getTabLock) {
              // 仅本地模式
              const cur = localStorage.getItem('tabLockSide');
              const next = (cur === targetSide) ? null : targetSide;
              if (next) localStorage.setItem('tabLockSide', next); else localStorage.removeItem('tabLockSide');
              renderTabLock(next);
              return;
            }
            const curPayload = await window.electronAPI.getTabLock();
            const curSide = (curPayload && curPayload.side) || curPayload || null;
            const next = (curSide === targetSide) ? null : targetSide;
            if (window.electronAPI?.setTabLock) window.electronAPI.setTabLock(next);
          } catch (_) {}
        };

        if (tabLockRightBtn) {
          tabLockRightBtn.addEventListener('click', async () => {
            try {
              setActiveSide('right'); // 明确目标为右侧
              await toggleLock('right');
              // 锁定后立即把焦点送到右侧，便于继续 Tab
              try { if (IS_ELECTRON && window.electronAPI?.focusEmbedded) setTimeout(()=>window.electronAPI.focusEmbedded(), 60); } catch (_) {}
              // 再次强化分割线/地址栏可见状态，避免锁定时意外隐藏左侧竖线
              try { if (typeof showBackButton === 'function') showBackButton(); } catch (_) {}
            } catch (_) {}
          });
        }
        if (tabLockThirdBtn) {
          tabLockThirdBtn.addEventListener('click', async () => {
            try {
              setActiveSide('third'); // 明确目标为第三屏
              await toggleLock('third');
              // 锁定后立即把焦点送到第三屏，便于继续 Tab
              try { if (IS_ELECTRON && window.electronAPI?.focusThird) setTimeout(()=>window.electronAPI.focusThird(), 60); } catch (_) {}
              try { if (typeof showBackButton === 'function') showBackButton(); } catch (_) {}
            } catch (_) {}
          });
        }
      }

      // 第三屏地址栏事件处理
      if (addressInputThird && addressGoThird && window.electronAPI) {
        addressGoThird.addEventListener('click', handleAddressNavigationThird);
        addressInputThird.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleAddressNavigationThird(); }
        });
      }
      
      // 返回按钮点击：关闭当前活动的右侧/第三屏
      backBtn.addEventListener('click', () => {
        if (window.electronAPI?.closeActivePane) {
          // Return 始终回到左侧主屏：同时关闭右侧和第三屏
          try { window.electronAPI.closeActivePane('all'); } catch (_) {}
        } else if (window.electronAPI?.closeEmbeddedBrowser) {
          window.electronAPI.closeEmbeddedBrowser();
        }
      });
      
      // Align按钮点击事件
      const alignBtn = document.getElementById('alignBtn');
      if (alignBtn) {
        alignBtn.addEventListener('click', () => {
          // Toggle 截图多屏同步模式（视觉与 Lock 类似）
          try {
            const nowOn = !alignBtn.classList.contains('align-active');
            if (nowOn) {
              alignBtn.classList.add('align-active');
              alignBtn.textContent = 'Aligned';
            } else {
              alignBtn.classList.remove('align-active');
              alignBtn.textContent = 'Align';
            }
            try {
              if (IS_ELECTRON && window.electronAPI?.setAlignScreenshotMode) {
                window.electronAPI.setAlignScreenshotMode(nowOn);
              }
            } catch (_) {}
          } catch (_) {}
          // 如需多 AI 发送弹窗，可在此处调用 showAlignModal()
        });
      }
      
      // Esc 键关闭活动侧（右或第三）
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backBtn.style.display !== 'none') {
          try {
            if (window.electronAPI?.closeActivePane) window.electronAPI.closeActivePane(__activeSide);
            else if (window.electronAPI?.closeEmbeddedBrowser) window.electronAPI.closeEmbeddedBrowser();
          } catch (_) {}
        }
      });
      
      // 分割线拖动功能
      if (splitDivider && IS_ELECTRON && window.electronAPI) {
        console.log('[Split Divider] Initializing drag functionality');
        let isDragging = false;
        let startX = 0;
        let startLeft = 0;
        // 三分屏拖动
        let isDraggingThree = false;
        let dragTarget = null; // 'left' | 'right'
        
        // 确保分隔线可以接收事件
        splitDivider.style.pointerEvents = 'auto';
        splitDivider.style.zIndex = '2147483647';
        
        // 获取左侧导航栏的实际宽度（考虑折叠状态）
        const getSidebarWidth = () => {
          const providerTabs = document.getElementById('provider-tabs');
          return (providerTabs && (providerTabs.offsetWidth || 60)) || 60;
        };
        
        // 更新分割线位置（从比例计算）
        const updateDividerPosition = (ratio) => {
          if (splitDivider && splitDivider.style.display !== 'none') {
            const currentSidebarWidth = getSidebarWidth();
            const availableWidth = window.innerWidth - currentSidebarWidth;
            const splitPoint = availableWidth * ratio;
            splitDivider.style.left = `${currentSidebarWidth + splitPoint}px`;
            // 同时更新地址栏位置
            updateAddressBarPosition();
          }
        };
        
        // 从位置计算分屏比例
        const calculateRatioFromPosition = (leftPosition) => {
          const currentSidebarWidth = getSidebarWidth();
          const availableWidth = window.innerWidth - currentSidebarWidth;
          const relativeX = leftPosition - currentSidebarWidth;
          return Math.max(0.2, Math.min(0.8, relativeX / availableWidth));
        };
        
        // 从鼠标位置计算分屏比例
        const calculateRatioFromMouseX = (mouseX) => {
          const currentSidebarWidth = getSidebarWidth();
          const availableWidth = window.innerWidth - currentSidebarWidth;
          const relativeX = mouseX - currentSidebarWidth;
          return Math.max(0.2, Math.min(0.8, relativeX / availableWidth));
        };
        
        // 鼠标按下：左侧分割线
        splitDivider.addEventListener('mousedown', (e) => {
          console.log('[Split Divider] mousedown event triggered', e);
          if (__threeScreenMode) {
            // 三分屏：拖动左侧竖线
            isDraggingThree = true; dragTarget = 'left';
          } else {
            isDragging = true;
          }
          startX = e.clientX;
          const currentLeft = parseFloat(splitDivider.style.left);
          const currentSidebarWidth = getSidebarWidth();
          startLeft = currentLeft || (currentSidebarWidth + (window.innerWidth - currentSidebarWidth) * 0.5);
          splitDivider.classList.add('dragging');
          e.preventDefault();
          e.stopPropagation();
          // 确保分隔线在最上层
          splitDivider.style.zIndex = '2147483647';
        });

        // 鼠标按下：第二条分割线（第三屏）
        try {
          const thirdDivider = document.getElementById('thirdDivider');
          if (thirdDivider) {
            thirdDivider.addEventListener('mousedown', (e) => {
              if (!__threeScreenMode) return; // 二分屏不处理
              isDraggingThree = true; dragTarget = 'right';
              startX = e.clientX;
              const cur = parseFloat(thirdDivider.style.left);
              startLeft = isFinite(cur) ? cur : (thirdDivider.getBoundingClientRect().left || 0);
              thirdDivider.classList.add('dragging');
              e.preventDefault(); e.stopPropagation();
              thirdDivider.style.zIndex = '2147483647';
            });
          }
        } catch (_) {}
        
        // 鼠标移动
        const handleMouseMove = (e) => {
          if (!isDragging && !isDraggingThree) return;
          
          const currentSidebarWidth = getSidebarWidth();
          const deltaX = e.clientX - startX;
          const newLeft = startLeft + deltaX;
          
          const availableWidth = window.innerWidth - currentSidebarWidth;

          if (!isDraggingThree) {
            // 二分屏逻辑
            const minLeft = currentSidebarWidth + availableWidth * 0.2;
            const maxLeft = currentSidebarWidth + availableWidth * 0.8;
            const clampedLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
            const ratio = calculateRatioFromPosition(clampedLeft);
            splitDivider.style.left = `${clampedLeft}px`;
            splitDivider.style.transition = 'none';
            updateAddressBarPosition();
            if (window.electronAPI?.setSplitRatio) window.electronAPI.setSplitRatio(ratio);
            return;
          }

          // 三分屏拖动（两条线之一）
          const gutter = 24, halfG = 12;
          const free = Math.max(0, availableWidth - gutter * 2);
          const minW = 200;

          const thirdDivider = document.getElementById('thirdDivider');
          const x1 = parseFloat(splitDivider.style.left) || (currentSidebarWidth + Math.floor(free/3) + halfG);
          const x2 = thirdDivider ? (parseFloat(thirdDivider.style.left) || (currentSidebarWidth + Math.floor(free/3) + gutter + Math.floor(free/3) + halfG)) : 0;

          if (dragTarget === 'left') {
            // 左线移动：限制左列与中列的最小宽度
            const minX = currentSidebarWidth + minW + halfG;
            const maxX = x2 - (gutter + minW + halfG);
            const nx1 = Math.max(minX, Math.min(maxX, newLeft));
            splitDivider.style.left = `${nx1}px`;
            splitDivider.style.transition = 'none';
          } else if (dragTarget === 'right' && thirdDivider) {
            const minX = x1 + (gutter + minW + halfG);
            const maxX = currentSidebarWidth + availableWidth - (minW + halfG);
            const nx2 = Math.max(minX, Math.min(maxX, newLeft));
            thirdDivider.style.left = `${nx2}px`;
            thirdDivider.style.transition = 'none';
          }

          // 计算 r1/r2 并同步主进程
          const nx1 = parseFloat(splitDivider.style.left) || x1;
          const nx2 = thirdDivider ? (parseFloat(thirdDivider.style.left) || x2) : x2;
          const w1 = (nx1 - halfG) - currentSidebarWidth;
          const w2 = Math.max(0, nx2 - nx1 - gutter);
          const rf = free > 0 ? free : 1;
          const r1 = Math.max(0.05, Math.min(0.9, w1 / rf));
          const r2 = Math.max(0.05, Math.min(0.9, w2 / rf));
          if (window.electronAPI?.setThreeSplitRatios) window.electronAPI.setThreeSplitRatios(r1, r2);
          try { localStorage.setItem('threeSplitR1', String(r1)); localStorage.setItem('threeSplitR2', String(r2)); } catch (_) {}
          // 三分屏拖动时，同时更新中间与第三屏地址栏的位置
          updateAddressBarPosition();
          try {
            if (typeof updateAddressBarThirdPosition === 'function') updateAddressBarThirdPosition();
          } catch (_) {}
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        
        // 鼠标释放
        const handleMouseUp = () => {
          if (isDragging || isDraggingThree) {
            isDragging = false; isDraggingThree = false; dragTarget = null;
            splitDivider.classList.remove('dragging');
            splitDivider.style.transition = '';
            try { document.getElementById('thirdDivider')?.classList.remove('dragging'); } catch (_) {}

            if (!__threeScreenMode) {
              try {
                const currentLeft = parseFloat(splitDivider.style.left);
                const ratio = calculateRatioFromPosition(currentLeft);
                localStorage.setItem('splitRatio', ratio.toString());
                console.log('[Split Divider] Saved ratio:', ratio);
              } catch (e) { console.error('[Split Divider] Error saving ratio:', e); }
            }
          }
        };
        
        document.addEventListener('mouseup', handleMouseUp);
        
        // 窗口大小变化时更新分割线位置
        const handleResize = () => {
          if (splitDivider.style.display !== 'none') {
            try {
              const savedRatio = parseFloat(localStorage.getItem('splitRatio') || '0.5');
              updateDividerPosition(savedRatio);
              if (window.electronAPI?.setSplitRatio) {
                window.electronAPI.setSplitRatio(savedRatio);
              }
              // 更新地址栏位置
              updateAddressBarPosition();
            } catch (_) {}
          }
        };
        
        window.addEventListener('resize', handleResize);
        
        // 监听导航栏折叠状态变化，更新分隔线位置
        const providerTabs = document.getElementById('provider-tabs');
        if (providerTabs) {
          const observer = new MutationObserver(() => {
            if (splitDivider.style.display !== 'none') {
              try {
                const savedRatio = parseFloat(localStorage.getItem('splitRatio') || '0.5');
                updateDividerPosition(savedRatio);
                if (window.electronAPI?.setSplitRatio) {
                  window.electronAPI.setSplitRatio(savedRatio);
                }
              } catch (_) {}
            }
          });
          observer.observe(providerTabs, {
            attributes: true,
            attributeFilter: ['class']
          });
        }
        
        // 监听分隔线位置变化，同步更新地址栏位置
        if (splitDivider && addressBar) {
          const dividerObserver = new MutationObserver(() => {
            if (splitDivider.style.display !== 'none' && addressBar.style.display !== 'none') {
              updateAddressBarPosition();
            }
          });
          dividerObserver.observe(splitDivider, {
            attributes: true,
            attributeFilter: ['style']
          });
        }

        // 第二条分割线点击即激活第三屏
        try {
          const thirdDivider = document.getElementById('thirdDivider');
          thirdDivider?.addEventListener('mousedown', () => setActiveSide('third'));
        } catch (_) {}
        
      // 内嵌浏览器打开时，恢复保存的分屏比例
      window.electronAPI.onEmbeddedBrowserOpened?.(() => {
        setTimeout(() => {
          try {
            if (__threeScreenMode) {
              updateDividerPositionsForThree();
            } else {
              const savedRatio = parseFloat(localStorage.getItem('splitRatio') || '0.5');
              updateDividerPosition(savedRatio);
              if (window.electronAPI?.setSplitRatio) {
                window.electronAPI.setSplitRatio(savedRatio);
              }
              console.log('[Split Divider] Restored ratio on open:', savedRatio);
            }
          } catch (e) {
            console.error('[Split Divider] Error restoring ratio:', e);
          }
        }, 100);
      });

      // 启动时向主进程询问当前是否已经处于分屏/三分屏模式
      // 这样即使 embedded-browser-opened 事件在脚本加载前就发生，也能补一次 UI 状态，
      // 避免首次打开时出现“已经三屏但分割线缺失”的情况。
      try {
        if (IS_ELECTRON && window.electronAPI?.getSplitState) {
          window.electronAPI.getSplitState().then((state) => {
            try {
              if (!state) return;
              const isEmbedded = !!state.isEmbedded;
              const isThree = !!state.isThree;
              if (isThree && !__threeScreenMode) {
                toggleThreeScreenMode(true);
              }
              if (isEmbedded || isThree) {
                showBackButton();
              }
            } catch (_) {}
          });
        }
      } catch (_) {}
      }
    }
  } catch (_) {}

  // Open in Tab 按钮点击事件
  try {
    const openInTabBtn = document.getElementById('openInTab');
    if (openInTabBtn) {
      // 设置初始快捷键提示
      getButtonShortcuts().then(shortcuts => {
        const sc = shortcuts.openInTab;
        const keys = [];
        if (sc.ctrl) keys.push('Ctrl');
        if (sc.shift) keys.push('Shift');
        if (sc.alt) keys.push('Alt');
        keys.push(sc.key.toUpperCase());
        openInTabBtn.title = `Open in Chrome (${keys.join('+')})`;
      });
      
      openInTabBtn.addEventListener('click', async () => {
        try {
          const url = await getCurrentDisplayedUrl();
          if (!url || url === '#') {
            console.warn('No URL available to open');
            return;
          }
          
          // 在 Electron 环境中使用 IPC 在 Chrome 中打开
          if (IS_ELECTRON && window.electronAPI?.openInBrowser) {
            window.electronAPI.openInBrowser(url);
          } else {
            // 浏览器环境：在新标签页中打开
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        } catch (err) {
          console.error('Error opening URL in tab:', err);
        }
      });
    }
  } catch (_) {}

  // 在覆盖模式下，隐藏/禁用分割线，避免穿透覆盖层
  try {
    if (IS_ELECTRON && window.electronAPI && window.electronAPI.onOverlayState) {
      const setDividerOverlayState = (on) => {
        try {
          const splitDivider = document.getElementById('splitDivider');
          const thirdDivider = document.getElementById('thirdDivider');
          if (splitDivider) {
            splitDivider.style.pointerEvents = on ? 'none' : 'auto';
            splitDivider.style.opacity = on ? '0' : '';
            splitDivider.style.zIndex = on ? '1' : '2147483647';
          }
          if (thirdDivider) {
            thirdDivider.style.pointerEvents = on ? 'none' : 'auto';
            thirdDivider.style.opacity = on ? '0' : '';
            thirdDivider.style.zIndex = on ? '1' : '2147483647';
          }
        } catch (_) {}
      };
      window.electronAPI.onOverlayState((payload)=>{
        try {
          if (!payload || !payload.action) return;
          if (payload.action === 'enter') setDividerOverlayState(true);
          else if (payload.action === 'exit' && (!payload.depth || payload.depth === 0)) setDividerOverlayState(false);
        } catch (_) {}
      });
    }
  } catch (_) {}

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
    const shouldUseOverlay = () => { try { return !(localStorage.getItem('insidebar_no_overlay') === '1'); } catch (_) { return true; } };
    let __historyOpen = false;
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
      // renderHistoryPanel 已移除，Electron 使用浮动子窗口
      panel.style.display = 'block';
      ensureBackdrop();
      if (!__historyOpen && shouldUseOverlay()) {
        try { if (IS_ELECTRON && window.electronAPI?.enterOverlay) window.electronAPI.enterOverlay(); } catch(_){}
      }
      __historyOpen = true;
    };
    const hideHistoryPanel = () => {
      panel.style.display = 'none';
      removeBackdrop();
      if (__historyOpen && shouldUseOverlay()) {
        try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
      }
      __historyOpen = false;
    };
    window.hideHistoryPanel = hideHistoryPanel; // expose for other handlers if needed
    window.showHistoryPanel = showHistoryPanel;

    if (hBtn) {
      hBtn.addEventListener('click', async () => {
        // Electron 使用浮动子窗口
        if (IS_ELECTRON && window.electronAPI?.toggleHistoryPanel) {
          window.electronAPI.toggleHistoryPanel();
          return;
        }
        // 非 Electron 环境（已废弃）
        if (panel) {
          if (panel.style.display === 'none' || !panel.style.display) {
            await showHistoryPanel();
          } else {
            hideHistoryPanel();
          }
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
    const shouldUseOverlay = () => { try { return !(localStorage.getItem('insidebar_no_overlay') === '1'); } catch (_) { return true; } };
    let __favoritesOpen = false;
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
      // renderFavoritesPanel 已移除，Electron 使用浮动子窗口
      panel.style.display = 'block';
      ensureBackdrop();
      if (!__favoritesOpen && shouldUseOverlay()) {
        try { if (IS_ELECTRON && window.electronAPI?.enterOverlay) window.electronAPI.enterOverlay(); } catch(_){}
      }
      __favoritesOpen = true;
    };
    const hideFavoritesPanel = () => {
      panel.style.display = 'none';
      removeBackdrop();
      if (__favoritesOpen && shouldUseOverlay()) {
        try { if (IS_ELECTRON && window.electronAPI?.exitOverlay) window.electronAPI.exitOverlay(); } catch(_){}
      }
      __favoritesOpen = false;
    };
    window.hideFavoritesPanel = hideFavoritesPanel;
    window.showFavoritesPanel = showFavoritesPanel;

    if (fBtn) {
      // Click Favorites button to toggle favorites panel (show all starred items)
      fBtn.addEventListener('click', async () => {
        // Electron: use floating panel window
        if (IS_ELECTRON && window.electronAPI?.toggleFavoritesPanel) {
          window.electronAPI.toggleFavoritesPanel();
          return;
        }
        // 非 Electron 环境（已废弃）
        if (panel) {
          if (panel.style.display === 'none' || !panel.style.display) {
            await showFavoritesPanel();
          } else {
            hideFavoritesPanel();
          }
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

  // Close button handler - hide window
  try {
    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn && IS_ELECTRON) {
      closeBtn.addEventListener('click', () => {
        try {
          if (window.electronAPI && window.electronAPI.closeWindow) {
            window.electronAPI.closeWindow();
          }
        } catch (err) {
          console.error('Error closing window:', err);
        }
      });
    }
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
          
          // History 面板已改为浮动子窗口，无需在此更新
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
        
        const formatKey = (shortcut) => `${shortcut.meta ? 'Cmd+' : ''}${shortcut.ctrl ? 'Ctrl+' : ''}${shortcut.alt ? 'Alt+' : ''}${shortcut.shift ? 'Shift+' : ''}${shortcut.key.toUpperCase()}`;
        
        const shortcutRows = [
          { id: 'openInTab', label: 'Open in Tab', shortcut: buttonShortcuts.openInTab },
          { id: 'searchBtn', label: 'Search', shortcut: buttonShortcuts.searchBtn },
          { id: 'historyBtn', label: 'History', shortcut: buttonShortcuts.historyBtn },
          { id: 'favoritesBtn', label: 'Starred', shortcut: buttonShortcuts.favoritesBtn },
          { id: 'alignBtn', label: 'Align (Multi-AI)', shortcut: buttonShortcuts.alignBtn },
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
                
                // 更新按钮的 title
                const keys = [];
                if (newShortcut.ctrl) keys.push('Ctrl');
                if (newShortcut.shift) keys.push('Shift');
                if (newShortcut.alt) keys.push('Alt');
                keys.push(newShortcut.key.toUpperCase());
                
                if (shortcutId === 'searchBtn') {
                  const searchBtn = document.getElementById('searchBtn');
                  if (searchBtn) {
                    searchBtn.title = `Search in page (${keys.join('+')})`;
                  }
                } else if (shortcutId === 'openInTab') {
                  const openInTabBtn = document.getElementById('openInTab');
                  if (openInTabBtn) {
                    openInTabBtn.title = `Open in Chrome (${keys.join('+')})`;
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
      setActiveSide('left');
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

  // Helper: cycle provider on the RIGHT embedded browser
  const cycleProviderRight = async (dir) => {
    try {
      // 明确标记右侧为当前目标，便于主进程在全局 Tab 捕获时保持方向
      try { setActiveSide('right'); } catch (_) {}
      const btns = Array.from(document.querySelectorAll('#provider-tabs button[data-provider-id]'));
      const order = btns.map(b => b.dataset.providerId).filter(Boolean);
      if (!order.length) return;

      // 当前右侧 provider（优先使用记录；否则根据 URL 猜测；再退回第一个）
      let cur = __rightCurrentProvider || guessProviderKeyByUrl(__rightCurrentUrl) || order[0];
      let idx = order.indexOf(cur);
      if (idx < 0) idx = 0;
      const nextIdx = (idx + (dir || 1) + order.length) % order.length;
      const nextKey = order[nextIdx];

      const overridesNow = await getOverrides();
      const customProviders = await loadCustomProviders();
      const ALL = { ...PROVIDERS };
      (customProviders || []).forEach((c) => { ALL[c.key] = c; });
      const p = effectiveConfig(ALL, nextKey, overridesNow);

      const preferred = (currentUrlByProvider && currentUrlByProvider[nextKey]) || p.baseUrl || p.iframeUrl || (ALL[nextKey] && (ALL[nextKey].iframeUrl || ALL[nextKey].baseUrl || ALL[nextKey].url)) || '';
      if (IS_ELECTRON && window.electronAPI?.switchProvider) {
        window.electronAPI.switchProvider({ key: nextKey, url: preferred, side: 'right' });
      }
      __rightCurrentProvider = nextKey;
      if (preferred) __rightCurrentUrl = preferred;
      // 右侧激活时，仅更新左侧高亮，避免重渲；并请求主进程聚焦右侧视图，确保连续切换无需点击
      try { highlightProviderOnTabs(nextKey); } catch (_) {}
      try {
        if (IS_ELECTRON && window.electronAPI?.focusEmbedded) {
          // 多次尝试聚焦，提升不同站点与不同加载时机下的稳定性
          const attempts = [0, 90, 180, 320];
          attempts.forEach((ms) => setTimeout(() => {
            try { window.electronAPI.focusEmbedded(); } catch (_) {}
          }, ms));
        }
      } catch (_) {}
    } catch (_) {}
  };
  try { window.__AIPanelCycleProviderRight = cycleProviderRight; } catch (_) {}

  // Helper: cycle provider on the THIRD screen
  const cycleProviderThird = async (dir) => {
    try {
      // 明确标记第三屏为当前目标
      try { setActiveSide('third'); } catch (_) {}
      
      if (!IS_ELECTRON || !window.electronAPI) return;
      
      const customProviders = await loadCustomProviders();
      const ALL = { ...PROVIDERS };
      (customProviders || []).forEach((c) => { ALL[c.key] = c; });
      
      const providerOrder = await chrome.storage.local.get('providerOrder').then(r => r.providerOrder || Object.keys(PROVIDERS));
      if (!providerOrder.length) return;
      
      const current = __thirdCurrentProvider;
      let idx = providerOrder.indexOf(current);
      if (idx < 0) idx = 0;
      const nextIdx = (idx + (dir || 1) + providerOrder.length) % providerOrder.length;
      const nextKey = providerOrder[nextIdx];
      const overridesNow = await getOverrides();
      const p = effectiveConfig(ALL, nextKey, overridesNow);
      
      // 通知主进程切换第三屏的provider
      if (window.electronAPI?.switchThirdProvider) {
        const url = (currentUrlByProvider && currentUrlByProvider[nextKey]) || p.iframeUrl || p.baseUrl;
        window.electronAPI.switchThirdProvider(nextKey, url);
        __thirdCurrentProvider = nextKey;
        __thirdCurrentUrl = url;
        
        // 更新UI状态：添加荧光色光圈
        highlightProviderOnTabs(nextKey, 'third');
      }
      
      console.log('[Third Screen] Cycled to provider:', nextKey);
    } catch (_) {}
  };
  try { window.__AIPanelCycleProviderThird = cycleProviderThird; } catch (_) {}

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
        
        // 根据当前激活的屏幕决定调用哪个循环函数
        if (__activeSide === 'third') {
          await cycleProviderThird(dir);
        } else if (__activeSide === 'right') {
          await cycleProviderRight(dir);
        } else {
          await cycleProvider(dir);
        }
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
               e.altKey === shortcut.alt &&
               (shortcut.meta ? e.metaKey : !e.metaKey);
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
        // 聚焦到地址栏
        const addressInput = document.getElementById('addressInput');
        const addressBar = document.getElementById('addressBar');
        
        if (addressBar && addressInput && addressBar.style.display !== 'none') {
          addressInput.focus();
          addressInput.select();
        } else {
          // 如果地址栏未显示，触发Search按钮点击事件
          const btn = document.getElementById('searchBtn');
          if (btn) btn.click();
        }
        return;
      }
      
      // 保留原来的搜索功能作为备用
      if (false && isShortcutMatch(__buttonShortcuts.searchBtn)) {
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
      
      // Check Align
      if (isShortcutMatch(__buttonShortcuts.alignBtn)) {
        e.preventDefault();
        // Electron 环境下的 Cmd+Shift+A 由主进程执行三屏发送，渲染层不再弹出 Align 模态
        if (IS_ELECTRON) {
          return;
        }
        // 浏览器环境：仍然弹出 Align 模态
        const btn = document.getElementById('alignBtn');
        if (btn && btn.style.display !== 'none') btn.click();
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
        setActiveSide('left');
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

        // 在 Electron BrowserView 下，当检测到深度链接时自动追加到历史记录
        if (isDeepLink(providerKey, url)) {
          addHistory({ url, provider: providerKey, title: title || '' });
        }
      }
    });
  });
}

initializeBar();

// ---- History/Favorites 浮动面板 IPC 监听 ----
if (IS_ELECTRON && window.electronAPI) {
  // History 面板请求数据
  window.electronAPI.onGetHistoryData?.(async () => {
    try {
      const list = await loadHistory();
      const favList = await loadFavorites();
      window.electronAPI.sendHistoryData?.({ history: list, favorites: favList });
    } catch (_) {}
  });
  
  // History 面板打开项目
  window.electronAPI.onOpenHistoryItem?.(async ({ url, provider }) => {
    try {
      if (!url) return;
      const container = document.getElementById('iframe');
      const overrides = await getOverrides();
      const customProviders = await loadCustomProviders();
      const ALL = { ...PROVIDERS };
      (customProviders || []).forEach((c) => { ALL[c.key] = c; });
      
      if (provider && ALL[provider]) {
        await setProvider(provider);
        const p = effectiveConfig(ALL, provider, overrides);
        const openInTab = document.getElementById('openInTab');
        if (openInTab) {
          openInTab.dataset.url = url;
          try { openInTab.title = url; } catch (_) {}
        }
        if (p.authCheck) {
          const auth = await p.authCheck();
          if (auth.state === 'authorized') {
            await ensureFrame(container, provider, p);
          } else {
            renderMessage(container, auth.message || 'Please login.');
          }
        } else {
          await ensureFrame(container, provider, p);
        }
        if (window.electronAPI?.switchProvider) {
          window.electronAPI.switchProvider({ key: provider, url });
        }
        renderProviderTabs(provider);
        await updateStarButtonState();
      } else {
        if (window.electronAPI?.switchProvider) {
          const key = provider || 'web';
          window.electronAPI.switchProvider({ key, url });
          setActiveSide('left');
        }
      }
    } catch (err) {
      console.error('Error opening history item:', err);
    }
  });
  
  // Favorites 面板请求数据
  window.electronAPI.onGetFavoritesData?.(async () => {
    try {
      const list = await loadFavorites();
      window.electronAPI.sendFavoritesData?.({ favorites: list });
    } catch (_) {}
  });
  
  // Favorites 面板打开项目
  window.electronAPI.onOpenFavoritesItem?.(async ({ url, provider }) => {
    try {
      if (!url) return;
      const container = document.getElementById('iframe');
      const overrides = await getOverrides();
      const customProviders = await loadCustomProviders();
      const ALL = { ...PROVIDERS };
      (customProviders || []).forEach((c) => { ALL[c.key] = c; });
      
      if (provider && ALL[provider]) {
        await setProvider(provider);
        const p = effectiveConfig(ALL, provider, overrides);
        const openInTab = document.getElementById('openInTab');
        if (openInTab) {
          openInTab.dataset.url = url;
          try { openInTab.title = url; } catch (_) {}
        }
        if (p.authCheck) {
          const auth = await p.authCheck();
          if (auth.state === 'authorized') {
            await ensureFrame(container, provider, p);
          } else {
            renderMessage(container, auth.message || 'Please login.');
          }
        } else {
          await ensureFrame(container, provider, p);
        }
        if (window.electronAPI?.switchProvider) {
          window.electronAPI.switchProvider({ key: provider, url });
        }
        renderProviderTabs(provider);
        await updateStarButtonState();
      } else {
        if (window.electronAPI?.switchProvider) {
          const key = provider || 'web';
          window.electronAPI.switchProvider({ key, url });
          setActiveSide('left');
        }
      }
    } catch (err) {
      console.error('Error opening favorites item:', err);
    }
  });
  
  // History 面板操作回调
  window.electronAPI.onHistoryAction?.(async ({ action, data }) => {
    try {
      if (action === 'clear') {
        await saveHistory([]);
      } else if (action === 'star') {
        const { url, provider, title } = data;
        await addFavorite({ url, provider, title, needsTitle: true });
      } else if (action === 'unstar') {
        const { url } = data;
        const favs = await loadFavorites();
        await saveFavorites(favs.filter((x) => normalizeUrlForMatch(x.url) !== normalizeUrlForMatch(url)));
      } else if (action === 'rename') {
        const { url, title } = data;
        const list = await loadHistory();
        const idx = list.findIndex((x) => x.url === url);
        if (idx >= 0 && title) {
          list[idx] = { ...list[idx], title: clampTitle(title), needsTitle: false };
          await saveHistory(list);
        }
      } else if (action === 'add-current') {
        const href = await getCurrentDisplayedUrl();
        const prov = (await getProvider()) || 'chatgpt';
        if (href) {
          const suggested = (currentTitleByProvider[prov] || document.title || '').trim();
          await addHistory({ url: href, provider: prov, title: suggested, needsTitle: true });
        }
      }
      // 刷新面板数据
      const histList = await loadHistory();
      const favList = await loadFavorites();
      window.electronAPI.sendHistoryData?.({ history: histList, favorites: favList });
    } catch (_) {}
  });
  
  // Favorites 面板操作回调
  window.electronAPI.onFavoritesAction?.(async ({ action, data }) => {
    try {
      if (action === 'clear') {
        await saveFavorites([]);
      } else if (action === 'remove') {
        const { url } = data;
        const list = await loadFavorites();
        await saveFavorites(list.filter((x) => x.url !== url));
      } else if (action === 'rename') {
        const { url, title } = data;
        const list = await loadFavorites();
        const idx = list.findIndex((x) => x.url === url);
        if (idx >= 0 && title) {
          list[idx] = { ...list[idx], title: clampTitle(title) };
          await saveFavorites(list);
        }
      } else if (action === 'add-current') {
        const href = await getCurrentDisplayedUrl();
        const prov = (await getProvider()) || 'chatgpt';
        if (href) {
          const suggested = (currentTitleByProvider[prov] || document.title || '').trim();
          await addFavorite({ url: href, provider: prov, title: suggested, needsTitle: true });
        }
      }
      // 刷新面板数据
      const list = await loadFavorites();
      window.electronAPI.sendFavoritesData?.({ favorites: list });
    } catch (_) {}
  });
  
  // History 导出/导入/清空
  window.electronAPI.onExportHistory?.(async () => {
    try { await exportHistory(); } catch (_) {}
  });
  window.electronAPI.onImportHistory?.(async () => {
    try {
      await importHistory();
      const histList = await loadHistory();
      const favList = await loadFavorites();
      window.electronAPI.sendHistoryData?.({ history: histList, favorites: favList });
    } catch (_) {}
  });
  window.electronAPI.onImportHistoryData?.(async (importedData) => {
    try {
      console.log('[Import] 收到导入数据:', importedData?.length || 0, '条');
      if (!Array.isArray(importedData)) {
        console.log('[Import] 数据不是数组');
        return;
      }
      // 直接覆盖导入，不做去重
      const merged = importedData.slice(0, 500);
      await saveHistory(merged);
      const histList = await loadHistory();
      const favList = await loadFavorites();
      window.electronAPI.sendHistoryData?.({ history: histList, favorites: favList });
      alert(`已导入 ${merged.length} 条历史记录`);
    } catch (err) {
      console.error('导入历史失败:', err);
      alert('导入失败：' + String(err));
    }
  });
  window.electronAPI.onClearAllHistory?.(async () => {
    try {
      await saveHistory([]);
      // 刷新面板
      const histList = await loadHistory();
      const favList = await loadFavorites();
      window.electronAPI.sendHistoryData?.({ history: histList, favorites: favList });
    } catch (_) {}
  });
  
  // Favorites 导出/导入/清空
  window.electronAPI.onExportFavorites?.(async () => {
    try { await exportFavorites(); } catch (_) {}
  });
  window.electronAPI.onImportFavorites?.(async () => {
    try {
      await importFavorites();
      // 刷新面板
      const list = await loadFavorites();
      window.electronAPI.sendFavoritesData?.({ favorites: list });
    } catch (_) {}
  });
  window.electronAPI.onImportFavoritesData?.(async (importedData) => {
    try {
      console.log('[Import] 收到收藏导入数据:', importedData?.length || 0, '条');
      if (!Array.isArray(importedData)) return;
      // 直接覆盖导入
      const merged = importedData.slice(0, 500);
      await saveFavorites(merged);
      const list = await loadFavorites();
      window.electronAPI.sendFavoritesData?.({ favorites: list });
      alert(`已导入 ${merged.length} 条收藏`);
    } catch (err) {
      console.error('导入收藏失败:', err);
      alert('导入失败：' + String(err));
    }
  });
  window.electronAPI.onClearAllFavorites?.(async () => {
    try {
      await saveFavorites([]);
      // 刷新面板
      const list = await loadFavorites();
      window.electronAPI.sendFavoritesData?.({ favorites: list });
    } catch (_) {}
  });
}

// Tab 键切换：监听主进程的切换请求
if (IS_ELECTRON && window.electronAPI && window.electronAPI.onCycleProvider) {
  window.electronAPI.onCycleProvider((data) => {
    // 根据目标侧（left/right）进行切换，默认 left
    const dir = (data && typeof data.dir === 'number') ? data.dir : 1;
    const side = (data && data.side) || 'left';
    const step = dir >= 0 ? 1 : -1;
    setActiveSide(side);
    if (side === 'third') {
      if (window.__AIPanelCycleProviderThird) window.__AIPanelCycleProviderThird(step);
      else if (window.__AIPanelCycleProviderRight) window.__AIPanelCycleProviderRight(step);
      else if (window.__AIPanelCycleProvider) window.__AIPanelCycleProvider(step);
    } else if (side === 'right') {
      if (window.__AIPanelCycleProviderRight) window.__AIPanelCycleProviderRight(step);
      else if (window.__AIPanelCycleProvider) window.__AIPanelCycleProvider(step);
    } else {
      if (window.__AIPanelCycleProvider) window.__AIPanelCycleProvider(step);
    }
  });
}

// 当应用获得焦点/显示时，尽力把光标送回到当前 provider 的输入框
(function initFocusRecovery(){
  try {
    const enabled = (()=>{ try { const v = localStorage.getItem('insidebar_focus_on_activate'); return v === null || v === '1'; } catch(_) { return true; } })();
    if (!enabled) return;
    const stickyRefocus = (ms) => {
      try {
        const dur = Math.max(120, Math.min(1500, Number(ms) || Number(localStorage.getItem('insidebar_sticky_focus_ms')) || 480));
        const step = 90; const n = Math.ceil(dur/step);
        // 1) BrowserView 模式：请求主进程在 Provider 页内直接 focus 提示输入框
        if (IS_ELECTRON && window.electronAPI?.focusPrompt) {
          for (let i=0;i<n;i++) setTimeout(()=>{ try { window.electronAPI.focusPrompt(); } catch (_) {} }, i*step);
        }
        // 2) iframe/webview 模式：postMessage 触发 focus
        try {
          const iframeContainer = document.getElementById('iframe');
          const target = iframeContainer?.querySelector('[data-provider]:not([style*="display: none"])');
          if (target && target.contentWindow) {
            const poke = () => { try { target.contentWindow.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*'); } catch(_){} };
            for (let i=0;i<n;i++) setTimeout(poke, i*step);
          }
        } catch (_) {}
      } catch (_) {}
    };
    if (IS_ELECTRON && window.electronAPI) {
      window.electronAPI.onAppFocus?.(()=> stickyRefocus());
      window.electronAPI.onAppVisibility?.((p)=>{ if (p && p.state === 'shown') stickyRefocus(); });
    }
  } catch (_) {}
})();

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

  let __lastRouteInsertAt = 0;
  let __lastRouteInsertTextHash = '';
  function routeInsertText(msg) {
    try {
      // 🔍 调试日志：记录插入文本的开始
      console.log('[INSERT_TEXT] 开始插入文本，时间戳:', Date.now());
      
      // 🔍 参考 Full-screen-prompt 项目：不操作窗口焦点，只操作编辑器焦点
      // 简单去抖：500ms 内重复相同内容不再重复注入
      const text = String(msg && msg.text || '');
      const now = Date.now();
      const hash = (()=>{ try { return String(text).slice(0,64)+'#'+text.length; } catch(_) { return String(text).length; }})();
      if (now - __lastRouteInsertAt < 500 && hash === __lastRouteInsertTextHash) {
        console.log('[INSERT_TEXT] 去抖跳过，距离上次插入:', now - __lastRouteInsertAt, 'ms');
        return;
      }
      __lastRouteInsertAt = now; __lastRouteInsertTextHash = hash;
      const target = getActiveProviderFrame();
      if (!target || !target.contentWindow) {
        toast('未找到活动的 AI 面板。', 'warn');
        return;
      }
      
      // 🔍 关键修复：参考 Full-screen-prompt，不调用 window.focus()
      // 只通过 postMessage 通知 iframe 内部聚焦编辑器，不改变窗口焦点
      // 这样可以避免窗口焦点变化导致的跳动
      
      // 尽量把焦点转入侧栏与 iframe
      const gentle = (() => {
        try {
          const aggr = localStorage.getItem('insidebar_aggressive_focus') === '1';
          const gentleFlag = localStorage.getItem('insidebar_gentle_focus');
          // 默认采用温和模式；若显式开启 aggressive 则关闭温和
          return aggr ? false : (gentleFlag === '1' || gentleFlag === null);
        } catch (_) { return true; }
      })();
      
      console.log('[INSERT_TEXT] 焦点模式:', gentle ? 'gentle' : 'aggressive');
      
      // 🔍 关键修复：不调用 window.focus()，避免窗口焦点变化
      // 只聚焦 iframe 元素本身，不聚焦窗口
      if (!gentle) {
        console.log('[INSERT_TEXT] 执行焦点操作（aggressive模式，但不操作窗口焦点）');
        // 只聚焦 iframe，不聚焦窗口
        try { target.focus(); console.log('[INSERT_TEXT] target.focus() 调用'); } catch (e) { console.log('[INSERT_TEXT] target.focus() 失败:', e); }
        // 不调用 window.focus() 和 document.body.focus()
        // 不调用 target.contentWindow.focus()，因为这可能导致窗口焦点变化
      }
      
      // 追加并要求聚焦（通过 postMessage，让 iframe 内部处理焦点）
      target.contentWindow.postMessage({ type: 'AI_SIDEBAR_INSERT', text: msg.text || '', mode: 'append', focus: true }, '*');

      // 多次尝试确保焦点最终在输入框（处理面板刚打开或站点懒加载）
      const pokeFocus = () => {
        try {
          console.log('[INSERT_TEXT] pokeFocus 调用，时间戳:', Date.now());
          // 只聚焦 iframe，不聚焦窗口
          target.focus();
          target.contentWindow?.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*');
        } catch (e) {
          console.log('[INSERT_TEXT] pokeFocus 失败:', e);
        }
      };
      
      if (!gentle) {
        console.log('[INSERT_TEXT] 安排多次 pokeFocus（aggressive模式）:', [40, 120, 240, 420, 700]);
        [40, 120, 240, 420, 700].forEach((ms)=> setTimeout(pokeFocus, ms));
      } else {
        // 温和模式：避免多次抢焦点，降低与提示词悬浮窗的冲突
        // 仅在必要场景轻触一次
        console.log('[INSERT_TEXT] 安排单次 pokeFocus（gentle模式）:', 160);
        setTimeout(pokeFocus, 160);
      }
      
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
      const gentle = (() => {
        try {
          const aggr = localStorage.getItem('insidebar_aggressive_focus') === '1';
          const gentleFlag = localStorage.getItem('insidebar_gentle_focus');
          return aggr ? false : (gentleFlag === '1' || gentleFlag === null);
        } catch (_) { return true; }
      })();
      if (!gentle) {
        try { window.focus(); } catch (_) {}
        try { document.body.tabIndex = -1; document.body.focus(); } catch (_) {}
        try { target.focus(); } catch (_) {}
        try { target.contentWindow.focus(); } catch (_) {}
      } else {
        // 温和模式下不再主动抢系统焦点，仅在 iframe 内部处理
        try { target.focus(); } catch (_) {}
      }
    } catch (e) {
      toast('加载截图失败：' + String(e), 'error');
    }
  }

  // Receive from background in real time
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (!message || !message.type) return;
        if (message.type === 'aisb.request-selection') {
          // 从当前活动的 provider frame 读取选中文本
          try {
            const target = getActiveProviderFrame();
            if (!target || !target.contentWindow) { sendResponse({ ok:false }); return true; }
            const reqId = String(Date.now() + Math.random());
            let done = false;
            const onMsg = (ev) => {
              try {
                const d = ev.data || {};
                if (d && d.type === 'AI_SIDEBAR_SELECTION' && (!d.id || d.id === reqId)) {
                  done = true;
                  window.removeEventListener('message', onMsg);
                  sendResponse({ ok:true, payload:{ text: String(d.text||''), html: String(d.html||'') } });
                }
              } catch (_) {}
            };
            window.addEventListener('message', onMsg);
            try { target.contentWindow.postMessage({ type:'AI_SIDEBAR_GET_SELECTION', id: reqId }, '*'); } catch (_) {}
            // 超时保护
            setTimeout(() => {
              if (!done) {
                try { window.removeEventListener('message', onMsg); } catch (_) {}
                sendResponse({ ok:false });
              }
            }, 250);
            return true; // async response
          } catch (_) {
            sendResponse({ ok:false });
            return true;
          }
        }
        if (message.type === 'aisb.notify') {
          toast(message.text || '', message.level || 'info');
          return;
        }
        if (message.type === 'aisb.insert-text') {
          console.log('[MESSAGE_LISTENER] 收到 aisb.insert-text 消息:', { 
            text_length: message.text?.length || 0,
            mode: message.mode || 'append',
            timestamp: Date.now()
          });
          routeInsertText(message);
          return;
        }
        if (message.type === 'aisb.focus-only') {
          const target = getActiveProviderFrame();
          if (target && target.contentWindow) {
            const gentle = (() => {
              try {
                const aggr = localStorage.getItem('insidebar_aggressive_focus') === '1';
                const gentleFlag = localStorage.getItem('insidebar_gentle_focus');
                return aggr ? false : (gentleFlag === '1' || gentleFlag === null);
              } catch (_) { return true; }
            })();
            if (!gentle) {
              try { window.focus(); } catch (_) {}
              try { document.body.tabIndex = -1; document.body.focus(); } catch (_) {}
              try { target.focus(); } catch (_) {}
              try { target.contentWindow.focus(); } catch (_) {}
            } else {
              try { target.focus(); } catch (_) {}
            }
            try { target.contentWindow.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*'); } catch (_) {}
            const poke = () => { try { target.focus(); target.contentWindow?.postMessage({ type: 'AI_SIDEBAR_FOCUS' }, '*'); } catch (_) {} };
            if (!gentle) {
              [40,120,240,420,700,1000].forEach(ms => setTimeout(poke, ms));
            } else {
              setTimeout(poke, 160);
            }
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
// ============== 搜索功能（现在使用浮动子窗口，由主进程管理）==============
(function initializeSearchBtn() {
  const searchBtn = document.getElementById('searchBtn');
  
  // 工具栏搜索按钮 - 聚焦地址栏
  if (searchBtn) {
    getButtonShortcuts().then(shortcuts => {
      const sc = shortcuts.searchBtn;
      const keys = [];
      if (sc.ctrl) keys.push('Ctrl');
      if (sc.shift) keys.push('Shift');
      if (sc.alt) keys.push('Alt');
      keys.push(sc.key.toUpperCase());
      searchBtn.title = `输入链接 (${keys.join('+')})`;
    });
    
    searchBtn.addEventListener('click', () => {
      setActiveSide('right');
      const addressInput = document.getElementById('addressInput');
      const addressBar = document.getElementById('addressBar');
      
      if (addressBar && addressInput) {
        if (addressBar.style.display === 'none') {
          if (IS_ELECTRON && window.electronAPI) {
            const defaultUrl = 'https://www.google.com';
            window.electronAPI.openEmbeddedBrowser(defaultUrl);
            setActiveSide('right');
            setTimeout(() => {
              if (addressInput) {
                addressInput.focus();
                addressInput.select();
              }
            }, 300);
          }
        } else {
          addressInput.focus();
          addressInput.select();
        }
      }
    });
  }

  dbg('搜索按钮已初始化');
})();

// ============== 与插件目录的文件同步（导入 + 监听） ==============
(async function syncImportFromExternalIfAny(){
  try {
    // 目前扩展和桌面应用的历史与收藏都改为各自独立存储；
    // 不再在 Electron 端通过文件与 Chrome 插件同步，避免互相覆盖或干扰。
    return;
  } catch (_) {}
})();

// ============== Align Modal Functions ==============
function showAlignModal() {
  const modal = document.getElementById('alignModal');
  if (!modal) return;
  
  // 获取所有可用的AI提供商
  const providers = Object.keys(ALL).filter(key => ALL[key] && ALL[key].name);
  
  const providerCheckboxes = providers.map(key => {
    const provider = ALL[key];
    return `
      <div class="provider-checkbox">
        <label>
          <input type="checkbox" value="${key}" data-provider="${key}">
          <span class="provider-name">${provider.name}</span>
        </label>
      </div>
    `;
  }).join('');
  
  modal.innerHTML = `
    <div class="settings-modal-backdrop"></div>
    <div class="settings-modal-content">
      <div class="settings-header">
        <h2>Send to Multiple AIs</h2>
        <button class="settings-close-btn" title="Close">&times;</button>
      </div>
      <div class="settings-body">
        <div class="align-message-input">
          <label for="alignMessage">Message to send:</label>
          <textarea id="alignMessage" placeholder="Enter your message here..." rows="4"></textarea>
        </div>
        <div class="align-providers">
          <label>Select AI providers:</label>
          <div class="providers-list">
            ${providerCheckboxes}
          </div>
        </div>
        <div class="align-actions">
          <button id="alignSendBtn" class="align-send-btn">Send to Selected AIs</button>
        </div>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  
  const closeBtn = modal.querySelector('.settings-close-btn');
  const backdrop = modal.querySelector('.settings-modal-backdrop');
  const sendBtn = modal.querySelector('#alignSendBtn');
  const messageInput = modal.querySelector('#alignMessage');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  
  // 发送消息到选中的AI
  sendBtn.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    if (!message) {
      alert('Please enter a message to send.');
      return;
    }
    
    const selectedProviders = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedProviders.length === 0) {
      alert('Please select at least one AI provider.');
      return;
    }
    
    // 发送消息到选中的提供商
    await sendMessageToProviders(message, selectedProviders);
    closeModal();
  });
  
  // 自动聚焦到消息输入框
  setTimeout(() => {
    messageInput.focus();
  }, 100);
};

async function sendMessageToProviders(message, providerKeys) {
  for (const providerKey of providerKeys) {
    try {
      // 切换到对应的提供商
      await setProvider(providerKey);
      
      // 等待一下让页面加载
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 发送消息（Electron：注入并自动发送）
      if (IS_ELECTRON && window.electronAPI?.injectAndSend) {
        await window.electronAPI.injectAndSend(message);
      } else if (IS_ELECTRON && window.electronAPI?.injectText) {
        // 兼容旧版本：仅注入文本
        await window.electronAPI.injectText(message);
      }
      
      // 等待一下再切换到下一个
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Failed to send message to ${providerKey}:`, error);
    }
  }
};

// ============== 移除窗口尺寸调试显示 ==============
(function removeSizeIndicator() {
  try {
    const removeIndicator = () => {
      const indicator = document.getElementById('window-size-indicator');
      if (indicator) {
        indicator.remove();
      }
    };
    // 页面加载时移除
    removeIndicator();
    // 定期检查并移除（防止其他代码重新添加）
    setInterval(removeIndicator, 500);
  } catch (_) {}
})();

// ====================================================================================
// 覆盖模式背景处理（截图伪装）
// ====================================================================================
try {
  if (window.electronAPI && window.electronAPI.onOverlayBackground) {
    window.electronAPI.onOverlayBackground((images) => {
      console.log('[Overlay] Received background images:', images);
      
      // 获取或创建背景容器
      let bg = document.getElementById('overlay-fake-bg');
      if (!bg) {
        bg = document.createElement('div');
        bg.id = 'overlay-fake-bg';
        // 放在 body 最底层
        bg.style.position = 'fixed';
        bg.style.inset = '0';
        bg.style.zIndex = '0'; // 确保在工具栏(z=100)之下，在面板(z=2147483646)之下
        bg.style.pointerEvents = 'none';
        bg.style.display = 'flex';
        bg.style.backgroundColor = '#ffffff'; // 默认底色
        document.body.insertBefore(bg, document.body.firstChild);
      }
      
      bg.innerHTML = '';
      bg.style.display = 'flex';

      // 辅助函数：添加图片块
      const addImg = (dataUrl, flexGrow) => {
        const div = document.createElement('div');
        div.style.flex = flexGrow + ' 1 0';
        div.style.height = '100%';
        div.style.position = 'relative';
        div.style.overflow = 'hidden';
        
        if (dataUrl) {
          div.style.backgroundImage = `url(${dataUrl})`;
          div.style.backgroundSize = 'cover'; // 使用 cover 或 100% 100%
          // 对于 BrowserView capturePage，通常是整个可见区域，所以用 100% 100% 可能更准确
          div.style.backgroundSize = '100% 100%'; 
          div.style.backgroundPosition = 'left top';
          div.style.backgroundRepeat = 'no-repeat';
        } else {
          div.style.backgroundColor = '#ffffff'; // 占位白底
        }
        bg.appendChild(div);
      };

      const hasLeft = !!images.left;
      const hasRight = !!images.right;
      const hasThird = !!images.third;

      // 根据图片数量推断布局
      if (hasThird) {
        // 三分屏：假设各占 1/3 (实际可能有自定义比例，但截图通常是按 View 截的)
        // TODO: 如果能获取 split ratios 更好，但这里为了简化直接均分或按截图比例？
        // BrowserView 的 capturePage 返回的是该 View 的全部内容。
        // 如果我们用 flex: 1，它们会均分屏幕。如果之前是 30%/70% 布局，这里会变成 50%/50% 导致变形。
        // 这是一个瑕疵。
        // 改进：使用 flex-basis 和之前的比例。
        // 但我们无法轻易获取比例。
        // 暂时使用 flex: 1，对于大多数用户（50/50）是正确的。
        addImg(images.left, 1);
        addImg(images.right, 1);
        addImg(images.third, 1);
      } else if (hasRight) {
        // 二分屏
        addImg(images.left, 1);
        addImg(images.right, 1);
      } else {
        // 单屏
        addImg(images.left, 1);
      }
    });

    // 监听覆盖模式退出，清除背景
    if (window.electronAPI.onOverlayState) {
      window.electronAPI.onOverlayState((state) => {
        if (state && state.action === 'exit' && state.depth === 0) {
          const bg = document.getElementById('overlay-fake-bg');
          if (bg) {
            bg.style.display = 'none';
            bg.innerHTML = ''; // 释放内存
          }
        }
      });
    }
  }
} catch (err) {
  console.error('[Overlay] Setup error:', err);
}

