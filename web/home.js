// The hero replay: one orchestrated moment showing Kavach cutting into a scam call.
const fig = document.getElementById('replay');
const lines = [...fig.querySelectorAll('li')];
const fill = document.getElementById('replay-fill');
const time = document.getElementById('replay-time');
const RISK = [10, 45, 88, 88]; // risk after each caller line, from the real rules engine
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timers = [];

function play() {
  timers.forEach(clearTimeout);
  timers = [];
  if (reduced) return;
  fig.classList.add('playing');
  lines.forEach((li) => li.classList.remove('on'));
  fill.style.width = '3%';
  fill.style.background = 'var(--tulsi)';
  const start = Date.now();
  const clock = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000) + 3;
    time.textContent = `0:${String(s).padStart(2, '0')}`;
  }, 250);
  timers.push(setTimeout(() => clearInterval(clock), 9000));
  const at = [400, 2200, 4200, 5600];
  lines.forEach((li, i) =>
    timers.push(
      setTimeout(() => {
        li.classList.add('on');
        fill.style.width = `${RISK[i]}%`;
        fill.style.background = RISK[i] >= 50 ? 'var(--sindoor)' : RISK[i] >= 28 ? 'var(--saffron)' : 'var(--tulsi)';
      }, at[i]),
    ),
  );
}

document.getElementById('replay-again').addEventListener('click', play);
// Start when the hero is visible (it is, on load), once.
play();
