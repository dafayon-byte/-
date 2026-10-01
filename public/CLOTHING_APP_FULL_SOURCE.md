# FARACOM 의류 상품 분석기 전체 소스코드 문서

> 이 문서는 가방 상품 분석기 앱 또는 다른 프로젝트로 의류 상품 분석기를 이식/병합하기 위한 전체 소스코드 및 아키텍처 명세서입니다.



---
## 📄 File: `package.json`

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit",
    "start": "node dist/server.cjs"
  },
  "dependencies": {
    "@google/genai": "^1.29.0",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "axios": "^1.13.6",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "firebase": "^12.17.1",
    "googleapis": "^171.4.0",
    "html-to-image": "^1.11.13",
    "html2canvas": "^1.4.1",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^10.1.0",
    "uuid": "^13.0.0",
    "vite": "^6.2.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.28.1",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

```


---
## 📄 File: `vite.config.ts`

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

```


---
## 📄 File: `src/types/watermark.ts`

```ts
export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;       // 0.01 ~ 0.5 (default: 0.07, 7%)
  fontSize: number;      // px (default: 18)
  gapX: number;          // px horizontal repeat spacing (default: 180)
  gapY: number;          // px vertical repeat spacing (default: 120)
  angle: number;         // deg, -45 ~ 45 (default: -25)
  direction: 'diagonal-down' | 'diagonal-up' | 'horizontal'; // diagonal-down is -25deg, diagonal-up is 25deg, horizontal is 0deg
  color: string;         // e.g. '#000000' or '#1e293b'
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: true,
  text: 'FARACOM',
  opacity: 0.07,
  fontSize: 20,
  gapX: 180,
  gapY: 130,
  angle: -25,
  direction: 'diagonal-down',
  color: '#000000',
};

/**
 * Generates a seamless, staggered (brick-pattern) SVG watermark as a Base64 data URI.
 * This completely avoids browser CSS quote/percent-sign parsing bugs and ensures
 * instant reactive updates across opacity, size, gap, and direction changes.
 */
export function getWatermarkSvgDataUrl(settings: WatermarkSettings): string {
  if (!settings.enabled || !settings.text?.trim()) return '';

  const angle =
    settings.direction === 'horizontal'
      ? 0
      : settings.direction === 'diagonal-up'
      ? (settings.angle > 0 ? settings.angle : 25)
      : (settings.angle < 0 ? settings.angle : -25);

  const gapX = Math.max(80, Number(settings.gapX) || 180);
  const gapY = Math.max(50, Number(settings.gapY) || 130);
  const fontSize = Math.max(10, Number(settings.fontSize) || 20);
  const opacity = Math.min(1, Math.max(0.01, Number(settings.opacity) ?? 0.07));
  const color = settings.color || '#000000';
  const text = (settings.text || 'FARACOM').trim();

  // Staggered brick pattern:
  // Tile dimensions: width = gapX, height = gapY * 2
  // Row 1 (y = gapY * 0.5): text centered at x = gapX * 0.5
  // Row 2 (y = gapY * 1.5): text centered at x = 0 AND at x = gapX (wraps seamlessly across tile borders)
  const tileWidth = gapX;
  const tileHeight = gapY * 2;

  const xmlEscapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}">
  <style>
    .wm {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif;
      font-weight: 800;
      font-size: ${fontSize}px;
      fill: ${color};
      fill-opacity: ${opacity};
      text-anchor: middle;
      dominant-baseline: central;
      user-select: none;
    }
  </style>
  <text class="wm" transform="translate(${tileWidth * 0.5}, ${gapY * 0.5}) rotate(${angle})">${xmlEscapedText}</text>
  <text class="wm" transform="translate(0, ${gapY * 1.5}) rotate(${angle})">${xmlEscapedText}</text>
  <text class="wm" transform="translate(${tileWidth}, ${gapY * 1.5}) rotate(${angle})">${xmlEscapedText}</text>
</svg>`;

  try {
    const base64 = typeof window !== 'undefined'
      ? window.btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error('Failed to base64 encode watermark SVG:', err);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

/**
 * Returns React inline style with the repeating watermark background.
 */
export function getWatermarkBackgroundStyle(settings: WatermarkSettings): React.CSSProperties {
  if (!settings.enabled || !settings.text?.trim()) {
    return {};
  }
  const dataUrl = getWatermarkSvgDataUrl(settings);
  if (!dataUrl) return {};
  return {
    backgroundImage: `url("${dataUrl}")`,
    backgroundRepeat: 'repeat',
  };
}


```


---
## 📄 File: `src/lib/reanalyzePrompt.ts`

```ts
import { ProductResponse } from '../App';

export function buildSectionPrompt(
  sectionNum: number,
  userNote: string,
  context: { text: string; imageCount: number; currentResult: ProductResponse }
): string {
  const noteInstruction = userNote && userNote.trim()
    ? `\n[사용자 특별 개선 요청사항]\n"${userNote.trim()}"\n※ 위 사용자 요청사항을 최우선 순위로 반드시 충실히 반영하여 생성하세요.\n`
    : '';

  let sectionDirective = '';

  switch (sectionNum) {
    case 1:
      sectionDirective = `
당신은 의류 상품 고시 정보 분석 전문가입니다.
제공된 이미지와 텍스트를 바탕으로 [1. 상품 고시 정보 (mainInfo)] 항목만 새롭게 다시 작성해 주세요.
제품 소재(혼용률), 색상, 치수(사이즈), 제조자/수입자, 세탁방법 및 취급시 주의사항, 제조연월, 품질보증기준을 정확하게 파악하여 국내 법적 고시 기준에 맞게 작성하세요.
${noteInstruction}
[출력 형식]
반드시 다른 설명이나 마크다운 인사말 없이 아래 JSON 형식으로만 응답해야 합니다:
{
  "mainInfo": {
    "material": "면 100%",
    "colors": "아이보리, 블랙",
    "sizes": "S, M, L",
    "manufacturerImporter": "파라컴(구매대행)",
    "laundryInfo": "드라이클리닝 권장 (케어라벨 확인 필수)",
    "dateOfManufacture": "상품 발송일 기준 6개월 이내 제조",
    "qualityGuarantee": "관련 법 및 소비자 분쟁 해결 기준에 따름"
  }
}
`;
      break;

    case 2:
      sectionDirective = `
당신은 네이버 스마트스토어/쿠팡/쇼핑몰 의류 상품명 검색 최적화(SEO) 전문가입니다.
제공된 이미지와 텍스트를 바탕으로 [2. 상품명 (productName, productName2)] 항목만 새롭게 다시 생성해 주세요.
검색 노출 최적화(SEO)와 높은 클릭률을 이끌어낼 수 있도록 주요 수식어, 카테고리, 핏, 소재, 스타일, 계절 키워드를 자연스럽게 조합하여 기본 상품명(productName)과 예비 상품명(productName2) 2가지를 작성하세요.
${noteInstruction}
[출력 형식]
반드시 다른 설명이나 인사말 없이 아래 JSON 형식으로만 응답해야 합니다:
{
  "productName": "여성 빅사이즈 브이넥 핀턱 퍼프소매 민소매 롱 원피스 하객룩 오피스룩 봄 가을",
  "productName2": "여성 빅사이즈 브이넥 핀턱 원피스 반팔 퍼프 롱원피스 오피스룩"
}
`;
      break;

    case 3:
      sectionDirective = `
당신은 쇼핑몰 검색 태그 및 알고리즘 노출 최적화 전문가입니다.
제공된 이미지와 텍스트를 분석하여 [3. 검색태그 (searchTags)] 항목만 다양하고 트렌디하게 새로 추출해 주세요.
관련 카테고리, 스타일(페미닌, 모던, 캐주얼 등), 핏감(루즈핏, 슬림핏 등), 원단 소재, 컬러, 시즌, TPO(하객룩, 데이트룩, 출근룩 등)를 아우르는 쉼표(,) 구분 검색 태그 12~18개를 작성하세요.
${noteInstruction}
[출력 형식]
반드시 다른 설명이나 인사말 없이 아래 JSON 형식으로만 응답해야 합니다:
{
  "searchTags": "여자원피스, 블라우스세트, 스커트세트, 투피스, 하객룩, 데이트룩, 오피스룩, 퍼프블라우스, 플리츠스커트, 미니스커트, 봄신상, 크림색, 소라색, 러블리"
}
`;
      break;

    case 4:
      sectionDirective = `
당신은 쇼핑몰 상품 옵션 등록 전문가입니다.
제공된 이미지와 텍스트를 분석하여 [4. 옵션명 (options)] 항목만 깔끔하게 규격화하여 다시 작성해 주세요.
색상/컬러(group1과 values) 및 사이즈(group2와 sizeValues)를 정확히 분리하여 쇼핑몰 옵션 입력란에 바로 복사/적용할 수 있도록 정돈하세요.
${noteInstruction}
[출력 형식]
반드시 다른 설명이나 인사말 없이 아래 JSON 형식으로만 응답해야 합니다:
{
  "options": {
    "group1": "컬러",
    "group2": "사이즈",
    "values": ["화이트", "블랙", "베이지"],
    "sizeValues": ["S(55)", "M(66)", "L(77)"]
  }
}
`;
      break;

    case 5:
      sectionDirective = `
당신은 의류 상세페이지 전문 카피라이터이자 소구점 작성 전문가입니다.
제공된 이미지와 텍스트를 바탕으로 [5. 상품설명 / 소구점 카드 (sellingPoints)] 항목만 매력적이고 설득력 있게 새로 작성해 주세요.
반드시 [코디 & 스타일], [디테일 & 핏], [소재 & 착용감], [모델정보], [상품스펙] 등 주제별 카드 형태로 작성하고, 핵심 강조 문구에는 [red], [blue], [orange] 색상 태그를 적극 사용하세요.
★글자수 제한 필수 준수: 모바일 화면에서 줄바꿈이 일어나지 않도록 각 설명 문장은 반드시 공백 포함 '최대 16자 이하'(12자~16자, 태그 제외 순수 텍스트 기준)로 간결하게 작성하고 절대 16자를 넘기지 마세요.
- [코디 & 스타일]: 함께 매치하기 좋은 패션 아이템(아우터, 이너, 신발, 가방, 액세서리 등)과 추천 스타일/TPO(오피스룩, 데이트룩, 하객룩, 파티룩, 클럽룩, 데일리룩 등 연출 무드)를 자연스럽게 결합하여 3~4줄로 작성하세요.
- [디테일 & 핏]: 넥라인, 단추, 셔링, 포켓, 봉제 및 마감 디테일, 체형 커버 및 실루엣(A라인, 오버핏 등)에 집중하여 3~4줄로 작성하세요.
- [소재 & 착용감]: 원단 고유의 텍스처(결감, 린넨/코튼 등 소재감), 통기성, 신축성, 부드러운 촉감 및 편안한 착용감에 집중하여 3~4줄로 작성하세요.
- 모델정보가 원본에 없다면 생략 가능합니다.
${noteInstruction}
[출력 형식]
반드시 다른 설명이나 인사말 없이 아래 JSON 형식으로만 응답해야 합니다:
{
  "sellingPoints": "[코디 & 스타일]\\n자켓과 매치한 [red]세련된 오피스룩[/red]\\n데님과 연출한 [blue]감각적 데일리룩[/blue]\\n단품에 더하는 [orange]우아한 하객룩[/orange]\\n\\n[디테일 & 핏]\\n정갈한 넥라인 [red]바이어스 마감[/red]\\n은은한 포인트 [blue]백버튼 셔링[/blue]\\n체형을 커버하는 [orange]슬림 A라인[/orange]\\n\\n[소재 & 착용감]\\n내추럴한 결감 [red]고급 천연 린넨[/red]\\n무더운 여름철 [blue]탁월한 통기성[/blue]\\n피부에 닿는 [orange]부드러운 촉감[/orange]\\n\\n[상품스펙]\\n■ 종류 : 원피스\\n■ 색상 : 크림, 소라, 블랙\\n■ 주소재 : 면 100%\\n■ 사이즈 : S, M, L, XL"
}
`;
      break;

    case 6:
      sectionDirective = `
당신은 의류 실측 사이즈표 전문 분석가입니다.
제공된 텍스트와 이미지(특히 사이즈표 이미지)를 정밀 분석하여 [6. 사이즈표 (sizeCharts)] 항목만 오차 없이 마크다운 표로 다시 생성해 주세요.
사이즈(S, M, L 등) 및 각 부위별 실측 치수(총장, 어깨너비, 가슴단면, 허리단면, 힙단면, 소매길이 등)를 정확하게 추출하여 완벽한 마크다운 표로 반환하세요. 단품 또는 세트 상품 여부에 맞게 1개 이상의 표 객체를 배열로 구성하세요.
${noteInstruction}
[출력 형식]
반드시 다른 설명이나 인사말 없이 아래 JSON 형식으로만 응답해야 합니다:
{
  "sizeCharts": [
    {
      "notification": null,
      "title": "상세 사이즈",
      "sizeChart": "| 사이즈 | 총장 | 어깨너비 | 가슴단면 | 소매길이 |\\n|:---|:---:|:---:|:---:|:---:|\\n| S | 55 | 35 | 45 | 60 |\\n| M | 56 | 36 | 47 | 61 |"
    }
  ]
}
`;
      break;

    default:
      sectionDirective = `[${sectionNum}번 항목]을 새롭게 분석하여 JSON 형식으로 반환하세요.`;
  }

  return `
${sectionDirective}

[참고: 원본 상품 데이터]
- 상품 텍스트: "${context.text}"
- 첨부 이미지 수: ${context.imageCount}장
`;
}

```


---
## 📄 File: `src/lib/firebase.ts`

```ts
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



```


---
## 📄 File: `src/components/AnalysisHistoryModal.tsx`

```tsx
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

```


---
## 📄 File: `src/components/ExtensionGuideModal.tsx`

```tsx
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

```


---
## 📄 File: `src/components/PromptManagerModal.tsx`

```tsx
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

```


---
## 📄 File: `src/components/SectionHeaderWithReanalyze.tsx`

```tsx
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

```


---
## 📄 File: `src/components/SellingPointsCardViewer.tsx`

```tsx
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

```


---
## 📄 File: `src/components/SizeChartDisclaimerModal.tsx`

```tsx
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

```


---
## 📄 File: `src/components/WatermarkSettingsModal.tsx`

```tsx
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

```


---
## 📄 File: `src/App.tsx`

```tsx
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

```


---
## 📄 File: `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "FARACOM TOOL (의류)",
  "short_name": "FARACOM TOOL (의류)",
  "version": "1.3.6",
  "description": "원하는 모든 쇼핑몰(조조타운, 라쿠텐, 야후 등)의 텍스트와 사진을 1:1 비주얼 매핑하여 팀 공용 DB 공유 및 FARACOM AI 스튜디오로 초고속 전송합니다.",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "FARACOM TOOL (의류)"
  },
  "background": {
    "service_worker": "background.js"
  },
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": ["content.js"],
      "run_at": "document_idle",
      "all_frames": true,
      "match_about_blank": true
    },
    {
      "matches": [
        "<all_urls>"
      ],
      "js": ["app-content.js"],
      "run_at": "document_idle",
      "all_frames": true,
      "match_about_blank": true
    }
  ]
}

