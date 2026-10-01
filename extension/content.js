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
