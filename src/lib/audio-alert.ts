// src/lib/audio-alert.ts

let sharedAudioContext: AudioContext | null = null;

/**
 * Panggil fungsi ini saat ada interaksi pertama user (misal klik tombol Online atau layar)
 * agar browser Android/Chrome mengizinkan pemutaran audio di latar depan.
 */
export function unlockAudioContext(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume();
    }
  } catch (err) {
    console.debug("Tidak dapat mengaktifkan audio context:", err);
  }
}

/**
 * Memutar nada dering pesanan masuk (melodi 2 nada berulang 3 kali) + Getar HP
 */
export function playOrderAlertSound(): void {
  try {
    if (typeof window === "undefined") return;

    // Getar perangkat Android jika didukung
    if ("vibrate" in navigator) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioContextClass();
    }

    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume();
    }

    const ctx = sharedAudioContext;
    const now = ctx.currentTime;

    // Pola nada dering khas ojol: High-Mid berulang 3 siklus
    const notes = [
      { freq: 880, start: 0.0, duration: 0.15 },
      { freq: 1174.66, start: 0.18, duration: 0.25 },
      { freq: 880, start: 0.55, duration: 0.15 },
      { freq: 1174.66, start: 0.73, duration: 0.25 },
      { freq: 880, start: 1.1, duration: 0.15 },
      { freq: 1174.66, start: 1.28, duration: 0.35 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.warn("Gagal memainkan suara alert pesanan:", err);
  }
}
