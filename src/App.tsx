/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Chrome, 
  BookOpen, 
  ShieldCheck, 
  Layout, 
  Keyboard, 
  Search, 
  Menu, 
  X, 
  Github, 
  MessageSquare, 
  Code, 
  Star,
  Send,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CHROME_STORE_URL = '#'; // TODO: Replace with actual Chrome Web Store URL
const APP_DOWNLOAD_URL = '#'; // TODO: Replace with actual App download URL
const GITHUB_URL = 'https://github.com/ymx94yyds/ai-sidebar';

const providers = [
  { name: 'ChatGPT', type: 'AI Chat', icon: '/providers/chatgpt.png' },
  { name: 'Claude', type: 'AI Chat', icon: '/providers/claude.png' },
  { name: 'Gemini', type: 'AI Chat', icon: '/providers/gemini.png' },
  { name: 'DeepSeek', type: 'AI Chat', icon: '/providers/deepseek.png' },
  { name: 'Grok', type: 'AI Chat', icon: '/providers/grok.png' },
  { name: 'Perplexity', type: 'AI Search', icon: '/providers/perplexity.png' },
  { name: 'Doubao', type: 'AI Chat', icon: '/providers/doubao.png' },
  { name: 'Tongyi', type: 'AI Chat', icon: '/providers/tongyi.png' },
];

const features = [
  {
    title: 'One Sidebar, Many AI',
    desc: 'Keep 11 AI tools in one side panel and leave tab chaos behind.',
    icon: Layout,
  },
  {
    title: 'Instant Tab Cycling',
    desc: 'Switch assistants with keyboard shortcuts instead of hunting with a mouse.',
    icon: Keyboard,
  },
  {
    title: 'Prompt Library',
    desc: 'Save reusable prompts and manage imports or exports in one place.',
    icon: BookOpen,
  },
  {
    title: 'Privacy First',
    desc: 'Data stays in your browser and you sign in with your own accounts.',
    icon: ShieldCheck,
  },
];

const faqs = [
  { q: 'Do I need a VPN?', a: 'The extension itself does not require one, but services such as ChatGPT or Claude may require your own network access.' },
  { q: 'Do I need an API key?', a: 'No. Sign in with your existing accounts. No extra API budget is required.' },
  { q: 'Does it support mobile?', a: 'It is currently optimized for Chrome and Edge desktop browsers.' },
  { q: 'Is there any account risk?', a: 'It works like opening the official web apps in a new tab, except inside a side panel.' },
];

type ModalContent = 'privacy' | 'terms' | 'contact' | 'developer';

const MODAL_PATHS: Record<ModalContent, string> = {
  privacy: '/privacy',
  terms: '/terms',
  contact: '/contact',
  developer: '/developer',
};

