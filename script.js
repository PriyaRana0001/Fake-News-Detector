
    const GROQ_KEY = "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";
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";

    const STEPS = [
      "Decoding linguistic signatures",
      "Evaluating source credibility",
      "Detecting sensationalism patterns",
      "Cross-referencing attribution",
      "Compiling verdict"
    ];

    let stepIdx = 0, stepTimer = null;

    // TTS state
    let ttsUtterance = null;
    let ttsText = "";
    let ttsSpeaking = false;
    let ttsPaused = false;
    let ttsStartTime = 0;
    let ttsElapsedBefore = 0;
    let ttsProgressTimer = null;
    let ttsEstimatedDuration = 0;
    let ttsCurrentElapsed = 0;
    const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
    const SPEED_LABELS = ['0.75×', '1×', '1.25×', '1.5×', '2×'];
    let speedIdx = 1;

    async function runForensics() {
      const input = document.getElementById('newsInput').value.trim();
      if (!input) {
        const ta = document.getElementById('newsInput');
        ta.style.borderColor = 'rgba(239,68,68,0.6)';
        setTimeout(() => ta.style.borderColor = '', 800);
        return;
      }

      stopSpeech();

      const btn = document.getElementById('scanBtn');
      btn.disabled = true;
      document.getElementById('loader').classList.add('active');
      document.getElementById('verdictBanner').classList.remove('active', 'authentic', 'suspicious', 'fabricated');
      document.getElementById('resultsWrap').classList.remove('active');
      document.getElementById('ttsPanel').classList.remove('active');

      stepIdx = 0;
      document.getElementById('loaderStep').textContent = STEPS[0];
      stepTimer = setInterval(() => {
        stepIdx = (stepIdx + 1) % STEPS.length;
        document.getElementById('loaderStep').textContent = STEPS[stepIdx];
      }, 1000);

      const prompt = `Perform a forensic news analysis on: "${input}".
Return JSON only — no markdown, no extra text:
{
  "verdict": "Likely Authentic" | "Highly Suspicious" | "Confirmed Fabricated",
  "score": 0-100,
  "metrics": {
    "Source Credibility": 0-100,
    "Logic Flow": 0-100,
    "Sensationalism": 0-100,
    "Attribution": 0-100
  },
  "summary": "3-sentence expert forensic breakdown.",
  "search_queries": ["specific fact-check query 1", "specific fact-check query 2"]
}`;

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are a forensic news analysis AI. Return only valid JSON. No markdown, no code blocks." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });

        const data = await res.json();
        const r = JSON.parse(data.choices[0].message.content);
        renderResults(r);

      } catch (e) {
        alert("Analysis error — please try again.");
        console.error(e);
      } finally {
        clearInterval(stepTimer);
        document.getElementById('loader').classList.remove('active');
        btn.disabled = false;
      }
    }

    function renderResults(r) {
      const score = Math.round(r.score);
      const cls = score > 70 ? 'authentic' : score > 40 ? 'suspicious' : 'fabricated';
      const iconMap = { authentic: 'fa-check', suspicious: 'fa-triangle-exclamation', fabricated: 'fa-xmark' };
      const arcColors = { authentic: '#10b981', suspicious: '#f59e0b', fabricated: '#ef4444' };
      const metricColors = {
        good: { text: '#34d399', bar: '#10b981' },
        mid:  { text: '#fbbf24', bar: '#f59e0b' },
        bad:  { text: '#f87171', bar: '#ef4444' }
      };

      const banner = document.getElementById('verdictBanner');
      banner.className = 'verdict-banner active ' + cls;
      document.getElementById('verdictIcon').innerHTML = `<i class="fa-solid ${iconMap[cls]}"></i>`;
      document.getElementById('verdictTitle').textContent = `${r.verdict} — ${score}%`;

      const arc = document.getElementById('scoreArc');
      arc.setAttribute('stroke', arcColors[cls]);
      const circ = 150.8;
      setTimeout(() => {
        arc.style.strokeDashoffset = circ - (score / 100) * circ;
        document.getElementById('scoreLabel').textContent = score + '%';
      }, 60);

      document.getElementById('metricsGrid').innerHTML = Object.entries(r.metrics).map(([key, rawVal]) => {
        const val = Math.round(rawVal);
        const isSens = key.toLowerCase().includes('sens');
        const goodScore = isSens ? val < 45 : val > 65;
        const midScore  = isSens ? val < 65 : val > 40;
        const c = goodScore ? metricColors.good : midScore ? metricColors.mid : metricColors.bad;
        return `<div class="metric-card">
          <div class="metric-top">
            <span class="metric-name">${key}</span>
            <span class="metric-val" style="color:${c.text}">${val}%</span>
          </div>
          <div class="metric-bar">
            <div class="metric-fill" style="width:0%;background:${c.bar}" data-w="${val}"></div>
          </div>
        </div>`;
      }).join('');

      setTimeout(() => {
        document.querySelectorAll('.metric-fill').forEach(el => {
          el.style.width = el.dataset.w + '%';
        });
      }, 80);

      document.getElementById('summaryText').textContent = r.summary;

      document.getElementById('verifyLinks').innerHTML = r.search_queries.map(q =>
        `<a class="verify-link" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span>${q}</span>
          <span class="verify-link-arrow">↗</span>
        </a>`
      ).join('');

      document.getElementById('resultsWrap').classList.add('active');

      // Build TTS script
      const verdictWord = cls === 'authentic' ? 'likely authentic' : cls === 'suspicious' ? 'highly suspicious' : 'confirmed fabricated';
      const metricLines = Object.entries(r.metrics).map(([k, v]) => `${k}: ${Math.round(v)} percent`).join('. ');
      ttsText = `Forensic analysis complete. Verdict: ${r.verdict}, with a credibility score of ${score} percent. This content is ${verdictWord}. ${r.summary} Signal breakdown — ${metricLines}.`;

      document.getElementById('ttsTrackName').textContent = `${r.verdict} — ${score}% confidence`;
      setupTTS();
      document.getElementById('ttsPanel').classList.add('active');

      // Auto-play after short delay
      setTimeout(() => startSpeech(), 600);
    }

    // ── TTS Engine ──────────────────────────────────────────────

    function setupTTS() {
      window.speechSynthesis.cancel();
      ttsSpeaking = false;
      ttsPaused = false;
      ttsCurrentElapsed = 0;
      ttsElapsedBefore = 0;
      clearInterval(ttsProgressTimer);
      setProgress(0);
      setPlayIcon(false);
      document.getElementById('ttsWave').classList.add('paused');

      // Estimate duration: ~130 words per min at speed 1×
      const wordCount = ttsText.split(' ').length;
      ttsEstimatedDuration = (wordCount / 130) * 60 / SPEEDS[speedIdx];
      document.getElementById('ttsDuration').textContent = formatTime(ttsEstimatedDuration);
      document.getElementById('ttsElapsed').textContent = '0:00';
    }

    function buildUtterance() {
      const utter = new SpeechSynthesisUtterance(ttsText);
      utter.rate = SPEEDS[speedIdx];
      utter.pitch = 1;
      utter.volume = 1;

      // Pick a good English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('google'))
        || voices.find(v => v.lang.startsWith('en') && !v.localService)
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];
      if (preferred) utter.voice = preferred;

      utter.onend = () => {
        ttsSpeaking = false;
        ttsPaused = false;
        clearInterval(ttsProgressTimer);
        setProgress(100);
        document.getElementById('ttsElapsed').textContent = formatTime(ttsEstimatedDuration);
        setPlayIcon(false);
        document.getElementById('ttsWave').classList.add('paused');
      };

      utter.onerror = () => {
        ttsSpeaking = false;
        clearInterval(ttsProgressTimer);
        setPlayIcon(false);
        document.getElementById('ttsWave').classList.add('paused');
      };

      return utter;
    }

    function startSpeech() {
      window.speechSynthesis.cancel();
      ttsUtterance = buildUtterance();
      window.speechSynthesis.speak(ttsUtterance);
      ttsSpeaking = true;
      ttsPaused = false;
      ttsStartTime = Date.now();
      ttsElapsedBefore = 0;
      ttsCurrentElapsed = 0;
      setPlayIcon(true);
      document.getElementById('ttsWave').classList.remove('paused');
      startProgressTimer();
    }

    function toggleSpeech() {
      if (!ttsText) return;

      if (!ttsSpeaking && !ttsPaused) {
        startSpeech();
        return;
      }

      if (ttsSpeaking && !ttsPaused) {
        window.speechSynthesis.pause();
        ttsPaused = true;
        ttsSpeaking = false;
        ttsElapsedBefore = ttsCurrentElapsed;
        clearInterval(ttsProgressTimer);
        setPlayIcon(false);
        document.getElementById('ttsWave').classList.add('paused');
      } else if (ttsPaused) {
        window.speechSynthesis.resume();
        ttsPaused = false;
        ttsSpeaking = true;
        ttsStartTime = Date.now();
        setPlayIcon(true);
        document.getElementById('ttsWave').classList.remove('paused');
        startProgressTimer();
      }
    }

    function stopSpeech() {
  window.speechSynthesis.cancel();

  ttsSpeaking = false;
  ttsPaused = false;
  ttsElapsedBefore = 0;
  ttsCurrentElapsed = 0;

  clearInterval(ttsProgressTimer);

  setProgress(0);

  setPlayIcon(false);

  const elapsedEl = document.getElementById('ttsElapsed');
  if (elapsedEl) elapsedEl.textContent = '0:00';

  const wave = document.getElementById('ttsWave');
  if (wave) wave.classList.add('paused');
}

    function restartSpeech() {
      stopSpeech();
      setTimeout(() => startSpeech(), 100);
    }

    function startProgressTimer() {
      clearInterval(ttsProgressTimer);
      ttsProgressTimer = setInterval(() => {
        const elapsed = ttsElapsedBefore + (Date.now() - ttsStartTime) / 1000;
        ttsCurrentElapsed = elapsed;
        const pct = Math.min((elapsed / ttsEstimatedDuration) * 100, 100);
        setProgress(pct);
        document.getElementById('ttsElapsed').textContent = formatTime(elapsed);
      }, 200);
    }

    function setProgress(pct) {
  const el = document.getElementById('ttsProgress');
  if (!el) return;   // ✅ prevent crash
  el.style.width = pct + '%';
}

    function setPlayIcon(playing) {
      document.getElementById('ttsPlayIcon').className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }

    function cycleSpeed() {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      document.getElementById('ttsSpeedBtn').textContent = SPEED_LABELS[speedIdx];
      const wasSpeaking = ttsSpeaking;
      if (wasSpeaking || ttsPaused) {
        restartSpeech();
      }
    }

    function seekSpeech(e, bar) {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      ttsElapsedBefore = pct * ttsEstimatedDuration;
      ttsCurrentElapsed = ttsElapsedBefore;

      // Web Speech API doesn't support true seeking — restart from beginning
      // and show position visually
      setProgress(pct * 100);
      document.getElementById('ttsElapsed').textContent = formatTime(ttsElapsedBefore);

      if (ttsSpeaking || ttsPaused) {
        restartSpeech();
      }
    }

    function formatTime(secs) {
      const s = Math.max(0, Math.floor(secs));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    // Load voices async (Chrome requires this)
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