```


---
## 📄 File: `extension/background.js`

```js
// FARACOM TOOL - Background Service Worker
// Automatically resets collected data when:
// 1. Page is refreshed (F5 / reload)
// 2. Tab navigates to another URL (different address)
// 3. New page or tab is loaded

// Listen for tab navigation and refresh events
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url) {
    chrome.storage.local.remove(["faracom_last_scraped"], () => {
      try {
        chrome.tabs.sendMessage(tabId, { action: "CLEAR_PAGE_SCRAPED_DATA" }, () => {
          if (chrome.runtime.lastError) {}
        });
      } catch (e) {}
    });
  }
});

// Listen for tab closure to keep storage clean
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(["faracom_last_scraped"]);
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "PAGE_NAVIGATED_RESET" || req.action === "PAGE_LOADED_RESET" || req.action === "CLEAR_ALL_SCRAPED_DATA") {
    chrome.storage.local.remove(["faracom_last_scraped"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Convert single image URL into Base64 Data URL using Chrome Cache & Host Permissions
  if (req.action === "FETCH_IMAGE_BASE64") {
    fetchImageAsBase64(req.url).then((dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }

  // Convert multiple image URLs in parallel into Base64 Data URLs
  if (req.action === "FETCH_IMAGES_BASE64") {
    const urls = Array.isArray(req.urls) ? req.urls : [];
    Promise.all(urls.map(u => fetchImageAsBase64(u))).then((results) => {
      sendResponse({ dataUrls: results.filter(Boolean) });
    });
    return true;
  }
});

// Convert Image URL to Base64 Data URL using Chrome Cache and Extension host permissions
async function fetchImageAsBase64(url) {
  if (!url) return null;
  if (url.startsWith("data:image")) return url;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
    }
    const base64 = btoa(binary);
    const mime = blob.type || "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.warn("[Background] fetchImageAsBase64 error:", url, err);
    return null;
  }
}

```


---
## 📄 File: `extension/content.js`

```js
// FARACOM TOOL (의류) - Universal Point-and-Click Mapping Engine
// 100% Pure 1:1 Mapping for ANY e-commerce website (ZOZOTOWN, Rakuten, Yahoo, Brand Sites)
// NO auto-fallbacks, NO guessing, NO hardcoded site assumptions.

(function() {
  if (window !== window.top) return;
  if (window.__faracom_injected) return;
  window.__faracom_injected = true;

  let isInspecting = false;
  let inspectMode = null; // 'click' | 'map'
  let highlightOverlay = null;
  let bannerBar = null;

  let pageScrapedData = null;
  let lastRecordedUrl = window.location.href;

  function handleUrlChangeReset() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastRecordedUrl) {
      lastRecordedUrl = currentUrl;
      pageScrapedData = null;
      try {
        chrome.runtime.sendMessage({ action: "PAGE_NAVIGATED_RESET", url: currentUrl });
      } catch (e) {}
    }
  }

  window.addEventListener("popstate", handleUrlChangeReset);
  window.addEventListener("hashchange", handleUrlChangeReset);

  try {
    const origPush = history.pushState;
    if (typeof origPush === "function") {
      history.pushState = function(...args) {
        const res = origPush.apply(this, args);
        handleUrlChangeReset();
        return res;
      };
    }
    const origReplace = history.replaceState;
    if (typeof origReplace === "function") {
      history.replaceState = function(...args) {
        const res = origReplace.apply(this, args);
        handleUrlChangeReset();
        return res;
      };
    }
  } catch (e) {}

  setInterval(handleUrlChangeReset, 1000);

  function cleanText(str) {
    if (!str) return "";
    return str.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function getXPath(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
    if (el.id && !/\d{4,}/.test(el.id)) return `//*[@id="${el.id}"]`;
    const parts = [];
    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.documentElement) {
      let index = 1;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.nodeName === el.nodeName) index++;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(`${el.nodeName.toLowerCase()}[${index}]`);
      el = el.parentNode;
    }
    return "/" + parts.join("/");
  }

  function getCssSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return "body";
    if (el.id && !/\d{4,}/.test(el.id)) return `#${CSS.escape(el.id)}`;

    const dataAttrs = ["data-testid", "data-qa", "data-tab", "data-name", "aria-controls", "role"];
    for (const attr of dataAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }

    const text = (el.innerText || el.textContent || "").trim();
    if ((el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "LI" || el.tagName === "SPAN") && text.length > 0 && text.length <= 20) {
      return `${el.tagName.toLowerCase()}:contains("${text}")`;
    }

    const classes = Array.from(el.classList).filter(c => !/^[a-zA-Z0-9_-]{16,}$/.test(c) && !/active|selected|hover|focus/i.test(c));
    if (classes.length > 0) {
      const classSel = "." + classes.slice(0, 2).map(c => CSS.escape(c)).join(".");
      try {
        if (document.querySelectorAll(classSel).length === 1) return classSel;
      } catch (e) {}
    }

    let path = [];
    let curr = el;
    while (curr && curr !== document.body && path.length < 5) {
      let tag = curr.tagName.toLowerCase();
      if (curr.id && !/\d{4,}/.test(curr.id)) {
        path.unshift(`#${CSS.escape(curr.id)}`);
        break;
      }
      let parent = curr.parentElement;
      if (parent) {
        let siblings = Array.from(parent.children).filter(c => c.tagName === curr.tagName);
        if (siblings.length > 1) {
          let idx = siblings.indexOf(curr) + 1;
          tag += `:nth-of-type(${idx})`;
        }
      }
      path.unshift(tag);
      curr = curr.parentElement;
    }
    return path.join(" > ") || el.tagName.toLowerCase();
  }

  function querySelectorDeep(selector, root = document) {
    if (!selector) return null;
    try {
      const found = root.querySelector(selector);
      if (found) return found;
    } catch (e) {}

    const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const host of all) {
      if (host.shadowRoot) {
        const inside = querySelectorDeep(selector, host.shadowRoot);
        if (inside) return inside;
      }
    }
    return null;
  }

  function findElement(step) {
    if (!step) return null;

    if (step.selector) {
      try {
        if (step.selector.includes(':contains("')) {
          const match = step.selector.match(/^(.*?):contains\("([^"]+)"\)/);
          if (match) {
            const tag = match[1] || "*";
            const text = match[2].trim();
            const els = document.querySelectorAll(tag);
            for (const el of els) {
              if ((el.innerText || "").trim() === text) return el;
            }
            for (const el of els) {
              if ((el.innerText || "").includes(text)) return el;
            }
          }
        } else {
          const found = querySelectorDeep(step.selector);
          if (found) return found;
        }
      } catch (e) {}
    }

    if (step.xpath) {
      try {
        const result = document.evaluate(step.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result && result.singleNodeValue) return result.singleNodeValue;
      } catch (e) {}
    }

    if (step.anchorText && step.anchorText.length >= 2) {
      const all = document.querySelectorAll("button, a, li, span, h1, h2, h3, p, table, section, div, v-detail-d");
      for (const el of all) {
        if ((el.innerText || "").trim() === step.anchorText) return el;
      }
    }
    return null;
  }

  // 최상단 플로팅 오버레이 토스트
  function showInPageToast(message, isSuccess = true) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: ${isSuccess ? "linear-gradient(135deg, #059669, #10b981)" : "#dc2626"};
      color: white;
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 28px rgba(0,0,0,0.4), 0 0 15px rgba(16,185,129,0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      transition: all 0.25s ease;
      white-space: nowrap;
    `;
    toast.innerHTML = `<span>${isSuccess ? "✅" : "⚠️"}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-10px)";
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  function startInspector(mode) {
    stopInspector();
    isInspecting = true;
    inspectMode = mode;

    highlightOverlay = document.createElement("div");
    highlightOverlay.id = "faracom-inspect-box";
    highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483640;
      border: 3px solid ${mode === 'click' ? '#f59e0b' : '#38bdf8'};
      background-color: ${mode === 'click' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)'};
      border-radius: 6px;
      display: none;
      transition: all 0.05s ease;
      box-shadow: 0 0 15px ${mode === 'click' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(56, 189, 248, 0.6)'};
    `;
    document.body.appendChild(highlightOverlay);

    bannerBar = document.createElement("div");
    bannerBar.id = "faracom-guide-banner";
    bannerBar.style.cssText = `
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      background: #0f172a;
      border: 2px solid ${mode === 'click' ? '#f59e0b' : '#38bdf8'};
      color: white;
      padding: 10px 20px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    const icon = mode === 'click' ? '👆' : '🎯';
    const text = mode === 'click'
      ? '클릭 액션 지정: 탭 버튼 또는 더보기 버튼을 클릭하세요'
      : '수집 영역 매핑: 추출하고 싶은 영역(글/표/사진)을 클릭하세요';

    bannerBar.innerHTML = `
      <span>${icon} <b>FARACOM TOOL (의류)</b> - ${text}</span>
      <button id="faracom-cancel-btn" style="
        background: rgba(255,255,255,0.15);
        color: white;
        border: none;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
      ">취소 (ESC)</button>
    `;
    document.body.appendChild(bannerBar);

    document.getElementById("faracom-cancel-btn").onclick = (e) => {
      e.stopPropagation();
      stopInspector();
      showInPageToast("매핑 모드가 취소되었습니다.", false);
    };

    document.addEventListener("mousemove", onInspectorMouseMove, true);
    document.addEventListener("click", onInspectorClick, true);
    document.addEventListener("keydown", onInspectorKeyDown, true);
  }

  function stopInspector() {
    isInspecting = false;
    inspectMode = null;
    if (highlightOverlay) { highlightOverlay.remove(); highlightOverlay = null; }
    if (bannerBar) { bannerBar.remove(); bannerBar = null; }

    document.removeEventListener("mousemove", onInspectorMouseMove, true);
    document.removeEventListener("click", onInspectorClick, true);
    document.removeEventListener("keydown", onInspectorKeyDown, true);
  }

  function onInspectorMouseMove(e) {
    if (!isInspecting) return;
    const target = e.target;
    if (target.id === "faracom-inspect-box" || target.closest("#faracom-guide-banner")) return;

    const rect = target.getBoundingClientRect();
    if (highlightOverlay) {
      highlightOverlay.style.display = "block";
      highlightOverlay.style.top = `${rect.top - 2}px`;
      highlightOverlay.style.left = `${rect.left - 2}px`;
      highlightOverlay.style.width = `${rect.width + 4}px`;
      highlightOverlay.style.height = `${rect.height + 4}px`;
    }
  }

  function onInspectorKeyDown(e) {
    if (e.key === "Escape") {
      stopInspector();
      showInPageToast("매핑 모드가 취소되었습니다.", false);
    }
  }

  function onInspectorClick(e) {
    if (!isInspecting) return;
    const target = e.target;
    if (target.closest("#faracom-guide-banner")) return;

    e.preventDefault();
    e.stopPropagation();

    const clickedEl = target;
    const selector = getCssSelector(clickedEl);
    const xpath = getXPath(clickedEl);
    const rawText = cleanText(clickedEl.innerText || clickedEl.textContent || "");
    const anchorText = rawText.slice(0, 30);

    if (inspectMode === "click") {
      const labelText = anchorText || clickedEl.tagName.toLowerCase();
      const newStep = {
        id: "step_" + Date.now(),
        type: "click",
        label: `클릭: [${labelText}]`,
        selector: selector,
        xpath: xpath,
        anchorText: anchorText
      };
      saveStepToSequence(newStep);
      showInPageToast(`👆 [클릭 스텝 등록]: "${labelText}"`);
      stopInspector();

    } else if (inspectMode === "map") {
      const previewImgs = extractImagesFromElement(clickedEl);
      const imgCount = previewImgs.length;
      let displayLabel = "";

      if (imgCount > 1) {
        displayLabel = `매핑: 이미지 영역 (${imgCount}장)`;
      } else if (imgCount === 1 && rawText.length < 15) {
        displayLabel = `매핑: 대표 이미지`;
      } else if (clickedEl.tagName === "TABLE" || (clickedEl.querySelector && clickedEl.querySelector("table"))) {
        displayLabel = `매핑: 실측 표/테이블`;
      } else if (rawText.length > 0) {
        displayLabel = `매핑: ${anchorText.slice(0, 18)}...`;
      } else {
        displayLabel = `매핑: [${clickedEl.tagName.toLowerCase()}] 영역`;
      }

      const newStep = {
        id: "step_" + Date.now(),
        type: "map",
        label: displayLabel,
        selector: selector,
        xpath: xpath,
        anchorText: anchorText
      };

      saveStepToSequence(newStep);
      showInPageToast(`🎯 [매핑 스텝 등록]: "${displayLabel}"`);
      stopInspector();
    }
  }

  function saveStepToSequence(newStep) {
    if (chrome && chrome.storage && chrome.storage.local) {
      const hostname = window.location.hostname || "default";
      chrome.storage.local.get(["faracom_recipes_by_domain", "faracom_recipe_steps"], (res) => {
        const recipes = res.faracom_recipes_by_domain || {};
        const steps = recipes[hostname] || res.faracom_recipe_steps || [];
        steps.push(newStep);
        recipes[hostname] = steps;
        chrome.storage.local.set({
          faracom_recipes_by_domain: recipes,
          faracom_recipe_steps: steps
        });
      });
    }
  }

  // 1:1 이미지 추출기 (Shadow DOM 관통 및 고화질 리사이즈 치환)
  function extractImagesFromElement(root) {
    if (!root) return [];
    const urls = [];

    function processImgSrc(src) {
      if (!src) return;
      try {
        if (src.startsWith("//")) src = window.location.protocol + src;
        else if (src.startsWith("/")) src = new URL(src, window.location.origin).href;
        else if (!src.startsWith("http")) src = new URL(src, window.location.href).href;
      } catch (e) {
        return;
      }

      if (src.startsWith("data:image/svg") || 
          src.includes("blank.gif") || 
          src.includes("spacer") || 
          src.includes("1x1") || 
          src.includes("R0lGODlhAQABA") || 
          src.includes("transparent.gif")) {
        return;
      }

      if (src.includes("imgz.jp")) {
        src = src.replace(/_(?:50|80|100|150|200|300|1000)\.jpg(\?.*)?$/i, "_500.jpg");
      }
      if (src.includes("rakuten.co.jp") && src.includes("?_ex=")) {
        src = src.replace(/\?_ex=\d+x\d+/i, "?_ex=700x700");
      }
      if (src.includes("alicdn.com") || src.includes("cbu01")) {
        src = src.replace(/_\d+x\d+q?\d*\.jpg$/i, "");
      }

      if (!urls.includes(src)) {
        urls.push(src);
      }
    }

    function scanNode(node) {
      if (!node) return;

      if (node.tagName === "IMG") {
        const src = node.getAttribute("data-lazyload-src") ||
                    node.getAttribute("data-ks-lazyload") ||
                    node.getAttribute("data-lazy-src") ||
                    node.getAttribute("lazy-src") ||
                    node.getAttribute("data-original") ||
                    node.getAttribute("data-origin-src") ||
                    node.getAttribute("data-real-src") ||
                    node.getAttribute("data-zoom-image") ||
                    node.getAttribute("data-high-res-src") ||
                    node.getAttribute("data-src") ||
                    node.getAttribute("data-lazy") ||
                    node.getAttribute("data-lazyload") ||
                    node.getAttribute("src") ||
                    node.currentSrc || "";
        processImgSrc(src);
      } else if (node.tagName === "SOURCE") {
        let src = node.getAttribute("srcset") || "";
        if (src.includes(",")) src = src.split(",")[0].trim().split(" ")[0];
        processImgSrc(src);
      }

      if (node.querySelectorAll) {
        const imgElements = node.querySelectorAll("img, [data-src], [data-lazy], [data-original], [data-zoom-image], [data-high-res-src], [data-lazyload-src], [data-ks-lazyload], [data-lazy-src], [lazy-src], [data-origin-src], [data-real-src], picture source");
        for (const item of imgElements) {
          if (item.tagName === "SOURCE") {
            let src = item.getAttribute("srcset") || "";
            if (src.includes(",")) src = src.split(",")[0].trim().split(" ")[0];
            processImgSrc(src);
          } else {
            const src = item.getAttribute("data-lazyload-src") ||
                        item.getAttribute("data-ks-lazyload") ||
                        item.getAttribute("data-lazy-src") ||
                        item.getAttribute("lazy-src") ||
                        item.getAttribute("data-original") ||
                        item.getAttribute("data-origin-src") ||
                        item.getAttribute("data-real-src") ||
                        item.getAttribute("data-zoom-image") ||
                        item.getAttribute("data-high-res-src") ||
                        item.getAttribute("data-src") ||
                        item.getAttribute("data-lazy") ||
                        item.getAttribute("data-lazyload") ||
                        item.getAttribute("src") ||
                        item.currentSrc || "";
            processImgSrc(src);
          }
        }

        const bgElements = node.querySelectorAll("[style*='background']");
        for (const bgEl of bgElements) {
          const style = bgEl.getAttribute("style") || "";
          const bgMatch = style.match(/background(?:-image)?:\s*url\(['"]?(.*?)['"]?\)/i);
          if (bgMatch && bgMatch[1]) {
            processImgSrc(bgMatch[1].trim());
          }
        }
      }

      if (node.getAttribute && node.getAttribute("style")?.includes("background")) {
        const style = node.getAttribute("style") || "";
        const bgMatch = style.match(/background(?:-image)?:\s*url\(['"]?(.*?)['"]?\)/i);
        if (bgMatch && bgMatch[1]) {
          processImgSrc(bgMatch[1].trim());
        }
      }

      if (node.shadowRoot) scanNode(node.shadowRoot);
      if (node.querySelectorAll) {
        const allDescendants = node.querySelectorAll("*");
        for (const desc of allDescendants) {
          if (desc.shadowRoot) scanNode(desc.shadowRoot);
        }
      }
    }

    scanNode(root);

    if (urls.length === 0 && root.nodeType === 1) {
      try {
        const bg = window.getComputedStyle(root).backgroundImage;
        if (bg && bg.startsWith("url(")) {
          const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1] && match[1].startsWith("http")) {
            processImgSrc(match[1]);
          }
        }
      } catch (e) {}
    }

    return urls;
  }

  function extractTextFromElement(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    const useless = clone.querySelectorAll("script, style, noscript, svg, iframe");
    useless.forEach(u => u.remove());

    if (clone.tagName === "TABLE" || clone.querySelector("table")) {
      const rows = clone.querySelectorAll("tr");
      if (rows.length > 0) {
        const lines = [];
        rows.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll("th, td")).map(c => c.innerText.trim()).filter(Boolean);
          if (cells.length > 0) lines.push(cells.join(" : "));
        });
        if (lines.length > 0) return lines.join("\n");
      }
    }

    return cleanText(clone.innerText || clone.textContent || "");
  }

  // 자동 스크롤: 맨 밑으로 이동하여 Lazy-load 이미지 로드 완료 후 그 위치에 머무름
  async function executeAutoScroll(stepIndex, totalSteps) {
    showInPageToast(`📜 [${stepIndex + 1}/${totalSteps}단계] 페이지 자동 스크롤 (맨 밑으로 이동 중)...`, true);

    const getFullScrollHeight = () => Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.offsetHeight || 0
    );

    let currentY = window.scrollY || 0;
    let targetHeight = getFullScrollHeight();
    const stepDistance = 750;

    while (currentY < targetHeight) {
      currentY = Math.min(currentY + stepDistance, targetHeight);
      window.scrollTo({ top: currentY, behavior: "instant" });
      await new Promise(r => setTimeout(r, 60));
      targetHeight = getFullScrollHeight();
      if (currentY >= targetHeight) break;
    }

    window.scrollTo({ top: targetHeight, behavior: "instant" });
    await new Promise(r => setTimeout(r, 350));

    showInPageToast(`✅ [${stepIndex + 1}/${totalSteps}단계] 페이지 맨 밑 도달 완료! 매핑을 시작합니다.`, false);
    return true;
  }

  async function executeClick(step) {
    const el = findElement(step);
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mouseenter", opts));
      el.dispatchEvent(new MouseEvent("mouseover", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.click();
      await new Promise(r => setTimeout(r, 450));
      return true;
    } catch (err) {
      return false;
    }
  }

  async function runSequence(steps) {
    showInPageToast("🚀 시퀀스를 실행하여 매핑 영역을 수집합니다...", true);

    const collectedImages = [];
    const collectedSections = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (step.type === "scroll") {
        await executeAutoScroll(i, steps.length);
      } else if (step.type === "click") {
        await executeClick(step);
      } else if (step.type === "map") {
        const el = findElement(step);
        if (!el) {
          collectedSections.push({
            label: step.label,
            text: "(요소를 찾지 못함 - 페이지 구조 확인 필요)"
          });
          continue;
        }

        const imgs = extractImagesFromElement(el);
        imgs.forEach(url => {
          if (!collectedImages.includes(url)) collectedImages.push(url);
        });

        const text = extractTextFromElement(el);
        if (text || imgs.length > 0) {
          collectedSections.push({
            label: step.label,
            text: text,
            imgCount: imgs.length
          });
        }
      }
    }

    const textLines = [];
    textLines.push(`■ [소싱 원본 페이지] : ${window.location.href}`);
    textLines.push(`■ [수집된 고화질 이미지] : 총 ${collectedImages.length}장`);

    collectedSections.forEach((sec, idx) => {
      const mappingNum = `[매핑 ${idx + 1}]`;
      const trimmedText = (sec.text || "").trim();
      if (trimmedText) {
        textLines.push(`\n${mappingNum}\n${trimmedText}`);
      } else if (sec.imgCount > 0) {
        textLines.push(`\n${mappingNum}\n(이미지 ${sec.imgCount}장)`);
      }
    });

    const summaryText = textLines.join("\n");

    let pageTitle = document.title;
    for (const sec of collectedSections) {
      if (sec.text && sec.text.length > 2 && sec.text.length < 120) {
        pageTitle = sec.text.split("\n")[0].trim();
        break;
      }
    }

    let imagesData = [];
    const targetImgUrls = collectedImages;

    if (targetImgUrls.length > 0) {
      try {
        const bgRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "FETCH_IMAGES_BASE64", urls: targetImgUrls }, (res) => {
            if (chrome.runtime.lastError || !res || !res.dataUrls) resolve([]);
            else resolve(res.dataUrls);
          });
        });
        if (Array.isArray(bgRes) && bgRes.length > 0) {
          imagesData = bgRes;
        }
      } catch (bgErr) {}

      if (imagesData.length === 0) {
        for (const url of targetImgUrls) {
          try {
            const dUrl = await convertUrlToDataUrl(url);
            if (dUrl) imagesData.push(dUrl);
          } catch (e) {}
        }
      }
    }

    const resultPayload = {
      title: pageTitle,
      brand: window.location.hostname.replace("www.", ""),
      images: collectedImages,
      imagesData: imagesData,
      mainImage: collectedImages[0] || "",
      summaryText: summaryText,
      sections: collectedSections,
      url: window.location.href
    };

    showInPageToast(`🎉 수집 완료! 사진 ${collectedImages.length}장, 매핑 영역 ${collectedSections.length}개 추출`, true);
    pageScrapedData = resultPayload;
    return resultPayload;
  }

  function getAllImgsDeep(root = document) {
    const results = [];
    if (root.querySelectorAll) {
      results.push(...Array.from(root.querySelectorAll("img")));
      const hosts = root.querySelectorAll("*");
      for (const h of hosts) {
        if (h.shadowRoot) {
          results.push(...getAllImgsDeep(h.shadowRoot));
        }
      }
    }
    return results;
  }

  async function convertUrlToDataUrl(url) {
    if (!url) return null;
    if (url.startsWith("data:image")) return url;

    const imgEls = getAllImgsDeep(document);
    const matched = imgEls.find(im => im.src === url || im.currentSrc === url || (im.src && im.src.includes(url)));
    if (matched && matched.naturalWidth > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = matched.naturalWidth;
        canvas.height = matched.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(matched, 0, 0);
        const dUrl = canvas.toDataURL("image/jpeg", 0.92);
        if (dUrl && dUrl.length > 150) return dUrl;
      } catch (canvasErr) {}
    }

    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (res.ok) {
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch (fetchErr) {}

    try {
      const bgDataUrl = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "FETCH_IMAGE_BASE64", url }, (res) => {
          if (chrome.runtime.lastError || !res || !res.dataUrl) resolve(null);
          else resolve(res.dataUrl);
        });
      });
      if (bgDataUrl) return bgDataUrl;
    } catch (bgErr) {}

    return null;
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "PING") {
      sendResponse({ pong: true, url: window.location.href });
      return true;
    } else if (req.action === "GET_PAGE_SCRAPED_DATA") {
      sendResponse({ data: pageScrapedData, url: window.location.href });
      return true;
    } else if (req.action === "SET_PAGE_SCRAPED_DATA") {
      pageScrapedData = req.data;
      sendResponse({ success: true });
      return true;
    } else if (req.action === "CLEAR_PAGE_SCRAPED_DATA") {
      pageScrapedData = null;
      sendResponse({ success: true });
      return true;
    } else if (req.action === "START_INSPECTOR") {
      startInspector(req.mode);
      sendResponse({ status: "started", mode: req.mode });
    } else if (req.action === "STOP_INSPECTOR") {
      stopInspector();
      sendResponse({ status: "stopped" });
    } else if (req.action === "RUN_SEQUENCE") {
      runSequence(req.steps).then(res => {
        sendResponse({ success: true, data: res });
      });
      return true;
    }
    return true;
  });
})();

```


---
## 📄 File: `extension/popup.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FARACOM TOOL (의류) - 만능 비주얼 매핑 수집</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <!-- Top Header -->
    <header class="header">
      <div class="brand">
        <div class="logo-box">
          <span class="logo-text">FT</span>
        </div>
        <div class="brand-info">
          <div style="display: flex; align-items: center; gap: 5px;">
            <h1 class="brand-title">FARACOM TOOL (의류)</h1>
            <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.4);">v1.3.6</span>
          </div>
          <span id="currentDomainBadge" class="domain-badge" title="현재 활성 웹사이트">🌐 연결 중...</span>
        </div>
      </div>
      <div id="statusBadge" class="status-badge status-checking">
        <span class="status-dot"></span>
        <span id="statusText" class="status-label">확인 중</span>
      </div>
    </header>

    <!-- 1. [맨 위] 수집 결과 출력 영역 -->
    <section class="result-top-section" id="resultTopSection">
      <!-- State A: 대기 중 -->
      <div id="idleState" class="result-card idle-card">
        <div class="result-card-header">
          <span class="result-title">📋 수집 결과</span>
          <span class="result-status-pill">대기 중</span>
        </div>
        <p class="idle-message">아래 <b>[수집 실행]</b>을 누르면 시퀀스 순서대로 페이지 요소를 1:1 수집합니다.</p>
      </div>

      <!-- State B: 수집 진행 중 -->
      <div id="loadingState" class="result-card loading-card hidden">
        <div class="spinner-small"></div>
        <div class="loading-msg-wrap">
          <span class="loading-title">시퀀스 순서대로 페이지 수집 중...</span>
          <span class="loading-sub" id="loadingProgress">클릭 동작 및 매핑 영역 추출</span>
        </div>
      </div>

      <!-- State C: 수집 완료 카드 -->
      <div id="resultState" class="result-card active-card hidden">
        <div class="result-card-header">
          <span class="result-title">✨ 수집 완료</span>
          <div class="result-header-actions">
            <span id="imgCountBadge" class="result-count-pill">0장 수집됨</span>
            <button id="clearScrapedBtn" class="clear-pill-btn" type="button" title="수집 결과 제거 및 초기화">✕ 초기화</button>
          </div>
        </div>

        <div class="product-summary-row">
          <div class="product-thumb-wrap">
            <img id="mainThumbnail" src="" alt="상품 썸네일" class="product-thumb" referrerpolicy="no-referrer" />
          </div>
          <div class="product-details">
            <h2 id="productTitle" class="product-title" title="수집된 타이틀">수집 타이틀</h2>
            <div class="product-meta">
              <span id="brandName" class="brand-name">도메인</span>
              <span class="meta-dot">·</span>
              <span id="sectionCountText" class="sections-count-pill">매핑 영역 0개</span>
            </div>
          </div>
        </div>

        <!-- Horizontal Image Gallery -->
        <div id="imagesContainer" class="images-scroll-container"></div>

        <!-- Mapped Text Preview Box -->
        <div class="mapped-text-box">
          <div class="mapped-text-header">
            <span>📝 수집된 본문 & 표 내용 미리보기</span>
          </div>
          <pre id="mappedTextPreview" class="mapped-text-content"></pre>
        </div>

        <!-- FARACOM Transfer Button -->
        <button id="sendToFaracomBtn" class="transfer-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span id="sendBtnLabel">FARACOM 전송 (즉시 반영)</span>
        </button>
      </div>
    </section>

    <!-- 2. [수집 실행 버튼] -->
    <div class="run-section">
      <button id="runSequenceBtn" class="primary-btn run-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span id="runBtnText">수집 실행</span>
      </button>
    </div>

    <!-- 3. [하단 바] 상태 표시 및 하단 우측 톱니바퀴 설정 아이콘 -->
    <div class="bottom-control-bar">
      <div class="recipe-status-info">
        <span id="cloudSyncIndicator" class="cloud-pill" title="공용 DB 연동 상태">☁️ 공용DB 동기화</span>
        <span id="activeStepCount" class="step-summary-pill">0개 단계</span>
      </div>
      <div class="bottom-btns-group">
        <button id="toggleSettingsBtn" class="gear-toggle-btn" title="매핑 관리자 설정 열기/닫기">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span class="gear-label">설정</span>
        </button>
      </div>
    </div>

    <!-- 4. [설정 드로어] 톱니바퀴를 눌러야만 열리는 매핑 관리자 모드 -->
    <div id="mappingDrawer" class="mapping-drawer hidden">
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <span class="drawer-title">⚙️ 매핑 규칙 관리 (관리자 모드)</span>
        </div>
        <div class="drawer-header-actions">
          <button id="drawerSyncToggleBtn" class="sync-switch-btn in-drawer" type="button" title="클릭하여 공용 DB 자동 동기화 켜기/끄기">
            <span id="drawerSyncDot" class="sync-status-dot on"></span>
            <span id="drawerSyncText">동기화 ON</span>
          </button>
          <button id="closeDrawerBtn" class="drawer-close-btn" title="설정 닫기">✕</button>
        </div>
      </div>

      <!-- 매핑 버튼들 (3단 메뉴: 클릭 추가, 매핑 추가, 자동스크롤 추가) -->
      <div class="macro-picker-bar">
        <div class="macro-btn-col">
          <button id="addClickStepBtn" class="macro-action-btn click-mode-btn" title="웹페이지에서 클릭할 버튼/탭을 마우스로 지정">
            <span class="macro-btn-icon">👆</span>
            <div class="macro-btn-text">
              <span class="macro-btn-main">클릭 추가</span>
              <span class="macro-btn-sub">탭·더보기</span>
            </div>
          </button>
        </div>
        <div class="macro-btn-col">
          <button id="addMapStepBtn" class="macro-action-btn map-mode-btn" title="클릭한 영역의 글/표/사진을 그대로 1:1 수집">
            <span class="macro-btn-icon">🎯</span>
            <div class="macro-btn-text">
              <span class="macro-btn-main">매핑 추가</span>
              <span class="macro-btn-sub">글·표·사진</span>
            </div>
          </button>
        </div>
        <div class="macro-btn-col">
          <button id="addScrollStepBtn" class="macro-action-btn scroll-mode-btn" title="페이지 맨 밑까지 스크롤하여 상세페이지 이미지 및 동적 컨텐츠를 로드한 뒤 해당 위치에서 매핑을 진행합니다">
            <span class="macro-btn-icon">📜</span>
            <div class="macro-btn-text">
              <span class="macro-btn-main">자동스크롤 추가</span>
              <span class="macro-btn-sub">맨 밑으로 이동</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 시퀀스 목록 -->
      <section class="sequence-card">
        <div class="sequence-header">
          <div class="sequence-title-wrap">
            <span class="sequence-title">현재 사이트 시퀀스</span>
            <span id="stepCountText" class="sequence-badge">0단계</span>
          </div>
          <button id="loadPresetBtn" class="link-btn" title="기본 추천 시퀀스 불러오기">추천 예시</button>
        </div>

        <div id="sequenceList" class="sequence-list"></div>

        <div id="emptySequenceHint" class="empty-sequence-hint hidden">
          <p class="empty-hint-title">등록된 단계가 없습니다</p>
          <p class="empty-hint-desc">위의 <b>[👆 클릭 추가]</b> 또는 <b>[🎯 매핑 추가]</b>로 순서대로 지정해 주세요.</p>
        </div>

        <div class="macro-sub-actions">
          <button id="clearSequenceBtn" class="ghost-btn danger-text">전체 비우기</button>
          <div class="db-action-group">
            <button id="fetchCloudBtn" class="ghost-btn" title="공용 DB에서 최신 규칙 불러오기">DB 불러오기 🔄</button>
            <button id="saveCloudBtn" class="cloud-save-btn" title="이 사이트 규칙을 공용 DB에 저장하여 모든 사용자가 공유">공용 DB 저장 ☁️</button>
          </div>
        </div>
      </section>
    </div>

    <!-- Toast Notification (최상단 플로팅) -->
    <div id="actionToast" class="action-toast hidden">
      <span id="toastText">알림</span>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>

```


---
## 📄 File: `extension/popup.js`

```js
// FARACOM TOOL (의류) - Universal Point-and-Click Mapping Controller
// Supports ANY e-commerce website (ZOZOTOWN, Rakuten, Yahoo, Brand Sites, etc.)
// Connected with Shared Cloud Recipe DB

let currentProductData = null;
let currentSteps = [];
let currentHostname = "default";
let currentTabId = null;
let currentTabUrl = "";
let isAutoSyncEnabled = true;

// 현재 구동 중인 FARACOM 웹앱 주소 (4순위 새 탭 열기 주소)
const DEFAULT_FARACOM_URL = "https://faracomtoolclothing.ai.studio";

let elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  initElements();
  await initSyncSettings();
  await detectActiveTabDomain();
  await loadSavedRecipeForDomain();
  await checkFaracomStudioStatus();
  await syncActiveTabScrapedState();
});

async function initSyncSettings() {
  try {
    const res = await chrome.storage.local.get(["faracom_auto_sync_enabled"]);
    if (typeof res.faracom_auto_sync_enabled === "boolean") {
      isAutoSyncEnabled = res.faracom_auto_sync_enabled;
    } else {
      isAutoSyncEnabled = true;
    }
    updateSyncUI(isAutoSyncEnabled);
  } catch (e) {
    isAutoSyncEnabled = true;
  }
}

function updateSyncUI(enabled) {
  if (elements.drawerSyncDot) {
    elements.drawerSyncDot.className = `sync-status-dot ${enabled ? "on" : "off"}`;
  }
  if (elements.drawerSyncText) {
    elements.drawerSyncText.innerText = enabled ? "동기화 ON" : "동기화 OFF";
  }
  if (elements.drawerSyncToggleBtn) {
    if (enabled) {
      elements.drawerSyncToggleBtn.classList.remove("is-off");
      elements.drawerSyncToggleBtn.title = "현재: 동기화 ON (클릭하면 동기화 OFF로 전환)";
    } else {
      elements.drawerSyncToggleBtn.classList.add("is-off");
      elements.drawerSyncToggleBtn.title = "현재: 동기화 OFF (클릭하면 동기화 ON으로 전환)";
    }
  }
}

async function toggleAutoSync() {
  isAutoSyncEnabled = !isAutoSyncEnabled;
  try {
    await chrome.storage.local.set({ faracom_auto_sync_enabled: isAutoSyncEnabled });
  } catch (e) {}

  updateSyncUI(isAutoSyncEnabled);

  if (isAutoSyncEnabled) {
    showToast("🟢 동기화 ON: 공용 DB 최신 규칙을 자동으로 연동합니다.");
    await loadSavedRecipeForDomain();
  } else {
    showToast("⏸️ 동기화 OFF: 수정한 매핑 규칙이 덮어씌워지지 않고 로컬에 보존됩니다.");
    if (elements.cloudSyncIndicator) {
      elements.cloudSyncIndicator.innerText = currentSteps.length > 0 ? "🔒 수동 (로컬 보존)" : "⏸️ 동기화 OFF";
    }
  }
}

function initElements() {
  elements = {
    statusBadge: document.getElementById("statusBadge"),
    statusText: document.getElementById("statusText"),
    currentDomainBadge: document.getElementById("currentDomainBadge"),
    idleState: document.getElementById("idleState"),
    loadingState: document.getElementById("loadingState"),
    loadingProgress: document.getElementById("loadingProgress"),
    resultState: document.getElementById("resultState"),
    imgCountBadge: document.getElementById("imgCountBadge"),
    clearScrapedBtn: document.getElementById("clearScrapedBtn"),
    mainThumbnail: document.getElementById("mainThumbnail"),
    productTitle: document.getElementById("productTitle"),
    brandName: document.getElementById("brandName"),
    sectionCountText: document.getElementById("sectionCountText"),
    imagesContainer: document.getElementById("imagesContainer"),
    mappedTextPreview: document.getElementById("mappedTextPreview"),
    sendToFaracomBtn: document.getElementById("sendToFaracomBtn"),
    sendBtnLabel: document.getElementById("sendBtnLabel"),
    runSequenceBtn: document.getElementById("runSequenceBtn"),
    runBtnText: document.getElementById("runBtnText"),
    cloudSyncIndicator: document.getElementById("cloudSyncIndicator"),
    activeStepCount: document.getElementById("activeStepCount"),
    toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
    mappingDrawer: document.getElementById("mappingDrawer"),
    closeDrawerBtn: document.getElementById("closeDrawerBtn"),
    drawerSyncToggleBtn: document.getElementById("drawerSyncToggleBtn"),
    drawerSyncDot: document.getElementById("drawerSyncDot"),
    drawerSyncText: document.getElementById("drawerSyncText"),
    addClickStepBtn: document.getElementById("addClickStepBtn"),
    addMapStepBtn: document.getElementById("addMapStepBtn"),
    addScrollStepBtn: document.getElementById("addScrollStepBtn"),
    sequenceList: document.getElementById("sequenceList"),
    stepCountText: document.getElementById("stepCountText"),
    emptySequenceHint: document.getElementById("emptySequenceHint"),
    loadPresetBtn: document.getElementById("loadPresetBtn"),
    clearSequenceBtn: document.getElementById("clearSequenceBtn"),
    fetchCloudBtn: document.getElementById("fetchCloudBtn"),
    saveCloudBtn: document.getElementById("saveCloudBtn"),
    actionToast: document.getElementById("actionToast"),
    toastText: document.getElementById("toastText")
  };

  elements.runSequenceBtn.addEventListener("click", handleRunSequence);
  elements.toggleSettingsBtn.addEventListener("click", toggleSettingsDrawer);
  elements.closeDrawerBtn.addEventListener("click", closeSettingsDrawer);
  elements.drawerSyncToggleBtn?.addEventListener("click", toggleAutoSync);
  elements.addClickStepBtn.addEventListener("click", () => startInspectorInTab("click"));
  elements.addMapStepBtn.addEventListener("click", () => startInspectorInTab("map"));
  elements.addScrollStepBtn?.addEventListener("click", addAutoScrollStep);
  elements.loadPresetBtn.addEventListener("click", loadRecommendedExample);
  elements.clearSequenceBtn.addEventListener("click", clearSequence);
  elements.fetchCloudBtn.addEventListener("click", () => loadSavedRecipeForDomain(true));
  elements.saveCloudBtn.addEventListener("click", saveRecipeToCloudDB);
  elements.sendToFaracomBtn.addEventListener("click", handleSendToFaracom);
  elements.clearScrapedBtn?.addEventListener("click", handleClearScrapedData);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.faracom_recipes_by_domain) {
      const recipes = changes.faracom_recipes_by_domain.newValue || {};
      if (recipes[currentHostname]) {
        currentSteps = recipes[currentHostname];
        renderSequenceList();
      }
    } else if (changes.faracom_recipe_steps) {
      currentSteps = changes.faracom_recipe_steps.newValue || [];
      renderSequenceList();
    }
  });
}

function toggleSettingsDrawer() {
  const isHidden = elements.mappingDrawer.classList.contains("hidden");
  if (isHidden) {
    elements.mappingDrawer.classList.remove("hidden");
    elements.toggleSettingsBtn.classList.add("active");
  } else {
    elements.mappingDrawer.classList.add("hidden");
    elements.toggleSettingsBtn.classList.remove("active");
  }
}

function closeSettingsDrawer() {
  elements.mappingDrawer.classList.add("hidden");
  elements.toggleSettingsBtn.classList.remove("active");
}

async function detectActiveTabDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      currentTabId = tabs[0].id;
      currentTabUrl = tabs[0].url;
      const u = new URL(tabs[0].url);
      currentHostname = u.hostname.replace(/^www\./, "");
      elements.currentDomainBadge.innerText = `🌐 ${currentHostname}`;
      elements.currentDomainBadge.title = tabs[0].url;
    } else {
      currentTabId = null;
      currentTabUrl = "";
      currentHostname = "default";
      elements.currentDomainBadge.innerText = `🌐 일반 웹페이지`;
    }
  } catch (e) {
    currentHostname = "default";
  }
}

async function loadSavedRecipeForDomain(forceRefresh = false) {
  try {
    const res = await chrome.storage.local.get(["faracom_recipes_by_domain", "faracom_recipe_steps"]);
    const recipes = res.faracom_recipes_by_domain || {};
    if (recipes[currentHostname] && Array.isArray(recipes[currentHostname])) {
      currentSteps = recipes[currentHostname];
    } else if (res.faracom_recipe_steps && Array.isArray(res.faracom_recipe_steps)) {
      currentSteps = res.faracom_recipe_steps;
    }
    renderSequenceList();
  } catch (e) {}

  if (!isAutoSyncEnabled && !forceRefresh) {
    if (elements.cloudSyncIndicator) {
      elements.cloudSyncIndicator.innerText = currentSteps.length > 0 ? "🔒 동기화 OFF (로컬 보존)" : "⏸️ 동기화 OFF";
    }
    renderSequenceList();
    return;
  }

  if (elements.cloudSyncIndicator) {
    elements.cloudSyncIndicator.innerText = "☁️ 공용DB 불러오는 중...";
  }

  try {
    const apiUrl = `${DEFAULT_FARACOM_URL}/api/extension/recipes?domain=${encodeURIComponent(currentHostname)}`;
    const res = await fetch(apiUrl, { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.steps) && data.steps.length > 0) {
        currentSteps = data.steps;
        await saveRecipeToLocalStorage(false);
        renderSequenceList();
        if (elements.cloudSyncIndicator) {
          elements.cloudSyncIndicator.innerText = "☁️ 공용DB 동기화됨";
        }
        if (forceRefresh) {
          showToast(`☁️ [${currentHostname}] 공용 DB에서 최신 규칙을 불러왔습니다.`);
        }
        return;
      }
    }
  } catch (cloudErr) {}

  if (currentSteps.length === 0 && currentHostname.includes("zozo")) {
    await loadRecommendedExample();
  } else {
    if (elements.cloudSyncIndicator) {
      elements.cloudSyncIndicator.innerText = currentSteps.length > 0 ? "💾 로컬 규칙 사용" : "☁️ 공용DB 대기";
    }
    renderSequenceList();
  }
}

async function saveRecipeToCloudDB() {
  if (currentSteps.length === 0) {
    showToast("저장할 단계가 없습니다. 먼저 클릭이나 매핑을 추가해 주세요.");
    return;
  }

  elements.saveCloudBtn.disabled = true;
  elements.saveCloudBtn.innerText = "저장 중...";

  try {
    await saveRecipeToLocalStorage(false);
    const apiUrl = `${DEFAULT_FARACOM_URL}/api/extension/recipes`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: currentHostname,
        steps: currentSteps,
        updatedBy: "extension_user"
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        showToast(`🎉 [${currentHostname}] 공용 DB에 성공적으로 저장되었습니다!`);
        if (elements.cloudSyncIndicator) {
          elements.cloudSyncIndicator.innerText = "☁️ 공용DB 저장됨";
        }
      }
    } else {
      showToast("로컬에 저장 완료되었습니다.");
    }
  } catch (err) {
    showToast("💾 로컬 저장 완료 (공용 DB 통신 지연)");
  } finally {
    elements.saveCloudBtn.disabled = false;
    elements.saveCloudBtn.innerText = "공용 DB 저장 ☁️";
  }
}

async function saveRecipeToLocalStorage(notify = false) {
  try {
    const res = await chrome.storage.local.get(["faracom_recipes_by_domain"]);
    const recipes = res.faracom_recipes_by_domain || {};
    recipes[currentHostname] = currentSteps;
    await chrome.storage.local.set({
      faracom_recipes_by_domain: recipes,
      faracom_recipe_steps: currentSteps
    });
    if (notify) {
      showToast(`💾 [${currentHostname}] 규칙이 로컬에 저장되었습니다.`);
    }
  } catch (e) {}
}

async function loadRecommendedExample() {
  currentSteps = [
    {
      id: "step_" + Date.now() + "_1",
      type: "map",
      label: "매핑: 아이템 상세설명",
      selector: ".p-goods-description, #item-intro, .p-goods-information__description",
      xpath: "",
      anchorText: ""
    },
    {
      id: "step_" + Date.now() + "_2",
      type: "click",
      label: "클릭: [サイズ] 탭 버튼",
      selector: 'button:contains("サイズ"), a:contains("サイズ"), [data-tab="size"], .p-goods-tab__item',
      xpath: '//button[contains(text(), "サイズ")] | //a[contains(text(), "サイズ")]',
      anchorText: "サイズ"
    },
    {
      id: "step_" + Date.now() + "_3",
      type: "map",
      label: "매핑: 사이즈 실측표",
      selector: ".p-goods-size__table, table, .p-goods-size-table",
      xpath: "",
      anchorText: ""
    },
    {
      id: "step_" + Date.now() + "_4",
      type: "map",
      label: "매핑: 고화질 이미지 갤러리",
      selector: ".p-goods-thumbnail, .goods-image, .p-goods-photo",
      xpath: "",
      anchorText: ""
    }
  ];

  await saveRecipeToLocalStorage(false);
  renderSequenceList();
  showToast("💡 추천 시퀀스를 불러왔습니다.");
}

async function addAutoScrollStep() {
  const scrollStep = {
    id: "step_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    type: "scroll",
    label: "페이지 자동 스크롤",
    selector: "페이지 자동 스크롤 (맨 밑으로 이동)",
    xpath: "",
    anchorText: ""
  };
  currentSteps.push(scrollStep);
  await saveRecipeToLocalStorage(false);
  renderSequenceList();
  showToast("📜 [자동스크롤] 단계가 추가되었습니다.");
}

function renderSequenceList() {
  elements.sequenceList.innerHTML = "";
  elements.stepCountText.innerText = `${currentSteps.length}단계`;
  if (elements.activeStepCount) {
    elements.activeStepCount.innerText = `${currentSteps.length}개 단계`;
  }

  if (currentSteps.length === 0) {
    elements.emptySequenceHint.classList.remove("hidden");
    return;
  }
  elements.emptySequenceHint.classList.add("hidden");

  currentSteps.forEach((step, index) => {
    const item = document.createElement("div");
    item.className = "sequence-item";

    const isClick = step.type === "click";
    const isScroll = step.type === "scroll";
    const tagClass = isClick ? "tag-click" : (isScroll ? "tag-scroll" : "tag-map");
    const tagText = isClick ? "👆 클릭" : (isScroll ? "📜 스크롤" : "🎯 매핑");

    item.innerHTML = `
      <span class="step-num">${index + 1}</span>
      <span class="step-tag ${tagClass}">${tagText}</span>
      <div class="step-details">
        <span class="step-selector" title="${escapeHtml(step.selector || step.xpath || step.anchorText || '')}">${escapeHtml(step.selector || step.xpath || step.anchorText || "")}</span>
      </div>
      <div class="step-actions">
        ${index > 0 ? `<button class="step-ctrl-btn up-btn" title="위로 이동">▲</button>` : ""}
        ${index < currentSteps.length - 1 ? `<button class="step-ctrl-btn down-btn" title="아래로 이동">▼</button>` : ""}
        <button class="step-ctrl-btn del-btn" title="삭제">✕</button>
      </div>
    `;

    const upBtn = item.querySelector(".up-btn");
    const downBtn = item.querySelector(".down-btn");
    const delBtn = item.querySelector(".del-btn");

    if (upBtn) upBtn.addEventListener("click", () => moveStep(index, -1));
    if (downBtn) downBtn.addEventListener("click", () => moveStep(index, 1));
    delBtn.addEventListener("click", () => deleteStep(index));

    elements.sequenceList.appendChild(item);
  });
}

function moveStep(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= currentSteps.length) return;
  const temp = currentSteps[index];
  currentSteps[index] = currentSteps[targetIndex];
  currentSteps[targetIndex] = temp;
  saveRecipeToLocalStorage(false);
  renderSequenceList();
}

function deleteStep(index) {
  currentSteps.splice(index, 1);
  saveRecipeToLocalStorage(false);
  renderSequenceList();
}

function clearSequence() {
  if (currentSteps.length === 0) return;
  if (confirm("현재 시퀀스의 모든 단계를 비우시겠습니까?")) {
    currentSteps = [];
    saveRecipeToLocalStorage(false);
    renderSequenceList();
  }
}

async function startInspectorInTab(mode) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].id) return;
    try {
      await chrome.tabs.sendMessage(tabs[0].id, { action: "START_INSPECTOR", mode: mode }, { frameId: 0 });
      window.close();
    } catch (msgErr) {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, frameIds: [0] },
        files: ["content.js"]
      });
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, { action: "START_INSPECTOR", mode: mode }, { frameId: 0 });
          window.close();
        } catch (e) {}
      }, 250);
    }
  } catch (e) {}
}

async function handleRunSequence() {
  if (currentSteps.length === 0) {
    showToast("등록된 단계가 없습니다. 먼저 [설정 > 클릭/매핑 추가]로 영역을 지정해 주세요.");
    toggleSettingsDrawer();
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0] || !tabs[0].id) return;
  const tabId = tabs[0].id;

  elements.idleState.classList.add("hidden");
  elements.resultState.classList.add("hidden");
  elements.loadingState.classList.remove("hidden");
  elements.runSequenceBtn.disabled = true;
  elements.runBtnText.innerText = "수집 진행 중...";

  try {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "PING" }, { frameId: 0 });
    } catch (e) {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [0] },
        files: ["content.js"]
      });
      await new Promise(r => setTimeout(r, 200));
    }

    chrome.tabs.sendMessage(tabId, {
      action: "RUN_SEQUENCE",
      steps: currentSteps
    }, { frameId: 0 }, (res) => {
      elements.runSequenceBtn.disabled = false;
      elements.runBtnText.innerText = "수집 실행";

      if (chrome.runtime.lastError || !res || !res.success) {
        elements.loadingState.classList.add("hidden");
        elements.idleState.classList.remove("hidden");
        showToast("수집 실패: " + (chrome.runtime.lastError?.message || res?.error || "알 수 없는 오류"));
        return;
      }

      currentProductData = res.data;
      chrome.tabs.sendMessage(tabId, { action: "SET_PAGE_SCRAPED_DATA", data: currentProductData }, { frameId: 0 }, () => {});
      chrome.storage.local.set({ faracom_last_scraped: currentProductData });
      renderScrapedResult(currentProductData);
      showToast("🎉 수집 완료! 상단에서 결과를 확인하세요.");
    });
  } catch (err) {
    elements.runSequenceBtn.disabled = false;
    elements.runBtnText.innerText = "수집 실행";
    elements.loadingState.classList.add("hidden");
    elements.idleState.classList.remove("hidden");
  }
}

function renderScrapedResult(data) {
  if (!data) return;

  elements.idleState.classList.add("hidden");
  elements.loadingState.classList.add("hidden");
  elements.resultState.classList.remove("hidden");

  elements.productTitle.innerText = data.title || "수집 상품";
  elements.brandName.innerText = data.brand || currentHostname;
  elements.sectionCountText.innerText = `매핑 영역 ${data.sections?.length || 0}개`;

  const imgs = Array.isArray(data.images) ? data.images : [];
  elements.imgCountBadge.innerText = `${imgs.length}장 수집됨`;

  if (imgs.length > 0) {
    elements.mainThumbnail.src = imgs[0];
    elements.mainThumbnail.style.display = "block";
  } else {
    elements.mainThumbnail.style.display = "none";
  }

  elements.imagesContainer.innerHTML = "";
  imgs.forEach((imgUrl, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "gallery-thumb-card";
    thumb.innerHTML = `
      <img src="${escapeHtml(imgUrl)}" class="gallery-thumb-img" referrerpolicy="no-referrer" />
      <span class="gallery-thumb-index">${idx + 1}</span>
    `;
    elements.imagesContainer.appendChild(thumb);
  });

  elements.mappedTextPreview.innerText = data.summaryText || "(추출된 본문 텍스트 없음)";
}

function resetScrapedResultUI() {
  currentProductData = null;
  if (elements.resultState) elements.resultState.classList.add("hidden");
  if (elements.loadingState) elements.loadingState.classList.add("hidden");
  if (elements.idleState) elements.idleState.classList.remove("hidden");

  if (elements.mainThumbnail) {
    elements.mainThumbnail.src = "";
    elements.mainThumbnail.style.display = "none";
  }
  if (elements.productTitle) elements.productTitle.innerText = "수집 대기 중";
  if (elements.imagesContainer) elements.imagesContainer.innerHTML = "";
  if (elements.mappedTextPreview) elements.mappedTextPreview.innerText = "";
  if (elements.imgCountBadge) elements.imgCountBadge.innerText = "0장 수집됨";
}

async function syncActiveTabScrapedState() {
  if (!currentTabId || !currentTabUrl || currentTabUrl.startsWith("chrome://")) {
    resetScrapedResultUI();
    return;
  }

  try {
    chrome.tabs.sendMessage(currentTabId, { action: "GET_PAGE_SCRAPED_DATA" }, { frameId: 0 }, (res) => {
      if (chrome.runtime.lastError || !res || !res.data) {
        resetScrapedResultUI();
        chrome.storage.local.remove(["faracom_last_scraped"]);
        return;
      }
      if (res.data.url && res.data.url === currentTabUrl) {
        currentProductData = res.data;
        renderScrapedResult(currentProductData);
      } else {
        resetScrapedResultUI();
        chrome.storage.local.remove(["faracom_last_scraped"]);
      }
    });
  } catch (e) {
    resetScrapedResultUI();
  }
}

function handleClearScrapedData() {
  resetScrapedResultUI();
  chrome.storage.local.remove(["faracom_last_scraped"]);
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { action: "CLEAR_PAGE_SCRAPED_DATA" }, { frameId: 0 }, () => {});
  }
  showToast("수집 결과가 초기화되었습니다.");
}

// FARACOM 웹앱 탭 판별 헬퍼
function isAiStudioTab(tab) {
  if (!tab || !tab.url) return false;
  const url = tab.url.toLowerCase();
  const title = (tab.title || "").toLowerCase();
  return (
    url.includes("ai.studio") ||
    url.includes("aistudio.google.com") ||
    url.includes("faracomtoolclothing")
  );
}

function isRunAppTab(tab) {
  if (!tab || !tab.url) return false;
  const url = tab.url.toLowerCase();
  const title = (tab.title || "").toLowerCase();
  return (
    url.includes("run.app") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    title.includes("의류상품분석") ||
    title.includes("text imege to ai") ||
    title.includes("faracom") ||
    title.includes("파라컴")
  );
}

function isFaracomAppTab(tab) {
  return isAiStudioTab(tab) || isRunAppTab(tab);
}

/**
 * 웹앱 인식 순위:
 * 1순위: 현재 보고 있는 탭
 * 2순위: ai.studio 탭순으로
 * 3순위: run.app 탭순으로
 * 4순위: 열려있는 탭이 없을 때 faracomtoolclothing.ai.studio 로 새 탭 실행
 */
async function findTargetFaracomTab() {
  try {
    const allTabs = await chrome.tabs.query({});

    // 1순위: 현재 보고 있는 탭 (현재 창에서 사용자가 보고 있는 활성 탭)
    const currentWindowActive = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentWindowActive && currentWindowActive.length > 0 && isFaracomAppTab(currentWindowActive[0])) {
      return { tab: currentWindowActive[0], rank: "1순위 (현재 보고 있는 탭)" };
    }

    // 다른 활성 창에서 보고 있는 활성 탭 중 웹앱 체크
    const anyActiveTabs = await chrome.tabs.query({ active: true });
    for (const aTab of anyActiveTabs) {
      if (isFaracomAppTab(aTab)) {
        return { tab: aTab, rank: "1순위 (현재 보고 있는 탭)" };
      }
    }

    // 2순위: ai.studio 탭순으로
    const aiStudioTabs = allTabs.filter(t => isAiStudioTab(t));
    if (aiStudioTabs.length > 0) {
      return { tab: aiStudioTabs[0], rank: "2순위 (ai.studio 탭)" };
    }

    // 3순위: run.app 탭순으로
    const runAppTabs = allTabs.filter(t => isRunAppTab(t));
    if (runAppTabs.length > 0) {
      return { tab: runAppTabs[0], rank: "3순위 (run.app 탭)" };
    }

    // 4순위: 열려있는 탭이 없을 때
    return { tab: null, rank: "4순위 (faracomtoolclothing.ai.studio 새 탭 실행)" };
  } catch (e) {
    console.error("findTargetFaracomTab error:", e);
    return { tab: null, rank: "4순위 (faracomtoolclothing.ai.studio 새 탭 실행)" };
  }
}

async function findFaracomTabs() {
  const res = await findTargetFaracomTab();
  return res.tab ? [res.tab] : [];
}

async function checkFaracomStudioStatus() {
  const target = await findTargetFaracomTab();
  if (target.tab) {
    if (elements.statusBadge) elements.statusBadge.className = "status-badge connected";
    if (elements.statusText) elements.statusText.innerText = `웹앱 연결됨 (${target.rank.split(" ")[0]})`;
  } else {
    if (elements.statusBadge) elements.statusBadge.className = "status-badge disconnected";
    if (elements.statusText) elements.statusText.innerText = "웹앱 미실행 (전송시 4순위 새탭)";
  }
}

async function handleSendToFaracom() {
  if (!currentProductData) {
    showToast("전송할 상품 데이터가 없습니다. 먼저 수집을 실행해 주세요.");
    return;
  }

  elements.sendToFaracomBtn.disabled = true;
  elements.sendBtnLabel.innerText = "데이터 전송 중...";

  try {
    // 1. chrome.storage.local에 최신 전송 데이터 저장 (백그라운드 캐시)
    await chrome.storage.local.set({
      faracom_transfer_data: currentProductData,
      faracom_transfer_time: Date.now()
    });

    // 2. 4단계 순위에 따라 대상 탭 결정
    const targetInfo = await findTargetFaracomTab();
    let targetTab = targetInfo.tab;

    if (!targetTab) {
      // 4순위: 열려있는 탭이 없을 때 faracomtoolclothing.ai.studio 로 새 탭 실행
      showToast("🚀 4순위: faracomtoolclothing.ai.studio 새 탭을 엽니다...");
      targetTab = await chrome.tabs.create({ url: DEFAULT_FARACOM_URL, active: true });
      await new Promise(r => setTimeout(r, 2500));
    } else {
      // 1, 2, 3순위 대상 탭으로 활성화 이동
      await chrome.tabs.update(targetTab.id, { active: true });
    }

    // 3. 전송 실행
    // 1차 시도: tabs.sendMessage (app-content.js로 전달)
    let delivered = false;
    try {
      const resp = await chrome.tabs.sendMessage(targetTab.id, {
        action: "IMPORT_PRODUCT_DATA",
        payload: currentProductData
      });
      if (resp && resp.success) {
        delivered = true;
      }
    } catch (e) {
      delivered = false;
    }

    // 2차 시도: executeScript로 웹앱 window 및 모든 iframe(allFrames: true)에 직접 CustomEvent 및 postMessage 디스패치
    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id, allFrames: true },
        func: (data) => {
          window.dispatchEvent(new CustomEvent("FARACOM_IMPORT_PRODUCT", { detail: data }));
          window.postMessage({ type: "FARACOM_IMPORT_PRODUCT", payload: data }, "*");
        },
        args: [currentProductData]
      });
      delivered = true;
    } catch (err2) {
      console.warn("scripting.executeScript fallback error:", err2);
    }

    showToast(`✨ [${targetInfo.rank.split(" ")[0]}] 웹앱으로 데이터 전송 완료!`);
  } catch (err) {
    console.error("전송 에러:", err);
    showToast("전송 중 오류 발생: " + err.message);
  } finally {
    elements.sendToFaracomBtn.disabled = false;
    elements.sendBtnLabel.innerText = "FARACOM 전송 완료";
  }
}

function showToast(msg) {
  elements.toastText.innerText = msg;
  elements.actionToast.classList.remove("hidden");
  setTimeout(() => {
    elements.actionToast.classList.add("hidden");
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

```


---
## 📄 File: `extension/app-content.js`

```js
// FARACOM TOOL (의류) - Content Script for FARACOM Web Studio App
// Bridges messages from the Chrome Extension to the FARACOM React web app

(function() {
  try {
    window.sessionStorage.setItem("FARACOM_TOOL_INSTALLED", "true");
    window.postMessage({ type: "FARACOM_TOOL_STATUS", installed: true }, "*");
  } catch (e) {}

  function deliverToApp(payload) {
    if (!payload) return;
    try {
      window.dispatchEvent(new CustomEvent("FARACOM_IMPORT_PRODUCT", { detail: payload }));
      window.postMessage({ type: "FARACOM_IMPORT_PRODUCT", payload: payload }, "*");
      console.log("[FARACOM TOOL (의류)] app-content.js delivered data to window:", payload);
    } catch (e) {
      console.warn("[FARACOM TOOL (의류)] deliverToApp error:", e);
    }
  }

  // 1. Storage 변화 실시간 감지 (모든 탭 & iframe 자동 동기화)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.faracom_transfer_data && changes.faracom_transfer_data.newValue) {
        deliverToApp(changes.faracom_transfer_data.newValue);
      }
    });
  } catch (e) {}

  // 2. 탭이 새로 열렸을 때 미처리된 최근 전송 데이터 자동 반영 (최근 60초 이내)
  try {
    chrome.storage.local.get(["faracom_transfer_data", "faracom_transfer_time"], (res) => {
      if (res && res.faracom_transfer_data && res.faracom_transfer_time) {
        if (Date.now() - res.faracom_transfer_time < 60000) {
          deliverToApp(res.faracom_transfer_data);
        }
      }
    });
  } catch (e) {}

  // 3. direct message 수신
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "PING_FARACOM") {
        sendResponse({ status: "alive", title: document.title, url: window.location.href });
        return true;
      }

      if (request.action === "IMPORT_PRODUCT_DATA" || request.action === "FARACOM_IMPORT_DATA") {
        deliverToApp(request.payload);
        sendResponse({ success: true, message: "FARACOM 웹앱으로 데이터 전달 완료" });
        return true;
      }
    });
  } catch (e) {}
})();

```
