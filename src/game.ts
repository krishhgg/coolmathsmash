import { FixedLoop } from './engine/loop';
import { hashState } from './engine/hash';
import { KEYBOARD_BINDINGS } from './input/bindings';
import { padSlots, readGamepad } from './input/gamepad';
import { KeyboardState } from './input/keyboard';
import { mergeInputs, neutralInput, type InputFrame } from './input/types';
import type { Renderer } from './render/renderer';
import { DEFAULT_MATCH, createMatch, stepMatch, type MatchConfig, type MatchState } from './sim/match';
import type { SimEvent } from './sim/events';
import { encodeReplay } from './sim/replay';

/**
 * Owns the match, the device inputs and the loop. In manual mode (the capture harness) the loop only renders;
 * frames advance solely through `step`, so captures are reproducible.
 */
export class Game {
  state: MatchState;
  inputLog: InputFrame[][] = [];
  readonly keyboard = new KeyboardState();
  readonly loop: FixedLoop;
  private readonly eventListeners = new Set<(events: readonly SimEvent[], state: MatchState) => void>();

  constructor(
    readonly renderer: Renderer,
    public manual = false,
  ) {
    this.state = createMatch(DEFAULT_MATCH);
    this.loop = new FixedLoop({
      step: () => {
        if (!this.manual) this.step();
      },
      render: (alpha) => this.renderer.render(this.state, this.manual ? 1 : alpha),
    });
  }

  newMatch(config: MatchConfig = DEFAULT_MATCH): void {
    this.state = createMatch(config);
    this.inputLog = [];
  }

  readDeviceInputs(): InputFrame[] {
    const pads = padSlots();
    return this.state.players.map((p) => {
      const binding = KEYBOARD_BINDINGS[p.port];
      const keys = binding ? this.keyboard.read(binding) : neutralInput();
      const pad = pads[p.port];
      return pad ? mergeInputs(keys, readGamepad(pad)) : keys;
    });
  }

  step(inputs: InputFrame[] = this.readDeviceInputs()): void {
    const frame = inputs.map((i) => ({ x: i.x, y: i.y, cx: i.cx, cy: i.cy, buttons: i.buttons }));
    stepMatch(this.state, frame);
    this.renderer.stepCamera(this.state);
    this.renderer.stepHud(this.state);
    this.inputLog.push(frame);
    for (const listener of this.eventListeners) listener(this.state.events, this.state);
  }

  /**
   * Call `listener` after every simulated frame with that frame's events (see SimEvent), for audio, the HUD and
   * effects. Returns the unsubscribe function.
   */
  onEvents(listener: (events: readonly SimEvent[], state: MatchState) => void): () => void {
    this.eventListeners.add(listener);
    return () => void this.eventListeners.delete(listener);
  }

  hash(): string {
    return hashState(this.state);
  }

  replay(): string {
    return encodeReplay({ version: 1, config: this.state.config, frames: this.inputLog });
  }
}
