import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { 
  FileText, Merge, Scissors, Minimize2, Image as ImageIcon, 
  Settings, Lock, Unlock, FileImage, Type, Hash, Shield, FileOutput, CheckCircle2, RefreshCw, X,
  Edit, PenTool, Stamp, RotateCw, Globe, LayoutGrid, Archive, Wrench, Binary, Scan, ScanText, GitCompare, Eraser, Crop, Sparkles, Languages, Heart
} from 'lucide-react';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { Login, SignUp } from './pages/Auth';
import './App.css';

// Set up PDF.js worker
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

// Unique App Name
const APP_NAME = "PdfKaro";

const TOOLS = [
  { id: 'merge', title: 'Merge PDF', desc: 'Combine PDFs in the order you want with the easiest PDF merger available.', icon: <Merge size={32} strokeWidth={1.5} />, color: '#E53935' },
  { id: 'split', title: 'Split PDF', desc: 'Separate one page or a whole set for easy conversion into independent PDF files.', icon: <Scissors size={32} strokeWidth={1.5} />, color: '#E53935' },
  { id: 'compress', title: 'Compress PDF', desc: 'Reduce file size while optimizing for maximal PDF quality.', icon: <Minimize2 size={32} strokeWidth={1.5} />, color: '#43A047' },
  { id: 'pdf-to-word', title: 'PDF to Word', desc: 'Easily convert your PDF files into easy to edit DOCX documents.', icon: <Type size={32} strokeWidth={1.5} />, color: '#1E88E5' },
  { id: 'pdf-to-powerpoint', title: 'PDF to PowerPoint', desc: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.', icon: <Settings size={32} strokeWidth={1.5} />, color: '#FB8C00' },
  { id: 'pdf-to-excel', title: 'PDF to Excel', desc: 'Pull data straight from PDFs into Excel spreadsheets.', icon: <Hash size={32} strokeWidth={1.5} />, color: '#43A047' },
  { id: 'word-to-pdf', title: 'Word to PDF', desc: 'Make DOC and DOCX files easy to read by converting them to PDF.', icon: <FileOutput size={32} strokeWidth={1.5} />, color: '#1E88E5' },
  { id: 'powerpoint-to-pdf', title: 'PowerPoint to PDF', desc: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.', icon: <FileOutput size={32} strokeWidth={1.5} />, color: '#FB8C00' },
  { id: 'excel-to-pdf', title: 'Excel to PDF', desc: 'Make EXCEL spreadsheets easy to read by converting them to PDF.', icon: <FileOutput size={32} strokeWidth={1.5} />, color: '#43A047' },
  { id: 'edit-pdf', title: 'Edit PDF', desc: 'Add text, images, shapes or freehand annotations to a PDF document.', icon: <Edit size={32} strokeWidth={1.5} />, color: '#8E24AA' },
  { id: 'pdf-to-jpg', title: 'PDF to JPG', desc: 'Extract all images contained in a PDF or convert each page to JPG.', icon: <ImageIcon size={32} strokeWidth={1.5} />, color: '#FBC02D' },
  { id: 'jpg-to-pdf', title: 'JPG to PDF', desc: 'Convert JPG images to PDF in seconds. Easily adjust orientation.', icon: <FileImage size={32} strokeWidth={1.5} />, color: '#FBC02D' },
  { id: 'sign', title: 'Sign PDF', desc: 'Sign yourself or request electronic signatures from others.', icon: <PenTool size={32} strokeWidth={1.5} />, color: '#1E88E5' },
  { id: 'watermark', title: 'Watermark', desc: 'Stamp an image or text over your PDF in seconds.', icon: <Stamp size={32} strokeWidth={1.5} />, color: '#8E24AA' },
  { id: 'rotate', title: 'Rotate PDF', desc: 'Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once.', icon: <RotateCw size={32} strokeWidth={1.5} />, color: '#8E24AA' },
  { id: 'html-to-pdf', title: 'HTML to PDF', desc: 'Convert webpages in HTML to PDF. Copy and paste the URL of the page you want and convert it.', icon: <Globe size={32} strokeWidth={1.5} />, color: '#FBC02D' },
  { id: 'unlock', title: 'Unlock PDF', desc: 'Remove PDF password security, giving you freedom to use PDFs.', icon: <Unlock size={32} strokeWidth={1.5} />, color: '#E53935' },
  { id: 'protect', title: 'Protect PDF', desc: 'Encrypt your PDF with a password to keep sensitive data confidential.', icon: <Lock size={32} strokeWidth={1.5} />, color: '#E53935' },
  { id: 'organize', title: 'Organize PDF', desc: 'Sort pages of your PDF file however you like. Delete PDF pages or add PDF pages to your document.', icon: <LayoutGrid size={32} strokeWidth={1.5} />, color: '#E53935' },
  { id: 'pdf-to-pdfa', title: 'PDF to PDF/A', desc: 'Transform your PDF to PDF/A, the ISO-standardized version of PDF for long-term archiving.', icon: <Archive size={32} strokeWidth={1.5} />, color: '#1E88E5' },
  { id: 'repair', title: 'Repair PDF', desc: 'Repair a damaged PDF and recover data from corrupt PDF. Fix PDF files with our Repair tool.', icon: <Wrench size={32} strokeWidth={1.5} />, color: '#43A047' },
  { id: 'page-numbers', title: 'Page numbers', desc: 'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.', icon: <Binary size={32} strokeWidth={1.5} />, color: '#8E24AA' },
  { id: 'scan-to-pdf', title: 'Scan to PDF', desc: 'Capture document scans from your mobile device and send them instantly to your browser.', icon: <Scan size={32} strokeWidth={1.5} />, color: '#E53935' },
  { id: 'ocr', title: 'OCR PDF', desc: 'Easily convert scanned PDF into searchable and selectable documents.', icon: <ScanText size={32} strokeWidth={1.5} />, color: '#43A047' },
  { id: 'compare', title: 'Compare PDF', desc: 'Show a side-by-side document comparison and easily spot changes between different file versions.', icon: <GitCompare size={32} strokeWidth={1.5} />, color: '#1E88E5' },
  { id: 'redact', title: 'Redact PDF', desc: 'Redact text and graphics to permanently remove sensitive information from a PDF.', icon: <Eraser size={32} strokeWidth={1.5} />, color: '#1E88E5' },
  { id: 'crop', title: 'Crop PDF', desc: 'Crop margins of PDF documents or select specific areas, then apply the changes to one page or the whole document.', icon: <Crop size={32} strokeWidth={1.5} />, color: '#8E24AA' },
  { id: 'ai-summarizer', title: 'AI Summarizer', desc: 'Quickly generate concise summaries from articles, paragraphs, and essays. Powered by AI.', icon: <Sparkles size={32} strokeWidth={1.5} />, color: '#6366F1' },
  { id: 'translate', title: 'Translate PDF', desc: 'Easily translate PDF files powered by AI. Keep fonts, layout, and formatting perfectly intact.', icon: <Languages size={32} strokeWidth={1.5} />, color: '#6366F1' }
];

const MENU_CATEGORIES = [
  { title: "ORGANIZE PDF", items: ['merge', 'split', 'organize', 'scan-to-pdf'] },
  { title: "OPTIMIZE PDF", items: ['compress', 'repair', 'ocr'] },
  { title: "CONVERT TO PDF", items: ['jpg-to-pdf', 'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf'] },
  { title: "CONVERT FROM PDF", items: ['pdf-to-jpg', 'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'pdf-to-pdfa'] },
  { title: "EDIT PDF", items: ['rotate', 'page-numbers', 'watermark', 'crop', 'edit-pdf'] },
  { title: "PDF SECURITY", items: ['unlock', 'protect', 'sign', 'redact', 'compare'] },
  { title: "PDF INTELLIGENCE", items: ['ai-summarizer', 'translate'] }
];

function MegaMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mega-menu-wrapper" ref={menuRef} onMouseEnter={() => setIsOpen(!('ontouchstart' in window) && true)} onMouseLeave={() => setIsOpen(false)}>
      <button className="mega-menu-trigger" onClick={(e) => {
        e.preventDefault();
        setIsOpen(!isOpen);
      }}>
        ALL PDF TOOLS <span className="chevron">▼</span>
      </button>
      <div className={`mega-menu-content ${isOpen ? 'open' : ''}`}>
        <div className="mega-menu-grid">
           {MENU_CATEGORIES.map((cat, i) => (
              <div key={i} className="mega-col">
                <h4 className="mega-col-title">{cat.title}</h4>
                {cat.items.map(itemId => {
                  const t = TOOLS.find(x => x.id === itemId);
                  if(!t) return null;
                  return (
                    <Link to={`/tool/${t.id}`} key={t.id} className="mega-link">
                      <span className="mega-icon" style={{color: t.color}}>{t.icon}</span> 
                      {t.title}
                    </Link>
                  )
                })}
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}

function AdComponent() {
  useEffect(() => {
    try {
      if (window) {
         (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch(e) { }
  }, []);

  return (
    <div className="ad-container">
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-0000000000000000"
           data-ad-slot="0000000000"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  );
}

function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = TOOLS.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="hero-title">Experience the Ultimate PDF Powerhouse</h1>
        <p className="hero-subtitle">Unlock total control over your documents with the world's most intuitive PDF toolkit. Fast, free, and built for modern professionals.</p>
        
        <div className="search-box-wrapper">
          <div className="search-box">
             <LayoutGrid size={20} className="search-icon" />
             <input 
              type="text" 
              placeholder="Search for tools (e.g. merge, word, protect...)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
        </div>
      </div>

      <div className="tools-grid">
        {filteredTools.map((tool) => (
          <Link to={`/tool/${tool.id}`} className="tool-card" key={tool.id}>
            <div className="tool-icon" style={{ color: tool.color }}>
              {tool.icon}
            </div>
            <h3 className="tool-title">{tool.title}</h3>
            <p className="tool-desc">{tool.desc}</p>
          </Link>
        ))}
        {filteredTools.length === 0 && (
          <div className="no-results">
             <h2>No tools found for "{searchQuery}"</h2>
             <p>Try searching for words like 'PDF', 'Word', or 'Images'.</p>
          </div>
        )}
      </div>
      
      <AdComponent />
    </div>
  );
}


function ToolPage({ id }) {
  const tool = TOOLS.find(t => t.id === id);
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [downloadLink, setDownloadLink] = useState('');
  const [outputName, setOutputName] = useState('');
  const [splitPages, setSplitPages] = useState('1');
  const [rotateAngle, setRotateAngle] = useState(90);
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOptions, setWatermarkOptions] = useState({ opacity: 0.3, size: 50, angle: 45 });
  const [pdfToJpgOptions, setPdfToJpgOptions] = useState({ 
    pages: 'all', 
    quality: 0.95, 
    scale: 2.0,
    format: 'jpeg'
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  if (!tool) return <div>Tool not found</div>;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files);
      setFiles(prev => [...prev, ...arr]);
      setIsDone(false);
      setDownloadLink('');
    }
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Render PDF preview using PDF.js
  const renderPdfPreview = async (blob) => {
    setTimeout(async () => {
      const canvas = document.getElementById('pdf-preview-canvas');
      if (!canvas || !window.pdfjsLib) return;
      try {
        const dataUrl = URL.createObjectURL(blob);
        setPreviewUrl(dataUrl);
        const pdf = await window.pdfjsLib.getDocument(dataUrl).promise;
        const page = await pdf.getPage(1);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (e) { 
        console.error("Preview failed", e); 
      }
    }, 100);
  };

  const processFile = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      
      // Map tool IDs to API endpoints
      const apiEndpoints = {
        'merge': '/api/merge',
        'split': '/api/split',
        'rotate': '/api/rotate',
        'protect': '/api/protect',
        'unlock': '/api/unlock',
        'watermark': '/api/watermark',
        'page-numbers': '/api/page-numbers',
        'jpg-to-pdf': '/api/jpg-to-pdf',
        'compress': '/api/compress',
        'ocr': '/api/ocr',
        'pdf-to-jpg': '/api/pdf-to-jpg',
        'word-to-pdf': '/api/word-to-pdf',
        'powerpoint-to-pdf': '/api/ppt-to-pdf',
        'excel-to-pdf': '/api/excel-to-pdf',
        'pdf-to-word': '/api/pdf-to-word',
        'html-to-pdf': '/api/html-to-pdf',
        'organize': '/api/organize',
        'sign': '/api/sign',
        'edit-pdf': '/api/edit'
      };

      const endpoint = apiEndpoints[id];
      
      if (!endpoint) {
        // For tools without API implementation yet
        alert(`${tool.title} is coming soon! This feature is being upgraded.`);
        setIsProcessing(false);
        return;
      }

      // Add files to formData
      if (id === 'merge' || id === 'jpg-to-pdf') {
        files.forEach(f => formData.append('files', f));
      } else {
        formData.append('file', files[0]);
      }

      // Add options based on tool type
      if (id === 'split') {
        formData.append('pages', splitPages);
      } else if (id === 'rotate') {
        formData.append('angle', rotateAngle);
      } else if (id === 'watermark') {
        const text = watermarkText || prompt("Enter watermark text:", "PdfKaro");
        if (!text) { setIsProcessing(false); return; }
        setWatermarkText(text);
        formData.append('text', text);
        formData.append('opacity', watermarkOptions.opacity);
        formData.append('angle', watermarkOptions.angle);
        formData.append('size', watermarkOptions.size);
      } else if (id === 'page-numbers') {
        formData.append('position', pageNumberOptions.position);
        formData.append('startFrom', pageNumberOptions.startFrom);
        formData.append('fontSize', pageNumberOptions.fontSize);
      } else if (id === 'protect' || id === 'unlock') {
        const pass = prompt(`Enter the password to ${id === 'protect' ? 'protect' : 'unlock'} this PDF:`);
        if (!pass) { setIsProcessing(false); return; }
        formData.append('password', pass);
      } else if (id === 'pdf-to-jpg') {
        formData.append('format', pdfToJpgOptions.format);
        formData.append('quality', pdfToJpgOptions.quality);
      } else if (id === 'organize') {
        const pageOrder = prompt("Enter page order (e.g., 3,1,2,4):", "1,2,3");
        if (!pageOrder) { setIsProcessing(false); return; }
        formData.append('pageOrder', pageOrder);
      } else if (id === 'sign') {
        const page = prompt("Enter page number for signature:", "1");
        formData.append('page', page || '1');
        formData.append('x', '100');
        formData.append('y', '100');
      } else if (id === 'edit-pdf') {
        const page = prompt("Enter page number to edit:", "1");
        const text = prompt("Enter text to add:", "Sample text");
        if (!text) { setIsProcessing(false); return; }
        formData.append('page', page || '1');
        formData.append('text', text);
        formData.append('x', '100');
        formData.append('y', '100');
      }

      // Make API call
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const result = await response.json();

      if (result.success) {
        // Set download link
        const baseUrl = window.location.origin;
        setDownloadLink(`${baseUrl}${result.downloadUrl}`);
        setOutputName(result.filename || `${tool.title.toLowerCase().replace(/ /g, '-')}.pdf`);
        setIsProcessing(false);
        setIsDone(true);
        
        // Render preview if it's a PDF
        if (id !== 'ocr' && !result.filename?.includes('.txt')) {
          try {
            const previewResponse = await fetch(`${baseUrl}${result.downloadUrl}`);
            const blob = await previewResponse.blob();
            renderPdfPreview(blob);
          } catch (e) {
            console.error('Preview failed', e);
          }
        }
      } else {
        throw new Error(result.message || 'Processing failed');
      }
    } catch (e) {
      console.error(e);
      alert(`Error: ${e.message}`);
      setIsProcessing(false);
    }
  };

  // Helper function to parse page ranges like "1-3,5,7-9"
  const parsePageRanges = (input, maxPages) => {
    const pages = new Set();
    const parts = input.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(end, maxPages); i++) {
            pages.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num);
        }
      }
    }
    
    return Array.from(pages).sort((a, b) => a - b);
  };

  const isMultiple = id === 'merge' || id === 'jpg-to-pdf';
  let acceptStr = ".pdf";
  if (id === 'jpg-to-pdf') acceptStr = "image/jpeg, image/png, image/webp";

  // Show options UI for specific tools
  const renderToolOptions = () => {
    if (id === 'split') {
      return (
        <div className="tool-options">
          <label>Pages to extract (e.g., "1-3,5,7-9"):</label>
          <input 
            type="text" 
            value={splitPages} 
            onChange={(e) => setSplitPages(e.target.value)}
            placeholder="Enter page numbers"
            className="option-input"
          />
          <small>Total pages in PDF will be shown after upload</small>
        </div>
      );
    }
    if (id === 'rotate') {
      return (
        <div className="tool-options">
          <label>Rotation Angle:</label>
          <select value={rotateAngle} onChange={(e) => setRotateAngle(Number(e.target.value))} className="option-select">
            <option value={90}>90° Clockwise</option>
            <option value={180}>180°</option>
            <option value={270}>90° Counter-clockwise</option>
          </select>
        </div>
      );
    }
    if (id === 'watermark') {
      return (
        <div className="tool-options">
          <label>Watermark Text:</label>
          <input 
            type="text" 
            value={watermarkText} 
            onChange={(e) => setWatermarkText(e.target.value)}
            placeholder="Enter watermark text"
            className="option-input"
          />
          <label>Opacity: {watermarkOptions.opacity}</label>
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.1"
            value={watermarkOptions.opacity}
            onChange={(e) => setWatermarkOptions({...watermarkOptions, opacity: Number(e.target.value)})}
            className="option-range"
          />
        </div>
      );
    }
    if (id === 'page-numbers') {
      return (
        <div className="tool-options">
          <label>Position:</label>
          <select 
            value={pageNumberOptions.position} 
            onChange={(e) => setPageNumberOptions({...pageNumberOptions, position: e.target.value})}
            className="option-select"
          >
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-center">Bottom Center</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-center">Top Center</option>
            <option value="top-left">Top Left</option>
          </select>
          <label>Start from:</label>
          <input 
            type="number" 
            min="1"
            value={pageNumberOptions.startFrom}
            onChange={(e) => setPageNumberOptions({...pageNumberOptions, startFrom: Number(e.target.value)})}
            className="option-input"
          />
        </div>
      );
    }
    if (id === 'pdf-to-jpg') {
      return (
        <div className="tool-options">
          <label>Pages to convert:</label>
          <select 
            value={pdfToJpgOptions.pages} 
            onChange={(e) => setPdfToJpgOptions({...pdfToJpgOptions, pages: e.target.value})}
            className="option-select"
          >
            <option value="all">All Pages</option>
            <option value="1">Page 1 only</option>
            <option value="1-5">Pages 1-5</option>
            <option value="custom">Custom range</option>
          </select>
          {pdfToJpgOptions.pages === 'custom' && (
            <input 
              type="text" 
              placeholder="e.g., 1,3,5-10"
              onChange={(e) => setPdfToJpgOptions({...pdfToJpgOptions, customRange: e.target.value})}
              className="option-input"
              style={{marginTop: '0.5rem'}}
            />
          )}
          <label>Image Quality: {(pdfToJpgOptions.quality * 100).toFixed(0)}%</label>
          <input 
            type="range" 
            min="0.5" 
            max="1" 
            step="0.05"
            value={pdfToJpgOptions.quality}
            onChange={(e) => setPdfToJpgOptions({...pdfToJpgOptions, quality: Number(e.target.value)})}
            className="option-range"
          />
          <label>Resolution Scale: {pdfToJpgOptions.scale}x</label>
          <select 
            value={pdfToJpgOptions.scale} 
            onChange={(e) => setPdfToJpgOptions({...pdfToJpgOptions, scale: Number(e.target.value)})}
            className="option-select"
          >
            <option value={1}>1x (Standard)</option>
            <option value={1.5}>1.5x (Good)</option>
            <option value={2}>2x (High)</option>
            <option value={3}>3x (Ultra HD)</option>
          </select>
          <label>Format:</label>
          <select 
            value={pdfToJpgOptions.format} 
            onChange={(e) => setPdfToJpgOptions({...pdfToJpgOptions, format: e.target.value})}
            className="option-select"
          >
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="tool-page-container">
      {files.length === 0 ? (
        <div className="upload-section">
          <h1 className="upload-title">{tool.title}</h1>
          <p className="upload-subtitle">{tool.desc}</p>
          
          <div className="upload-btn-wrapper">
             <button className="btn-upload btn-massive">
               Select {id === 'jpg-to-pdf' ? 'JPG images' : 'PDF files'}
             </button>
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileChange}
               multiple={isMultiple}
               accept={acceptStr}
             />
          </div>
          <div className="upload-drag-text">or drop files here</div>
        </div>
      ) : (
        <div className="processing-section">
          {(!isDone && !isProcessing) && (
             <>
                <div className="files-list">
                  {files.map((f, idx) => (
                    <div className="file-box-small" key={idx}>
                       <FileText size={32} color={tool.color} />
                       <span className="file-name-display" title={f.name}>{f.name}</span>
                       <button className="btn-remove-file" onClick={() => removeFile(idx)}><X size={16}/></button>
                    </div>
                  ))}
                  {isMultiple && (
                    <button className="add-more-btn" onClick={() => fileInputRef.current.click()}>+ Add More Files</button>
                  )}
                </div>
                
                {renderToolOptions()}
                
                <button className="btn-process btn-massive" onClick={processFile}>
                  {tool.title} <span className="arrow-right">→</span>
                </button>
             </>
          )}

          {isProcessing && (
            <div className="loading-state">
               <RefreshCw size={48} className="spinner" color={tool.color} />
               <h2>Working on it...</h2>
               <p>Please wait while {APP_NAME} processes your document securely.</p>
            </div>
          )}

          {isDone && (
            <div className="success-state">
                <CheckCircle2 size={64} color="#4CAF50" className="success-icon" />
                <h1>Task complete!</h1>
                <p>Your file has been processed successfully.</p>

                {/* Image Preview for PDF to JPG */}
                {id === 'pdf-to-jpg' && previewUrl && (
                  <div className="image-preview-container" style={{ margin: '1.5rem 0', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', padding: '1rem' }}>
                     <div style={{ padding: '8px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0', margin: '-1rem -1rem 1rem -1rem' }}>Image Preview</div>
                     <img src={previewUrl} alt="Converted" style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
                  </div>
                )}

                {/* PDF Live Preview Area - only for PDF outputs */}
                {id !== 'pdf-to-jpg' && downloadLink && (
                  <div className="pdf-preview-container" style={{ margin: '1.5rem 0', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                     <div style={{ padding: '8px', background: '#f8fafc', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Live PDF Preview (Page 1)</div>
                     <canvas id="pdf-preview-canvas" style={{ width: '100%', height: 'auto', display: 'block' }}></canvas>
                  </div>
                )}
                
                <div style={{ marginTop: '1.5rem' }}>
                    <a href={downloadLink} download={outputName} className="btn-download btn-massive">
                        Download Now
                    </a>
                </div>
                <button className="btn-secondary" onClick={() => { setFiles([]); setIsDone(false); setDownloadLink(''); setPreviewUrl(''); }}>
                    Back to {tool.title}
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Wrapper(props) {
  return <ToolPage id={props.id} key={props.id} />
}

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('pdfkaro_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pdfkaro_user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <div className="app-layout">
        <header className="navbar">
          <div className="navbar-content">
            <Link to="/" className="brand-logo">
               <HeartIcon color="#e91e63" />
               <span className="logo-pdf">Pdf</span><span className="logo-karo">Karo</span>
            </Link>
            <nav className="nav-links">
               <Link to="/tool/merge">MERGE PDF</Link>
               <Link to="/tool/split">SPLIT PDF</Link>
               <Link to="/tool/compress">COMPRESS PDF</Link>
               <MegaMenu />
            </nav>
            {user ? (
              <div className="nav-profile">
                <img src={user.avatar} alt="Avatar" className="avatar" />
                <button onClick={handleLogout} className="btn-logout">Logout</button>
              </div>
            ) : (
              <div className="nav-auth-group">
                <Link to="/login" className="nav-login-text">Log in</Link>
                <Link to="/signup" className="nav-signup-btn">Sign up</Link>
              </div>
            )}
          </div>
        </header>

        <main className="main-viewport">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/signup" element={<SignUp setUser={setUser} />} />
            {TOOLS.map(t => (
               <Route key={t.id} path={`/tool/${t.id}`} element={<Wrapper id={t.id} />} />
            ))}
          </Routes>
        </main>
        
        
        <div style={{ padding: '0 2rem' }}>
          <AdComponent />
        </div>

        <footer className="footer">
          <p>© {new Date().getFullYear()} {APP_NAME} - <span className="v-tag">v3.0 - Full Online Website</span> | Powered by Server Engine</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

function HeartIcon({color}) {
   return <svg width="24" height="24" viewBox="0 0 24 24" fill={color} stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
}
