import { useState, useRef, useEffect } from 'react';
import { 
  Scale, 
  RefreshCcw, 
  Download, 
  Paperclip, 
  Send, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Copy,
  ChevronRight,
  MessageSquare,
  Share2,
  Mail,
  MessageCircle,
  Send as SendIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SYSTEM_PROMPT } from './constants';
import { getGeminiResponse, getGeminiResponseWithImage } from './geminiService';

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  file?: {
    name: string;
    type: string;
  };
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Min. corridor width for A-2 occupancy?",
    "Egress requirements for 450 occupants.",
    "Ramp accessibility criteria."
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input || (attachedFile ? `[System: Attached ${attachedFile.name}]` : ''),
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      file: attachedFile ? { name: attachedFile.name, type: attachedFile.type } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentFile = attachedFile;
    
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      let responseText = '';
      if (currentFile && currentFile.type.startsWith('image/')) {
        responseText = await getGeminiResponseWithImage(
          currentInput || "Please review this drawing for SBC-201:2024 compliance.",
          currentFile.data,
          currentFile.type,
          SYSTEM_PROMPT
        );
      } else {
        responseText = await getGeminiResponse(currentInput, messages, SYSTEM_PROMPT);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      };

      // Extract suggestions from response
      const suggestionMatch = responseText.match(/## H\) Suggested Follow-up Questions[\s\S]*?(1\.[\s\S]*?)(?:\n---|$)/i);
      if (suggestionMatch && suggestionMatch[1]) {
        const extracted = suggestionMatch[1]
          .split(/[|]|\d+\./)
          .map(s => s.trim())
          .filter(s => s.length > 5 && s.endsWith('?'))
          .slice(0, 3);
        
        if (extracted.length > 0) {
          setSuggestions(extracted);
        }
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error fetching Gemini response:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Error: Unable to connect to the AI engine. Please check your configurations.",
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File too large. Max 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachedFile({
          name: file.name,
          type: file.type,
          data: base64.split(',')[1]
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const injectPrompt = (text: string, immediate: boolean = false) => {
    setInput(text);
    if (immediate) {
      // Small timeout to ensure state update is processed or just use the text directly in handleSend
      setTimeout(() => {
        const sendBtn = document.querySelector('button[aria-label="Send Message"]') as HTMLButtonElement;
        if (sendBtn) sendBtn.click();
      }, 50);
    } else {
      textAreaRef.current?.focus();
    }
  };

  const clearSession = () => {
    if (window.confirm('Start a new session? The current conversation will be cleared.')) {
      setMessages([]);
      setAttachedFile(null);
      setInput('');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(id);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const shareVia = (platform: string, content: Message) => {
    // Helper to format for sharing (Plain Text or HTML based on platform)
    const formatForEmail = (str: string) => {
      let res = str;
      // For email, we use plain text with clear structure since mailto doesn't handle HTML well
      res = res.replace(/^##\s+(.+)$/gm, '\n$1\n' + '='.repeat(15));
      res = res.replace(/^###\s+(.+)$/gm, '\n$1\n' + '-'.repeat(15));
      res = res.replace(/[*#]/g, '');
      return res;
    };

    const formatAsRichText = (str: string) => {
      let res = str;
      // Replace headers before stripping #
      res = res.replace(/^##\s+(.+)$/gm, '<b style="color: #38b9ff; font-size: 1.25em; display: block; margin-top: 15px;">$1</b>');
      res = res.replace(/^###\s+(.+)$/gm, '<b style="color: #c8a96e; display: block; margin-top: 10px;">$1</b>');
      
      // Handle status colors
      res = res.replace(/\bNON-COMPLIANT\b/gi, '<b style="color: #ef4444;">$&</b>');
      res = res.replace(/\bCOMPLIANT\b/gi, '<b style="color: #10b981;">$&</b>');
      res = res.replace(/\bINSUFFICIENT INFO\b/gi, '<b style="color: #f59e0b;">$&</b>');

      // Strip remaining * and #
      res = res.replace(/[*#]/g, '');
      return res;
    };

    const isEmail = platform === 'email';
    const processedContent = isEmail ? formatForEmail(content.content) : formatAsRichText(content.content);
    const text = `SBC-201:2024 Compliance Finding — SDC\n\n${processedContent}`;
    const encodedText = encodeURIComponent(text);
    
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodedText}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:?subject=SBC-201:2024 Compliance Finding&body=${encodedText}`;
        break;
      case 'teams':
        window.open(`https://teams.microsoft.com/l/chat/0/0?users=&message=${encodedText}`, '_blank');
        break;
    }
  };

  const generatePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-GB');

    // Simple markdown-ish to HTML converter for PDF
    const formatContent = (content: string) => {
      let html = content;
      
      // Handle Headers (A) Summary, etc) before stripping #
      html = html.replace(/^##\s+(.+)$/gm, '<h2 style="color: #38b9ff; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px; font-size: 16pt; font-family: sans-serif;">$1</h2>');
      html = html.replace(/^###\s+(.+)$/gm, '<h3 style="color: #c8a96e; margin-top: 20px; font-size: 13pt; font-family: sans-serif;">$1</h3>');

      // Status colors
      html = html.replace(/\bNON-COMPLIANT\b/gi, (match) => `<span style="color: #ef4444; font-weight: bold;">${match}</span>`);
      html = html.replace(/\bCOMPLIANT\b/gi, (match) => {
        // Avoid double coloring if it was already caught by NON-COMPLIANT
        if (match.toUpperCase() === 'COMPLIANT') {
          return `<span style="color: #10b981; font-weight: bold;">${match}</span>`;
        }
        return match;
      });
      html = html.replace(/\bINSUFFICIENT INFO\b/gi, (match) => `<span style="color: #f59e0b; font-weight: bold;">${match}</span>`);

      // Remove remaining markdown markers
      html = html.replace(/[*#]/g, '');

      // Handle tables (very basic regex-based conversion for the PDF)
      const tableRegex = /\|(.+)\|[\r\n]+\|([-| ]+)\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
      html = html.replace(tableRegex, (match, header, separator, rows) => {
        const headerCols = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2; text-align: left;">${c.trim()}</th>`).join('');
        const bodyRows = rows.trim().split('\n').map((row: string) => {
          const cols = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td style="border: 1px solid #ddd; padding: 8px;">${c.trim()}</td>`).join('');
          return `<tr>${cols}</tr>`;
        }).join('');
        return `<table style="width: 100%; border-collapse: collapse; margin: 15px 0;"><thead><tr>${headerCols}</tr></thead><tbody>${bodyRows}</tbody></table>`;
      });

      // Handle simple newlines
      html = html.replace(/\n/g, '<br>');
      
      return html;
    };

    const aiMessages = messages.filter(m => m.role === 'assistant');
    const userQueries = messages.filter(m => m.role === 'user');

    const firstQuery = userQueries[0]?.content.replace(/[*#]/g, '').trim() || 'Compliance Assessment';
    const dynamicTitle = firstQuery.length > 80 ? firstQuery.slice(0, 77) + '...' : firstQuery;
    const reportTitle = `${dynamicTitle} — SBC-201:2024`;

    let summaryItems = userQueries.map((m) => {
      const txt = m.content;
      return `<li>${txt.slice(0, 150)}${txt.length > 150 ? '…' : ''}</li>`;
    }).join('');

    const conversationHTML = messages.map(msg => `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <div style="font-family: monospace; font-size: 10px; color: #666; margin-bottom: 8px; border-left: 3px solid ${msg.role === 'user' ? '#c8a96e' : '#38b9ff'}; padding-left: 8px;">
          ${msg.role.toUpperCase()} [${msg.timestamp}]
        </div>
        <div style="padding: 16px; border: 1px solid #eee; border-radius: 12px; background: ${msg.role === 'user' ? '#fcfaf7' : '#fff'}; color: #1a202c; font-size: 11pt;">
          ${formatContent(msg.content)}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Cormorant+Garamond:wght@400;700&display=swap');
            body { font-family: 'IBM Plex Sans', sans-serif; padding: 40px; line-height: 1.6; color: #1a202c; }
            .header { border-bottom: 3px solid #38b9ff; margin-bottom: 30px; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .logo-container { display: flex; align-items: center; gap: 15px; }
            .logo { width: 60px; height: 60px; object-fit: contain; }
            .title-area { font-family: 'Cormorant Garamond', serif; }
            .title { font-size: 28px; font-weight: bold; color: #0a1220; margin: 0; }
            .subtitle { font-size: 14px; color: #c8a96e; font-weight: 600; margin-top: 4px; }
            .meta { font-size: 11px; color: #6e8fad; text-align: right; font-family: monospace; }
            
            .exec-summary { background: #f4f8fc; border-left: 4px solid #38b9ff; padding: 18px; border-radius: 0 8px 8px 0; margin-bottom: 25px; }
            .exec-summary h3 { margin: 0 0 8px 0; font-family: 'Cormorant Garamond', serif; font-size: 18px; color: #0a1220; }
            .exec-summary ul { margin: 0; padding-left: 20px; font-size: 10pt; }
            
            .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; font-size: 10px; color: #3c5570; text-align: center; }
            table { font-size: 10pt; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="/diyar_logo.png" class="logo" />
              <div class="title-area">
                <div class="title">${reportTitle}</div>
                <div class="subtitle">Saudi Diyar Consultants</div>
              </div>
            </div>
            <div class="meta">
              <div>Date: ${dateStr}</div>
              <div>Time: ${timeStr}</div>
            </div>
          </div>

          <div class="exec-summary">
            <h3>Executive Summary</h3>
            <p style="font-size: 10pt; margin-bottom: 10px;">This report documents ${aiMessages.length} compliance assessment(s) conducted against SBC-201:2024. All citations reference the official Saudi Building Code strictly.</p>
            <ul>${summaryItems}</ul>
          </div>

          ${conversationHTML}

          <div class="footer">
            Restricted for Internal Use by SDC Only<br>
            Developed by Sayed Auf<br>
            Version (V-01) 2026
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-screen relative z-10">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-7 h-20 bg-gradient-to-r from-bg-deep/97 to-bg-panel/97 border-b border-cyan/20 backdrop-blur-xl shrink-0 relative z-50">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 bg-bg-deep border border-gold/45 rounded flex flex-col items-center justify-center shrink-0 font-display text-gold leading-tight shadow-[0_0_15px_rgba(200,169,110,0.15)]">
            <div className="text-[9px] font-bold whitespace-nowrap uppercase tracking-wider">Saudi Diyar Consultant</div>
            <div className="text-[7px] font-medium whitespace-nowrap opacity-80">AI Integration & Automation Unit</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-xl font-semibold text-[#d8e6f5] tracking-wide leading-none">
              SBC-201:2024 Architectural Code Advisor
            </h1>
            <span className="font-mono text-[10px] text-[#c8a96e] font-bold tracking-[1.5px] uppercase">
              Saudi Diyar Consultants — Architectural Department
            </span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <motion.div 
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="w-1.5 h-1.5 bg-teal rounded-full shadow-[0_0_8px_var(--color-teal)]" 
          />
          <span className="font-mono text-[10px] text-teal tracking-widest uppercase">AI Engine Active</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4.5 py-2 bg-gradient-to-br from-gold/12 to-gold/6 border border-gold/35 rounded-lg text-gold font-mono text-[11px] font-semibold tracking-wider cursor-pointer hover:from-gold/22 hover:to-gold/12 hover:border-gold hover:shadow-[0_0_16px_rgba(200,169,110,0.2)] transition-all"
          >
            <Download size={14} /> Export Report
          </button>
          <button 
            onClick={clearSession}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose/10 border border-rose/25 rounded-lg text-rose font-mono text-[11px] cursor-pointer hover:bg-rose/20 hover:border-rose transition-all"
          >
            <RefreshCcw size={14} /> New Session
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-bg-deep/80 border-r border-cyan/10 flex flex-col overflow-hidden hidden md:flex">
          <div className="p-5 pt-6 pb-3 overflow-y-auto">
            <div className="font-mono text-[9px] text-slate-600 tracking-[2px] uppercase mb-3.5">Session Info</div>
            
            <div className="bg-cyan/5 border border-cyan/10 rounded-xl p-3 mb-2.5">
              <div className="font-mono text-[9px] text-slate-600 tracking-wider uppercase mb-1">Reference Code</div>
              <div className="text-xs text-cyan font-medium">SBC-201:2024</div>
            </div>

            <div className="h-px bg-cyan/10 my-4" />

            <div className="font-mono text-[9px] text-slate-600 tracking-[2px] uppercase mb-3">Follow-up Suggestions</div>
            <div className="space-y-2">
              {suggestions.map((text, i) => (
                <button 
                  key={i} 
                  onClick={() => injectPrompt(text, true)}
                  className="w-full flex gap-2.5 items-start text-[11px] text-slate-400 leading-snug p-2.5 rounded-lg border border-cyan/5 bg-cyan/5 hover:border-cyan/30 hover:bg-cyan/10 hover:text-cyan transition-all text-left group cursor-pointer"
                >
                  <ChevronRight size={10} className="text-cyan shrink-0 mt-0.5 opacity-40 group-hover:opacity-100" />
                  <span>{text}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-cyan/10 my-4" />

            <div className="space-y-2.5">
              <div className="bg-cyan/5 border border-cyan/10 rounded-xl p-3">
                <div className="font-mono text-[9px] text-slate-600 tracking-wider uppercase mb-1">Role</div>
                <div className="text-xs text-slate-400">Senior Architect / SBC-024 Committee</div>
              </div>

              <div className="bg-cyan/5 border border-cyan/10 rounded-xl p-3">
                <div className="font-mono text-[9px] text-slate-600 tracking-wider uppercase mb-1">Session Date</div>
                <div className="text-xs text-slate-400">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>

              <div className="bg-cyan/5 border border-cyan/10 rounded-xl p-3">
                <div className="font-mono text-[9px] text-slate-600 tracking-wider uppercase mb-1">Messages</div>
                <div className="text-xs text-cyan font-medium">{messages.length}</div>
              </div>
            </div>
          </div>

          <div className="mt-auto p-4 border-t border-cyan/10 font-mono text-[8.5px] text-gold tracking-widest leading-relaxed text-center group transition-all duration-300">
            <div className="transition-all duration-300" style={{ textShadow: '0 0 8px rgba(200, 169, 110, 0.45)' }}>
              <span className="text-red-500 font-bold" style={{ color: '#ff3b30', textShadow: '0 0 12px rgba(255, 59, 48, 0.85), 0 0 3px rgba(255, 59, 48, 0.4)' }}>Restricted</span> for Internal Use by SDC Only<br />
              <span className="opacity-95">Developed by Sayed Auf</span><br />
              <span className="opacity-90">Version (V-01) 2026</span>
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-bg-void/50">
          <div className="flex-1 overflow-y-auto px-9 py-7 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-cyan/10">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center flex-1 text-center p-10 mt-10"
                >
                  <div className="px-8 py-5 bg-bg-deep border border-gold/45 rounded-xl flex flex-col items-center justify-center mb-8 shadow-[0_0_25px_rgba(200,169,110,0.15)] font-display text-gold leading-tight">
                    <div className="text-lg font-bold mb-1 tracking-wide">Saudi Diyar Consultant</div>
                    <div className="text-sm font-semibold opacity-90 uppercase tracking-widest">AI Integration & Automation Unit</div>
                  </div>
                  <h2 className="font-display text-3xl font-semibold text-[#d8e6f5] mb-2.5">
                    SBC-201:2024 Compliance Advisor
                  </h2>
                  <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
                    Acting as a senior architect and SBC-024 committee member, I review your questions, drawings, and documents strictly against SBC-201:2024. Upload a PDF or image, or type a compliance question to begin.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                    {[
                      "What is the minimum corridor width for an A-2 occupancy under SBC-201:2024?",
                      "Review the egress requirements for an office building with 450 occupants.",
                      "Fire resistance ratings for a high-rise residential building.",
                      "Accessibility requirements for ramps under SBC-201:2024.",
                      "Maximum travel distance to an exit for an S-1 occupancy."
                    ].map((text, i) => (
                      <button 
                        key={i}
                        onClick={() => injectPrompt(text)}
                        className="px-3.5 py-1.5 bg-cyan/5 border border-cyan/20 rounded-full text-xs text-slate-400 hover:bg-cyan/10 hover:border-cyan hover:text-cyan transition-all cursor-pointer"
                      >
                        {text.length > 40 ? text.slice(0, 40) + '...' : text}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                messages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3.5",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center bg-transparent border border-cyan/45 shrink-0 mt-0.5 overflow-hidden"
                    )}>
                      {msg.role === 'user' ? <div className="text-gold font-bold">YOU</div> : <img src="/diyar_logo.png" className="w-full h-full object-cover" />}
                    </div>
                    
                    <div className={cn(
                      "flex-1 max-w-[85%] flex flex-col",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "flex items-center gap-2 mb-1.5",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}>
                        <span className="font-mono text-[10px] text-slate-600 tracking-wider uppercase">
                          {msg.role === 'user' ? 'You' : 'SBC-201:2024 Architect'}
                        </span>
                        <span className="font-mono text-[9px] text-slate-600">
                          {msg.timestamp}
                        </span>
                      </div>

                      <div className={cn(
                        "p-4 px-5 rounded-[16px] leading-relaxed text-[13.5px] border",
                        msg.role === 'user' 
                          ? "bg-gradient-to-br from-gold/14 to-gold/6 border-gold/25 rounded-tr-none text-[#d8e6f5]"
                          : "bg-bg-card border-cyan/10 rounded-tl-none text-[#d8e6f5]"
                      )}>
                        {msg.file && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/5 rounded-lg mb-3 text-xs text-cyan">
                            <Paperclip size={12} />
                            <span>{msg.file.name}</span>
                          </div>
                        )}
                        <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-cyan prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-code:text-teal prose-pre:bg-bg-void/80 prose-pre:border prose-pre:border-cyan/10 prose-blockquote:border-cyan prose-blockquote:bg-cyan/5 prose-table:border prose-table:border-cyan/10 prose-th:bg-cyan/5 prose-th:p-2 prose-td:p-2 prose-tr:border-b prose-tr:border-cyan/5">
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h2: ({ node, ...props }) => <h2 className="text-cyan font-bold border-b border-cyan/10 pb-2 mb-4 mt-8" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="text-gold font-bold mb-2 mt-6" {...props} />,
                              strong: ({ children }) => {
                                const content = String(children);
                                if (content.toUpperCase().includes('NON-COMPLIANT')) {
                                  return <strong className="text-rose font-bold">{children}</strong>;
                                }
                                if (content.toUpperCase().includes('COMPLIANT')) {
                                  return <strong className="text-green-500 font-bold">{children}</strong>;
                                }
                                if (content.toUpperCase().includes('INSUFFICIENT INFO')) {
                                  return <strong className="text-amber-500 font-bold">{children}</strong>;
                                }
                                return <strong className="font-bold">{children}</strong>;
                              }
                            }}
                          >
                            {msg.content}
                          </Markdown>
                        </div>
                      </div>

                      {msg.role === 'assistant' && (
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <span className="font-mono text-[9px] text-slate-600 tracking-widest uppercase">Share:</span>
                          <button 
                            onClick={() => copyToClipboard(msg.content, `msg-${i}`)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-cyan/20 text-cyan font-mono text-[9px] hover:bg-cyan/10 transition-all cursor-pointer"
                          >
                             {copyStatus === `msg-${i}` ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                             {copyStatus === `msg-${i}` ? 'Copied' : 'Copy'}
                          </button>
                          <button 
                            onClick={() => shareVia('whatsapp', msg)}
                            className="flex items-center gap-1 py-1 px-2 rounded-md border border-green-500/30 text-green-500 font-mono text-[9px] hover:bg-green-500/10 transition-all cursor-pointer"
                          >
                            WhatsApp
                          </button>
                          <button 
                            onClick={() => shareVia('telegram', msg)}
                            className="flex items-center gap-1 py-1 px-2 rounded-md border border-sky-500/30 text-sky-500 font-mono text-[9px] hover:bg-sky-500/10 transition-all cursor-pointer"
                          >
                            Telegram
                          </button>
                          <button 
                            onClick={() => shareVia('teams', msg)}
                            className="flex items-center gap-1 py-1 px-2 rounded-md border border-indigo-500/30 text-indigo-500 font-mono text-[9px] hover:bg-indigo-500/10 transition-all cursor-pointer"
                          >
                            Teams
                          </button>
                          <button 
                            onClick={() => shareVia('email', msg)}
                            className="flex items-center gap-1 py-1 px-2 rounded-md border border-amber-500/30 text-amber-500 font-mono text-[9px] hover:bg-amber-500/10 transition-all cursor-pointer"
                          >
                            Email
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}

              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3.5"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 bg-gradient-to-br from-cyan/20 to-cyan/6 border border-cyan/45 text-cyan">
                    SBC
                  </div>
                  <div className="bg-bg-card border border-cyan/10 rounded-[16px] rounded-tl-none p-3.5 flex items-center gap-1.5">
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <motion.div 
                        key={i}
                        animate={{ y: [0, -5, 0], opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay }}
                        className="w-1.5 h-1.5 bg-cyan rounded-full" 
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-9 py-3 pb-4 bg-gradient-to-t from-bg-void to-transparent shrink-0">
            {attachedFile && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2 bg-cyan/10 border border-cyan/25 rounded-lg mb-2 text-xs text-cyan group"
              >
                <Paperclip size={14} />
                <span className="flex-1 truncate">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="text-rose opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                  <X size={14} />
                </button>
              </motion.div>
            )}

            <div className={cn(
              "flex gap-3 items-end bg-bg-input border border-cyan/20 rounded-[16px] p-2.5 px-3 transition-all",
              "focus-within:border-cyan focus-within:ring-4 focus-within:ring-cyan/5 focus-within:shadow-[0_0_20px_rgba(56,185,255,0.15)]"
            )}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-8.5 h-8.5 bg-cyan/5 border border-cyan/10 rounded-lg text-slate-500 flex items-center justify-center hover:border-cyan hover:text-cyan transition-all cursor-pointer"
              >
                <Paperclip size={16} />
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" />
              </button>
              
              <textarea 
                ref={textAreaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a compliance question or description for review..."
                className="flex-1 bg-transparent border-none outline-none text-[#d8e6f5] text-sm leading-relaxed resize-none max-h-40 min-h-[22px] py-1.5 placeholder:text-slate-700"
                rows={1}
              />

              <button 
                onClick={handleSend}
                disabled={(!input.trim() && !attachedFile) || isLoading}
                aria-label="Send Message"
                className="w-9 h-9 bg-gradient-to-br from-cyan/20 to-cyan/10 border border-cyan/45 rounded-xl text-cyan flex items-center justify-center hover:from-cyan/30 hover:shadow-cyan-glow hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100 cursor-pointer"
              >
                <SendIcon size={16} />
              </button>
            </div>

            <div className="flex flex-col mt-2 gap-1 items-center">
              <div className="flex items-center justify-between w-full px-1">
                <span className="font-mono text-[9px] text-slate-800 tracking-wider">
                  Enter to send · Shift+Enter for new line · 📎 attach drawings
                </span>
                <span className="font-mono text-[9px] text-slate-800">
                  {input.length}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-lg bg-bg-panel border border-cyan/20 rounded-[22px] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-cyan/10">
                <h3 className="font-display text-xl font-semibold text-[#d8e6f5]">Export Conversation Report</h3>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center bg-rose/5 border border-rose/20 rounded-lg text-rose hover:bg-rose/15 transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-7">
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Generate a comprehensive report of this session. The report includes an <strong>Executive Summary</strong>, full conversation log, all compliance findings, and timestamps — ready for internal distribution.
                </p>

                <div className="space-y-3">
                  <button 
                    onClick={generatePDF}
                    className="w-full p-3.5 bg-gradient-to-br from-gold/20 to-gold/10 border border-gold/40 rounded-xl text-gold font-mono text-xs font-semibold tracking-wide hover:from-gold/30 hover:shadow-[0_0_20px_rgba(200,169,110,0.2)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={16} /> Generate Full Session Log (PDF)
                  </button>
                  <button 
                    onClick={() => {
                      const fullLog = messages.map(m => `[${m.timestamp}] ${m.role.toUpperCase()}\n${m.content}`).join('\n\n');
                      copyToClipboard(fullLog, 'full-log');
                    }}
                    className="w-full p-3.5 bg-cyan/5 border border-cyan/20 rounded-xl text-cyan font-mono text-xs font-semibold tracking-wide hover:bg-cyan/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy size={16} /> 
                    {copyStatus === 'full-log' ? 'Copied Full Log' : 'Copy Full Conversation Log'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
