(() => {
  "use strict";

  const loginButton = document.getElementById("googleLogin");
  const status = document.getElementById("status");
  const openTikTok = document.getElementById("openTikTok");

  function runtimeMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Extension không phản hồi."));
          return;
        }
        resolve(response);
      });
    });
  }

  function render(response) {
    const signedIn = response?.auth?.signedIn === true;
    const allowed = response?.state?.allowed === true;
    status.classList.toggle("ok", signedIn && allowed);
    status.classList.toggle("error", !signedIn || !allowed);
    if (!signedIn) {
      status.textContent = response?.state?.reason || "Đăng nhập Google để kích hoạt Extension.";
      loginButton.hidden = false;
      openTikTok.hidden = true;
      return;
    }
    loginButton.hidden = true;
    openTikTok.hidden = false;
    status.textContent = allowed
      ? "Đăng nhập thành công. Extension đã sẵn sàng."
      : (response?.state?.reason || "Tài khoản đã đăng nhập nhưng chưa được cấp quyền.");
  }

  async function refresh() {
    try {
      render(await runtimeMessage({ type: "AUTH_STATUS_GET" }));
    } catch (error) {
      status.className = "status error";
      status.textContent = error?.message || "Không đọc được trạng thái đăng nhập.";
    }
  }

  loginButton?.addEventListener("click", async () => {
    loginButton.disabled = true;
    loginButton.textContent = "Đang mở Google…";
    status.className = "status";
    status.textContent = "Hoàn tất đăng nhập trong cửa sổ Google.";
    try {
      render(await runtimeMessage({ type: "AUTH_GOOGLE_SIGN_IN" }));
    } catch (error) {
      status.className = "status error";
      status.textContent = error?.message || "Đăng nhập Google thất bại.";
    } finally {
      loginButton.disabled = false;
      loginButton.innerHTML = "<span>G</span> Đăng nhập bằng Google";
    }
  });

  void refresh();
})();
