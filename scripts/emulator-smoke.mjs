import assert from "node:assert/strict";

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const databaseHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const projectId = process.env.GCLOUD_PROJECT || "demo-tdt-firebase-control";
const namespace = `${projectId}-default-rtdb`;

async function waitFor(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { await fetch(url); return; } catch { /* Emulator is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Emulator chưa sẵn sàng: ${url}`);
}

await Promise.all([
  waitFor(`http://${authHost}/`),
  waitFor(`http://${databaseHost}/.json?ns=${namespace}`),
  waitFor(`http://${firestoreHost}/`)
]);

const authResponse = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ returnSecureToken: true })
});
assert.equal(authResponse.ok, true);
const auth = await authResponse.json();
assert.ok(auth.idToken);
assert.ok(auth.localId);

const databaseUrl = (path, token = "") => {
  const query = new URLSearchParams({ ns: namespace });
  if (token) query.set("auth", token);
  return `http://${databaseHost}/${path.replace(/^\/+/, "")}.json?${query}`;
};

let response = await fetch(databaseUrl("settings"));
assert.ok([401, 403].includes(response.status), `Unauthenticated settings read returned ${response.status}`);

response = await fetch(databaseUrl("settings", auth.idToken));
assert.equal(response.ok, true);

response = await fetch(databaseUrl("settings", auth.idToken), {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "open" })
});
assert.ok([401, 403].includes(response.status), `Client settings write returned ${response.status}`);

const ownerHeaders = { "Content-Type": "application/json", Authorization: "Bearer owner" };
response = await fetch(databaseUrl("settings"), {
  method: "PUT",
  headers: ownerHeaders,
  body: JSON.stringify({ mode: "whitelist", message: "", updatedAt: Date.now() })
});
assert.equal(response.ok, true);
response = await fetch(databaseUrl(`access/${auth.localId}`), {
  method: "PUT",
  headers: ownerHeaders,
  body: JSON.stringify({ locked: false, listState: "whitelist", updatedAt: Date.now() })
});
assert.equal(response.ok, true);

response = await fetch(databaseUrl(`access/${auth.localId}`, auth.idToken));
assert.equal(response.ok, true);
const ownAccess = await response.json();
assert.equal(ownAccess.listState, "whitelist");

response = await fetch(databaseUrl("access/someone-else", auth.idToken));
assert.ok([401, 403].includes(response.status), `Cross-UID read returned ${response.status}`);

const firestoreResponse = await fetch(`http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/users/${auth.localId}`, {
  headers: { Authorization: `Bearer ${auth.idToken}` }
});
assert.ok([401, 403].includes(firestoreResponse.status), `Client Firestore read returned ${firestoreResponse.status}`);

const streamController = new AbortController();
const streamResponse = await fetch(databaseUrl(`access/${auth.localId}`, auth.idToken), {
  headers: { Accept: "text/event-stream" },
  signal: streamController.signal
});
assert.equal(streamResponse.ok, true);
const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

const lockEvent = new Promise(async (resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Không nhận được realtime lock trong 5 giây.")), 5000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error("Realtime stream đóng sớm.");
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
        if (dataLine) {
          const payload = JSON.parse(dataLine.slice(5).trim());
          if (payload?.data?.locked === true) {
            clearTimeout(timeout);
            resolve(payload);
            return;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    clearTimeout(timeout);
    reject(error);
  }
});

response = await fetch(databaseUrl(`access/${auth.localId}`), {
  method: "PUT",
  headers: ownerHeaders,
  body: JSON.stringify({ locked: true, listState: "whitelist", updatedAt: Date.now() })
});
assert.equal(response.ok, true);
await lockEvent;
streamController.abort();

console.log("OK: Firebase Auth UID + RTDB rules + UID isolation + Firestore deny rules + realtime lock SSE");
