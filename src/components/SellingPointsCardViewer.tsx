import React, { useState } from 'react';
import { Sparkles, Copy, Check, FileText, Code, CheckCheck, Palette, Layers } from 'lucide-react';

interface SellingPointsCardViewerProps {
  rawText: string;
  onCopySuccess?: (msg: string) => void;
  playSound?: (ref: React.RefObject<HTMLAudioElement | null>) => void;
  copySoundRef?: React.RefObject<HTMLAudioElement | null>;
}

interface ParsedSection {
  id: string;
  title: string;
  lines: string[];
  isSpec: boolean;
  rawText: string;
}

export default function SellingPointsCardViewer({
  rawText,
  onCopySuccess,
  playSound,
  copySoundRef
}: SellingPointsCardViewerProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'raw'>('card');

  const parsedSections = parseSellingPoints(rawText);

  const notifyCopied = (type: string, message: string) => {
    setCopiedType(type);
    if (playSound && copySoundRef) {
      playSound(copySoundRef);
    }
    if (onCopySuccess) {
      onCopySuccess(message);
    }
    setTimeout(() => {
      setCopiedType(null);
    }, 1800);
  };

  // 1. Copy as Rich HTML (for SmartStore, Cafe24, Coupang SmartEditor)
  const handleCopyRichHtml = async (singleSection?: ParsedSection) => {
    const sectionsToCopy = singleSection ? [singleSection] : parsedSections;
    const htmlContent = generateRichHtml(sectionsToCopy);
    const plainText = generatePlainText(sectionsToCopy);

    const typeKey = singleSection ? `rich-${singleSection.id}` : 'rich-all';

    let copied = false;

    // Try modern Clipboard API first
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);
        copied = true;
      } catch (err) {
        console.warn('ClipboardItem failed, trying fallback:', err);
      }
    }

    // Fallback: hidden contenteditable element for iframe compatibility
    if (!copied) {
      const container = document.createElement('div');
      container.contentEditable = 'true';
      container.innerHTML = htmlContent;
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.opacity = '0';
      document.body.appendChild(container);

      const range = document.createRange();
      range.selectNodeContents(container);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
        try {
          copied = document.execCommand('copy');
        } catch (e) {
          console.error('execCommand copy failed:', e);
        }
        sel.removeAllRanges();
      }
      document.body.removeChild(container);
    }

    if (copied) {
      notifyCopied(
        typeKey,
        singleSection
          ? `선택한 카드 [${singleSection.title}] 서식이 복사되었습니다. (에디터에 바로 붙여넣기)`
          : '전체 소구점 카드가 서식(스타일/색상)과 함께 복사되었습니다. (스마트스토어/에디터에 Ctrl+V)'
      );
    } else {
      // Last resort fallback
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(plainText);
        notifyCopied(typeKey, '텍스트로 복사되었습니다.');
      }
    }
  };

  // 2. Copy as Clean Plain Text (tags stripped)
  const handleCopyPlainText = async () => {
    const plainText = generatePlainText(parsedSections);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(plainText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = plainText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      notifyCopied('plain-all', '순수 텍스트(태그 제거)가 복사되었습니다.');
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Copy Raw Text (including [red] tags)
  const handleCopyRaw = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(rawText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = rawText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      notifyCopied('raw-all', '태그 포함 원문이 복사되었습니다.');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              viewMode === 'card'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>카드 뷰 (상세페이지형)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              viewMode === 'raw'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>텍스트 원문</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Main Primary Action: Copy Rich HTML */}
          <button
            type="button"
            onClick={() => handleCopyRichHtml()}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-md shadow-purple-950/40 flex items-center gap-1.5 transition-all cursor-pointer border border-purple-400/30 active:scale-95"
            title="스마트스토어, 카페24, 쿠팡 에디터에 붙여넣을 때 배경색, 테두리, 글자색이 그대로 적용됩니다"
          >
            {copiedType === 'rich-all' ? (
              <>
                <CheckCheck className="w-4 h-4 text-emerald-300" />
                <span className="text-emerald-200">서식 복사완료!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>서식 복사 (스마트스토어/에디터용)</span>
              </>
            )}
          </button>

          {/* Clean Text Copy */}
          <button
            type="button"
            onClick={handleCopyPlainText}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            title="색상 태그를 제거한 순수 텍스트만 복사"
          >
            {copiedType === 'plain-all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>텍스트 복사</span>
          </button>

          {/* Raw Copy */}
          <button
            type="button"
            onClick={handleCopyRaw}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded-lg border border-slate-700/60 flex items-center gap-1 transition-colors cursor-pointer"
            title="[red] 등 태그가 포함된 원본 문자열 복사"
          >
            {copiedType === 'raw-all' ? <Check className="w-3 h-3 text-emerald-400" /> : <FileText className="w-3 h-3" />}
            <span>원문</span>
          </button>
        </div>
      </div>

      {/* View Modes */}
      {viewMode === 'card' ? (
        <div className="space-y-4 p-4 md:p-6 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
          {parsedSections.map((section) => (
            <div
              key={section.id}
              className={`relative group rounded-md p-6 transition-all text-center select-text ${
                section.isSpec
                  ? 'bg-[#fdf6e6] border-l-[5px] border-[#d97706] border-y border-r border-[#fde68a]/70 shadow-sm'
                  : 'bg-[#f3f6fa] border-l-[5px] border-[#7c3aed] border-y border-r border-[#e2e8f0] shadow-sm'
              }`}
            >
              {/* Individual Card Copy Button on Hover */}
              <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleCopyRichHtml(section)}
                  className="px-2 py-1 bg-white/95 hover:bg-white text-slate-700 hover:text-purple-700 text-[11px] font-semibold rounded border border-slate-300 shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                  title="이 카드만 서식과 함께 복사"
                >
                  {copiedType === `rich-${section.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>카드 복사</span>
                    </>
                  )}
                </button>
              </div>

              {/* Title */}
              {section.title && (
                <div
                  className={`text-[17px] md:text-[18px] font-bold tracking-tight mb-3 ${
                    section.isSpec ? 'text-[#b45309]' : 'text-[#6d28d9]'
                  }`}
                >
                  {section.title}
                </div>
              )}

              {/* Content Lines */}
              <div
                className={`text-[14px] md:text-[15px] font-medium leading-[1.85] ${
                  section.isSpec ? 'text-slate-800' : 'text-slate-900'
                }`}
              >
                {section.lines.map((line, lIdx) => (
                  <div key={lIdx} className="my-0.5">
                    {renderDecoratedLine(line)}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Helper hint */}
          <div className="text-center pt-1">
            <span className="text-[11px] text-slate-400 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800 inline-flex items-center gap-1">
              <span className="text-amber-400">💡 Tip:</span>
              상단의 <b className="text-purple-300 font-semibold">[서식 복사]</b> 버튼을 누른 후 스마트스토어/카페24 에디터에 붙여넣기(Ctrl+V)하면 위 카드 박스와 강조 색상이 그대로 유지됩니다.
            </span>
          </div>
        </div>
      ) : (
        <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
          {rawText}
        </pre>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Helper: Parse Raw Text into Structured Sections
// -------------------------------------------------------------
function parseSellingPoints(text: string): ParsedSection[] {
  if (!text) return [];

  const rawBlocks = text.split(/\n\s*\n/);
  const sections: ParsedSection[] = [];

  rawBlocks.forEach((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let title = '';
    let contentLines = [...lines];

    // Check if first line is a title bracket e.g. [코디제안], [상품스펙]
    const firstLine = lines[0];
    const match = firstLine.match(/^\[(.*?)\]$/);
    if (match) {
      title = `[${match[1]}]`;
      contentLines = lines.slice(1);
    } else if (firstLine.startsWith('[') && firstLine.includes(']')) {
      const closingIdx = firstLine.indexOf(']');
      title = firstLine.substring(0, closingIdx + 1);
      const restOfFirstLine = firstLine.substring(closingIdx + 1).trim();
      if (restOfFirstLine) {
        contentLines = [restOfFirstLine, ...lines.slice(1)];
      } else {
        contentLines = lines.slice(1);
      }
    } else if (firstLine.includes('스펙') || firstLine.startsWith('■')) {
      title = '[상품스펙]';
    } else {
      title = `[포인트 ${idx + 1}]`;
    }

    const isSpec = title.includes('스펙') || title.includes('spec') || contentLines.some(l => l.startsWith('■'));

    sections.push({
      id: `section-${idx}`,
      title,
      lines: contentLines,
      isSpec,
      rawText: trimmed
    });
  });

  // If no block separation matched, treat as single section
  if (sections.length === 0 && text.trim()) {
    return [{
      id: 'section-0',
      title: '[상품특징]',
      lines: text.trim().split('\n').map(l => l.trim()).filter(Boolean),
      isSpec: text.includes('■'),
      rawText: text.trim()
    }];
  }

  return sections;
}

// -------------------------------------------------------------
// Helper: Render Line in React with Colors
// -------------------------------------------------------------
function renderDecoratedLine(line: string) {
  // Regex to match [red]...[/red], [blue]...[/blue], [orange]...[/orange]
  const regex = /\[(red|blue|orange)\](.*?)\[\/\1\]/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.substring(lastIndex, match.index));
    }

    const color = match[1].toLowerCase();
    const content = match[2];

    let colorClass = 'text-rose-600 font-bold';
    let inlineStyle: React.CSSProperties = { color: '#e11d48', fontWeight: 700 };

    if (color === 'blue') {
      colorClass = 'text-blue-600 font-bold';
      inlineStyle = { color: '#2563eb', fontWeight: 700 };
    } else if (color === 'orange') {
      colorClass = 'text-amber-600 font-bold';
      inlineStyle = { color: '#d97706', fontWeight: 700 };
    }

    parts.push(
      <span key={match.index} className={colorClass} style={inlineStyle}>
        {content}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.substring(lastIndex));
  }

  return parts.length > 0 ? parts : line;
}

// -------------------------------------------------------------
// Helper: Generate Rich HTML for Clipboard
// -------------------------------------------------------------
function generateRichHtml(sections: ParsedSection[]): string {
  const cardsHtml = sections.map((sec) => {
    const isSpec = sec.isSpec;
    const borderLeftColor = isSpec ? '#d97706' : '#7c3aed';
    const bgColor = isSpec ? '#fdf6e6' : '#f3f6fa';
    const borderOthers = isSpec ? '1px solid #fde68a' : '1px solid #e2e8f0';
    const titleColor = isSpec ? '#b45309' : '#6d28d9';
    const textColor = isSpec ? '#334155' : '#1e293b';

    const linesHtml = sec.lines.map((line) => {
      // Replace [red]...[/red] with inline styled spans
      let styledLine = line
        .replace(/\[red\](.*?)\[\/red\]/gi, '<span style="color: #e11d48; font-weight: 700;">$1</span>')
        .replace(/\[blue\](.*?)\[\/blue\]/gi, '<span style="color: #2563eb; font-weight: 700;">$1</span>')
        .replace(/\[orange\](.*?)\[\/orange\]/gi, '<span style="color: #d97706; font-weight: 700;">$1</span>');

      return `<p style="margin: 4px 0; font-size: 14.5px; line-height: 1.8; color: ${textColor}; text-align: center; font-weight: 500;">${styledLine}</p>`;
    }).join('');

    const titleHtml = sec.title 
      ? `<div style="color: ${titleColor}; font-size: 17px; font-weight: 700; margin-bottom: 12px; text-align: center; letter-spacing: -0.3px;">${sec.title}</div>`
      : '';

    return `
      <div style="background-color: ${bgColor}; border-left: 5px solid ${borderLeftColor}; border-top: ${borderOthers}; border-right: ${borderOthers}; border-bottom: ${borderOthers}; padding: 22px 20px; margin: 0 auto 16px auto; border-radius: 6px; text-align: center; box-sizing: border-box; max-width: 680px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        ${titleHtml}
        ${linesHtml}
      </div>
    `;
  }).join('');

  return `
    <div style="font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', sans-serif; max-width: 680px; margin: 0 auto; line-height: 1.6;">
      ${cardsHtml}
    </div>
  `.trim();
}

// -------------------------------------------------------------
// Helper: Generate Clean Plain Text (tags stripped)
// -------------------------------------------------------------
function generatePlainText(sections: ParsedSection[]): string {
  return sections.map((sec) => {
    const cleanLines = sec.lines.map((l) => {
      return l.replace(/\[(red|blue|orange)\](.*?)\[\/\1\]/gi, '$2');
    });

    return `${sec.title}\n${cleanLines.join('\n')}`;
  }).join('\n\n');
}
