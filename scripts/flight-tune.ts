import { baseline, createFlight, neutralInput, stepFlight, stepTime, tune } from '../src/flight/model.ts';
import type { Input, Tune } from '../src/flight/model.ts';

const candidates: [keyof Tune, number, number, number][] = [
  ['motor', 0.28, 1.5, 3.8],
  ['stop', 0.5, 2.75, 6.5],
  ['steering', 0.75, 4, 14],
  ['joint', 1.1, 6, 17],
  ['bank', 0.055, 0.34, 0.65],
];

function measure(settings: Tune) {
  const flight = createFlight();
  flight.position.set(0, 100, -400);
  const throttle = { ...neutralInput, thrust: 1 };
  const brake = { ...neutralInput, brake: true };
  const turn = { ...throttle, turn: 1 };
  const speed = () => Math.hypot(flight.velocity.x, flight.velocity.z);
  const run = (input: Input, frames: number) => {
    for (let i = 0; i < frames; i++) stepFlight(flight, input, stepTime, settings);
  };
  const until = (input: Input, condition: () => boolean) => {
    for (let i = 0; i < 360; i++) {
      if (condition()) return i * stepTime;
      run(input, 1);
    }
    return 3;
  };

  run(neutralInput, 120);
  const launchSeconds = until(throttle, () => speed() >= 38 * 0.9);
  run(throttle, 180);
  const brakePosition = flight.position.z;
  const brakeSeconds = until(brake, () => speed() < 38 * 0.1);
  const brakeMeters = flight.position.z - brakePosition;

  run(throttle, 240);
  const turnSeconds = until(turn, () => flight.yawRate >= 1.31 * 0.9);
  run(turn, 84);
  const bankDegrees = (Math.abs(flight.bank.angle) * 180) / Math.PI;
  const arm = flight.arms[0]!;
  const levelElbow = 0.22 + 0.39 * (1 - 38 / 50);
  const armReturnSeconds = until(
    throttle,
    () =>
      Math.abs(arm.elbow.angle - levelElbow) < 0.07 &&
      Math.abs(arm.shoulder.speed) < 0.4 &&
      Math.abs(flight.bank.angle) < 0.11,
  );
  let elbowTravel = 0;
  for (let i = 0; i < 96; i++) {
    const prior = arm.elbow.angle;
    run(i < 48 ? brake : throttle, 1);
    elbowTravel = Math.max(elbowTravel, Math.abs(arm.elbow.angle - prior) / stepTime);
  }
  return {
    launchSeconds,
    brakeSeconds,
    brakeMeters,
    turnSeconds,
    bankDegrees,
    armReturnSeconds,
    elbowTravel,
  };
}

function score(settings: Tune) {
  const metrics = measure(settings);
  // Aim for visible weight in the launch and bank while retaining a short braking distance.
  return (
    ((metrics.launchSeconds - 0.95) / 0.24) ** 2 +
    ((metrics.brakeSeconds - 0.54) / 0.13) ** 2 +
    (Math.max(0, metrics.brakeMeters - 9) / 3) ** 2 +
    ((metrics.turnSeconds - 0.25) / 0.11) ** 2 +
    ((metrics.bankDegrees - 28) / 6) ** 2 +
    ((metrics.armReturnSeconds - 0.4) / 0.15) ** 2 +
    (Math.max(0, metrics.elbowTravel - 3.3) / 1.1) ** 2
  );
}

let selected: Tune = { ...baseline };
let penalty = score(selected);
const report = (pass: string) => {
  const metrics = Object.fromEntries(
    Object.entries(measure(selected)).map(([name, value]) => [name, Number(value.toFixed(3))]),
  );
  console.log(pass, { penalty: Number(penalty.toFixed(3)), ...metrics });
};
report('Baseline');

for (const scale of [1, 0.65, 0.36, 0.18]) {
  for (const [key, step, low, high] of candidates) {
    for (const direction of [-1, 1]) {
      const candidate = { ...selected, [key]: Number((selected[key] + step * scale * direction).toFixed(4)) };
      if (candidate[key] < low || candidate[key] > high) continue;
      const result = score(candidate);
      if (result < penalty) {
        selected = candidate;
        penalty = result;
      }
    }
  }
  report(`Pass ${scale}`);
}
console.log('Selected', selected);
if (
  process.argv.includes('--check') &&
  Object.keys(selected).some((key) => selected[key as keyof Tune] !== tune[key as keyof Tune])
) {
  console.error('The shipped tuning differs from the selected settings.');
  process.exitCode = 1;
}
