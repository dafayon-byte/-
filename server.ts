import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { google } from "googleapis";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

import firebaseConfig from "./firebase-applet-config.json";

const DEFAULT_INSTRUCTIONS = `당신은 전문적인 의류 상품 정보 분석가이자 데이터 생성기입니다.
제공된 이미지와 텍스트를 분석하여 사용자가 쇼핑몰에 바로 등록할 수 있는 완벽한 JSON 데이터를 생성해야 합니다.

[분석 지침]
1. 이미지 분석: 이미지에서 상품의 디자인, 색상, 소재감, 디테일(단추, 지퍼, 패턴 등)을 정확히 파악하세요.
2. 텍스트 분석: 제공된 텍스트에서 사이즈 정보, 소재 혼용률, 세탁 방법 등을 추출하세요.
3. 브랜드 감지: 이미지나 텍스트에 유명 브랜드 로고나 명칭이 포함되어 있는지 확인하고, 발견 시 notification 필드에 경고 문구를 넣으세요.
4. 상품명 생성: 검색 최적화(SEO)를 고려하여 클릭을 유도하는 매력적인 상품명을 생성하세요.
5. 소구점 추출: 상품의 장점과 특징을 5줄 내외의 매력적인 문장으로 요약하세요. 만약 모델 정보(키, 몸무게 등)가 있다면 소구점 바로 다음 줄에 '모델정보'라는 제목과 함께 기재하되, 소구점과 모델정보 사이에 빈 줄(공백 라인)을 절대 두지 마세요.
6. 사이즈표 생성: 텍스트의 사이즈 정보를 바탕으로 마크다운 표 형식의 사이즈표를 생성하세요.

[출력 형식]
반드시 JSON 형식으로만 응답해야 하며, 다른 설명은 포함하지 마세요.`;

async function getInstructionsFromFirestore() {
  try {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/prompts/active`;
    
    const response = await axios.get(url);
    const content = response.data?.fields?.content?.stringValue;

    if (content && content.trim() !== "") {
      console.log("Successfully fetched instructions from Firestore");
      return content;
    }
    return DEFAULT_INSTRUCTIONS;
  } catch (error: any) {
    console.warn("Firestore fetch failed, using default instructions:", error.message);
    return DEFAULT_INSTRUCTIONS;
  }
}

// API Routes
app.get("/api/instructions", async (req, res) => {
  try {
    const instructions = await getInstructionsFromFirestore();
    res.json({ instructions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 외부 쇼핑몰 이미지 CORS 우회 프록시
app.get("/api/proxy-image", async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send("URL parameter is required");

  try {
    let referer = "https://zozo.jp/";
    try {
      const u = new URL(imageUrl);
      if (u.hostname.includes("imgz.jp") || u.hostname.includes("zozo")) {
        referer = "https://zozo.jp/";
      } else if (u.hostname.includes("rakuten")) {
        referer = "https://www.rakuten.co.jp/";
      } else {
        referer = u.origin + "/";
      }
    } catch (e) {}

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      // 2차 시도: No Referer
      const response2 = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*"
        }
      });
      if (response2.ok) {
        const contentType = response2.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        const arrayBuffer = await response2.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    res.status(500).send("Failed to proxy image: " + err.message);
  }
});

// FARACOM TOOL 크롬 확장 프로그램 다운로드
app.get("/api/download-extension", (req, res) => {
  const filePath = path.join(process.cwd(), "public", "FARACOM-TOOL.zip");
  if (fs.existsSync(filePath)) {
    res.download(filePath, "FARACOM-TOOL-Extension.zip");
  } else {
    res.status(404).send("확장 프로그램 설치 파일이 준비되지 않았습니다.");
  }
});

// 공용 DB 시퀀스 매핑 레시피 동기화 API
const recipesFilePath = path.join(process.cwd(), "recipes.json");
function loadRecipes(): Record<string, any[]> {
  try {
    if (fs.existsSync(recipesFilePath)) {
      return JSON.parse(fs.readFileSync(recipesFilePath, "utf8"));
    }
  } catch (e) {}
  return {};
}
function saveRecipes(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(recipesFilePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

app.get("/api/extension/recipes", (req, res) => {
  const domain = ((req.query.domain as string) || "").replace(/^www\./, "");
  const recipes = loadRecipes();
  if (recipes[domain] && Array.isArray(recipes[domain])) {
    return res.json({ success: true, steps: recipes[domain] });
  }
  // 조조타운 기본 추천 프리셋
  if (domain.includes("zozo")) {
    return res.json({
      success: true,
      steps: [
        {
          id: "step_zozo_1",
          type: "map",
          label: "매핑: 아이템 상세설명",
          selector: ".p-goods-description, #item-intro, .p-goods-information__description",
          xpath: "",
          anchorText: ""
        },
        {
          id: "step_zozo_2",
          type: "click",
          label: "클릭: [サイズ] 탭 버튼",
          selector: 'button:contains("サイズ"), a:contains("サイズ"), [data-tab="size"], .p-goods-tab__item',
          xpath: '//button[contains(text(), "サイズ")] | //a[contains(text(), "サイズ")]',
          anchorText: "サイズ"
        },
        {
          id: "step_zozo_3",
          type: "map",
          label: "매핑: 사이즈 실측표",
          selector: ".p-goods-size__table, table, .p-goods-size-table",
          xpath: "",
          anchorText: ""
        },
        {
          id: "step_zozo_4",
          type: "map",
          label: "매핑: 고화질 이미지 갤러리",
          selector: ".p-goods-thumbnail, .goods-image, .p-goods-photo",
          xpath: "",
          anchorText: ""
        }
      ]
    });
  }
  return res.json({ success: false, steps: [] });
});

app.post("/api/extension/recipes", (req, res) => {
  const { domain, steps } = req.body;
  if (!domain || !Array.isArray(steps)) {
    return res.status(400).json({ success: false, error: "Invalid payload" });
  }
  const cleanDomain = domain.replace(/^www\./, "");
  const recipes = loadRecipes();
  recipes[cleanDomain] = steps;
  saveRecipes(recipes);
  return res.json({ success: true, domain: cleanDomain, count: steps.length });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
