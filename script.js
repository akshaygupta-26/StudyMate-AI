/**
 * StudyMate AI 2.0 - Core Application Logic
 * Next-Gen Intelligent Academic Assistant
 */

// Helper selectors
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/* ==========================================================================
   State Management & Persistence
   ========================================================================== */

const STORAGE_KEYS = {
    TASKS: "studymate_tasks_v2",
    STATS: "studymate_stats_v2",
    SETTINGS: "studymate_settings_v2",
    CUSTOM_CARDS: "studymate_custom_cards_v2",
    FLASHCARD_MASTERY: "studymate_card_mastery_v2"
};

// Default Initial State
const defaultTasks = [
    { id: 1, title: "Revise Chapter 4: Photosynthesis & Calvin Cycle", category: "Revision", priority: "High", dueDate: getFormattedDate(0), completed: false, createdAt: Date.now() },
    { id: 2, title: "Practice 10 multiple-choice questions on Data Structures", category: "Exam Prep", priority: "Medium", dueDate: getFormattedDate(1), completed: true, createdAt: Date.now() - 3600000 },
    { id: 3, title: "Outline history essay thesis and primary sources", category: "Assignment", priority: "Medium", dueDate: getFormattedDate(2), completed: false, createdAt: Date.now() - 7200000 }
];

const defaultStats = {
    streak: 5,
    lastActiveDate: new Date().toDateString(),
    focusMinutesToday: 50,
    completedSessionsToday: 2,
    quizzesCompleted: 3
};

const defaultSettings = {
    theme: "dark",
    soundEnabled: true,
    aiEngine: "offline",
    geminiApiKey: ""
};

// Global App State
let tasks = loadFromStorage(STORAGE_KEYS.TASKS, defaultTasks);
let stats = loadFromStorage(STORAGE_KEYS.STATS, defaultStats);
let settings = loadFromStorage(STORAGE_KEYS.SETTINGS, defaultSettings);
let customCards = loadFromStorage(STORAGE_KEYS.CUSTOM_CARDS, []);
let cardMastery = loadFromStorage(STORAGE_KEYS.FLASHCARD_MASTERY, {});

// Active Runtime Variables
let activeNotesText = "";
let activeSummaryPoints = [];
let currentQuizState = null;
let currentDeckName = "cs";
let currentCardIndex = 0;
let isCardFlipped = false;
let pomodoroTimerId = null;
let pomodoroSecondsLeft = 1500;
let pomodoroTotalDuration = 1500;
let pomodoroMode = "pomodoro"; // pomodoro | shortBreak | longBreak
let pomodoroCycle = 1;
let activeAmbientSound = "none";
let currentTaskFilter = "all";

/* ==========================================================================
   Web Audio API Sound Synthesizer (Zero External Dependencies)
   ========================================================================== */

let audioCtx = null;
let ambientOscillators = [];
let ambientGainNode = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (!settings.soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === "click") {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === "success") {
            // Uplifting chord
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, now + i * 0.07);
                gain.gain.setValueAtTime(0.12, now + i * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.07);
                osc.stop(now + i * 0.07 + 0.35);
            });
        } else if (type === "wrong") {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(120, now + 0.18);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === "bell") {
            // Singing bowl / focus bell
            [440, 880, 1320].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(idx === 0 ? 0.3 : 0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 2.5);
            });
        } else if (type === "flip") {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        }
    } catch (e) {
        console.warn("Audio error:", e);
    }
}

// Ambient Sound Synthesizer (White Noise, Rain, Binaural Beats)
function setAmbientSound(soundName) {
    stopAmbientSound();
    activeAmbientSound = soundName;
    if (soundName === "none") return;

    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        ambientGainNode = ctx.createGain();
        ambientGainNode.gain.setValueAtTime(0.04, ctx.currentTime);
        ambientGainNode.connect(ctx.destination);

        if (soundName === "whitenoise" || soundName === "rain") {
            // Buffer-based noise generator
            const bufferSize = ctx.sampleRate * 2;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;

            const filter = ctx.createBiquadFilter();
            if (soundName === "rain") {
                filter.type = "lowpass";
                filter.frequency.setValueAtTime(650, ctx.currentTime);
            } else {
                filter.type = "bandpass";
                filter.frequency.setValueAtTime(800, ctx.currentTime);
                filter.Q.setValueAtTime(0.7, ctx.currentTime);
            }

            whiteNoise.connect(filter);
            filter.connect(ambientGainNode);
            whiteNoise.start();
            ambientOscillators.push(whiteNoise);
        } else if (soundName === "binaural") {
            // 4Hz Theta beat for deep studying (136Hz and 140Hz)
            const oscL = ctx.createOscillator();
            const oscR = ctx.createOscillator();
            oscL.type = "sine";
            oscR.type = "sine";
            oscL.frequency.setValueAtTime(136, ctx.currentTime);
            oscR.frequency.setValueAtTime(140, ctx.currentTime);

            const merger = ctx.createChannelMerger(2);
            oscL.connect(merger, 0, 0);
            oscR.connect(merger, 0, 1);
            merger.connect(ambientGainNode);

            oscL.start();
            oscR.start();
            ambientOscillators.push(oscL, oscR);
        }
    } catch (e) {
        console.warn("Ambient sound error:", e);
    }
}

function stopAmbientSound() {
    ambientOscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (e) { }
    });
    ambientOscillators = [];
    if (ambientGainNode) {
        try { ambientGainNode.disconnect(); } catch (e) { }
        ambientGainNode = null;
    }
}

/* ==========================================================================
   Confetti Particle Engine
   ========================================================================== */

function launchConfetti() {
    const canvas = $("#confettiCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#7c5cfc", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#ffffff"];
    const particles = [];
    const count = 90;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.7) * 20 - 4,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            gravity: 0.45,
            opacity: 1
        });
    }

    let frame = 0;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rotationSpeed;
            p.opacity -= 0.012;

            if (p.opacity > 0) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                ctx.restore();
            }
        });

        frame++;
        if (alive && frame < 140) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    render();
}

/* ==========================================================================
   Navigation & Theme Management
   ========================================================================== */

function showPage(pageId) {
    playSound("click");
    $$(".page").forEach(page => {
        page.classList.toggle("active-page", page.id === pageId);
    });

    $$(".nav-item").forEach(button => {
        button.classList.toggle("active", button.dataset.target === pageId);
    });

    const pageNames = {
        dashboard: "Dashboard",
        summarizer: "Notes Summarizer",
        quiz: "Quiz Generator",
        flashcards: "Flashcards Hub",
        pomodoro: "Focus Pomodoro",
        planner: "Study Planner",
        chat: "AI Study Buddy"
    };

    $("#pageTitle").textContent = pageNames[pageId] || "Dashboard";
    $("#breadcrumbText").textContent = `WORKSPACE / ${pageNames[pageId]?.toUpperCase() || "OVERVIEW"}`;

    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    settings.theme = theme;
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);

    const isLight = theme === "light";
    $("#themeIcon").textContent = isLight ? "🌙" : "☀️";
    $("#themeText").textContent = isLight ? "Dark Mode" : "Light Mode";
}

function updateSoundToggleUI() {
    const isMuted = !settings.soundEnabled;
    $("#soundIcon").textContent = isMuted ? "🔇" : "🔊";
    $("#soundText").textContent = isMuted ? "Muted" : "Sound ON";
    const chk = $("#soundToggleCheckbox");
    if (chk) chk.checked = settings.soundEnabled;
}

/* ==========================================================================
   Quotes & Study Tips Data
   ========================================================================== */

