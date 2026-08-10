export type GameSound = "move" | "capture" | "promotion" | "win" | "draw" | "click";

let audioContext: AudioContext | undefined;

function context(): AudioContext | undefined {
  if (typeof window === "undefined" || !("AudioContext" in window)) return undefined;
  audioContext ??= new AudioContext();
  return audioContext;
}

export function playGameSound(sound: GameSound, enabled = true): void {
  if (!enabled) return;
  const audio = context();
  if (!audio) return;
  void audio.resume();
  const patterns: Record<GameSound, readonly [number, number, number][]> = {
    click: [[420, 0, 0.035]],
    move: [[280, 0, 0.07], [360, 0.055, 0.08]],
    capture: [[190, 0, 0.08], [120, 0.06, 0.12]],
    promotion: [[420, 0, 0.08], [620, 0.07, 0.12], [840, 0.17, 0.16]],
    win: [[392, 0, 0.12], [523, 0.12, 0.12], [659, 0.24, 0.22]],
    draw: [[330, 0, 0.14], [294, 0.13, 0.2]],
  };
  const start = audio.currentTime;
  for (const [frequency, delay, duration] of patterns[sound]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = sound === "capture" ? "square" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.09, start + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + duration + 0.02);
  }
}
