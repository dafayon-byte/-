import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const DEFAULT_INSTRUCTIONS = `당신은 전문적인 의류 상품 정보 분석가이자 데이터 생성기입니다.
제공된 이미지와 텍스트를 분석하여 사용자가 쇼핑몰에 바로 등록할 수 있는 완벽한 JSON 데이터를 생성해야 합니다.

[분석 지침]
1. 이미지 분석: 이미지에서 상품의 디자인, 색상, 소재감, 디테일(단추, 지퍼, 패턴 등)을 정확히 파악하세요.
2. 텍스트 분석: 제공된 텍스트에서 사이즈 정보, 소재 혼용률, 세탁 방법 등을 추출하세요.
3. 브랜드 감지: 이미지나 텍스트에 유명 브랜드 로고나 명칭이 포함되어 있는지 확인하고, 발견 시 notification 필드에 경고 문구를 넣으세요.
4. 상품명 생성: 검색 최적화(SEO)를 고려하여 클릭을 유도하는 매력적인 상품명을 생성하세요.
5. 소구점 추출:
- 첨부된 이미지와 텍스트를 정밀 분석하여 상품의 매력을 극대화하는 주제별 카드형 소구점을 작성하세요.
- 구성 가능한 주제(상황에 맞게 3개 선택 + 마지막에 [상품스펙] 필수 배치, [모델정보]는 정보가 있을 경우 필수 포함):
  [코디 & 스타일], [디테일 & 핏], [소재 & 착용감], [모델정보](정보가 있을 경우 필수 포함), [상품스펙]
- 일반 설명 주제([코디 & 스타일], [디테일 & 핏], [소재 & 착용감])는 각 3~4줄의 간결하고 운율감 있는 문장으로 작성하세요.
  - [코디 & 스타일]: 상품과 함께 매치하기 좋은 패션 아이템(아우터, 이너, 신발, 가방, 액세서리 등)과 추천 스타일/TPO(오피스룩, 데이트룩, 하객룩, 파티룩, 클럽룩, 데일리룩 등 연출 분위기)를 자연스럽게 결합하여 3~4줄로 작성하세요. (예: "자켓과 힐을 매치한 [red]세련된 오피스룩[/red]", "데님에 가볍게 걸친 [blue]감각적 데일리룩[/blue]")
  - [디테일 & 핏]: 넥라인, 단추, 셔링, 포켓, 봉제 및 마감 디테일, 체형 커버 및 실루엣(A라인, 오버핏 등)에 집중하여 3~4줄로 작성하세요. (예: "정갈한 넥라인 [red]바이어스 마감[/red]", "은은한 포인트 [blue]백버튼 셔링 라인[/blue]")
  - [소재 & 착용감]: 원단 고유의 텍스처(결감, 린넨/코튼 등 소재감), 통기성, 신축성, 부드러운 촉감 및 편안한 착용감에 집중하여 3~4줄로 작성하세요. (예: "내추럴한 결감의 [red]고급 천연 린넨[/red]", "여름에도 쾌적한 [blue]탁월한 통기성[/blue]")
- 각 주제(블록) 사이에는 반드시 빈 줄 1줄을 두어 구분하세요.
- 핵심 키워드 색상 강조 태그: 한 줄당 강조 태그는 최대 1개 적용 ([red]키워드[/red], [blue]키워드[/blue], [orange]키워드[/orange])
- 문장 글자수 제한(★모바일 가독성 핵심 규칙): 한 줄당 공백 포함 '최대 16자 이하'(12자~16자, 태그 제외 순수 텍스트 기준)로 반드시 작성하세요. 모바일 화면 줄바꿈 방지를 위해 16자를 절대 초과하지 마세요.
- 문장 끝맺음: '입니다', '~다', '~요' 등의 서술어 없이 간결한 명사형 어구로 마무리.
- 구성품 규칙: 상품정보에 악세사리 포함 명시가 없을 경우 구성품에 대해 절대 언급 금지.
- 모델정보: 정보가 있을 때만 작성, 단위 표시 없이 숫자만 정돈 (예: ■ 키 : 165 / ■ 몸무게 : 48 / ■ 착용사이즈 : S), 중국 근 단위는 kg 환산.
- 상품스펙: 글머리 기호(■) 사용 정돈 (예: ■ 종류 : 원피스, 투피스 세트 / ■ 색상 : 크림, 블랙 / ■ 주소재 : 면 100% / ■ 사이즈 : S, M, L, XL)
6. 사이즈표 생성: 텍스트의 사이즈 정보를 바탕으로 마크다운 표 형식의 사이즈표를 생성하세요.

[출력 형식]
반드시 JSON 형식으로만 응답해야 하며, 다른 설명은 포함하지 마세요.`;

