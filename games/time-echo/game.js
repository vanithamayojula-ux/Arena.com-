(() => {
  'use strict';

  // The simulation uses a fixed 60 Hz world. Rendering can run at any refresh rate;
  // echoes are sampled from the same fixed-step timeline so their paths stay exact.
  const WORLD_WIDTH = 1000;
  const WORLD_HEIGHT = 560;
  const STEP = 1 / 60;
  const ECHO_INTERVAL = 5;
  const HISTORY_SIZE = Math.round(ECHO_INTERVAL / STEP) + 1;
  const MAX_ECHOES = 12;
  const GRAVITY = 1550;
  const MOVE_ACCELERATION = 1900;
  const MAX_SPEED = 282;
  const JUMP_SPEED = 590;

  const LEVELS = [
    {
      kicker: 'TRAINING SIMULATION · SECTOR 01',
      accent: '#72e7dc',
      title: 'The First Imprint',
      missionTitle: 'Leave an imprint.',
      objective: 'Stand on the relay until an echo is recorded. Your echo can hold it while you cross the gate.',
      tip: 'Stay on the cyan relay for a full five-second recording window. Your live presence primes it; only an echo can relay the signal.',
      platforms: [
        { x: 0, y: 480, w: 1000, h: 80, kind: 'ground' }
      ],
      hazards: [],
      switches: [
        { x: 356, w: 72, floorY: 480, label: 'RELAY 01' }
      ],
      gate: { x: 738, y: 336, w: 24, h: 144 },
      goal: { x: 912, y: 402, w: 46, h: 78 },
      start: { x: 66, y: 440 },
      requiredEchoes: 1
    },
    {
      kicker: 'DUAL-RELAY TRIAL · SECTOR 02',
      accent: '#a59bff',
      title: 'Twin Signals',
      missionTitle: 'Hold two moments.',
      objective: 'Echoes persist at their final position. Capture relay 01, then move to relay 02 during the next five-second window.',
      tip: 'Record relay 01 first. After its echo appears, cross the spike strip with a jump and hold relay 02 until the next echo is born.',
      platforms: [
        { x: 0, y: 480, w: 1000, h: 80, kind: 'ground' }
      ],
      hazards: [
        { x: 403, y: 463, w: 64, h: 17 }
      ],
      switches: [
        { x: 236, w: 68, floorY: 480, label: 'RELAY 01' },
        { x: 566, w: 68, floorY: 480, label: 'RELAY 02' }
      ],
      gate: { x: 790, y: 336, w: 24, h: 144 },
      goal: { x: 916, y: 402, w: 46, h: 78 },
      start: { x: 66, y: 440 },
      requiredEchoes: 2
    },
    {
      kicker: 'FRACTURED TIMELINE · SECTOR 03',
      accent: '#ff9d7d',
      title: 'Broken Loop',
      missionTitle: 'Cross the broken loop.',
      objective: 'Navigate the gaps and spike fields, then leave an echo on each relay. The echoes will keep the exit signal alive.',
      tip: 'Use short, deliberate jumps over the red spike fields. Your echo will copy every jump, landing, and pause from the recorded window.',
      platforms: [
        { x: 0, y: 480, w: 282, h: 80, kind: 'ground' },
        { x: 307, y: 408, w: 73, h: 15, kind: 'platform', oneWay: true },
        { x: 380, y: 480, w: 231, h: 80, kind: 'ground' },
        { x: 625, y: 408, w: 68, h: 15, kind: 'platform', oneWay: true },
        { x: 700, y: 480, w: 300, h: 80, kind: 'ground' }
      ],
      hazards: [
        { x: 190, y: 463, w: 52, h: 17 },
        { x: 509, y: 463, w: 48, h: 17 }
      ],
      switches: [
        { x: 422, w: 66, floorY: 480, label: 'RELAY 01' },
        { x: 730, w: 66, floorY: 480, label: 'RELAY 02' }
      ],
      gate: { x: 858, y: 336, w: 24, h: 144 },
      goal: { x: 925, y: 402, w: 46, h: 78 },
      start: { x: 64, y: 440 },
      requiredEchoes: 2
    }
  ];

  const CAMPAIGN_ACCENTS = ['#72e7dc', '#a59bff', '#ff9d7d', '#83b7ff', '#e78bff', '#8be7a5'];
  const CAMPAIGN_ADJECTIVES = ['Glass', 'Second', 'Ghost', 'Rift', 'Silent', 'Relay', 'Afterimage', 'Fracture', 'Last', 'Temporal'];
  const CAMPAIGN_NOUNS = ['Run', 'Signal', 'Circuit', 'Crossing', 'Orbit', 'Storm', 'Trace', 'Field', 'Light', 'Trial'];

  function makeCampaignRandom(seed) {
    let state = (seed >>> 0) || 1;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function createCampaignLevel(sector) {
    const difficulty = (sector - 4) / 96;
    const random = makeCampaignRandom(sector * 2654435761);
    const relayCount = sector < 12 ? 3 : sector < 36 ? 4 : 5;
    const relayWidth = 64 - difficulty * 20;
    const gateX = 842;
    const firstRelay = 170;
    const lastRelay = 700;
    const relaySpacing = (lastRelay - firstRelay) / (relayCount - 1);
    const relayJitter = 4 + difficulty * 10;
    const relayCenters = [];

    for (let index = 0; index < relayCount; index += 1) {
      const base = firstRelay + relaySpacing * index;
      const edgeWeight = index === 0 || index === relayCount - 1 ? 0.32 : 1;
      const jitter = (random() - 0.5) * 2 * relayJitter * edgeWeight;
      const minimum = index === 0 ? firstRelay - 8 : relayCenters[index - 1] + 116;
      const maximum = index === relayCount - 1 ? lastRelay + 8 : lastRelay - (relayCount - 1 - index) * 116;
      relayCenters.push(Math.max(minimum, Math.min(maximum, base + jitter)));
    }

    const routeNodes = [88, ...relayCenters, gateX - 30];
    const segments = routeNodes.slice(0, -1).map((start, index) => ({
      index,
      start,
      end: routeNodes[index + 1],
      span: routeNodes[index + 1] - start
    }));

    const gapWidth = Math.min(78, 52 + difficulty * 23 + (sector % 4) * 1.5);
    const gapCandidates = segments.filter((segment) => (
      segment.index > 0 &&
      segment.index < segments.length - 1 &&
      segment.span > gapWidth + relayWidth + 8
    ));
    const baseGapCount = 1 + Math.floor(difficulty * 2.99);
    const bonusGap = sector % 6 === 0 ? 1 : 0;
    const desiredGaps = Math.min(gapCandidates.length, 3, baseGapCount + bonusGap);
    const gapSegments = new Set(
      gapCandidates
        .map((segment) => ({ segment, order: random() }))
        .sort((a, b) => a.order - b.order)
        .slice(0, desiredGaps)
        .map(({ segment }) => segment.index)
    );

    const gaps = [...gapSegments].map((segmentIndex) => {
      const segment = segments[segmentIndex];
      const maxOffset = Math.max(0, (segment.span - gapWidth) / 2 - relayWidth / 2 - 4);
      const offset = (random() * 2 - 1) * maxOffset;
      const center = (segment.start + segment.end) / 2 + offset;
      const bridgeWidth = Math.max(34, Math.min(gapWidth - 10, gapWidth * (0.54 + random() * 0.16)));
      const bridgeOffset = (random() - 0.5) * Math.min(10, gapWidth * 0.1);
      return {
        x: center - gapWidth / 2,
        w: gapWidth,
        segmentIndex,
        bridgeX: center + bridgeOffset - bridgeWidth / 2,
        bridgeWidth,
        bridgeY: 427 - difficulty * 16 + random() * 10
      };
    }).sort((a, b) => a.x - b.x);

    const platforms = [];
    let groundStart = 0;
    for (const gap of gaps) {
      const leftWidth = gap.x - groundStart;
      if (leftWidth > 10) platforms.push({ x: groundStart, y: 480, w: leftWidth, h: 80, kind: 'ground' });
      platforms.push({
        x: gap.bridgeX,
        y: gap.bridgeY,
        w: gap.bridgeWidth,
        h: 14,
        kind: 'platform',
        oneWay: true
      });
      groundStart = gap.x + gap.w;
    }
    if (groundStart < 1000) platforms.push({ x: groundStart, y: 480, w: 1000 - groundStart, h: 80, kind: 'ground' });

    const nonGapSegments = segments.filter((segment) => !gapSegments.has(segment.index) && segment.span >= 88);
    const desiredSweepers = sector < 10 ? 0 : sector < 28 ? 1 : sector < 52 ? 2 : sector < 76 ? 3 : 4;
    const sweeperOptions = nonGapSegments.map((segment) => {
      const isExitSegment = segment.index === segments.length - 1;
      const width = 18 + difficulty * 7;
      const range = Math.min(21, 7 + difficulty * 12);
      const travel = range + width / 2;
      const leftClearance = segment.index === 0 ? 12 : relayWidth / 2 + 8;
      const rightClearance = isExitSegment ? 12 : relayWidth / 2 + 8;
      const minimum = segment.start + leftClearance + travel;
      const maximum = segment.end - rightClearance - travel;
      if (maximum <= minimum) return null;
      return { segment, width, range, minimum, maximum, order: random() };
    }).filter(Boolean).sort((a, b) => a.order - b.order);
    const selectedSweepers = sweeperOptions.slice(0, Math.min(desiredSweepers, sweeperOptions.length));
    const sweeperSegments = new Set(selectedSweepers.map(({ segment }) => segment.index));
    const hazards = selectedSweepers.map(({ segment, width, range, minimum, maximum }) => {
      const center = minimum + random() * (maximum - minimum);
      return {
        type: 'sweeper',
        centerX: center,
        range,
        period: 3.8 - difficulty * 1.45,
        phase: segment.index * 1.7 + random() * Math.PI * 2,
        x: center - width / 2,
        y: 425 - difficulty * 5,
        w: width,
        h: 28
      };
    });

    const spikeWidth = 28 + difficulty * 24;
    const spikeCandidates = nonGapSegments.filter((segment) => !sweeperSegments.has(segment.index)).map((segment) => {
      const isExitSegment = segment.index === segments.length - 1;
      const leftClearance = segment.index === 0 ? 14 : relayWidth / 2 + 8;
      const rightClearance = isExitSegment ? 20 : relayWidth / 2 + 8;
      const minimum = segment.start + leftClearance + spikeWidth / 2;
      const maximum = segment.end - rightClearance - spikeWidth / 2;
      return maximum > minimum ? { segment, minimum, maximum, order: random() } : null;
    }).filter(Boolean).sort((a, b) => a.order - b.order);
    const desiredSpikes = 1 + Math.floor(difficulty * 3) + (sector % 8 === 0 ? 1 : 0);
    const selectedSpikes = spikeCandidates.slice(0, Math.min(desiredSpikes, spikeCandidates.length));
    for (const { minimum, maximum } of selectedSpikes) {
      const center = minimum + random() * (maximum - minimum);
      hazards.push({ x: center - spikeWidth / 2, y: 463, w: spikeWidth, h: 17 });
    }

    const switches = relayCenters.map((center, index) => ({
      x: center - relayWidth / 2,
      w: relayWidth,
      floorY: 480,
      label: `RELAY ${String(index + 1).padStart(2, '0')}`
    }));
    const titleOffset = sector - 4;
    const title = `${CAMPAIGN_ADJECTIVES[titleOffset % CAMPAIGN_ADJECTIVES.length]} ${CAMPAIGN_NOUNS[Math.floor(titleOffset / 10) % CAMPAIGN_NOUNS.length]} ${String(sector).padStart(2, '0')}`;
    const threat = Math.round(1 + difficulty * 99);
    const sweeperCount = hazards.filter((hazard) => hazard.type === 'sweeper').length;

    return {
      kicker: `CHRONO CAMPAIGN · SECTOR ${String(sector).padStart(2, '0')} / 100 · THREAT ${String(threat).padStart(2, '0')}`,
      accent: CAMPAIGN_ACCENTS[(sector - 4) % CAMPAIGN_ACCENTS.length],
      title,
      missionTitle: `${relayCount} relays. ${gaps.length} shifting rift${gaps.length === 1 ? '' : 's'}.`,
      objective: `Synchronize all ${relayCount} relays with separate echoes, cross ${gaps.length} time rift${gaps.length === 1 ? '' : 's'}, avoid ${hazards.length} hazard${hazards.length === 1 ? '' : 's'}, and reach the exit.`,
      tip: `Threat ${threat}/100. Echoes replay your last five seconds; each relay needs its own echo. Watch the moving sweepers and jump the spike fields.`,
      platforms,
      hazards,
      switches,
      gate: { x: gateX, y: 336 - difficulty * 16, w: 24, h: 144 + difficulty * 16 },
      goal: { x: 918, y: 402, w: 46, h: 78 },
      start: { x: 62, y: 440 },
      requiredEchoes: relayCount,
      speedScale: 1 - difficulty * 0.045,
      gravityScale: 1 + difficulty * 0.1,
      jumpScale: 1 - difficulty * 0.075,
      gapCount: gaps.length,
      sweeperCount,
      difficulty
    };
  }

  // Keep the handcrafted tutorial trio, then extend the campaign with 97
  // deterministic layouts whose relay count, gaps, hazards, and jump tuning ramp up.
  for (let sector = LEVELS.length + 1; sector <= 100; sector += 1) {
    LEVELS.push(createCampaignLevel(sector));
  }

  const CAMPAIGN_PROGRESS_KEY = 'time-echo-campaign-progress-v1';

  function readCampaignProgress() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CAMPAIGN_PROGRESS_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return { maxUnlockedLevel: 0, completedLevels: [] };
      const maxUnlockedLevel = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(Number(saved.maxUnlockedLevel) || 0)));
      const completedLevels = Array.isArray(saved.completedLevels)
        ? saved.completedLevels.filter((index) => Number.isInteger(index) && index >= 0 && index < LEVELS.length)
        : [];
      return { maxUnlockedLevel, completedLevels };
    } catch (_) {
      return { maxUnlockedLevel: 0, completedLevels: [] };
    }
  }

  const savedProgress = readCampaignProgress();

  function saveCampaignProgress() {
    try {
      window.localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify({
        maxUnlockedLevel,
        completedLevels: [...completedLevels]
      }));
    } catch (_) {
      // Persistence is optional; the full campaign remains playable for this session.
    }
  }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!canvas || !ctx) return;

  const ui = {
    gameApp: document.getElementById('gameApp'),
    introOverlay: document.getElementById('introOverlay'),
    playButton: document.getElementById('playButton'),
    menuButton: document.getElementById('menuButton'),
    archiveFootCopy: document.getElementById('archiveFootCopy'),
    archiveCount: document.getElementById('archiveCount'),
    levelTabsContainer: document.getElementById('levelTabs'),
    levelKicker: document.getElementById('levelKicker'),
    levelTitle: document.getElementById('levelTitle'),
    sectorNumber: document.getElementById('sectorNumber'),
    sectorTotal: document.getElementById('sectorTotal'),
    timerValue: document.getElementById('timerValue'),
    timerFill: document.getElementById('timerFill'),
    worldClock: document.getElementById('worldClock'),
    loopNumber: document.getElementById('loopNumber'),
    missionTitle: document.getElementById('missionTitle'),
    objectiveText: document.getElementById('objectiveText'),
    missionTip: document.getElementById('missionTip'),
    relayList: document.getElementById('relayList'),
    relayProgress: document.getElementById('relayProgress'),
    gateBadge: document.getElementById('gateBadge'),
    gateReadout: document.getElementById('gateReadout'),
    gateReadoutTitle: document.getElementById('gateReadoutTitle'),
    gateReadoutCopy: document.getElementById('gateReadoutCopy'),
    gateLed: document.getElementById('gateLed'),
    echoCount: document.getElementById('echoCount'),
    echoList: document.getElementById('echoList'),
    levelTabs: [],
    continueButton: document.getElementById('continueButton'),
    continueLabel: document.getElementById('continueLabel'),
    restartButton: document.getElementById('restartButton'),
    soundToggle: document.getElementById('soundToggle'),
    soundLabel: document.getElementById('soundLabel')
  };

  const keys = new Set();
  const completedLevels = new Set(savedProgress.completedLevels);
  const relayNodes = [];
  const backgroundSpecks = Array.from({ length: 56 }, (_, i) => ({
    x: (i * 193.73 + 31) % WORLD_WIDTH,
    y: (i * 79.17 + 23) % 395,
    r: 0.55 + ((i * 7) % 4) * 0.18,
    phase: i * 0.73
  }));

  let currentLevelIndex = 0;
  let maxUnlockedLevel = savedProgress.maxUnlockedLevel;
  let gameStarted = false;
  let level;
  let player;
  let echoes = [];
  let history = [];
  let levelTime = 0;
  let nextEchoAt = ECHO_INTERVAL;
  let status = 'playing';
  let gateOpen = false;
  let accumulator = 0;
  let lastFrameTime = 0;
  let lastUiTime = 0;
  let jumpQueued = false;
  let deathTimer = 0;
  let soundEnabled = true;
  let audioContext = null;
  let visualTime = 0;

  function createPlayer(start) {
    return {
      x: start.x,
      y: start.y,
      w: 28,
      h: 40,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      coyoteTime: 0.12,
      jumpBuffer: 0,
      walkPhase: 0,
      jumpAction: false,
      inputX: 0,
      inputLeft: false,
      inputRight: false
    };
  }

  function buildLevelTabs() {
    ui.levelTabsContainer.replaceChildren();
    ui.levelTabs.length = 0;
    ui.archiveCount.innerHTML = `${LEVELS.length} <i>LEVELS</i>`;

    LEVELS.forEach((campaignLevel, index) => {
      const number = String(index + 1).padStart(2, '0');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-tab';
      button.dataset.level = String(index);
      button.setAttribute('aria-label', `Sector ${number}: ${campaignLevel.title}`);
      button.setAttribute('aria-pressed', 'false');
      button.disabled = index > maxUnlockedLevel;
      button.title = button.disabled ? `Clear sector ${String(index).padStart(2, '0')} to unlock` : campaignLevel.title;

      const label = document.createElement('span');
      label.className = 'tab-number';
      label.textContent = number;
      const state = document.createElement('span');
      state.className = 'tab-state';
      state.setAttribute('aria-hidden', 'true');
      button.append(label, state);
      button.addEventListener('click', () => {
        if (index > maxUnlockedLevel) return;
        const changedSector = index !== currentLevelIndex;
        loadLevel(index);
        if (changedSector) playSound('select');
        focusGame();
      });
      ui.levelTabsContainer.append(button);
      ui.levelTabs.push(button);
    });
  }

  function loadLevel(index) {
    const requestedIndex = Math.max(0, Math.min(LEVELS.length - 1, Number(index) || 0));
    if (requestedIndex > maxUnlockedLevel) return;
    currentLevelIndex = requestedIndex;
    level = LEVELS[currentLevelIndex];
    levelTime = 0;
    nextEchoAt = ECHO_INTERVAL;
    accumulator = 0;
    status = gameStarted ? 'playing' : 'title';
    deathTimer = 0;
    gateOpen = false;
    echoes = [];
    history = [];
    jumpQueued = false;
    keys.clear();
    player = createPlayer(level.start);
    // Start with a sample at time zero so the first five-second clip is complete.
    history.push(recordPlayerSample());
    nextEchoId = 1;
    buildRelayRows();
    updateUi(true);
    canvas.setAttribute('aria-label', `Sector ${currentLevelIndex + 1}: ${level.title}. Use left and right arrow keys to move and spacebar to jump.`);
  }

  function buildRelayRows() {
    ui.relayList.replaceChildren();
    relayNodes.length = 0;

    level.switches.forEach((relay, index) => {
      relay.active = false;
      relay.playerTouch = false;
      const row = document.createElement('div');
      row.className = 'relay-row';
      const symbol = document.createElement('span');
      symbol.className = 'relay-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'relay-name';
      name.textContent = relay.label;
      const source = document.createElement('span');
      source.className = 'relay-source';
      source.textContent = 'NO SIGNAL';
      row.append(symbol, name, source);
      ui.relayList.append(row);
      relayNodes.push({ row, source, index });
    });
  }

  function readHorizontalInput() {
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    return { left, right, axis: (right ? 1 : 0) - (left ? 1 : 0) };
  }

  function recordPlayerSample() {
    const input = readHorizontalInput();
    return {
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      facing: player.facing,
      grounded: player.grounded,
      moving: Math.abs(player.vx) > 8,
      walkPhase: player.walkPhase,
      jumpAction: player.jumpAction,
      inputX: input.axis,
      inputLeft: input.left,
      inputRight: input.right,
      jumpHeld: keys.has('Space')
    };
  }

  function focusGame() {
    if (canvas.focus) canvas.focus({ preventScroll: true });
  }

  function pressKey(code) {
    if (!keys.has(code) && code === 'Space') jumpQueued = true;
    keys.add(code);
    if (soundEnabled) ensureAudio();
  }

  function releaseKey(code) {
    keys.delete(code);
  }

  function isGameKey(code) {
    return code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'Space' || code === 'KeyA' || code === 'KeyD';
  }

  document.addEventListener('keydown', (event) => {
    const isButton = event.target instanceof Element && event.target.closest('button, a, input, textarea, select');
    if (event.code === 'Enter' && status === 'title' && !isButton) {
      event.preventDefault();
      startGame();
      return;
    }
    if (event.code === 'Enter' && status === 'complete' && !isButton) {
      event.preventDefault();
      advanceLevel();
      return;
    }
    if (!isGameKey(event.code) || isButton) return;
    event.preventDefault();
    if (event.code === 'ArrowUp') return;
    if (!event.repeat) pressKey(event.code);
  });

  document.addEventListener('keyup', (event) => {
    if (isGameKey(event.code)) releaseKey(event.code);
  });

  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastFrameTime = performance.now();
    else keys.clear();
  });

  document.querySelectorAll('[data-touch-key]').forEach((button) => {
    const code = button.dataset.touchKey;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      pressKey(code);
    });
    const release = (event) => {
      event.preventDefault();
      releaseKey(code);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  ui.playButton.addEventListener('click', startGame);
  ui.menuButton.addEventListener('click', returnToTitle);

  ui.restartButton.addEventListener('click', () => {
    loadLevel(currentLevelIndex);
    playSound('restart');
    focusGame();
  });

  ui.continueButton.addEventListener('click', () => {
    advanceLevel();
    focusGame();
  });

  ui.soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    ui.soundToggle.classList.toggle('is-muted', !soundEnabled);
    ui.soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    ui.soundToggle.setAttribute('aria-label', soundEnabled ? 'Mute sound effects' : 'Enable sound effects');
    ui.soundLabel.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    if (soundEnabled) ensureAudio();
    focusGame();
  });

  function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    ui.introOverlay.hidden = true;
    ui.gameApp.hidden = false;
    ui.gameApp.classList.add('is-entering');
    loadLevel(0);
    focusGame();
    playSound('select');
    window.setTimeout(() => ui.gameApp.classList.remove('is-entering'), 440);
  }

  function returnToTitle() {
    gameStarted = false;
    ui.gameApp.hidden = true;
    ui.introOverlay.hidden = false;
    keys.clear();
    jumpQueued = false;
    loadLevel(0);
    if (ui.playButton.focus) ui.playButton.focus({ preventScroll: true });
  }

  function advanceLevel() {
    if (status !== 'complete') return;
    if (currentLevelIndex === LEVELS.length - 1) {
      completedLevels.clear();
      maxUnlockedLevel = 0;
      saveCampaignProgress();
      loadLevel(0);
    } else {
      loadLevel(currentLevelIndex + 1);
    }
    playSound('select');
  }

  function ensureAudio() {
    if (!soundEnabled) return;
    try {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return;
      if (!audioContext) audioContext = new AudioContextConstructor();
      if (audioContext.state === 'suspended') audioContext.resume();
    } catch (_) {
      // Sound is an optional enhancement; gameplay never depends on it.
    }
  }

  function tone(frequency, duration, shape = 'sine', volume = 0.04, endFrequency = null, delay = 0) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioContext) return;
    try {
      const start = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = shape;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.025);
    } catch (_) {
      // Ignore audio-device and browser-policy errors.
    }
  }

  function playSound(kind) {
    if (!soundEnabled) return;
    switch (kind) {
      case 'jump':
        tone(280, 0.13, 'triangle', 0.035, 510);
        break;
      case 'echo':
        tone(440, 0.24, 'sine', 0.043, 740);
        tone(660, 0.28, 'sine', 0.024, 990, 0.09);
        break;
      case 'relay':
        tone(520, 0.14, 'sine', 0.035, 780);
        break;
      case 'gate':
        tone(390, 0.3, 'triangle', 0.04, 820);
        break;
      case 'death':
        tone(300, 0.34, 'sawtooth', 0.035, 90);
        break;
      case 'complete':
        tone(523, 0.22, 'sine', 0.04, 700);
        tone(659, 0.28, 'sine', 0.04, 880, 0.12);
        tone(784, 0.38, 'sine', 0.04, 1040, 0.26);
        break;
      case 'restart':
      case 'select':
        tone(420, 0.1, 'sine', 0.025, 570);
        break;
      default:
        break;
    }
  }

  function getSolidRects() {
    // Never append the gate to the level's source geometry: this runs every physics step.
    return level.gate && !gateOpen ? [...level.platforms, level.gate] : level.platforms;
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function hazardBounds(hazard, time = levelTime) {
    if (hazard.type !== 'sweeper') return hazard;
    const centerX = hazard.centerX + Math.sin((time / hazard.period) * Math.PI * 2 + hazard.phase) * hazard.range;
    return { x: centerX - hazard.w / 2, y: hazard.y, w: hazard.w, h: hazard.h };
  }

  function movePlayer(dt) {
    const horizontal = readHorizontalInput();
    const speedScale = level.speedScale || 1;
    const gravityScale = level.gravityScale || 1;
    const jumpScale = level.jumpScale || 1;
    player.inputX = horizontal.axis;
    player.inputLeft = horizontal.left;
    player.inputRight = horizontal.right;
    player.jumpAction = false;

    if (jumpQueued) {
      player.jumpBuffer = 0.14;
      jumpQueued = false;
    } else {
      player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    }

    if (player.grounded) player.coyoteTime = 0.12;
    else player.coyoteTime = Math.max(0, player.coyoteTime - dt);

    if (horizontal.axis !== 0) {
      player.vx += horizontal.axis * MOVE_ACCELERATION * speedScale * dt;
      const levelMaxSpeed = MAX_SPEED * speedScale;
      player.vx = Math.max(-levelMaxSpeed, Math.min(levelMaxSpeed, player.vx));
      player.facing = horizontal.axis;
    } else {
      const drag = player.grounded ? 10 : 2.4;
      player.vx *= Math.exp(-drag * dt);
      if (Math.abs(player.vx) < 1.2) player.vx = 0;
    }

    if (player.jumpBuffer > 0 && player.coyoteTime > 0) {
      player.vy = -JUMP_SPEED * jumpScale;
      player.grounded = false;
      player.coyoteTime = 0;
      player.jumpBuffer = 0;
      player.jumpAction = true;
      playSound('jump');
    }

    if (!keys.has('Space') && player.vy < 0) player.vy += 1750 * gravityScale * dt;
    player.vy = Math.min(950 * gravityScale, player.vy + GRAVITY * gravityScale * dt);

    const solids = getSolidRects();
    player.x += player.vx * dt;
    for (const rect of solids) {
      if (rect.oneWay || !intersects(player, rect)) continue;
      if (player.vx > 0) {
        player.x = rect.x - player.w;
        player.vx = 0;
      } else if (player.vx < 0) {
        player.x = rect.x + rect.w;
        player.vx = 0;
      }
    }
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));

    const previousY = player.y;
    const previousBottom = previousY + player.h;
    player.y += player.vy * dt;
    player.grounded = false;

    for (const rect of solids) {
      if (!intersects(player, rect)) continue;
      if (rect.oneWay) {
        if (player.vy >= 0 && previousBottom <= rect.y + 2) {
          player.y = rect.y - player.h;
          player.vy = 0;
          player.grounded = true;
        }
        continue;
      }
      if (player.vy >= 0 && previousBottom <= rect.y + Math.max(2, Math.abs(player.vy * dt) + 1)) {
        player.y = rect.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else if (player.vy < 0 && previousY >= rect.y + rect.h - Math.max(2, Math.abs(player.vy * dt) + 1)) {
        player.y = rect.y + rect.h;
        player.vy = 0;
      } else if (player.vy >= 0) {
        player.y = rect.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else {
        player.y = rect.y + rect.h;
        player.vy = 0;
      }
    }

    if (player.grounded) player.coyoteTime = 0.12;
    player.walkPhase += Math.abs(player.vx) * dt * 0.035;

    if (player.y > WORLD_HEIGHT + 30) {
      beginRespawn();
      return;
    }

    for (const hazard of level.hazards) {
      if (intersects(player, hazardBounds(hazard))) {
        beginRespawn();
        return;
      }
    }
  }

  // Echoes replay the already-resolved player samples instead of running a second
  // physics simulation. Platform contacts are therefore baked into their path,
  // while the same actor bounds are checked against live relays during playback.
  function echoPose(echo) {
    if (echo.path.length === 0) return null;
    const maxIndex = echo.path.length - 1;
    const framePosition = Math.min(maxIndex, Math.max(0, echo.elapsed / STEP));
    const index = Math.floor(framePosition);
    const mix = Math.min(1, framePosition - index);
    const from = echo.path[index];
    const to = echo.path[Math.min(maxIndex, index + 1)];
    return {
      x: from.x + (to.x - from.x) * mix,
      y: from.y + (to.y - from.y) * mix,
      vx: from.vx + (to.vx - from.vx) * mix,
      vy: from.vy + (to.vy - from.vy) * mix,
      facing: mix < 0.5 ? from.facing : to.facing,
      grounded: mix < 0.5 ? from.grounded : to.grounded,
      moving: mix < 0.5 ? from.moving : to.moving,
      walkPhase: from.walkPhase + (to.walkPhase - from.walkPhase) * mix,
      inputX: mix < 0.5 ? from.inputX : to.inputX,
      jumpAction: mix < 0.5 ? from.jumpAction : to.jumpAction
    };
  }

  function updateEchoes(dt) {
    for (const echo of echoes) {
      echo.elapsed = Math.min(echo.duration, echo.elapsed + dt);
    }
  }

  function spawnEcho() {
    const path = history.slice(-HISTORY_SIZE);
    if (path.length < 2) return;
    const duration = (path.length - 1) * STEP;
    const echo = {
      id: nextEchoId++,
      path,
      elapsed: 0,
      duration
    };
    echoes.push(echo);
    if (echoes.length > MAX_ECHOES) echoes.shift();
    playSound('echo');
  }

  let nextEchoId = 1;

  function actorPressesRelay(actor, relay) {
    if (!actor || !actor.grounded) return false;
    const actorBottom = actor.y + player.h;
    const onFloor = Math.abs(actorBottom - relay.floorY) <= 4;
    const horizontalOverlap = actor.x + player.w > relay.x + 5 && actor.x < relay.x + relay.w - 5;
    return onFloor && horizontalOverlap;
  }

  function updateRelays() {
    let activeCount = 0;
    for (const relay of level.switches) {
      const wasActive = relay.active;
      relay.playerTouch = actorPressesRelay(player, relay);
      relay.active = echoes.some((echo) => actorPressesRelay(echoPose(echo), relay));
      if (relay.active && !wasActive) playSound('relay');
      if (relay.active) activeCount += 1;
    }
    const nextGateOpen = activeCount === level.requiredEchoes;
    if (nextGateOpen !== gateOpen) {
      gateOpen = nextGateOpen;
      if (gateOpen) playSound('gate');
    }
    return activeCount;
  }

  function beginRespawn() {
    if (status !== 'playing') return;
    status = 'respawning';
    deathTimer = 0.82;
    playSound('death');
    updateUi(true);
  }

  function finishLevel() {
    if (status !== 'playing') return;
    status = 'complete';
    completedLevels.add(currentLevelIndex);
    maxUnlockedLevel = Math.min(LEVELS.length - 1, Math.max(maxUnlockedLevel, currentLevelIndex + 1));
    saveCampaignProgress();
    playSound('complete');
    updateUi(true);
  }

  function update(dt) {
    if (status === 'respawning') {
      deathTimer -= dt;
      if (deathTimer <= 0) {
        const current = currentLevelIndex;
        loadLevel(current);
      }
      return;
    }
    if (status !== 'playing') return;

    movePlayer(dt);
    if (status !== 'playing') return;

    levelTime += dt;
    updateEchoes(dt);

    history.push(recordPlayerSample());
    if (history.length > HISTORY_SIZE) history.shift();

    if (levelTime + 0.000001 >= nextEchoAt) {
      spawnEcho();
      nextEchoAt += ECHO_INTERVAL;
    }

    updateRelays();
    if (gateOpen && intersects(player, level.goal)) finishLevel();
  }

  function updateUi(force = false) {
    if (!force && performance.now() - lastUiTime < 65) return;
    lastUiTime = performance.now();

    const remaining = status === 'playing' ? Math.max(0, Math.min(ECHO_INTERVAL, nextEchoAt - levelTime)) : 0;
    const progress = status === 'playing' ? 1 - remaining / ECHO_INTERVAL : 1;
    ui.levelKicker.textContent = level.kicker;
    ui.levelTitle.textContent = level.title;
    ui.objectiveText.textContent = level.objective;
    ui.sectorNumber.textContent = String(currentLevelIndex + 1).padStart(2, '0');
    ui.sectorTotal.textContent = `OF ${String(LEVELS.length).padStart(2, '0')}`;
    ui.timerValue.innerHTML = `${remaining.toFixed(1)}<span>s</span>`;
    ui.timerFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    const seconds = Math.floor(levelTime);
    ui.worldClock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    ui.loopNumber.textContent = String(Math.floor(levelTime / ECHO_INTERVAL) + 1).padStart(2, '0');

    const activeCount = level.switches.filter((relay) => relay.active).length;
    ui.relayProgress.textContent = `${activeCount} / ${level.requiredEchoes} ACTIVE`;
    relayNodes.forEach(({ row, source, index }) => {
      const relay = level.switches[index];
      row.classList.toggle('is-active', relay.active);
      if (relay.active) source.textContent = 'ECHO SYNCED';
      else if (relay.playerTouch) source.textContent = 'RECORDING';
      else source.textContent = 'NO SIGNAL';
    });

    ui.gateBadge.classList.toggle('is-open', gateOpen);
    ui.gateBadge.innerHTML = `<span class="lock-icon" aria-hidden="true"></span> ${gateOpen ? 'OPEN' : 'LOCKED'}`;
    ui.gateReadout.classList.toggle('is-open', gateOpen);
    ui.gateReadoutTitle.textContent = gateOpen ? 'Exit gate open' : 'Exit gate sealed';
    ui.gateReadoutCopy.textContent = gateOpen ? 'All echo relays synchronized' : `${Math.max(0, level.requiredEchoes - activeCount)} relay signal${level.requiredEchoes - activeCount === 1 ? '' : 's'} still needed`;
    ui.echoCount.textContent = String(echoes.length).padStart(2, '0');

    if (status === 'complete') {
      const isFinal = currentLevelIndex === LEVELS.length - 1;
      ui.missionTitle.textContent = isFinal ? 'Timeline restored.' : 'Sector stabilized.';
      ui.missionTip.innerHTML = '<span class="tip-icon" aria-hidden="true">✓</span><p>The exit signal is stable. Continue when you are ready.</p>';
      const nextSector = String(currentLevelIndex + 2).padStart(2, '0');
      ui.continueLabel.textContent = isFinal ? 'PLAY AGAIN' : `NEXT SECTOR · ${nextSector}`;
      ui.continueButton.hidden = false;
    } else if (status === 'respawning') {
      ui.missionTitle.textContent = 'Rewinding the field.';
      ui.missionTip.innerHTML = '<span class="tip-icon" aria-hidden="true">↺</span><p>Timeline fractured. Rebuilding this chamber from its first frame.</p>';
      ui.continueButton.hidden = true;
    } else {
      ui.missionTitle.textContent = gateOpen ? 'Signal locked in.' : level.missionTitle;
      ui.missionTip.innerHTML = `<span class="tip-icon" aria-hidden="true">i</span><p>${getTipText(activeCount, remaining)}</p>`;
      ui.continueButton.hidden = true;
    }

    renderEchoList();
    ui.levelTabs.forEach((button, index) => {
      const active = index === currentLevelIndex;
      const unlocked = index <= maxUnlockedLevel;
      button.disabled = !unlocked;
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-complete', completedLevels.has(index));
      button.classList.toggle('is-locked', !unlocked);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-disabled', String(!unlocked));
      button.title = unlocked ? `Open sector ${String(index + 1).padStart(2, '0')}` : `Clear sector ${String(index).padStart(2, '0')} to unlock this chamber`;
    });
    if (maxUnlockedLevel >= LEVELS.length - 1) {
      ui.archiveFootCopy.textContent = 'All 100 levels unlocked — revisit any sector.'
    } else {
      const currentSector = String(maxUnlockedLevel + 1).padStart(2, '0');
      ui.archiveFootCopy.textContent = `Clear sector ${currentSector} to unlock sector ${String(maxUnlockedLevel + 2).padStart(2, '0')}.`;
    }
  }

  function getTipText(activeCount, remaining) {
    if (gateOpen) return 'All relay signals are held by echoes. Move through the open threshold and touch the exit portal.';
    if (activeCount > 0) return 'A relay is receiving an echo. Keep the other relay(s) in sync, then head through the gate.';
    if (level.switches.some((relay) => relay.playerTouch)) return `Recording your position. The next echo appears in ${remaining.toFixed(1)}s; stay on the relay to leave an imprint.`;
    if (echoes.length === 0) return `${level.tip} First echo in ${remaining.toFixed(1)}s.`;
    return 'Echoes replay their five-second paths and remain at their final positions. Guide one onto every relay.';
  }

  function renderEchoList() {
    if (echoes.length === 0) {
      ui.echoList.innerHTML = '<p class="echo-empty">No echoes yet <span>— first imprint in 5 seconds.</span></p>';
      return;
    }
    const visibleEchoes = echoes.slice(-3).reverse();
    ui.echoList.innerHTML = visibleEchoes.map((echo) => {
      const holding = echo.elapsed >= echo.duration - 0.0001;
      const label = `ECHO ${String(echo.id).padStart(2, '0')}`;
      return `<div class="echo-row${holding ? ' is-holding' : ''}"><span class="echo-glyph" aria-hidden="true">◌</span><span>${label}</span><span class="echo-row-state">${holding ? 'HOLDING' : 'REPLAYING'}</span></div>`;
    }).join('');
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width * dpr);
    const height = Math.round(bounds.width * (WORLD_HEIGHT / WORLD_WIDTH) * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    sky.addColorStop(0, '#091624');
    sky.addColorStop(0.57, '#0c1a27');
    sky.addColorStop(1, '#101e29');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const glow = ctx.createRadialGradient(512, 315, 20, 512, 315, 520);
    glow.addColorStop(0, 'rgba(48, 114, 122, 0.13)');
    glow.addColorStop(0.55, 'rgba(29, 67, 85, 0.065)');
    glow.addColorStop(1, 'rgba(5, 11, 19, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // A distant chrono-rift gives the background a soft, animated focal point.
    ctx.save();
    ctx.translate(510, 278);
    ctx.rotate(Math.sin(visualTime * 0.11) * 0.035);
    for (let ring = 0; ring < 4; ring += 1) {
      const ringFade = 0.09 - ring * 0.014 + (Math.sin(visualTime * 0.7 + ring) + 1) * 0.012;
      ctx.globalAlpha = ringFade;
      ctx.strokeStyle = ring % 2 === 0 ? level.accent : '#8882cf';
      ctx.lineWidth = ring === 0 ? 1.6 : 1;
      ctx.setLineDash(ring % 2 === 0 ? [3, 12] : [12, 18]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 174 + ring * 31, 51 + ring * 13, ring * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.07;
    const riftCore = ctx.createRadialGradient(0, 0, 2, 0, 0, 155);
    riftCore.addColorStop(0, 'rgba(101, 226, 214, 0.4)');
    riftCore.addColorStop(0.5, 'rgba(92, 129, 180, 0.16)');
    riftCore.addColorStop(1, 'rgba(21, 37, 62, 0)');
    ctx.fillStyle = riftCore;
    ctx.beginPath();
    ctx.ellipse(0, 0, 170, 49, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // Sparse stars and a quiet instrument-grid make the play field legible without clutter.
    for (let i = 0; i < backgroundSpecks.length; i += 1) {
      const speck = backgroundSpecks[i];
      const shimmer = 0.14 + (Math.sin(visualTime * 1.2 + speck.phase) + 1) * 0.2;
      const driftX = (speck.x + visualTime * (1.1 + (i % 4) * 0.35)) % WORLD_WIDTH;
      const driftY = speck.y + Math.sin(visualTime * 0.38 + speck.phase) * 3;
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = i % 9 === 0 ? '#e7c7ff' : level.accent;
      ctx.beginPath();
      ctx.arc(driftX, driftY, speck.r, 0, Math.PI * 2);
      ctx.fill();
      if (i % 11 === 0) {
        ctx.globalAlpha = shimmer * 0.4;
        ctx.fillRect(driftX - 7, driftY, 5, 0.8);
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(109, 151, 171, 0.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 50; y < 455; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WORLD_WIDTH, y + 0.5);
      ctx.stroke();
    }

    // Low-contrast distant structures establish scale and depth.
    ctx.fillStyle = 'rgba(13, 30, 43, 0.65)';
    const skyline = [
      [8, 300, 60, 120], [93, 334, 37, 86], [151, 283, 72, 137], [246, 326, 46, 94],
      [327, 301, 58, 119], [420, 342, 47, 78], [502, 288, 69, 132], [604, 328, 42, 92],
      [674, 306, 74, 114], [786, 337, 50, 83], [858, 292, 70, 128], [950, 321, 47, 99]
    ];
    for (const [x, y, w, h] of skyline) {
      ctx.fillRect(x, y, w, h);
      for (let wx = x + 9; wx < x + w - 4; wx += 15) {
        for (let wy = y + 12; wy < y + h - 10; wy += 17) {
          const lit = (Math.floor(wx * 3 + wy * 7) % 5) === 0;
          const flicker = 0.13 + (Math.sin(visualTime * 0.6 + wx * 0.08 + wy) + 1) * 0.045;
          ctx.globalAlpha = lit ? flicker + 0.12 : flicker;
          ctx.fillStyle = lit ? '#7bc7c5' : '#466d7a';
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(13, 30, 43, 0.65)';
    }

    const horizon = ctx.createLinearGradient(0, 385, 0, 490);
    horizon.addColorStop(0, 'rgba(20, 50, 59, 0)');
    horizon.addColorStop(1, 'rgba(16, 43, 52, 0.45)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 380, WORLD_WIDTH, 105);
  }

  function drawPlatform(platform) {
    const { x, y, w, h } = platform;
    const isGround = platform.kind === 'ground';
    const base = ctx.createLinearGradient(0, y, 0, y + h);
    if (isGround) {
      base.addColorStop(0, '#182d38');
      base.addColorStop(0.08, '#142633');
      base.addColorStop(1, '#0c1924');
    } else {
      base.addColorStop(0, '#29434c');
      base.addColorStop(0.22, '#182d39');
      base.addColorStop(1, '#0d1d2a');
    }
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = isGround ? level.accent : '#77d6ca';
    ctx.globalAlpha = isGround ? 0.58 : 0.78;
    ctx.fillRect(x, y, w, isGround ? 2 : 3);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(110, 171, 177, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (isGround) {
      ctx.fillStyle = 'rgba(155, 239, 224, 0.12)';
      ctx.fillRect(x, y + 3, w, 1);
      const scanWidth = Math.min(54, w);
      const scanX = x + ((visualTime * 44 + x * 0.4) % Math.max(1, w + scanWidth)) - scanWidth;
      const scan = ctx.createLinearGradient(scanX, 0, scanX + scanWidth, 0);
      scan.addColorStop(0, 'rgba(87, 225, 210, 0)');
      scan.addColorStop(0.5, 'rgba(87, 225, 210, 0.13)');
      scan.addColorStop(1, 'rgba(87, 225, 210, 0)');
      ctx.fillStyle = scan;
      ctx.fillRect(Math.max(x, scanX), y + 4, Math.min(scanWidth, x + w - Math.max(x, scanX)), h - 8);
      ctx.strokeStyle = 'rgba(95, 144, 155, 0.09)';
      for (let seam = x + 36; seam < x + w; seam += 58) {
        ctx.beginPath();
        ctx.moveTo(seam + 0.5, y + 13);
        ctx.lineTo(seam + 0.5, Math.min(y + 28, y + h - 3));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(105, 166, 168, 0.16)';
      for (let bolt = x + 13; bolt < x + w - 8; bolt += 58) {
        ctx.beginPath();
        ctx.arc(bolt, y + 9, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      const lowerGlow = ctx.createLinearGradient(0, y + 22, 0, y + h);
      lowerGlow.addColorStop(0, 'rgba(7, 16, 24, 0)');
      lowerGlow.addColorStop(1, 'rgba(2, 8, 14, 0.35)');
      ctx.fillStyle = lowerGlow;
      ctx.fillRect(x, y + 20, w, h - 20);
    } else {
      ctx.fillStyle = 'rgba(109, 206, 195, 0.28)';
      ctx.fillRect(x + 7, y + h - 3, Math.max(0, w - 14), 1);
      for (let bolt = x + 7; bolt < x + w - 5; bolt += 24) {
        ctx.fillStyle = 'rgba(143, 221, 208, 0.52)';
        ctx.beginPath();
        ctx.arc(bolt, y + 7, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = 0.24;
      const underlight = ctx.createLinearGradient(0, y + h, 0, y + h + 12);
      underlight.addColorStop(0, 'rgba(91, 242, 218, 0.32)');
      underlight.addColorStop(1, 'rgba(91, 242, 218, 0)');
      ctx.fillStyle = underlight;
      ctx.fillRect(x + 9, y + h - 1, Math.max(0, w - 18), 12);
      ctx.restore();
    }
  }

  function drawHazard(hazard) {
    if (hazard.type === 'sweeper') {
      drawSweeper(hazardBounds(hazard));
      return;
    }
    const { x, y, w, h } = hazard;
    const glow = ctx.createLinearGradient(0, y - 20, 0, y + h);
    glow.addColorStop(0, 'rgba(255, 103, 102, 0)');
    glow.addColorStop(1, 'rgba(255, 87, 91, 0.15)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 12, y - 20, w + 24, h + 18);

    const count = Math.max(2, Math.floor(w / 16));
    const tooth = w / count;
    for (let i = 0; i < count; i += 1) {
      const left = x + i * tooth;
      ctx.beginPath();
      ctx.moveTo(left, y + h);
      ctx.lineTo(left + tooth * 0.5, y + 1 + (i % 2) * 1.5);
      ctx.lineTo(left + tooth, y + h);
      ctx.closePath();
      const spike = ctx.createLinearGradient(0, y, 0, y + h);
      spike.addColorStop(0, '#ff9c89');
      spike.addColorStop(0.45, '#df6670');
      spike.addColorStop(1, '#6c394b');
      ctx.fillStyle = spike;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 166, 146, 0.6)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    const pulse = 0.48 + (Math.sin(visualTime * 5 + x) + 1) * 0.16;
    ctx.fillStyle = 'rgba(255, 105, 108, 0.72)';
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff958a';
    ctx.fillRect(x, y - 3, w, 1);
    for (let i = 0; i < 4; i += 1) {
      const sparkX = x + ((visualTime * 24 + i * (w / 4)) % w);
      const sparkY = y - 5 - ((visualTime * 13 + i * 7) % 13);
      ctx.fillRect(sparkX, sparkY, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }

  function drawSweeper(sweeper) {
    const { x, y, w, h } = sweeper;
    const pulse = 0.65 + (Math.sin(visualTime * 6 + x) + 1) * 0.13;
    ctx.save();
    const aura = ctx.createLinearGradient(x, 0, x + w, 0);
    aura.addColorStop(0, 'rgba(126, 151, 255, 0)');
    aura.addColorStop(0.5, 'rgba(126, 151, 255, 0.23)');
    aura.addColorStop(1, 'rgba(126, 151, 255, 0)');
    ctx.globalAlpha = pulse * 0.7;
    ctx.fillStyle = aura;
    ctx.fillRect(x - 16, y - 12, w + 32, h + 24);

    ctx.globalAlpha = 1;
    ctx.shadowColor = level.accent;
    ctx.shadowBlur = 13;
    roundedRect(ctx, x, y, w, h, 6);
    const shell = ctx.createLinearGradient(0, y, 0, y + h);
    shell.addColorStop(0, '#384965');
    shell.addColorStop(0.48, '#192d43');
    shell.addColorStop(1, '#101d32');
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = level.accent;
    ctx.globalAlpha = pulse;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(7, 17, 30, 0.9)';
    roundedRect(ctx, x + 4, y + 6, w - 8, h - 12, 3);
    ctx.fill();
    ctx.fillStyle = level.accent;
    ctx.globalAlpha = pulse;
    roundedRect(ctx, x + 7, y + h / 2 - 2, w - 14, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ecffff';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 235, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 2);
    ctx.lineTo(x + 2, y - 5);
    ctx.moveTo(x + w - 5, y + 2);
    ctx.lineTo(x + w - 2, y - 5);
    ctx.stroke();
    ctx.fillStyle = level.accent;
    ctx.beginPath();
    ctx.arc(x + 2, y - 5, 1.3, 0, Math.PI * 2);
    ctx.arc(x + w - 2, y - 5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRelay(relay) {
    const floor = relay.floorY;
    const pressed = relay.active;
    const primed = relay.playerTouch && !pressed;
    const hue = pressed ? '#70e6d8' : primed ? '#ffbd78' : '#638a94';

    if (pressed || primed) {
      const aura = ctx.createRadialGradient(relay.x + relay.w / 2, floor - 9, 1, relay.x + relay.w / 2, floor - 9, 52);
      aura.addColorStop(0, pressed ? 'rgba(90, 238, 218, 0.16)' : 'rgba(255, 189, 120, 0.13)');
      aura.addColorStop(1, 'rgba(65, 180, 170, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(relay.x - 35, floor - 58, relay.w + 70, 58);
    }

    ctx.save();
    ctx.shadowColor = pressed ? 'rgba(93, 245, 221, 0.45)' : primed ? 'rgba(255, 189, 120, 0.3)' : 'transparent';
    ctx.shadowBlur = pressed ? 13 : primed ? 9 : 0;
    roundedRect(ctx, relay.x - 6, floor - 10, relay.w + 12, 11, 3);
    ctx.fillStyle = pressed ? '#163f40' : primed ? '#483a32' : '#122632';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pressed ? 'rgba(114, 231, 220, 0.9)' : primed ? 'rgba(255, 189, 120, 0.75)' : 'rgba(115, 159, 168, 0.48)';
    ctx.lineWidth = 1;
    ctx.stroke();

    roundedRect(ctx, relay.x + 4, floor - 7, relay.w - 8, 4, 2);
    ctx.fillStyle = pressed ? '#80ffea' : primed ? '#ffce8f' : '#516b75';
    ctx.fill();

    for (let i = 0; i < 4; i += 1) {
      const tickX = relay.x + 11 + i * (relay.w - 22) / 3;
      ctx.fillStyle = pressed ? 'rgba(144, 255, 235, 0.75)' : primed ? 'rgba(255, 211, 158, 0.75)' : 'rgba(113, 159, 169, 0.38)';
      ctx.fillRect(tickX, floor - 16 - (i % 2) * 2, 2, 4 + (i % 2) * 2);
    }

    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = pressed ? '#9affed' : primed ? '#ffd0a0' : '#6f929b';
    ctx.globalAlpha = pressed || primed ? 0.95 : 0.7;
    ctx.fillText(relay.label, relay.x + relay.w / 2, floor - 25);
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pressed ? 0.7 : primed ? 0.55 : 0.25;
    ctx.strokeStyle = hue;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(relay.x + relay.w / 2, floor - 17);
    ctx.lineTo(relay.x + relay.w / 2, floor - 30 - (pressed ? 5 + Math.sin(visualTime * 4) * 3 : 0));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pressed ? 0.9 : primed ? 0.72 : 0.28;
    ctx.fillStyle = hue;
    for (let mote = 0; mote < 3; mote += 1) {
      const angle = visualTime * (pressed ? 1.5 : 0.7) + mote * (Math.PI * 2 / 3);
      const orbitX = relay.x + relay.w / 2 + Math.cos(angle) * (relay.w * 0.43);
      const orbitY = floor - 20 + Math.sin(angle) * 5;
      ctx.beginPath();
      ctx.arc(orbitX, orbitY, pressed ? 1.6 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGate() {
    const gate = level.gate;
    if (!gate) return;
    const { x, y, w, h } = gate;
    ctx.save();
    if (!gateOpen) {
      const panel = ctx.createLinearGradient(x, 0, x + w, 0);
      panel.addColorStop(0, 'rgba(79, 62, 62, 0.82)');
      panel.addColorStop(0.5, 'rgba(107, 67, 62, 0.75)');
      panel.addColorStop(1, 'rgba(51, 53, 65, 0.88)');
      ctx.fillStyle = panel;
      ctx.fillRect(x + 2, y + 5, w - 4, h - 5);
      ctx.fillStyle = 'rgba(223, 127, 111, 0.78)';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = 'rgba(227, 149, 119, 0.62)';
      ctx.fillRect(x - 2, y + 2, w + 4, 3);
      ctx.strokeStyle = 'rgba(250, 187, 146, 0.44)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.5, y + 7.5, w - 7, h - 12);
      for (let stripeY = y + 16; stripeY < y + h - 8; stripeY += 13) {
        ctx.fillStyle = 'rgba(255, 206, 164, 0.28)';
        ctx.fillRect(x + 5, stripeY, w - 10, 1);
      }
      const lockY = y + h * 0.48;
      ctx.fillStyle = 'rgba(13, 21, 30, 0.92)';
      roundedRect(ctx, x - 7, lockY - 9, w + 14, 23, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(248, 185, 143, 0.55)';
      ctx.stroke();
      ctx.strokeStyle = '#ffc498';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x + w / 2, lockY - 1, 4.2, Math.PI, 0);
      ctx.stroke();
      roundedRect(ctx, x + w / 2 - 5, lockY - 1, 10, 10, 2);
      ctx.fillStyle = '#d69074';
      ctx.fill();
      ctx.fillStyle = '#382c30';
      ctx.beginPath();
      ctx.arc(x + w / 2, lockY + 3, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = level.accent;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 5.5, y + 1.5, w + 11, h - 1);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = level.accent;
      ctx.fillRect(x + w / 2 - 1, y + 5, 2, h - 7);
      ctx.setLineDash([4, 7]);
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = level.accent;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 6);
      ctx.lineTo(x + w / 2, y + h - 5);
      ctx.stroke();
      ctx.setLineDash([]);
      const pulse = 0.25 + (Math.sin(visualTime * 4) + 1) * 0.08;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = level.accent;
      ctx.fillRect(x - 4, y + h - 4, w + 8, 2);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i += 1) {
        const py = y + h - ((visualTime * 32 + i * 46) % h);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = level.accent;
        ctx.fillRect(x + w / 2 - 1, py, 2, 3);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawGoal() {
    const goal = level.goal;
    const cx = goal.x + goal.w / 2;
    const cy = goal.y + goal.h / 2;
    const pulse = (Math.sin(visualTime * 2.5) + 1) * 0.5;
    const active = gateOpen;
    const tint = active ? level.accent : '#9ba1d8';

    ctx.save();
    ctx.globalAlpha = active ? 0.3 : 0.12;
    const aura = ctx.createRadialGradient(cx, cy, 4, cx, cy, 57);
    aura.addColorStop(0, active ? 'rgba(110, 238, 217, 0.3)' : 'rgba(139, 142, 204, 0.18)');
    aura.addColorStop(1, 'rgba(10, 20, 30, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(cx - 58, goal.y - 15, 116, goal.h + 30);

    ctx.globalAlpha = active ? 0.46 + pulse * 0.18 : 0.2;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 17 + pulse * 2, 33 + pulse * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = active ? 0.75 : 0.25;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = active ? 'rgba(86, 206, 193, 0.13)' : 'rgba(100, 106, 152, 0.08)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = active ? 0.55 : 0.18;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 25, 39, -0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let mote = 0; mote < 5; mote += 1) {
      const angle = visualTime * 0.8 + mote * (Math.PI * 2 / 5);
      const moteX = cx + Math.cos(angle) * 25;
      const moteY = cy + Math.sin(angle) * 39;
      ctx.globalAlpha = active ? 0.5 + pulse * 0.3 : 0.17;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(moteX, moteY, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = active ? 0.9 : 0.45;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = tint;
    ctx.fillText('EXIT', cx, goal.y - 9);
    ctx.restore();
  }

  function drawEcho(echo) {
    const pose = echoPose(echo);
    if (!pose) return;
    const isHolding = echo.elapsed >= echo.duration - 0.0001;
    const alpha = isHolding ? 0.62 : 0.46;
    const currentFrame = Math.min(echo.path.length - 1, Math.floor(echo.elapsed / STEP));

    // A short luminous ribbon makes the replay direction and recorded route readable.
    if (!isHolding && currentFrame > 2) {
      const firstFrame = Math.max(0, currentFrame - 45);
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = '#69e8dc';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#54e5d6';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      for (let frame = firstFrame; frame <= currentFrame; frame += 3) {
        const sample = echo.path[frame];
        const px = sample.x + player.w / 2;
        const py = sample.y + player.h * 0.64;
        if (frame === firstFrame) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    } else if (isHolding) {
      ctx.save();
      ctx.globalAlpha = 0.24 + (Math.sin(visualTime * 3 + echo.id) + 1) * 0.08;
      ctx.strokeStyle = '#74f5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(pose.x + player.w / 2, pose.y + player.h - 1, 17, 4 + Math.sin(visualTime * 2 + echo.id) * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawActor(pose, 'echo', alpha, echo.id);
  }

  function drawActor(actor, kind, alpha = 1, echoId = 0) {
    const isEcho = kind === 'echo';
    const x = actor.x;
    const y = actor.y;
    const w = player.w;
    const h = player.h;
    const facing = actor.facing || 1;
    const isMoving = actor.moving && actor.grounded;
    const step = isMoving ? Math.sin(actor.walkPhase * 2) * 2.3 : 0;
    const bodyColor = isEcho ? '#6ff1df' : '#ffc17b';
    const outline = isEcho ? '#a2fff0' : '#ffe1ad';

    ctx.save();
    ctx.globalAlpha = alpha;

    if (!isEcho) {
      const halo = ctx.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, 39);
      halo.addColorStop(0, 'rgba(255, 177, 104, 0.17)');
      halo.addColorStop(1, 'rgba(255, 177, 104, 0)');
      ctx.globalAlpha = alpha * (actor.moving ? 0.78 : 0.52);
      ctx.fillStyle = halo;
      ctx.fillRect(x - 15, y - 16, w + 30, h + 32);
      if (actor.moving) {
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillStyle = bodyColor;
        for (let streak = 1; streak <= 3; streak += 1) {
          const trailX = x - facing * (streak * 5 + 2);
          roundedRect(ctx, trailX + 6, y + 20 + streak * 2, w - 12, 2, 1);
          ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
    }

    if (actor.grounded) {
      ctx.globalAlpha = alpha * (isEcho ? 0.25 : 0.28);
      ctx.fillStyle = isEcho ? '#5af2df' : '#ffbd78';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h + 2, 14, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    if (isEcho) {
      ctx.shadowColor = '#68ffe6';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(132, 255, 239, 0.92)';
      ctx.lineWidth = 1.2;
      roundedRect(ctx, x + 3, y + 8, w - 6, h - 10, 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(66, 196, 188, 0.22)';
      roundedRect(ctx, x + 5, y + 10, w - 10, h - 13, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(173, 255, 243, 0.86)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 8, 6.5, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#9efff1';
      ctx.fillRect(x + 7, y + 18, w - 14, 2);
      ctx.fillStyle = 'rgba(162, 255, 240, 0.9)';
      roundedRect(ctx, x + 7, y + 23, w - 14, 10, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140, 255, 237, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 9, y + h - 5);
      ctx.lineTo(x + 8 + step, y + h);
      ctx.moveTo(x + w - 9, y + h - 5);
      ctx.lineTo(x + w - 8 - step, y + h);
      ctx.stroke();
      ctx.fillStyle = '#c4fff8';
      ctx.beginPath();
      ctx.arc(x + w / 2 + facing * 2, y + 8, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.82;
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b8fff4';
      ctx.fillText(String(echoId).padStart(2, '0'), x + w / 2, y - 5);
    } else {
      ctx.shadowColor = 'rgba(255, 166, 91, 0.52)';
      ctx.shadowBlur = 12;
      // Compact time-runner silhouette with a trailing chronoscarf and layered suit plates.
      const scarfFlutter = actor.moving ? Math.sin(actor.walkPhase * 3) * 3 : Math.sin(visualTime * 2) * 1.2;
      ctx.fillStyle = '#c96252';
      ctx.beginPath();
      if (facing > 0) {
        ctx.moveTo(x + 8, y + 15);
        ctx.quadraticCurveTo(x + 1, y + 13, x - 8, y + 9 + scarfFlutter);
        ctx.lineTo(x - 1, y + 21 + scarfFlutter * 0.5);
        ctx.lineTo(x + 8, y + 21);
      } else {
        ctx.moveTo(x + w - 8, y + 15);
        ctx.quadraticCurveTo(x + w - 1, y + 13, x + w + 8, y + 9 + scarfFlutter);
        ctx.lineTo(x + w + 1, y + 21 + scarfFlutter * 0.5);
        ctx.lineTo(x + w - 8, y + 21);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = bodyColor;
      roundedRect(ctx, x + 5, y + 13, w - 10, 21, 5);
      ctx.fill();
      ctx.fillStyle = '#ffce8d';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 9, 7.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 9, 7.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#273442';
      roundedRect(ctx, x + 8 + (facing > 0 ? 1 : -1), y + 7, 12, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = '#f9ffff';
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillRect(x + 12 + (facing > 0 ? 2 : -2), y + 8, 4, 1.2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255, 229, 180, 0.85)';
      roundedRect(ctx, x + 12, y + 19, 5, 9, 2);
      ctx.fill();
      ctx.fillStyle = '#fff3cc';
      ctx.beginPath();
      ctx.moveTo(x + 14.5, y + 20.5);
      ctx.lineTo(x + 16.2, y + 23.5);
      ctx.lineTo(x + 14.5, y + 26.5);
      ctx.lineTo(x + 12.8, y + 23.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = outline;
      roundedRect(ctx, x + 8, y + 18, 3, 11, 1.5);
      ctx.fill();
      ctx.fillStyle = '#cf7649';
      roundedRect(ctx, x + 8 + step * 0.55, y + 31, 5, 8 + Math.max(0, step), 2);
      ctx.fill();
      roundedRect(ctx, x + 16 - step * 0.55, y + 31, 5, 8 - Math.min(0, step), 2);
      ctx.fill();
      ctx.fillStyle = outline;
      ctx.fillRect(x + (facing > 0 ? 24 : 2), y + 19, 2, 7);
    }
    ctx.restore();
  }

  function drawStatusOverlay() {
    if (status !== 'complete' && status !== 'respawning') return;
    ctx.save();
    ctx.fillStyle = status === 'complete' ? 'rgba(4, 12, 19, 0.57)' : 'rgba(7, 11, 18, 0.44)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const cardW = 366;
    const cardH = status === 'complete' ? 142 : 116;
    const cardX = (WORLD_WIDTH - cardW) / 2;
    const cardY = (WORLD_HEIGHT - cardH) / 2 - 10;
    const card = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    card.addColorStop(0, 'rgba(18, 40, 52, 0.96)');
    card.addColorStop(1, 'rgba(10, 24, 36, 0.96)');
    roundedRect(ctx, cardX, cardY, cardW, cardH, 9);
    ctx.fillStyle = card;
    ctx.fill();
    ctx.strokeStyle = status === 'complete' ? 'rgba(114, 231, 220, 0.49)' : 'rgba(255, 157, 128, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '8px monospace';
    ctx.fillStyle = status === 'complete' ? '#76e7db' : '#ffad90';
    ctx.fillText(status === 'complete' ? 'TEMPORAL FIELD STABLE' : 'SIGNAL LOST · REWINDING', WORLD_WIDTH / 2, cardY + 31);
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = '#eff8f6';
    const finalSector = currentLevelIndex === LEVELS.length - 1;
    const title = status === 'complete' ? (finalSector ? 'Timeline restored' : 'Sector complete') : 'Time fractured';
    ctx.fillText(title, WORLD_WIDTH / 2, cardY + 64);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#9ab0b9';
    if (status === 'complete') {
      ctx.fillText(finalSector ? 'You have rewritten the whole sequence.' : 'The exit is open. Continue to the next chamber.', WORLD_WIDTH / 2, cardY + 87);
      ctx.fillStyle = '#9ff5e7';
      ctx.font = '8px monospace';
      ctx.fillText(finalSector ? 'PRESS ENTER OR PLAY AGAIN' : `PRESS ENTER OR CONTINUE TO SECTOR ${String(currentLevelIndex + 2).padStart(2, '0')}`, WORLD_WIDTH / 2, cardY + 117);
    } else {
      ctx.fillText('Rebuilding the chamber from its first frame…', WORLD_WIDTH / 2, cardY + 88);
    }
    ctx.restore();
  }

  function render() {
    resizeCanvas();
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawBackground();
    for (const platform of level.platforms) drawPlatform(platform);
    for (const hazard of level.hazards) drawHazard(hazard);
    for (const relay of level.switches) drawRelay(relay);
    drawGoal();
    drawGate();
    for (const echo of echoes) drawEcho(echo);
    drawActor(player, 'player', status === 'respawning' ? Math.max(0.18, deathTimer / 0.82) : 1);
    drawStatusOverlay();
  }

  function frame(now) {
    visualTime = now / 1000;
    if (!gameStarted) {
      lastFrameTime = now;
      window.requestAnimationFrame(frame);
      return;
    }

    if (!lastFrameTime) lastFrameTime = now;
    const frameDelta = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    accumulator += frameDelta;

    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }

    updateUi();
    render();
    window.requestAnimationFrame(frame);
  }

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }

  buildLevelTabs();
  loadLevel(0);
  resizeCanvas();
  if (ui.playButton.focus) ui.playButton.focus({ preventScroll: true });
  window.requestAnimationFrame(frame);
})();
