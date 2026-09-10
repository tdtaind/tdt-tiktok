process.env.GCLOUD_PROJECT ||= "tran-duc-tai";
process.env.GOOGLE_CLOUD_PROJECT ||= "tran-duc-tai";
process.env.FIREBASE_CONFIG ||= JSON.stringify({
  projectId: "tran-duc-tai",
  databaseURL: "https://tran-duc-tai-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "tran-duc-tai.firebasestorage.app"
});

try {
  const module = await import("../index.js");
  if (typeof module.api !== "function") throw new Error("Không tìm thấy export api.");
  console.log("Functions preflight OK: api đã nạp đầy đủ Firestore, Storage và Firebase Admin.");
} catch (error) {
  console.error("Functions preflight FAILED:");
  console.error(error?.stack || error);
  process.exitCode = 1;
}