// Fetch Google Sheet instructions
export async function fetchGoogleSheetPrompt(): Promise<string> {
  try {
    const SPREADSHEET_ID = "1qKHqMjvJcl2unJ7Z8xD0wR9g47Pu8EhCxrCafgFC6Hs";
    const SHEET_NAME = "Sheet2";
    const PROMPT_CELL = "A1";
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=${PROMPT_CELL}`;
    
    const response = await fetch(gvizUrl);
    let instructions = await response.text();

    if (instructions && instructions.startsWith('"') && instructions.endsWith('"')) {
      instructions = instructions.substring(1, instructions.length - 1).replace(/""/g, '"');
    }

    if (instructions && instructions.trim().length > 0) {
      return instructions.trim();
    }
  } catch (error) {
    console.warn('Failed to fetch from Google Sheet:', error);
  }
  return DEFAULT_INSTRUCTIONS;
}

export interface PromptHistoryItem {
  id: string;
  content: string;
  createdAt: any;
  title?: string;
}

// Get the active prompt from Firestore
export async function fetchActivePrompt(): Promise<string> {
  try {
    const activeDocRef = doc(db, 'prompts', 'active');
    const docSnap = await getDoc(activeDocRef);

    if (docSnap.exists() && docSnap.data().content) {
      return docSnap.data().content as string;
    } else {
      // Fetch initial prompt from Google Sheets or fallback to DEFAULT_INSTRUCTIONS
      const sheetPrompt = await fetchGoogleSheetPrompt();
      
      await setDoc(activeDocRef, {
        content: sheetPrompt,
        updatedAt: Timestamp.now()
      });
      
      // Save initial version in history
      const historyColRef = collection(db, 'prompt_history');
      await addDoc(historyColRef, {
        content: sheetPrompt,
        title: `초기 프롬프트 (${new Date().toLocaleString('ko-KR')})`,
        createdAt: Timestamp.now()
      });
      return sheetPrompt;
    }
  } catch (error) {
    console.warn('Error fetching active prompt from Firestore, falling back:', error);
    return DEFAULT_INSTRUCTIONS;
  }
}

// Save a new prompt version to Firestore
export async function saveNewPrompt(content: string, customTitle?: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('프롬프트 내용을 입력해주세요.');

  const now = Timestamp.now();
  const dateStr = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const autoTitle = customTitle || '프롬프트 저장본';

  // 1. Update active document
  const activeDocRef = doc(db, 'prompts', 'active');
  await setDoc(activeDocRef, {
    content: trimmed,
    updatedAt: now
  });

  // 2. Add to prompt history collection
  const historyColRef = collection(db, 'prompt_history');
  await addDoc(historyColRef, {
    content: trimmed,
    title: autoTitle,
    createdAt: now
  });
}

export interface FetchPromptHistoryResult {
  items: PromptHistoryItem[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// Get history of previous prompts with pagination (default 5 items per fetch)
export async function fetchPromptHistoryPaged(
  pageSize: number = 5,
  lastVisibleDoc?: QueryDocumentSnapshot<DocumentData> | null
): Promise<FetchPromptHistoryResult> {
  try {
    const historyColRef = collection(db, 'prompt_history');
    let q;
    if (lastVisibleDoc) {
      q = query(historyColRef, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(pageSize));
    } else {
      q = query(historyColRef, orderBy('createdAt', 'desc'), limit(pageSize));
    }
    const snapshot = await getDocs(q);

    const items: PromptHistoryItem[] = [];
    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      items.push({
        id: docSnap.id,
        content: data.content || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        title: data.title || '이전 프롬프트'
      });
    });

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const hasMore = snapshot.docs.length === pageSize;

    return { items, lastDoc, hasMore };
  } catch (error) {
    console.error('Error fetching prompt history paged:', error);
    return { items: [], lastDoc: null, hasMore: false };
  }
}

// Get history of previous prompts
export async function fetchPromptHistory(): Promise<PromptHistoryItem[]> {
  try {
    const historyColRef = collection(db, 'prompt_history');
    const q = query(historyColRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const history: PromptHistoryItem[] = [];
    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      history.push({
        id: docSnap.id,
        content: data.content || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        title: data.title || '이전 프롬프트'
      });
    });

    return history;
  } catch (error) {
    console.error('Error fetching prompt history:', error);
    return [];
  }
}

// Delete a prompt history item from Firestore
export async function deletePromptHistoryItem(id: string): Promise<void> {
  const docRef = doc(db, 'prompt_history', id);
  await deleteDoc(docRef);
}

export interface AnalysisHistoryItem {
  id: string;
  title: string;
  inputText: string;
  imageCount: number;
  result: any;
  duration?: number;
  createdAt: any;
}

export interface FetchAnalysisHistoryResult {
  items: AnalysisHistoryItem[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// Save analysis result to Firestore (caps at 100 entries)
export async function saveAnalysisResult(params: {
  result: any;
  inputText?: string;
  imageCount?: number;
  duration?: number;
}): Promise<string> {
  try {
    const { result, inputText = '', imageCount = 0, duration = 0 } = params;
    const now = Timestamp.now();
    const title = result.productName || result.productName2 || '의류 상품 분석 결과';

    const colRef = collection(db, 'analysis_history');
    const docRef = await addDoc(colRef, {
      title,
      inputText,
      imageCount,
      result,
      duration,
      createdAt: now
    });

    // Cleanup oldest items if over 100 (non-blocking)
    (async () => {
      try {
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (snap.docs.length > 100) {
          const toDelete = snap.docs.slice(100);
          for (const d of toDelete) {
            await deleteDoc(d.ref).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Cleanup old analysis history warning:', err);
      }
    })();

    return docRef.id;
  } catch (error) {
    console.error('Error saving analysis result:', error);
    throw error;
  }
}

// Update existing analysis result in Firestore
export async function updateAnalysisResult(id: string, updatedResult: any): Promise<void> {
  try {
    const docRef = doc(db, 'analysis_history', id);
    const title = updatedResult.productName || updatedResult.productName2 || '의류 상품 분석 결과';
    await updateDoc(docRef, {
      result: updatedResult,
      title,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.warn('Error updating analysis result in Firestore:', error);
  }
}

// Fetch analysis history with pagination (5 items default)
export async function fetchAnalysisHistoryPaged(
  pageSize: number = 5,
  lastVisibleDoc?: QueryDocumentSnapshot<DocumentData> | null
): Promise<FetchAnalysisHistoryResult> {
  try {
    const colRef = collection(db, 'analysis_history');
    let q;
    if (lastVisibleDoc) {
      q = query(colRef, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(pageSize));
    } else {
      q = query(colRef, orderBy('createdAt', 'desc'), limit(pageSize));
    }
    const snapshot = await getDocs(q);

    const items: AnalysisHistoryItem[] = [];
    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      items.push({
        id: docSnap.id,
        title: data.title || '의류 상품 분석 결과',
        inputText: data.inputText || '',
        imageCount: data.imageCount || 0,
        result: data.result || {},
        duration: data.duration || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
      });
    });

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const hasMore = snapshot.docs.length === pageSize;

    return { items, lastDoc, hasMore };
  } catch (error) {
    console.error('Error fetching analysis history paged:', error);
    return { items: [], lastDoc: null, hasMore: false };
  }
}

// Delete an analysis history item from Firestore
export async function deleteAnalysisHistoryItem(id: string): Promise<void> {
  const docRef = doc(db, 'analysis_history', id);
  await deleteDoc(docRef);
}

export const DEFAULT_SIZE_CHART_DISCLAIMER = `★ 해외상품으로 국내사이즈와 상이하오니 사이즈표를 확인하세요 ★
상품의 재질 신축성에 따라 착용감이 다를 수 있으니 사이즈 선택 시 유의하세요
조명 및 촬영 각도 모니터 설정에 따라 실제 색상과 다소 차이가 있을 수 있습니다
측정 방법에 따라서 1~3cm 정도 오차가 있을 수 있습니다
FARACOM`;

// Fetch size chart disclaimer from Firestore (with fallback)
export async function fetchSizeChartDisclaimer(): Promise<string> {
  try {
    const docRef = doc(db, 'settings', 'size_chart_disclaimer');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().content) {
      return docSnap.data().content;
    }
  } catch (error) {
    console.warn('Error fetching size chart disclaimer from Firestore:', error);
  }
  return DEFAULT_SIZE_CHART_DISCLAIMER;
}

// Save size chart disclaimer to Firestore
export async function saveSizeChartDisclaimer(content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('사이즈표 하단 문구를 입력해주세요.');

  const docRef = doc(db, 'settings', 'size_chart_disclaimer');
  await setDoc(docRef, {
    content: trimmed,
    updatedAt: Timestamp.now()
  });
}

// Fetch watermark settings from Firestore
export async function fetchWatermarkSettings(): Promise<any> {
  try {
    const docRef = doc(db, 'settings', 'watermark_settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.warn('Error fetching watermark settings from Firestore:', error);
  }
  return null;
}

// Save watermark settings to Firestore
export async function saveWatermarkSettings(settings: any): Promise<void> {
  const docRef = doc(db, 'settings', 'watermark_settings');
  await setDoc(docRef, {
    ...settings,
    updatedAt: Timestamp.now()
  });
}


