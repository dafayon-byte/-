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
