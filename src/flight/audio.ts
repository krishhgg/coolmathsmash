export function flightAudio() {
  let audio: AudioContext | undefined;
  let motor: OscillatorNode | undefined;
  let volume: GainNode | undefined;
  let enabled = false;

  return {
    async toggle() {
      if (!audio) {
        audio = new AudioContext();
        motor = audio.createOscillator();
        motor.type = 'triangle';
        motor.frequency.value = 34;
        volume = audio.createGain();
        volume.gain.value = 0;
        motor.connect(volume).connect(audio.destination);
        motor.start();
      }
      await audio.resume();
      enabled = !enabled;
      return enabled;
    },
    engine(speed: number, power: number) {
      if (!audio || !volume || !motor || audio.state !== 'running') return;
      motor.frequency.setTargetAtTime(34 + speed * 0.64 + power * 12, audio.currentTime, 0.1);
      volume.gain.setTargetAtTime(enabled ? power * 0.055 : 0, audio.currentTime, 0.06);
    },
    gate(final: boolean) {
      if (!audio || !enabled) return;
      const start = audio.currentTime;
      const frequencies = final ? [440, 587.33, 659.25] : [440, 587.33];
      frequencies.forEach((frequency, i) => {
        const chime = audio!.createOscillator();
        const envelope = audio!.createGain();
        const time = start + i * 0.072;
        chime.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(0.055, time + 0.017);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
        chime.connect(envelope).connect(audio!.destination);
        chime.start(time);
        chime.stop(time + 0.25);
      });
    },
  };
}
