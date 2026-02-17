import React, { useState } from 'react';
import { Search, Loader2, FileText, Tag, Copy, Book } from 'lucide-react';
import { searchGlossary } from '../services/geminiService';
import { SearchResult, UploadedFile } from '../types';

interface GlossarySearchProps {
  glossaryFiles: UploadedFile[];
}

const GlossarySearch: React.FC<GlossarySearchProps> = ({ glossaryFiles }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    // AI Semantic Search returning structured JSON
    const searchResult = await searchGlossary(query, glossaryFiles);
    setResult(searchResult);
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Glossary Search</h2>
        <p className="text-slate-500 mb-6">Search your uploaded glossary for approved microcopy terms and usage definitions.</p>

        <form onSubmit={handleSearch} className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in English or Thai (e.g., 'Submit', 'บันทึก', 'Error')..."
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-lg placeholder:text-slate-400"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          <button
            type="submit"
            disabled={loading || !query}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        
        {glossaryFiles.length === 0 && (
           <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
             <strong>Note:</strong> You haven't uploaded a Glossary document yet. The search will be limited or fail. Please upload a file in the Upload section.
           </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      )}

      {result && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-slate-800">
              {result.matchFound ? `Found ${result.results.length} results` : 'No matches found'}
            </h3>
            {result.message && <span className="text-sm text-slate-500">{result.message}</span>}
          </div>

          {!result.matchFound ? (
             <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-slate-600">No matching terms found in your glossary.</p>
             </div>
          ) : (
            <div className="grid gap-6">
              {result.results.map((item, index) => (
                <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Card Header */}
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{item.term}</h4>
                      {item.source && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md inline-flex">
                           <FileText className="w-3 h-3" />
                           {item.source}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 space-y-6">
                    {/* Definitions / Microcopy */}
                    <div className="space-y-3">
                      {item.definitions.map((def, idx) => (
                        <div key={idx} className="group relative bg-slate-50 rounded-lg p-4 border border-slate-100">
                           <div className="flex justify-between items-start mb-1">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{def.label}</span>
                             <button 
                               onClick={() => copyToClipboard(def.text)}
                               className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all text-slate-500"
                               title="Copy text"
                             >
                               <Copy className="w-3.5 h-3.5" />
                             </button>
                           </div>
                           <p className="text-slate-800 text-lg leading-relaxed">{def.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Usage Notes */}
                    {item.usageNotes && (
                      <div className="flex gap-3 text-sm text-slate-600 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                        <Book className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div>
                          <p className="font-medium text-indigo-900 mb-1">Usage Notes</p>
                          {item.usageNotes}
                        </div>
                      </div>
                    )}

                    {/* Metadata Tags */}
                    {item.metadata && item.metadata.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        {item.metadata.map((meta, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                            <Tag className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold">{meta.key}:</span>
                            <span>{meta.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlossarySearch;