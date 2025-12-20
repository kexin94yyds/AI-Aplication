import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aisidebar.app',
  appName: 'AI Sidebar',
  webDir: 'www',
  ios: {
    contentInset: 'always',
    allowsLinkPreview: true
  },
  server: {
    allowNavigation: [
      'chatgpt.com',
      'claude.ai',
      'gemini.google.com',
      'perplexity.ai',
      'www.perplexity.ai',
      'genspark.ai',
      'www.genspark.ai',
      'tongyi.com',
      'www.tongyi.com',
      'doubao.com',
      'www.doubao.com',
      'aistudio.google.com',
      'notebooklm.google.com',
      'grok.x.ai',
      'deepseek.com',
      'chat.deepseek.com',
      'kimi.moonshot.cn',
      'yuanbao.tencent.com',
      '*.google.com',
      '*.openai.com'
    ]
  }
};

export default config;
