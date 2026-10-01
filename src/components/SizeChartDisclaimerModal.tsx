import React, { useState, useEffect } from 'react';
import { 
  fetchSizeChartDisclaimer, 
  saveSizeChartDisclaimer, 
  DEFAULT_SIZE_CHART_DISCLAIMER 
} from '../lib/firebase';
import { 
  FileText, 
  Save, 
  X, 
  Check, 
  AlertCircle, 
  RotateCcw, 
  Sparkles,
  Eye
} from 'lucide-react';

interface SizeChartDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDisclaimer: string;
  onSaved: (newDisclaimer: string) => void;
}

export default function SizeChartDisclaimerModal({
  isOpen,
  onClose,
  currentDisclaimer,
  onSaved
}: SizeChartDisclaimerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotification(null);
      if (currentDisclaimer) {
        setContent(currentDisclaimer);
      } else {
        loadData();
      }
    }
  }, [isOpen, currentDisclaimer]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSizeChartDisclaimer();
      setContent(data);
    } catch (err: any) {
      showNotice('error', '문구를 불러오는 데 실패했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleInsertStar = () => {
    setContent(prev => prev + '★');
  };

  const handleResetToDefault = () => {
    setContent(DEFAULT_SIZE_CHART_DISCLAIMER);
    showNotice('info', '기본 안내 문구 양식으로 초기화되었습니다.');
  };

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      showNotice('error', '사이즈표 하단 문구를 한 글자 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveSizeChartDisclaimer(trimmed);
      onSaved(trimmed);
      showNotice('success', '✅ 사이즈표 하단 문구가 Firestore DB에 영구 저장되었습니다.');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      showNotice('error', '저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Render preview with red stars
  const renderPreviewLines = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split('★');
      return (
        <React.Fragment key={idx}>
          {parts.map((part, pIdx) => (
            <React.Fragment key={pIdx}>
              {part}
              {pIdx < parts.length - 1 && <span className="text-red-600 font-black">★</span>}
            </React.Fragment>
          ))}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                사이즈표 하단 문구 설정
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                  Firestore DB
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                사이즈표 하단에 들어갈 안내사항, 주의문구, 상호명을 자유롭게 수정하고 영구 저장합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer shrink-0 ml-3"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Notification Toast */}
        {notification && (
          <div 
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b relative z-20 ${
              notification.type === 'success' 
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/60' 
                : notification.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800/60'
                : 'bg-blue-950/90 text-blue-200 border-blue-800/60'
            }`}
          >
            <div className="flex items-center space-x-2">
              {notification.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {notification.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />}
              <span>{notification.text}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white cursor-pointer ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-130px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-medium">저장된 문구를 불러오는 중입니다...</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">문구 입력</span>
                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {lineCount}줄 · {charCount}자
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInsertStar}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/60 rounded-md transition-colors cursor-pointer"
                    title="커서/끝에 빨간 별표(★) 기호 삽입"
                  >
                    <span className="text-red-400 font-bold">★</span>
                    <span>별표 삽입</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
                    title="기본 문구로 복원"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>기본값 복원</span>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm font-sans text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-y leading-relaxed"
                  placeholder="사이즈표 하단에 들어갈 문구를 줄바꿈하여 입력하세요..."
                />
              </div>

              {/* Guide Note */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
                <p className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  입력 팁 및 안내
                </p>
                <p>• 줄바꿈(Enter)한 내용 그대로 사이즈표 하단에 각 줄로 표시됩니다.</p>
                <p>• 별표(<span className="text-red-400 font-bold">★</span>) 기호는 캡처 시 자동으로 빨간색 강조 색상으로 변환되어 출력됩니다.</p>
                <p>• 저장 시 Firestore DB에 영구 기록되어 브라우저를 닫거나 다시 열어도 그대로 유지됩니다.</p>
              </div>

              {/* Live Preview Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>실시간 미리보기 (실제 사이즈표 캡처 형태)</span>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-300 shadow-inner overflow-x-auto text-center">
                  <div className="text-black font-bold text-[15px] sm:text-[16px] leading-relaxed whitespace-nowrap min-w-max mx-auto font-sans">
                    {content.trim() ? (
                      renderPreviewLines(content.trim())
                    ) : (
                      <span className="text-gray-400 font-normal italic">입력된 문구가 없습니다.</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>DB 저장 중...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>DB에 저장하기</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
