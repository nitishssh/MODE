// Loaded only into the isolated stress-test server, never the normal app.
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const { appendFileSync } = require('node:fs');
if (process.env.STRESS_TELEMETRY) {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  let cpu = process.cpuUsage(), time = performance.now();
  setInterval(() => {
    const now = performance.now(), usage = process.cpuUsage();
    appendFileSync(process.env.STRESS_TELEMETRY, JSON.stringify({
      time: Date.now(), pid: process.pid,
      cpuOneCorePct: ((usage.user - cpu.user) + (usage.system - cpu.system)) / ((now - time) * 10),
      rssMiB: process.memoryUsage().rss / 1048576,
      heapMiB: process.memoryUsage().heapUsed / 1048576,
      eventLoopP95Ms: histogram.percentile(95) / 1e6,
      eventLoopMaxMs: histogram.max / 1e6,
    }) + '\n');
    cpu = usage; time = now; histogram.reset();
  }, 1000).unref();
}
