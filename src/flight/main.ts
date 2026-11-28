import * as T from 'three';
import { flightAudio } from './audio';
import { makeChase, updateChase } from './camera';
import { gates, throughGate } from './course';
import { createFlight, damp, neutralInput, stepFlight, stepTime } from './model';
import { makeSuit } from './suit';
import { makeWorld } from './world';
import './style.css';

function get<E extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as E;
}

function boot() {
  const canvas = get('scene');
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(54, 1, 0.065, 1600);
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  canvas.append(renderer.domElement);

  const world = makeWorld(scene);
  const suit = makeSuit(scene);
  const sound = flightAudio();
  const brief = get('brief');
  const title = get('title');
  const intro = get('intro');
  const action = get<HTMLButtonElement>('launch');
  const display = get('hud');
  const route = get('route');
  const clock = get('time');
  const record = get('best');
  const marker = get('marker');
  const meter = get('meters');
  const arrow = get('marker-arrow');
  const notice = get('notice');
  const touch = get('touch');
  const keys = new Set<string>();
  const pointers = new Map<number, string>();
  const bindings = {
    thrust: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    climb: ['Space'],
    descend: ['KeyC'],
    boost: ['ShiftLeft', 'ShiftRight'],
  };
  const gameKeys = new Set(Object.values(bindings).flat());
  const previous = new T.Vector3();
  const projected = new T.Vector3();
  const cameraSpace = new T.Vector3();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  let flight = createFlight();
  let chase = makeChase();
  let mode: 'ready' | 'running' | 'finish' = 'ready';
  let gate = 0;
  let elapsed = 0;
  let blend = 0;
  let power = 0;
  let frameTime = 0;
  let slowFrames = 0;
  let resolution = 1;
  let accumulator = 0;
  let noticeUntil = 0;
  let reportedImpact = -10;
  let best = readBest();

  function resize() {
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65) * resolution);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  function start() {
    const first = mode === 'ready';
    flight = createFlight();
    chase = makeChase();
    for (let tick = 0; tick < 120; tick++) stepFlight(flight, neutralInput, stepTime);
    accumulator = 0;
    elapsed = 0;
    gate = 0;
    blend = first && !reduceMotion.matches ? 0 : 1;
    power = 0;
    noticeUntil = 0;
    reportedImpact = -10;
    notice.textContent = '';
    marker.hidden = false;
    mode = 'running';
    brief.hidden = true;
    canvas.parentElement!.classList.add('in-flight');
    display.hidden = false;
    touch.hidden = !coarsePointer.matches;
    updateChase(chase, flight, 0, blend);
    suit.update(flight, 0, 0, 0, 1 - blend);
  }

  function finish() {
    mode = 'finish';
    const personalBest = best === undefined || elapsed < best;
    if (personalBest) {
      best = elapsed;
      try {
        localStorage.setItem('slipstream.harbor.best', String(best));
      } catch {
        // The current session still tracks the best run if storage is disabled.
      }
    }
    title.textContent = formatTime(elapsed);
    title.classList.add('result');
    intro.textContent = personalBest ? 'Personal best. All seven gates cleared.' : 'All seven gates cleared.';
    action.firstChild!.textContent = 'Fly again ';
    brief.hidden = false;
    canvas.parentElement!.classList.remove('in-flight');
    marker.hidden = true;
    notice.textContent = 'Course complete';
    touch.hidden = true;
    action.focus({ preventScroll: true });
  }

  action.addEventListener('click', start);
  get('touch-reset').addEventListener('click', start);
  const soundButton = get<HTMLButtonElement>('sound');
  soundButton.addEventListener('click', () => void toggleSound());

  async function toggleSound() {
    soundButton.disabled = true;
    try {
      const enabled = await sound.toggle();
      soundButton.setAttribute('aria-pressed', String(enabled));
      soundButton.textContent = enabled ? 'Sound on' : 'Sound off';
    } catch {
      soundButton.textContent = 'Sound unavailable';
    } finally {
      soundButton.disabled = false;
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.altKey || event.ctrlKey) return;
    if (
      event.code === 'Enter' &&
      mode !== 'running' &&
      !event.repeat &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      start();
      return;
    }
    if (mode !== 'running' || (event.code === 'Space' && event.target instanceof HTMLButtonElement)) return;
    if (event.code === 'KeyR' && !event.repeat) start();
    if (!gameKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointers.clear();
  });
  for (const button of touch.querySelectorAll<HTMLButtonElement>('button[data-key]')) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.key!);
    });
    button.addEventListener('lostpointercapture', (event) => pointers.delete(event.pointerId));
  }

  function drawHud() {
    const target = gates[gate];
    route.textContent = target ? `GATE ${String(gate + 1).padStart(2, '0')} / 07` : '7 / 7 CLEARED';
    clock.textContent = formatTime(elapsed);
    record.textContent = best === undefined ? '' : `BEST ${formatTime(best)}`;
    get('speed').textContent = String(Math.round(Math.hypot(flight.velocity.x, flight.velocity.z) * 3.6));
    get('altitude').textContent = String(Math.round(flight.position.y));
    if (!target || mode !== 'running') return;
    cameraSpace.copy(target.position).applyMatrix4(camera.matrixWorldInverse);
    const behind = cameraSpace.z > 0;
    projected.copy(target.position).project(camera);
    const offscreen = behind || Math.abs(projected.x) > 0.9 || Math.abs(projected.y) > 0.76;
    if (behind) {
      projected.x = Math.sign(cameraSpace.x || 1) * 0.91;
      projected.y = 0.06;
    }
    const x = T.MathUtils.clamp(projected.x, -0.89, 0.89);
    const y = T.MathUtils.clamp(projected.y, -0.72, 0.74);
    marker.style.left = `${50 + x * 50}%`;
    marker.style.top = `${50 - y * 50}%`;
    marker.classList.toggle('offscreen', offscreen);
    arrow.style.rotate = `${Math.atan2(x, y)}rad`;
    meter.textContent = offscreen
      ? `${target.name} · ${Math.round(flight.position.distanceTo(target.position))} m`
      : `${Math.round(flight.position.distanceTo(target.position))} m`;
  }

  function frame(ms: number) {
    const frameSeconds = (ms - (frameTime || ms)) * 0.001;
    const dt = Math.min(frameSeconds, 0.12);
    slowFrames = frameSeconds > 0.035 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames >= 12 && resolution > 0.61) {
      resolution *= 0.83;
      slowFrames = 0;
      resize();
    }
    frameTime = ms;
    const down = (list: string[]) =>
      list.some((code) => keys.has(code) || [...pointers.values()].includes(code));
    const boost = down(bindings.boost);
    const input =
      mode !== 'running'
        ? neutralInput
        : {
            turn: Number(down(bindings.left)) - Number(down(bindings.right)),
            lift: Number(down(bindings.climb)) - Number(down(bindings.descend)),
            thrust: Number(down(bindings.thrust) || boost),
            brake: down(bindings.brake),
            boost,
          };
    if (mode !== 'ready') {
      accumulator += dt;
      while (accumulator >= stepTime) {
        accumulator -= stepTime;
        previous.copy(flight.position);
        const hit = stepFlight(
          flight,
          mode === 'running' ? input : { ...neutralInput, brake: true },
          stepTime,
        );
        if (mode !== 'running') continue;
        elapsed += stepTime;
        if (hit && elapsed - reportedImpact > 0.5) {
          reportedImpact = elapsed;
          notice.textContent = 'Contact · thrust interrupted';
          noticeUntil = elapsed + 1.25;
        }
        if (throughGate(previous, flight.position, gate)) {
          gate++;
          sound.gate(gate === gates.length);
          if (gate === gates.length) finish();
          else {
            notice.textContent = `${gates[gate - 1]!.name} cleared`;
            noticeUntil = elapsed + 1.2;
          }
        }
      }
      if (mode === 'running' && elapsed > noticeUntil && notice.textContent) notice.textContent = '';
      blend = Math.min(1, blend + dt * 1.4);
    }

    const speed = Math.hypot(flight.velocity.x, flight.velocity.z);
    power = damp(
      power,
      mode === 'running' ? Math.min(1, 0.09 + speed / 110 + input.thrust * 0.34 + Number(boost) * 0.22) : 0,
      9,
      dt,
    );
    suit.update(flight, ms * 0.001, dt, power, (1 - blend) ** 2);
    updateChase(chase, flight, dt, blend);
    camera.position.copy(chase.position);
    camera.lookAt(chase.look);
    if (!reduceMotion.matches) camera.rotateZ(chase.roll);
    camera.fov = reduceMotion.matches ? 54 : chase.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    world.backdrop.position.copy(camera.position);
    world.updateGates(gate, ms * 0.001);
    sound.engine(speed, power);
    if (mode !== 'ready') drawHud();
    renderer.render(scene, camera);
  }

  for (let tick = 0; tick < 120; tick++) stepFlight(flight, neutralInput, stepTime);
  updateChase(chase, flight, 0, 0);
  resize();
  renderer.setAnimationLoop(frame);
}

function formatTime(seconds: number) {
  const hundredths = Math.floor(seconds * 100 + 0.00001);
  const parts = [Math.floor(hundredths / 6000), Math.floor(hundredths / 100) % 60, hundredths % 100].map(
    (value) => String(value).padStart(2, '0'),
  );
  return `${parts[0]}:${parts[1]}.${parts[2]}`;
}

function readBest(): number | undefined {
  try {
    const best = Number(localStorage.getItem('slipstream.harbor.best'));
    return best > 0 && Number.isFinite(best) ? best : undefined;
  } catch {
    return undefined;
  }
}

try {
  boot();
} catch (error) {
  console.error(error);
  get('intro').textContent =
    'The 3D scene could not start. Check that your browser supports WebGL 2 and has graphics acceleration enabled.';
  get<HTMLButtonElement>('launch').disabled = true;
  get<HTMLButtonElement>('sound').disabled = true;
}
