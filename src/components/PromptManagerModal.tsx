import React, { useState, useEffect } from 'react';
import { 
  fetchActivePrompt, 
  saveNewPrompt, 
  fetchPromptHistoryPaged, 
  deletePromptHistoryItem,
  PromptHistoryItem 
} from '../lib/firebase';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { FileText, Save, History, X, Check, Clock, Eye, AlertCircle, Trash2, ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';

interface PromptManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptUpdated?: () => void;
}

export default function PromptManagerModal({ isOpen, onClose, onPromptUpdated }: PromptManagerModalProps) {
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<PromptHistoryItem[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [selectedHistory, setSelectedHistory] = useState<PromptHistoryItem | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setShowHistory(false);
      setSelectedHistory(null);
      setConfirmDeleteId(null);
      loadPromptData();
    }
  }, [isOpen]);

  const handleCloseModal = () => {
    setShowHistory(false);
    setSelectedHistory(null);
    setConfirmDeleteId(null);
    onClose();
  };

  const loadPromptData = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const active = await fetchActivePrompt();
      setCurrentPrompt(active);
    } catch (err: any) {
      showNotice('error', '프롬프트를 불러오는 데 실패했습니다: ' + err.message);
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

  const getCleanTitle = (title?: string) => {
    if (!title) return '프롬프트 저장본';
    const cleaned = title.replace(/\s*\([\d\.\s:\-오전후년월일A-Za-z,]+\)$/, '').trim();
    if (!cleaned || cleaned === '프롬프트 저장') return '프롬프트 저장본';
    return cleaned;
  };

  const handleSave = async () => {
    if (!currentPrompt.trim()) {
      showNotice('error', '프롬프트 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveNewPrompt(currentPrompt);
      if (historyList.length > 0) {
        const fetchCount = Math.max(5, historyList.length);
        const res = await fetchPromptHistoryPaged(fetchCount);
        setHistoryList(res.items);
        setLastDoc(res.lastDoc);
        setHasMoreHistory(res.hasMore);
      }
      showNotice('success', '✅ 프롬프트가 Firestore DB에 저장되었습니다.');
      if (onPromptUpdated) onPromptUpdated();
    } catch (err: any) {
      showNotice('error', '저장 중 오류 발생: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = async () => {
    setShowHistory(true);
    setConfirmDeleteId(null);
    if (historyList.length === 0) {
      setLoadingHistory(true);
      try {
        const res = await fetchPromptHistoryPaged(5);
        setHistoryList(res.items);
        setLastDoc(res.lastDoc);
        setHasMoreHistory(res.hasMore);
      } catch (err: any) {
        showNotice('error', '이전 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const handleRefreshHistory = async () => {
    setLoadingHistory(true);
    try {
      const fetchCount = Math.max(5, historyList.length);
      const res = await fetchPromptHistoryPaged(fetchCount);
      setHistoryList(res.items);
      setLastDoc(res.lastDoc);
      setHasMoreHistory(res.hasMore);
      showNotice('info', '목록을 최신 상태로 새로고침했습니다.');
    } catch (err: any) {
      showNotice('error', '새로고침 중 오류가 발생했습니다.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLoadMoreHistory = async () => {
    if (!hasMoreHistory || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPromptHistoryPaged(5, lastDoc);
      setHistoryList(prev => [...prev, ...res.items]);
      setLastDoc(res.lastDoc);
      setHasMoreHistory(res.hasMore);
    } catch (err: any) {
      showNotice('error', '추가 이력을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLoadPrompt = (item: PromptHistoryItem) => {
    setCurrentPrompt(item.content);
    setSelectedHistory(null);
    setShowHistory(false);
    showNotice('info', `선택한 프롬프트("${item.title}")를 편집기에 불러왔습니다. [프롬프트 저장하기]를 클릭하면 DB에 적용됩니다.`);
  };

  const executeDeleteHistory = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await deletePromptHistoryItem(id);
      setHistoryList(prev => prev.filter(item => item.id !== id));
      if (selectedHistory?.id === id) {
        setSelectedHistory(null);
      }
      showNotice('success', '🗑️ 프롬프트 이력이 성공적으로 삭제되었습니다.');
    } catch (err: any) {
      console.error("Delete history error:", err);
      showNotice('error', '이력 삭제 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 shadow-md relative z-10">
        <div className="flex items-center space-x-3 min-w-0">
          {showHistory ? (
            <button
              type="button"
              onClick={() => {
                setShowHistory(false);
                setConfirmDeleteId(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
              <span>편집기로 돌아가기</span>
            </button>
          ) : (
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-base font-bold text-white flex items-center gap-2 truncate">
              {showHistory ? '이전 프롬프트 이력 목록' : '시스템 프롬프트 (지침) 관리'}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                Firestore DB
              </span>
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {showHistory 
                ? '저장되었던 프롬프트 내역을 확인하고 선택하여 불러옵니다.' 
                : 'Gemini AI 모델 지침을 수정하고 DB에 저장/관리합니다.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0 ml-4">
          {!showHistory && (
            <button
              type="button"
              onClick={handleOpenHistory}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-300 bg-blue-950 hover:bg-blue-900 border border-blue-800/80 rounded-lg transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0"
            >
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span>이전 프롬프트 불러오기</span>
              {historyList.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                  {historyList.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleCloseModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-600 rounded-lg transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0"
            title="닫기"
          >
            <X className="w-3.5 h-3.5 text-slate-300" />
            <span>닫기</span>
          </button>
        </div>
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
            {notification.type === 'info' && <Clock className="w-4 h-4 text-blue-400 shrink-0" />}
            <span>{notification.text}</span>
          </div>
          <button 
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer ml-4 font-bold"
          >
            닫기
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Full-screen History View Overlay */}
        {showHistory ? (
          <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-300">
                <span>
                  최근 <span className="text-blue-400 font-extrabold">{historyList.length}</span>개의 저장 이력을 불러왔습니다.
                </span>
                <span className="text-slate-400 font-normal">
                  (최대 100개까지 저장 됩니다.)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshHistory}
                disabled={loadingHistory}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="목록 새로고침"
              >
                <RefreshCw className={`w-3 h-3 text-blue-400 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>새로고침</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-medium">저장 이력을 불러오는 중입니다...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <History className="w-10 h-10 mb-2 text-slate-700" />
                  <p className="text-xs font-medium">저장된 이전 프롬프트 이력이 없습니다.</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  {historyList.map((item) => {
                    const charCount = item.content.length;
                    const lineCount = item.content.split('\n').length;
                    const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    }) : '-';

                    const isConfirming = confirmDeleteId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-sm group"
                      >
                        {/* Left Info: Icon, Title, Date, Char/Line Count */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-200">{getCleanTitle(item.title)}</span>
                              <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 whitespace-nowrap shrink-0">
                                {charCount.toLocaleString()}자 · {lineCount}줄
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              저장일시: <span className="text-slate-300 font-normal">{formattedDate}</span>
                            </p>
                          </div>
                        </div>

                        {/* Right Buttons: Delete, Preview, Load */}
                        <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5 bg-rose-950/80 p-1 rounded-lg border border-rose-800 animate-fadeIn">
                              <span className="text-[11px] text-rose-200 px-1 font-semibold">삭제할까요?</span>
                              <button
                                type="button"
                                onClick={(e) => executeDeleteHistory(item.id, e)}
                                disabled={deletingId === item.id}
                                className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded cursor-pointer transition-colors"
                              >
                                {deletingId === item.id ? '삭제중' : '확인(삭제)'}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(item.id);
                              }}
                              disabled={deletingId === item.id}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-200 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-900/60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>삭제</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedHistory(item)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>미리보기</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleLoadPrompt(item)}
                            className="flex items-center justify-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer transition-all whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>불러오기</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {hasMoreHistory && (
                    <div className="pt-3 pb-2 flex justify-center">
                      <button
                        type="button"
                        onClick={handleLoadMoreHistory}
                        disabled={loadingMore}
                        className="flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            <span>불러오는 중...</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 text-blue-400" />
                            <span>5개 더보기</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Editor View */
          <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-950">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs">Firestore DB에서 프롬프트를 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 min-w-0">
                    <span className="whitespace-nowrap">프롬프트 (지침) 편집기</span>
                    <span className="text-xs text-slate-500 font-normal whitespace-nowrap">
                      ({currentPrompt.length.toLocaleString()} 자 / {currentPrompt.split('\n').length} 줄)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? '저장 중...' : '프롬프트 저장하기'}</span>
                  </button>
                </div>

                <div className="flex-1 relative rounded-xl border border-slate-800 bg-slate-900/90 shadow-inner overflow-hidden flex flex-col">
                  <textarea
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    placeholder="프롬프트 지침을 입력하세요..."
                    className="w-full h-full p-5 bg-transparent text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    style={{ tabSize: 2 }}
                  />
                </div>

                <footer className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-900 pt-2.5">
                  <p>💡 [프롬프트 저장하기] 클릭 시 저장 일시가 자동 기록되어 이력에 남습니다.</p>
                  <p>현재 시각: {new Date().toLocaleTimeString('ko-KR')}</p>
                </footer>
              </>
            )}
          </div>
        )}
      </div>

      {/* History Detail Preview Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="font-bold text-white text-xs flex items-center gap-2">
                  {getCleanTitle(selectedHistory.title)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  저장 일시: {selectedHistory.createdAt ? new Date(selectedHistory.createdAt).toLocaleString('ko-KR') : '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistory(null)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>닫기</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-950">
              <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed bg-slate-900 p-4 rounded-xl border border-slate-800">
                {selectedHistory.content}
              </pre>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              {confirmDeleteId === selectedHistory.id ? (
                <div className="flex items-center gap-1.5 bg-rose-950/80 p-1 rounded-lg border border-rose-800">
                  <span className="text-[11px] text-rose-200 px-1 font-semibold">정말 삭제하시겠습니까?</span>
                  <button
                    type="button"
                    onClick={() => executeDeleteHistory(selectedHistory.id)}
                    disabled={deletingId === selectedHistory.id}
                    className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded cursor-pointer"
                  >
                    {deletingId === selectedHistory.id ? '삭제중' : '네, 삭제'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedHistory.id)}
                  disabled={deletingId === selectedHistory.id}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-200 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-900/60 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              )}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedHistory(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer border border-slate-700"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPrompt(selectedHistory)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md cursor-pointer"
                >
                  불러오기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
