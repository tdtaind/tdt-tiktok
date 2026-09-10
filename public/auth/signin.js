import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const EXPECTED_EXTENSION_ORIGIN = "chrome-extension://cpndheccadlhkiogcfdhagomiadbaogn";
const PARENT_FRAME_ORIGIN = document.location.ancestorOrigins?.[0] || EXPECTED_EXTENSION_ORIGIN;
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

let signInInFlight = null;

function isAllowedParent(origin) {
  return origin === EXPECTED_EXTENSION_ORIGIN && PARENT_FRAME_ORIGIN === EXPECTED_EXTENSION_ORIGIN;
}

function send(payload) {
  globalThis.parent.postMessage({ namespace: "tdt-google-auth", ...payload }, PARENT_FRAME_ORIGIN);
}

function describeAuthError(error) {
  const code = String(error?.code || "");
  if (code === "auth/popup-closed-by-user") return "Bạn đã đóng cửa sổ đăng nhập Google.";
  if (code === "auth/popup-blocked") return "Chrome đã chặn cửa sổ đăng nhập Google. Hãy cho phép cửa sổ bật lên rồi thử lại.";
  if (code === "auth/unauthorized-domain") return "Firebase chưa cho phép Extension ID này trong Authorized domains.";
  if (code === "auth/operation-not-allowed") return "Google Sign-In chưa được bật trong Firebase Authentication.";
  if (code === "auth/network-request-failed") return "Không thể kết nối Google/Firebase. Hãy kiểm tra mạng hoặc DNS rồi thử lại.";
  if (code === "auth/internal-error") return "Firebase Auth gặp lỗi nội bộ. Hãy kiểm tra Authorized domains và cấu hình Google provider.";
  return [code, error?.message, error?.customData?.message, error?.cause?.message]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 700) || "Đăng nhập Google thất bại.";
}

const authReady = setPersistence(auth, inMemoryPersistence)
  .then(() => {
    send({ action: "ready", ok: true, version: "2.2.4" });
  })
  .catch((error) => {
    send({ action: "ready", ok: false, error: describeAuthError(error), version: "2.2.4" });
    throw error;
  });

async function runGoogleSignIn() {
  await authReady;
  const credential = await signInWithPopup(auth, provider);
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
  return {
    action: "result",
    ok: true,
    idToken,
    refreshToken,
    uid: user.uid,
    expiresIn: Math.max(
      300,
      Math.floor((new Date(tokenResult.expirationTime).getTime() - Date.now()) / 1000)
    ),
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    version: "2.2.4"
  };
}

globalThis.addEventListener("message", async (event) => {
  if (!isAllowedParent(event.origin) || event.source !== globalThis.parent) return;
  if (event.data?.namespace !== "tdt-google-auth" || event.data?.action !== "sign-in") return;

  if (!signInInFlight) {
    signInInFlight = runGoogleSignIn().finally(() => {
      signInInFlight = null;
    });
  }

  try {
    send(await signInInFlight);
  } catch (error) {
    send({ action: "result", ok: false, error: describeAuthError(error), version: "2.2.4" });
  }
});
