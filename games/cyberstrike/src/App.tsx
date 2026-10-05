import React, { useState, useEffect, useRef } from "react";
import { 
  Keyboard, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  Home, 
  Shield as ShieldIcon, 
  Flame, 
  Target, 
  Sparkles, 
  Clock, 
  Award, 
  Zap, 
  Smartphone
} from "lucide-react";
import sfx from "./utils/audio";
import { WORD_PACKS, getRandomWord } from "./utils/words";

// Game State Types
type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";
type Difficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "ZEN";
type ThemeId = "cyberpunk" | "matrix" | "solar" | "frost";
type PowerUpType = "shield" | "freeze" | "bomb" | "double" | null;

// Render-loop Objects (kept in Refs for 60fps performance without React state overhead)
interface ActiveWord {
  id: string;
  text: string;
  typed: string;
  x: number;
  y: number;
  speed: number;
  width: number;
  isBossMissile?: boolean;
  powerUp: PowerUpType;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
  spark: boolean;
}

interface LaserLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  alpha: number;
}

interface HighScore {
  name: string;
  score: number;
  accuracy: number;
  wpm: number;
  difficulty: string;
  pack: string;
  date: string;
}

// Themes mapping
const THEMES = {
  cyberpunk: {
    name: "Cyber Magenta",
    primary: "#f43f5e", // Rose
    secondary: "#06b6d4", // Cyan
    background: "#0a070e",
    grid: "rgba(244, 63, 94, 0.12)",
    shield: "#06b6d4",
    laser: "#06b6d4",
    particle: "#f43f5e",
    accent: "#d946ef" // Fuchsia
  },
  matrix: {
    name: "Digital Green",
    primary: "#22c55e", // Green
    secondary: "#10b981", // Emerald
    background: "#020703",
    grid: "rgba(34, 197, 94, 0.12)",
    shield: "#10b981",
    laser: "#10b981",
    particle: "#22c55e",
    accent: "#84cc16" // Lime
  },
  solar: {
    name: "Solar Flare",
    primary: "#f97316", // Orange
    secondary: "#eab308", // Yellow
    background: "#080301",
    grid: "rgba(249, 115, 22, 0.12)",
    shield: "#eab308",
    laser: "#eab308",
    particle: "#f97316",
    accent: "#ef4444" // Red
  },
  frost: {
    name: "Frost Overdrive",
    primary: "#3b82f6", // Blue
    secondary: "#06b6d4", // Cyan
    background: "#010512",
    grid: "rgba(59, 130, 246, 0.12)",
    shield: "#06b6d4",
    laser: "#3b82f6",
    particle: "#06b6d4",
    accent: "#60a5fa" // Light Blue
  }
};

// Initial High Scores
const DEFAULT_HIGH_SCORES: HighScore[] = [
  { name: "NEO_TYPIST", score: 8500, accuracy: 98, wpm: 85, difficulty: "HARD", pack: "Cyber Hacker", date: "2026-03-01" },
  { name: "NETRUNNER", score: 6200, accuracy: 94, wpm: 72, difficulty: "MEDIUM", pack: "Cyber Hacker", date: "2026-03-01" },
  { name: "CYBER_PUNK", score: 4500, accuracy: 91, wpm: 58, difficulty: "MEDIUM", pack: "Classic Arcade", date: "2026-03-02" },
  { name: "GIGA_CODER", score: 3100, accuracy: 93, wpm: 45, difficulty: "EASY", pack: "Developer Edition", date: "2026-03-02" },
  { name: "NOOB_HACKER", score: 1200, accuracy: 82, wpm: 25, difficulty: "EASY", pack: "Classic Arcade", date: "2026-03-03" }
];

