import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
}

/**
 * 目標達成時のお祝いアニメーション（紙吹雪）コンポーネント
 * triggerがtrueになると紙吹雪アニメーションを表示
 */
export function Confetti({ trigger, onComplete }: ConfettiProps) {
  const hasTriggered = useRef(false);

  const fireConfetti = useCallback(() => {
    // 左側から発射
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ['#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#0099ff', '#6633ff'],
    });

    // 右側から発射
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: ['#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#0099ff', '#6633ff'],
    });

    // 中央から大きく発射
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#0099ff', '#6633ff', '#ff00ff'],
      });
    }, 200);

    // 完了コールバック
    if (onComplete) {
      setTimeout(onComplete, 3000);
    }
  }, [onComplete]);

  useEffect(() => {
    if (trigger && !hasTriggered.current) {
      hasTriggered.current = true;
      fireConfetti();
    }
  }, [trigger, fireConfetti]);

  // このコンポーネントは視覚的なUIを持たない
  return null;
}

/**
 * 連続した紙吹雪アニメーション（より派手なお祝い用）
 */
export function CelebrationConfetti({ trigger, onComplete }: ConfettiProps) {
  const hasTriggered = useRef(false);

  const fireCelebration = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ['#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#0099ff', '#6633ff', '#ff00ff'];

    const frame = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      } else if (onComplete) {
        onComplete();
      }
    };

    frame();
  }, [onComplete]);

  useEffect(() => {
    if (trigger && !hasTriggered.current) {
      hasTriggered.current = true;
      fireCelebration();
    }
  }, [trigger, fireCelebration]);

  return null;
}

/**
 * 目標達成用の特別なアニメーション
 * 金色と銀色の紙吹雪で豪華に演出
 */
export function GoalAchievedConfetti({ trigger, onComplete }: ConfettiProps) {
  const hasTriggered = useRef(false);

  const fireGoalAchieved = useCallback(() => {
    // 金色と銀色のカラーパレット
    const goldColors = ['#FFD700', '#FFC107', '#FFEB3B', '#FFF59D'];
    const silverColors = ['#C0C0C0', '#E0E0E0', '#BDBDBD', '#9E9E9E'];
    const celebrationColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

    // 最初の爆発
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { x: 0.5, y: 0.6 },
      colors: goldColors,
      startVelocity: 45,
    });

    // 左右から
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 80,
        origin: { x: 0, y: 0.6 },
        colors: silverColors,
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 80,
        origin: { x: 1, y: 0.6 },
        colors: silverColors,
      });
    }, 300);

    // カラフルな追加爆発
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { x: 0.5, y: 0.5 },
        colors: celebrationColors,
        startVelocity: 35,
      });
    }, 600);

    // 最後の金色シャワー
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 160,
        origin: { x: 0.5, y: 0.3 },
        colors: goldColors,
        gravity: 1.2,
      });
    }, 900);

    if (onComplete) {
      setTimeout(onComplete, 4000);
    }
  }, [onComplete]);

  useEffect(() => {
    if (trigger && !hasTriggered.current) {
      hasTriggered.current = true;
      fireGoalAchieved();
    }
  }, [trigger, fireGoalAchieved]);

  return null;
}

export default Confetti;
