import React, { useRef, useState } from 'react';
import { UploadedFile } from '../types';
import { FileText, Trash2, UploadCloud, AlertCircle, Link as LinkIcon, Globe, Info, Loader2, CheckCircle2, Book, PenTool } from 'lucide-react';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';

interface UploadSectionProps {
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

const GoogleDocIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="#4285F4"/>
    <path d="M14 2V8H20L14 2Z" fill="#A1C2FA"/>
    <path d="M16 13H8V11H16V13ZM16 17H8V15H16V17ZM12 9H8V7H12V9Z" fill="white"/>
  </svg>
);

const GoogleSheetIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="#0F9D58"/>
    <path d="M14 2V8H20L14 2Z" fill="#B7E1CD"/>
    <path d="M16 13H8V11H16V13ZM16 17H8V15H16V17ZM12 9H8V7H12V9Z" fill="white"/>
  </svg>
);

const UploadSection: React.FC<UploadSectionProps> = ({ files, setFiles }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    setError(null);
    const newFiles: UploadedFile[] = [];

    const fileList = Array.from(uploadedFiles) as File[];
    for (const file of fileList) {
      try {
        let content = '';
        const name = file.name.toLowerCase();
        let mimeType = '';
        let isBinary = false;

        if (name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } 
        else if (name.endsWith('.doc')) {
          isBinary = true;
          mimeType = 'application/msword';
          content = await readFileAsBase64(file);
        }
        else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetsContent: string[] = [];
          workbook.SheetNames.forEach((sheetName: string) => {
            const worksheet = workbook.Sheets[sheetName];
            const sheetText = XLSX.utils.sheet_to_csv(worksheet);
            if (sheetText.trim()) {
              sheetsContent.push(`[Sheet: ${sheetName}]\n${sheetText}`);
            }
          });
          content = sheetsContent.join('\n\n');
        }
        else if (name.endsWith('.pdf')) {
            isBinary = true;
            mimeType = 'application/pdf';
            content = await readFileAsBase64(file);
        } 
        else if (file.type.match('text.*') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.csv')) {
          content = await file.text();
        } 
        else {
          setError(prev => (prev ? prev + '\n' : '') + `Unsupported file type: ${file.name}`);
          continue;
        }

        if (content) {
          const fileType = name.includes('style') ? 'style-guide' : 'glossary';

          newFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            content: content,
            type: fileType,
            mimeType: mimeType || undefined,
            isBinary: isBinary
          });
        }
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
        setError(prev => (prev ? prev + '\n' : '') + `Error reading ${file.name}`);
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUrlImport = async () => {
    if (!importUrl) return;
    setIsImporting(true);
    setError(null);

    try {
      let finalUrl = importUrl;
      let type: 'glossary' | 'style-guide' | 'general' = 'glossary'; 
      let name = 'Imported Google Doc';

      if (importUrl.toLowerCase().includes('style')) {
        type = 'style-guide';
      }

      if (importUrl.includes('docs.google.com/spreadsheets')) {
        name = 'Imported Google Sheet';
        if (!importUrl.includes('pub?output=csv')) {
          if (importUrl.includes('/pub')) {
             finalUrl = importUrl.split('?')[0] + '?output=csv';
          }
        }
      }

      const response = await fetch(finalUrl);
      if (!response.ok) throw new Error('Could not fetch content. Ensure the document is "Published to the Web".');
      
      const text = await response.text();
      
      let content = text;
      if (text.includes('<body') && text.includes('</body>')) {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        content = doc.body.innerText || doc.body.textContent || '';
      }

      setFiles(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        name: `${name} (${new Date().toLocaleTimeString()})`,
        content: content,
        type: type,
        isBinary: false
      }]);
      
      setImportUrl('');
      setShowUrlInput(false);
    } catch (err: any) {
      setError(`Failed to import: ${err.message}. \nTip: Use "File > Share > Publish to web" in Google Docs/Sheets for the best results.`);
    } finally {
      setIsImporting(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileType = (id: string, type: UploadedFile['type']) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, type } : f));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Source Documents</h2>
            <p className="text-slate-500 mt-1">Upload glossaries and style guides to power your writing assistant.</p>
          </div>
          <button 
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              showUrlInput ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            {showUrlInput ? 'Cancel Import' : 'Import from URL'}
          </button>
        </div>
        
        {showUrlInput ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8 animate-in slide-in-from-top-2 duration-300">
            <div className="flex gap-2 mb-4">
              <input 
                type="text"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="Paste Google Doc or Sheet 'Publish to Web' link here..."
                className="flex-1 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button 
                onClick={handleUrlImport}
                disabled={isImporting || !importUrl}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Import
              </button>
            </div>
            <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="bg-amber-50 p-2 rounded-full self-start">
                <Info className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-sm text-slate-600 space-y-2">
                <p className="font-bold text-slate-800">How to get a fetchable link:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>In Google Docs/Sheets, go to <strong>File > Share > Publish to web</strong>.</li>
                  <li>Click <strong>Publish</strong> and copy the generated link.</li>
                  <li>Paste the link above for direct content synchronization.</li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group mb-8"
          >
            <div className="bg-indigo-50 p-5 rounded-full mb-4 group-hover:bg-indigo-100 transition-colors">
              <UploadCloud className="w-10 h-10 text-indigo-600" />
            </div>
            <p className="text-slate-900 font-bold text-xl">Click to upload documents</p>
            <p className="text-slate-500 text-sm mt-2">Supports .docx, .doc, .xlsx, .txt, .md, .json, .csv</p>
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".txt,.md,.json,.csv,.docx,.doc,.xlsx,.xls,.pdf"
            />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-3 border border-red-100 whitespace-pre-line mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {files.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Uploaded Sources
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{files.length}</span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {files.map(file => {
                const isGoogleDoc = file.name.includes('Google Doc');
                const isGoogleSheet = file.name.includes('Google Sheet');
                const isSpreadsheet = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv') || isGoogleSheet;
                const isBinary = file.isBinary;
                
                return (
                  <div key={file.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors group">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="shrink-0 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        {isGoogleDoc ? <GoogleDocIcon /> : isGoogleSheet ? <GoogleSheetIcon /> : isSpreadsheet ? <Book className="w-8 h-8 text-emerald-500" /> : <FileText className="w-8 h-8 text-indigo-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-900 truncate">{file.name}</p>
                          {(isGoogleDoc || isGoogleSheet) && (
                            <span className="shrink-0 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Linked</span>
                          )}
                          {isBinary && (
                            <span className="shrink-0 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Binary</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate opacity-70 font-mono">
                          {isBinary ? 'Binary content ready for processing' : file.content.substring(0, 80).replace(/\n/g, ' ') + '...'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 pl-14 md:pl-0">
                      <div className="relative">
                        <select 
                          value={file.type === 'general' ? 'glossary' : file.type}
                          onChange={(e) => updateFileType(file.id, e.target.value as any)}
                          className={`
                            appearance-none pl-9 pr-8 py-2 text-sm font-medium rounded-lg border shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 transition-all
                            ${file.type === 'glossary' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }
                          `}
                        >
                          <option value="glossary">Glossary</option>
                          <option value="style-guide">Style Guide</option>
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          {file.type === 'glossary' ? (
                            <Book className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <PenTool className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                        title="Remove source"
                        aria-label="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadSection;