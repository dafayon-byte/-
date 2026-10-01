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
