/**
 * SpinDemo Sound Effects - Web Audio API
 * テクノロジー感・没入感MAXの効果音システム
 */

// AudioContext singleton
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

// ===== UTILITY FUNCTIONS =====

const createOscillator = (
  ctx: AudioContext,
  type: OscillatorType,
  frequency: number,
  startTime: number,
  duration: number,
  gainValue: number = 0.3
): { osc: OscillatorNode; gain: GainNode } => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
  return { osc, gain };
};

const createNoise = (ctx: AudioContext, duration: number, startTime: number, gainValue: number = 0.1): GainNode => {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  noise.connect(gain);
  gain.connect(ctx.destination);
  noise.start(startTime);
  return gain;
};

// ===== SOUND EFFECTS =====

/**
 * ルーレット回転開始音 - テクノ風ライジングサウンド
 * シュワーッと上昇する未来的な音
 */
export const playSpinStart = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Rising sweep
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(100, now);
  osc1.frequency.exponentialRampToValueAtTime(800, now + 0.5);
  gain1.gain.setValueAtTime(0.15, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.6);
  
  // High sparkle
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2000, now + 0.3);
  osc2.frequency.exponentialRampToValueAtTime(4000, now + 0.5);
  gain2.gain.setValueAtTime(0.1, now + 0.3);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.3);
  osc2.stop(now + 0.6);
  
  // Sub bass thump
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(60, now);
  gain3.gain.setValueAtTime(0.3, now);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.start(now);
  osc3.stop(now + 0.3);
};

/**
 * ルーレットティック音 - 回転中のクリック音
 * @param speed 0-1 (1が最速、0が最遅)
 */
export const playTick = (speed: number = 1): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Pitch varies with speed
  const baseFreq = 800 + speed * 400;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.03);
  gain.gain.setValueAtTime(0.08 + speed * 0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
  
  // Click noise
  createNoise(ctx, 0.02, now, 0.03);
};

/**
 * ルーレット停止・当選ファンファーレ - 壮大な勝利サウンド
 */
export const playWinFanfare = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Major chord arpeggio (C-E-G-C)
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  notes.forEach((freq, i) => {
    const delay = i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.2, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.8);
  });
  
  // Brass-like sustained chord
  [523.25, 659.25, 783.99].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + 0.4);
    gain.gain.setValueAtTime(0.08, now + 0.4);
    gain.gain.setValueAtTime(0.08, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.4);
    osc.stop(now + 2.0);
  });
  
  // Shimmer effect
  for (let i = 0; i < 8; i++) {
    const delay = 0.5 + i * 0.1;
    const freq = 2000 + Math.random() * 2000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.03, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.3);
  }
  
  // Impact bass
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(80, now);
  bass.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  bassGain.gain.setValueAtTime(0.4, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  bass.connect(bassGain);
  bassGain.connect(ctx.destination);
  bass.start(now);
  bass.stop(now + 0.5);
};

/**
 * 超大当たりファンファーレ - SUPER JACKPOT用
 */
export const playSuperJackpot = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Epic rising sweep
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(50, now);
  sweep.frequency.exponentialRampToValueAtTime(400, now + 0.8);
  sweepGain.gain.setValueAtTime(0.15, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  sweep.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweep.start(now);
  sweep.stop(now + 1.0);
  
  // Massive chord hit
  const chordFreqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
  chordFreqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + 0.8);
    gain.gain.setValueAtTime(0.12, now + 0.8);
    gain.gain.setValueAtTime(0.1, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.8);
    osc.stop(now + 3.0);
  });
  
  // Sparkle cascade
  for (let i = 0; i < 20; i++) {
    const delay = 0.8 + i * 0.08;
    const freq = 1500 + Math.random() * 3000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.04, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.4);
  }
  
  // Deep impact
  const impact = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impact.type = 'sine';
  impact.frequency.setValueAtTime(100, now + 0.8);
  impact.frequency.exponentialRampToValueAtTime(30, now + 1.3);
  impactGain.gain.setValueAtTime(0.5, now + 0.8);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  impact.connect(impactGain);
  impactGain.connect(ctx.destination);
  impact.start(now + 0.8);
  impact.stop(now + 1.5);
  
  // Noise burst
  createNoise(ctx, 0.3, now + 0.8, 0.15);
};

/**
 * 紙吹雪・花火音 - キラキラポップ音
 */
export const playConfetti = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Multiple sparkle pops
  for (let i = 0; i < 15; i++) {
    const delay = i * 0.05 + Math.random() * 0.1;
    const freq = 1000 + Math.random() * 2000;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + delay + 0.1);
    gain.gain.setValueAtTime(0.05, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.15);
  }
  
  // Soft noise pops
  for (let i = 0; i < 5; i++) {
    const delay = i * 0.1;
    createNoise(ctx, 0.05, now + delay, 0.02);
  }
};

/**
 * 花火爆発音
 */
export const playFirework = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Launch whistle
  const whistle = ctx.createOscillator();
  const whistleGain = ctx.createGain();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(400, now);
  whistle.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
  whistleGain.gain.setValueAtTime(0.08, now);
  whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  whistle.connect(whistleGain);
  whistleGain.connect(ctx.destination);
  whistle.start(now);
  whistle.stop(now + 0.35);
  
  // Explosion
  createNoise(ctx, 0.4, now + 0.3, 0.2);
  
  // Sparkle trails
  for (let i = 0; i < 10; i++) {
    const delay = 0.35 + i * 0.05;
    const freq = 800 + Math.random() * 1500;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.03, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.2);
  }
};