const STUDY_QUOTES = [
    { text: "Learning is the only thing the mind never exhausts, never fears, and never regrets.", author: "Leonardo da Vinci" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.", author: "Albert Einstein" },
    { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" }
];

const STUDY_TIPS = [
    { title: "The Feynman Technique", body: "Explain what you just learned out loud in simple, jargon-free words as if teaching a 10-year-old. Wherever you hesitate, reopen your notes." },
    { title: "Spaced Repetition Spacing", body: "Review cards at increasing intervals (Day 1, Day 3, Day 7, Day 14). This moves facts from short-term to permanent memory." },
    { title: "Active Recall Over Re-reading", body: "Close your textbook and try to write down everything you remember on a blank page. Passive re-reading creates an illusion of competence." },
    { title: "Interleaving Strategy", body: "Switch between related topics during a long session (e.g. 30m Calculus, 30m Physics) rather than 3 straight hours on one concept." }
];

let tipIndex = 0;
function displayNextTip() {
    tipIndex = (tipIndex + 1) % STUDY_TIPS.length;
    const tip = STUDY_TIPS[tipIndex];
    $("#dynamicTipText").innerHTML = `<strong>${tip.title}:</strong> ${tip.body}`;
}

function setDynamicGreeting() {
    const hour = new Date().getHours();
    let greeting = "Welcome back, Scholar!";
    if (hour < 12) greeting = "Good morning, Scholar! ☀️";
    else if (hour < 18) greeting = "Good afternoon, Scholar! 🚀";
    else greeting = "Evening focus session! Let's conquer it. 🌙";
    $("#welcomeGreeting").textContent = greeting;
}

function refreshDailyQuote() {
    playSound("click");
    const quote = STUDY_QUOTES[Math.floor(Math.random() * STUDY_QUOTES.length)];
    $("#dailyQuote").textContent = quote.text;
    $("#quoteAuthor").textContent = `— ${quote.author}`;
}

/* ==========================================================================
   Tool 1: Smart Notes Summarizer (Offline NLP + Optional Gemini AI)
   ========================================================================== */

const SAMPLE_NOTES = {
    biology: `Photosynthesis is the fundamental biochemical process by which photoautotrophic organisms, such as green plants, algae, and cyanobacteria, convert radiant light energy into chemical energy stored in glucose molecules.

The overarching chemical formula is: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2.

This mechanism occurs inside chloroplasts and consists of two tightly coupled stages:
1. The Light-Dependent Reactions: Located within the thylakoid membranes, chlorophyll pigments absorb photons, splitting water molecules (photolysis) to release oxygen as a byproduct while synthesizing ATP and NADPH.
2. The Light-Independent Reactions (Calvin-Benson Cycle): Occurring in the chloroplast stroma, the enzyme RuBisCO facilitates carbon fixation, binding inorganic CO2 into organic carbon compounds, eventually yielding glyceraldehyde-3-phosphate (G3P) and glucose.

Limiting factors include light intensity, carbon dioxide concentration, and ambient temperature. Cellular respiration in mitochondria subsequently breaks down this glucose to release cellular ATP for growth and metabolism.`,

    cs: `Artificial Neural Networks (ANNs) are computational models inspired by biological neural networks in the human brain. They form the foundational architecture for modern Deep Learning.

Key architectural components include:
- Input Layer: Receives raw feature vectors representing text, images, or numerical data.
- Hidden Layers: Intermediate layers performing affine transformations (dot products of weights and inputs plus biases), followed by non-linear activation functions such as ReLU, GELU, or Sigmoid to learn complex patterns.
- Output Layer: Delivers the model's final prediction, often using Softmax for classification probabilities.

The learning process operates via:
1. Forward Propagation: Input features travel forward through the layers to generate an output.
2. Loss Calculation: A loss function (e.g. Cross-Entropy Loss or Mean Squared Error) quantifies discrepancy between predictions and ground-truth labels.
3. Backpropagation: Calculates gradients of the loss with respect to all model weights using the chain rule of calculus.
4. Optimization: Gradient descent algorithms (like Adam or SGD) iteratively adjust weights to minimize total loss. Overfitting is mitigated using techniques such as dropout, weight decay, and data augmentation.`,

    history: `The French Revolution (1789-1799) was a pivotal period of radical social and political upheaval in France that fundamentally reshaped modern global history.

Primary causes included:
- Severe economic crisis caused by astronomical war debts from the Seven Years' War and American Revolutionary War.
- An unjust feudal tax system where the First Estate (Clergy) and Second Estate (Nobility) enjoyed exemptions, burdening the Third Estate (commoners and bourgeoisie).
- Food shortages and devastating harvest failures causing widespread starvation.
- The spread of Enlightenment philosophy promoting individual liberty, secularism, and democratic representation by thinkers like Voltaire, Rousseau, and Montesquieu.

Crucial milestones included:
- The Storming of the Bastille on July 14, 1789, symbolizing the collapse of absolute monarchy.
- The Declaration of the Rights of Man and of the Citizen proclaiming equality before the law.
- The Reign of Terror (1793-1794) led by Maximilien Robespierre and the Committee of Public Safety.
The revolution concluded with Napoleon Bonaparte's coup d'état in 1799, permanently spreading legal equality, meritocracy, and secular governance across Europe.`
};

function setupSummarizer() {
    const notesInput = $("#notesInput");

    // Real-time word and char counters
    notesInput.addEventListener("input", updateNotesCounters);

    // Sample buttons
    $$("[data-sample]").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.dataset.sample;
            if (SAMPLE_NOTES[key]) {
                notesInput.value = SAMPLE_NOTES[key];
                updateNotesCounters();
                showToast(`Loaded ${key.toUpperCase()} sample notes!`, "info");
                playSound("click");
            }
        });
    });

    // File upload handler
    $("#noteFileUpload").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            notesInput.value = event.target.result;
            updateNotesCounters();
            showToast(`Loaded "${file.name}" successfully!`, "success");
        };
        reader.readAsText(file);
    });

    $("#clearNoteBtn").addEventListener("click", () => {
        notesInput.value = "";
        updateNotesCounters();
        $("#summaryResultContent").classList.add("hidden");
        $("#summaryPlaceholder").classList.remove("hidden");
        $("#resultActions").style.display = "none";
        $("#summaryBridges").classList.add("hidden");
    });

    // Summarize button
    $("#summarizeBtn").addEventListener("click", handleGenerateSummary);

    // Copy & Export
    $("#copySummaryBtn").addEventListener("click", copySummaryToClipboard);
    $("#exportSummaryBtn").addEventListener("click", exportSummaryAsFile);

    // Bridge buttons to Quiz and Flashcards
    $("#bridgeToQuizBtn").addEventListener("click", () => {
        if (!activeNotesText) return;
        showPage("quiz");
        $("#quizTopic").value = extractProbableTopic(activeNotesText);
        showToast("Loaded notes into Quiz Generator!", "info");
    });

    $("#bridgeToCardsBtn").addEventListener("click", () => {
        generateCardsFromActiveNotes();
    });
}

function updateNotesCounters() {
    const text = $("#notesInput").value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const minutes = Math.max(1, Math.ceil(words / 200));

    $("#wordCount").textContent = `${words} words`;
    $("#charCount").textContent = `${chars} chars`;
    $("#readTime").textContent = words ? `~${minutes} min read` : "0 min read";
}

async function handleGenerateSummary() {
    const text = $("#notesInput").value.trim();
    if (!text || text.length < 20) {
        showToast("Please paste or write at least a few sentences of study notes.", "info");
        return;
    }

    activeNotesText = text;
    playSound("click");

    const spinner = $("#summarizeSpinner");
    const summarizeBtn = $("#summarizeBtn");
    spinner.classList.remove("hidden");
    summarizeBtn.disabled = true;

    const mode = $("#summaryModeSelect").value;
    const length = $("#summaryLengthSelect").value;

    $("#resultModeTag").textContent = $("#summaryModeSelect").options[$("#summaryModeSelect").selectedIndex].text;

    try {
        let resultData = null;

        if (settings.aiEngine === "gemini" && settings.geminiApiKey) {
            // Live Gemini API call
            resultData = await callGeminiSummarize(text, mode, length);
        } else {
            // Smart built-in NLP processing
            await new Promise(r => setTimeout(r, 400)); // Smooth UX transition
            resultData = processOfflineSummary(text, mode, length);
        }

        renderSummaryResult(resultData, mode);
        playSound("success");
        showToast("Summary generated successfully! ✦", "success");
    } catch (err) {
        console.error("Summarization error:", err);
        showToast("Error generating summary. Falling back to built-in engine.", "info");
        const fallback = processOfflineSummary(text, mode, length);
        renderSummaryResult(fallback, mode);
    } finally {
        spinner.classList.add("hidden");
        summarizeBtn.disabled = false;
    }
}

// Sophisticated Offline NLP Text Analyzer
function processOfflineSummary(text, mode, lengthSetting) {
    const cleanText = text.replace(/\r\n/g, "\n");
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    // Sentence extraction
    const rawSentences = text
        .replace(/([.?!])\s*(?=[A-Z0-9])/g, "$1|")
        .split("|")
        .map(s => s.trim())
        .filter(s => s.length > 15);

    // Compute TF-IDF-like keyword scores
    const wordFreq = {};
    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "have", "were", "which", "there", "their", "about", "into", "been", "also", "some", "more", "when", "what", "where", "them", "these", "other"]);

    const tokens = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    tokens.forEach(w => {
        if (!stopWords.has(w)) {
            wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
    });

    // Score sentences
    const scoredSentences = rawSentences.map((sentence, idx) => {
        let score = 0;
        const words = sentence.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        words.forEach(w => {
            if (wordFreq[w]) score += wordFreq[w];
        });

        // Boost definitions and structural indicators
        if (/is\s+(a|an|the|defined as|known as)/i.test(sentence)) score += 8;
        if (/consists of|includes|composed of|operates via|causes/i.test(sentence)) score += 6;
        if (/key|crucial|primary|essential|important|fundamental/i.test(sentence)) score += 5;
        if (idx === 0) score += 10; // First sentence high priority

        return { sentence, score, idx };
    });

    // Determine sentence count based on length
    let ratio = 0.35;
    if (lengthSetting === "brief") ratio = 0.2;
    if (lengthSetting === "detailed") ratio = 0.55;

    const count = Math.max(2, Math.ceil(rawSentences.length * ratio));
    const topSentences = [...scoredSentences]
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .sort((a, b) => a.idx - b.idx)
        .map(s => s.sentence);

    activeSummaryPoints = topSentences;

    // Extract Definitions
    const glossary = [];
    rawSentences.forEach(s => {
        const defMatch = s.match(/^([A-Z][A-Za-z0-9\s-]{2,28})\s*(:|-|is defined as|is a|are)\s*(.+)$/i);
        if (defMatch) {
            glossary.push({ term: defMatch[1].trim(), definition: defMatch[3].trim() });
        }
    });

    return {
        executive: topSentences.slice(0, 2).join(" "),
        takeaways: topSentences,
        glossary: glossary.slice(0, 5),
        mode
    };
}

