
const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const createOscillator = (type: OscillatorType, freq: number, duration: number, vol: number = 0.1) => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
};

export const playPlayerMove = () => {
  // High pitched Sine blip
  createOscillator('sine', 880, 0.1, 0.1);
};

export const playBotMove = () => {
  // Low pitched Square thud
  createOscillator('square', 110, 0.15, 0.1);
};

export const playWin = () => {
  const ctx = initAudio();
  const now = ctx.currentTime;
  
  // Arpeggio
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0.1, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
};

export const playLose = () => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
  
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};

export const playDraw = () => {
  createOscillator('triangle', 200, 0.3, 0.1);
};

export const playTicker = () => {
  // Sharp, short, high-pitched tick
  createOscillator('square', 1200, 0.05, 0.05);
};

export const playPowerDown = () => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Rapid descending sweep
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.4);
};

export const playStamp = () => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Heavy thud
  osc.type = 'square';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.8, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

  // Add some noise or filter for impact (simulated with low freq square)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};