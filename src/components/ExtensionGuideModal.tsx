import { Download, ExternalLink, X, Chrome, CheckCircle2, Zap, ArrowRight, Layers } from 'lucide-react';

interface ExtensionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulate: () => void;
}

export default function ExtensionGuideModal({ isOpen, onClose, onSimulate }: ExtensionGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Chrome size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                FARACOM TOOL (의류) 연동
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">v1.3.6</span>
              </h2>
              <p className="text-xs text-slate-400">만능 쇼핑몰 비주얼 매핑 수집기 & 팀 공용 DB 실시간 연동</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Action Download Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
                <Download size={15} className="text-emerald-400" />
                설치 파일(ZIP) 즉시 다운로드
              </h3>
              <p className="text-xs text-slate-400">압축 해제 후 크롬에 로드하여 바로 사용 가능합니다.</p>
            </div>
            <a
              href="/api/download-extension"
              download="FARACOM-TOOL-Extension.zip"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/30 whitespace-nowrap cursor-pointer"
            >
              <Download size={15} />
              <span>FARACOM TOOL 다운로드</span>
            </a>
          </div>

          {/* Installation Steps */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers size={14} className="text-blue-400" />
              1분 초간단 설치 가이드
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white">압축 파일 해제</p>
                  <p className="text-slate-400">다운로드 받은 <code className="text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded">FARACOM-TOOL-Extension.zip</code> 파일의 압축을 풉니다.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white">크롬 확장 프로그램 관리 페이지 열기</p>
                  <p className="text-slate-400">
                    크롬 주소창에 <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded">chrome://extensions</code> 를 입력하고 이동합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white">개발자 모드 켜기 및 로드</p>
                  <p className="text-slate-400">
                    우측 상단 <strong>[개발자 모드]</strong> 스위치를 켠 후, 좌측 상단 <strong>[압축해제된 확장 프로그램을 로드합니다]</strong>를 클릭하여 압축 푼 폴더를 선택합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Test Receiver Module Button */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 flex items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" />
                웹앱 수신 모듈 즉시 동작 테스트
              </p>
              <p className="text-slate-400">
                확장 프로그램이 전송하는 모의 데이터 규격을 현재 웹앱으로 직접 전송해 봅니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSimulate();
              }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/40 hover:border-emerald-400 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>연동 테스트</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">1:1 양방향 window.postMessage 연동 지원</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
