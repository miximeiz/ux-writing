import React, { useState, useMemo, useRef } from 'react';
import { BookOpen, Loader2, Download, Copy, Check, Menu, FileText, UploadCloud, X, Send, Sparkles, Image as ImageIcon, FileType, AlignLeft } from 'lucide-react';
import { createStyleGuide } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';
import { UploadedFile } from '../types';

interface StyleGuideCreatorProps {
  allFiles: UploadedFile[];
}

interface StyleSection {
  title: string;
  content: string;
}

const StyleGuideCreator: React.FC<StyleGuideCreatorProps> = ({ allFiles }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [manualText, setManualText] = useState('');
  
  const [uploadedInputs, setUploadedInputs] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FILE HANDLING ---
  
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newInputs: UploadedFile[] = [];

    // Cast to File[] to ensure TS knows 'file' is of type File
    for (const file of Array.from(files) as File[]) {
      try {
        const name = file.name.toLowerCase();
        let data = '';
        let type: 'text' | 'binary' = 'text';
        let mimeType = '';
        let isBinary = false;

        if (name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          data = result.value;
        }
        else if (name.endsWith('.doc')) {
          isBinary = true;
          mimeType = 'application/msword';
          data = await readFileAsBase64(file);
        }
        else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetsContent: string[] = [];
          workbook.SheetNames.forEach((sheetName: string) => {
             const worksheet = workbook.Sheets[sheetName];
             const sheetText = XLSX.utils.sheet_to_csv(worksheet);
             if (sheetText.trim()) sheetsContent.push(`[Sheet: ${sheetName}]\n${sheetText}`);
          });
          data = sheetsContent.join('\n\n');
        } 
        else if (name.endsWith('.pdf')) {
          isBinary = true;
          mimeType = 'application/pdf';
          data = await readFileAsBase64(file);
        }
        else if (name.endsWith('.png')) {
          isBinary = true;
          mimeType = 'image/png';
          data = await readFileAsBase64(file);
        }
        else if (name.endsWith('.jpeg') || name.endsWith('.jpg')) {
          isBinary = true;
          mimeType = 'image/jpeg';
          data = await readFileAsBase64(file);
        }
        else {
          data = await file.text();
        }

        newInputs.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          content: data,
          type: 'general',
          mimeType: mimeType || undefined,
          isBinary: isBinary
        });
      } catch (err) {
        // file is definitely a File here due to casting above
        console.error(`Failed to process ${file.name}`, err);
      }
    }

    setUploadedInputs(prev => [...prev, ...newInputs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeInput = (id: string) => {
    setUploadedInputs(prev => prev.filter(i => i.id !== id));
  };

  // --- ACTIONS ---

  const handleCreate = async () => {
    const combinedFiles = [...uploadedInputs, ...allFiles];
    
    // Include manual text if provided
    if (manualText.trim()) {
      combinedFiles.push({
        id: 'manual-input-text',
        name: 'Manual Context Input',
        content: manualText,
        type: 'general',
        isBinary: false
      });
    }

    if (combinedFiles.length === 0) return;
    
    setLoading(true);
    setResult(null);

    const generatedGuide = await createStyleGuide(combinedFiles);
    setResult(generatedGuide);
    setLoading(false);
  };

  const handleRefine = async () => {
    if (!result || !refinementPrompt.trim()) return;
    setLoading(true);
    
    // We pass empty inputs because we are refining existing content
    const updatedGuide = await createStyleGuide([], {
      currentGuide: result,
      instruction: refinementPrompt
    });
    
    setResult(updatedGuide);
    setRefinementPrompt('');
    setLoading(false);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleExportDocx = () => {
    if (!result) return;
    
    // Simple Markdown to HTML conversion for Word export
    // Replacing standard markdown headers with HTML headers for the doc structure
    let htmlBody = result
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/\n/gim, '<br>');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>UX Style Guide</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #4F46E5; margin-top: 20px; }
          h3 { color: #666; }
          code { background: #f4f4f5; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
        </style>
      </head>
      <body>
        ${htmlBody}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UX_Style_Guide.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- RENDERING HELPERS ---

  const sections = useMemo((): StyleSection[] => {
    if (!result) return [];
    const parts = result.split(/(?=## )/g);
    const introSection: StyleSection[] = [];
    const firstPart = parts[0];
    
    if (firstPart && !firstPart.startsWith('## ')) {
      introSection.push({ title: 'Introduction', content: firstPart });
      parts.shift();
    }

    const structuredParts = parts.map(part => {
      const lines = part.split('\n');
      const title = lines[0].replace('## ', '').trim();
      const content = lines.slice(1).join('\n').trim();
      return { title, content };
    });

    return [...introSection, ...structuredParts];
  }, [result]);

  const FileIcon = ({ type, name }: { type: string, name: string }) => {
    if (type === 'binary' || name.endsWith('.pdf') || name.endsWith('.doc')) {
        if (name.endsWith('pdf')) return <FileType className="w-5 h-5 text-red-500" />;
        if (name.endsWith('doc')) return <FileText className="w-5 h-5 text-blue-700" />;
        return <ImageIcon className="w-5 h-5 text-purple-500" />;
    }
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  // --- MAIN UI ---

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      
      {!result ? (
        // UPLOAD STATE
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
          <div className="text-center space-y-2 mb-8">
             <h2 className="text-3xl font-bold text-slate-800">Style Guide Generator</h2>
             <p className="text-slate-500">Upload existing materials or paste text to automatically generate a comprehensive UX Writing Style Guide.</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
             
             {/* File Upload Zone */}
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group mb-6"
             >
               <div className="bg-indigo-50 p-4 rounded-full mb-3 group-hover:bg-indigo-100 transition-colors">
                 <UploadCloud className="w-8 h-8 text-indigo-600" />
               </div>
               <p className="text-slate-900 font-bold text-lg">Upload Files</p>
               <p className="text-slate-500 text-sm mt-1">.docx, .pdf, .xlsx, .png, .jpg</p>
               <input 
                  type="file" 
                  multiple
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept=".docx,.doc,.xlsx,.xls,.pdf,.png,.jpeg,.jpg"
               />
             </div>

             {/* Divider */}
             <div className="flex items-center gap-4 my-6">
                <div className="h-px bg-slate-100 flex-1"></div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">OR</span>
                <div className="h-px bg-slate-100 flex-1"></div>
             </div>

             {/* Manual Text Input */}
             <div className="mb-8">
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-indigo-500" />
                  Paste Manual Context / Notes
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Paste brand guidelines, mission statements, existing rules, or rough notes here to use as a source..."
                  className="w-full p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[120px] text-slate-700 placeholder:text-slate-400 transition-shadow bg-slate-50/50"
                />
             </div>

             {/* File List */}
             {(uploadedInputs.length > 0 || allFiles.length > 0) && (
               <div className="space-y-3 mb-8">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                   Sources to Analyze ({uploadedInputs.length + allFiles.length})
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 opacity-75">
                         <div className="flex items-center gap-3 overflow-hidden">
                           <FileIcon type={file.isBinary ? 'binary' : 'text'} name={file.name} />
                           <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                           <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Global</span>
                         </div>
                      </div>
                    ))}
                    {uploadedInputs.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileIcon type={file.isBinary ? 'binary' : 'text'} name={file.name} />
                          <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                        </div>
                        <button onClick={() => removeInput(file.id)} className="text-slate-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                 </div>
               </div>
             )}

             <button
                onClick={handleCreate}
                disabled={loading || (uploadedInputs.length === 0 && allFiles.length === 0 && !manualText.trim())}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Sources...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Style Guide
                  </>
                )}
             </button>
          </div>
        </div>
      ) : (
        // RESULT STATE
        <div className="flex flex-col lg:flex-row gap-8 animate-fade-in items-start">
          
          {/* Sticky Sidebar / TOC & Actions */}
          <aside className="lg:w-72 w-full lg:sticky lg:top-8 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <Menu className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contents</span>
              </div>
              <nav className="space-y-1 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {sections.map((section, idx) => (
                  <a 
                    key={idx} 
                    href={`#section-${idx}`}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all group"
                  >
                    <span className="text-[10px] font-bold text-slate-300 group-hover:text-indigo-300 w-4">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate font-medium">{section.title}</span>
                  </a>
                ))}
              </nav>
            </div>

            <div className="space-y-2">
              <button 
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-all"
              >
                {copyStatus ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copyStatus ? 'Copied Markdown' : 'Copy All'}
              </button>
              <button 
                onClick={handleExportDocx}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export as .docx
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            
            {/* Guide Preview */}
            <div className="space-y-6">
              {sections.map((section, idx) => (
                <section 
                  key={idx} 
                  id={`section-${idx}`}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden scroll-mt-8 hover:border-indigo-200 transition-colors"
                >
                  <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 text-indigo-700 text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-md">
                        {idx + 1}
                      </div>
                      <h3 className="font-bold text-slate-800 tracking-tight">{section.title}</h3>
                    </div>
                  </div>

                  <div className="p-8 md:p-10">
                    <article className="prose prose-slate max-w-none 
                      prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900
                      prose-h3:text-lg prose-h3:text-indigo-600 prose-h3:mt-8 prose-h3:mb-4
                      prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-base
                      prose-li:text-slate-600 prose-li:text-base prose-li:my-1
                      prose-strong:text-slate-900 prose-strong:font-semibold
                      prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-1 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:italic prose-blockquote:text-slate-600
                      prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                    ">
                      <ReactMarkdown>{section.content}</ReactMarkdown>
                    </article>
                  </div>
                </section>
              ))}
            </div>

            {/* Refinement Loop */}
            <div className="sticky bottom-6 z-10">
              <div className="bg-white p-4 rounded-xl shadow-xl border border-indigo-100 ring-4 ring-indigo-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">AI Feedback Loop</span>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    placeholder="e.g., 'Make the tone friendlier', 'Add a section on Date Formats', 'Expand the Buttons section'"
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleRefine()}
                  />
                  <button 
                    onClick={handleRefine}
                    disabled={loading || !refinementPrompt.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Adjust
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default StyleGuideCreator;