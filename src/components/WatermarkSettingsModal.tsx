import React, { useState, useEffect } from 'react';
import { 
  WatermarkSettings, 
  DEFAULT_WATERMARK_SETTINGS,
  getWatermarkBackgroundStyle
} from '../types/watermark';
import { 
  fetchWatermarkSettings, 
  saveWatermarkSettings 
} from '../lib/firebase';
import { 
  ShieldAlert, 
  Save, 
  X, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  Eye, 
  Sparkles,
  Sliders,
  MoveHorizontal,
  Compass
} from 'lucide-react';

interface WatermarkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WatermarkSettings;
  onSaved: (newSettings: WatermarkSettings) => void;
}

export default function WatermarkSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaved
}: WatermarkSettingsModalProps) {
  const [form, setForm] = useState<WatermarkSettings>(settings);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(settings);
      setNotification(null);
    }
  }, [isOpen, settings]);

  const showNotice = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleReset = () => {
    setForm(DEFAULT_WATERMARK_SETTINGS);
    showNotice('info', '워터마크 설정이 기본값으로 초기화되었습니다.');
  };

  const handleSave = async () => {
    if (form.enabled && !form.text.trim()) {
      showNotice('error', '워터마크 문구를 최소 1글자 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveWatermarkSettings(form);
      onSaved(form);
      showNotice('success', '✅ 워터마크 설정이 저장되었습니다.');
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                사이즈표 불펌방지 워터마크 설정
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                  대각선 반복 패턴
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                사이즈표 이미지에 반복 워터마크를 각인하여 무단 복제 및 크롤링 도용을 방지합니다.
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

        {/* Toast */}
        {notification && (
          <div 
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b relative z-20 ${
              notification.type === 'success' 
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/60' 
                : notification.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800/60'
                : 'bg-indigo-950/90 text-indigo-200 border-indigo-800/60'
            }`}
          >
            <div className="flex items-center space-x-2">
              {notification.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {notification.type === 'info' && <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />}
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
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-130px)]">
          
          {/* Main Toggle */}
          <div className="flex items-center justify-between bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-sm font-bold text-white block">워터마크 활성화</span>
              <span className="text-xs text-slate-400">
                사이즈표 이미지에 반복 워터마크를 각인합니다 (다운로드 이미지 및 화면 미리보기 동시 적용)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.enabled} 
                onChange={(e) => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Settings Grid */}
          <div className={`space-y-5 transition-opacity ${form.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            
            {/* Watermark Text */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                워터마크 문구 (상호명/브랜드)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.text}
                  onChange={(e) => setForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="예: FARACOM"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white font-semibold focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, text: 'FARACOM' }))}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
                >
                  FARACOM
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, text: 'FARACOM ©' }))}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
                >
                  FARACOM ©
                </button>
              </div>
            </div>

            {/* Direction / Angle */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>반복 방향 및 각도</span>
                <span className="text-slate-400 font-normal text-[11px]">
                  {form.direction === 'diagonal-down' ? '우하향 대각선 (-25°)' : form.direction === 'diagonal-up' ? '우상향 대각선 (25°)' : '수평 직선 (0°)'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, direction: 'diagonal-down', angle: -25 }))}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    form.direction === 'diagonal-down'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>↘ 대각선 (우하향)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, direction: 'diagonal-up', angle: 25 }))}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    form.direction === 'diagonal-up'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>↗ 대각선 (우상향)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, direction: 'horizontal', angle: 0 }))}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    form.direction === 'horizontal'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>→ 수평 일자</span>
                </button>
              </div>
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-300">
                  투명도 (농도)
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60">
                  {Math.round(form.opacity * 100)}% {form.opacity <= 0.08 ? '(추천: 가독성 최고)' : form.opacity >= 0.15 ? '(진함)' : ''}
                </span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.25"
                step="0.01"
                value={form.opacity}
                onChange={(e) => setForm(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>은은하게 (2%)</span>
                <span className="text-indigo-400 font-semibold">황금 비율 (6~8%)</span>
                <span>또렷하게 (25%)</span>
              </div>
            </div>

            {/* Font Size & Repeat Spacing Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Font Size */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  글자 크기 ({form.fontSize}px)
                </label>
                <input
                  type="range"
                  min="14"
                  max="32"
                  step="1"
                  value={form.fontSize}
                  onChange={(e) => setForm(prev => ({ ...prev, fontSize: parseInt(e.target.value, 10) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Horizontal Spacing (gapX) */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  가로 반복 간격 ({form.gapX}px)
                </label>
                <input
                  type="range"
                  min="120"
                  max="300"
                  step="10"
                  value={form.gapX}
                  onChange={(e) => setForm(prev => ({ ...prev, gapX: parseInt(e.target.value, 10) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Vertical Spacing (gapY) */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  세로 반복 간격 ({form.gapY}px)
                </label>
                <input
                  type="range"
                  min="80"
                  max="240"
                  step="10"
                  value={form.gapY}
                  onChange={(e) => setForm(prev => ({ ...prev, gapY: parseInt(e.target.value, 10) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  실제 사이즈표 기준 실시간 미리보기
                </span>
                <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/80">
                  {form.enabled 
                    ? `${form.direction === 'horizontal' ? '수평 0°' : form.direction === 'diagonal-up' ? '우상향 25°' : '우하향 -25°'} · 투명도 ${Math.round(form.opacity * 100)}% · ${form.fontSize}px · 간격 ${form.gapX}×${form.gapY}px`
                    : '워터마크 꺼짐'}
                </span>
              </div>

              {/* Realistic Size Chart Canvas with Watermark */}
              <div 
                className="relative rounded-xl border border-slate-300 overflow-hidden bg-white shadow-md p-4 select-none flex flex-col justify-between transition-all"
                style={getWatermarkBackgroundStyle(form)}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-baseline justify-between border-b-[3px] border-black pb-2 px-1">
                    <span className="text-base font-black text-black tracking-tight">
                      블라우스 상세 사이즈
                    </span>
                    <span className="text-xs font-bold text-black/70">
                      (단위: cm)
                    </span>
                  </div>

                  {/* Table with Transparent Cells so Watermark floats naturally behind */}
                  <table className="w-full border-collapse table-fixed mt-2 text-center">
                    <thead>
                      <tr className="border-b-2 border-black">
                        <th className="py-2 px-1 text-xs font-black text-black bg-transparent">사이즈</th>
                        <th className="py-2 px-1 text-xs font-black text-black bg-transparent">총장</th>
                        <th className="py-2 px-1 text-xs font-black text-black bg-transparent">어깨너비</th>
                        <th className="py-2 px-1 text-xs font-black text-black bg-transparent">가슴단면</th>
                        <th className="py-2 px-1 text-xs font-black text-black bg-transparent">소매길이</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">S</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">55</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">35</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">45</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">60</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">M</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">56</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">36</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">47</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">61</td>
                      </tr>
                      <tr className="border-b-[3px] border-black">
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">L</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">57</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">37</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">49</td>
                        <td className="py-2 px-1 text-xs font-black text-black bg-transparent">62</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Disclaimer at Bottom */}
                <div className="pt-2.5 text-center text-[11px] font-bold text-black border-t border-dashed border-black/30 mt-2.5 bg-transparent">
                  <span className="text-red-600 font-bold">★</span> 측정 방법에 따라서 1~3cm 정도 오차가 있을 수 있습니다 <span className="text-red-600 font-bold">★</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>실제 사이즈표 다운로드 시 위와 같은 밀도와 각도로 각인됩니다.</span>
                <span>배경색: 흰색(#FFFFFF)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="기본 설정으로 복원"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>기본값 복원</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
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
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-900/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>설정 저장하기</span>
                </>
              )}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
