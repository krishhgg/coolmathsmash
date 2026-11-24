export const SIM_HZ = 60;
export const FRAME_MS = 1000 / SIM_HZ;

export interface LoopHooks {
  step(): void;
  render(alpha: number): void;
}

/**
 * Fixed-timestep driver: the simulation advances in whole 1/60 s frames, rendering interpolates between
 * the last two simulated frames with `alpha` in [0, 1). Rendering never changes simulation state.
 */
export class FixedLoop {
  private accumulator = 0;
  private last = -1;
  private handle = 0;
  running = false;

  constructor(
    private readonly hooks: LoopHooks,
    private readonly maxStepsPerTick = 5,
  ) {}

  tick(nowMs: number): number {
    if (this.last < 0) this.last = nowMs;
    const elapsed = Math.min(nowMs - this.last, 250);
    this.last = nowMs;
    this.accumulator += elapsed;
    let steps = 0;
    while (this.accumulator >= FRAME_MS && steps < this.maxStepsPerTick) {
      this.hooks.step();
      this.accumulator -= FRAME_MS;
      steps++;
    }
    if (steps === this.maxStepsPerTick && this.accumulator >= FRAME_MS) this.accumulator = 0;
    this.hooks.render(this.accumulator / FRAME_MS);
    return steps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    const frame = (t: number) => {
      if (!this.running) return;
      this.tick(t);
      this.handle = requestAnimationFrame(frame);
    };
    this.handle = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }
}