// Live Gemini API caller for Summarizer
async function callGeminiSummarize(text, mode, length) {
    const prompt = `You are StudyMate AI, an expert academic tutor.
Analyze the following study notes and generate a clean JSON output.
Style requested: ${mode}
Detail level: ${length}

Notes content:
"""${text.slice(0, 8000)}"""

Respond strictly with valid JSON conforming to this schema:
{
  "executive": "Concise 1-2 sentence executive summary",
  "takeaways": ["Array of 4-7 key bullet points"],
  "glossary": [{"term": "Key Term", "definition": "Clear concise definition"}]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        })
    });

    if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(jsonText);
    activeSummaryPoints = parsed.takeaways || [];
    return { ...parsed, mode };
}

function renderSummaryResult(data, mode) {
    const container = $("#summaryResultContent");
    const placeholder = $("#summaryPlaceholder");
    const actions = $("#resultActions");
    const bridges = $("#summaryBridges");

    let html = "";

    // 1. Executive Summary box
    if (data.executive) {
        html += `
        <div class="result-section-block">
            <h4><span>⚡</span> Executive Overview</h4>
            <div class="summary-executive-box">
                ${escapeHTML(data.executive)}
            </div>
        </div>`;
    }

    // 2. Mode-specific rendering
    if (mode === "feynman") {
        html += `
        <div class="result-section-block">
            <h4><span>💡</span> The Feynman Breakdown (Simple Intuition)</h4>
            <ul class="key-points-list">
                ${(data.takeaways || []).map(point => `
                    <li>
                        <span class="bullet-icon">✦</span>
                        <span>${escapeHTML(point)}</span>
                    </li>
                `).join("")}
            </ul>
        </div>`;
    } else {
        html += `
        <div class="result-section-block">
            <h4><span>🎯</span> Core High-Yield Takeaways</h4>
            <ul class="key-points-list">
                ${(data.takeaways || []).map(point => `
                    <li>
                        <span class="bullet-icon">✓</span>
                        <span>${escapeHTML(point)}</span>
                    </li>
                `).join("")}
            </ul>
        </div>`;
    }

    // 3. Glossary terms
    if (data.glossary && data.glossary.length > 0) {
        html += `
        <div class="result-section-block">
            <h4><span>📖</span> Key Definitions & Vocabulary</h4>
            <div class="glossary-grid">
                ${data.glossary.map(item => `
                    <div class="glossary-card">
                        <span class="glossary-term">${escapeHTML(item.term)}:</span>
                        <span class="glossary-def">${escapeHTML(item.definition)}</span>
                    </div>
                `).join("")}
            </div>
        </div>`;
    }

    container.innerHTML = html;
    container.classList.remove("hidden");
    placeholder.classList.add("hidden");
    actions.style.display = "flex";
    bridges.classList.remove("hidden");
}

function copySummaryToClipboard() {
    const textToCopy = activeSummaryPoints.join("\n- ");
    if (!textToCopy) return;
    navigator.clipboard.writeText("StudyMate AI Summary:\n\n- " + textToCopy).then(() => {
        showToast("Summary copied to clipboard! 📋", "success");
        playSound("click");
    });
}

function exportSummaryAsFile() {
    if (!activeSummaryPoints.length) return;
    const blob = new Blob([`# StudyMate AI - Study Summary\n\nGenerated: ${new Date().toLocaleString()}\n\n## Key Takeaways:\n- ${activeSummaryPoints.join("\n- ")}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `StudyMate_Summary_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Summary file exported! 💾", "success");
}

function extractProbableTopic(text) {
    const firstLine = text.split("\n")[0].trim().replace(/^[#*-]\s*/, "");
    return firstLine.slice(0, 40) || "Biology Concepts";
}

/* ==========================================================================
   Tool 2: Interactive Quiz Generator
   ========================================================================== */

const BUILT_IN_QUIZZES = {
    "biology": [
        {
            question: "Where do the light-dependent reactions of photosynthesis take place?",
            options: ["Chloroplast stroma", "Thylakoid membranes", "Outer mitochondrial matrix", "Cell cytoplasm"],
            answer: 1,
            explanation: "The light-dependent reactions occur in the thylakoid membranes where chlorophyll absorbs light energy to create ATP and NADPH."
        },
        {
            question: "Which enzyme is primarily responsible for carbon fixation in the Calvin cycle?",
            options: ["ATP Synthase", "DNA Polymerase", "RuBisCO", "Amylase"],
            answer: 2,
            explanation: "RuBisCO (Ribulose-1,5-bisphosphate carboxylase-oxygenase) catalyzes the critical first step of carbon fixation."
        },
        {
            question: "What is the primary source of electrons and oxygen byproduct in photosynthesis?",
            options: ["Carbon dioxide photolysis", "Water photolysis", "Glucose oxidation", "NADPH breakdown"],
            answer: 1,
            explanation: "Water (H2O) molecules are split in photolysis at photosystem II, releasing O2 gas and providing electrons for the electron transport chain."
        },
        {
            question: "Which of the following is considered the energy currency of the cell?",
            options: ["Glucose", "ATP (Adenosine Triphosphate)", "Pyruvate", "RuBP"],
            answer: 1,
            explanation: "ATP stores and transports chemical energy within cells for metabolism and cellular processes."
        },
        {
            question: "What happens to the Calvin cycle if carbon dioxide concentration drops to zero?",
            options: ["Rate of sugar synthesis increases", "Calvin cycle stops completely", "Light reactions immediately halt", "Plant converts to anaerobic respiration"],
            answer: 1,
            explanation: "Without CO2, RuBisCO cannot fix carbon, halting the synthesis of G3P and sugars in the Calvin cycle."
        }
    ],
    "cs": [
        {
            question: "What is the primary purpose of an activation function in a neural network?",
            options: ["To initialize weights to zero", "To introduce non-linearity", "To compute gradients", "To normalize the input data"],
            answer: 1,
            explanation: "Without non-linear activation functions (like ReLU or GELU), deep neural networks would collapse into simple linear regression models regardless of layer depth."
        },
        {
            question: "Which algorithm computes the gradient of the loss function with respect to weights using the chain rule?",
            options: ["Forward propagation", "Backpropagation", "K-Means clustering", "Dijkstra's Algorithm"],
            answer: 1,
            explanation: "Backpropagation efficiently computes gradient vectors layer-by-layer backwards from output to input using the calculus chain rule."
        },
        {
            question: "What is the typical time complexity of searching an element in a balanced Binary Search Tree (BST)?",
            options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
            answer: 1,
            explanation: "In a balanced BST, each comparison eliminates half the remaining subtree, yielding O(log n) search time."
        },
        {
            question: "What technique prevents overfitting in deep neural networks by randomly deactivating neurons during training?",
            options: ["Dropout", "Batch normalization", "Gradient clipping", "Softmax"],
            answer: 0,
            explanation: "Dropout randomly sets a fraction of neuron outputs to zero during each forward pass, preventing co-adaptation of features."
        },
        {
            question: "In the JavaScript event loop, which queue has higher execution priority after the current call stack completes?",
            options: ["Macro-task queue (setTimeout)", "Micro-task queue (Promises)", "Rendering engine queue", "Garbage collection queue"],
            answer: 1,
            explanation: "Micro-tasks (such as Promise callbacks and queueMicrotask) are always drained completely before the next macro-task from setTimeout or setInterval executes."
        }
    ],
    "history": [
        {
            question: "Which event on July 14, 1789, is traditionally celebrated as the start of the French Revolution?",
            options: ["Execution of Louis XVI", "The Storming of the Bastille", "Tennis Court Oath", "Reign of Terror begins"],
            answer: 1,
            explanation: "The storming of the medieval armory and fortress of the Bastille symbolized the popular revolt against royal tyranny."
        },
        {
            question: "Which group comprised the Third Estate in pre-revolutionary France?",
            options: ["Catholic Clergy", "Hereditary Nobility", "Commoners, peasants, and the bourgeoisie", "The Royal Family"],
            answer: 2,
            explanation: "The Third Estate represented approximately 98% of the French population, including peasants, merchants, and artisans, yet held the least political power."
        },
        {
            question: "Who was the dominant political figure during the Reign of Terror (1793-1794)?",
            options: ["Napoleon Bonaparte", "Maximilien Robespierre", "Voltaire", "King Louis XVI"],
            answer: 1,
            explanation: "Maximilien Robespierre headed the Committee of Public Safety, orchestrating mass executions of perceived enemies of the revolution."
        },
        {
            question: "What document proclaimed equality of all men before the law in August 1789?",
            options: ["Magna Carta", "Declaration of the Rights of Man and of the Citizen", "Treaty of Versailles", "Code Napoleon"],
            answer: 1,
            explanation: "Adopted by the National Constituent Assembly, the Declaration of the Rights of Man became the foundation of French republican values."
        },
        {
            question: "Which military commander came to power in the coup of 18 Brumaire (1799), marking the end of the revolutionary period?",
            options: ["Duke of Wellington", "Napoleon Bonaparte", "Marquis de Lafayette", "Jean-Paul Marat"],
            answer: 1,
            explanation: "General Napoleon Bonaparte seized power, establishing the Consulate and subsequently crowning himself Emperor."
        }
    ]
};

function setupQuizGenerator() {
    // Topic chips
    $$(".topic-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            $("#quizTopic").value = chip.dataset.topic;
            playSound("click");
        });
    });

    $("#useActiveNotesForQuizBtn").addEventListener("click", () => {
        if (!activeNotesText) {
            showToast("Paste notes into the Summarizer first to use them here!", "info");
            return;
        }
        $("#quizTopic").value = extractProbableTopic(activeNotesText);
        showToast("Active study topic applied!", "success");
    });

    // Start quiz
    $("#startQuizBtn").addEventListener("click", handleStartQuiz);

    // Active Quiz Arena Controls
    $("#nextQuestionBtn").addEventListener("click", advanceQuizQuestion);
    $("#quitQuizBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to quit this quiz session?")) {
            exitQuizArena();
        }
    });

    // Score review actions
    $("#retakeQuizBtn").addEventListener("click", () => {
        if (currentQuizState) {
            startQuizSession(currentQuizState.topic, currentQuizState.questions);
        }
    });

    $("#newQuizBtn").addEventListener("click", exitQuizArena);

    $("#createFlashcardsFromMissedBtn").addEventListener("click", () => {
        createFlashcardsFromQuizQuestions();
    });
}

function handleStartQuiz() {
    const topic = $("#quizTopic").value.trim();
    if (!topic) {
        showToast("Please enter a topic or select one of the suggestions.", "info");
        return;
    }

    const count = parseInt($("#quizCount").value, 10) || 5;
    const questions = generateQuizQuestions(topic, count);

    startQuizSession(topic, questions);
}

function generateQuizQuestions(topic, count) {
    const lowerTopic = topic.toLowerCase();
    let basePool = [];

    if (lowerTopic.includes("bio") || lowerTopic.includes("cell") || lowerTopic.includes("photo")) {
        basePool = BUILT_IN_QUIZZES.biology;
    } else if (lowerTopic.includes("computer") || lowerTopic.includes("code") || lowerTopic.includes("data") || lowerTopic.includes("tech") || lowerTopic.includes("neural")) {
        basePool = BUILT_IN_QUIZZES.cs;
    } else if (lowerTopic.includes("history") || lowerTopic.includes("french") || lowerTopic.includes("revolution") || lowerTopic.includes("war")) {
        basePool = BUILT_IN_QUIZZES.history;
    } else {
        // Dynamic contextual question generator for any custom topic!
        basePool = generateContextualQuestions(topic);
    }

    // Shuffle and pick desired count
    const shuffled = [...basePool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

function generateContextualQuestions(topic) {
    return [
        {
            question: `What is the primary foundation or core objective of ${topic}?`,
            options: [
                `To understand its core principles and real-world mechanisms`,
                `To memorize facts without practical comprehension`,
                `To avoid applying theoretical methodologies`,
                `To ignore experimental evidence and data`
            ],
            answer: 0,
            explanation: `Mastering ${topic} requires active comprehension of its underlying mechanisms and conceptual frameworks.`
        },
        {
            question: `Which study method yields the strongest active recall retention for ${topic}?`,
            options: [
                `Passive re-reading before an exam`,
                `Self-testing, spaced review, and the Feynman technique`,
                `Highlighting full pages without taking notes`,
                `Cramming the entire syllabus in one overnight session`
            ],
            answer: 1,
            explanation: `Spaced repetition and self-quizzing force neural retrieval pathways to strengthen, providing the highest long-term retention for ${topic}.`
        },
        {
            question: `How can you best verify that you truly understand an advanced concept in ${topic}?`,
            options: [
                `Assuming familiarity because you recognize the vocabulary`,
                `Explaining the concept simply in your own words to someone else`,
                `Skipping the difficult problem sets`,
                `Looking at solutions before attempting the questions`
            ],
            answer: 1,
            explanation: `Teaching a concept simply exposes subtle gaps in your knowledge that passive recognition masks.`
        },
        {
            question: `When analyzing a complex challenge in ${topic}, what is the optimal first step?`,
            options: [
                `Jump immediately into calculations without reading the full question`,
                `Decompose the problem into first principles and known components`,
                `Guess the outcome based on intuition alone`,
                `Ignore edge cases and boundary conditions`
            ],
            answer: 1,
            explanation: `Decomposition breaks intricate problems in ${topic} into manageable, solvable sub-units.`
        },
        {
            question: `Why is cross-discipline synthesis valuable when studying ${topic}?`,
            options: [
                `It reveals analogous patterns and enhances creative problem-solving`,
                `It unnecessarily complicates straightforward principles`,
                `It makes revisions take significantly longer without benefit`,
                `It has zero connection to academic performance`
            ],
            answer: 0,
            explanation: `Connecting ${topic} to broader fields encourages divergent thinking and deeper cognitive models.`
        }
    ];
}

function startQuizSession(topic, questions) {
    currentQuizState = {
        topic,
        questions,
        currentIndex: 0,
        score: 0,
        userAnswers: [],
        timerSeconds: 30,
        timerInterval: null
    };

    $("#quizSetupPanel").classList.add("hidden");
    $("#quizScoreCard").classList.add("hidden");
    $("#quizArena").classList.remove("hidden");
    $("#arenaTopicBadge").textContent = topic;
    $("#totalQuestionsNum").textContent = questions.length;

    renderActiveQuestion();
}

function renderActiveQuestion() {
    const q = currentQuizState.questions[currentQuizState.currentIndex];
    const total = currentQuizState.questions.length;
    const currentNum = currentQuizState.currentIndex + 1;

    $("#currentQuestionNum").textContent = currentNum;
    $("#questionText").textContent = q.question;
    $("#quizTrackFill").style.width = `${(currentNum / total) * 100}%`;

    const optionsBox = $("#optionsContainer");
    optionsBox.innerHTML = "";

    const letters = ["A", "B", "C", "D"];
    q.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerHTML = `
            <span class="option-letter">${letters[idx]}</span>
            <span class="option-text">${escapeHTML(opt)}</span>
        `;
        btn.addEventListener("click", () => handleSelectOption(idx, btn));
        optionsBox.appendChild(btn);
    });

    $("#explanationBox").classList.add("hidden");
    $("#nextQuestionBtn").classList.add("hidden");

    // Reset question timer
    startQuestionTimer();
}

function startQuestionTimer() {
    clearInterval(currentQuizState.timerInterval);
    currentQuizState.timerSeconds = 30;
    $("#questionTimer").textContent = `00:${currentQuizState.timerSeconds.toString().padStart(2, "0")}`;

    currentQuizState.timerInterval = setInterval(() => {
        currentQuizState.timerSeconds--;
        $("#questionTimer").textContent = `00:${currentQuizState.timerSeconds.toString().padStart(2, "0")}`;

        if (currentQuizState.timerSeconds <= 0) {
            clearInterval(currentQuizState.timerInterval);
            // Auto timeout option select
            autoHandleTimeout();
        }
    }, 1000);
}

function handleSelectOption(selectedIndex, selectedBtn) {
    clearInterval(currentQuizState.timerInterval);

    const q = currentQuizState.questions[currentQuizState.currentIndex];
    const isCorrect = selectedIndex === q.answer;

    // Disable all options
    const allOptionBtns = $$(".option-btn");
    allOptionBtns.forEach(btn => btn.disabled = true);

    selectedBtn.classList.add(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
        currentQuizState.score++;
        playSound("success");
    } else {
        playSound("wrong");
        // Highlight correct option
        allOptionBtns[q.answer]?.classList.add("correct");
    }

    currentQuizState.userAnswers.push({
        question: q.question,
        selectedOption: q.options[selectedIndex],
        correctOption: q.options[q.answer],
        isCorrect,
        explanation: q.explanation
    });

    // Reveal explanation
    const expBox = $("#explanationBox");
    $("#explanationTitle").textContent = isCorrect ? "✓ Correct Answer!" : "✕ Incorrect";
    $("#explanationTitle").style.color = isCorrect ? "var(--accent-green)" : "#ef4444";
    $("#explanationText").textContent = q.explanation;
    expBox.classList.remove("hidden");

    $("#nextQuestionBtn").classList.remove("hidden");
    $("#nextQuestionBtn").textContent = (currentQuizState.currentIndex + 1 === currentQuizState.questions.length) ? "View Quiz Results →" : "Next Question →";
}

