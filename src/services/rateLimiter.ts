/**
 * Control de ritmo: deja pasar como máximo `max` llamadas por ventana de
 * `windowMs`. Las que sobran esperan en cola, en orden de llegada.
 *
 *   const porSegundo = createRateLimiter(1, 1000);
 *   await porSegundo.schedule(() => fetch(url));
 *   // 3 llamadas seguidas salen a los 0 s, 1 s y 2 s.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const sent: number[] = []; // instantes de las últimas llamadas
  let queue: Promise<unknown> = Promise.resolve();

  async function waitTurn() {
    for (;;) {
      const now = Date.now();
      while (sent.length && now - sent[0] >= windowMs) sent.shift();
      if (sent.length < max) {
        sent.push(now);
        return;
      }
      await new Promise((r) => setTimeout(r, windowMs - (now - sent[0]) + 5));
    }
  }

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      const run = queue.then(waitTurn).then(task);
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
