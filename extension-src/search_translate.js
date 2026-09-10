(() => {
  "use strict";

  if (window.top !== window.self || globalThis.__TDT_TIKTOK_SEARCH_TRANSLATE_V300__) return;
  globalThis.__TDT_TIKTOK_SEARCH_TRANSLATE_V300__ = true;

  const SETTINGS_KEY = "tdt_search_translate_settings_v1";
  const LEGACY_SETTINGS_KEY = "tdt_search_translate_v1";
  const DEFAULT_SETTINGS = Object.freeze({ enabled: true, targetLanguage: "en", autoTranslateOnSearch: true });
  const LANGUAGES = Object.freeze({ en: "EN", lo: "LO", th: "TH", km: "KM", vi: "VI" });
  const INPUT_SELECTOR = 'input[data-e2e="search-user-input"],form[data-e2e="search-box"] input,input[name="q"]';
  const SEARCH_BUTTON_SELECTOR = 'button[data-e2e="search-box-button"],form[data-e2e="search-box"] button[type="submit"],button[type="submit"][aria-label*="search" i]';
  const BUTTON_ID = "tdt-search-translate-button";
  const STYLE_ID = "tdt-search-translate-style";
  const REMOTE_ACCESS_STATE_KEY = "tdt_remote_access_state_v1";

  let settings = { ...DEFAULT_SETTINGS };
  let scanTimer = null;
  let translating = false;
  let replayingSearch = false;
  let remoteAccessLocked = true;
  let remoteAccessLeaseTimer = null;
  let lastInput = null;
  const translatedState = new WeakMap();

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      enabled: source.enabled !== false,
      targetLanguage: Object.prototype.hasOwnProperty.call(LANGUAGES, source.targetLanguage) ? source.targetLanguage : "en",
      autoTranslateOnSearch: source.autoTranslateOnSearch !== false
    };
  }

  function runtimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(response);
      });
    });
  }

  function applyTrustedRemoteAccess(state) {
    remoteAccessLocked = !(state?.allowed === true && Number(state?.leaseExpiresAt) > Date.now());
    clearTimeout(remoteAccessLeaseTimer);
    remoteAccessLeaseTimer = null;
    if (!remoteAccessLocked) {
      remoteAccessLeaseTimer = setTimeout(() => {
        remoteAccessLocked = true;
        document.getElementById(BUTTON_ID)?.remove();
      }, Math.max(250, Number(state.leaseExpiresAt) - Date.now() + 100));
    }
    if (remoteAccessLocked) document.getElementById(BUTTON_ID)?.remove();
    else scan();
  }

  function refreshRemoteAccess() {
    void runtimeMessage({ type: "REMOTE_ACCESS_GET" })
      .then((response) => applyTrustedRemoteAccess(response?.state))
      .catch(() => { remoteAccessLocked = true; document.getElementById(BUTTON_ID)?.remove(); });
  }

  function setReactInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{flex:0 0 auto;height:30px;min-width:58px;margin:0 5px;padding:0 9px;border:0;border-radius:999px;color:#fff;background:linear-gradient(135deg,#fe2c55,#ff4777);font:800 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(254,44,85,.25);white-space:nowrap;z-index:3}
      #${BUTTON_ID}:hover{filter:brightness(1.08)}#${BUTTON_ID}:disabled{opacity:.58;cursor:wait}
      #${BUTTON_ID}[data-state="ok"]{background:linear-gradient(135deg,#059669,#0f766e)}
      #${BUTTON_ID}[data-state="error"]{background:linear-gradient(135deg,#be123c,#b91c1c)}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function buttonLabel(prefix = "Dịch") {
    return `${prefix} ${LANGUAGES[settings.targetLanguage] || "EN"}`;
  }

  function visibleInput() {
    const inputs = Array.from(document.querySelectorAll(INPUT_SELECTOR)).filter((input) => input instanceof HTMLInputElement && input.isConnected);
    return inputs.find((input) => input === document.activeElement) || inputs.find((input) => {
      const rect = input.getBoundingClientRect();
      const css = getComputedStyle(input);
      return rect.width > 80 && rect.height > 20 && css.display !== "none" && css.visibility !== "hidden";
    }) || inputs[0] || null;
  }

  function nativeSearch(input, preferredButton = null) {
    replayingSearch = true;
    queueMicrotask(() => {
      try {
        const form = input.closest("form");
        const button = preferredButton?.isConnected ? preferredButton : form?.querySelector(SEARCH_BUTTON_SELECTOR) || document.querySelector(SEARCH_BUTTON_SELECTOR);
        if (button instanceof HTMLElement) button.click();
        else if (form) form.requestSubmit();
        else location.assign(`/search?q=${encodeURIComponent(String(input.value || "").trim())}`);
      } catch {
        location.assign(`/search?q=${encodeURIComponent(String(input.value || "").trim())}`);
      } finally {
        setTimeout(() => { replayingSearch = false; }, 500);
      }
    });
  }

  async function translateInput(input, { submitAfter = false, submitButton = null } = {}) {
    if (remoteAccessLocked || !settings.enabled || translating || !(input instanceof HTMLInputElement)) return false;
    const source = String(input.value || "").trim();
    if (!source) return false;

    const previous = translatedState.get(input);
    if (previous?.result === source && previous?.target === settings.targetLanguage) {
      if (submitAfter) nativeSearch(input, submitButton);
      return true;
    }

    const button = document.getElementById(BUTTON_ID);
    translating = true;
    if (button) {
      button.disabled = true;
      button.dataset.state = "";
      button.textContent = "Đang dịch…";
    }

    try {
      const response = await runtimeMessage({ type: "TRANSLATE_TEXT", text: source, targetLanguage: settings.targetLanguage });
      if (!response?.ok || !response.translation) throw new Error(response?.error || "Không thể dịch từ khóa.");
      const translated = String(response.translation).trim();
      if (!translated) throw new Error("Kết quả dịch trống.");
      setReactInputValue(input, translated);
      translatedState.set(input, { source, result: translated, target: settings.targetLanguage });
      if (button) {
        button.dataset.state = "ok";
        button.textContent = buttonLabel("✓");
      }
      if (submitAfter) nativeSearch(input, submitButton);
      return true;
    } catch (error) {
      if (button) {
        button.dataset.state = "error";
        button.textContent = "Lỗi dịch";
        button.title = error.message || "Không thể dịch từ khóa.";
      }
      return false;
    } finally {
      translating = false;
      setTimeout(() => {
        const current = document.getElementById(BUTTON_ID);
        if (!current) return;
        current.disabled = false;
        current.dataset.state = "";
        current.textContent = buttonLabel();
      }, 1100);
    }
  }

  function shouldAutoTranslate(input) {
    if (remoteAccessLocked || !settings.enabled || !settings.autoTranslateOnSearch || translating || replayingSearch) return false;
    const value = String(input?.value || "").trim();
    if (!value) return false;
    const previous = translatedState.get(input);
    return !(previous?.result === value && previous?.target === settings.targetLanguage);
  }

  function bindInput(input) {
    if (!(input instanceof HTMLInputElement) || !input.isConnected) return;
    lastInput = input;
    if (!input.dataset.tdtTranslateInputBound) {
      input.dataset.tdtTranslateInputBound = "1";
      input.addEventListener("input", () => {
        const state = translatedState.get(input);
        if (state && input.value !== state.result) translatedState.delete(input);
      }, true);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.isComposing || !shouldAutoTranslate(input)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void translateInput(input, { submitAfter: true });
      }, true);
    }

    const form = input.closest("form");
    if (form && !form.dataset.tdtTranslateBound) {
      form.dataset.tdtTranslateBound = "1";
      form.addEventListener("submit", (event) => {
        if (replayingSearch || !shouldAutoTranslate(input)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void translateInput(input, { submitAfter: true, submitButton: event.submitter });
      }, true);
    }

    if (remoteAccessLocked || !settings.enabled) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }
    if (!form) return;
    ensureStyle();
    let button = document.getElementById(BUTTON_ID);
    if (button && !form.contains(button)) button.remove();
    button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.title = "Dịch từ khóa sang ngôn ngữ đã chọn";
      const searchButton = form.querySelector(SEARCH_BUTTON_SELECTOR);
      if (searchButton) form.insertBefore(button, searchButton); else form.appendChild(button);
    }
    button.onclick = () => void translateInput(input);
    button.textContent = buttonLabel();
  }

  function scan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      const input = visibleInput();
      if (input) bindInput(input); else document.getElementById(BUTTON_ID)?.remove();
    }, 90);
  }

  document.addEventListener("click", (event) => {
    if (remoteAccessLocked || replayingSearch || !settings.autoTranslateOnSearch || !settings.enabled) return;
    const button = event.target?.closest?.(SEARCH_BUTTON_SELECTOR);
    if (!button || button.id === BUTTON_ID) return;
    const form = button.closest("form");
    const input = form?.querySelector(INPUT_SELECTOR) || visibleInput();
    if (!shouldAutoTranslate(input)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void translateInput(input, { submitAfter: true, submitButton: button });
  }, true);

  chrome.storage.local.get({ [SETTINGS_KEY]: null, [LEGACY_SETTINGS_KEY]: null, [REMOTE_ACCESS_STATE_KEY]: null }, (result) => {
    settings = normalizeSettings(result?.[SETTINGS_KEY] || result?.[LEGACY_SETTINGS_KEY] || DEFAULT_SETTINGS);
    remoteAccessLocked = true;
    if (!result?.[SETTINGS_KEY] && result?.[LEGACY_SETTINGS_KEY]) chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    refreshRemoteAccess();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[REMOTE_ACCESS_STATE_KEY]) {
      if (changes[REMOTE_ACCESS_STATE_KEY].newValue?.allowed !== true) {
        remoteAccessLocked = true;
        document.getElementById(BUTTON_ID)?.remove();
      }
    }
    if (changes[SETTINGS_KEY] || changes[LEGACY_SETTINGS_KEY]) {
      settings = normalizeSettings((changes[SETTINGS_KEY] || changes[LEGACY_SETTINGS_KEY]).newValue);
      translatedState.delete(lastInput);
      scan();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "TDT_REMOTE_ACCESS_CHANGED") return false;
    applyTrustedRemoteAccess(message.state);
    return false;
  });

  function mutationTouchesSearch(records) {
    const selector = `${INPUT_SELECTOR},form[data-e2e="search-box"],${SEARCH_BUTTON_SELECTOR}`;
    for (const record of records) {
      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        const element = node instanceof Element ? node : node?.parentElement;
        if (!(element instanceof Element)) continue;
        if (element.id === BUTTON_ID || element.closest?.(`#${BUTTON_ID}`)) continue;
        if (element.matches?.(selector) || element.querySelector?.(selector)) return true;
      }
    }
    return false;
  }

  const observer = new MutationObserver((records) => {
    if (!document.hidden && mutationTouchesSearch(records)) scan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("focusin", (event) => {
    if (event.target?.matches?.(INPUT_SELECTOR)) bindInput(event.target);
  }, true);
  window.addEventListener("pageshow", scan);
  window.addEventListener("popstate", scan);
  window.addEventListener("hashchange", scan);
})();