function autoHandleTimeout() {
    const q = currentQuizState.questions[currentQuizState.currentIndex];
    $$(".option-btn").forEach(btn => btn.disabled = true);
    $$(".option-btn")[q.answer]?.classList.add("correct");

    playSound("wrong");
    currentQuizState.userAnswers.push({
        question: q.question,
        selectedOption: "Time Expired",
        correctOption: q.options[q.answer],
        isCorrect: false,
        explanation: q.explanation
    });

    const expBox = $("#explanationBox");
    $("#explanationTitle").textContent = "⏱ Time Expired!";
    $("#explanationTitle").style.color = "#ef4444";
    $("#explanationText").textContent = q.explanation;
    expBox.classList.remove("hidden");

    $("#nextQuestionBtn").classList.remove("hidden");
    $("#nextQuestionBtn").textContent = (currentQuizState.currentIndex + 1 === currentQuizState.questions.length) ? "View Quiz Results →" : "Next Question →";
}

function advanceQuizQuestion() {
    playSound("click");
    currentQuizState.currentIndex++;

    if (currentQuizState.currentIndex < currentQuizState.questions.length) {
        renderActiveQuestion();
    } else {
        finishQuizSession();
    }
}

function finishQuizSession() {
    clearInterval(currentQuizState.timerInterval);
    $("#quizArena").classList.add("hidden");
    $("#quizScoreCard").classList.remove("hidden");

    const total = currentQuizState.questions.length;
    const score = currentQuizState.score;
    const percent = Math.round((score / total) * 100);

    // Update stats
    stats.quizzesCompleted = (stats.quizzesCompleted || 0) + 1;
    saveToStorage(STORAGE_KEYS.STATS, stats);
    updateDashboardMetrics();

    $("#scoreFraction").textContent = `${score} / ${total}`;
    $("#scorePercentage").textContent = `${percent}% Mastery`;

    let grade = "C";
    let icon = "🌱";
    if (percent === 100) { grade = "A+ (Perfection!)"; icon = "👑"; }
    else if (percent >= 80) { grade = "A (Mastery)"; icon = "🏆"; }
    else if (percent >= 60) { grade = "B (Good Effort)"; icon = "⚡"; }

    $("#scoreGrade").textContent = `Grade: ${grade}`;
    $("#scoreIcon").textContent = icon;

    if (percent >= 70) {
        launchConfetti();
        playSound("bell");
    }

    // Render review items
    const reviewList = $("#quizReviewList");
    reviewList.innerHTML = currentQuizState.userAnswers.map((item, idx) => `
        <div class="review-item ${item.isCorrect ? "review-correct" : "review-wrong"}">
            <div class="review-question-text">${idx + 1}. ${escapeHTML(item.question)}</div>
            <div class="review-answers-meta">
                <div><strong>Your Answer:</strong> ${escapeHTML(item.selectedOption)} ${item.isCorrect ? "✓" : "✕"}</div>
                ${!item.isCorrect ? `<div><strong>Correct Answer:</strong> ${escapeHTML(item.correctOption)}</div>` : ""}
                <div style="margin-top:6px; color:var(--text-main); font-style:italic;">${escapeHTML(item.explanation)}</div>
            </div>
        </div>
    `).join("");
}

function exitQuizArena() {
    clearInterval(currentQuizState?.timerInterval);
    $("#quizArena").classList.add("hidden");
    $("#quizScoreCard").classList.add("hidden");
    $("#quizSetupPanel").classList.remove("hidden");
}

function createFlashcardsFromQuizQuestions() {
    if (!currentQuizState || !currentQuizState.userAnswers.length) return;
    let addedCount = 0;

    currentQuizState.userAnswers.forEach(ans => {
        customCards.push({
            id: Date.now() + Math.random(),
            deck: "custom",
            front: ans.question,
            back: `${ans.correctOption} — ${ans.explanation}`
        });
        addedCount++;
    });

    saveToStorage(STORAGE_KEYS.CUSTOM_CARDS, customCards);
    updateCustomDeckBadge();
    showToast(`Created ${addedCount} flashcards from this quiz! 🗂`, "success");
    showPage("flashcards");
    selectDeck("custom");
}

/* ==========================================================================
   Tool 3: Flashcards Hub (3D Flip & Spaced Repetition)
   ========================================================================== */

const BUILT_IN_DECKS = {
    "cs": [
        { id: "cs1", front: "Document Object Model (DOM)", back: "An object-oriented representation of the web page which allows scripting languages (like JavaScript) to dynamically manipulate the HTML document structure, style, and content." },
        { id: "cs2", front: "Closure in JavaScript", back: "A function bundled together with references to its surrounding lexical environment. A closure gives an inner function access to an outer function's scope even after the outer function has returned." },
        { id: "cs3", front: "REST API vs GraphQL", back: "REST uses fixed standard HTTP endpoints that return pre-defined data models. GraphQL allows clients to request exactly the data fields they require via a single flexible query endpoint." },
        { id: "cs4", front: "CSS Box Model", back: "A fundamental layout model wrapping every HTML element, composed from inside out: Content, Padding, Border, and Margin." },
        { id: "cs5", front: "Time Complexity of Binary Search", back: "O(log n). It repeatedly divides the search interval of a sorted collection in half." },
        { id: "cs6", front: "Event Bubbling vs Capturing", back: "Bubbling propagations go upward from the target element up the DOM tree to the root. Capturing goes downward from the root window down to the target." },
        { id: "cs7", front: "Difference between == and ===", back: "`==` performs type coercion before comparison. `===` is strict equality: checks both value and type without converting types." },
        { id: "cs8", front: "Idempotency in HTTP Methods", back: "An HTTP method is idempotent if making identical requests multiple times produces the same server state as a single request (e.g. GET, PUT, DELETE are idempotent; POST is not)." },
        { id: "cs9", front: "Debouncing vs Throttling", back: "Debounce delays function execution until after a specified delay has passed since the last event. Throttle limits execution to at most once per defined time window." },
        { id: "cs10", front: "localStorage vs sessionStorage", back: "localStorage data persists indefinitely until cleared explicitly. sessionStorage data is automatically cleared when the browser tab or session closes." }
    ],
    "biology": [
        { id: "bio1", front: "Mitochondria", back: "Known as the powerhouse of the cell, it generates most of the chemical energy needed to power the cell's biochemical reactions in the form of ATP." },
        { id: "bio2", front: "Chlorophyll", back: "The primary green photosynthetic pigment found in chloroplasts that absorbs sunlight (primarily blue and red wavelengths) for photosynthesis." },
        { id: "bio3", front: "Osmosis", back: "The net movement of water molecules across a semi-permeable membrane from an area of higher water potential (lower solute concentration) to lower water potential." },
        { id: "bio4", front: "Active Transport", back: "The movement of ions or molecules across a cellular membrane into a region of higher concentration, assisted by enzymes and requiring energy (ATP)." },
        { id: "bio5", front: "Mitosis vs Meiosis", back: "Mitosis produces two genetically identical diploid somatic cells. Meiosis produces four genetically diverse haploid gametes (sperm or egg cells)." },
        { id: "bio6", front: "Enzyme Substrate Specificity", back: "The Lock and Key / Induced Fit model: each enzyme has a unique active site shape specifically tailored to bind only its corresponding substrate." },
        { id: "bio7", front: "Homeostasis", back: "The state of steady internal, physical, and chemical conditions maintained by living systems despite external environmental fluctuations." },
        { id: "bio8", front: "Ribosomes", back: "Cellular molecular machines responsible for synthesizing proteins by translating messenger RNA (mRNA) sequences." }
    ],
    "history": [
        { id: "history1", front: "The Industrial Revolution", back: "The transition to new manufacturing processes in Great Britain, continental Europe, and the United States from roughly 1760 to 1840, powered by steam engines and iron production." },
        { id: "history2", front: "The Enlightenment", back: "An intellectual and philosophical movement in 17th-18th century Europe emphasizing reason, individualism, scientific inquiry, and secular democracy over tradition." },
        { id: "history3", front: "The Silk Road", back: "An ancient network of trade routes connecting East Asia with the Mediterranean and Europe, transmitting silk, spices, technologies, and ideas for centuries." },
        { id: "history4", front: "Treaty of Versailles (1919)", back: "The peace document signed at the end of World War I between the Allied powers and Germany, which imposed severe reparations and territorial concessions on Germany." },
        { id: "history5", front: "The Renaissance", back: "A cultural movement from the 14th to 17th centuries marking the transition from the Middle Ages to modernity, characterized by renewed revival of classical antiquity art and humanist learning." },
        { id: "history6", front: "Magna Carta (1215)", back: "A royal charter of rights agreed to by King John of England establishing for the first time the principle that everyone, including the monarch, is subject to the rule of law." },
        { id: "history7", front: "The Marshall Plan", back: "A U.S. initiative enacted in 1948 providing over $13 billion in economic aid to rebuild Western European economies after the devastation of World War II." },
        { id: "history8", front: "Fall of Constantinople (1453)", back: "The capture of the Byzantine Empire's capital by the Ottoman Empire under Sultan Mehmed II, ending the Roman Empire's final remnant and spurring the European Age of Discovery." }
    ]
};

