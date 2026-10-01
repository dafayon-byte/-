import React, { useState, useEffect } from 'react';
import { 
  fetchAnalysisHistoryPaged, 
  deleteAnalysisHistoryItem,
  AnalysisHistoryItem 
} from '../lib/firebase';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import SellingPointsCardViewer from './SellingPointsCardViewer';
import { 
  FileText, 
  History, 
  X, 
  Check, 
  Clock, 
  Eye, 
  AlertCircle, 
  Trash2, 
  ChevronDown, 
  ShoppingBag,
  Sparkles,
  Copy,
  Layers,
  Tag,
  Table,
  RefreshCw
} from 'lucide-react';

interface AnalysisHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadAnalysis: (result: any, inputText?: string, id?: string) => void;
}

export default function AnalysisHistoryModal({ 
  isOpen, 
  onClose, 
  onLoadAnalysis 
}: AnalysisHistoryModalProps) {
  const [historyList, setHistoryList] = useState<AnalysisHistoryItem[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [selectedHistory, setSelectedHistory] = useState<AnalysisHistoryItem | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedHistory(null);
      setConfirmDeleteId(null);
      if (historyList.length === 0) {
        loadInitialHistory();
      }
    }
  }, [isOpen]);

  const loadInitialHistory = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetchAnalysisHistoryPaged(5);
      setHistoryList(res.items);
      setLastDoc(res.lastDoc);
      setHasMoreHistory(res.hasMore);
    } catch (err: any) {
      showNotice('error', '분석 기록을 불러오는 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshHistory = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const fetchCount = Math.max(5, historyList.length);
      const res = await fetchAnalysisHistoryPaged(fetchCount);
      setHistoryList(res.items);
      setLastDoc(res.lastDoc);
      setHasMoreHistory(res.hasMore);
      showNotice('info', '기록을 최신 상태로 새로고침했습니다.');
    } catch (err: any) {
      showNotice('error', '새로고침 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreHistory = async () => {
    if (!hasMoreHistory || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchAnalysisHistoryPaged(5, lastDoc);
      setHistoryList(prev => [...prev, ...res.items]);
      setLastDoc(res.lastDoc);
      setHasMoreHistory(res.hasMore);
    } catch (err: any) {
      showNotice('error', '추가 기록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const showNotice = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleCloseModal = () => {
    setSelectedHistory(null);
    setConfirmDeleteId(null);
    onClose();
  };

  const handleApplyHistory = (item: AnalysisHistoryItem) => {
    onLoadAnalysis(item.result, item.inputText, item.id);
    setSelectedHistory(null);
    handleCloseModal();
  };

  const executeDeleteHistory = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await deleteAnalysisHistoryItem(id);
      setHistoryList(prev => prev.filter(item => item.id !== id));
      if (selectedHistory?.id === id) {
        setSelectedHistory(null);
      }
      showNotice('success', '🗑️ 분석 기록이 성공적으로 삭제되었습니다.');
    } catch (err: any) {
      console.error("Delete history error:", err);
      showNotice('error', '기록 삭제 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setDeletingId(null);
    }
  };

  const copyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 shadow-md relative z-10">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/30 shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-bold text-white flex items-center gap-2 truncate">
              의류 상품 분석 기록 목록
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                Firestore DB
              </span>
            </h1>
            <p className="text-xs text-slate-400 truncate">
              이전에 분석했던 상품 정보와 사이즈표 결과를 확인하고 불러옵니다.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0 ml-4">
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

      {/* Main List Area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-950">
        {/* Count & Info Header */}
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-300">
            <span>
              최근 <span className="text-purple-400 font-extrabold">{historyList.length}</span>개의 저장 이력을 불러왔습니다.
            </span>
            <span className="text-slate-400 font-normal">
              (최대 100개까지 저장 됩니다.)
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefreshHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="기록 새로고침"
          >
            <RefreshCw className={`w-3 h-3 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-medium">분석 기록을 불러오는 중입니다...</p>
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <History className="w-10 h-10 mb-2 text-slate-700" />
              <p className="text-xs font-medium">저장된 이전 분석 기록이 없습니다.</p>
              <p className="text-[11px] text-slate-600 mt-1">상품 정보 분석을 완료하면 자동으로 이곳에 기록이 저장됩니다.</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-2.5">
              {historyList.map((item) => {
                const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }) : '-';

                const isConfirming = confirmDeleteId === item.id;
                const r = item.result || {};
                const sizeChartCount = r.sizeCharts?.length || 0;
                const hasDanger = r.notification?.includes('🚨') || r.notification?.includes('⚠️');

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-sm group"
                  >
                    {/* Left Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-200 line-clamp-1">
                            {item.title}
                          </span>
                          {hasDanger && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-950/80 text-rose-300 rounded border border-rose-800 whitespace-nowrap shrink-0">
                              경고알림
                            </span>
                          )}
                          {sizeChartCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700 whitespace-nowrap shrink-0">
                              사이즈표 {sizeChartCount}개
                            </span>
                          )}
                          {item.imageCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 whitespace-nowrap shrink-0">
                              이미지 {item.imageCount}장
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                          <p>
                            분석일시: <span className="text-slate-300 font-normal">{formattedDate}</span>
                          </p>
                          {item.duration ? (
                            <p className="text-slate-500">
                              소요시간: <span className="text-slate-400">{item.duration}초</span>
                            </p>
                          ) : null}
                        </div>
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
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        <span>미리보기</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyHistory(item)}
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
                        <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span>불러오는 중...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-purple-400" />
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

      {/* Detail Preview Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="min-w-0 pr-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 truncate">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="truncate">{selectedHistory.title}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  분석 일시: {selectedHistory.createdAt ? new Date(selectedHistory.createdAt).toLocaleString('ko-KR') : '-'}
                  {selectedHistory.duration ? ` · 소요시간: ${selectedHistory.duration}초` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistory(null)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>닫기</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950 space-y-4">
              {/* Notification Banner */}
              {selectedHistory.result?.notification && (
                <div className={`p-3 rounded-xl border text-xs font-medium leading-relaxed ${
                  selectedHistory.result.notification.includes('🚨') || selectedHistory.result.notification.includes('⚠️')
                    ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                }`}>
                  {selectedHistory.result.notification}
                </div>
              )}

              {/* Product Names */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>상품명 및 검색태그</span>
                </h4>
                {selectedHistory.result?.productName && (
                  <div>
                    <span className="text-[11px] text-slate-400">기본 상품명:</span>
                    <div className="flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 mt-1">
                      <span className="text-xs text-slate-200 font-medium break-all">{selectedHistory.result.productName}</span>
                      <button
                        type="button"
                        onClick={() => copyText(selectedHistory.result.productName, 'pname1')}
                        className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        {copiedKey === 'pname1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'pname1' ? '복사됨' : '복사'}</span>
                      </button>
                    </div>
                  </div>
                )}
                {selectedHistory.result?.productName2 && (
                  <div>
                    <span className="text-[11px] text-slate-400">예비 상품명:</span>
                    <div className="flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 mt-1">
                      <span className="text-xs text-slate-200 font-medium break-all">{selectedHistory.result.productName2}</span>
                      <button
                        type="button"
                        onClick={() => copyText(selectedHistory.result.productName2, 'pname2')}
                        className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        {copiedKey === 'pname2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'pname2' ? '복사됨' : '복사'}</span>
                      </button>
                    </div>
                  </div>
                )}
                {selectedHistory.result?.searchTags && (
                  <div>
                    <span className="text-[11px] text-slate-400">검색태그:</span>
                    <div className="flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 mt-1">
                      <span className="text-xs text-slate-200 break-all">{selectedHistory.result.searchTags}</span>
                      <button
                        type="button"
                        onClick={() => copyText(selectedHistory.result.searchTags, 'tags')}
                        className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        {copiedKey === 'tags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'tags' ? '복사됨' : '복사'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Info */}
              {selectedHistory.result?.mainInfo && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-blue-300 flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>상품 고시 정보</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedHistory.result.mainInfo).map(([key, val]) => (
                      <div key={key} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 block mb-0.5">{key}</span>
                        <span className="text-slate-200 font-medium">{String(val || '-')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selling Points */}
              {selectedHistory.result?.sellingPoints && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>상품 소구점 및 설명 (카드 뷰)</span>
                    </h4>
                  </div>
                  <SellingPointsCardViewer
                    rawText={selectedHistory.result.sellingPoints}
                    onCopySuccess={(msg) => copyText('', 'sellingPoints')}
                  />
                </div>
              )}

              {/* Size Charts */}
              {selectedHistory.result?.sizeCharts && selectedHistory.result.sizeCharts.length > 0 && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5" />
                    <span>사이즈표 ({selectedHistory.result.sizeCharts.length}개)</span>
                  </h4>
                  <div className="space-y-3">
                    {selectedHistory.result.sizeCharts.map((sc: any, idx: number) => (
                      <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-200">{sc.title || `사이즈표 ${idx + 1}`}</span>
                          <button
                            type="button"
                            onClick={() => copyText(sc.sizeChart, `sc-${idx}`)}
                            className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer flex items-center gap-1"
                          >
                            {copiedKey === `sc-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>복사</span>
                          </button>
                        </div>
                        <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap bg-slate-900 p-2.5 rounded border border-slate-800 overflow-x-auto">
                          {sc.sizeChart}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
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
                  onClick={() => handleApplyHistory(selectedHistory)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>이 분석 결과 불러오기</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
