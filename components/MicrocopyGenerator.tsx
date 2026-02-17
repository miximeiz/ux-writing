import React, { useState } from 'react';
import { PenTool, Loader2, Copy, Check, Sparkles, Info, Globe } from 'lucide-react';
import { generateMicrocopy } from '../services/geminiService';
import { GenerationResult, MicrocopyContent, GenerationOption, UploadedFile } from '../types';

interface MicrocopyGeneratorProps {
  glossaryFiles: UploadedFile[];
  styleGuideFiles: UploadedFile[];
}

const MicrocopyGenerator: React.FC<MicrocopyGeneratorProps> = ({ glossaryFiles, styleGuideFiles }) => {
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!request.trim()) return;
    setLoading(true);
    setResult(null);
    setCopyStatus(null);

    const generated = await generateMicrocopy(request, styleGuideFiles, glossaryFiles);
    setResult(generated);
    setLoading(false);
  };

  const handleCopy = (content: MicrocopyContent, id: string) => {
    // Construct a copyable string from the object
    const parts = [];
    if (content.title) parts.push(`Title: ${content.title}`);
    parts.push(`Description: ${content.description}`);
    if (content.primaryButton) parts.push(`Button (Primary): ${content.primaryButton}`);
    if (content.secondaryButton) parts.push(`Button (Secondary): ${content.secondaryButton}`);
    
    navigator.clipboard.writeText(parts.join('\n'));
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  // Helper component for the "Card" UI
  const MicrocopyCard: React.FC<{ 
    content: MicrocopyContent; 
    variant: 'primary' | 'secondary'; 
    onCopy: () => void; 
    copyState: boolean;
    isMultiLang?: boolean;
  }> = ({ content, variant, onCopy, copyState, isMultiLang }) => (
    <div className={`relative rounded-xl border p-6 transition-all ${
      variant === 'primary' 
        ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
    }`}>
      <div className="flex justify-between items-start mb-4">
        {content.language && (
          <span className={`
            inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md
            ${variant === 'primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}
          `}>
            <Globe className="w-3 h-3" />
            {content.language}
          </span>
        )}
        
        {variant === 'primary' && !isMultiLang && (
          <span className="absolute top-0 right-0 -mt-3 mr-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
            Recommended
          </span>
        )}
      </div>

      {/* UI PREVIEW AREA */}
      <div className="flex flex-col space-y-4">
        {content.title && (
          <h4 className="text-xl font-bold text-slate-900 leading-tight">
            {content.title}
          </h4>
        )}
        
        <p className="text-slate-600 leading-relaxed text-base">
          {content.description}
        </p>

        {(content.primaryButton || content.secondaryButton) && (
          <div className="flex flex-wrap gap-3 pt-2">
            {content.primaryButton && (
              <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-sm">
                {content.primaryButton}
              </span>
            )}
            {content.secondaryButton && (
              <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white text-sm font-semibold shadow-sm">
                {content.secondaryButton}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ACTION BAR */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end items-center">
        <button
          onClick={onCopy}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
            copyState
              ? 'bg-emerald-50 text-emerald-600'
              : 'text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          {copyState ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copyState ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );

  const OptionGroup: React.FC<{ option: GenerationOption, type: 'primary' | 'secondary', index?: number }> = ({ option, type, index }) => {
    return (
      <div className={`space-y-3 ${type === 'primary' ? 'mb-8' : ''}`}>
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {type === 'primary' ? 'Primary Recommendation' : `Option ${index! + 1}: ${option.variantName || 'Alternative'}`}
          </h3>
          {type === 'primary' && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Best Match
            </span>
          )}
        </div>
        
        <div className={`grid gap-4 ${option.content.length > 1 ? 'grid-cols-1' : 'grid-cols-1'}`}>
          {option.content.map((version, vIdx) => (
             <MicrocopyCard 
               key={vIdx}
               content={version} 
               variant={type}
               onCopy={() => handleCopy(version, `${type}-${index || 0}-${vIdx}`)} 
               copyState={copyStatus === `${type}-${index || 0}-${vIdx}`}
               isMultiLang={option.content.length > 1}
             />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-indigo-100 p-2 rounded-lg">
             <PenTool className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Microcopy Generator</h2>
        </div>
        <p className="text-slate-500 mb-6 ml-12">Generate on-brand component copy, error messages, and more.</p>

        <div className="space-y-4">
          <div>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="Describe what you need... e.g., 'A session timeout modal in English and Thai with a title, description, and two buttons.'"
              className="w-full p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm min-h-[120px] resize-y placeholder:text-slate-400 text-slate-700 leading-relaxed text-lg"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading || !request}
              className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-8 animate-fade-in">
          
          <OptionGroup option={result.primary} type="primary" />

          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Alternatives</h3>
            <div className="space-y-8">
              {result.alternatives.map((alt, idx) => (
                <OptionGroup key={idx} option={alt} type="secondary" index={idx + 1} />
              ))}
            </div>
          </div>

          {/* Rationale */}
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 flex gap-4 items-start">
             <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100 shrink-0">
               <Info className="w-5 h-5 text-indigo-500" />
             </div>
             <div>
               <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-2">Context & Rationale</h4>
               <p className="text-slate-600 text-sm leading-relaxed">
                 {result.rationale}
               </p>
             </div>
          </div>

        </div>
      )}

      {loading && !result && (
        <div className="bg-white rounded-2xl p-16 border border-slate-200 flex flex-col items-center justify-center space-y-4 animate-pulse">
           <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
             <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
           </div>
           <p className="text-slate-500 font-medium text-lg">Designing your microcopy...</p>
        </div>
      )}
    </div>
  );
};

export default MicrocopyGenerator;