function setupFlashcards() {
    // Deck selection pills
    $$(".deck-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            selectDeck(pill.dataset.deck);
        });
    });

    // Flip card trigger
    const cardEl = $("#flashcardElement");
    cardEl.addEventListener("click", toggleCardFlip);
    $("#flipCardBtn").addEventListener("click", toggleCardFlip);

    // Prev / Next card
    $("#prevCardBtn").addEventListener("click", () => changeFlashcard(-1));
    $("#nextCardBtn").addEventListener("click", () => changeFlashcard(1));

    // Mastered / Review triggers
    $("#cardMasteredBtn").addEventListener("click", () => markCardStatus(true));
    $("#cardNeedsReviewBtn").addEventListener("click", () => markCardStatus(false));

    // Keyboard support for flashcards
    document.addEventListener("keydown", (e) => {
        if (!$("#flashcards").classList.contains("active-page")) return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        if (e.code === "Space") {
            e.preventDefault();
            toggleCardFlip();
        } else if (e.code === "ArrowLeft") {
            markCardStatus(false);
        } else if (e.code === "ArrowRight") {
            markCardStatus(true);
        }
    });

    // Create New Card modal triggers
    $("#openNewCardModalBtn").addEventListener("click", () => {
        $("#cardModal").classList.remove("hidden");
    });
    $("#closeCardModalBtn").addEventListener("click", () => {
        $("#cardModal").classList.add("hidden");
    });
    $("#cancelCardModalBtn").addEventListener("click", () => {
        $("#cardModal").classList.add("hidden");
    });

    $("#newCardForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const deck = $("#newCardDeck").value;
        const front = $("#newCardFront").value.trim();
        const back = $("#newCardBack").value.trim();
        if (!front || !back) return;

        customCards.push({
            id: Date.now(),
            deck,
            front,
            back
        });

        saveToStorage(STORAGE_KEYS.CUSTOM_CARDS, customCards);
        updateCustomDeckBadge();
        $("#newCardForm").reset();
        $("#cardModal").classList.add("hidden");
        showToast("Flashcard added successfully! 🗂", "success");
        playSound("success");

        if (currentDeckName === deck || (deck === "custom" && currentDeckName === "custom")) {
            selectDeck(currentDeckName);
        }
    });

    updateCustomDeckBadge();
    selectDeck("cs");
}

function selectDeck(deckKey) {
    playSound("click");
    currentDeckName = deckKey;
    currentCardIndex = 0;
    isCardFlipped = false;

    $$(".deck-pill").forEach(p => p.classList.toggle("active", p.dataset.deck === deckKey));
    renderActiveFlashcard();
}

function getActiveDeckCards() {
    if (currentDeckName === "custom") {
        return customCards.filter(c => c.deck === "custom" || !c.deck);
    }
    const builtIn = BUILT_IN_DECKS[currentDeckName] || [];
    const userAddedToThisDeck = customCards.filter(c => c.deck === currentDeckName);
    return [...builtIn, ...userAddedToThisDeck];
}

function renderActiveFlashcard() {
    const cards = getActiveDeckCards();
    const cardEl = $("#flashcardElement");
    cardEl.classList.remove("flipped");
    isCardFlipped = false;

    if (!cards.length) {
        $("#cardDeckTag").textContent = "EMPTY DECK";
        $("#cardIndexIndicator").textContent = "0 / 0";
        $("#cardIndexIndicatorBack").textContent = "0 / 0";
        $("#cardFrontText").textContent = "No flashcards in this deck yet!";
        $("#cardBackText").textContent = "Click '+ Create Flashcard' above to add your first card or generate cards from the Summarizer!";
        $("#deckMasteredCount").textContent = "0";
        $("#deckTotalCount").textContent = "0";
        $("#deckProgressFill").style.width = "0%";
        $("#deckMasteryPercent").textContent = "0%";
        return;
    }

    if (currentCardIndex >= cards.length) currentCardIndex = 0;
    if (currentCardIndex < 0) currentCardIndex = cards.length - 1;

    const card = cards[currentCardIndex];
    const total = cards.length;
    const currentNum = currentCardIndex + 1;

    const deckTitles = { cs: "Web & Tech", biology: "Cell Biology", history: "World History", custom: "Custom Deck" };
    $("#cardDeckTag").textContent = deckTitles[currentDeckName] || "Study Deck";
    $("#cardIndexIndicator").textContent = `${currentNum} / ${total}`;
    $("#cardIndexIndicatorBack").textContent = `${currentNum} / ${total}`;

    $("#cardFrontText").textContent = card.front;
    $("#cardBackText").textContent = card.back;

    // Calculate deck mastery
    let masteredCount = 0;
    cards.forEach(c => {
        if (cardMastery[c.id]) masteredCount++;
    });

    const percent = Math.round((masteredCount / total) * 100);
    $("#deckMasteredCount").textContent = masteredCount;
    $("#deckTotalCount").textContent = total;
    $("#deckMasteryPercent").textContent = `${percent}%`;
    $("#deckProgressFill").style.width = `${percent}%`;
}

function toggleCardFlip() {
    playSound("flip");
    isCardFlipped = !isCardFlipped;
    $("#flashcardElement").classList.toggle("flipped", isCardFlipped);
}

function changeFlashcard(direction) {
    playSound("click");
    const cards = getActiveDeckCards();
    if (!cards.length) return;
    currentCardIndex = (currentCardIndex + direction + cards.length) % cards.length;
    renderActiveFlashcard();
}

function markCardStatus(isMastered) {
    const cards = getActiveDeckCards();
    if (!cards.length) return;
    const card = cards[currentCardIndex];

    cardMastery[card.id] = isMastered;
    saveToStorage(STORAGE_KEYS.FLASHCARD_MASTERY, cardMastery);

    playSound(isMastered ? "success" : "click");
    showToast(isMastered ? "Marked as Mastered! 🌟" : "Keep practicing! 🔁", "info");

    changeFlashcard(1);
}

function updateCustomDeckBadge() {
    const count = customCards.filter(c => c.deck === "custom" || !c.deck).length;
    $("#customDeckCount").textContent = count;
}

function generateCardsFromActiveNotes() {
    if (!activeNotesText) {
        showToast("Please paste and summarize notes first!", "info");
        return;
    }

    const sentences = activeNotesText.split(/[.?!]\s+/).filter(s => s.length > 20);
    let count = 0;

    sentences.slice(0, 6).forEach(s => {
        const parts = s.split(/:\s*|—\s*|\s+is\s+|\s+are\s+/i);
        if (parts.length >= 2) {
            customCards.push({
                id: Date.now() + Math.random(),
                deck: "custom",
                front: parts[0].trim(),
                back: parts.slice(1).join(" is ").trim()
            });
            count++;
        }
    });

    if (count === 0 && activeSummaryPoints.length) {
        activeSummaryPoints.slice(0, 4).forEach((pt, i) => {
            customCards.push({
                id: Date.now() + Math.random(),
                deck: "custom",
                front: `Key Concept #${i + 1}`,
                back: pt
            });
            count++;
        });
    }

    saveToStorage(STORAGE_KEYS.CUSTOM_CARDS, customCards);
    updateCustomDeckBadge();
    showToast(`Generated ${count} flashcards from your notes! 🗂`, "success");
    showPage("flashcards");
    selectDeck("custom");
}

/* ==========================================================================
   Tool 4: Focus Pomodoro Timer
   ========================================================================== */

function setupPomodoro() {
    // Mode tabs
    $$(".timer-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            switchPomodoroMode(tab.dataset.mode, parseInt(tab.dataset.time, 10));
        });
    });

    // Control buttons
    $("#startTimerBtn").addEventListener("click", startPomodoroTimer);
    $("#pauseTimerBtn").addEventListener("click", pausePomodoroTimer);
    $("#resetTimerBtn").addEventListener("click", resetPomodoroTimer);
    $("#skipTimerBtn").addEventListener("click", skipPomodoroMode);

    // Ambient sound chips
    $$(".sound-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            $$(".sound-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            setAmbientSound(chip.dataset.sound);
        });
    });

    updatePomodoroDisplay();
}

