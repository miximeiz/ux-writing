import React from 'react';
import { AppMode } from '../types';
import { 
  Upload, 
  Search, 
  PenTool, 
  BookOpen, 
  Bot,
  Languages
} from 'lucide-react';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode }) => {
  const navItems = [
    { mode: AppMode.UPLOAD, label: 'Source Management', icon: Upload },
    { mode: AppMode.SEARCH, label: 'Glossary Search', icon: Search },
    { mode: AppMode.GENERATE, label: 'Microcopy Generator', icon: PenTool },
    { mode: AppMode.BILINGUAL_MATCH, label: 'Bilingual Matching', icon: Languages },
    { mode: AppMode.STYLE_GUIDE, label: 'Style Guide Generator', icon: BookOpen },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen fixed left-0 top-0 shadow-xl z-10">
      <div className="p-6 border-b border-slate-700 flex items-center gap-3">
        <Bot className="w-8 h-8 text-indigo-400" />
        <h1 className="font-bold text-xl tracking-tight">UX Writer AI</h1>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => setMode(item.mode)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentMode === item.mode
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400">
          <p className="mb-1 font-semibold text-slate-300">System Status</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Gemini 3 Ready
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;