/**
 * 数字カウントアップ音 - デジタルカウンター
 */
export const playCountUp = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.setValueAtTime(1400, now + 0.02);
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
};

/**
 * カウントアップ完了音
 */
export const playCountUpComplete = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Ascending notes
  [800, 1000, 1200, 1600].forEach((freq, i) => {
    const delay = i * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.1, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.15);
  });
};

/**
 * ボタンクリック音 - テクノ風タップ
 */
export const playButtonClick = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
  
  // Click noise
  createNoise(ctx, 0.02, now, 0.05);
};

/**
 * 画面遷移音 - シュワッとしたトランジション
 */
export const playTransition = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Swoosh
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.35);
  
  // Noise swoosh
  createNoise(ctx, 0.2, now, 0.08);
};

/**
 * お祝い演出音 - 招待完了セレブレーション
 */
export const playCelebration = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Cheerful melody
  const melody = [523.25, 659.25, 783.99, 1046.50];
  melody.forEach((freq, i) => {
    const delay = i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.15, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.3);
  });
  
  // Sparkles
  for (let i = 0; i < 8; i++) {
    const delay = 0.4 + i * 0.06;
    const freq = 1500 + Math.random() * 1500;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.04, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.2);
  }
};

/**
 * 背景アンビエント音 - 低いドローン・期待感
 * @returns stop function
 */
export const playAmbient = (): (() => void) => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Deep drone
  const drone = ctx.createOscillator();
  const droneGain = ctx.createGain();
  drone.type = 'sine';
  drone.frequency.setValueAtTime(55, now);
  droneGain.gain.setValueAtTime(0.08, now);
  drone.connect(droneGain);
  droneGain.connect(ctx.destination);
  drone.start(now);
  
  // Subtle shimmer LFO
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.5, now);
  lfoGain.gain.setValueAtTime(5, now);
  lfo.connect(lfoGain);
  lfoGain.connect(drone.frequency);
  lfo.start(now);
  
  // High shimmer
  const shimmer = ctx.createOscillator();
  const shimmerGain = ctx.createGain();
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(880, now);
  shimmerGain.gain.setValueAtTime(0.015, now);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(ctx.destination);
  shimmer.start(now);
  
  return () => {
    const stopTime = ctx.currentTime;
    droneGain.gain.exponentialRampToValueAtTime(0.001, stopTime + 0.5);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, stopTime + 0.5);
    setTimeout(() => {
      drone.stop();
      lfo.stop();
      shimmer.stop();
    }, 600);
  };
};

/**
 * ラウンド進化音 - 次のラウンドへ
 */
export const playRoundUp = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Power up sweep
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(200, now);
  sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
  sweepGain.gain.setValueAtTime(0.1, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sweep.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweep.start(now);
  sweep.stop(now + 0.5);
  
  // Chime
  [659.25, 783.99, 987.77].forEach((freq, i) => {
    const delay = 0.3 + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.12, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.4);
  });
};

/**
 * カウントダウン音 - 3...2...1... の各ビート
 * @param num 3, 2, or 1
 */
export const playCountdown = (num: number): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Higher pitch as countdown progresses
  const baseFreq = num === 3 ? 440 : num === 2 ? 554 : 659;
  
  // Main tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
  
  // Sub harmonic
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(baseFreq / 2, now);
  subGain.gain.setValueAtTime(0.15, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  sub.connect(subGain);
  subGain.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.25);
  
  // Impact
  createNoise(ctx, 0.05, now, 0.08);
};

/**
 * カウントダウン完了 GO! 音 - 壮大な開始サウンド
 */
export const playCountdownGo = (): void => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Epic rising sweep
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(200, now);
  sweep.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
  sweepGain.gain.setValueAtTime(0.2, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sweep.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweep.start(now);
  sweep.stop(now + 0.5);
  
  // Major chord burst
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + 0.1);
    gain.gain.setValueAtTime(0.15, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.1);
    osc.stop(now + 0.8);
  });
  
  // Bass impact
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(80, now);
  bass.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  bassGain.gain.setValueAtTime(0.4, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  bass.connect(bassGain);
  bassGain.connect(ctx.destination);
  bass.start(now);
  bass.stop(now + 0.5);
  
  // Sparkle cascade
  for (let i = 0; i < 10; i++) {
    const delay = 0.1 + i * 0.04;
    const freq = 1500 + Math.random() * 2000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.04, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.3);
  }
};

/**
 * 金貨降り注ぎ音 - シャラシャラとした金属音の連続
 */
export const playCoinRain = (): void => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 20; i++) {
    const delay = i * 0.15 + Math.random() * 0.1;
    const freq = 2000 + Math.random() * 3000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + delay + 0.15);
    gain.gain.setValueAtTime(0.03, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.15);
  }
};

/**
 * 金貨落下音 - チャリンという単発の金属音
 */
export const playCoinDrop = (): void => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freq = 3000 + Math.random() * 2000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 0.12);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
  // Harmonic overtone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2.5, now);
  osc2.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.08);
  gain2.gain.setValueAtTime(0.02, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.08);
};

/**
 * 初期化 - ユーザーインタラクション後に呼び出す
 */
export const initAudio = (): void => {
  getAudioContext();
};

export default {
  playSpinStart,
  playTick,
  playWinFanfare,
  playSuperJackpot,
  playConfetti,
  playFirework,
  playCountUp,
  playCountUpComplete,
  playButtonClick,
  playTransition,
  playCelebration,
  playAmbient,
  playRoundUp,
  playCountdown,
  playCountdownGo,
  playCoinRain,
  playCoinDrop,
  initAudio,
};
