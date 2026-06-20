import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { RGB, GuessResult, GameMode } from "../types";
import { playSound } from "../utils/audio";

interface ColorPuzzleCanvasProps {
  guesses: GuessResult[];
  maxGuesses: number;
  isGameOver: boolean;
  targetColor: RGB | null;
  currentR: number;
  currentG: number;
  currentB: number;
  gameMode: GameMode;
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
  gameMode,
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
    gameMode,
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
      gameMode,
      onColorChange,
      onGuessSubmitted,
      maxGuesses,
    };
  }, [guesses, isGameOver, targetColor, currentR, currentG, currentB, gameMode, onColorChange, onGuessSubmitted, maxGuesses]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Custom Phaser Scene inside React
    class ColorPuzzleScene extends Phaser.Scene {
      private wheelGraphics!: Phaser.GameObjects.Graphics;
      private centerDisk!: Phaser.GameObjects.Graphics;
      
      private handles!: Phaser.GameObjects.Arc[];
      private targetMarkers!: Phaser.GameObjects.Arc[];

      private distanceMeterFill!: Phaser.GameObjects.Graphics;
      private distanceMeterCursor!: Phaser.GameObjects.Arc;
      private distanceLabel!: Phaser.GameObjects.Text;

      private submitBtnBg!: Phaser.GameObjects.Graphics;
      private submitBtnText!: Phaser.GameObjects.Text;

      private swatchCircles: Phaser.GameObjects.Graphics[] = [];
      private swatchTexts: Phaser.GameObjects.Text[] = [];

      private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
      private isFullyCreated = false;

      private currentHue = 180;
      private currentSat = 1.0;

      constructor() {
        super("ColorPuzzleScene");
      }

      create() {
        const { currentR, currentG, currentB, gameMode } = propsRef.current;

        // Draw Dark Sleek Card-like Canvas Background
        const bg = this.add.graphics();
        bg.fillStyle(0x09090b, 1); // Dark Card Bg
        
        // Soft grid lining for layout structure
        bg.lineStyle(1, 0x1a1a1b, 1); // Dark Border
        bg.strokeRoundedRect(0, 0, 560, 480, 16);

        // Graphics container for drawing the custom Color Wheel
        this.wheelGraphics = this.add.graphics();

        // 1. SPLIT DISK & HOVER MARKERS
        this.centerDisk = this.add.graphics();

        // 2. POINTERS / TARGETS SETUP (MIMICKING COLOR.METHOD.AC)
        this.handles = [];
        for (let i = 0; i < 4; i++) {
          const handle = this.add.arc(0, 0, 12, 0, 360, false, 0xffffff);
          handle.setStrokeStyle(3, 0xffffff);
          handle.setVisible(false);
          this.handles.push(handle);
        }

        // Make primary handle interactive and draggable
        const primaryHandle = this.handles[0];
        primaryHandle.setInteractive({ useHandCursor: true });
        this.input.setDraggable(primaryHandle);

        this.targetMarkers = [];
        for (let i = 0; i < 4; i++) {
          const marker = this.add.arc(0, 0, 8, 0, 360, false);
          marker.setStrokeStyle(2.5, 0xffffff, 0.5);
          marker.setVisible(false);
          this.targetMarkers.push(marker);
        }

        // Center wheel label guides for user understanding
        this.add.text(280, 275, "COLOR WHEEL MATCH", {
          fontSize: "9px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#4b5563",
          fontStyle: "bold",
        }).setOrigin(0.5);

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

        this.distanceLabel = this.add.text(280, 375, "Submit a guess to trigger the accuracy sensor", {
          fontSize: "12px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#64748b",
          align: "center",
        }).setOrigin(0.5);

        // 4. SUBMIT BUTTON
        this.submitBtnBg = this.add.graphics();
        this.submitBtnText = this.add.text(490, 75, "SUBMIT", {
          fontSize: "13px",
          fontFamily: "Space Grotesk, sans-serif",
          color: "#ffffff",
          fontStyle: "bold",
        }).setOrigin(0.5);

        this.drawSubmitButton(false); // Idle status
        
        // Make submit button interactive
        const submitZone = this.add.zone(490, 75, 120, 50).setInteractive({ useHandCursor: true });
        
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

        // 6. DETAILED DRAG ALONG COLOR WHEEL
        const centerX = 280;
        const centerY = 190;

        this.input.on("drag", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Arc, dragX: number, dragY: number) => {
          if (propsRef.current.isGameOver) return;

          const dx = dragX - centerX;
          const dy = dragY - centerY;
          let angleRad = Math.atan2(dy, dx);
          if (angleRad < 0) angleRad += 2 * Math.PI;
          const angleDeg = Phaser.Math.RadToDeg(angleRad);
          const dist = Math.sqrt(dx * dx + dy * dy);

          const { gameMode: activeMode } = propsRef.current;

          if (activeMode === "saturation") {
            const rClamped = Phaser.Math.Clamp(dist, 60, 135);
            this.currentHue = angleDeg;
            this.currentSat = (rClamped - 60) / (135 - 60);
          } else {
            this.currentHue = angleDeg;
            this.currentSat = 1.0;
          }

          // Update main handle positions synchronously
          const rad = Phaser.Math.DegToRad(this.currentHue);
          const actualR = activeMode === "saturation" ? (60 + this.currentSat * (135 - 60)) : 120;
          gameObject.x = centerX + Math.cos(rad) * actualR;
          gameObject.y = centerY + Math.sin(rad) * actualR;

          // Compute matching RGB
          const rgb = Phaser.Display.Color.HSVToRGB(this.currentHue / 360, this.currentSat, 1) as any;
          propsRef.current.onColorChange(rgb.r, rgb.g, rgb.b);

          if (pointer.primaryDown && Math.random() < 0.1) {
            playSound("slide");
          }
        });

        this.isFullyCreated = true;
        this.updateGameStateVisuals(true);
      }

      drawColorWheel(mode: GameMode) {
        this.wheelGraphics.clear();
        const centerX = 280;
        const centerY = 190;
        const innerRadius = 105;
        const outerRadius = 135;

        // Draw Continuous Rainbow Ring Segment (360 slices)
        for (let deg = 0; deg < 360; deg += 1) {
          const rad = Phaser.Math.DegToRad(deg);
          const color = Phaser.Display.Color.HSVToRGB(deg / 360, 1, 1);
          this.wheelGraphics.lineStyle(4, color.color, 1);
          this.wheelGraphics.lineBetween(
            centerX + Math.cos(rad) * innerRadius,
            centerY + Math.sin(rad) * innerRadius,
            centerX + Math.cos(rad) * outerRadius,
            centerY + Math.sin(rad) * outerRadius
          );
        }

        // Draw dynamic saturation gradient layering
        if (mode === "saturation") {
          for (let r = 60; r <= 135; r += 2) {
            const alpha = Phaser.Math.Linear(0.85, 0, (r - 60) / (135 - 60));
            this.wheelGraphics.lineStyle(2, 0xffffff, alpha);
            this.wheelGraphics.strokeCircle(centerX, centerY, r);
          }
        }

        // Sleek outer contour dividers
        this.wheelGraphics.lineStyle(1.5, 0x1a1a1b, 1);
        this.wheelGraphics.strokeCircle(centerX, centerY, innerRadius);
        this.wheelGraphics.strokeCircle(centerX, centerY, outerRadius);
        if (mode === "saturation") {
          this.wheelGraphics.strokeCircle(centerX, centerY, 60);
        }
      }

      drawSubmitButton(isHover: boolean) {
        this.submitBtnBg.clear();
        
        const isOver = propsRef.current.isGameOver;
        if (isOver) {
          // Disabled/Over button state
          this.submitBtnBg.fillStyle(0x1a1a1b, 1);
          this.submitBtnBg.fillRoundedRect(430, 45, 110, 60, 12);
          this.submitBtnText.setText("DONE");
          this.submitBtnText.setColor("#6b7280");
          return;
        }

        // Active State - Reddit orange-red colors
        const primaryColor = isHover ? 0xd03800 : 0xff4500; // Hover vs Active orange-red
        this.submitBtnBg.fillStyle(primaryColor, 1);
        this.submitBtnBg.fillRoundedRect(430, 45, 110, 60, 12);
        
        this.submitBtnBg.lineStyle(2, 0xff4500, 1);
        this.submitBtnBg.strokeRoundedRect(430, 45, 110, 60, 12);

        this.submitBtnText.setText("SUBMIT");
        this.submitBtnText.setColor("#ffffff");
      }

      setUpHistoryChips() {
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
        const { guesses, isGameOver, targetColor, currentR, currentG, currentB, gameMode } = propsRef.current;

        const centerX = 280;
        const centerY = 190;

        // Redraw color wheel and desaturation gradient
        this.drawColorWheel(gameMode);

        // Convert state back to target HSV & player HSV
        const hsv = Phaser.Display.Color.RGBToHSV(currentR, currentG, currentB);
        this.currentHue = hsv.h * 360;
        this.currentSat = hsv.s;

        // Update main handle position and display color
        const mainRad = Phaser.Math.DegToRad(this.currentHue);
        const mainR = gameMode === "saturation" ? (60 + this.currentSat * (135 - 60)) : 120;
        
        this.handles[0].x = centerX + Math.cos(mainRad) * mainR;
        this.handles[0].y = centerY + Math.sin(mainRad) * mainR;
        this.handles[0].setFillStyle(Phaser.Display.Color.HSVToRGB(hsv.h, hsv.s, 1).color, 1);
        this.handles[0].setVisible(true);

        // Reposition and color other handles depending on mode
        this.handles[1].setVisible(false);
        this.handles[2].setVisible(false);
        this.handles[3].setVisible(false);

        if (gameMode === "complementary") {
          const oppositeRad = mainRad + Math.PI;
          this.handles[1].x = centerX + Math.cos(oppositeRad) * 120;
          this.handles[1].y = centerY + Math.sin(oppositeRad) * 120;
          const otherHue = (this.currentHue + 180) % 360;
          this.handles[1].setFillStyle(Phaser.Display.Color.HSVToRGB(otherHue / 360, 1, 1).color, 1);
          this.handles[1].setVisible(true);
        } else if (gameMode === "analogous") {
          const lRad = mainRad - Phaser.Math.DegToRad(30);
          const rRad = mainRad + Phaser.Math.DegToRad(30);
          
          this.handles[1].x = centerX + Math.cos(lRad) * 120;
          this.handles[1].y = centerY + Math.sin(lRad) * 120;
          const lHue = (this.currentHue - 30 + 360) % 360;
          this.handles[1].setFillStyle(Phaser.Display.Color.HSVToRGB(lHue / 360, 1, 1).color, 1);
          this.handles[1].setVisible(true);

          this.handles[2].x = centerX + Math.cos(rRad) * 120;
          this.handles[2].y = centerY + Math.sin(rRad) * 120;
          const rHue = (this.currentHue + 30) % 360;
          this.handles[2].setFillStyle(Phaser.Display.Color.HSVToRGB(rHue / 360, 1, 1).color, 1);
          this.handles[2].setVisible(true);
        } else if (gameMode === "triadic") {
          const rad1 = mainRad + Phaser.Math.DegToRad(120);
          const rad2 = mainRad + Phaser.Math.DegToRad(240);

          this.handles[1].x = centerX + Math.cos(rad1) * 120;
          this.handles[1].y = centerY + Math.sin(rad1) * 120;
          const hue1 = (this.currentHue + 120) % 360;
          this.handles[1].setFillStyle(Phaser.Display.Color.HSVToRGB(hue1 / 360, 1, 1).color, 1);
          this.handles[1].setVisible(true);

          this.handles[2].x = centerX + Math.cos(rad2) * 120;
          this.handles[2].y = centerY + Math.sin(rad2) * 120;
          const hue2 = (this.currentHue + 240) % 360;
          this.handles[2].setFillStyle(Phaser.Display.Color.HSVToRGB(hue2 / 360, 1, 1).color, 1);
          this.handles[2].setVisible(true);
        }

        // Draw the split center circle
        this.centerDisk.clear();
        if (targetColor) {
          const targetColorHex = Phaser.Display.Color.GetColor(targetColor.r, targetColor.g, targetColor.b);
          // Left side: target
          this.centerDisk.fillStyle(targetColorHex, 1);
          this.centerDisk.slice(centerX, centerY, 60, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(90), true);
          this.centerDisk.fillPath();

          // Right side: player current
          const playerColorHex = Phaser.Display.Color.GetColor(currentR, currentG, currentB);
          this.centerDisk.fillStyle(playerColorHex, 1);
          this.centerDisk.slice(centerX, centerY, 60, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(90), false);
          this.centerDisk.fillPath();
          
          // Draw neat outer stroke border
          const strokeColor = isGameOver ? 0xffaa00 : 0x1a1a1b;
          this.centerDisk.lineStyle(3, strokeColor, 1);
          this.centerDisk.strokeCircle(centerX, centerY, 60);
          
          // Position target indicators/markers on the rim
          const targetHSV = Phaser.Display.Color.RGBToHSV(targetColor.r, targetColor.g, targetColor.b);
          const targetH = targetHSV.h * 360;
          const targetS = targetHSV.s;

          this.targetMarkers.forEach(m => m.setVisible(false));

          // Marker 0
          const tRad = Phaser.Math.DegToRad(targetH);
          const tRadius = gameMode === "saturation" ? (60 + targetS * (135 - 60)) : 120;
          this.targetMarkers[0].x = centerX + Math.cos(tRad) * tRadius;
          this.targetMarkers[0].y = centerY + Math.sin(tRad) * tRadius;
          this.targetMarkers[0].setVisible(isGameOver);

          if (gameMode === "complementary") {
            const oppRad = tRad + Math.PI;
            this.targetMarkers[1].x = centerX + Math.cos(oppRad) * 120;
            this.targetMarkers[1].y = centerY + Math.sin(oppRad) * 120;
            this.targetMarkers[1].setVisible(isGameOver);
          } else if (gameMode === "analogous") {
            const lRad = tRad - Phaser.Math.DegToRad(30);
            const rRad = tRad + Phaser.Math.DegToRad(30);
            this.targetMarkers[1].x = centerX + Math.cos(lRad) * 120;
            this.targetMarkers[1].y = centerY + Math.sin(lRad) * 120;
            this.targetMarkers[1].setVisible(isGameOver);
            this.targetMarkers[2].x = centerX + Math.cos(rRad) * 120;
            this.targetMarkers[2].y = centerY + Math.sin(rRad) * 120;
            this.targetMarkers[2].setVisible(isGameOver);
          } else if (gameMode === "triadic") {
            const rad1 = tRad + Phaser.Math.DegToRad(120);
            const rad2 = tRad + Phaser.Math.DegToRad(240);
            this.targetMarkers[1].x = centerX + Math.cos(rad1) * 120;
            this.targetMarkers[1].y = centerY + Math.sin(rad1) * 120;
            this.targetMarkers[1].setVisible(isGameOver);
            this.targetMarkers[2].x = centerX + Math.cos(rad2) * 120;
            this.targetMarkers[2].y = centerY + Math.sin(rad2) * 120;
            this.targetMarkers[2].setVisible(isGameOver);
          }
        }

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
          this.distanceLabel.setText("Interact with the color wheel & submit a guess!");
          this.distanceLabel.setColor("#64748b");
        }

        // Particle FX triggers
        if (isGameOver && targetColor && !isInitial) {
          const didWin = guesses.some(g => g.isCorrect || g.closeness >= 99);
          if (didWin) {
            playSound("win");
            this.particleEmitter.explode(40, centerX, centerY);
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
  }, [guesses, isGameOver, targetColor, currentR, currentG, currentB, gameMode]);

  return (
    <div id="phaser-game-container" className="flex justify-center select-none overflow-hidden rounded-xl">
      <div ref={containerRef} className="w-[560px] h-[480px] bg-[#09090b] rounded-xl" />
    </div>
  );
}
