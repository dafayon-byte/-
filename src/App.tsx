import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { GoogleGenAI } from "@google/genai";
import PromptManagerModal from './components/PromptManagerModal';
import AnalysisHistoryModal from './components/AnalysisHistoryModal';
import SizeChartDisclaimerModal from './components/SizeChartDisclaimerModal';
import WatermarkSettingsModal from './components/WatermarkSettingsModal';
import SellingPointsCardViewer from './components/SellingPointsCardViewer';
import { 
  saveAnalysisResult, 
  updateAnalysisResult,
  fetchSizeChartDisclaimer, 
  DEFAULT_SIZE_CHART_DISCLAIMER,
  fetchWatermarkSettings,
  saveWatermarkSettings
} from './lib/firebase';
import { 
  WatermarkSettings, 
  DEFAULT_WATERMARK_SETTINGS,
  getWatermarkBackgroundStyle 
} from './types/watermark';
import SectionHeaderWithReanalyze from './components/SectionHeaderWithReanalyze';
import { buildSectionPrompt } from './lib/reanalyzePrompt';
import ExtensionGuideModal from './components/ExtensionGuideModal';
import { Settings, FileText, Sliders, History, ShieldAlert, UploadCloud, Sparkles, Download, CheckCircle2, X, HelpCircle } from 'lucide-react';

const VISION_MODEL_NAME = 'gemini-3.8-flash';
const TEXT_MODEL_NAME = 'gemini-3.8-flash';

export interface SizeChart {
  notification: string | null;
  title: string;
  sizeChart: string;
}

export interface ProductResponse {
  notification?: string;
  mainInfo?: {
    material: string;
    colors: string;
    sizes: string;
    manufacturerImporter: string;
    laundryInfo: string;
    dateOfManufacture: string;
    qualityGuarantee: string;
  };
  productName?: string;
  productName2?: string;
  searchTags?: string;
  options?: {
    group1: string;
    group2: string;
    values: string[];
    sizeValues: string[];
  };
  sellingPoints?: string;
  sizeCharts?: SizeChart[];
}

