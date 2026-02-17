import React, { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import UploadSection from './components/UploadSection';
import GlossarySearch from './components/GlossarySearch';
import MicrocopyGenerator from './components/MicrocopyGenerator';
import StyleGuideCreator from './components/StyleGuideCreator';
import BilingualMatcher from './components/BilingualMatcher';
import { AppMode, UploadedFile } from './types';
import { PLACEHOLDER_GLOSSARY, PLACEHOLDER_STYLE_GUIDE } from './constants';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.UPLOAD);
  const [files, setFiles] = useState<UploadedFile[]>([
    {
      id: 'default-glossary',
      name: 'Example_Glossary.txt',
      content: PLACEHOLDER_GLOSSARY,
      type: 'glossary',
      isBinary: false
    },
    {
      id: 'default-style',
      name: 'Example_StyleGuide.txt',
      content: PLACEHOLDER_STYLE_GUIDE,
      type: 'style-guide',
      isBinary: false
    }
  ]);

  // Derived state helpers
  const glossaryFiles = useMemo(() => files.filter(f => f.type === 'glossary'), [files]);
  const styleGuideFiles = useMemo(() => files.filter(f => f.type === 'style-guide'), [files]);
  
  // For style guide creator, we might want all files or just specific ones, defaulting to all for context
  const allFiles = files;

  const renderContent = () => {
    switch (mode) {
      case AppMode.UPLOAD:
        return <UploadSection files={files} setFiles={setFiles} />;
      case AppMode.SEARCH:
        return <GlossarySearch glossaryFiles={glossaryFiles} />;
      case AppMode.GENERATE:
        return <MicrocopyGenerator glossaryFiles={glossaryFiles} styleGuideFiles={styleGuideFiles} />;
      case AppMode.BILINGUAL_MATCH:
        return <BilingualMatcher glossaryFiles={glossaryFiles} />;
      case AppMode.STYLE_GUIDE:
        return <StyleGuideCreator allFiles={allFiles} />;
      default:
        return <UploadSection files={files} setFiles={setFiles} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentMode={mode} setMode={setMode} />
      
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen scroll-smooth">
        <header className="mb-8">
           <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
             {mode === AppMode.UPLOAD && 'Source Management'}
             {mode === AppMode.SEARCH && 'Glossary Search'}
             {mode === AppMode.GENERATE && 'Microcopy Assistant'}
             {mode === AppMode.BILINGUAL_MATCH && 'Bilingual Matching'}
             {mode === AppMode.STYLE_GUIDE && 'Style Guide Creator'}
           </h1>
           <p className="text-slate-500">
             {mode === AppMode.UPLOAD && 'Manage the documents that power your AI assistant.'}
             {mode === AppMode.SEARCH && 'Find approved terms and definitions quickly.'}
             {mode === AppMode.GENERATE && 'Create consistent, user-friendly microcopy in seconds.'}
             {mode === AppMode.BILINGUAL_MATCH && 'Align English and Thai terminology from your glossary.'}
             {mode === AppMode.STYLE_GUIDE && 'Standardize your UX writing rules automatically.'}
           </p>
        </header>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;