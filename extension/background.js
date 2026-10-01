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