export default function App() {
  // State
  const [textInput, setTextInput] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaderText, setLoaderText] = useState('분석을 준비 중입니다...');
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<ProductResponse | null>(null);
  const [autoDownload, setAutoDownload] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alert, setAlert] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
  const [sizeChartDisclaimer, setSizeChartDisclaimer] = useState<string>(DEFAULT_SIZE_CHART_DISCLAIMER);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>(DEFAULT_WATERMARK_SETTINGS);
  const [isExtensionGuideOpen, setIsExtensionGuideOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Refs for audio
  const startSoundRef = useRef<HTMLAudioElement>(null);
  const completeSoundRef = useRef<HTMLAudioElement>(null);
  const errorSoundRef = useRef<HTMLAudioElement>(null);
  const noNotifSoundRef = useRef<HTMLAudioElement>(null);
  const hasNotifSoundRef = useRef<HTMLAudioElement>(null);
  const copySoundRef = useRef<HTMLAudioElement>(null);
  const resetSoundRef = useRef<HTMLAudioElement>(null);
  const downloadSoundRef = useRef<HTMLAudioElement>(null);
  const scrollSoundRef = useRef<HTMLAudioElement>(null);
  const analyzeSoundRef = useRef<HTMLAudioElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sizeChartsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Section re-analyze states & refs
  const [reanalyzingSection, setReanalyzingSection] = useState<number | null>(null);
  const [recentlyUpdatedSection, setRecentlyUpdatedSection] = useState<number | null>(null);
  const currentAnalysisIdRef = useRef<string | null>(null);
  const cachedAnalysisContextRef = useRef<{ text: string; images: { mimeType: string; base64Image: string }[] } | null>(null);

  // Load settings
  useEffect(() => {
    const storedAuto = localStorage.getItem('autoDownloadEnabled');
    if (storedAuto !== null) setAutoDownload(storedAuto === 'true');
    const storedSound = localStorage.getItem('soundEnabled');
    if (storedSound !== null) setSoundEnabled(storedSound === 'true');
  }, []);

  // Load size chart disclaimer from Firestore
  useEffect(() => {
    fetchSizeChartDisclaimer().then((disclaimer) => {
      if (disclaimer) setSizeChartDisclaimer(disclaimer);
    }).catch((err) => {
      console.warn('Failed to load size chart disclaimer:', err);
    });

    fetchWatermarkSettings().then((wm) => {
      if (wm) {
        setWatermarkSettings(prev => ({
          ...prev,
          ...wm
        }));
      }
    }).catch((err) => {
      console.warn('Failed to load watermark settings:', err);
    });
  }, []);

  // Handle preview URLs cleanup
  useEffect(() => {
    const urls = stagedFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [stagedFiles]);

  // Timer logic
  useEffect(() => {
    if (loading) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 200px
      // and only if the page is actually scrollable
      const isScrollable = document.documentElement.scrollHeight > window.innerHeight;
      setShowScrollTop(isScrollable && window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const showAlert = (message: string) => setAlert({ show: true, message });
  const closeAlert = () => setAlert({ show: false, message: '' });

  const playSound = (ref: React.RefObject<HTMLAudioElement | null>) => {
    if (soundEnabled && ref.current) {
      ref.current.currentTime = 0;
      ref.current.play().catch(e => console.warn("Sound play failed:", e));
    }
  };

  const addFiles = (files: File[]) => {
    if (!files || files.length === 0) return;
    playSound(resetSoundRef);
    setStagedFiles(prev => {
      const newFiles = [...prev];
      files.forEach(file => {
        // Prevent exact duplicates (by name and size)
        const isDuplicate = newFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDuplicate) {
          newFiles.push(file);
        }
      });
      return newFiles;
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // 1. [FARACOM TOOL (의류)] 크롬 확장 프로그램 1:1 postMessage & CustomEvent 연동 리스너
  useEffect(() => {
    const dataUrlToFile = (dataUrl: string, filename: string): File | null => {
      try {
        if (!dataUrl || typeof dataUrl !== 'string') return null;
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return null;
        const header = dataUrl.substring(0, commaIndex);
        const bstr = atob(dataUrl.substring(commaIndex + 1).replace(/\s/g, ''));
        const mimeMatch = header.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
      } catch (e) {
        console.warn("dataUrlToFile failed:", e);
        return null;
      }
    };

    const processPayload = async (payload: any) => {
      if (!payload) return;
      console.log("[FARACOM TOOL (의류)] 데이터 수신 성공:", payload);

      // 1. 텍스트 정보 -> 텍스트박스(textInput)에 즉시 반영
      let textToInsert = "";
      if (payload.summaryText && typeof payload.summaryText === "string" && payload.summaryText.trim()) {
        textToInsert = payload.summaryText.trim();
      } else {
        const textPieces: string[] = [];
        if (payload.title && (!payload.specs || !payload.specs.includes(payload.title))) {
          textPieces.push(`[상품명] ${payload.title}`);
        }
        if (payload.brand && (!payload.specs || !payload.specs.includes(payload.brand))) {
          textPieces.push(`[브랜드] ${payload.brand}`);
        }
        if (payload.price && (!payload.specs || !payload.specs.includes(payload.price))) {
          textPieces.push(`[가격] ${payload.price}`);
        }
        if (payload.specs) {
          textPieces.push(payload.specs);
        }
        textToInsert = textPieces.join('\n').trim();
      }

      if (textToInsert) {
        setTextInput(textToInsert);
      }

      // 2. 수집된 이미지 목록 -> 이미지박스(stagedFiles)에 즉시 반영
      const convertedImages: File[] = [];

      // A. Base64 dataUrls 우선 변환 (즉시 완료)
      if (Array.isArray(payload.imagesData) && payload.imagesData.length > 0) {
        payload.imagesData.forEach((dUrl: string, idx: number) => {
          if (!dUrl || typeof dUrl !== "string") return;
          const file = dataUrlToFile(dUrl, `scraped_img_${idx + 1}.jpg`);
          if (file && file.size > 0) convertedImages.push(file);
        });
      }

      // B. Base64가 없거나 모자란 경우 원본 이미지 URL 병렬 다운로드
      if (convertedImages.length === 0 && Array.isArray(payload.images) && payload.images.length > 0) {
        const promises = payload.images.map(async (imgUrl: string, index: number) => {
          if (!imgUrl || typeof imgUrl !== 'string') return null;
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
            let res = await fetch(proxyUrl);
            if (!res.ok) {
              res = await fetch(imgUrl);
            }
            if (!res.ok) return null;
            const blob = await res.blob();
            const fileType = blob.type || 'image/jpeg';
            const ext = fileType.includes('/') ? fileType.split('/')[1] : 'jpg';
            return new File([blob], `scraped_img_${index + 1}.${ext}`, { type: fileType });
          } catch (err) {
            console.warn(`[FARACOM TOOL (의류)] 이미지 변환 실패 (${imgUrl}):`, err);
            return null;
          }
        });

        const files = await Promise.all(promises);
        files.forEach(f => {
          if (f && f.size > 0) convertedImages.push(f);
        });
      }

      if (convertedImages.length > 0) {
        setStagedFiles(convertedImages);
        playSound(resetSoundRef);
      }

      // 3. 최상단 플로팅 알림 (화면 밀림 0% 방지, 화면 스크롤 위치 불변)
      showToast(`[FARACOM TOOL (의류)] 수집 데이터 전송 완료! (사진 ${convertedImages.length}장, 텍스트)`);
      setStatusText(`📥 [FARACOM TOOL (의류)] '${payload.title || "상품"}' 텍스트 및 이미지(${convertedImages.length}장)가 입력되었습니다.`);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "FARACOM_IMPORT_PRODUCT") {
        processPayload(event.data.payload);
      }
    };

    const handleCustomEvent = (event: any) => {
      if (event.detail) {
        processPayload(event.detail);
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("FARACOM_IMPORT_PRODUCT", handleCustomEvent);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("FARACOM_IMPORT_PRODUCT", handleCustomEvent);
    };
  }, []);

  // FARACOM TOOL (의류) 연동 모의 테스트 실행 함수
  const handleSimulateFaracomTool = () => {
    window.postMessage({
      type: "FARACOM_IMPORT_PRODUCT",
      payload: {
        title: "BEAMS LIGHTS / 미니멀 오버사이즈 린넨 셔츠",
        brand: "zozo.jp",
        images: [
          "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80"
        ],
        summaryText: `■ [소싱 원본 페이지] : https://zozo.jp/shop/beams/goods/12345678/\n■ [수집된 고화질 이미지] : 총 2장\n\n[매핑 1]\n마(린넨) 100% 고급 일본 방직 원단 (세탁 시 찬물 손세탁 권장)\n자연스러운 주름과 통기성이 뛰어난 내추럴 실루엣\n\n[매핑 2]\n사이즈 : 총장 : 어깨너비 : 가슴단면 : 소매길이\nS : 72cm : 49cm : 58cm : 60cm\nM : 74cm : 51cm : 60cm : 61.5cm\nL : 76cm : 53cm : 62cm : 63cm`,
        url: "https://zozo.jp/shop/beams/goods/12345678/"
      }
    }, "*");
  };

  // Clipboard paste event listener (Ctrl+V / Cmd+V image attachment)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Do not intercept if sub-modals are open
      if (isPromptModalOpen || isAnalysisModalOpen) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const imageFiles: File[] = [];

      // 1. Process items from clipboard (supports screenshots and copied web images)
      if (clipboardData.items && clipboardData.items.length > 0) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const ext = file.type.split('/')[1] || 'png';
              // Provide unique timestamped name for anonymous clipboard screenshots
              const fileName = (!file.name || file.name === 'image.png')
                ? `clipboard_${Date.now()}_${i + 1}.${ext}`
                : file.name;
              imageFiles.push(new File([file], fileName, { type: file.type }));
            }
          }
        }
      } 
      // 2. Fallback to clipboardData.files if items were not files
      else if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const file = clipboardData.files[i];
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        const textContent = clipboardData.getData('text/plain');
        const activeElem = document.activeElement;
        const isTextInput = activeElem?.tagName === 'INPUT' || activeElem?.tagName === 'TEXTAREA';

        // Only prevent default if we're not also pasting valid text into a text box
        if (!textContent || !isTextInput) {
          e.preventDefault();
        }

        addFiles(imageFiles);
        setStatusText(`📋 클립보드 이미지 ${imageFiles.length}장이 첨부되었습니다.`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isPromptModalOpen, isAnalysisModalOpen, soundEnabled]);

  // Window-wide drag and drop listeners (allows dragging files anywhere into the entire window)
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // Only trigger for file drags
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounterRef.current += 1;
        setIsWindowDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsWindowDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsWindowDragging(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          addFiles(imageFiles);
          setStatusText(`📂 이미지 ${imageFiles.length}장이 첨부되었습니다.`);
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [soundEnabled]);

  const removeFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<{ mimeType: string; base64Image: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        resolve({ mimeType: file.type || 'image/jpeg', base64Image: base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const buildPrompt = (data: { text: string; imageCount: number }) => {
    const perfectExample = `
      ---
      [완벽한 JSON 입출력 예시]
      이 예시의 입력과 출력 형식을 완벽하게 모방하여, 아래의 [실제 입력 데이터]에 대한 결과물을 생성해야 한다.

      [예시 입력]
      {
        "text": "블라우스: S 총장55 어깨35 가슴45 소매60 | 스커트: S 총장42 허리33 힙45",
        "images": ["(블라우스와 스커트 이미지, 사이즈표 이미지)"]
      }
      
      [예시 출력 (JSON 형식)]
      {
        "mainInfo": {
          "material": "면 100%",
          "colors": "아이보리, 블랙",
          "sizes": "S, M, L",
          "manufacturerImporter": "파라컴(구매대행)",
          "laundryInfo": "드라이클리닝 권장 (케어라벨 확인 필수)",
          "dateOfManufacture": "상품 발송일 기준 6개월 이내 제조",
          "qualityGuarantee": "관련 법 및 소비자 분쟁 해결 기준에 따름"
        },
        "notification": "🚨 심각 위험: 유명 브랜드 로고 (구찌)가 이미지의 코디용 가방에서 발견되었습니다",
        "productName": "여성 빅사이즈 브이넥 핀턱 퍼프소매 민소매 롱 원피스 하객룩 오피스룩 봄 가을",
        "productName2": "여성 빅사이즈 브이넥 핀턱 원피스 반팔 퍼프 롱원피스 오피스룩",
        "searchTags": "여자원피스, 블라우스세트, 스커트세트, 투피스, 하객룩, 데이트룩, 오피스룩, 퍼프블라우스, 플리츠스커트, 미니스커트, 봄신상, 크림색, 소라색, 러블리",
        "options": {
          "group1": "옵션 그룹명 1 (예: 컬러)",
          "group2": "옵션 그룹명 2 (예: 사이즈)",
          "values": [
              "옵션값 A (group1에 해당하는 값)", 
              "옵션값 B (group1에 해당하는 값)"
          ],
          "sizeValues": [
              "사이즈값 A (group2에 해당하는 값)",
              "사이즈값 B (group2에 해당하는 값)"
          ]
        },
        "sellingPoints": "[코디 & 스타일]\\n자켓과 매치한 [red]세련된 오피스룩[/red]\\n데님과 연출한 [blue]감각적 데일리룩[/blue]\\n단품에 더하는 [orange]우아한 하객룩[/orange]\\n\\n[디테일 & 핏]\\n정갈한 넥라인 [red]바이어스 마감[/red]\\n은은한 포인트 [blue]백버튼 셔링[/blue]\\n체형을 커버하는 [orange]슬림 A라인[/orange]\\n\\n[소재 & 착용감]\\n내추럴한 결감 [red]고급 천연 린넨[/red]\\n무더운 여름철 [blue]탁월한 통기성[/blue]\\n피부에 닿는 [orange]부드러운 촉감[/orange]\\n\\n[상품스펙]\\n■ 종류 : 원피스, 투피스 세트\\n■ 색상 : 크림, 소라, 블랙\\n■ 주소재 : 면 100%\\n■ 사이즈 : S, M, L, XL",
        "sizeCharts": [
          {
            "notification": null,
            "title": "블라우스 상세 사이즈",
            "sizeChart": "| 사이즈 | 총장 | 어깨너비 | 가슴단면 | 소매길이 |\\n|:---|:---:|:---:|:---:|:---:|\\n| S | 55 | 35 | 45 | 60 |\\n| M | 56 | 36 | 47 | 61 |"
          },
          {
            "notification": null,
            "title": "스커트 상세 사이즈",
            "sizeChart": "| 사이즈 | 총장 | 허리단면 | 힙단면 |\\n|:---|:---:|:---:|:---:|\\n| S | 42 | 33 | 45 |\\n| M | 43 | 35 | 47 |"
          }
        ]
      }
      ---
    `;

    const finalCommand = `
      [실제 입력 데이터]
      위 예시 형식을 완벽히 모방하여, 아래 실제 데이터에 대한 JSON 결과물을 생성해라.
      부가 설명 없이 오직 JSON 객체만 반환해야 한다.
      사이즈표는 정보에 맞는 갯수로 객체를 반환해야 한다.
      특히 상품설명(sellingPoints) 작성 시 [코디 & 스타일], [디테일 & 핏], [소재 & 착용감], [모델정보], [상품스펙] 등 주제별 카드 형태로 작성하고, 핵심 키워드는 [red], [blue], [orange] 색상 태그를 적용하세요.
      ★글자수 제한 필수 준수: 모바일 화면에서 줄바꿈이 되지 않도록 각 설명 문장은 반드시 공백 포함 '최대 16자 이하'(12자~16자, 태그 제외 순수 텍스트 기준)로 간결하게 작성하고 절대 16자를 넘기지 마세요.
      - [코디 & 스타일]: 함께 입을 아이템과 연출 분위기/TPO를 결합하여 각 3~4줄 작성
      - [디테일 & 핏]: 넥라인, 단추, 셔링, 마감 디테일 및 체형커버 실루엣에 집중하여 각 3~4줄 작성
      - [소재 & 착용감]: 원단 텍스처, 통기성, 촉감 및 착용감에 집중하여 각 3~4줄 작성
      {
        "text": "${data.text}",
        "images": ["(첨부된 이미지 ${data.imageCount}개)"]
      }
    `;

    return perfectExample + finalCommand;
  };

  const callVisionAPI = async (systemInstruction: string, userPrompt: string, images: { mimeType: string; base64Image: string }[]) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [{ text: userPrompt }];
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Image
        }
      });
    });

    const response = await ai.models.generateContent({
      model: VISION_MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from Gemini");

    try {
      return JSON.parse(resultText);
    } catch (e) {
      console.log("JSON parsing failed, attempting fix...");
      return callTextAPIForJsonFix(resultText);
    }
  };

  const callTextAPIForJsonFix = async (brokenJsonText: string) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    const ai = new GoogleGenAI({ apiKey });
    const fixPrompt = `다음 텍스트는 유효하지 않은 JSON 형식입니다. 이 텍스트를 분석해서 유효한 JSON 객체 또는 JSON 배열로 완벽하게 수정해 주세요. 다른 설명이나 인사말, 마크다운 코드 블록 없이 오직 수정된 JSON 객체 또는 JSON 배열만 반환해야 합니다.\n[수정할 텍스트]\n${brokenJsonText}`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: fixPrompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const fixedText = response.text;
    if (!fixedText) throw new Error("Empty response from Gemini fix");
    return JSON.parse(fixedText);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && stagedFiles.length === 0) {
      showAlert('분석할 상품 정보가 없습니다.<br><b>텍스트</b>를 입력하거나 <b>이미지</b>를 추가해주세요.');
      return;
    }

    playSound(analyzeSoundRef);
    playSound(startSoundRef);
    setLoading(true);
    setResult(null);
    setStatusText('');
    setLoaderText('서버에서 지침을 가져오는 중...');

    try {
      // 1. Get instructions from Firestore or server API
      let systemInstructions = '';
      try {
        const { fetchActivePrompt } = await import('./lib/firebase');
        systemInstructions = await fetchActivePrompt();
      } catch (err) {
        const instRes = await axios.get('/api/instructions');
        systemInstructions = instRes.data.instructions;
      }

      setLoaderText('상품정보 분석하여 생성 중...');
      
      // 2. Call Gemini API directly from frontend (Platform requirement)
      const images = await Promise.all(stagedFiles.map(fileToBase64));
      cachedAnalysisContextRef.current = {
        text: textInput,
        images
      };
      currentAnalysisIdRef.current = null;

      const userPrompt = buildPrompt({ text: textInput, imageCount: images.length });
      const data = await callVisionAPI(systemInstructions, userPrompt, images);
      
      handleSuccess(data);
    } catch (error: any) {
      handleFailure(error);
    }
  };

  const handleSuccess = (data: ProductResponse) => {
    setLoading(false);
    setResult(data);
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setStatusText(`✅ 생성완료 까지 ${duration}초가 걸렸습니다.`);
    playSound(completeSoundRef);

    // Save analysis result to Firestore DB (max 100 retained)
    saveAnalysisResult({
      result: data,
      inputText: textInput,
      imageCount: stagedFiles.length,
      duration
    }).then((id) => {
      currentAnalysisIdRef.current = id;
    }).catch(err => {
      console.warn("Firestore analysis save error:", err);
    });

    const hasIssue = data.notification?.includes('🚨') || data.notification?.includes('⚠️') || 
                     data.sizeCharts?.some(c => c.notification?.includes('🚨') || c.notification?.includes('⚠️'));
    
    setTimeout(() => {
      playSound(hasIssue ? hasNotifSoundRef : noNotifSoundRef);
    }, 1000);

    if (autoDownload && data.sizeCharts && data.sizeCharts.length > 0) {
      setTimeout(downloadSizeCharts, 1500);
    }

    // Scroll to result
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  };

  const handleLoadAnalysisFromHistory = (savedResult: ProductResponse, savedInputText?: string, id?: string) => {
    setResult(savedResult);
    if (savedInputText) {
      setTextInput(savedInputText);
    }
    if (id) {
      currentAnalysisIdRef.current = id;
    }
    cachedAnalysisContextRef.current = {
      text: savedInputText || '',
      images: []
    };
    setStatusText('✅ 저장된 분석 기록을 화면에 불러왔습니다.');
    playSound(completeSoundRef);
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  // Re-analyze a specific section (1 ~ 6)
  const handleExecuteSectionReanalyze = async (sectionNum: number, userNote: string) => {
    if (loading || reanalyzingSection !== null) return;

    // Determine images
    let imagesToUse: { mimeType: string; base64Image: string }[] = [];
    if (stagedFiles.length > 0) {
      imagesToUse = await Promise.all(stagedFiles.map(fileToBase64));
    } else if (cachedAnalysisContextRef.current?.images && cachedAnalysisContextRef.current.images.length > 0) {
      imagesToUse = cachedAnalysisContextRef.current.images;
    }

    // Determine text
    const textToUse = textInput.trim() || cachedAnalysisContextRef.current?.text || '';

    if (!textToUse && imagesToUse.length === 0) {
      showAlert('재분석을 위한 상품 텍스트 정보 또는 이미지가 없습니다.<br>상단에 상품 텍스트를 입력하거나 이미지를 첨부해주세요.');
      return;
    }

    if (!result) {
      showAlert('재분석할 기존 결과가 없습니다.');
      return;
    }

    playSound(analyzeSoundRef);
    setReanalyzingSection(sectionNum);
    setStatusText(`⏳ [${sectionNum}번 항목] 새롭게 분석하는 중입니다... 잠시만 기다려주세요.`);

    try {
      let systemInstructions = '';
      try {
        const { fetchActivePrompt } = await import('./lib/firebase');
        systemInstructions = await fetchActivePrompt();
      } catch (err) {
        const instRes = await axios.get('/api/instructions');
        systemInstructions = instRes.data.instructions;
      }

      const prompt = buildSectionPrompt(sectionNum, userNote, {
        text: textToUse,
        imageCount: imagesToUse.length,
        currentResult: result
      });

      const sectionData = await callVisionAPI(systemInstructions, prompt, imagesToUse);

      let updatedResult: ProductResponse = { ...result };

      if (sectionNum === 1) {
        const newMainInfo = sectionData.mainInfo || {
          material: sectionData.material || result.mainInfo?.material || '',
          colors: sectionData.colors || result.mainInfo?.colors || '',
          sizes: sectionData.sizes || result.mainInfo?.sizes || '',
          manufacturerImporter: sectionData.manufacturerImporter || result.mainInfo?.manufacturerImporter || '파라컴(구매대행)',
          laundryInfo: sectionData.laundryInfo || result.mainInfo?.laundryInfo || '',
          dateOfManufacture: sectionData.dateOfManufacture || result.mainInfo?.dateOfManufacture || '상품 발송일 기준 6개월 이내 제조',
          qualityGuarantee: sectionData.qualityGuarantee || result.mainInfo?.qualityGuarantee || '관련 법 및 소비자 분쟁 해결 기준에 따름'
        };
        updatedResult = { ...result, mainInfo: newMainInfo };
      } else if (sectionNum === 2) {
        const pName1 = sectionData.productName || sectionData.name1 || sectionData.title;
        const pName2 = sectionData.productName2 || sectionData.name2;
        updatedResult = {
          ...result,
          productName: pName1 || result.productName,
          productName2: pName2 || result.productName2
        };
      } else if (sectionNum === 3) {
        let tags = '';
        if (typeof sectionData.searchTags === 'string') {
          tags = sectionData.searchTags;
        } else if (Array.isArray(sectionData.searchTags)) {
          tags = sectionData.searchTags.join(', ');
        } else if (typeof sectionData === 'string') {
          tags = sectionData;
        }
        updatedResult = {
          ...result,
          searchTags: tags || result.searchTags
        };
      } else if (sectionNum === 4) {
        const newOptions = sectionData.options || sectionData;
        updatedResult = {
          ...result,
          options: newOptions
        };
      } else if (sectionNum === 5) {
        let points = '';
        if (typeof sectionData.sellingPoints === 'string') {
          points = sectionData.sellingPoints;
        } else if (typeof sectionData === 'string') {
          points = sectionData;
        }
        updatedResult = {
          ...result,
          sellingPoints: points || result.sellingPoints
        };
      } else if (sectionNum === 6) {
        let charts: SizeChart[] = [];
        if (Array.isArray(sectionData.sizeCharts)) {
          charts = sectionData.sizeCharts;
        } else if (Array.isArray(sectionData)) {
          charts = sectionData;
        } else if (sectionData.sizeChart) {
          charts = [sectionData];
        }
        updatedResult = {
          ...result,
          sizeCharts: charts.length > 0 ? charts : result.sizeCharts
        };
      }

      setResult(updatedResult);
      setRecentlyUpdatedSection(sectionNum);
      setTimeout(() => {
        setRecentlyUpdatedSection((prev) => (prev === sectionNum ? null : prev));
      }, 4000);

      playSound(completeSoundRef);
      setStatusText(`✅ [${sectionNum}번 항목] 재분석 완료! 새로운 결과가 화면에 반영되었습니다.`);

      // If section 6 re-analyzed and autoDownload enabled, auto download
      if (sectionNum === 6 && autoDownload) {
        setTimeout(downloadSizeCharts, 600);
      }

      // Synchronize update with Firestore if currently editing a recorded analysis
      if (currentAnalysisIdRef.current) {
        updateAnalysisResult(currentAnalysisIdRef.current, updatedResult);
      }
    } catch (error: any) {
      playSound(errorSoundRef);
      const errorData = error.response?.data?.error || error.message || '알 수 없는 오류가 발생했습니다.';
      showAlert(`<b>[${sectionNum}번 항목] 재분석 중 오류가 발생했습니다.</b><br><br>${errorData}`);
    } finally {
      setReanalyzingSection(null);
    }
  };

  const handleFailure = (error: any) => {
    setLoading(false);
    playSound(errorSoundRef);
    const errorData = error.response?.data?.error || error.message || '알 수 없는 오류가 발생했습니다.';
    let msg = errorData;
    if (msg.includes('429')) msg = '🚦 요청 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    else if (msg.includes('503')) msg = '🤖 AI 서버가 현재 매우 바쁩니다. 잠시 후 다시 시도해 주세요.';
    showAlert('<b>분석 중 오류가 발생했습니다.</b><br><br>' + msg);
  };

  const handleReset = () => {
    playSound(resetSoundRef);
    setTextInput('');
    setStagedFiles([]);
    setResult(null);
    setStatusText('');
    setLoading(false);
    currentAnalysisIdRef.current = null;
    cachedAnalysisContextRef.current = null;
    setReanalyzingSection(null);
    setRecentlyUpdatedSection(null);
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    
    const showFeedback = () => {
      if (target) {
        target.classList.add('copied-feedback');
        setTimeout(() => target.classList.remove('copied-feedback'), 1000);
      }
      playSound(copySoundRef);
    };

    const tryFallback = () => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Ensure it's in the DOM and technically "visible" for execCommand to work in some browsers
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) showFeedback();
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      
      document.body.removeChild(textArea);
    };

    // 1. Try navigator.clipboard
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(showFeedback)
        .catch((err) => {
          console.warn('navigator.clipboard failed, trying fallback...', err);
          tryFallback();
        });
    } else {
      // 2. Fallback to execCommand
      tryFallback();
    }
  };

  const adjustTableCellFontSize = (container: HTMLElement) => {
    const cells = container.querySelectorAll('th, td');
    const defaultFontSize = 24;
    const minFontSize = 18;

    cells.forEach((cell: any) => {
      cell.style.fontSize = `${defaultFontSize}px`;
      let currentFontSize = defaultFontSize;

      while (cell.scrollWidth > cell.clientWidth && currentFontSize > minFontSize) {
        currentFontSize -= 0.5;
        cell.style.fontSize = `${currentFontSize}px`;
      }
    });
  };

  const downloadSizeCharts = async () => {
    if (!sizeChartsRef.current) return;
    
    // 1. 소리 재생
    playSound(downloadSoundRef);

    // 2. 이미지 캡처 전 폰트 크기 조절
    adjustTableCellFontSize(sizeChartsRef.current);

    // [핵심] 브라우저가 폰트 크기 변경에 따른 레이아웃을 다시 계산할 시간을 줍니다.
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      // 3. html-to-image (toPng)를 사용하여 캡처
      const node = sizeChartsRef.current;
      const targetWidth = 1200;
      const targetHeight = (node.offsetHeight * targetWidth) / node.offsetWidth;

      const dataUrl = await toPng(node, {
        canvasWidth: targetWidth,
        canvasHeight: targetHeight,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      // 4. 다운로드 실행
      const link = document.createElement('a');
      link.download = 'all-size-charts.png';
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusText((prev) => prev + '\n✅ 사이즈표 다운로드가 완료 되었습니다.');
    } catch (err) {
      console.error('이미지 생성 오류:', err);
      showAlert('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  const scrollToTop = () => {
    playSound(scrollSoundRef);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-5 w-[800px] mx-auto">
      {/* 4. [중요] 최상단 플로팅 알림 토스트 UI 규격 (화면 밀림 0% 방지) */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] pointer-events-auto max-w-[90vw] sm:max-w-xl shadow-2xl">
          <div className="px-4 py-3 rounded-2xl bg-slate-900/95 border border-emerald-400/60 text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span className="font-semibold text-white">{toast.text}</span>
            </div>
            <button onClick={() => setToast(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Audio Elements */}
      <audio ref={startSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/luvvoice.com-20250914-buhnDd.mp3" />
      <audio ref={completeSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/luvvoice.com-20250914-viESFc.mp3" />
      <audio ref={errorSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/luvvoice.com-20250914-zqPwus.mp3" />
      <audio ref={noNotifSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/luvvoice.com-20250923-MpMlP4.mp3" />
      <audio ref={hasNotifSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/luvvoice.com-20250923-eryuyK.mp3" />
      <audio ref={copySoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/Blop%20Sound.mp3" />
      <audio ref={resetSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/Storytelling%20Cartoon%20PopVocal%2003.mp3" />
      <audio ref={downloadSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/Storytelling%20Cartoon%20PopVocal%2003.mp3" />
      <audio ref={scrollSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/Blop%20Sound.mp3" />
      <audio ref={analyzeSoundRef} src="https://github.com/dafayon-byte/my-sounds/raw/refs/heads/main/Storytelling%20Cartoon%20PopVocal%2003.mp3" />

      <div 
        className="main-container border-2 border-blue-900/50 shadow-[0_0_20px_rgba(30,58,138,0.3)] p-6"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-active'); }}
        onDragLeave={(e) => e.currentTarget.classList.remove('drag-active')}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-active');
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
              addFiles(files);
            }
          }
        }}
      >
        <div className="text-center py-8 px-4 border border-blue-900/30 rounded-xl bg-slate-900/40 mb-4 relative overflow-hidden">
          {/* Top Left: Gemini Model Version Badge & FARACOM TOOL 다운로드 버튼 */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 items-start">
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/90 border border-blue-500/40 rounded-lg shadow-md text-xs backdrop-blur-sm select-none"
              title={`현재 구동 중인 AI 엔진: ${VISION_MODEL_NAME}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300 font-bold tracking-tight">Gemini <span className="text-cyan-400 font-extrabold">{VISION_MODEL_NAME.replace('gemini-', '')}</span></span>
            </div>

            {/* 3. 확장 프로그램 다운로드 버튼 및 연동 지원 UI */}
            <div className="flex items-center gap-1.5">
              <a
                href="/api/download-extension"
                download="FARACOM-TOOL-Extension.zip"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow shadow-emerald-600/30 whitespace-nowrap cursor-pointer"
                title="쇼핑몰 텍스트/이미지 1:1 수집 크롬 확장 프로그램 다운로드"
              >
                <Download size={14} />
                <span>FARACOM TOOL (의류) 다운로드</span>
              </a>
              <button
                type="button"
                onClick={() => setIsExtensionGuideOpen(true)}
                className="p-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-emerald-400/50 shadow transition-all cursor-pointer"
                title="확장 프로그램 설치 가이드 및 연동 테스트"
              >
                <HelpCircle size={14} />
              </button>
            </div>
          </div>

          {/* Top Right Buttons: Prompt, Analysis History, Size Chart Disclaimer, Watermark */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
            <button
              type="button"
              onClick={() => setIsPromptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-lg border border-slate-700/80 hover:border-blue-400/80 shadow-md transition-all cursor-pointer whitespace-nowrap"
              title="프롬프트 수정 및 이력 관리"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>프롬프트</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAnalysisModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-lg border border-slate-700/80 hover:border-purple-400/80 shadow-md transition-all cursor-pointer whitespace-nowrap"
              title="의류 분석 기록 목록 및 불러오기"
            >
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>분석기록</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDisclaimerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-lg border border-slate-700/80 hover:border-emerald-400/80 shadow-md transition-all cursor-pointer whitespace-nowrap"
              title="사이즈표 하단 안내 문구 및 상호명 설정"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>사이즈표 문구</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWatermarkModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 font-bold text-xs rounded-lg border shadow-md transition-all cursor-pointer whitespace-nowrap ${
                watermarkSettings.enabled 
                  ? 'text-indigo-300 border-indigo-500/80 hover:border-indigo-400' 
                  : 'text-slate-400 border-slate-700/80 hover:text-white'
              }`}
              title="사이즈표 불펌방지 워터마크 설정 (문구, 투명도, 대각선 각도, 간격 등)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              <span>워터마크 설정</span>
              {watermarkSettings.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block animate-pulse"></span>
              )}
            </button>
          </div>

          <div className="header-optical-shape h-shape-1"></div>
          <div className="header-optical-shape h-shape-2"></div>
          <div className="header-optical-shape h-shape-3"></div>
          <div className="header-optical-shape h-shape-4"></div>
          
          <h1 className="text-3xl md:text-4xl font-black text-white mb-1 tracking-tight relative z-10">
            파라컴툴 의류상품 분석
          </h1>
          <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-4 tracking-tight relative z-10">
            사이즈표 생성
          </h2>
          
          <div className="inline-flex items-center gap-2 px-8 py-2 border border-blue-500/30 rounded-full bg-blue-500/5 mb-6 shadow-[0_0_15px_rgba(59,130,246,0.1)] relative z-10">
            <span className="text-yellow-400">✨</span>
            <span className="text-blue-400 font-black tracking-[0.2em] text-sm">GEMINI AI</span>
          </div>

          <div className="w-full h-px bg-slate-700/50 mb-6 max-w-2xl mx-auto relative z-10"></div>

          <p className="text-lg text-gray-400 mb-4 relative z-10">
            해외 상품 이미지와 텍스트를 입력하고 <span className="text-cyan-400 font-bold">분석하기</span> 클릭
          </p>

          <div className="flex flex-wrap justify-center gap-3 relative z-10">
            {['고시정보', '상품명', '검색태그', '옵션값', '상품설명', '사이즈표'].map((tag) => (
              <span key={tag} className="px-5 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-sm font-bold text-gray-300 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {loading && (
            <div className="loader">
              <div className="loader-overlay-grid"></div>
              <div className="loader-scanner"></div>
              <div className="loader-corners">
                <div className="corner tl"></div>
                <div className="corner tr"></div>
                <div className="corner bl"></div>
                <div className="corner br"></div>
              </div>
              <div className="loader-content">
                <div className="loader-ring"></div>
                <div className="loader-title-container">
                  <div className="optical-shape shape-1"></div>
                  <div className="optical-shape shape-2"></div>
                  <div className="optical-shape shape-3"></div>
                  <div className="loader-title">AI ANALYSIS</div>
                </div>
                <div id="loader-text" className="text-blue-400 font-bold mb-2">{loaderText}</div>
                <div className="text-gray-400 text-sm">({elapsedTime}초 경과)</div>
                <div className="mt-6 w-48 h-1 bg-slate-800 rounded-full overflow-hidden mx-auto">
                  <div className="h-full bg-blue-500 animate-progress-bar shadow-[0_0_10px_#3b82f6]"></div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-container">
              <div className="input-column">
                <label>상품 이미지 정보</label>
                <div 
                  id="dropZone" 
                  className={stagedFiles.length > 0 ? 'has-files' : ''}
                >
                  {stagedFiles.length === 0 ? (
                    <div className="drop-zone-empty" onClick={() => fileInputRef.current?.click()} title="클릭하여 파일 추가 또는 클립보드 붙여넣기(Ctrl+V)">
                      <span id="dropZonePrompt">이미지 파일을 끌어다 놓거나 클릭, 또는 캡처 후 붙여넣기(Ctrl+V)</span>
                    </div>
                  ) : (
                    <div id="fileList">
                      {stagedFiles.map((file, i) => (
                        <div key={i} className="file-preview-item">
                          <img src={previewUrls[i]} alt={`preview-${i}`} referrerPolicy="no-referrer" />
                          <button type="button" className="remove-preview-btn" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>×</button>
                        </div>
                      ))}
                      <div className="add-file-btn" onClick={() => fileInputRef.current?.click()} title="이미지 추가 또는 클립보드 붙여넣기(Ctrl+V)">
                        <div className="plus-icon">+</div>
                        <span>이미지 추가</span>
                      </div>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple hidden accept="image/*" />
              </div>

              <div className="input-column">
                <label>상품 텍스트 정보</label>
                <div className="textarea-wrapper">
                  {!textInput && <span id="text-placeholder">상품의 원문 텍스트를 넣어 주세요.</span>}
                  <textarea id="textInput" value={textInput} onChange={(e) => setTextInput(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="button-group">
              <div className="main-buttons">
                <button type="submit" disabled={loading}>상품정보 분석하기</button>
                <button type="button" className="reset-btn" onClick={handleReset} disabled={loading}>상품정보 초기화</button>
              </div>
              
              <div className="toggle-group">
                <div className="toggle-container">
                  <span>사이즈표 자동 다운로드 온/오프</span>
                  <input type="checkbox" id="autoDownload" checked={autoDownload} onChange={(e) => { setAutoDownload(e.target.checked); localStorage.setItem('autoDownloadEnabled', String(e.target.checked)); }} />
                  <label htmlFor="autoDownload"></label>
                </div>

                <div className="toggle-container">
                  <span>음성 안내 및 효과음 온/오프</span>
                  <input type="checkbox" id="soundToggle" checked={soundEnabled} onChange={(e) => { setSoundEnabled(e.target.checked); localStorage.setItem('soundEnabled', String(e.target.checked)); }} />
                  <label htmlFor="soundToggle"></label>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div ref={resultRef}>
          {statusText && <div className="status-info whitespace-pre-line">{statusText}</div>}

          <div id="result">
          {result && (
            <div className="result-padding">
              {/* Notifications */}
              <div className={`notification ${result.notification && result.notification.includes('🚨') ? 'notif-danger' : 'notif-warning'}`}>
                {result.notification || "상품정보에 특별한 이슈가 없습니다"}
              </div>

              {/* Main Info */}
              {result.mainInfo && (
                <div className="output-section">
                  <SectionHeaderWithReanalyze
                    sectionNumber={1}
                    title="1. 상품 고시 정보"
                    isReanalyzing={reanalyzingSection === 1}
                    isRecentlyUpdated={recentlyUpdatedSection === 1}
                    disabled={loading || reanalyzingSection !== null}
                    onExecuteReanalyze={handleExecuteSectionReanalyze}
                  />
                  <CopyableItem label="제품 소재" value={result.mainInfo.material} onCopy={copyToClipboard} />
                  <CopyableItem label="색상" value={result.mainInfo.colors} onCopy={copyToClipboard} />
                  <CopyableItem label="치수" value={result.mainInfo.sizes} onCopy={copyToClipboard} />
                  <CopyableItem label="제조자/수입자" value={result.mainInfo.manufacturerImporter} onCopy={copyToClipboard} />
                  <CopyableItem label="세탁방법 및 취급시 주의사항" value={result.mainInfo.laundryInfo} onCopy={copyToClipboard} />
                  <CopyableItem label="제조연월" value={result.mainInfo.dateOfManufacture} onCopy={copyToClipboard} />
                  <CopyableItem label="품질보증기준" value={result.mainInfo.qualityGuarantee} onCopy={copyToClipboard} />
                </div>
              )}

              {/* Product Names */}
              {(result.productName || result.productName2) && (
                <div className="output-section">
                  <SectionHeaderWithReanalyze
                    sectionNumber={2}
                    title="2. 상품명"
                    isReanalyzing={reanalyzingSection === 2}
                    isRecentlyUpdated={recentlyUpdatedSection === 2}
                    disabled={loading || reanalyzingSection !== null}
                    onExecuteReanalyze={handleExecuteSectionReanalyze}
                  />
                  {result.productName && <CopyableItem label="기본 상품명" value={result.productName} onCopy={copyToClipboard} isCode />}
                  {result.productName2 && <CopyableItem label="예비 상품명" value={result.productName2} onCopy={copyToClipboard} isCode />}
                </div>
              )}

              {/* Search Tags */}
              {result.searchTags && (
                <div className="output-section">
                  <SectionHeaderWithReanalyze
                    sectionNumber={3}
                    title="3. 검색태그"
                    isReanalyzing={reanalyzingSection === 3}
                    isRecentlyUpdated={recentlyUpdatedSection === 3}
                    disabled={loading || reanalyzingSection !== null}
                    onExecuteReanalyze={handleExecuteSectionReanalyze}
                  />
                  <CopyableItem label="검색태그" value={result.searchTags} onCopy={copyToClipboard} isCode />
                </div>
              )}

              {/* Options */}
              {result.options && (
                <div className="output-section">
                  <SectionHeaderWithReanalyze
                    sectionNumber={4}
                    title="4. 옵션명"
                    isReanalyzing={reanalyzingSection === 4}
                    isRecentlyUpdated={recentlyUpdatedSection === 4}
                    disabled={loading || reanalyzingSection !== null}
                    onExecuteReanalyze={handleExecuteSectionReanalyze}
                  />
                  {result.options.group1 && <CopyableItem label="옵션 그룹 1" value={result.options.group1} onCopy={copyToClipboard} />}
                  {result.options.values && (
                    <div className="output-section-item">
                      <strong>옵션 값:</strong>
                      {result.options.values.map((v, i) => (
                        <code key={i} className="copyable block mt-1" onClick={(e) => copyToClipboard(v, e)}>{v}</code>
                      ))}
                    </div>
                  )}
                  {result.options.group2 && (
                    <>
                      <CopyableItem label="옵션 그룹 2" value={result.options.group2} onCopy={copyToClipboard} />
                      <div className="output-section-item">
                        <strong>사이즈 값:</strong>
                        {result.options.sizeValues.map((s, i) => (
                          <code key={i} className="copyable block mt-1" onClick={(e) => copyToClipboard(s, e)}>{s}</code>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Selling Points */}
              {result.sellingPoints && (
                <div className="output-section">
                  <SectionHeaderWithReanalyze
                    sectionNumber={5}
                    title="5. 상품설명(소구점 카드)"
                    isReanalyzing={reanalyzingSection === 5}
                    isRecentlyUpdated={recentlyUpdatedSection === 5}
                    disabled={loading || reanalyzingSection !== null}
                    onExecuteReanalyze={handleExecuteSectionReanalyze}
                  />
                  <div className="mt-2">
                    <SellingPointsCardViewer
                      rawText={result.sellingPoints}
                      onCopySuccess={(msg) => setStatusText((prev) => prev + '\n' + msg)}
                      playSound={playSound}
                      copySoundRef={copySoundRef}
                    />
                  </div>
                </div>
              )}

              {/* Size Charts */}
              <div className="output-section">
                <SectionHeaderWithReanalyze
                  sectionNumber={6}
                  title="6. 사이즈표"
                  isReanalyzing={reanalyzingSection === 6}
                  isRecentlyUpdated={recentlyUpdatedSection === 6}
                  disabled={loading || reanalyzingSection !== null}
                  onExecuteReanalyze={handleExecuteSectionReanalyze}
                />
                {result.sizeCharts && result.sizeCharts.length > 0 ? (
                  <>
                    <div 
                      id="allSizeChartsContainer" 
                      ref={sizeChartsRef}
                      style={getWatermarkBackgroundStyle(watermarkSettings)}
                    >
                      {result.sizeCharts.map((chart, i) => (
                        <div key={i} className="single-chart-section">
                          <div className="size-chart-top-header">
                            <div className="size-chart-title-text" contentEditable="true" suppressContentEditableWarning>
                              {chart.title}
                            </div>
                            <div className="size-chart-unit" contentEditable="true" suppressContentEditableWarning>
                              (단위: cm, kg)
                            </div>
                          </div>
                          <div className="size-chart-single-table-container">
                            <MarkdownTable markdown={chart.sizeChart} onCopy={copyToClipboard} />
                          </div>
                          {i < result.sizeCharts!.length - 1 && <hr className="chart-separator" />}
                        </div>
                      ))}
                      <div className="size-chart-disclaimer" contentEditable="true" suppressContentEditableWarning>
                        {renderDisclaimerContent(sizeChartDisclaimer)}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
                      <button 
                        type="button"
                        onClick={() => setIsDisclaimerModalOpen(true)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-lg border border-slate-700 hover:border-emerald-500/60 shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                        title="사이즈표 하단 문구 수정 및 저장"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>하단 문구 설정</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsWatermarkModalOpen(true)}
                        className={`px-4 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-lg border shadow transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          watermarkSettings.enabled
                            ? 'text-indigo-300 border-indigo-500/80 hover:border-indigo-400'
                            : 'text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="사이즈표 불펌방지 워터마크 설정 (문구, 투명도, 대각선 각도, 간격 등)"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                        <span>워터마크 설정 {watermarkSettings.enabled ? `(ON: ${Math.round(watermarkSettings.opacity * 100)}%)` : '(OFF)'}</span>
                      </button>
                      <button className="download-btn w-64" onClick={downloadSizeCharts}>사이즈표 이미지 다운로드</button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                    생성된 사이즈표가 없습니다. 상단의 [다시 분석하기] 버튼을 눌러 사이즈표를 새롭게 생성할 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      </div>

      {showScrollTop && (
        <button id="scrollToTopBtn" onClick={scrollToTop} className="visible">▲</button>
      )}

      {alert.show && (
        <div className="custom-alert-overlay">
          <div className="custom-alert-box">
            <h2>알림</h2>
            <p dangerouslySetInnerHTML={{ __html: alert.message }} />
            <button className="custom-alert-btn" onClick={closeAlert}>확인</button>
          </div>
        </div>
      )}

      <PromptManagerModal 
        isOpen={isPromptModalOpen} 
        onClose={() => setIsPromptModalOpen(false)} 
      />

      <AnalysisHistoryModal 
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onLoadAnalysis={handleLoadAnalysisFromHistory}
      />

      <SizeChartDisclaimerModal
        isOpen={isDisclaimerModalOpen}
        onClose={() => setIsDisclaimerModalOpen(false)}
        currentDisclaimer={sizeChartDisclaimer}
        onSaved={(newDisclaimer) => {
          setSizeChartDisclaimer(newDisclaimer);
          playSound(completeSoundRef);
          setStatusText((prev) => prev + '\n✅ 사이즈표 하단 문구가 Firestore DB에 저장되었습니다.');
        }}
      />

      <WatermarkSettingsModal
        isOpen={isWatermarkModalOpen}
        onClose={() => setIsWatermarkModalOpen(false)}
        settings={watermarkSettings}
        onSaved={(newSettings) => {
          setWatermarkSettings(newSettings);
          playSound(completeSoundRef);
          setStatusText((prev) => prev + `\n✅ 워터마크 설정이 저장되었습니다. (상태: ${newSettings.enabled ? 'ON' : 'OFF'}, 문구: ${newSettings.text})`);
        }}
      />

      <ExtensionGuideModal
        isOpen={isExtensionGuideOpen}
        onClose={() => setIsExtensionGuideOpen(false)}
        onSimulate={handleSimulateFaracomTool}
      />

      {/* 창 전체 이미지 끌어오기(드래그앤드롭) 오버레이 */}
      {isWindowDragging && (
        <div className="window-drag-overlay">
          <div className="window-drag-box">
            <div className="p-4 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-400">
              <UploadCloud className="w-16 h-16 animate-bounce" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                이미지를 창 아무 곳에나 놓으세요
              </h3>
              <p className="text-sm font-semibold text-blue-300">
                상품 상세/사이즈표 이미지가 자동으로 분석 목록에 추가됩니다
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-blue-500/30 text-xs text-slate-300 font-mono">
              <span>JPG, PNG, WEBP 지원</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderDisclaimerContent(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const parts = line.split('★');
    return (
      <span key={idx}>
        {parts.map((part, pIdx) => (
          <span key={pIdx}>
            {part}
            {pIdx < parts.length - 1 && <span className="star">★</span>}
          </span>
        ))}
        {idx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function CopyableItem({ label, value, onCopy, isCode = false }: { label: string; value: string; onCopy: any; isCode?: boolean }) {
  return (
    <div className="output-section-item">
      <strong>{label}:</strong>
      {isCode ? (
        <code className="copyable mt-1" onClick={(e) => onCopy(value, e)}>{value}</code>
      ) : (
        <div className="copyable copyable-box cursor-pointer" onClick={(e) => onCopy(value, e)}>
          {value}
        </div>
      )}
    </div>
  );
}

function MarkdownTable({ markdown, onCopy }: { markdown: string; onCopy: any }) {
  const rows = markdown.trim().split(/\\n|\n/).filter(r => r.trim() !== '');
  if (rows.length < 3) return null;

  const headers = rows[0].split('|').map(h => h.trim()).filter(h => h);
  const dataRows = rows.slice(2).map(row => row.split('|').map(c => c.trim()).filter(c => c));

  const formatCell = (text: string) => {
    // (cm) -> <br><span class="small-info">(cm)</span>
    const regex = /\((.*?)\)$/;
    const match = text.match(regex);
    if (match) {
      const mainText = text.replace(regex, '').trim();
      return (
        <>
          {mainText}
          <br />
          <span className="small-info">({match[1]})</span>
        </>
      );
    }
    return text;
  };

  return (
    <table>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} contentEditable="true" suppressContentEditableWarning onClick={(e) => onCopy(h, e)} className="copyable">
              {formatCell(h)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dataRows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} contentEditable="true" suppressContentEditableWarning onClick={(e) => onCopy(cell, e)} className="copyable">
                {formatCell(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