function switchPomodoroMode(mode, durationSeconds) {
    pausePomodoroTimer();
    pomodoroMode = mode;
    pomodoroTotalDuration = durationSeconds;
    pomodoroSecondsLeft = durationSeconds;

    $$(".timer-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));

    const labels = {
        pomodoro: "FOCUS SESSION",
        shortBreak: "SHORT RECHARGE BREAK",
        longBreak: "LONG REST BREAK"
    };
    $("#currentTimerMode").textContent = labels[mode] || "FOCUS SESSION";
    updatePomodoroDisplay();
}

function startPomodoroTimer() {
    playSound("click");
    if (pomodoroTimerId) return;

    $("#startTimerBtn").style.display = "none";
    $("#pauseTimerBtn").style.display = "inline-flex";

    pomodoroTimerId = setInterval(() => {
        pomodoroSecondsLeft--;
        updatePomodoroDisplay();

        if (pomodoroSecondsLeft <= 0) {
            handlePomodoroCompleted();
        }
    }, 1000);
}

function pausePomodoroTimer() {
    if (!pomodoroTimerId) return;
    clearInterval(pomodoroTimerId);
    pomodoroTimerId = null;

    $("#startTimerBtn").style.display = "inline-flex";
    $("#pauseTimerBtn").style.display = "none";
}

function resetPomodoroTimer() {
    pausePomodoroTimer();
    pomodoroSecondsLeft = pomodoroTotalDuration;
    updatePomodoroDisplay();
    playSound("click");
}

function skipPomodoroMode() {
    pausePomodoroTimer();
    if (pomodoroMode === "pomodoro") {
        switchPomodoroMode("shortBreak", 300);
    } else {
        pomodoroCycle = (pomodoroCycle % 4) + 1;
        switchPomodoroMode("pomodoro", 1500);
    }
}

function handlePomodoroCompleted() {
    pausePomodoroTimer();
    playSound("bell");
    launchConfetti();

    if (pomodoroMode === "pomodoro") {
        stats.completedSessionsToday = (stats.completedSessionsToday || 0) + 1;
        stats.focusMinutesToday = (stats.focusMinutesToday || 0) + 25;
        saveToStorage(STORAGE_KEYS.STATS, stats);
        updateDashboardMetrics();

        showToast("Focus session complete! Time for a well-deserved break ☕", "success");

        if (pomodoroCycle >= 4) {
            pomodoroCycle = 1;
            switchPomodoroMode("longBreak", 900);
        } else {
            pomodoroCycle++;
            switchPomodoroMode("shortBreak", 300);
        }
    } else {
        showToast("Break over! Let's get locked back in 🚀", "info");
        switchPomodoroMode("pomodoro", 1500);
    }
}

function updatePomodoroDisplay() {
    const mins = Math.floor(pomodoroSecondsLeft / 60);
    const secs = pomodoroSecondsLeft % 60;
    const timeFormatted = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    $("#timerDisplay").textContent = timeFormatted;
    $("#timerCycleText").textContent = `Cycle ${pomodoroCycle} of 4`;

    // SVG Ring calculation: circumference is 2 * PI * 115 ~= 722.5
    const circumference = 2 * Math.PI * 115;
    const progressFraction = pomodoroSecondsLeft / pomodoroTotalDuration;
    const dashoffset = circumference * (1 - progressFraction);

    const ring = $("#timerProgressRing");
    if (ring) {
        ring.style.strokeDashoffset = dashoffset;
    }

    $("#completedSessionsCount").textContent = `${stats.completedSessionsToday || 0} Sessions`;
    $("#totalFocusMinutes").textContent = `${stats.focusMinutesToday || 0} Minutes`;
}

/* ==========================================================================
   Tool 5: Study Planner & Task Tracker
   ========================================================================== */

function setupPlanner() {
    $("#taskForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = $("#taskInput");
        const title = input.value.trim();
        if (!title) return;

        const newTask = {
            id: Date.now(),
            title,
            category: $("#taskCategory").value,
            priority: $("#taskPriority").value,
            dueDate: $("#taskDueDate").value || getFormattedDate(0),
            completed: false,
            createdAt: Date.now()
        };

        tasks.unshift(newTask);
        saveToStorage(STORAGE_KEYS.TASKS, tasks);

        input.value = "";
        renderTasks();
        showToast("Study task added! ☑", "success");
        playSound("click");
    });

    // Filter tabs
    $$(".filter-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            $$(".filter-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentTaskFilter = tab.dataset.filter;
            renderTasks();
        });
    });

    // Search tasks
    $("#taskSearchInput").addEventListener("input", renderTasks);

    // Initial render
    renderTasks();
}

