import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  GoogleAuthProvider,
  browserSessionPersistence,
  getAuth,
  getRedirectResult,
  setPersistence,
  signInWithRedirect
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const EXPECTED_EXTENSION_ID = "cpndheccadlhkiogcfdhagomiadbaogn";
const CONTEXT_KEY = "tdt_extension_google_auth_context_v3";
const AUTO_REDIRECT_KEY = "tdt_extension_google_auth_auto_redirect_v1";
const status = document.getElementById("status");
const loginButton = document.getElementById("googleLogin");
const cancelButton = document.getElementById("cancel");
const spinner = document.querySelector(".spinner");

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `status${type ? ` ${type}` : ""}`;
}

function cleanError(error) {
  const code = String(error?.code || "");
  if (code === "auth/operation-not-allowed") return "Google Sign-In chưa được bật trong Firebase Authentication.";
  if (code === "auth/unauthorized-domain") return "Tên miền Firebase chưa được cho phép đăng nhập.";
  if (code === "auth/network-request-failed") return "Không kết nối được Google/Firebase. Hãy kiểm tra mạng hoặc DNS.";
  if (code === "auth/redirect-cancelled-by-user") return "Quy trình đăng nhập đã bị hủy.";
  if (code === "auth/web-storage-unsupported") return "Trình duyệt đang chặn bộ nhớ cần thiết cho đăng nhập Google.";
  return [code, error?.message, error?.customData?.message].filter(Boolean).join(" · ").slice(0, 700)
    || "Đăng nhập Google thất bại.";
}

function readContext() {
  const params = new URLSearchParams(location.search);
  const queryContext = {
    extensionId: String(params.get("extensionId") || "").trim(),
    nonce: String(params.get("nonce") || "").trim().toLowerCase()
  };
  if (queryContext.extensionId === EXPECTED_EXTENSION_ID && /^[a-f0-9]{64}$/.test(queryContext.nonce)) {
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(queryContext));
    return queryContext;
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || "null");
    if (stored?.extensionId === EXPECTED_EXTENSION_ID && /^[a-f0-9]{64}$/.test(String(stored?.nonce || ""))) {
      return stored;
    }
  } catch (_error) { /* Hiển thị lỗi ổn định bên dưới. */ }
  throw new Error("Liên kết đăng nhập không hợp lệ. Hãy mở lại từ extension.");
}

function sendToExtension(context, payload) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      reject(new Error("Trang đăng nhập không kết nối được với extension. Hãy cài lại bản v2.20.0."));
      return;
    }
    chrome.runtime.sendMessage(
      context.extensionId,
      { type: "TDT_GOOGLE_AUTH_RESULT_V3", nonce: context.nonce, ...payload },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Extension từ chối kết quả đăng nhập."));
          return;
        }
        resolve(response);
      }
    );
  });
}

const app = initializeApp({
  projectId: "tran-duc-tai",
  appId: "1:215303379902:web:34face598b3e07157777ef",
  apiKey: "AIzaSyAvrLb6ncx64RwSbmXWPTp7GdnpgOju80s",
  authDomain: "tran-duc-tai.firebaseapp.com",
  messagingSenderId: "215303379902"
});
const auth = getAuth(app);
auth.languageCode = "vi";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
provider.addScope("email");
provider.addScope("profile");

async function completeRedirect(context) {
  await setPersistence(auth, browserSessionPersistence);
  const credential = await getRedirectResult(auth);
  if (!credential?.user) return false;
  const user = credential.user;
  const [idToken, tokenResult] = await Promise.all([
    user.getIdToken(true),
    user.getIdTokenResult()
  ]);
  const refreshToken = String(
    user.refreshToken
      || user.stsTokenManager?.refreshToken
      || credential?._tokenResponse?.refreshToken
      || ""
  );
  if (!idToken || !refreshToken || !user.uid) {
    throw new Error("Firebase không trả về phiên đăng nhập đầy đủ.");
  }
  await sendToExtension(context, {
    ok: true,
    idToken,
    refreshToken,
    uid: user.uid,
    expiresIn: Math.max(300, Math.floor((new Date(tokenResult.expirationTime).getTime() - Date.now()) / 1000)),
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    version: "2.2.4"
  });
  sessionStorage.removeItem(CONTEXT_KEY);
  sessionStorage.removeItem(AUTO_REDIRECT_KEY);
  if (spinner) spinner.hidden = true;
  setStatus(`Đăng nhập thành công${user.email ? `: ${user.email}` : ""}. Cửa sổ sẽ tự đóng.`, "success");
  loginButton.hidden = true;
  cancelButton.textContent = "Đóng";
  setTimeout(() => globalThis.close(), 900);
  return true;
}

async function beginGoogleRedirect(context) {
  sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  sessionStorage.setItem(AUTO_REDIRECT_KEY, context.nonce);
  loginButton.hidden = true;
  cancelButton.hidden = false;
  if (spinner) spinner.hidden = false;
  setStatus("Đang mở danh sách tài khoản Google…");
  await setPersistence(auth, browserSessionPersistence);
  await signInWithRedirect(auth, provider);
}

async function start() {
  let context;
  try {
    context = readContext();
    const completed = await completeRedirect(context);
    if (completed) {
      sessionStorage.removeItem(AUTO_REDIRECT_KEY);
      return;
    }

    const attemptedNonce = String(sessionStorage.getItem(AUTO_REDIRECT_KEY) || "");
    if (attemptedNonce === context.nonce) {
      sessionStorage.removeItem(AUTO_REDIRECT_KEY);
      throw new Error("Google chưa trả về phiên đăng nhập. Nhấn “Thử lại Google” để mở lại danh sách tài khoản.");
    }
    await beginGoogleRedirect(context);
  } catch (error) {
    const message = cleanError(error);
    if (spinner) spinner.hidden = true;
    setStatus(message, "error");
    loginButton.hidden = false;
    loginButton.disabled = false;
    loginButton.textContent = "Thử lại Google";
    try {
      if (context && !/Google chưa trả về phiên đăng nhập/.test(message)) {
        await sendToExtension(context, { ok: false, error: message, version: "2.2.4" });
      }
    } catch (_sendError) { /* Người dùng vẫn thấy lỗi trên trang. */ }
  }
}

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true;
  try {
    await beginGoogleRedirect(readContext());
  } catch (error) {
    loginButton.disabled = false;
    loginButton.hidden = false;
    const message = cleanError(error);
    if (spinner) spinner.hidden = true;
    setStatus(message, "error");
    try { await sendToExtension(readContext(), { ok: false, error: message, version: "2.2.4" }); } catch (_sendError) {}
  }
});

cancelButton.addEventListener("click", () => globalThis.close());
void start();