export default function App() {
  // --- Game Settings & Configuration States ---
  const [gameState, setGameState] = useState<GameState>("START");
  const [theme, setTheme] = useState<ThemeId>("cyberpunk");
  const [selectedPack, setSelectedPack] = useState<string>("cyberpunk");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  
  // --- Audio Settings ---
  const [isMuted, setIsMuted] = useState(false);
  const [sfxVol, setSfxVol] = useState(0.6);
  const [musicVol, setMusicVol] = useState(0.35);

  // --- Real-time Scoring States (synchronized from refs on key events) ---
  const [score, setScore] = useState(0);
  const [shield, setShield] = useState(100);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  
  // --- Stats tracking for Game Over panel ---
  const [correctLetters, setCorrectLetters] = useState(0);
  const [totalLettersTyped, setTotalLettersTyped] = useState(0);
  const [completedWordsCount, setCompletedWordsCount] = useState(0);
  const [activeTargetWord, setActiveTargetWord] = useState<string | null>(null);
  
  // --- Boss States (visible in UI overlay) ---
  const [bossActive, setBossActive] = useState(false);
  const [bossHealth, setBossHealth] = useState(100);
  const [bossMaxHealth, setBossMaxHealth] = useState(100);
  const [bossStage, setBossStage] = useState(1);

  // --- Interactive Virtual Keyboard ---
  const [activeKeys, setActiveKeys] = useState<{ [key: string]: boolean }>({});
  const [mobileInputValue, setMobileInputValue] = useState("");
  const [isVirtualKeyboardVisible, setIsVirtualKeyboardVisible] = useState(false);
  
  // --- High Score Leaderboard ---
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [isHighScoreSaved, setIsHighScoreSaved] = useState(false);

  // --- HTML Canvas & Timing Refs (prevents React lag) ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wordsRef = useRef<ActiveWord[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lasersRef = useRef<LaserLine[]>([]);
  
  // Game metrics references for instant calculations in game loop
  const scoreRef = useRef(0);
  const shieldRef = useRef(100);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const correctLettersRef = useRef(0);
  const totalLettersTypedRef = useRef(0);
  const completedWordsRef = useRef(0);
  const levelRef = useRef(1);

  // Timing refs
  const lastSpawnTimeRef = useRef(0);
  const gameTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const elapsedPausedTimeRef = useRef(0);
  const pauseStartTimeRef = useRef(0);
  
  // Boss tracking refs
  const bossActiveRef = useRef(false);
  const bossPhraseRef = useRef("");
  const bossTypedRef = useRef("");
  const bossHealthRef = useRef(100);
  const bossMaxHealthRef = useRef(100);
  const bossStageRef = useRef(1);
  
  // Screen Shake Refs
  const shakeTimeRef = useRef(0);
  const shakeIntensityRef = useRef(0);

  // Power Up state references
  const freezeTimeRemainingRef = useRef(0); // in frames or milliseconds
  const doubleScoreRemainingRef = useRef(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isDoubleScore, setIsDoubleScore] = useState(false);

  // Mobile keyboard focus ref
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  // Visual Theme mapping
  const currentTheme = THEMES[theme];

  // Load High Scores on mount
  useEffect(() => {
    const scores = localStorage.getItem("cyberstrike-highscores");
    if (scores) {
      setHighScores(JSON.parse(scores));
    } else {
      localStorage.setItem("cyberstrike-highscores", JSON.stringify(DEFAULT_HIGH_SCORES));
      setHighScores(DEFAULT_HIGH_SCORES);
    }
  }, []);

  // Sync audio volumes with our synthetic audio engine
  useEffect(() => {
    sfx.setSfxVolume(sfxVol);
  }, [sfxVol]);

  useEffect(() => {
    sfx.setMusicVolume(musicVol);
  }, [musicVol]);

  // Synchronize state variable when user toggles mute
  const handleToggleMute = () => {
    const mutedState = sfx.toggleMute();
    setIsMuted(mutedState);
  };

  // --- Reset/Start Game ---
  const startGame = () => {
    sfx.resume();
    sfx.stopMusic();
    sfx.startMusic();
    
    // Clear all gaming refs
    wordsRef.current = [];
    particlesRef.current = [];
    lasersRef.current = [];
    
    scoreRef.current = 0;
    shieldRef.current = 100;
    comboRef.current = 0;
    maxComboRef.current = 0;
    correctLettersRef.current = 0;
    totalLettersTypedRef.current = 0;
    completedWordsRef.current = 0;
    levelRef.current = 1;
    
    lastSpawnTimeRef.current = Date.now();
    gameTimeRef.current = 0;
    startTimeRef.current = Date.now();
    elapsedPausedTimeRef.current = 0;
    pauseStartTimeRef.current = 0;
    
    bossActiveRef.current = false;
    bossPhraseRef.current = "";
    bossTypedRef.current = "";
    bossHealthRef.current = 100;
    bossStageRef.current = 1;

    freezeTimeRemainingRef.current = 0;
    doubleScoreRemainingRef.current = 0;

    // Synchronize React UI states
    setScore(0);
    setShield(100);
    setCombo(0);
    setMaxCombo(0);
    setLevel(1);
    setCorrectLetters(0);
    setTotalLettersTyped(0);
    setCompletedWordsCount(0);
    setActiveTargetWord(null);
    setBossActive(false);
    setIsFrozen(false);
    setIsDoubleScore(false);
    setIsHighScoreSaved(false);
    setPlayerName("");
    
    setGameState("PLAYING");

    // Automatically focus invisible mobile keyboard input if keyboard visible
    if (isVirtualKeyboardVisible) {
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 300);
    }
  };

  const pauseGame = () => {
    if (gameState !== "PLAYING") return;
    setGameState("PAUSED");
    pauseStartTimeRef.current = Date.now();
    sfx.stopMusic();
  };

  const resumeGame = () => {
    if (gameState !== "PAUSED") return;
    setGameState("PLAYING");
    if (pauseStartTimeRef.current > 0) {
      elapsedPausedTimeRef.current += Date.now() - pauseStartTimeRef.current;
    }
    sfx.startMusic();
    
    // refocus mobile helper
    if (isVirtualKeyboardVisible) {
      hiddenInputRef.current?.focus();
    }
  };

  const endGame = () => {
    setGameState("GAMEOVER");
    sfx.stopMusic();
    sfx.playGameOver();
  };

  const returnToMenu = () => {
    setGameState("START");
    sfx.stopMusic();
  };

  // --- Trigger Screen Shake ---
  const triggerScreenShake = (intensity: number, duration: number) => {
    shakeIntensityRef.current = intensity;
    shakeTimeRef.current = duration; // in frames
  };

  // --- Trigger Explosion Particles ---
  const createExplosion = (x: number, y: number, count = 18, customColor?: string) => {
    const colors = customColor ? [customColor, "#fff"] : [currentTheme.primary, currentTheme.secondary, "#ffffff"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 1.5), // slight upward bias
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: 0.015 + Math.random() * 0.025,
        gravity: 0.04 + Math.random() * 0.04,
        spark: Math.random() > 0.4
      });
    }
  };

  // --- Laser Effect Creator ---
  const createLaser = (endX: number, endY: number) => {
    if (!canvasRef.current) return;
    // Origin of laser is the bottom center defense platform
    lasersRef.current.push({
      startX: canvasRef.current.width / 2,
      startY: canvasRef.current.height - 20,
      endX,
      endY,
      color: currentTheme.laser,
      alpha: 1.0
    });
  };

  // --- Handle Core Key Press / Key Strike ---
  const processKeystroke = (char: string) => {
    if (gameState !== "PLAYING") return;
    const key = char.toUpperCase();

    // Trigger visual key press feedback on keyboard
    setActiveKeys(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setActiveKeys(prev => ({ ...prev, [key]: false }));
    }, 130);

    totalLettersTypedRef.current += 1;

    // 1. Is a Boss battle active?
    if (bossActiveRef.current) {
      const phrase = bossPhraseRef.current;
      const typed = bossTypedRef.current;
      
      // Check if we typed the next required character
      const nextCharNeeded = phrase[typed.length];
      
      // Boss phrase characters can be spaces. If next is a space, require space!
      if (key === nextCharNeeded || (nextCharNeeded === " " && key === " ")) {
        // Correct letter on boss
        const updatedTyped = typed + nextCharNeeded;
        bossTypedRef.current = updatedTyped;
        correctLettersRef.current += 1;
        comboRef.current += 1;
        if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
        
        sfx.playKeypress(true);

        // Find canvas center for boss and create laser
        if (canvasRef.current) {
          const bossX = canvasRef.current.width / 2;
          const bossY = 100;
          createLaser(bossX, bossY);
          createExplosion(bossX + (Math.random() * 100 - 50), bossY + 20, 3, currentTheme.secondary);
        }

        // Did we complete the boss stage phrase?
        if (updatedTyped.length === phrase.length) {
          // Progress boss health down
          const damage = Math.ceil(100 / 3); // 3 stages
          bossHealthRef.current = Math.max(0, bossHealthRef.current - damage);
          
          if (bossHealthRef.current <= 0) {
            // Boss fully defeated!
            sfx.playWordDestroy(true); // boss explosion sound
            if (canvasRef.current) {
              createExplosion(canvasRef.current.width / 2, 100, 45);
              triggerScreenShake(18, 40);
            }
            
            // Big rewards
            let bonus = 500;
            if (doubleScoreRemainingRef.current > 0) bonus *= 2;
            scoreRef.current += bonus;
            shieldRef.current = Math.min(100, shieldRef.current + 30);
            completedWordsRef.current += 1;

            bossActiveRef.current = false;
            setBossActive(false);
          } else {
            // Stage completed, advance to next stage of boss
            sfx.playWordDestroy(false);
            bossStageRef.current += 1;
            setBossStage(bossStageRef.current);
            
            // Select new hard/boss phrase
            bossPhraseRef.current = getRandomWord(selectedPack, "boss");
            bossTypedRef.current = "";
          }
        }
      } else {
        // Missed key during boss
        comboRef.current = 0;
        sfx.playKeypress(false);
        // Boss triggers slight recoil on mistake in expert
        if (difficulty === "EXPERT") {
          shieldRef.current = Math.max(0, shieldRef.current - 1);
        }
      }

      // Sync React UI
      setScore(scoreRef.current);
      setShield(shieldRef.current);
      setCombo(comboRef.current);
      setMaxCombo(maxComboRef.current);
      setCorrectLetters(correctLettersRef.current);
      setTotalLettersTyped(totalLettersTypedRef.current);
      setCompletedWordsCount(completedWordsRef.current);
      setActiveTargetWord(bossPhraseRef.current.substring(0, bossTypedRef.current.length) + "_" + bossPhraseRef.current.substring(bossTypedRef.current.length));
      return;
    }

    // 2. Normal Mode typing checks
    const activeTargetId = wordsRef.current.findIndex(w => w.typed.length > 0 && w.typed.length < w.text.length);
    
    if (activeTargetId !== -1) {
      // We already have an active word lock
      const targetWord = wordsRef.current[activeTargetId];
      const nextCharNeeded = targetWord.text[targetWord.typed.length];
      
      if (key === nextCharNeeded) {
        // Correct letter
        targetWord.typed += key;
        correctLettersRef.current += 1;
        comboRef.current += 1;
        if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;

        sfx.playKeypress(true);
        createLaser(targetWord.x, targetWord.y);
        createExplosion(targetWord.x + (Math.random() * 20 - 10), targetWord.y, 2, currentTheme.secondary);

        // Word completed!
        if (targetWord.typed.length === targetWord.text.length) {
          sfx.playWordDestroy(false);
          createExplosion(targetWord.x, targetWord.y, 16);
          triggerScreenShake(5, 12);
          
          // Apply score
          let points = targetWord.text.length * 10;
          // Apply multipliers
          const comboMult = Math.min(5, Math.floor(comboRef.current / 8) + 1);
          points *= comboMult;
          if (doubleScoreRemainingRef.current > 0) points *= 2;
          
          // Difficulty scale
          const diffMult = difficulty === "EASY" ? 0.8 : difficulty === "MEDIUM" ? 1.0 : difficulty === "HARD" ? 1.3 : difficulty === "EXPERT" ? 1.6 : 0.6;
          points = Math.round(points * diffMult);
          
          scoreRef.current += points;
          completedWordsRef.current += 1;

          // Check for Power-Up
          if (targetWord.powerUp) {
            applyPowerUp(targetWord.powerUp);
          }

          // Remove word
          wordsRef.current = wordsRef.current.filter(w => w.id !== targetWord.id);
          setActiveTargetWord(null);

          // Check if we should advance level
          const nextLevel = Math.floor(scoreRef.current / 400) + 1;
          if (nextLevel > levelRef.current) {
            levelRef.current = nextLevel;
            sfx.playPowerup(); // chime sound on level up!
            triggerScreenShake(12, 20);
            
            // Check for Boss battle trigger (e.g., boss appears on level transitions like 4, 7, 10...)
            if (levelRef.current % 3 === 0 && !bossActiveRef.current) {
              triggerBossBattle();
            }
          }
        } else {
          setActiveTargetWord(targetWord.text.substring(0, targetWord.typed.length) + "_" + targetWord.text.substring(targetWord.typed.length));
        }
      } else {
        // Wrong letter typed on locked word
        comboRef.current = 0;
        sfx.playKeypress(false);
        // Float an error spark
        if (canvasRef.current) {
          createExplosion(targetWord.x, targetWord.y - 10, 4, "#ef4444");
        }
      }
    } else {
      // No current target lock. Find a word that starts with this key!
      // If multiple, prioritize the word lowest down (highest Y coordinate, most dangerous!)
      let bestMatchIdx = -1;
      let highestY = -1;
      
      wordsRef.current.forEach((word, idx) => {
        if (word.text.startsWith(key) && word.y > highestY) {
          highestY = word.y;
          bestMatchIdx = idx;
        }
      });

      if (bestMatchIdx !== -1) {
        // Locked onto a word!
        const matchedWord = wordsRef.current[bestMatchIdx];
        matchedWord.typed = key;
        correctLettersRef.current += 1;
        comboRef.current += 1;
        if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;

        sfx.playKeypress(true);
        createLaser(matchedWord.x, matchedWord.y);
        createExplosion(matchedWord.x, matchedWord.y, 4, currentTheme.secondary);

        // In case it's a 1-letter word (rare but possible with custom packs)
        if (matchedWord.typed.length === matchedWord.text.length) {
          sfx.playWordDestroy(false);
          createExplosion(matchedWord.x, matchedWord.y, 16);
          scoreRef.current += matchedWord.text.length * 10;
          completedWordsRef.current += 1;
          wordsRef.current = wordsRef.current.filter(w => w.id !== matchedWord.id);
          setActiveTargetWord(null);
        } else {
          setActiveTargetWord(matchedWord.text.substring(0, 1) + "_" + matchedWord.text.substring(1));
        }
      } else {
        // Typed letter didn't match any starting letter
        comboRef.current = 0;
        sfx.playKeypress(false);
      }
    }

    // Sync React UI
    setScore(scoreRef.current);
    setShield(shieldRef.current);
    setCombo(comboRef.current);
    setMaxCombo(maxComboRef.current);
    setCorrectLetters(correctLettersRef.current);
    setTotalLettersTyped(totalLettersTypedRef.current);
    setLevel(levelRef.current);
    setCompletedWordsCount(completedWordsRef.current);
  };

  // --- Trigger Boss Battle ---
  const triggerBossBattle = () => {
    sfx.playBossWarning();
    bossActiveRef.current = true;
    bossHealthRef.current = 100;
    bossMaxHealthRef.current = 100;
    bossStageRef.current = 1;
    
    bossPhraseRef.current = getRandomWord(selectedPack, "boss");
    bossTypedRef.current = "";

    // Explode all active small words with no scores
    if (canvasRef.current) {
      wordsRef.current.forEach(w => {
        createExplosion(w.x, w.y, 8);
      });
    }
    wordsRef.current = [];
    setActiveTargetWord(null);

    setBossActive(true);
    setBossHealth(100);
    setBossMaxHealth(100);
    setBossStage(1);
  };

  // --- Apply Power-Ups ---
  const applyPowerUp = (type: PowerUpType) => {
    sfx.playPowerup();
    if (type === "shield") {
      shieldRef.current = Math.min(100, shieldRef.current + 25);
      setShield(shieldRef.current);
      if (canvasRef.current) {
        createExplosion(canvasRef.current.width / 2, canvasRef.current.height - 20, 20, "#22c55e");
      }
    } else if (type === "freeze") {
      freezeTimeRemainingRef.current = 360; // Approx 6 seconds at 60fps
      setIsFrozen(true);
    } else if (type === "bomb") {
      triggerScreenShake(15, 25);
      if (canvasRef.current) {
        // Shockwave effect
        createExplosion(canvasRef.current.width / 2, canvasRef.current.height / 2, 40, "#f97316");
        wordsRef.current.forEach(word => {
          createExplosion(word.x, word.y, 16);
          let points = word.text.length * 10;
          if (doubleScoreRemainingRef.current > 0) points *= 2;
          scoreRef.current += points;
          completedWordsRef.current += 1;
        });
      }
      wordsRef.current = [];
      setActiveTargetWord(null);
      setScore(scoreRef.current);
      setCompletedWordsCount(completedWordsRef.current);
    } else if (type === "double") {
      doubleScoreRemainingRef.current = 480; // Approx 8 seconds at 60fps
      setIsDoubleScore(true);
    }
  };

  // --- Keyboard input listener for desktop physical keys ---
  useEffect(() => {
    const handlePhysicalKeyDown = (e: KeyboardEvent) => {
      // Ignore functional hotkeys like Ctrl+R, F12, Cmd+Opt+I
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      // Let Escape pause/resume
      if (e.key === "Escape") {
        if (gameState === "PLAYING") pauseGame();
        else if (gameState === "PAUSED") resumeGame();
        return;
      }

      // Capture single keys A-Z and Spacebar
      if (e.key.length === 1) {
        processKeystroke(e.key);
      }
    };

    window.addEventListener("keydown", handlePhysicalKeyDown);
    return () => {
      window.removeEventListener("keydown", handlePhysicalKeyDown);
    };
  }, [gameState, selectedPack, difficulty, isVirtualKeyboardVisible]);

  // --- Mobile Keyboard input synchronization ---
  const handleMobileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length > 0) {
      const lastChar = val[val.length - 1];
      processKeystroke(lastChar);
    }
    setMobileInputValue("");
  };

  // --- CANVAS RENDERING AND GAME ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = rect?.width || 800;
      canvas.height = Math.max(450, rect?.height || 550);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Dynamic Starfield values
    const stars: { x: number; y: number; speed: number; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * 1000, // scaled later
        y: Math.random() * 1000,
        speed: 0.2 + Math.random() * 0.8,
        size: 0.5 + Math.random() * 1.5
      });
    }

    const frame = () => {
      if (gameState === "PLAYING") {
        gameTimeRef.current += 1;

        // Update Freeze Timer
        if (freezeTimeRemainingRef.current > 0) {
          freezeTimeRemainingRef.current -= 1;
          if (freezeTimeRemainingRef.current === 0) {
            setIsFrozen(false);
          }
        }

        // Update Double Score Timer
        if (doubleScoreRemainingRef.current > 0) {
          doubleScoreRemainingRef.current -= 1;
          if (doubleScoreRemainingRef.current === 0) {
            setIsDoubleScore(false);
          }
        }

        // --- WORD SPAWNING PHYSICS ---
        const levelMult = levelRef.current * 0.15;
        const speedMultiplier = difficulty === "EASY" ? 0.7 : difficulty === "MEDIUM" ? 1.0 : difficulty === "HARD" ? 1.3 : difficulty === "EXPERT" ? 1.7 : 0.55;
        const baseSpeed = (1.1 + levelMult) * speedMultiplier;
        
        let spawnRate = difficulty === "EASY" ? 3400 : difficulty === "MEDIUM" ? 2700 : difficulty === "HARD" ? 2000 : difficulty === "EXPERT" ? 1400 : 3800;
        
        // Spawn faster at higher levels, up to 60% faster
        spawnRate = Math.max(1000, spawnRate - (levelRef.current * 80));

        const now = Date.now();
        const actualSpawnRate = isFrozen ? spawnRate * 1.8 : spawnRate;

        // Spawn a normal word if no boss is active
        if (!bossActiveRef.current && now - lastSpawnTimeRef.current > actualSpawnRate) {
          lastSpawnTimeRef.current = now;

          // Determine difficulty of individual word to spawn
          let wordDiff: "easy" | "medium" | "hard" = "easy";
          const r = Math.random();
          if (levelRef.current >= 6) {
            wordDiff = r < 0.25 ? "easy" : r < 0.65 ? "medium" : "hard";
          } else if (levelRef.current >= 3) {
            wordDiff = r < 0.4 ? "easy" : r < 0.9 ? "medium" : "hard";
          } else {
            wordDiff = r < 0.75 ? "easy" : "medium";
          }

          const text = getRandomWord(selectedPack, wordDiff);
          
          // Decide if powerup (15% chance, never Zen mode)
          let powerUp: PowerUpType = null;
          if (Math.random() < 0.16 && difficulty !== "ZEN") {
            const types: PowerUpType[] = ["shield", "freeze", "bomb", "double"];
            powerUp = types[Math.floor(Math.random() * types.length)];
          }

          // Randomize starting x ensuring it fits inside margins
          ctx.font = "20px 'Share Tech Mono'";
          const wWidth = ctx.measureText(text).width + 24;
          const x = wWidth/2 + Math.random() * (canvas.width - wWidth);

          wordsRef.current.push({
            id: Math.random().toString(),
            text,
            typed: "",
            x,
            y: -10,
            speed: baseSpeed * (0.8 + Math.random() * 0.4),
            width: wWidth,
            powerUp,
            color: powerUp === "shield" ? "#10b981" : powerUp === "freeze" ? "#06b6d4" : powerUp === "bomb" ? "#f97316" : powerUp === "double" ? "#eab308" : currentTheme.primary
          });
        }

        // Spawn Boss missiles (if Boss is active, spawns tiny protective words every 2.5s)
        if (bossActiveRef.current && now - lastSpawnTimeRef.current > 2400) {
          lastSpawnTimeRef.current = now;
          const text = getRandomWord(selectedPack, "easy");
          
          ctx.font = "16px 'Share Tech Mono'";
          const wWidth = ctx.measureText(text).width + 16;
          const x = wWidth/2 + Math.random() * (canvas.width - wWidth);

          wordsRef.current.push({
            id: Math.random().toString(),
            text,
            typed: "",
            x,
            y: 80, // fire from boss height
            speed: baseSpeed * 1.4, // missile is fast!
            width: wWidth,
            isBossMissile: true,
            powerUp: null,
            color: "#f87171" // glowing light red
          });
        }

        // --- UPDATE POSITIONS & CHECK SHIELD COLLISIONS ---
        const shieldLineY = canvas.height * 0.85;
        
        wordsRef.current.forEach(word => {
          let wordSpeed = word.speed;
          if (isFrozen) wordSpeed *= 0.4;
          
          word.y += wordSpeed;

          // Check if word hit shield
          if (word.y >= shieldLineY) {
            // Damage! (If not ZEN difficulty)
            if (difficulty !== "ZEN") {
              const damage = word.isBossMissile ? 8 : (10 + word.text.length);
              shieldRef.current = Math.max(0, shieldRef.current - damage);
              sfx.playShieldDamage();
              triggerScreenShake(12, 18);
              createExplosion(word.x, word.y, 16, "#f43f5e");
            } else {
              // Zen mode: just clear nicely
              sfx.playWordDestroy(false);
              createExplosion(word.x, word.y, 8, currentTheme.secondary);
            }

            // If the completed word was current active target, reset active lock
            if (word.typed.length > 0) {
              setActiveTargetWord(null);
            }

            // Remove word
            wordsRef.current = wordsRef.current.filter(w => w.id !== word.id);
            setShield(shieldRef.current);
            comboRef.current = 0;
            setCombo(0);

            // Check gameover trigger
            if (shieldRef.current <= 0 && difficulty !== "ZEN") {
              endGame();
            }
          }
        });

        // --- UPDATE PARTICLES ---
        particlesRef.current.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.alpha -= p.decay;
        });
        particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

        // --- UPDATE LASERS ---
        lasersRef.current.forEach(l => {
          l.alpha -= 0.16;
        });
        lasersRef.current = lasersRef.current.filter(l => l.alpha > 0);
      }

      // --- CLEAR CANVAS ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- SCREEN SHAKE TRANSLATE ---
      ctx.save();
      if (shakeTimeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensityRef.current;
        const dy = (Math.random() - 0.5) * shakeIntensityRef.current;
        ctx.translate(dx, dy);
        shakeTimeRef.current -= 1;
      }

      // --- DRAW BACKGROUND SCI-FI SCENERY ---
      // 1. Scrolling Starfield
      ctx.fillStyle = "#ffffff";
      stars.forEach(s => {
        const starX = (s.x) % canvas.width;
        // speed up star velocity slightly if frozen
        let speed = s.speed;
        if (isFrozen) speed *= 0.35;
        s.y = (s.y + speed) % canvas.height;
        
        ctx.globalAlpha = 0.2 + (s.speed * 0.4);
        ctx.beginPath();
        ctx.arc(starX, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 2. Neon Scrolling perspective Grid
      const horizon = canvas.height * 0.1;
      const centerY = horizon;
      const centerX = canvas.width / 2;
      ctx.strokeStyle = currentTheme.grid;
      ctx.lineWidth = 1;

      // Vertical converging lines
      const numGridLines = 18;
      for (let i = 0; i <= numGridLines; i++) {
        const xRatio = i / numGridLines;
        const targetX = canvas.width * xRatio;
        ctx.beginPath();
        // starts close to horizon center, radiates to bottom edge
        ctx.moveTo(centerX + (targetX - centerX) * 0.12, centerY);
        ctx.lineTo(targetX, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines in exponential perspective
      let scrollSpeedFactor = 0.015;
      if (isFrozen) scrollSpeedFactor *= 0.4;
      const gridTime = (gameTimeRef.current * scrollSpeedFactor) % 1.0;
      const numHorizLines = 9;
      for (let i = 0; i < numHorizLines; i++) {
        const ratio = (i + gridTime) / numHorizLines;
        const y = centerY + Math.pow(ratio, 2.3) * (canvas.height - centerY);
        ctx.beginPath();
        ctx.moveTo(centerX - centerX * ratio * 1.5, y);
        ctx.lineTo(centerX + centerX * ratio * 1.5, y);
        ctx.stroke();
      }

      // --- DRAW LASERS ---
      lasersRef.current.forEach(l => {
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 3 + l.alpha * 4;
        ctx.globalAlpha = l.alpha;
        
        // Draw main laser beam
        ctx.beginPath();
        ctx.moveTo(l.startX, l.startY);
        ctx.lineTo(l.endX, l.endY);
        ctx.stroke();
        
        // Add heavy core glow
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1 + l.alpha * 2;
        ctx.beginPath();
        ctx.moveTo(l.startX, l.startY);
        ctx.lineTo(l.endX, l.endY);
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;

      // --- DRAW PARTICLES ---
      particlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        
        if (p.spark) {
          // Glow core for sparkles
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });
      ctx.globalAlpha = 1.0;

      // --- DRAW BOTTOM DEFENSE SHIELD ---
      const shieldY = canvas.height * 0.85;
      const shieldGradient = ctx.createLinearGradient(0, shieldY, 0, canvas.height);
      shieldGradient.addColorStop(0, "rgba(6, 182, 212, 0.0)");
      shieldGradient.addColorStop(0.05, currentTheme.secondary + "40"); // 25% opacity
      shieldGradient.addColorStop(1.0, currentTheme.primary + "10"); // 10% opacity

      ctx.fillStyle = shieldGradient;
      ctx.fillRect(0, shieldY, canvas.width, canvas.height - shieldY);

      // Glowing border line for shield
      ctx.strokeStyle = currentTheme.shield;
      ctx.lineWidth = 3 + Math.sin(gameTimeRef.current * 0.08) * 1.5;
      ctx.shadowColor = currentTheme.shield;
      ctx.shadowBlur = 8 + Math.sin(gameTimeRef.current * 0.08) * 4;
      
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(canvas.width, shieldY);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset glow

      // Draw bottom defense turret cannon
      const tX = canvas.width / 2;
      const tY = canvas.height - 15;
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = currentTheme.secondary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tX, tY, 25, Math.PI, 0); // half circle
      ctx.fill();
      ctx.stroke();

      // Gun barrels
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(tX - 6, tY - 32, 12, 18);
      ctx.strokeStyle = currentTheme.primary;
      ctx.strokeRect(tX - 6, tY - 32, 12, 18);

      // --- DRAW BOSS ENEMY ---
      if (bossActiveRef.current) {
        const bX = canvas.width / 2;
        const bY = 90;
        
        // Draw boss glowing core box
        ctx.fillStyle = "rgba(18, 10, 15, 0.9)";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3 + Math.sin(gameTimeRef.current * 0.1) * 1.5;
        
        // Boss Outer shield circle
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12 + Math.sin(gameTimeRef.current * 0.1) * 6;
        
        ctx.beginPath();
        ctx.arc(bX, bY, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw warning indicators
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bX, bY, 55 + Math.sin(gameTimeRef.current * 0.05) * 6, 0, Math.PI * 2);
        ctx.stroke();

        // Draw mechanical side-wings
        ctx.fillStyle = "#1e1b4b";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        // Left wing
        ctx.beginPath();
        ctx.moveTo(bX - 40, bY - 5);
        ctx.lineTo(bX - 110, bY - 15);
        ctx.lineTo(bX - 100, bY + 15);
        ctx.lineTo(bX - 35, bY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Right wing
        ctx.beginPath();
        ctx.moveTo(bX + 40, bY - 5);
        ctx.lineTo(bX + 110, bY - 15);
        ctx.lineTo(bX + 100, bY + 15);
        ctx.lineTo(bX + 35, bY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw boss phrase label
        const phrase = bossPhraseRef.current;
        const typed = bossTypedRef.current;
        
        ctx.font = "24px 'Share Tech Mono'";
        const phraseWidth = ctx.measureText(phrase).width;
        const pX = bX - phraseWidth / 2;
        const pY = bY + 65;

        // Dark tag behind the text for absolute readability
        ctx.fillStyle = "rgba(5, 2, 8, 0.85)";
        ctx.fillRect(pX - 15, pY - 22, phraseWidth + 30, 32);
        ctx.strokeStyle = "#f87171";
        ctx.strokeRect(pX - 15, pY - 22, phraseWidth + 30, 32);

        // Draw text: Typed green, Untyped red-ish
        const charWidth = phraseWidth / phrase.length;
        for (let i = 0; i < phrase.length; i++) {
          const char = phrase[i];
          const isTyped = i < typed.length;
          
          ctx.fillStyle = isTyped ? "#22c55e" : "#f87171";
          if (isTyped) {
            ctx.shadowColor = "#22c55e";
            ctx.shadowBlur = 8;
          } else {
            ctx.shadowColor = "#f87171";
            ctx.shadowBlur = 2;
          }
          ctx.fillText(char, pX + i * charWidth, pY + 2);
          ctx.shadowBlur = 0;
        }

        // Draw "BOSS CRITICAL" text above core
        ctx.font = "12px 'Orbitron'";
        ctx.fillStyle = "#f87171";
        ctx.fillText("CORE OVERLORD [STAGE " + bossStageRef.current + "/3]", bX - 85, bY - 60);
      }

      // --- DRAW FALLING WORDS ---
      wordsRef.current.forEach(word => {
        const text = word.text;
        const typedText = word.typed;

        ctx.font = word.isBossMissile ? "15px 'Share Tech Mono'" : "20px 'Share Tech Mono'";
        const singleCharWidth = ctx.measureText("A").width;
        const totalWordWidth = ctx.measureText(text).width;

        const padX = 12;
        const padY = 8;
        const boxW = totalWordWidth + padX * 2;
        const boxH = 26 + padY * 2;
        const boxX = word.x - boxW / 2;
        const boxY = word.y - boxH / 2;

        // Word Card Background
        ctx.fillStyle = "rgba(10, 8, 14, 0.88)";
        
        // Target outline glow
        const isLocked = typedText.length > 0;
        
        ctx.shadowBlur = isLocked ? 10 : 4;
        ctx.shadowColor = isLocked ? currentTheme.secondary : word.color;
        ctx.strokeStyle = isLocked ? currentTheme.secondary : word.color;
        ctx.lineWidth = isLocked ? 2 : 1.2;

        // Draw Rounded Card
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Draw animating fighter lock-on corners if locked target
        if (isLocked) {
          ctx.strokeStyle = currentTheme.secondary;
          ctx.lineWidth = 2.5;
          const len = 7;
          
          // Top Left Corner Bracket
          ctx.beginPath();
          ctx.moveTo(boxX - 6, boxY - 6 + len);
          ctx.lineTo(boxX - 6, boxY - 6);
          ctx.lineTo(boxX - 6 + len, boxY - 6);
          ctx.stroke();

          // Top Right Corner Bracket
          ctx.beginPath();
          ctx.moveTo(boxX + boxW + 6, boxY - 6 + len);
          ctx.lineTo(boxX + boxW + 6, boxY - 6);
          ctx.lineTo(boxX + boxW + 6 - len, boxY - 6);
          ctx.stroke();

          // Bottom Left Corner Bracket
          ctx.beginPath();
          ctx.moveTo(boxX - 6, boxY + boxH + 6 - len);
          ctx.lineTo(boxX - 6, boxY + boxH + 6);
          ctx.lineTo(boxX - 6 + len, boxY + boxH + 6);
          ctx.stroke();

          // Bottom Right Corner Bracket
          ctx.beginPath();
          ctx.moveTo(boxX + boxW + 6, boxY + boxH + 6 - len);
          ctx.lineTo(boxX + boxW + 6, boxY + boxH + 6);
          ctx.lineTo(boxX + boxW + 6 - len, boxY + boxH + 6);
          ctx.stroke();
        }

        // Draw Badge for Powerups
        if (word.powerUp) {
          let badgeText = "⚡";
          let badgeColor = "#ffffff";
          if (word.powerUp === "shield") { badgeText = "🛡️"; badgeColor = "#10b981"; }
          if (word.powerUp === "freeze") { badgeText = "❄️"; badgeColor = "#06b6d4"; }
          if (word.powerUp === "bomb") { badgeText = "💥"; badgeColor = "#f97316"; }
          if (word.powerUp === "double") { badgeText = "👑"; badgeColor = "#eab308"; }

          ctx.font = "12px sans-serif";
          ctx.fillStyle = badgeColor;
          ctx.fillText(badgeText, boxX + 6, boxY - 8);
        }

        // Draw actual word letters
        ctx.font = word.isBossMissile ? "15px 'Share Tech Mono'" : "20px 'Share Tech Mono'";
        const startTextX = word.x - totalWordWidth / 2;
        const textY = word.y + 6;

        for (let j = 0; j < text.length; j++) {
          const char = text[j];
          const hasBeenTyped = j < typedText.length;
          
          if (hasBeenTyped) {
            ctx.fillStyle = "#22c55e"; // bright neon green
            ctx.shadowColor = "#22c55e";
            ctx.shadowBlur = 6;
          } else {
            ctx.fillStyle = isLocked ? "#94a3b8" : "#ffffff";
            ctx.shadowBlur = 0;
          }

          ctx.fillText(char, startTextX + j * singleCharWidth, textY);
          ctx.shadowBlur = 0; // reset
        }
      });

      // Restore Screen Shake Translates
      ctx.restore();

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [gameState, theme, selectedPack, difficulty, isFrozen]);

  // Handle Score Leaderboard Saving
  const handleSaveHighScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const acc = Math.round((correctLetters / (totalLettersTyped || 1)) * 100);
    // Standard WPM: characters / 5 / minutes
    const gameDurationMinutes = (Date.now() - startTimeRef.current - elapsedPausedTimeRef.current) / 60000 || 1;
    const finalWpm = Math.round((correctLetters / 5) / (gameDurationMinutes || 1));

    const newRecord: HighScore = {
      name: playerName.toUpperCase().substring(0, 12),
      score,
      accuracy: isNaN(acc) ? 0 : acc,
      wpm: finalWpm,
      difficulty,
      pack: WORD_PACKS.find(p => p.id === selectedPack)?.name || "Arcade",
      date: new Date().toISOString().split("T")[0]
    };

    const updatedLeaderboard = [...highScores, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Keep top 8

    localStorage.setItem("cyberstrike-highscores", JSON.stringify(updatedLeaderboard));
    setHighScores(updatedLeaderboard);
    setIsHighScoreSaved(true);
  };

  // Get Rank label based on WPM and Accuracy
  const getRank = () => {
    const acc = Math.round((correctLetters / (totalLettersTyped || 1)) * 100);
    const gameDurationMinutes = (Date.now() - startTimeRef.current - elapsedPausedTimeRef.current) / 60000 || 1;
    const finalWpm = Math.round((correctLetters / 5) / (gameDurationMinutes || 1));

    if (finalWpm >= 70 && acc >= 95) return { label: "ELITE NETRUNNER", rating: "S RANK", color: "text-rose-500 neon-text-pink" };
    if (finalWpm >= 50 && acc >= 90) return { label: "CYBER DECKER", rating: "A RANK", color: "text-cyan-400 neon-text-cyan" };
    if (finalWpm >= 35 && acc >= 80) return { label: "GRID CODER", rating: "B RANK", color: "text-green-400 neon-text-green" };
    if (finalWpm >= 20 && acc >= 75) return { label: "SCRIPT KIDDIE", rating: "C RANK", color: "text-amber-400 neon-text-amber" };
    return { label: "SYSADMIN INTERN", rating: "D RANK", color: "text-slate-400" };
  };

  return (
    <div className={`relative min-h-screen w-full flex flex-col justify-between overflow-hidden font-inter select-none bg-[${currentTheme.background}]`} style={{ backgroundColor: currentTheme.background }}>
      
      {/* Background Neon Scanlines & CRT Effects */}
      <div className="absolute inset-0 pointer-events-none crt-screen z-40 opacity-70"></div>
      
      {/* --- HEADER PANELS --- */}
      <header className="relative w-full z-20 flex items-center justify-between p-4 bg-black/40 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded bg-gradient-to-br from-rose-500 to-fuchsia-600 shadow-md flex items-center justify-center`} style={{ background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.accent})` }}>
            <Keyboard className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-wider text-white font-orbitron flex items-center gap-2">
              CYBERSTRIKE <span className="text-[10px] py-0.5 px-1.5 rounded bg-white/10 text-white/60 font-mono tracking-normal">// BETA v2.6</span>
            </h1>
          </div>
        </div>

        {/* Dynamic Status Badges (Playing mode only) */}
        {gameState === "PLAYING" && (
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 text-white/80">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-white/50 font-orbitron">PACK:</span>
              <span className="text-xs font-bold text-amber-400 font-orbitron uppercase">
                {WORD_PACKS.find(p => p.id === selectedPack)?.name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/50 font-orbitron">DIFFICULTY:</span>
              <span className="text-xs font-bold text-cyan-400 font-orbitron">{difficulty}</span>
            </div>
          </div>
        )}

        {/* Audio / Control Utilities */}
        <div className="flex items-center gap-2">
          {/* Virtual Keyboard Toggle */}
          {gameState === "PLAYING" && (
            <button
              onClick={() => {
                setIsVirtualKeyboardVisible(!isVirtualKeyboardVisible);
                setTimeout(() => hiddenInputRef.current?.focus(), 150);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                isVirtualKeyboardVisible 
                  ? "bg-rose-500/20 border-rose-500 text-rose-300" 
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Virtual Keyboard</span>
            </button>
          )}

          {/* Sound Controls */}
          <button 
            onClick={handleToggleMute}
            className="p-2 rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
            title={isMuted ? "Unmute All" : "Mute All"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {gameState === "PLAYING" && (
            <button 
              onClick={pauseGame}
              className="p-2 rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* --- MAIN GAME CONTAINER --- */}
      <main className="flex-1 w-full relative flex flex-col md:flex-row items-stretch overflow-hidden">
        
        {/* LEFT HUD PANEL: Real-time Game stats (Visible during Play/Pause) */}
        {gameState === "PLAYING" && (
          <div className="w-full md:w-64 bg-black/45 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-row md:flex-col justify-between md:justify-start gap-4 md:gap-6 backdrop-blur-md z-10">
            
            {/* Score & Multiplier */}
            <div className="flex-1 md:flex-none">
              <div className="text-[10px] text-white/40 font-orbitron uppercase tracking-widest">Score</div>
              <div className="text-2xl md:text-3xl font-black text-white font-orbitron flex items-baseline gap-2">
                {score}
                {isDoubleScore && (
                  <span className="text-xs text-amber-400 font-bold animate-pulse px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">2X ACTIVE</span>
                )}
              </div>
              
              {/* Combo Meter */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1 text-rose-400">
                  <Flame className="w-4 h-4 animate-bounce" />
                  <span className="text-sm font-black font-orbitron">{combo}</span>
                </div>
                <div className="text-[9px] text-white/40 font-mono">COMBO</div>
              </div>
              
              {/* Combo Multiplier visual bar */}
              <div className="w-full bg-white/5 h-1 rounded overflow-hidden mt-1">
                <div 
                  className="bg-rose-500 h-full transition-all duration-150 shadow-sm"
                  style={{ 
                    width: `${Math.min(100, (combo % 8) * 12.5)}%`,
                    backgroundColor: currentTheme.primary
                  }}
                ></div>
              </div>
            </div>

            {/* Level Meter */}
            <div className="flex-1 md:flex-none">
              <div className="text-[10px] text-white/40 font-orbitron uppercase tracking-widest">Level</div>
              <div className="text-xl md:text-2xl font-black text-cyan-400 font-orbitron flex items-center gap-2">
                {level}
                {isFrozen && (
                  <span className="text-[9px] text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/20 animate-pulse">TIME FROZEN</span>
                )}
              </div>
              <div className="text-[9px] text-white/40 font-mono mt-1">PROGRESS TO NEXT LEVEL</div>
              <div className="w-full bg-white/5 h-1.5 rounded overflow-hidden mt-1">
                <div 
                  className="bg-cyan-400 h-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (score % 400) / 4)}%`,
                    backgroundColor: currentTheme.secondary
                  }}
                ></div>
              </div>
            </div>

            {/* Defense Shield Health Bar */}
            <div className="flex-1 md:flex-none">
              <div className="flex justify-between items-center text-[10px] font-orbitron text-white/40 uppercase tracking-widest">
                <span>Shield HP</span>
                <span className={`font-bold ${shield < 35 ? "text-rose-500 animate-pulse" : "text-emerald-400"}`}>{shield}%</span>
              </div>
              <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden mt-1 p-[2px] border border-white/10">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    shield < 35 ? "bg-red-500 animate-pulse" : shield < 65 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${shield}%` }}
                ></div>
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-[9px] text-white/30 font-mono mt-1">
                <ShieldIcon className="w-3 h-3" />
                <span>RESTORES ON BOSS DEFEAT</span>
              </div>
            </div>

            {/* Target Locking Status HUD */}
            <div className="hidden md:block border-t border-white/5 pt-4 mt-2">
              <div className="text-[10px] text-white/40 font-orbitron uppercase tracking-widest flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Target Lock</span>
              </div>
              <div className="mt-2 min-h-12 flex items-center justify-center rounded bg-black/40 border border-white/5 p-2 text-center">
                {activeTargetWord ? (
                  <span className="font-share-tech text-lg text-green-400 font-bold tracking-wider animate-pulse">
                    {activeTargetWord}
                  </span>
                ) : (
                  <span className="text-xs text-white/20 font-mono tracking-wider italic">
                    AWAITING TARGET
                  </span>
                )}
              </div>
            </div>

          </div>
        )}

        {/* CENTRAL ARCADE CANVAS GAMEPLAY VIEWPORT */}
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden">
          
          {/* Canvas Board */}
          <canvas 
            ref={canvasRef} 
            className="w-full h-full cursor-crosshair block"
            onClick={() => {
              // Clicking canvas automatically focuses mobile helper or standard typing
              hiddenInputRef.current?.focus();
            }}
          />

          {/* Invisible Helper Input for Native Mobile Keyboard Support */}
          <input
            ref={hiddenInputRef}
            type="text"
            className="absolute top-0 left-0 opacity-0 pointer-events-none w-0 h-0"
            value={mobileInputValue}
            onChange={handleMobileInputChange}
            autoFocus={gameState === "PLAYING"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
          />

          {/* Quick Warning Flash (Shield damage / Low HP warning overlays) */}
          {gameState === "PLAYING" && shield < 30 && (
            <div className="absolute inset-0 pointer-events-none border-4 border-red-500/25 animate-pulse bg-red-500/5 flex items-center justify-center z-10">
              <div className="px-4 py-2 bg-black/80 rounded border border-red-500 animate-flicker text-red-500 text-xs font-orbitron tracking-widest">
                WARNING // CRITICAL COMPROMISE
              </div>
            </div>
          )}

          {/* Boss warning overlay with active health bar HUD */}
          {gameState === "PLAYING" && bossActive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/90 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl shadow-2xl flex flex-col gap-2 z-20 font-orbitron w-64 md:w-80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span className="text-[10px] tracking-widest font-black uppercase">CORE OVERLORD DETECTED</span>
                </div>
                <span className="text-[10px] font-bold text-red-300">STAGE {bossStage}/3</span>
              </div>
              <div className="w-full bg-red-950/50 h-2 rounded-full overflow-hidden border border-red-500/20">
                <div 
                  className="bg-red-500 h-full transition-all duration-300 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                  style={{ width: `${(bossHealth / bossMaxHealth) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* --- SCREEN OVERLAYS: START SCREEN --- */}
          {gameState === "START" && (
            <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-30 flex flex-col justify-center items-center overflow-y-auto p-4 md:p-8">
              <div className="max-w-4xl w-full flex flex-col items-center space-y-6 md:space-y-8 my-auto">
                
                {/* Glowing Cyberpunk Title */}
                <div className="text-center space-y-2">
                  <div className="inline-block px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold tracking-widest mb-2 animate-pulse">
                    ⚡ MULTI-THEMED CYBER ARCADE TYPING
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-fuchsia-500 to-cyan-400 font-orbitron neon-text-pink">
                    CYBERSTRIKE
                  </h1>
                  <p className="text-slate-400 font-share-tech text-sm md:text-base tracking-wider">
                    // TYPE FASTER // BULLETPROOF DEFENSE // TERMINATE EXPLOITS
                  </p>
                </div>

                {/* Grid Grid Config Columns */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-3xl">
                  
                  {/* Column 1: Word Pack Selections */}
                  <div className="md:col-span-7 space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-orbitron">
                      1. Select Deck Pack
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {WORD_PACKS.map(pack => (
                        <button
                          key={pack.id}
                          onClick={() => {
                            setSelectedPack(pack.id);
                            sfx.playKeypress(true);
                          }}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selectedPack === pack.id
                              ? "bg-rose-500/10 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <div className="text-sm font-bold text-white font-orbitron">{pack.name}</div>
                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{pack.description}</div>
                        </button>
                      ))}
                    </div>

                    {/* Difficulty Selection */}
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-orbitron">
                        2. Firewall Difficulty
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(["EASY", "MEDIUM", "HARD", "EXPERT", "ZEN"] as Difficulty[]).map(diff => (
                          <button
                            key={diff}
                            onClick={() => {
                              setDifficulty(diff);
                              sfx.playKeypress(true);
                            }}
                            className={`px-3 py-1.5 rounded text-xs font-bold font-orbitron transition-all ${
                              difficulty === diff
                                ? "bg-rose-500 border-rose-400 text-white shadow-md"
                                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            {diff}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        {difficulty === "EASY" && "★ Slower speed, simple words. Perfect for starters."}
                        {difficulty === "MEDIUM" && "★★ Moderate speed, mixed cyberwords. Recommended."}
                        {difficulty === "HARD" && "★★★ Fast spawns, tricky lengths. Test your skills."}
                        {difficulty === "EXPERT" && "🔥 Insane speed, heavy boss lines. Netrunner level only."}
                        {difficulty === "ZEN" && "☯ Relaxed practice pace, no shield damage, no timer."}
                      </p>
                    </div>
                  </div>

                  {/* Column 2: Theme customization & Audio feedback */}
                  <div className="md:col-span-5 space-y-4">
                    
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-orbitron">
                        3. Visual Aesthetic
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(THEMES) as ThemeId[]).map(themeId => (
                          <button
                            key={themeId}
                            onClick={() => {
                              setTheme(themeId);
                              sfx.playKeypress(true);
                            }}
                            className={`px-2 py-1.5 rounded border text-xs font-orbitron text-center flex items-center justify-center gap-1.5 transition-all ${
                              theme === themeId
                                ? "bg-white/10 border-white text-white font-bold"
                                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: THEMES[themeId].primary }} />
                            <span>{THEMES[themeId].name.split(" ")[1]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 p-3 bg-white/5 rounded-lg border border-white/5">
                      <h4 className="text-xs font-bold text-white font-orbitron flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Interactive Sound Test</span>
                      </h4>
                      <p className="text-[10px] text-slate-400">Audio synthesizes on the fly using Web Audio APIs. Try hitting keys below to test!</p>
                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => sfx.playKeypress(true)}
                          className="px-2 py-1 bg-white/10 rounded hover:bg-white/15 text-[10px] text-emerald-400 font-mono"
                        >
                          PEW (Correct)
                        </button>
                        <button 
                          onClick={() => sfx.playKeypress(false)}
                          className="px-2 py-1 bg-white/10 rounded hover:bg-white/15 text-[10px] text-rose-400 font-mono"
                        >
                          BUZZ (Error)
                        </button>
                        <button 
                          onClick={() => sfx.playWordDestroy(false)}
                          className="px-2 py-1 bg-white/10 rounded hover:bg-white/15 text-[10px] text-cyan-400 font-mono"
                        >
                          BOOM (Destroy)
                        </button>
                      </div>
                    </div>

                    {/* How to Play reminder */}
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div className="font-bold font-orbitron text-white text-xs">How to Play:</div>
                      <p>• Type characters on your physical keyboard.</p>
                      <p>• Lock targets automatically by typing the first letter.</p>
                      <p>• Wipe out words before they breach your shield.</p>
                      <p>• Power-up badges provide explosive advantages!</p>
                    </div>

                  </div>
                </div>

                {/* Big Glowing Launch Button */}
                <div className="pt-2 w-full max-w-sm">
                  <button
                    onClick={startGame}
                    className="w-full py-4 rounded-xl font-orbitron font-extrabold text-base tracking-widest text-white cursor-pointer bg-gradient-to-r from-rose-500 via-fuchsia-500 to-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>ENGAGE INTERCEPT</span>
                  </button>
                </div>

                {/* Preview High Score Board */}
                <div className="w-full max-w-2xl border-t border-white/5 pt-6">
                  <h3 className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest font-orbitron mb-3 flex items-center justify-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Local Hacker Hall of Fame</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1">
                    {highScores.slice(0, 6).map((hs, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold">#{i+1}</span>
                          <span className="font-bold text-white">{hs.name}</span>
                          <span className="text-white/40 text-[10px]">{hs.pack}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{hs.wpm} WPM</span>
                          <span className="text-emerald-400 font-bold font-orbitron">{hs.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* --- PAUSE OVERLAY --- */}
          {gameState === "PAUSED" && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-30 flex flex-col justify-center items-center p-4">
              <div className="max-w-md w-full bg-zinc-950/95 border border-white/10 rounded-2xl p-6 md:p-8 text-center space-y-6 shadow-2xl relative">
                
                {/* Glowing status */}
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-white font-orbitron tracking-wider">
                    DECK SYSTEM PAUSED
                  </h2>
                  <p className="text-xs text-slate-400">// NETWORK TRANSMISSION SUSPENDED</p>
                </div>

                {/* Score overview in pause */}
                <div className="grid grid-cols-2 gap-4 py-3 bg-white/5 rounded-xl border border-white/5 font-mono text-sm">
                  <div>
                    <div className="text-[10px] text-white/40 uppercase font-orbitron">Current Score</div>
                    <div className="text-lg font-bold text-emerald-400 font-orbitron mt-0.5">{score}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 uppercase font-orbitron">WPM Rating</div>
                    <div className="text-lg font-bold text-cyan-400 font-orbitron mt-0.5">
                      {Math.round((correctLetters / 5) / (((Date.now() - startTimeRef.current - elapsedPausedTimeRef.current) / 60000) || 1))}
                    </div>
                  </div>
                </div>

                {/* Volumes Sliders panel */}
                <div className="space-y-3.5 text-left pt-2">
                  <h3 className="text-xs font-bold text-slate-300 font-orbitron tracking-wider uppercase">
                    Audio Configurations
                  </h3>
                  
                  {/* SFX Volume slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Sound Effects</span>
                      <span>{Math.round(sfxVol * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={sfxVol}
                      onChange={(e) => setSfxVol(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>

                  {/* Music Volume slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Synth Retro Music</span>
                      <span>{Math.round(musicVol * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={musicVol}
                      onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                </div>

                {/* Controls buttons */}
                <div className="space-y-2.5 pt-4">
                  <button
                    onClick={resumeGame}
                    className="w-full py-3 rounded-lg font-orbitron font-bold text-xs tracking-widest text-white bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>RESUME INTRUSION</span>
                  </button>

                  <button
                    onClick={startGame}
                    className="w-full py-3 rounded-lg font-orbitron font-bold text-xs tracking-widest text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>RESET CURRENT RUN</span>
                  </button>

                  <button
                    onClick={returnToMenu}
                    className="w-full py-3 rounded-lg font-orbitron font-bold text-xs tracking-widest text-rose-400 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-950/40 transition-all flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    <span>ABANDON TO MAIN MENU</span>
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* --- GAME OVER SCREEN --- */}
          {gameState === "GAMEOVER" && (
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-30 flex flex-col justify-center items-center overflow-y-auto p-4 md:p-8">
              <div className="max-w-2xl w-full bg-zinc-950/95 border border-red-500/30 rounded-2xl p-6 md:p-8 text-center space-y-6 md:space-y-8 shadow-[0_0_35px_rgba(239,68,68,0.15)] my-auto">
                
                {/* Title */}
                <div className="space-y-1">
                  <div className="inline-block px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold tracking-widest font-orbitron animate-pulse">
                    ⚠️ DECK COMPROMISED // SHIELD CRITICAL COLLAPSE
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-white font-orbitron tracking-tighter">
                    SESSION TERMINATED
                  </h2>
                </div>

                {/* Score analytics metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 p-4 bg-white/5 border border-white/5 rounded-xl font-mono">
                  <div className="space-y-1">
                    <div className="text-[9px] text-white/40 uppercase font-orbitron flex items-center justify-center gap-1">
                      <Award className="w-3 h-3 text-rose-500" />
                      <span>Score</span>
                    </div>
                    <div className="text-lg md:text-xl font-black text-rose-500 font-orbitron">{score}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] text-white/40 uppercase font-orbitron flex items-center justify-center gap-1">
                      <Target className="w-3 h-3 text-violet-400" />
                      <span>Terminated</span>
                    </div>
                    <div className="text-lg md:text-xl font-black text-violet-400 font-orbitron">{completedWordsCount}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] text-white/40 uppercase font-orbitron flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>Speed</span>
                    </div>
                    <div className="text-lg md:text-xl font-black text-cyan-400 font-orbitron">
                      {Math.round((correctLetters / 5) / (((Date.now() - startTimeRef.current - elapsedPausedTimeRef.current) / 60000) || 1))} 
                      <span className="text-[10px] text-white/40 font-normal">WPM</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] text-white/40 uppercase font-orbitron flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Accuracy</span>
                    </div>
                    <div className="text-lg md:text-xl font-black text-emerald-400 font-orbitron">
                      {totalLettersTyped > 0 ? Math.round((correctLetters / totalLettersTyped) * 100) : 0}%
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] text-white/40 uppercase font-orbitron flex items-center justify-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>Streak</span>
                    </div>
                    <div className="text-lg md:text-xl font-black text-amber-400 font-orbitron">
                      {maxCombo} <span className="text-[10px] text-white/40 font-normal">KEY</span>
                    </div>
                  </div>
                </div>

                {/* Rating Banner */}
                <div className="p-3.5 bg-black/50 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                  <div>
                    <div className="text-[9px] text-white/30 font-orbitron uppercase">Netrunner Credentials Issued:</div>
                    <div className={`text-base font-black font-orbitron tracking-wide ${getRank().color}`}>
                      {getRank().label}
                    </div>
                  </div>
                  <div className={`text-2xl md:text-3xl font-black font-orbitron px-4 py-1 rounded bg-white/5 border border-white/10 ${getRank().color}`}>
                    {getRank().rating}
                  </div>
                </div>

                {/* Save High Score Input Form */}
                {!isHighScoreSaved && score > 0 ? (
                  <form onSubmit={handleSaveHighScore} className="space-y-3.5 bg-white/5 border border-white/5 p-4 rounded-xl text-left">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-300 font-orbitron uppercase tracking-wider">
                        New Leaderboard Rank Unlocked! Enter Initials:
                      </label>
                      <p className="text-[10px] text-slate-500">Save your speed credentials directly to local database storage.</p>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        maxLength={10}
                        placeholder="NETRUNNER_99"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="flex-1 bg-black border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono placeholder:text-white/20 uppercase"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2 rounded font-orbitron font-bold text-xs text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                      >
                        RECORD CORE
                      </button>
                    </div>
                  </form>
                ) : (
                  isHighScoreSaved && (
                    <div className="py-2 px-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                      ✓ CREDENTIAL RECORDED TO THE TERMINAL DATABASE
                    </div>
                  )
                )}

                {/* Replay Controls buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={startGame}
                    className="py-3.5 rounded-xl font-orbitron font-extrabold text-xs tracking-wider text-white bg-gradient-to-r from-rose-500 to-fuchsia-600 shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>INSTANT REPLAY</span>
                  </button>

                  <button
                    onClick={returnToMenu}
                    className="py-3.5 rounded-xl font-orbitron font-extrabold text-xs tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    <span>RETURN TO CORE DECK</span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

      </main>

      {/* --- BOTTOM INTERACTIVE PANEL: VIRAL KEYBOARD (FOR MOBILE AND DECK AESTHETICS) --- */}
      {isVirtualKeyboardVisible && gameState === "PLAYING" && (
        <footer className="relative w-full z-20 bg-black/85 border-t border-white/10 p-4 md:p-5 flex flex-col items-center gap-3 shadow-inner backdrop-blur-xl animate-slide-up">
          
          <div className="w-full max-w-3xl flex justify-between items-center text-xs text-white/50 border-b border-white/5 pb-2">
            <span className="font-orbitron tracking-wider flex items-center gap-1.5 text-cyan-400">
              <Smartphone className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>MOBILE TOUCH ACTIVE</span>
            </span>
            <span className="font-mono text-[10px] text-white/40 italic">Tap keys below or focus input to use native swipe keyboard</span>
            
            {/* Quick manual keyboard summon */}
            <button 
              onClick={() => hiddenInputRef.current?.focus()}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white font-mono"
            >
              FOCUS NATIVE KEYBOARD
            </button>
          </div>

          {/* Virtual QWERTY Layout */}
          <div className="w-full max-w-2xl flex flex-col gap-1.5 md:gap-2 select-none">
            {/* Row 1 */}
            <div className="flex justify-center gap-1 md:gap-1.5 w-full">
              {["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map(key => (
                <button
                  key={key}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    processKeystroke(key);
                  }}
                  className={`flex-1 max-w-[48px] aspect-[1/1] rounded-md border text-center font-orbitron font-bold text-xs md:text-sm flex items-center justify-center transition-all duration-100 ${
                    activeKeys[key]
                      ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)] scale-90"
                      : "bg-white/5 border-white/10 text-white/80 active:bg-rose-500 active:text-white hover:bg-white/10"
                  }`}
                  style={activeKeys[key] ? { borderColor: currentTheme.primary, backgroundColor: `${currentTheme.primary}40` } : {}}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Row 2 */}
            <div className="flex justify-center gap-1 md:gap-1.5 w-full px-[4%]">
              {["A", "S", "D", "F", "G", "H", "J", "K", "L"].map(key => (
                <button
                  key={key}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    processKeystroke(key);
                  }}
                  className={`flex-1 max-w-[48px] aspect-[1/1] rounded-md border text-center font-orbitron font-bold text-xs md:text-sm flex items-center justify-center transition-all duration-100 ${
                    activeKeys[key]
                      ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)] scale-90"
                      : "bg-white/5 border-white/10 text-white/80 active:bg-rose-500 active:text-white hover:bg-white/10"
                  }`}
                  style={activeKeys[key] ? { borderColor: currentTheme.primary, backgroundColor: `${currentTheme.primary}40` } : {}}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Row 3 */}
            <div className="flex justify-center gap-1 md:gap-1.5 w-full px-[8%]">
              {["Z", "X", "C", "V", "B", "N", "M"].map(key => (
                <button
                  key={key}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    processKeystroke(key);
                  }}
                  className={`flex-1 max-w-[48px] aspect-[1/1] rounded-md border text-center font-orbitron font-bold text-xs md:text-sm flex items-center justify-center transition-all duration-100 ${
                    activeKeys[key]
                      ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)] scale-90"
                      : "bg-white/5 border-white/10 text-white/80 active:bg-rose-500 active:text-white hover:bg-white/10"
                  }`}
                  style={activeKeys[key] ? { borderColor: currentTheme.primary, backgroundColor: `${currentTheme.primary}40` } : {}}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Space / Action Row */}
            <div className="flex justify-center gap-1.5 w-full px-[12%]">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  processKeystroke(" ");
                }}
                className={`flex-[3] h-10 rounded-md border text-center font-orbitron font-semibold text-xs text-white/60 flex items-center justify-center transition-all ${
                  activeKeys[" "]
                    ? "bg-rose-500 border-rose-400 text-white scale-[0.98]"
                    : "bg-white/5 border-white/10 active:bg-rose-500 hover:bg-white/10"
                }`}
                style={activeKeys[" "] ? { borderColor: currentTheme.primary, backgroundColor: `${currentTheme.primary}40` } : {}}
              >
                [ SPACE / ESCAPE OVERRIDE ]
              </button>
            </div>
          </div>

        </footer>
      )}

    </div>
  );
}
