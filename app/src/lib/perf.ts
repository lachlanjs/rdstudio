// Timings for benchmarks. With ?perf in the address, named steps are recorded
// as performance measures called "rd:<name>", which bench/run.py reads;
// otherwise nothing is recorded. The names are the contract with the benchmarks.

const PERF = typeof location !== "undefined" && new URLSearchParams(location.search).has("perf");

export function measure(name: string, start: number): void {
  if (PERF) performance.measure("rd:" + name, { start, end: performance.now() });
}

export function timed<T>(name: string, fn: () => T): T {
  if (!PERF) return fn();
  const start = performance.now();
  try { return fn(); } finally { measure(name, start); }
}
