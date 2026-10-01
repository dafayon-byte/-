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
