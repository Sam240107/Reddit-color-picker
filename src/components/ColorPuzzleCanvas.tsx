import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { RGB, GuessResult } from "../types";
import { playSound } from "../utils/audio";

interface ColorPuzzleCanvasProps {
  guesses: GuessResult[];
  maxGuesses: number;
  isGameOver: boolean;
  targetColor: RGB | null;
  currentR: number;
  currentG: number;
  currentB: number;
  onColorChange: (r: number, g: number, b: number) => void;
  onGuessSubmitted: () => void;
  isSoundEnabled: boolean;
}

export default function ColorPuzzleCanvas({
  guesses,
  maxGuesses,
  isGameOver,
  targetColor,
  currentR,
  currentG,
  currentB,
  onColorChange,
  onGuessSubmitted,
  isSoundEnabled,
}: ColorPuzzleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // Keep latest props in refs for Phaser to access without restarting scene
  const propsRef = useRef({
    guesses,
    isGameOver,
    targetColor,
    currentR,
    currentG,
    currentB,
    onColorChange,
    onGuessSubmitted,
    maxGuesses,
  });

  useEffect(() => {
    propsRef.current = {
      guesses,
      isGameOver,
      targetColor,
      currentR,
      currentG,
      currentB,
      onColorChange,
      onGuessSubmitted,
      maxGuesses,
    };
  }, [guesses, isGameOver, targetColor, currentR, currentG, currentB, onColorChange, onGuessSubmitted, maxGuesses]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Custom Phaser Scene inside React
    class ColorPuzzleScene extends Phaser.Scene {
      private redHandle!: Phaser.GameObjects.Arc;
      private greenHandle!: Phaser.GameObjects.Arc;
      private blueHandle!: Phaser.GameObjects.Arc;
      
      private redTrack!: Phaser.GameObjects.Graphics;
      private greenTrack!: Phaser.GameObjects.Graphics;
      private blueTrack!: Phaser.GameObjects.Graphics;

      private rText!: Phaser.GameObjects.Text;
      private gText!: Phaser.GameObjects.Text;
      private bText!: Phaser.GameObjects.Text;

      private guessSwatch!: Phaser.GameObjects.Graphics;
      private targetSwatch!: Phaser.GameObjects.Graphics;
      private targetQuestionMark!: Phaser.GameObjects.Text;

      private distanceMeterFill!: Phaser.GameObjects.Graphics;
      private distanceMeterCursor!: Phaser.GameObjects.Arc;
      private distanceLabel!: Phaser.GameObjects.Text;

      private submitBtnBg!: Phaser.GameObjects.Graphics;
      private submitBtnText!: Phaser.GameObjects.Text;

      private swatchCircles: Phaser.GameObjects.Graphics[] = [];
      private swatchTexts: Phaser.GameObjects.Text[] = [];

      private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
      private isFullyCreated = false;

      constructor() {
        super("ColorPuzzleScene");
      }

      create() {
        const { currentR, currentG, currentB } = propsRef.current;

        // Draw Dark Sleek Card-like Canvas Background
        const bg = this.add.graphics();
        bg.fillStyle(0x09090b, 1); // Dark Card Bg
        
        // Soft grid lining for layout structure
        bg.lineStyle(1, 0x1a1a1b, 1); // Dark Border
        bg.strokeRoundedRect(0, 0, 560, 480, 16);

        // 1. SWATCHES / VISUALS HEADER
        // Target Swatch (Glows & Reveals slowly)
        this.targetSwatch = this.add.graphics();

        this.add.text(50, 130, "TARGET COLOR", {
          fontSize: "10px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#94a3b8",
          fontStyle: "bold",
        }).setOrigin(0.5);

        // Question mark when hidden
        this.targetQuestionMark = this.add.text(50, 75, "?", {
          fontSize: "36px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#cbd5e1",
          fontStyle: "bold",
        }).setOrigin(0.5);

        // VS connecting wire
        const vsLabel = this.add.text(145, 75, "vs", {
          fontSize: "14px",
          fontFamily: "JetBrains Mono, monospace",
          color: "#4a4a52",
        }).setOrigin(0.5);

        // Player's Swatch matches current slider values
        this.guessSwatch = this.add.graphics();
        this.drawGuessSwatch(currentR, currentG, currentB);

        this.add.text(240, 130, "YOUR MIX", {
          fontSize: "10px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#ff4500",
          fontStyle: "bold",
        }).setOrigin(0.5);

        // 2. SLIDERS LABELS & SLIDER TRACK SECTIONS
        // Slider coordinates
        const sliderStartX = 80;
        const sliderWidth = 320;
        const redY = 195;
        const greenY = 245;
        const blueY = 295;

        // RED slider track
        this.redTrack = this.add.graphics();
        this.drawSliderTrack(this.redTrack, sliderStartX, sliderWidth, redY, 0xff0000);

        // GREEN slider track
        this.greenTrack = this.add.graphics();
        this.drawSliderTrack(this.greenTrack, sliderStartX, sliderWidth, greenY, 0x00ff00);

        // BLUE slider track
        this.blueTrack = this.add.graphics();
        this.drawSliderTrack(this.blueTrack, sliderStartX, sliderWidth, blueY, 0x0000ff);

        // RED handle
        const redInitialX = sliderStartX + (currentR / 255) * sliderWidth;
        this.redHandle = this.add.arc(redInitialX, redY, 14, 0, 360, false, 0xef4444);
        this.redHandle.setStrokeStyle(3, 0xffffff);
        this.redHandle.setInteractive({ useHandCursor: true });
        this.input.setDraggable(this.redHandle);

        // GREEN handle
        const greenInitialX = sliderStartX + (currentG / 255) * sliderWidth;
        this.greenHandle = this.add.arc(greenInitialX, greenY, 14, 0, 360, false, 0x10b981);
        this.greenHandle.setStrokeStyle(3, 0xffffff);
        this.greenHandle.setInteractive({ useHandCursor: true });
        this.input.setDraggable(this.greenHandle);

        // BLUE handle
        const blueInitialX = sliderStartX + (currentB / 255) * sliderWidth;
        this.blueHandle = this.add.arc(blueInitialX, blueY, 14, 0, 360, false, 0x3b82f6);
        this.blueHandle.setStrokeStyle(3, 0xffffff);
        this.blueHandle.setInteractive({ useHandCursor: true });
        this.input.setDraggable(this.blueHandle);

        // RGB Numeric Displays (R: 255, G: 0, etc.)
        this.rText = this.add.text(450, redY - 8, `R: ${currentR}`, {
          fontSize: "14px",
          fontFamily: "JetBrains Mono, monospace",
          color: "#ef4444",
        });
        this.gText = this.add.text(450, greenY - 8, `G: ${currentG}`, {
          fontSize: "14px",
          fontFamily: "JetBrains Mono, monospace",
          color: "#10b981",
        });
        this.bText = this.add.text(450, blueY - 8, `B: ${currentB}`, {
          fontSize: "14px",
          fontFamily: "JetBrains Mono, monospace",
          color: "#3b82f6",
        });

        // 3. DISTANCE CLONES METER
        // Background Bar
        const meterBg = this.add.graphics();
        meterBg.fillStyle(0x1a1a1b, 1);
        meterBg.fillRoundedRect(40, 345, 480, 16, 8);
        meterBg.lineStyle(2, 0x1a1a1b, 1);
        meterBg.strokeRoundedRect(40, 345, 480, 16, 8);

        // Distance meter active fill
        this.distanceMeterFill = this.add.graphics();
        this.distanceMeterCursor = this.add.arc(40, 353, 10, 0, 360, false, 0xffffff);
        this.distanceMeterCursor.setStrokeStyle(2, 0x09090b);
        this.distanceMeterCursor.setVisible(false);

        this.distanceLabel = this.add.text(280, 375, "Submit a guess to trigger the sensor", {
          fontSize: "12px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#64748b",
          align: "center",
        }).setOrigin(0.5);

        // 4. SUBMIT BUTTON
        this.submitBtnBg = this.add.graphics();
        this.submitBtnText = this.add.text(430, 75, "SUBMIT GUESS", {
          fontSize: "14px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#ffffff",
          fontStyle: "bold",
        }).setOrigin(0.5);

        this.drawSubmitButton(false); // Idle status
        
        // Make submit button interactive
        const submitZone = this.add.zone(430, 75, 190, 60).setInteractive({ useHandCursor: true });
        
        submitZone.on("pointerover", () => {
          if (propsRef.current.isGameOver) return;
          this.drawSubmitButton(true); // Hover
          this.submitBtnText.setScale(1.05);
        });

        submitZone.on("pointerout", () => {
          this.drawSubmitButton(false); // Out
          this.submitBtnText.setScale(1);
        });

        submitZone.on("pointerdown", () => {
          if (propsRef.current.isGameOver) return;
          playSound("click");
          
          this.submitBtnText.setScale(0.95);
          this.time.delayedCall(100, () => {
            this.submitBtnText.setScale(1);
            propsRef.current.onGuessSubmitted();
          });
        });

        // 5. ATTEMPT MARKS (bottom swatches)
        this.setUpHistoryChips();

        // Particle Emitter for Win Fireworks / High accuracy
        const pixelData = this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 6, 6);
        pixelData.generateTexture("spark", 6, 6);
        pixelData.destroy();

        this.particleEmitter = this.add.particles(0, 0, "spark", {
          speed: { min: 100, max: 250 },
          scale: { start: 1, end: 0 },
          blendMode: "ADD",
          lifespan: 800,
          gravityY: 100,
          quantity: 2,
          emitting: false,
        });

        // Drag handlers list
        this.input.on("drag", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Arc, dragX: number) => {
          if (propsRef.current.isGameOver) return;

          // Confine X
          const clampedX = Phaser.Math.Clamp(dragX, sliderStartX, sliderStartX + sliderWidth);
          gameObject.x = clampedX;

          // Retrieve ratio
          const ratio = (clampedX - sliderStartX) / sliderWidth;
          const val = Math.round(ratio * 255);

          // Update colors
          let { currentR: r, currentG: g, currentB: b } = propsRef.current;
          if (gameObject === this.redHandle) {
            r = val;
            this.rText.setText(`R: ${r}`);
          } else if (gameObject === this.greenHandle) {
            g = val;
            this.gText.setText(`G: ${g}`);
          } else if (gameObject === this.blueHandle) {
            b = val;
            this.bText.setText(`B: ${b}`);
          }

          // Trigger React callback
          propsRef.current.onColorChange(r, g, b);

          // Redraw guess swatch in real-time
          this.drawGuessSwatch(r, g, b);

          if (pointer.primaryDown && Math.random() < 0.15) {
            playSound("slide");
          }
        });

        // Resolve Initial state if already set
        this.isFullyCreated = true;
        this.updateGameStateVisuals(true);
      }

      drawSliderTrack(graphics: Phaser.GameObjects.Graphics, startX: number, width: number, y: number, color: number) {
        graphics.clear();
        // Sliders are multi-layered: dark background track and bright filled portion
        graphics.fillStyle(0x1a1a1b, 1);
        graphics.fillRoundedRect(startX, y - 6, width, 12, 6);
        
        // Border outline
        graphics.lineStyle(1, 0x1a1a1b, 1);
        graphics.strokeRoundedRect(startX, y - 6, width, 12, 6);
      }

      drawSubmitButton(isHover: boolean) {
        this.submitBtnBg.clear();
        
        const isOver = propsRef.current.isGameOver;
        if (isOver) {
          // Disabled/Over button state
          this.submitBtnBg.fillStyle(0x1a1a1b, 1);
          this.submitBtnBg.fillRoundedRect(330, 45, 200, 60, 12);
          this.submitBtnText.setText("COMPLETED");
          this.submitBtnText.setColor("#6b7280");
          return;
        }

        // Active State - Reddit orange-red colors
        const primaryColor = isHover ? 0xd03800 : 0xff4500; // Hover vs Active orange-red
        this.submitBtnBg.fillStyle(primaryColor, 1);
        this.submitBtnBg.fillRoundedRect(330, 45, 200, 60, 12);
        
        // Elegant shadow border
        this.submitBtnBg.lineStyle(2, 0xff4500, 1);
        this.submitBtnBg.strokeRoundedRect(330, 45, 200, 60, 12);

        this.submitBtnText.setText("SUBMIT GUESS");
        this.submitBtnText.setColor("#ffffff");
      }

      drawGuessSwatch(r: number, g: number, b: number) {
        this.guessSwatch.clear();
        
        // Inner fill
        this.guessSwatch.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
        this.guessSwatch.fillCircle(240, 75, 40);

        // Ring Border
        this.guessSwatch.lineStyle(3, 0xff4500, 1);
        this.guessSwatch.strokeCircle(240, 75, 40);
      }

      drawTargetSwatch() {
        this.targetSwatch.clear();
        const { isGameOver, targetColor } = propsRef.current;

        if (isGameOver && targetColor) {
          this.targetSwatch.fillStyle(Phaser.Display.Color.GetColor(targetColor.r, targetColor.g, targetColor.b), 1);
          this.targetSwatch.fillCircle(50, 75, 40);
          this.targetSwatch.lineStyle(3, 0xffaa00, 1); // Orange reveal border
          this.targetSwatch.strokeCircle(50, 75, 40);
          if (this.targetQuestionMark) {
            this.targetQuestionMark.setVisible(false);
          }
        } else {
          // Locked State
          this.targetSwatch.fillStyle(0x1a1a1b, 1); // Dark Card element
          this.targetSwatch.fillCircle(50, 75, 40);
          this.targetSwatch.lineStyle(3, 0x1a1a1b, 1); // Border Slate/Dark Gray
          this.targetSwatch.strokeCircle(50, 75, 40);
          if (this.targetQuestionMark) {
            this.targetQuestionMark.setVisible(true);
          }
        }
      }

      setUpHistoryChips() {
        // Clear old graphics
        this.swatchCircles.forEach(c => c.destroy());
        this.swatchTexts.forEach(t => t.destroy());
        this.swatchCircles = [];
        this.swatchTexts = [];

        const startX = 64;
        const spacing = 108;
        const y = 432;

        for (let i = 0; i < propsRef.current.maxGuesses; i++) {
          const gX = startX + i * spacing;
          
          // Outer circle
          const chip = this.add.graphics();
          chip.fillStyle(0x1a1a1b, 1);
          chip.fillRoundedRect(gX - 48, y - 18, 96, 36, 18);
          chip.lineStyle(2, 0x1a1a1b, 1);
          chip.strokeRoundedRect(gX - 48, y - 18, 96, 36, 18);

          const indicator = this.add.graphics();
          indicator.fillStyle(0x09090b, 1);
          indicator.fillCircle(gX - 25, y, 10);
          indicator.lineStyle(2, 0x1a1a1b, 1);
          indicator.strokeCircle(gX - 25, y, 10);

          const valueTxt = this.add.text(gX + 12, y, `#${i+1}`, {
            fontSize: "12px",
            fontFamily: "Space Grotesk, sans-serif",
            color: "#888894",
            fontStyle: "bold",
          }).setOrigin(0.5);

          this.swatchCircles.push(indicator);
          this.swatchTexts.push(valueTxt);
        }
      }

      updateGameStateVisuals(isInitial = false) {
        if (!this.isFullyCreated) return;
        const { guesses, isGameOver, targetColor, currentR, currentG, currentB } = propsRef.current;

        // Sync slider handles if they differ due to external changes (like resetting/starting today)
        const sliderStartX = 80;
        const sliderWidth = 320;
        
        this.redHandle.x = sliderStartX + (currentR / 255) * sliderWidth;
        this.greenHandle.x = sliderStartX + (currentG / 255) * sliderWidth;
        this.blueHandle.x = sliderStartX + (currentB / 255) * sliderWidth;

        this.rText.setText(`R: ${currentR}`);
        this.gText.setText(`G: ${currentG}`);
        this.bText.setText(`B: ${currentB}`);

        this.drawGuessSwatch(currentR, currentG, currentB);
        this.drawTargetSwatch();
        this.drawSubmitButton(false);

        // Render previous guesses onto the history chips
        guesses.forEach((guess, idx) => {
          if (idx < this.swatchCircles.length) {
            const gCircle = this.swatchCircles[idx];
            gCircle.clear();
            const colVal = Phaser.Display.Color.GetColor(guess.guessColor.r, guess.guessColor.g, guess.guessColor.b);
            gCircle.fillStyle(colVal, 1);
            gCircle.fillCircle(64 + idx * 108 - 25, 432, 10);
            
            // Border matches evaluation (highly responsive feedback)
            let ringColor = 0xef4444; // red
            if (guess.closeness >= 98) ringColor = 0x22c55e; // green
            else if (guess.closeness >= 90) ringColor = 0xeab308; // yellow
            else if (guess.closeness >= 75) ringColor = 0xf97316; // orange

            gCircle.lineStyle(2, ringColor, 1);
            gCircle.strokeCircle(64 + idx * 108 - 25, 432, 10);

            // Change Text
            const gText = this.swatchTexts[idx];
            gText.setText(`${guess.closeness}%`);
            gText.setColor("#cbd5e1");
          }
        });

        // Trigger distance meter drawing for the latest guess
        if (guesses.length > 0) {
          const latestGuess = guesses[guesses.length - 1];
          this.animateDistanceMeter(latestGuess.closeness, isInitial);
        } else {
          this.distanceMeterFill.clear();
          this.distanceMeterCursor.setVisible(false);
          this.distanceLabel.setText("Adjust sliders & submit a guess");
          this.distanceLabel.setColor("#64748b");
        }

        // Particle FX triggers
        if (isGameOver && targetColor && !isInitial) {
          const didWin = guesses.some(g => g.isCorrect || g.closeness >= 99);
          if (didWin) {
            playSound("win");
            // Burst particles over target swatch
            this.particleEmitter.explode(40, 50, 75);
            this.particleEmitter.explode(40, 240, 75);
          } else {
            playSound("lose");
          }
        }
      }

      animateDistanceMeter(closeness: number, isInitial: boolean) {
        const startX = 40;
        const barWidth = 480;
        const targetX = startX + (closeness / 100) * barWidth;

        this.distanceMeterCursor.setVisible(true);
        this.distanceMeterCursor.y = 353;

        // Custom labels based on accuracy zones
        let feedbackStr = "";
        let feedbackColor = "";

        if (closeness >= 99.5) {
          feedbackStr = `🎯 PERFECT MATCH! (Closeness: ${closeness}%)`;
          feedbackColor = "#22c55e"; // Emerald-500
        } else if (closeness >= 95) {
          feedbackStr = `🔥 EXTREMELY CLOSE! (Closeness: ${closeness}%)`;
          feedbackColor = "#4ade80"; // Green-400
        } else if (closeness >= 85) {
          feedbackStr = `✨ Getting Warmer... (Closeness: ${closeness}%)`;
          feedbackColor = "#eab308"; // Amber-500
        } else if (closeness >= 70) {
          feedbackStr = `💤 A bit off (Closeness: ${closeness}%)`;
          feedbackColor = "#f97316"; // Orange-500
        } else {
          feedbackStr = `❄️ Freezing Cold! (Closeness: ${closeness}%)`;
          feedbackColor = "#ef4444"; // Red-500
        }

        if (isInitial) {
          this.distanceMeterCursor.x = targetX;
          this.drawDistanceMeterColors(closeness);
          this.distanceLabel.setText(feedbackStr);
          this.distanceLabel.setColor(feedbackColor);
        } else {
          // Play slide/grow animations
          playSound("guess");
          const currentX = this.distanceMeterCursor.x;
          
          this.tweens.add({
            targets: this.distanceMeterCursor,
            x: targetX,
            duration: 600,
            ease: "Quad.easeOut",
            onUpdate: () => {
              // Recalculate dynamic filled bar ratio
              const currentRatio = (this.distanceMeterCursor.x - startX) / barWidth;
              this.drawDistanceMeterColors(currentRatio * 100);
            },
            onComplete: () => {
              this.distanceLabel.setText(feedbackStr);
              this.distanceLabel.setColor(feedbackColor);
            }
          });
        }
      }

      drawDistanceMeterColors(percentage: number) {
        this.distanceMeterFill.clear();
        
        // Multi-colored fill: Interpolating from Red (far left) to Green (right)
        // Draw the filled portion inside the rounded boundary
        const startX = 40;
        const width = (percentage / 100) * 480;

        // Draw sub-color sectors for high-fidelity fill
        for (let px = 0; px < width; px += 2) {
          const ratio = (startX + px - 40) / 480;
          // Interpolate Red (0) to Yellow (0.5) to Green (1)
          let colorHex = 0xef4444; // Default red
          if (ratio < 0.5) {
            // red-to-orange gradient
            const mix = ratio * 2;
            const r = 239;
            const g = Math.round(68 + (163 - 68) * mix);
            const b = Math.round(68 + (8 - 68) * mix);
            colorHex = Phaser.Display.Color.GetColor(r, g, b);
          } else {
            // orange-to-emerald gradient
            const mix = (ratio - 0.5) * 2;
            const r = Math.round(239 + (34 - 239) * mix);
            const g = Math.round(163 + (197 - 163) * mix);
            const b = Math.round(8 + (94 - 8) * mix);
            colorHex = Phaser.Display.Color.GetColor(r, g, b);
          }

          this.distanceMeterFill.fillStyle(colorHex, 1);
          // Draw thin vertical lines inside bar height (345 to 361)
          this.distanceMeterFill.fillRect(startX + px, 346, 2, 14);
        }
      }

      onExternalUpdate() {
        if (this.sys.isActive() && this.isFullyCreated) {
          this.updateGameStateVisuals(false);
        }
      }
    }

    // Phaser configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 560,
      height: 480,
      backgroundColor: "#09090b",
      parent: containerRef.current,
      audio: {
        noAudio: true,
      },
      physics: {
        default: "arcade",
      },
      scene: [ColorPuzzleScene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Synchronize subsequent React state changes into the active Phaser scene without restarts
  useEffect(() => {
    if (gameRef.current && gameRef.current.scene.scenes[0]) {
      const activeScene = gameRef.current.scene.scenes[0] as any;
      if (activeScene.onExternalUpdate) {
        activeScene.onExternalUpdate();
      }
    }
  }, [guesses, isGameOver, targetColor, currentR, currentG, currentB]);

  return (
    <div id="phaser-game-container" className="flex justify-center select-none overflow-hidden rounded-xl">
      <div ref={containerRef} className="w-[560px] h-[480px] bg-[#09090b] rounded-xl" />
    </div>
  );
}
