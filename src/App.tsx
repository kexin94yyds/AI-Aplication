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
  { name: 'iterate', type: 'AI对话', icon: '/providers/iterate.png' },
  { name: 'relearn', type: '知识管理', icon: '/providers/relearn.png' },
  { name: 'tobooks', type: '图书工具', icon: '/providers/tobooks.png' },
  { name: 'gemini-voyager', type: '浏览器扩展', icon: '/providers/gemini-voyager.png' },
];

const features = [
  {
    title: '一栏多用',
    desc: '11个AI在一个侧边栏，告别标签页混乱。',
    icon: Layout,
  },
  {
    title: 'Tab秒切',
    desc: '键盘快捷键切换，比鼠标快10倍。',
    icon: Keyboard,
  },
  {
    title: 'Prompt库',
    desc: '50+预设Prompt，支持自定义导入导出。',
    icon: BookOpen,
  },
  {
    title: '隐私优先',
    desc: '数据不出浏览器，使用自有账号登录。',
    icon: ShieldCheck,
  },
];

const faqs = [
  { q: '需要翻墙吗？', a: '插件本身不需要，但访问 ChatGPT/Claude 等需要你自己有网络条件。' },
  { q: '需要买 API 吗？', a: '不需要，用你自己现有的账号登录即可，无需额外支出。' },
  { q: '支持手机吗？', a: '目前主要支持 Chrome/Edge 桌面版浏览器扩展。' },
  { q: '会被封号吗？', a: '原理和开新标签页一样，只是在 iframe 中加载，风险极低。' },
];

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [modalContent, setModalContent] = useState<'privacy' | 'terms' | 'contact' | 'developer' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % providers.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
              <a href="#features" className="text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors">核心功能</a>
              <a href="#providers" className="text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors">AI支持</a>
              <a href="#faq" className="text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors">常见问题</a>
              <div className="flex items-center gap-3">
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-6 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2 no-underline">
                  <Chrome size={14} />
                  添加到 Chrome
                </a>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-6 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2 no-underline">
                  <Download size={14} />
                  下载应用
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
                <a href="#features" onClick={() => setIsMenuOpen(false)} className="block text-sm font-bold uppercase tracking-widest">核心功能</a>
                <a href="#providers" onClick={() => setIsMenuOpen(false)} className="block text-sm font-bold uppercase tracking-widest">AI支持</a>
                <a href="#faq" onClick={() => setIsMenuOpen(false)} className="block text-sm font-bold uppercase tracking-widest">常见问题</a>
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="block w-full bg-white text-black border border-black/20 py-4 rounded font-bold text-xs uppercase tracking-widest text-center no-underline">添加到 Chrome</a>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="block w-full bg-white text-black border border-black/20 py-4 rounded font-bold text-xs uppercase tracking-widest text-center no-underline">下载应用</a>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="block w-full bg-white text-black border border-black/10 py-4 rounded font-bold text-xs uppercase tracking-widest text-center no-underline">GitHub</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-2 mb-8">
                <div className="h-[1px] w-8 bg-black"></div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Efficiency Tool</span>
              </div>
              <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-black mb-8 leading-[0.9]">
                一个侧边栏 <br />
                <span className="text-black/20">管理所有 AI</span>
              </h1>
              <p className="text-lg text-black/60 max-w-xl mb-12 leading-relaxed">
                聚合 ChatGPT, Claude, Gemini 等 11+ 主流 AI。不用切标签页，Tab 键秒切，让你的浏览器变身超级工作站。
              </p>
              
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
                  <Chrome size={18} />
                  添加到 Chrome
                </a>
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
                  <Download size={18} />
                  下载应用
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
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Chrome 扩展</span>
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
                      <p className="font-bold text-[9px]">3. 追求精通与竞争</p>
                      <ul className="list-disc pl-3 space-y-1">
                        <li><span className="font-semibold">精通带来动力：</span>通过在细分领域追求精通，获得驱动力。</li>
                        <li><span className="font-semibold">竞争意识：</span>竞争能淘汰平庸，激发进步。</li>
                      </ul>
                    </div>
                    <div className="p-1.5 border-t border-slate-100">
                      <div className="bg-slate-50 rounded px-2 py-1 text-[8px] text-slate-400">给 {providers[activeTab].name} 发消息</div>
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
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">桌面应用</span>
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
                    <span className="text-[10px] text-white/60 font-medium">AI 全家桶</span>
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
                      <p>精带来的短暂快感相反，能带来长期的强大感和成就感。 <span className="text-blue-500 text-[8px]">🔗</span></p>
                      <div>
                        <p className="font-bold text-xs mb-1.5">3. 追求极致的精通与竞争</p>
                        <ul className="list-disc pl-3 space-y-1.5">
                          <li><span className="font-semibold">精通带来的动力：</span>他认为年轻人天生渴望竞争，通过追求"精通"获得驱动力。 <span className="text-blue-500 text-[8px]">🔗 +1</span></li>
                          <li><span className="font-semibold">竞争意识：</span>竞争能淘汰平庸，激发成功者不断进步。 <span className="text-blue-500 text-[8px]">🔗</span></li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold text-xs mb-1.5">4. 保持"匮乏感"与自我约束</p>
                        <ul className="list-disc pl-3 space-y-1.5">
                          <li><span className="font-semibold">匮乏激发创造力：</span>童年物质稀缺迫使他去创造...</li>
                        </ul>
                      </div>
                    </div>

                    <div className="p-2.5 border-t border-slate-100">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 flex-1">给 {providers[activeTab].name} 发消息</span>
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
              <h2 className="text-4xl font-bold tracking-tighter mb-8">支持 11+ 主流 AI 提供商</h2>
              <p className="text-black/50 text-sm leading-relaxed mb-10">
                无论是写代码最强的 Claude，还是全能的 ChatGPT，亦或是国产之光 DeepSeek，你都可以在一个侧边栏中无缝使用。
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
              <h4 className="text-xs font-bold uppercase tracking-widest">程序员</h4>
              <p className="text-sm text-black/50 leading-relaxed italic">"切标签页太麻烦了。现在我用 GPT 写代码，Tab 键秒切到 Claude 审代码，效率起飞。"</p>
            </div>
            <div className="space-y-6">
              <div className="text-black/20"><MessageSquare size={24} /></div>
              <h4 className="text-xs font-bold uppercase tracking-widest">内容创作者</h4>
              <p className="text-sm text-black/50 leading-relaxed italic">"同一个问题问 ChatGPT 和 Claude 对比答案，Prompt 库里存了 50 多个常用提示词，太方便了。"</p>
            </div>
            <div className="space-y-6">
              <div className="text-black/20"><Search size={24} /></div>
              <h4 className="text-xs font-bold uppercase tracking-widest">研究人员</h4>
              <p className="text-sm text-black/50 leading-relaxed italic">"重要对话本地保存，随时找回。隐私优先的设计让我很放心处理敏感数据。"</p>
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
                  <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-black/40">特性</th>
                  <th className="p-6 text-[10px] font-bold uppercase tracking-widest">AI全家桶</th>
                  <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-black/20">其他聚合站</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {[
                  ['登录方式', '自有账号 (Cookie)', '需购买 API / 订阅'],
                  ['数据隐私', '纯本地存储', '部分云端存储'],
                  ['访问速度', '官方直连', '中转代理 (慢)'],
                  ['成本', '免费 (买断制)', '昂贵的订阅制'],
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
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-12">准备好提升效率了吗？</h2>
          <p className="text-black/40 text-lg mb-16 max-w-xl mx-auto">
            加入 10,000+ 极客用户的选择，告别繁琐的标签页切换，开启你的 AI 全家桶之旅。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
              <Chrome size={18} />
              添加到 Chrome
            </a>
            <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="bg-white text-black border border-black/20 px-10 py-5 rounded font-bold text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-3 no-underline">
              <Download size={18} />
              下载应用
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
            <span>ai全家桶.xin</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-neutral-500">
            <button onClick={() => setModalContent('privacy')} className="hover:text-black transition-colors">隐私政策</button>
            <button onClick={() => setModalContent('terms')} className="hover:text-black transition-colors">服务条款</button>
            <button onClick={() => setModalContent('contact')} className="hover:text-black transition-colors">联系我们</button>
            <button onClick={() => setModalContent('developer')} className="hover:text-black transition-colors">开发者</button>
          </div>
          <p className="mt-8 md:mt-0 text-sm text-neutral-400">
            © 2025-2026 ai全家桶.xin. All rights reserved.
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
            onClick={() => setModalContent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md border border-black/10 bg-white p-6 text-black shadow-2xl max-h-[80vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight">
                  {modalContent === 'developer' && '开发者'}
                  {modalContent === 'privacy' && '隐私政策'}
                  {modalContent === 'terms' && '服务条款'}
                  {modalContent === 'contact' && '联系我们'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalContent(null)}
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-black"
                >
                  关闭
                </button>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
              {modalContent === 'developer' && (
                <>
                  <div className="space-y-2 border-b border-black/10 pb-4">
                    <p className="text-base font-semibold text-black">vibe coder: 可鑫</p>
                    <p>
                      AI 全家桶是我做的一个聚合 AI 侧边栏工具，把 ChatGPT、Claude、Gemini 等 11+ 主流 AI 整合在一个侧边栏里，让你不用再切标签页。
                    </p>
                  </div>

                  <div className="space-y-2 border-b border-black/10 pb-4">
                    <p className="font-medium text-black">我还在做的东西</p>
                    <div className="flex flex-col gap-2">
                      <a href="https://iterate.xin" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">iterate.xin</a>
                      <a href="https://relearn.xin" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">relearn.xin</a>
                      <a href="https://tobooks.xin" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">tobooks.xin</a>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-black">联系方式</p>
                    <p>邮箱：ymx94yyds@qq.com</p>
                    <p>微信：ymx94yyds</p>
                  </div>
                </>
              )}
              
              {modalContent === 'privacy' && (
                <>
                    <p className="text-xs text-zinc-400 mb-3">最后更新：2026年3月30日</p>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">数据收集</p>
                      <p>AI全家桶不收集任何个人数据。所有设置和偏好均存储在您的本地浏览器中。</p>
                    </div>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">第三方服务</p>
                      <p>本扩展会加载第三方 AI 服务（如 ChatGPT、Claude 等）。这些服务有各自的隐私政策，请查阅相关服务的官方文档。</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">数据安全</p>
                      <p>您的对话数据仅存储在本地，我们不会上传或共享您的任何信息。</p>
                    </div>
                </>
              )}
              
              {modalContent === 'terms' && (
                <>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">使用许可</p>
                      <p>AI全家桶是免费提供的工具。您可以自由使用本扩展，但不得用于非法目的。</p>
                    </div>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p className="font-medium text-black">免责声明</p>
                      <p>本扩展按“现状”提供，不提供任何明示或暗示的保证。使用本扩展的风险由您自行承担。</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">第三方服务</p>
                      <p>您需要遵守各 AI 服务提供商的服务条款。我们不对第三方服务的可用性或内容负责。</p>
                    </div>
                </>
              )}
              
              {modalContent === 'contact' && (
                <>
                    <p>如有任何问题或建议，欢迎通过以下方式联系我们：</p>
                    <div className="space-y-2 border-b border-black/10 pb-4">
                      <p>邮箱：ymx94yyds@qq.com</p>
                      <p>微信：ymx94yyds</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">GitHub</p>
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">{GITHUB_URL}</a>
                    </div>
                </>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