function renderTasks() {
    const list = $("#taskList");
    const emptyState = $("#emptyTasks");
    const searchQuery = ($("#taskSearchInput").value || "").toLowerCase().trim();

    const filtered = tasks.filter(task => {
        if (currentTaskFilter === "pending" && task.completed) return false;
        if (currentTaskFilter === "completed" && !task.completed) return false;
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery)) return false;
        return true;
    });

    list.innerHTML = "";

    filtered.forEach(task => {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "done" : ""}`;

        li.innerHTML = `
            <div class="task-checkbox-wrap">
                <input type="checkbox" ${task.completed ? "checked" : ""} aria-label="Mark task done">
            </div>
            <div class="task-content">
                <span class="task-title">${escapeHTML(task.title)}</span>
                <div class="task-meta-row">
                    <span class="category-tag">${escapeHTML(task.category)}</span>
                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                    <span class="due-date-text">📅 ${task.dueDate}</span>
                </div>
            </div>
            <button class="task-delete-btn" title="Delete task" aria-label="Delete task">✕</button>
        `;

        // Checkbox event
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveToStorage(STORAGE_KEYS.TASKS, tasks);
            if (task.completed) {
                playSound("success");
                showToast("Task completed! Keep up the momentum 🌟", "success");
            } else {
                playSound("click");
            }
            renderTasks();
        });

        // Delete button
        li.querySelector(".task-delete-btn").addEventListener("click", () => {
            tasks = tasks.filter(t => t.id !== task.id);
            saveToStorage(STORAGE_KEYS.TASKS, tasks);
            playSound("click");
            renderTasks();
        });

        list.appendChild(li);
    });

    // Counts
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    $("#countAll").textContent = total;
    $("#countPending").textContent = pending;
    $("#countCompleted").textContent = completed;
    $("#pendingTasksBadge").textContent = pending;

    emptyState.classList.toggle("hidden", filtered.length > 0);

    updateDashboardMetrics();
}

function updateDashboardMetrics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    $("#statStreak").textContent = stats.streak || 5;
    $("#statFocusMinutes").textContent = `${stats.focusMinutesToday || 0}m`;
    $("#statTasksProgress").textContent = `${completed} / ${total}`;
    $("#statTasksPercent").textContent = `${percent}%`;
    $("#statQuizzesCompleted").textContent = stats.quizzesCompleted || 3;

    $("#dashboardProgressPercent").textContent = `${percent}% Done`;
    $("#dashboardProgressRatio").textContent = `${completed} of ${total}`;
    $("#dashboardProgressBar").style.width = `${percent}%`;
}

/* ==========================================================================
   Tool 6: AI Study Buddy Chat (Interactive NLP Tutor)
   ========================================================================== */

function setupChat() {
    const chatForm = $("#chatForm");
    const chatInput = $("#chatInput");

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = chatInput.value.trim();
        if (!query) return;
        sendUserChatMessage(query);
        chatInput.value = "";
    });

    // Auto-expand textarea
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event("submit"));
        }
    });

    // Starter suggestion chips
    $$(".chat-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            sendUserChatMessage(chip.textContent);
        });
    });
}

async function sendUserChatMessage(message) {
    playSound("click");
    appendChatMessage(message, "user");

    const typingId = appendTypingIndicator();

    try {
        let aiReply = "";
        if (settings.aiEngine === "gemini" && settings.geminiApiKey) {
            aiReply = await callGeminiChat(message);
        } else {
            await new Promise(r => setTimeout(r, 600));
            aiReply = generateOfflineTutorResponse(message);
        }

        removeTypingIndicator(typingId);
        appendChatMessage(aiReply, "ai");
        playSound("success");
    } catch (err) {
        removeTypingIndicator(typingId);
        appendChatMessage("I encountered an issue connecting to the live API. Here is an offline tip: Breaking down your problem into first principles is always the quickest path forward!", "ai");
    }
}

function appendChatMessage(text, sender) {
    const messagesBox = $("#chatMessages");
    const isUser = sender === "user";
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${isUser ? "user-msg" : "ai-msg"}`;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    msgDiv.innerHTML = `
        <div class="msg-avatar">${isUser ? "🎓" : "⚡"}</div>
        <div class="msg-bubble">
            ${!isUser ? '<div class="msg-sender">StudyMate AI Tutor</div>' : ""}
            <div class="msg-text">${formatChatMarkdown(text)}</div>
            <span class="msg-time">${timeStr}</span>
        </div>
    `;

    messagesBox.appendChild(msgDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function appendTypingIndicator() {
    const messagesBox = $("#chatMessages");
    const typingDiv = document.createElement("div");
    const id = "typing_" + Date.now();
    typingDiv.id = id;
    typingDiv.className = "chat-msg ai-msg";
    typingDiv.innerHTML = `
        <div class="msg-avatar">⚡</div>
        <div class="msg-bubble">
            <span class="btn-spinner" style="border-top-color:var(--primary); margin: 4px;"></span>
            <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">Thinking...</span>
        </div>
    `;
    messagesBox.appendChild(typingDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function formatChatMarkdown(text) {
    return escapeHTML(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n\s*-\s*(.*)/g, "<br>• $1")
        .replace(/\n/g, "<br>");
}

function generateOfflineTutorResponse(query) {
    const q = query.toLowerCase();

    if (q.includes("feynman") || q.includes("explain")) {
        return `**The Feynman Technique has 4 simple steps:**\n\n1. **Choose your concept:** Write its title at the top of a blank page.\n2. **Teach it to a child:** Write an explanation using simple everyday analogies. No complex technical jargon allowed!\n3. **Identify your gaps:** When you struggle to explain a specific transition, return to your textbook.\n4. **Refine and simplify:** Create an intuitive mental model and test it by speaking it out loud.`;
    }

    if (q.includes("procrastinat") || q.includes("lazy") || q.includes("focus")) {
        return `**Overcoming Study Procrastination:**\n\n- **Use the 5-Minute Rule:** Tell your brain: *"I will only sit down and open the book for 5 minutes. If I still want to stop, I can."* 85% of the time, overcoming the initiation friction keeps you going.\n- **Use our Pomodoro tool:** Lock in for one 25m block with zero notifications.\n- **Lower the barrier:** Clear your desk before going to sleep so starting requires zero setup tomorrow.`;
    }

    if (q.includes("photosynthesis") || q.includes("bakery")) {
        return `**Photosynthesis Bakery Analogy:**\n\nImagine the chloroplast is a solar-powered bakery:\n- **Raw ingredients:** Carbon dioxide (flour from the air) and water (liquid from the roots).\n- **Energy source:** Sunlight acts as the electricity running the bakery ovens.\n- **Product:** Delicious Glucose (loaves of bread) packaged for energy storage.\n- **Exhaust byproduct:** Oxygen gas released through the windows for all of us to breathe!`;
    }

    if (q.includes("recursion") || q.includes("program")) {
        return `**Recursion in Plain English:**\n\nRecursion is when a problem solves itself by solving a smaller version of the exact same problem.\n\nImagine standing between two parallel mirrors, or searching through a stack of Russian nesting dolls. You keep opening smaller dolls until you reach the solid center doll—that's your **Base Case**, preventing an infinite loop!`;
    }

    if (q.includes("memory") || q.includes("mnemonic") || q.includes("periodic")) {
        return `**Memory & Mnemonic Power Tools:**\n\n- **The Memory Palace (Method of Loci):** Attach facts to familiar rooms in your childhood home.\n- **Acronyms:** Form words out of first letters (e.g., *HOMES* for the Great Lakes: Huron, Ontario, Michigan, Erie, Superior).\n- **Vivid Visualization:** The weirder and more emotional the mental image, the stronger your hippocampal recall!`;
    }

    return `That's a great study question regarding **${escapeHTML(query)}**!\n\nHere are the 3 best steps to master it:\n1. **Break it down:** What are the 2 or 3 foundational sub-ideas?\n2. **Formulate a question:** Turn this concept into a multiple-choice practice question in our Quiz Generator.\n3. **Apply it:** Write a one-paragraph summary in our Summarizer to crystallize your thoughts.`;
}

async function callGeminiChat(prompt) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `You are StudyMate AI, an encouraging, highly knowledgeable academic tutor. Provide an intuitive, clear, formatted breakdown with practical analogies.\n\nQuestion: ${prompt}` }] }]
        })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to retrieve response.";
}

/* ==========================================================================
   Settings Modal & Data Management
   ========================================================================== */

function setupSettingsModal() {
    const modal = $("#settingsModal");
    $("#settingsBtn").addEventListener("click", () => {
        $("#geminiApiKeyInput").value = settings.geminiApiKey || "";
        const radio = $(`input[name="aiEngineRadio"][value="${settings.aiEngine}"]`);
        if (radio) radio.checked = true;
        $("#geminiKeyGroup").style.display = settings.aiEngine === "gemini" ? "block" : "none";
        $("#soundToggleCheckbox").checked = settings.soundEnabled;
        modal.classList.remove("hidden");
    });

    $("#closeSettingsModalBtn").addEventListener("click", () => modal.classList.add("hidden"));

    $$('input[name="aiEngineRadio"]').forEach(r => {
        r.addEventListener("change", () => {
            $("#geminiKeyGroup").style.display = r.value === "gemini" ? "block" : "none";
        });
    });

    $("#saveSettingsBtn").addEventListener("click", () => {
        const selectedEngine = $('input[name="aiEngineRadio"]:checked')?.value || "offline";
        settings.aiEngine = selectedEngine;
        settings.geminiApiKey = $("#geminiApiKeyInput").value.trim();
        settings.soundEnabled = $("#soundToggleCheckbox").checked;

        saveToStorage(STORAGE_KEYS.SETTINGS, settings);
        updateSoundToggleUI();

        $("#activeEngineText").textContent = selectedEngine === "gemini" && settings.geminiApiKey
            ? "Google Gemini Live AI Connected ✨"
            : "Intelligent NLP Engine (Offline Active)";

        modal.classList.add("hidden");
        showToast("Preferences saved successfully! ⚙", "success");
        playSound("success");
    });

    $("#exportDataBtn").addEventListener("click", () => {
        const fullBackup = { tasks, stats, customCards, cardMastery, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `StudyMate_Backup_${Date.now()}.json`;
        a.click();
        showToast("Study data exported! 💾", "success");
    });

    $("#resetDataBtn").addEventListener("click", () => {
        if (confirm("Reset tasks and flashcards to default sample values?")) {
            tasks = [...defaultTasks];
            stats = { ...defaultStats };
            customCards = [];
            cardMastery = {};
            saveToStorage(STORAGE_KEYS.TASKS, tasks);
            saveToStorage(STORAGE_KEYS.STATS, stats);
            saveToStorage(STORAGE_KEYS.CUSTOM_CARDS, customCards);
            saveToStorage(STORAGE_KEYS.FLASHCARD_MASTERY, cardMastery);

            renderTasks();
            updateDashboardMetrics();
            updateCustomDeckBadge();
            selectDeck("cs");
            modal.classList.add("hidden");
            showToast("Reset to defaults complete! 🌱", "info");
        }
    });
}

/* ==========================================================================
   Toast Notifications & Helper Utilities
   ========================================================================== */

function showToast(message, type = "info") {
    const container = $("#toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function loadFromStorage(key, fallback) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        return fallback;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn("Storage save error:", e);
    }
}

function getFormattedDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split("T")[0];
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* ==========================================================================
   Application Initialization
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Theme and Sound initialization
    applyTheme(settings.theme || "dark");
    updateSoundToggleUI();

    $("#themeToggleBtn").addEventListener("click", () => {
        const nextTheme = (document.documentElement.getAttribute("data-theme") === "dark") ? "light" : "dark";
        applyTheme(nextTheme);
        playSound("click");
    });

    $("#soundToggleBtn").addEventListener("click", () => {
        settings.soundEnabled = !settings.soundEnabled;
        saveToStorage(STORAGE_KEYS.SETTINGS, settings);
        updateSoundToggleUI();
        playSound("click");
    });

    // 2. Navigation items
    $$(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.target));
    });

    $$("[data-go]").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.go));
    });

    // 3. Mobile drawer toggles
    $("#menuToggle").addEventListener("click", () => {
        $("#sidebar").classList.toggle("open");
    });
    $("#mobileCloseBtn").addEventListener("click", () => {
        $("#sidebar").classList.remove("open");
    });

    // 4. Hero & Dashboard elements
    setDynamicGreeting();
    refreshDailyQuote();
    $("#refreshQuoteBtn").addEventListener("click", refreshDailyQuote);
    $("#nextTipBtn").addEventListener("click", displayNextTip);

    // 5. Initialize tool modules
    setupSummarizer();
    setupQuizGenerator();
    setupFlashcards();
    setupPomodoro();
    setupPlanner();
    setupChat();
    setupSettingsModal();

    // 6. Update metrics
    updateDashboardMetrics();

    console.log("⚡ StudyMate AI 2.0 initialized successfully.");
});
