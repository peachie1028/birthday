const SONG_ENTRY = "audio/hbd.mp3";
const SONG_BLOWOUT = "audio/yay.mp3";

const frameOut = document.getElementById("frame_out");
const flickerFrames = [
  document.getElementById("frame1"),
  document.getElementById("frame2"),
  document.getElementById("frame3"),
];

let animating = false;
let animInterval = null;
const entrySong = new Audio(SONG_ENTRY);
const blowoutSong = new Audio(SONG_BLOWOUT);

entrySong.loop = true;
entrySong.volume = 0.7;
blowoutSong.loop = false;
blowoutSong.volume = 0.8;

let entryStarted = false;
function startEntryOnce() {
  if (!entryStarted) {
    entryStarted = true;
    entrySong.play().catch(() => {});
  }
}
document.addEventListener("click", startEntryOnce, { once: true });
document.addEventListener("touchstart", startEntryOnce, { once: true });

// Resize confetti canvas when orientation changes
window.addEventListener("resize", () => {
  const canvas = document.getElementById("confetti-canvas");
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// Candle flicker
window.addEventListener("DOMContentLoaded", () => startFlicker());

function showFrame(el) {
  [frameOut, ...flickerFrames].forEach((f) => f.classList.remove("active"));
  el.classList.add("active");
}

function startFlicker() {
  if (animating) return;
  animating = true;
  showFrame(flickerFrames[0]);
  animInterval = setInterval(() => {
    showFrame(flickerFrames[Math.floor(Math.random() * 3)]);
  }, 120);
}

function stopFlicker() {
  animating = false;
  clearInterval(animInterval);
  showFrame(frameOut);

  fadeOut(entrySong, 800, () => {
    blowoutSong.currentTime = 0;
    blowoutSong.play().catch(() => {});
  });

  launchConfetti();
}

function lightCandle() {
  clearConfetti();
  blowoutSong.pause();
  blowoutSong.currentTime = 0;
  entrySong.currentTime = 0;
  entrySong.volume = 0.7;
  entrySong.play().catch(() => {});
  startFlicker();
}

function blowCandle() {
  stopFlicker();
}

const cakeArea = document.getElementById("cakeArea");
cakeArea.addEventListener("click", (e) => {
  e.preventDefault();
  if (!animating) lightCandle();
  else blowCandle();
});

cakeArea.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (!animating) lightCandle();
  else blowCandle();
});

// Fade out
function fadeOut(audio, durationMs, onDone) {
  const startVol = audio.volume;
  const steps = 30;
  const interval = durationMs / steps;
  const decrement = startVol / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    audio.volume = Math.max(0, startVol - decrement * step);
    if (step >= steps) {
      clearInterval(timer);
      audio.pause();
      audio.currentTime = 0;
      if (onDone) onDone();
    }
  }, interval);
}

// Confetti
const COLORS = [
  "#f5c842",
  "#f5a623",
  "#ff6eb4",
  "#ff3e6c",
  "#7ee8fa",
  "#ffffff",
  "#b388ff",
  "#69f0ae",
];
const SHAPES = ["rect", "circle"];
let confettiPieces = [];
let confettiRaf = null;

function clearConfetti() {
  cancelAnimationFrame(confettiRaf);
  confettiPieces = [];
  const canvas = document.getElementById("confetti-canvas");
  if (canvas)
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

function launchConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  confettiPieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    w: 8 + Math.random() * 10,
    h: 4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    speed: 2 + Math.random() * 4,
    drift: (Math.random() - 0.5) * 1.5,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.15,
    opacity: 0.85 + Math.random() * 0.15,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let allGone = true;
    for (const p of confettiPieces) {
      p.y += p.speed;
      p.x += p.drift;
      p.rotation += p.rotSpeed;
      if (p.y < canvas.height + 20) allGone = false;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (!allGone) confettiRaf = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// Mic detection
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      const micCtx = new AudioContext();

      function resumeMic() {
        if (micCtx.state === "suspended") micCtx.resume();
      }
      document.addEventListener("click", resumeMic, { once: true });
      document.addEventListener("touchstart", resumeMic, { once: true });

      const mic = micCtx.createMediaStreamSource(stream);
      const analyser = micCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      mic.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const WINDOW = 25,
        THRESHOLD = 40,
        FRAMES_ABOVE = 15;
      const volHistory = [];

      function detect() {
        requestAnimationFrame(detect);
        analyser.getByteFrequencyData(data);
        const blowBand = data.slice(0, Math.floor(data.length * 0.25));
        const vol = blowBand.reduce((a, b) => a + b, 0) / blowBand.length;
        volHistory.push(vol);
        if (volHistory.length > WINDOW) volHistory.shift();
        if (
          volHistory.filter((v) => v > THRESHOLD).length >= FRAMES_ABOVE &&
          animating
        )
          blowCandle();
      }
      detect();
    })
    .catch(() => {});
}
