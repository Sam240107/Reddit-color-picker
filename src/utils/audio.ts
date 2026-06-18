let isSoundEnabled = true;

export function toggleAudio(enabled: boolean) {
  isSoundEnabled = enabled;
}

export function playSound(type: "click" | "guess" | "win" | "lose" | "slide") {
  if (!isSoundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    let duration = 0.5;

    switch (type) {
      case "click":
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        duration = 0.1;
        break;

      case "slide":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        duration = 0.15;
        break;

      case "guess":
        // Feedback sweep
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.25);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        duration = 0.3;
        break;

      case "win":
        // Friendly arpeggio
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
        duration = 0.55;
        break;

      case "lose":
        // Depressing fall
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.linearRampToValueAtTime(100, now + 0.4);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        duration = 0.5;
        break;
    }

    // Automatically close AudioContext to release browser resources
    setTimeout(() => {
      try {
        if (ctx.state !== "closed") {
          ctx.close().catch(() => {});
        }
      } catch (err) {
        // Safe catch
      }
    }, duration * 1000);
  } catch (e) {
    // Audio might be blocked or fail without user gesture, fail gracefully
    console.warn("Audio Context failed:", e);
  }
}
