const fs = require("fs");

(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let pages;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      pages = await (await fetch("http://127.0.0.1:9339/json")).json();
      break;
    } catch {
      await wait(100);
    }
  }
  if (!pages) throw new Error("Browser debugging endpoint unavailable");
  const page = pages.find((entry) => entry.type === "page");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (!resolve) return;
    pending.delete(message.id);
    resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const metrics = () => evaluate(`(() => {
    const stage = document.querySelector('.game-stage').getBoundingClientRect();
    const person = document.querySelector('.drag-obstacle').getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      videoSource: [elements.video.videoWidth, elements.video.videoHeight],
      stage: [Math.round(stage.width), Math.round(stage.height)],
      person: [Math.round(person.width), Math.round(person.height)],
      center: [Math.round(person.left + person.width / 2), Math.round(person.top + person.height / 2)],
      position: app.position,
      preset: app.positionPreset,
    };
  })()`);

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:8771/index.html" });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate("document.readyState === 'complete' && typeof stopForObstacle === 'function'")) break;
    await wait(100);
  }
  await evaluate("setPhase('armed'); app.positionPreset = 'detected'; syncObstacleToVideo(); app.obstacleInside = true; stopForObstacle(); true");
  await wait(200);
  const large = await metrics();
  const largeShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync("verify_person_pc.png", Buffer.from(largeShot.data, "base64"));

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  const medium = await metrics();

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(300);
  const mobile = await metrics();
  console.log(JSON.stringify({ large, medium, mobile }, null, 2));
  socket.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
