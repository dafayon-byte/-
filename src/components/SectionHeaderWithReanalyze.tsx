import React, { useState } from 'react';
import { RotateCw, Sparkles, X, Check, ArrowRight, CornerDownLeft } from 'lucide-react';

interface SectionHeaderWithReanalyzeProps {
  sectionNumber: number;
  title: string;
  isReanalyzing: boolean;
  isRecentlyUpdated: boolean;
  disabled?: boolean;
  onExecuteReanalyze: (sectionNum: number, userNote: string) => void;
}

const SECTION_QUICK_TIPS: Record<number, string[]> = {
  1: ['소재 혼용률 정밀 추출', '세탁 및 취급 주의사항 보강', '국내 권장 표기 준수'],
  2: ['클릭률 높은 트렌디 키워드', '20-30대 감성 네이밍', '핵심 핏/디테일 강조'],
  3: ['노출 최적화 태그 15개 이상', '스타일/TPO 중심 태그', '계절감 및 컬러 태그'],
  4: ['색상명 표준화', '사이즈 옵션 깔끔 정리', '원색/서브색 분리'],
  5: ['코디&스타일 (아이템 매치+TPO)', '디테일&핏 (마감/봉제/실루엣)', '소재&착용감 (원단/통기성/촉감)', '상품스펙 규격화'],
  6: ['실측 치수 정밀 판독', '오차 없는 표 규격화', '상세 부위 추가']
};

export default function SectionHeaderWithReanalyze({
  sectionNumber,
  title,
  isReanalyzing,
  isRecentlyUpdated,
  disabled = false,
  onExecuteReanalyze,
}: SectionHeaderWithReanalyzeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userNote, setUserNote] = useState('');

  const quickTips = SECTION_QUICK_TIPS[sectionNumber] || [];

  const handleRun = () => {
    onExecuteReanalyze(sectionNumber, userNote);
    setIsOpen(false);
    setUserNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleQuickTipClick = (tip: string) => {
    setUserNote((prev) => (prev ? `${prev}, ${tip}` : tip));
  };

  return (
    <div className="mb-2">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 py-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-bold text-slate-100 m-0 p-0 border-0 flex items-center gap-2">
            {title}
          </h3>

          {isRecentlyUpdated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-in fade-in duration-300">
              <Check className="w-3 h-3 text-emerald-400" />
              방금 새로 반영됨
            </span>
          )}

          {isReanalyzing && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse">
              <RotateCw className="w-3 h-3 animate-spin text-sky-400" />
              AI 재분석 중...
            </span>
          )}
        </div>

        {/* Re-analyze Trigger Button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || isReanalyzing}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              isOpen
                ? 'bg-sky-600 text-white border-sky-400 shadow-sky-500/20'
                : 'bg-slate-800/90 hover:bg-sky-950/70 text-sky-300 hover:text-white border-slate-700 hover:border-sky-500/60'
            }`}
            title={`${sectionNumber}번 항목만 새롭게 다시 분석합니다`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin text-sky-300' : 'text-sky-400'}`} />
            <span>{isReanalyzing ? '재분석 중...' : '다시 분석하기'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Re-analyze Directive Box */}
      {isOpen && !isReanalyzing && (
        <div className="mt-1.5 mb-2.5 p-3 rounded-xl bg-slate-900/95 border border-sky-500/40 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              [{sectionNumber}번 항목] 맞춤 재분석 요청
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="추가 요청사항 (선택: 비워두면 AI가 자동으로 새롭게 분석합니다)"
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-sky-400 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                autoFocus
              />
              <button
                type="button"
                onClick={handleRun}
                className="px-3.5 py-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-md hover:shadow-sky-500/25 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span>재분석 실행</span>
                <CornerDownLeft className="w-3 h-3 opacity-80" />
              </button>
            </div>

            {/* Quick Keyword Recommendations */}
            {quickTips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[11px] text-slate-400 font-medium shrink-0">빠른 요청 팁:</span>
                {quickTips.map((tip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickTipClick(tip)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-200 border border-slate-700/80 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>+</span>
                    <span>{tip}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-400 pt-0.5">
              💡 다른 항목들은 그대로 보존되며, <span className="text-sky-300 font-semibold">{sectionNumber}번 항목</span>만 새롭게 생성되어 즉시 교체됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