const PATH_TO_MODAL = Object.fromEntries(
  Object.entries(MODAL_PATHS).map(([key, value]) => [value, key as ModalContent])
) as Record<string, ModalContent>;

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % providers.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncModalFromPath = () => {
      const nextModal = PATH_TO_MODAL[window.location.pathname] || null;
      setModalContent(nextModal);
    };

    syncModalFromPath();
    window.addEventListener('popstate', syncModalFromPath);
    return () => window.removeEventListener('popstate', syncModalFromPath);
  }, []);

  useEffect(() => {
    const nextPath = modalContent ? MODAL_PATHS[modalContent] : '/';
    if (window.location.pathname === nextPath) return;
    window.history.replaceState({}, '', nextPath);
  }, [modalContent]);

  useEffect(() => {
    document.body.style.overflow = modalContent ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalContent]);

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-black/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="AI Sidebar" className="w-7 h-7" />
              <span className="text-lg font-bold tracking-tight">AI Sidebar</span>
            </div>
            
            <div className="hidden md:flex items-center gap-10">
              <a href="#features" className="text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors">Features</a>
              <a href="#providers" className="text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors">Providers</a>
              <a href="#faq" className="text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors">FAQ</a>
              <div className="flex items-center gap-3">
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-6 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2 no-underline">
                  <Chrome size={14} />
                  Add to Chrome
                </a>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-6 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2 no-underline">
                  <Download size={14} />
                  Download App
                </a>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/10 px-6 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2 no-underline">
                  GitHub <Github size={14} />
                </a>
              </div>
            </div>

            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
        
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden bg-white border-b border-black/5 overflow-hidden"
            >
              <div className="px-6 py-8 space-y-6">
                <a href="#features" onClick={() => setIsMenuOpen(false)} className="block text-sm font-bold uppercase tracking-widest">Features</a>
                <a href="#providers" onClick={() => setIsMenuOpen(false)} className="block text-sm font-bold uppercase tracking-widest">Providers</a>
                <a href="#faq" onClick={() => setIsMenuOpen(false)} className="block text-sm font-bold uppercase tracking-widest">FAQ</a>
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="block w-full bg-white text-black border border-black/20 py-4 rounded font-bold text-xs uppercase tracking-widest text-center no-underline">Add to Chrome</a>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="block w-full bg-white text-black border border-black/20 py-4 rounded font-bold text-xs uppercase tracking-widest text-center no-underline">Download App</a>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="block w-full bg-white text-black border border-black/10 py-4 rounded font-bold text-xs uppercase tracking-widest text-center no-underline">GitHub</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-32 pb-24 md:pt-36">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center"
            >
              <div className="mb-8 flex items-center justify-center gap-2">
                <div className="h-[1px] w-8 bg-black"></div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Browser Productivity</span>
              </div>
              <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-black mb-8 leading-[0.9]">
                One Sidebar <br />
                <span className="text-black/20">for Every AI Workflow</span>
              </h1>
              <p className="mx-auto mb-12 max-w-xl text-lg leading-relaxed text-black/60">
                Use ChatGPT, Claude, Gemini, DeepSeek, and 11+ leading AI tools in one place. Skip tab switching, cycle with the Tab key, and turn your browser into a focused workstation.
              </p>
              
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
                  <Chrome size={18} />
                  Add to Chrome
                </a>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
                  <Download size={18} />
                  Download App
                </a>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/10 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
                  GitHub <Github size={18} />
                </a>
              </div>
            </motion.div>
          </div>

          {/* 双产品并排展示 */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* 左侧：Chrome 扩展版 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Chrome size={16} className="text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Chrome Extension</span>
              </div>
              <div className="border border-black/5 rounded-2xl overflow-hidden bg-slate-50 p-1 shadow-xl shadow-black/5">
                {/* 浏览器顶栏 */}
                <div className="bg-slate-100 rounded-t-xl px-3 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 mx-2 bg-white rounded-md px-3 py-1 text-[9px] text-slate-400 truncate">example.com/article/how-to-learn</div>
                </div>
                <div className="bg-white rounded-b-xl overflow-hidden flex" style={{ height: '340px' }}>
                  {/* 网页内容区 */}
                  <div className="flex-1 p-8 flex flex-col justify-center">
                    <div className="w-10 h-10 bg-black/5 rounded-full mb-6"></div>
                    <div className="space-y-3 max-w-xs">
                      <div className="h-2 w-full bg-black/5 rounded-full"></div>
                      <div className="h-2 w-5/6 bg-black/5 rounded-full"></div>
                      <div className="h-2 w-4/6 bg-black/5 rounded-full"></div>
                      <div className="h-2 w-3/6 bg-black/5 rounded-full"></div>
                    </div>
                  </div>
                  {/* 侧边栏面板 */}
                  <div className="w-[200px] border-l border-slate-100 bg-white flex flex-col">
                    <div className="h-8 border-b border-slate-100 flex items-center justify-between px-2 bg-white">
                      <span className="text-[9px] font-bold text-slate-700">AI Panel</span>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-slate-50 flex items-center justify-center text-slate-400 text-[8px]">✏️</div>
                        <div className="w-4 h-4 rounded bg-slate-50 flex items-center justify-center text-slate-400 text-[8px]">↗</div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden p-2 space-y-2 text-[8px] text-slate-600 leading-relaxed">
                      <p className="font-bold text-[9px]">3. Pursue Mastery and Healthy Competition</p>
                      <ul className="list-disc pl-3 space-y-1">
                        <li><span className="font-semibold">Mastery creates momentum:</span> Go deep in a niche and let competence compound.</li>
                        <li><span className="font-semibold">Competition sharpens judgment:</span> Good pressure removes complacency and pushes better work.</li>
                      </ul>
                    </div>
                    <div className="p-1.5 border-t border-slate-100">
                      <div className="bg-slate-50 rounded px-2 py-1 text-[8px] text-slate-400">Message {providers[activeTab].name}</div>
                    </div>
                  </div>
                  {/* 右侧小图标栏 */}
                  <div className="w-8 border-l border-slate-100 flex flex-col items-center py-2 gap-1 bg-slate-50/50">
                    {providers.slice(0, 5).map((p, i) => (
                      <div key={p.name} className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${i === activeTab % 5 ? 'ring-1 ring-blue-400 bg-blue-50' : ''}`}>
                        <img src={p.icon} alt={p.name} className="w-3.5 h-3.5 rounded object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：桌面应用版 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layout size={16} className="text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Desktop App</span>
              </div>
              <div className="border border-black/5 rounded-2xl overflow-hidden bg-slate-50 p-1 shadow-xl shadow-black/5">
                {/* 桌面应用顶栏 */}
                <div className="bg-slate-800 rounded-t-xl px-3 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-[10px] text-white/60 font-medium">AI Sidebar</span>
                  </div>
                </div>
                <div className="bg-white rounded-b-xl overflow-hidden flex" style={{ height: '340px' }}>
                  {/* 左侧 AI 导轨（桌面版更大） */}
                  <div className="w-12 border-r border-slate-100 flex flex-col items-center py-3 gap-2 bg-slate-50">
                    {providers.map((p, i) => (
                      <div key={p.name} className="relative">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                          i === activeTab 
                            ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' 
                            : 'bg-white hover:bg-slate-100'
                        }`}>
                          <img src={p.icon} alt={p.name} className="w-5 h-5 rounded object-contain" />
                        </div>
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-4 rounded-r-full transition-all ${i === activeTab ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                      </div>
                    ))}
                    <div className="mt-auto">
                      <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white cursor-pointer shadow-md shadow-blue-500/20">
                        <span className="text-sm">⚙️</span>
                      </div>
                    </div>
                  </div>

                  {/* 主聊天面板 */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="h-9 border-b border-slate-100 flex items-center justify-between px-3 bg-white">
                      <div className="flex items-center gap-2">
                        <img src={providers[activeTab].icon} alt={providers[activeTab].name} className="w-5 h-5 rounded object-contain" />
                        <span className="text-xs font-bold text-slate-800">{providers[activeTab].name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">✏️</div>
                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">↗</div>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-[7px] font-bold ring-2 ring-white">可</div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden p-4 space-y-3 text-[10px] text-slate-700 leading-relaxed">
                      <p>Unlike a short burst of novelty, mastery creates long-term confidence and durable momentum. <span className="text-blue-500 text-[8px]">🔗</span></p>
                      <div>
                        <p className="font-bold text-xs mb-1.5">3. Pursue Extreme Mastery and Competition</p>
                        <ul className="list-disc pl-3 space-y-1.5">
                          <li><span className="font-semibold">Mastery as fuel:</span> Ambitious people crave challenge, and mastery turns that energy into momentum. <span className="text-blue-500 text-[8px]">🔗 +1</span></li>
                          <li><span className="font-semibold">Competitive awareness:</span> Competition filters out mediocrity and pushes strong performers forward. <span className="text-blue-500 text-[8px]">🔗</span></li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold text-xs mb-1.5">4. Stay Hungry and Self-Disciplined</p>
                        <ul className="list-disc pl-3 space-y-1.5">
                          <li><span className="font-semibold">Constraint drives creativity:</span> Scarcity often forces better systems, sharper thinking, and more deliberate work.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="p-2.5 border-t border-slate-100">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 flex-1">Message {providers[activeTab].name}</span>
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <Send size={10} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 border-t border-black/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
            {features.map((f, i) => (
              <div key={f.title} className="group">
                <div className="mb-8 text-black/20 group-hover:text-black transition-colors">
                  <f.icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">{f.title}</h3>
                <p className="text-sm text-black/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Providers Section */}
      <section id="providers" className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-24 items-start">
            <div className="lg:w-1/3">
              <h2 className="text-4xl font-bold tracking-tighter mb-8">Support for 11+ Leading AI Providers</h2>
              <p className="text-black/50 text-sm leading-relaxed mb-10">
                Move between Claude for coding, ChatGPT for general work, Gemini for multimodal tasks, DeepSeek for research, and more without leaving the page you are on.
              </p>
              <div className="flex flex-wrap gap-2">
                {['GPT-4o', 'Claude 3.5', 'Gemini 1.5 Pro', 'DeepSeek-V3'].map(tag => (
                  <span key={tag} className="px-3 py-1 border border-black/10 rounded text-[10px] font-bold uppercase tracking-widest text-black/40">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="lg:w-2/3 grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/5 border border-black/5 overflow-hidden rounded-xl">
              {providers.map((p, i) => (
                <div 
                  key={p.name}
                  className="group bg-white p-10 flex flex-col items-center text-center hover:bg-slate-50 transition-colors"
                >
                  <img src={p.icon} alt={p.name} className="w-10 h-10 mb-4 object-contain group-hover:scale-110 transition-all" />
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{p.name}</span>
                  <span className="text-[9px] text-black/30 uppercase tracking-tighter">{p.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* User Personas */}
      <section className="py-32 border-t border-black/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            <div className="space-y-6">
              <div className="text-black/20"><Code size={24} /></div>
              <h4 className="text-xs font-bold uppercase tracking-widest">Developers</h4>
              <p className="text-sm text-black/50 leading-relaxed italic">"Tab switching used to break my flow. Now I draft in GPT and jump to Claude for review in seconds."</p>
            </div>
            <div className="space-y-6">
              <div className="text-black/20"><MessageSquare size={24} /></div>
              <h4 className="text-xs font-bold uppercase tracking-widest">Creators</h4>
              <p className="text-sm text-black/50 leading-relaxed italic">"I compare answers from ChatGPT and Claude side by side and keep my best prompts ready to reuse."</p>
            </div>
            <div className="space-y-6">
              <div className="text-black/20"><Search size={24} /></div>
              <h4 className="text-xs font-bold uppercase tracking-widest">Researchers</h4>
              <p className="text-sm text-black/50 leading-relaxed italic">"Saved conversations stay local, so I can revisit important threads without giving up control of my workflow."</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-32 bg-white border-t border-black/5">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold tracking-tighter text-center mb-16 uppercase tracking-[0.2em]">Comparison</h2>
          <div className="border border-black/5 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-black/5">
                  <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-black/40">Feature</th>
                  <th className="p-6 text-[10px] font-bold uppercase tracking-widest">AI Sidebar</th>
                  <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-black/20">Other Aggregators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {[
                  ['Sign-in', 'Your own account (cookies)', 'Requires API or subscription'],
                  ['Privacy', 'Local-first storage', 'Partial cloud storage'],
                  ['Connection Path', 'Direct official web apps', 'Relayed proxy access'],
                  ['Cost', 'Use your existing accounts', 'Recurring subscription cost'],
                ].map(([label, val1, val2]) => (
                  <tr key={label}>
                    <td className="p-6 text-[11px] font-bold uppercase tracking-widest text-black/40">{label}</td>
                    <td className="p-6 text-[11px] font-medium">{val1}</td>
                    <td className="p-6 text-[11px] text-black/30">{val2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-32 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold tracking-tighter text-center mb-16 uppercase tracking-[0.2em]">FAQ</h2>
          <div className="space-y-px bg-black/5 border border-black/5 overflow-hidden rounded-lg">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white p-8">
                <h4 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-4">
                  <span className="text-black/20">0{i+1}</span>
                  {faq.q}
                </h4>
                <p className="text-sm text-black/40 leading-relaxed pl-10">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-12">Ready to Work Faster?</h2>
          <p className="text-black/40 text-lg mb-16 max-w-xl mx-auto">
            Join 10,000+ power users who want faster AI access, fewer context switches, and a cleaner way to work across multiple assistants.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
              <Chrome size={18} />
              Add to Chrome
            </a>
            <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
              <Download size={18} />
              Download App
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/10 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
              GitHub <Github size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 font-bold mb-6 md:mb-0">
            <img src="/logo.png" alt="AI Sidebar" className="w-6 h-6" />
            <span>aibar.xin</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-neutral-500">
            <button onClick={() => setModalContent('privacy')} className="hover:text-black transition-colors">Privacy Policy</button>
            <button onClick={() => setModalContent('terms')} className="hover:text-black transition-colors">Terms of Service</button>
            <button onClick={() => setModalContent('contact')} className="hover:text-black transition-colors">Contact</button>
            <button onClick={() => setModalContent('developer')} className="hover:text-black transition-colors">Developer</button>
          </div>
          <p className="mt-8 md:mt-0 text-sm text-neutral-400">
            © 2025-2026 aibar.xin. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Modal */}
      <AnimatePresence>
        {modalContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] overflow-y-auto bg-black/70"
            onClick={() => setModalContent(null)}
          >
            <div className="min-h-full px-4 py-6 sm:px-6 sm:py-10">
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 24 }}
              className="relative mx-auto w-full max-w-3xl rounded-[28px] border border-black/10 bg-white p-6 text-black shadow-2xl sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-8 flex items-center justify-between gap-4 border-b border-black/10 pb-5">
                <h3 className="text-lg font-bold tracking-tight">
                  {modalContent === 'developer' && 'Developer'}
                  {modalContent === 'privacy' && 'Privacy Policy'}
                  {modalContent === 'terms' && 'Terms of Service'}
                  {modalContent === 'contact' && 'Contact'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalContent(null)}
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-black"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
              {modalContent === 'developer' && (
                <>
                  <div className="space-y-2 border-b border-black/10 pb-4">
                    <p className="text-base font-semibold text-black">vibe coder: Kexin</p>
                    <p>
                      AI Sidebar is a unified AI side panel I built to bring ChatGPT, Claude, Gemini, and 11+ leading AI tools into one workspace without constant tab switching.
                    </p>
                  </div>

                  <div className="space-y-2 border-b border-black/10 pb-4">
                    <p className="font-medium text-black">Other Projects</p>
                    <div className="flex flex-col gap-2">
                      <a href="https://iterate.xin" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">iterate.xin</a>
                      <a href="https://relearn.xin" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">relearn.xin</a>
                      <a href="https://tobooks.xin" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">tobooks.xin</a>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-black">Contact</p>
                    <p>Email: ymx94yyds@qq.com</p>
                    <p>WeChat: ymx94yyds</p>
                  </div>
                </>
              )}
              
              {modalContent === 'privacy' && (
                <>
                    <p className="text-xs text-zinc-400 mb-3">Last updated: April 11, 2026</p>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">Data We Process</p>
                      <p>AI Sidebar processes data locally in the user's browser to provide the side panel experience. This may include settings and preferences, saved history and favorites, authentication state derived from cookies on supported services, selected text or screenshots that the user intentionally sends to the sidebar, and conversation content that the user chooses to save or export.</p>
                    </div>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">Third-Party Services</p>
                      <p>When users open or interact with third-party AI services such as ChatGPT, Claude, Gemini, and other supported providers, user inputs and related content are sent directly from the user's browser to those third-party services and are governed by those services' own terms and privacy policies.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">Storage and Security</p>
                      <p>Most extension data is stored locally in the browser. We do not sell user data or send core extension data to our own remote servers. If optional local sync features are enabled, history or favorites may be transferred to a local service running on the user's device.</p>
                    </div>
                </>
              )}
              
              {modalContent === 'terms' && (
                <>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">License</p>
                      <p>AI Sidebar is provided as a free tool. You may use the extension freely, but not for unlawful purposes.</p>
                    </div>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">Disclaimer</p>
                      <p>This extension is provided on an &quot;as is&quot; basis without express or implied warranties. You assume the risks of using it.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">Third-Party Services</p>
                      <p>You are responsible for complying with the terms of each AI service provider. We are not responsible for the availability or content of third-party services.</p>
                    </div>
                </>
              )}
              
              {modalContent === 'contact' && (
                <>
                    <p>If you have any questions, feedback, or partnership inquiries, reach out through:</p>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p>Email: ymx94yyds@qq.com</p>
                      <p>WeChat: ymx94yyds</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">GitHub</p>
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">{GITHUB_URL}</a>
                    </div>
                </>
              )}
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
