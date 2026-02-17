import React, { useState, useRef } from 'react';
import { Languages, Loader2, Download, Copy, Check, Table as TableIcon, Upload, X, FileText, Image as ImageIcon, AlertCircle, Info } from 'lucide-react';
import { matchBilingualTerms } from '../services/geminiService';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';
import { UploadedFile, BilingualAlignment } from '../types';

interface BilingualMatcherProps {
  glossaryFiles: UploadedFile[];
}

const BilingualMatcher: React.FC<BilingualMatcherProps> = ({ glossaryFiles }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BilingualAlignment | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const name = file.name.toLowerCase();
      let fileData = '';
      let mimeType = '';
      let isBinary = false;

      if (name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fileData = result.value;
      }
      else if (name.endsWith('.doc')) {
        isBinary = true;
        mimeType = 'application/msword';
        fileData = await readFileAsBase64(file);
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
        fileData = sheetsContent.join('\n\n');
      } 
      else if (name.endsWith('.pdf')) {
        isBinary = true;
        mimeType = 'application/pdf';
        fileData = await readFileAsBase64(file);
      }
      else if (name.endsWith('.png') || name.endsWith('.jpeg') || name.endsWith('.jpg')) {
        isBinary = true;
        mimeType = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
        fileData = await readFileAsBase64(file);
      }
      else {
        fileData = await file.text();
      }

      setUploadedFile({
        id: 'uploaded-match-file',
        name: file.name,
        content: fileData,
        type: 'glossary',
        isBinary: isBinary,
        mimeType: mimeType
      });
      setResult(null);
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Error reading file. Please try another file.");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMatch = async () => {
    let inputFiles: UploadedFile[] = [];
    if (uploadedFile) inputFiles = [uploadedFile];
    else if (glossaryFiles.length > 0) inputFiles = glossaryFiles;

    if (inputFiles.length === 0) return;

    setLoading(true);
    setResult(null);

    const alignment = await matchBilingualTerms(inputFiles);
    setResult(alignment);
    setLoading(false);
  };

  const handleCopy = () => {
    if (!result) return;
    const matchedText = result.matches.map(r => `${r.en}\t${r.th}`).join('\n');
    const unmatchedEnText = result.unmatchedEn.length > 0 ? `\n\nUnmatched English:\n${result.unmatchedEn.join('\n')}` : '';
    const unmatchedThText = result.unmatchedTh.length > 0 ? `\n\nUnmatched Thai:\n${result.unmatchedTh.join('\n')}` : '';
    
    navigator.clipboard.writeText(matchedText + unmatchedEnText + unmatchedThText);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleDownloadDocx = () => {
    if (!result) return;
    
    const tableRows = result.matches.map(row => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${row.en}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${row.th}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Bilingual Alignment Report</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
          h1 { color: #4F46E5; }
          h2 { color: #1F2937; margin-top: 30px; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background-color: #F3F4F6; text-align: left; border: 1px solid #D1D5DB; padding: 12px; font-weight: bold; }
          td { border: 1px solid #E5E7EB; padding: 10px; }
          .unmatched { padding: 10px; background: #F9FAFB; border-radius: 4px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <h1>Bilingual Glossary Alignment Report</h1>
        
        <h2>1. Matched Pairs (${result.matches.length})</h2>
        <table>
          <thead>
            <tr>
              <th>English Term</th>
              <th>Thai Term</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        ${result.unmatchedEn.length > 0 ? `
          <h2>2. Unmatched English Terms (${result.unmatchedEn.length})</h2>
          ${result.unmatchedEn.map(t => `<div class="unmatched">${t}</div>`).join('')}
        ` : ''}

        ${result.unmatchedTh.length > 0 ? `
          <h2>3. Unmatched Thai Terms (${result.unmatchedTh.length})</h2>
          ${result.unmatchedTh.map(t => `<div class="unmatched">${t}</div>`).join('')}
        ` : ''}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Bilingual_Alignment_Report.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setResult(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Bilingual Glossary Matching</h2>
            <p className="text-slate-500 max-w-2xl">
              Extract and align English and Thai terms from mixed sources. Terms that cannot be paired will be categorized for manual review.
            </p>
          </div>
        </div>

        <div className="mb-8">
           {!uploadedFile ? (
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="border-2 border-dashed border-slate-300 rounded-2xl p-14 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group"
             >
               <div className="bg-indigo-50 p-5 rounded-full mb-4 group-hover:bg-indigo-100 transition-colors">
                 <Upload className="w-10 h-10 text-indigo-600" />
               </div>
               <p className="text-xl font-bold text-slate-900">Upload Source Document</p>
               <p className="text-slate-500 mt-2">Supports .docx, .doc, .xlsx, .pdf, images</p>
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept=".docx,.doc,.xlsx,.xls,.pdf,.png,.jpeg,.jpg"
               />
             </div>
           ) : (
             <div className="flex items-center justify-between p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    {uploadedFile.isBinary ? <ImageIcon className="w-8 h-8 text-indigo-500" /> : <FileText className="w-8 h-8 text-indigo-500" />}
                 </div>
                 <div>
                   <p className="font-bold text-slate-900 text-lg">{uploadedFile.name}</p>
                   <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wider">File parsed successfully</p>
                 </div>
               </div>
               <button 
                 onClick={clearFile}
                 className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
               >
                 <X className="w-6 h-6" />
               </button>
             </div>
           )}
        </div>
          
        <button
          onClick={handleMatch}
          disabled={loading || (!uploadedFile && glossaryFiles.length === 0)}
          className="w-full flex items-center justify-center gap-3 px-8 py-4.5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Aligning All Terms...
            </>
          ) : (
            <>
              <Languages className="w-6 h-6" />
              Run Bilingual Alignment
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="animate-fade-in space-y-10">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-xl">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Matched Pairs</p>
                   <p className="text-3xl font-black text-slate-900">{result.matches.length}</p>
                </div>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-xl">
                  <span className="text-indigo-600 font-bold text-xl">EN</span>
                </div>
                <div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Unmatched English</p>
                   <p className="text-3xl font-black text-slate-900">{result.unmatchedEn.length}</p>
                </div>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-xl">
                   <span className="text-amber-600 font-bold text-xl">TH</span>
                </div>
                <div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Unmatched Thai</p>
                   <p className="text-3xl font-black text-slate-900">{result.unmatchedTh.length}</p>
                </div>
             </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TableIcon className="w-6 h-6 text-indigo-500" />
              Alignment Preview
            </h3>
            <div className="flex gap-3 w-full lg:w-auto">
              <button 
                onClick={handleCopy}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                {copyStatus ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                {copyStatus ? 'Copied All' : 'Copy Result'}
              </button>
              <button 
                onClick={handleDownloadDocx}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                <Download className="w-5 h-5" />
                Export .docx
              </button>
            </div>
          </div>

          {/* Matches Table */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">1. Successfully Matched Pairs</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-8 py-5 text-sm font-bold text-slate-700 w-1/2">English Context/Term</th>
                    <th className="px-8 py-5 text-sm font-bold text-slate-700 w-1/2">Thai Context/Term</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.matches.length > 0 ? (
                    result.matches.map((item, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-8 py-5 text-slate-900 font-bold text-lg">{item.en}</td>
                        <td className="px-8 py-5 text-slate-600 font-sans text-lg">{item.th}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-8 py-12 text-center text-slate-400 italic">
                        No direct semantic matches found in the file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Unmatched English */}
             <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
                <div className="px-8 py-5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">2. Unmatched English Terms</span>
                  <div className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {result.unmatchedEn.length} items
                  </div>
                </div>
                <div className="p-8">
                  {result.unmatchedEn.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {result.unmatchedEn.map((term, idx) => (
                        <div key={idx} className="px-4 py-2.5 bg-indigo-50 text-indigo-900 rounded-xl border border-indigo-100 text-sm font-bold flex items-center gap-2 group">
                           <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform"></span>
                           {term}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                       <Check className="w-8 h-8 text-emerald-400" />
                       <p className="text-sm font-medium">All English terms successfully paired.</p>
                    </div>
                  )}
                </div>
             </div>

             {/* Unmatched Thai */}
             <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
                <div className="px-8 py-5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">3. Unmatched Thai Terms</span>
                  <div className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {result.unmatchedTh.length} items
                  </div>
                </div>
                <div className="p-8">
                  {result.unmatchedTh.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {result.unmatchedTh.map((term, idx) => (
                        <div key={idx} className="px-4 py-2.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-100 text-sm font-medium flex items-center gap-2 group">
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:scale-125 transition-transform"></span>
                           {term}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                       <Check className="w-8 h-8 text-emerald-400" />
                       <p className="text-sm font-medium">All Thai terms successfully paired.</p>
                    </div>
                  )}
                </div>
             </div>
          </div>

          {/* Rationale / Guidance */}
          <div className="bg-slate-900 text-white rounded-2xl p-8 flex gap-6 items-start shadow-xl border border-slate-800">
             <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30">
                <Info className="w-8 h-8 text-indigo-400" />
             </div>
             <div className="space-y-2">
                <h4 className="text-xl font-bold">Matching Insight</h4>
                <p className="text-slate-400 leading-relaxed">
                  The AI identifies matches based on semantic meaning and visual proximity within your document. Unmatched terms usually represent concepts unique to one language in this specific context or missing translations that might require your attention to ensure UX consistency.
                </p>
             </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
              <Languages className="w-12 h-12 text-slate-300" />
           </div>
           <h3 className="text-xl font-bold text-slate-800 mb-2">No active alignment results</h3>
           <p className="text-slate-500">
             Upload a document or select an existing glossary to start the bilingual extraction process.
           </p>
        </div>
      )}
    </div>
  );
};

export default BilingualMatcher;