/* ==========================================================================
   Lumi AI Scholar / Academy — controller script
   Dynamic Game Arena State Machine, Local Stats tracking, Web Audio FX
   ========================================================================== */

const API_BASE = 'http://localhost:5001/api';

document.addEventListener("DOMContentLoaded", () => {
    // ── WEB AUDIO SYNTHESIZER SOUND SYSTEM ──
    let audioCtx = null;
    let soundMuted = localStorage.getItem("lumi_sound_muted") === "true";

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playSound(type) {
        if (soundMuted) return;
        try {
            initAudio();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            const now = audioCtx.currentTime;
            
            if (type === 'correct') {
                // Harmonic Arpeggio: C5 -> E5 -> G5
                osc.type = 'sine';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
                
                osc.start(now);
                osc.stop(now + 0.45);
            } else if (type === 'wrong') {
                // Buzz: Descending sawtooth waves
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                
                osc.frequency.setValueAtTime(170, now);
                osc.frequency.linearRampToValueAtTime(110, now + 0.35);
                
                osc.start(now);
                osc.stop(now + 0.4);
            } else if (type === 'victory_perfect') {
                // Fanfare: C5 -> E5 -> G5 -> C6
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
                
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.09); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.18); // G5
                osc.frequency.setValueAtTime(1046.50, now + 0.27); // C6
                
                osc.start(now);
                osc.stop(now + 0.65);
            } else if (type === 'victory_good') {
                // Positive sweep
                osc.type = 'sine';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.3);
                
                osc.start(now);
                osc.stop(now + 0.5);
            } else if (type === 'defeat') {
                // Descending minor tones
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
                
                osc.frequency.setValueAtTime(329.63, now); // E4
                osc.frequency.setValueAtTime(261.63, now + 0.16); // C4
                osc.frequency.setValueAtTime(196.00, now + 0.32); // G3
                
                osc.start(now);
                osc.stop(now + 0.55);
            } else if (type === 'click') {
                // UI click
                osc.type = 'sine';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.04, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.frequency.setValueAtTime(550, now);
                osc.start(now);
                osc.stop(now + 0.08);
            }
        } catch (e) {
            console.warn("Audio Context error:", e);
        }
    }

    // Sound toggle controls
    const soundToggleBtn = document.getElementById("soundToggleBtn");
    const soundIcon = document.getElementById("soundIcon");

    function updateSoundUI() {
        if (soundMuted) {
            soundIcon.innerHTML = `
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
            `;
            soundToggleBtn.setAttribute("title", "Sound Muted (Click to Unmute)");
        } else {
            soundIcon.innerHTML = `
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            `;
            soundToggleBtn.setAttribute("title", "Sound Active (Click to Mute)");
        }
    }
    
    updateSoundUI();

    soundToggleBtn.addEventListener("click", () => {
        soundMuted = !soundMuted;
        localStorage.setItem("lumi_sound_muted", soundMuted);
        updateSoundUI();
        if (!soundMuted) {
            playSound('click');
        }
    });

    // ── APPLICATION STATE MACHINE ──
    let activeQuestions = [];
    let currentQuestionIndex = 0;
    let correctAnswersCount = 0;
    let secondsRemaining = 30;
    let timerInterval = null;
    let quizType = "Grammar"; // "Grammar" or "Custom"
    let quizTopicName = "";   // e.g. "Python Coding"
    let timeSpentSeconds = 0;
    let quizSecondsTicker = null;
    let answersLogged = []; // list tracking choices made
    let currentQuizMistakes = []; // dynamic mistakes tracking list
    
    // ── DOM ELEMENTS MAPPING ──
    const dashboardPanel = document.getElementById("dashboardPanel");
    const arenaPanel = document.getElementById("arenaPanel");
    const scorePanel = document.getElementById("scorePanel");
    const guidePanel = document.getElementById("guidePanel");
    const arenaLoader = document.getElementById("arenaLoader");
    
    const startGrammarBtn = document.getElementById("startGrammarBtn");
    const grammarDifficulty = document.getElementById("grammarDifficulty");
    
    const startCustomBtn = document.getElementById("startCustomBtn");
    const customTopicInput = document.getElementById("customTopicInput");
    
    const quitArenaBtn = document.getElementById("quitArenaBtn");
    const arenaCategoryBadge = document.getElementById("arenaCategoryBadge");
    const arenaTimer = document.getElementById("arenaTimer");
    const questionProgressText = document.getElementById("questionProgressText");
    const currentAccuracyText = document.getElementById("currentAccuracyText");
    const progressFill = document.getElementById("progressFill");
    
    const questionText = document.getElementById("questionText");
    const choicesGrid = document.getElementById("choicesGrid");
    const explanationPanel = document.getElementById("explanationPanel");
    const explanationStatusIcon = document.getElementById("explanationStatusIcon");
    const explanationStatusTitle = document.getElementById("explanationStatusTitle");
    const explanationBody = document.getElementById("explanationBody");
    const questionTopicText = document.getElementById("questionTopicText");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    
    // Scoreboard elements
    const scoreChartCircle = document.getElementById("scoreChartCircle");
    const scoreChartPercentageText = document.getElementById("scoreChartPercentageText");
    const scoreRatingText = document.getElementById("scoreRatingText");
    const scoreRatingDescText = document.getElementById("scoreRatingDescText");
    const scoreCorrectValue = document.getElementById("scoreCorrectValue");
    const scoreIncorrectValue = document.getElementById("scoreIncorrectValue");
    const scoreTimeValue = document.getElementById("scoreTimeValue");
    const mistakeListContainer = document.getElementById("mistakeListContainer");
    const scoreCloseBtn = document.getElementById("scoreCloseBtn");
    const generateStudyGuideBtn = document.getElementById("generateStudyGuideBtn");
    
    // Personalized Guide elements
    const closeGuideBtn = document.getElementById("closeGuideBtn");
    const guideTopicTitle = document.getElementById("guideTopicTitle");
    const guideSummaryText = document.getElementById("guideSummaryText");
    const guideStrengthsList = document.getElementById("guideStrengthsList");
    const guideWeaknessesList = document.getElementById("guideWeaknessesList");
    const guideRulesContainer = document.getElementById("guideRulesContainer");
    const guideRecommendationsList = document.getElementById("guideRecommendationsList");
    
    // Loader texts
    const loaderTitle = document.getElementById("loaderTitle");
    const loaderMessage = document.getElementById("loaderMessage");
    
    // Widgets stats elements
    const globalAccuracyCircle = document.getElementById("globalAccuracyCircle");
    const globalAccuracyText = document.getElementById("globalAccuracyText");
    const globalGradeText = document.getElementById("globalGradeText");
    const statsTotalQuizzes = document.getElementById("statsTotalQuizzes");
    const statsTotalQuestions = document.getElementById("statsTotalQuestions");
    const statsStreak = document.getElementById("statsStreak");
    const statsGrammarMax = document.getElementById("statsGrammarMax");
    
    // Badges elements mapping
    const badgeElements = {
        badgeNovice: document.getElementById("badgeNovice"),
        badgeStreak: document.getElementById("badgeStreak"),
        badgeGrammar: document.getElementById("badgeGrammar"),
        badgePolymath: document.getElementById("badgePolymath")
    };

    // ── STATS & PROGRESS CENTER (LOCAL STORAGE) ──
    function getStoredStats() {
        return {
            totalQuizzes: parseInt(localStorage.getItem("lumi_stats_total_quizzes")) || 0,
            totalQuestions: parseInt(localStorage.getItem("lumi_stats_total_questions")) || 0,
            totalCorrect: parseInt(localStorage.getItem("lumi_stats_total_correct")) || 0,
            streak: parseInt(localStorage.getItem("lumi_stats_streak")) || 0,
            maxGrammarScore: parseInt(localStorage.getItem("lumi_stats_max_grammar")) || 0,
            customTopicsSolved: JSON.parse(localStorage.getItem("lumi_stats_custom_topics")) || [],
            unlockedBadges: JSON.parse(localStorage.getItem("lumi_stats_badges")) || {
                badgeNovice: false,
                badgeStreak: false,
                badgeGrammar: false,
                badgePolymath: false
            }
        };
    }

    function saveStats(stats) {
        localStorage.setItem("lumi_stats_total_quizzes", stats.totalQuizzes);
        localStorage.setItem("lumi_stats_total_questions", stats.totalQuestions);
        localStorage.setItem("lumi_stats_total_correct", stats.totalCorrect);
        localStorage.setItem("lumi_stats_streak", stats.streak);
        localStorage.setItem("lumi_stats_max_grammar", stats.maxGrammarScore);
        localStorage.setItem("lumi_stats_custom_topics", JSON.stringify(stats.customTopicsSolved));
        localStorage.setItem("lumi_stats_badges", JSON.stringify(stats.unlockedBadges));
        renderSidebarStatsAndBadges();
    }

    function renderSidebarStatsAndBadges() {
        const stats = getStoredStats();
        
        // Calculate dynamic overall accuracy
        let accuracy = 0;
        if (stats.totalQuestions > 0) {
            accuracy = Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
        }
        
        // Render small circular accuracy meter
        const circumference = 2 * Math.PI * 15.9155; // matches 100 dasharray circle
        const strokeDashOffset = circumference - (accuracy / 100) * circumference;
        globalAccuracyCircle.style.strokeDasharray = `${accuracy}, 100`;
        globalAccuracyText.textContent = `${accuracy}%`;
        
        // Calculate corresponding Grade string
        let gradeStr = "Attempt a quiz to see your rank!";
        if (stats.totalQuizzes > 0) {
            if (accuracy >= 90) gradeStr = "S-Tier Scholar 🥇";
            else if (accuracy >= 80) gradeStr = "A-Tier Knight ⚔️";
            else if (accuracy >= 70) gradeStr = "B-Tier Apprentice 📚";
            else if (accuracy >= 50) gradeStr = "Novice Practitioner 🌱";
            else gradeStr = "Beginner Explorer 🔬";
        }
        globalGradeText.textContent = gradeStr;
        
        // Fill simple count metrics
        statsTotalQuizzes.textContent = stats.totalQuizzes;
        statsTotalQuestions.textContent = stats.totalQuestions;
        statsStreak.textContent = `${stats.streak} 🔥`;
        
        statsGrammarMax.textContent = stats.totalQuizzes > 0 && stats.maxGrammarScore > 0 
            ? `${stats.maxGrammarScore}/5` 
            : "N/A";
            
        // Render earned/locked badges
        for (const [badgeKey, el] of Object.entries(badgeElements)) {
            if (stats.unlockedBadges[badgeKey]) {
                el.classList.remove("locked");
            } else {
                el.classList.add("locked");
            }
        }
    }

    // Initialize sidebar immediately
    renderSidebarStatsAndBadges();

    // ── GAME ARENA TICKERS & CONTROLLERS ──
    function startTimer() {
        secondsRemaining = 30;
        arenaTimer.textContent = `${secondsRemaining}s`;
        arenaTimer.style.color = "#FBBF24"; // Reset warning glow
        arenaTimer.style.borderColor = "rgba(245, 158, 11, 0.25)";
        
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            secondsRemaining--;
            arenaTimer.textContent = `${secondsRemaining}s`;
            
            if (secondsRemaining <= 10) {
                // Red glowing state for fast decay
                arenaTimer.style.color = "#F87171";
                arenaTimer.style.borderColor = "rgba(239, 68, 68, 0.4)";
                if (secondsRemaining <= 5) {
                    // Play dynamic buzzer tick if needed
                }
            }
            
            if (secondsRemaining <= 0) {
                clearInterval(timerInterval);
                handleTimeOut();
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function startQuizTick() {
        timeSpentSeconds = 0;
        clearInterval(quizSecondsTicker);
        quizSecondsTicker = setInterval(() => {
            timeSpentSeconds++;
        }, 1000);
    }

    function stopQuizTick() {
        clearInterval(quizSecondsTicker);
    }

    // ── STATE CHANGES / SCREEN SWITCHING ──
    function showPanel(panel) {
        dashboardPanel.classList.add("hidden");
        arenaPanel.classList.add("hidden");
        scorePanel.classList.add("hidden");
        guidePanel.classList.add("hidden");
        
        panel.classList.remove("hidden");
    }

    function showLoader(title, msg) {
        loaderTitle.textContent = title;
        loaderMessage.textContent = msg;
        arenaLoader.classList.remove("hidden");
    }

    function hideLoader() {
        arenaLoader.classList.add("hidden");
    }

    // ── ARENA INITIALIZERS ──
    async function initGrammarQuiz() {
        playSound('click');
        const diff = grammarDifficulty.value;
        showLoader("Forging Grammar Arena...", `Assembling professional ${diff} grammar challenges. Let's see your verbal skill!`);
        
        try {
            const res = await fetch(`${API_BASE}/games/grammar/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ difficulty: diff })
            });
            const data = await res.json();
            
            if (data.error) {
                showLumiAlert(data.error);
                hideLoader();
                return;
            }
            
            activeQuestions = data.questions;
            quizType = "Grammar";
            quizTopicName = `Grammar: ${diff}`;
            currentQuestionIndex = 0;
            correctAnswersCount = 0;
            answersLogged = [];
            currentQuizMistakes = [];
            
            hideLoader();
            showPanel(arenaPanel);
            arenaCategoryBadge.textContent = `Grammar: ${diff}`;
            
            startQuizTick();
            renderQuestion();
            
        } catch (e) {
            console.error("Failed to load grammar quiz:", e);
            showLumiAlert("Could not load educational material. Make sure the server backend is running properly.");
            hideLoader();
        }
    }

    async function initCustomQuiz() {
        playSound('click');
        const topic = customTopicInput.value.trim();
        if (!topic) {
            showLumiAlert("Please enter a study subject to forge customized educational material!");
            return;
        }
        
        showLoader("Forging AI Custom Scholar...", `Synthesizing educational curriculum on "${topic}". Gathering specialized metrics...`);
        
        try {
            const res = await fetch(`${API_BASE}/games/custom-scholar/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic })
            });
            const data = await res.json();
            
            if (data.error) {
                showLumiAlert(data.error);
                hideLoader();
                return;
            }
            
            activeQuestions = data.questions;
            quizType = "Custom";
            quizTopicName = topic;
            currentQuestionIndex = 0;
            correctAnswersCount = 0;
            answersLogged = [];
            currentQuizMistakes = [];
            
            hideLoader();
            showPanel(arenaPanel);
            arenaCategoryBadge.textContent = `AI Scholar: ${topic}`;
            
            startQuizTick();
            renderQuestion();
            
        } catch (e) {
            console.error("Failed to load custom quiz:", e);
            showLumiAlert("Could not load educational material. Make sure the server backend is running properly.");
            hideLoader();
        }
    }

    // ── QUESTION RENDERER & ANSWER PROCESSING ──
    function renderQuestion() {
        if (currentQuestionIndex >= activeQuestions.length) {
            finishQuiz();
            return;
        }
        
        const q = activeQuestions[currentQuestionIndex];
        
        // Progress labels
        questionProgressText.textContent = `Question ${currentQuestionIndex + 1} of ${activeQuestions.length}`;
        currentAccuracyText.textContent = `Score: ${correctAnswersCount}/${currentQuestionIndex}`;
        
        // Fill width bar progress
        const percent = ((currentQuestionIndex) / activeQuestions.length) * 100;
        progressFill.style.width = `${percent}%`;
        
        questionText.textContent = q.question;
        questionTopicText.textContent = q.topic || "General Concept";
        
        // Render option choice buttons
        choicesGrid.innerHTML = "";
        q.options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "choice-card";
            btn.innerHTML = `<span style="font-weight:700; margin-right: 12px; color: var(--color-primary);">${String.fromCharCode(65 + idx)}.</span> <span>${opt}</span>`;
            btn.addEventListener("click", () => handleAnswerSelection(opt, btn));
            choicesGrid.appendChild(btn);
        });
        
        // Hide explanation and next button initially
        explanationPanel.className = "explanation-panel hidden";
        nextQuestionBtn.classList.add("hidden");
        
        startTimer();
    }

    function handleAnswerSelection(selectedOption, clickedBtn) {
        stopTimer();
        playSound('click');
        
        const q = activeQuestions[currentQuestionIndex];
        const buttons = choicesGrid.querySelectorAll(".choice-card");
        
        // Lock options click
        buttons.forEach(btn => btn.classList.add("disabled"));
        
        clickedBtn.classList.add("selected");
        
        const isCorrect = (selectedOption === q.answer);
        
        if (isCorrect) {
            correctAnswersCount++;
            clickedBtn.classList.remove("selected");
            clickedBtn.classList.add("correct");
            playSound('correct');
            
            // Format explanation container correct
            explanationPanel.className = "explanation-panel correct-explanation";
            explanationStatusIcon.style.background = "var(--color-accent)";
            explanationStatusIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            explanationStatusTitle.textContent = "Spectacular! That is Correct.";
            explanationStatusTitle.style.color = "#34D399";
        } else {
            clickedBtn.classList.remove("selected");
            clickedBtn.classList.add("wrong");
            playSound('wrong');
            
            // Log mistake details
            currentQuizMistakes.push({
                question: q.question,
                topic: q.topic || "General Concept",
                selected: selectedOption,
                correct: q.answer,
                explanation: q.explanation
            });
            
            // Highlight the true correct choice visually
            buttons.forEach(btn => {
                const optText = btn.querySelector("span:last-child").textContent.trim();
                if (optText === q.answer.trim()) {
                    btn.classList.add("correct");
                }
            });
            
            // Format explanation container mistake
            explanationPanel.className = "explanation-panel wrong-explanation";
            explanationStatusIcon.style.background = "var(--color-danger)";
            explanationStatusIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            explanationStatusTitle.textContent = "Incorrect Concept.";
            explanationStatusTitle.style.color = "#F87171";
        }
        
        explanationBody.textContent = q.explanation || "No explanation provided for this conceptual puzzle.";
        explanationPanel.classList.remove("hidden");
        nextQuestionBtn.classList.remove("hidden");
    }

    function handleTimeOut() {
        playSound('wrong');
        const q = activeQuestions[currentQuestionIndex];
        const buttons = choicesGrid.querySelectorAll(".choice-card");
        
        // Lock options click
        buttons.forEach(btn => btn.classList.add("disabled"));
        
        // Highlight correct
        buttons.forEach(btn => {
            const optText = btn.querySelector("span:last-child").textContent.trim();
            if (optText === q.answer.trim()) {
                btn.classList.add("correct");
            }
        });
        
        // Log timeout mistake
        currentQuizMistakes.push({
            question: q.question,
            topic: q.topic || "General Concept",
            selected: "Timed Out (Over 30s limit)",
            correct: q.answer,
            explanation: q.explanation
        });
        
        explanationPanel.className = "explanation-panel wrong-explanation";
        explanationStatusIcon.style.background = "var(--color-danger)";
        explanationStatusIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        explanationStatusTitle.textContent = "Time Limit Exceeded!";
        explanationStatusTitle.style.color = "#F87171";
        
        explanationBody.textContent = q.explanation || "You ran out of time! Speed up your conceptual execution to achieve highest scholar status.";
        explanationPanel.classList.remove("hidden");
        nextQuestionBtn.classList.remove("hidden");
    }

    nextQuestionBtn.addEventListener("click", () => {
        playSound('click');
        currentQuestionIndex++;
        renderQuestion();
    });

    // ── QUIZ EVALUATION / SCOREBOARD RENDER ──
    function finishQuiz() {
        stopQuizTick();
        
        const totalQs = activeQuestions.length;
        const correct = correctAnswersCount;
        const pct = Math.round((correct / totalQs) * 100);
        
        // Save stats to Local Storage
        const stats = getStoredStats();
        stats.totalQuizzes += 1;
        stats.totalQuestions += totalQs;
        stats.totalCorrect += correct;
        
        // Compute streak (Streak tracks consecutive quizzes above 80% / 4 out of 5)
        if (pct >= 80) {
            stats.streak += 1;
        } else {
            stats.streak = 0;
        }
        
        // Record max scores
        if (quizType === "Grammar") {
            if (correct > stats.maxGrammarScore) {
                stats.maxGrammarScore = correct;
            }
        } else {
            // Track custom solved lists
            if (!stats.customTopicsSolved.includes(quizTopicName)) {
                stats.customTopicsSolved.push(quizTopicName);
            }
        }
        
        // Unlock Badges dynamic assessments
        if (pct >= 80) {
            stats.unlockedBadges.badgeNovice = true;
        }
        if (stats.streak >= 3) {
            stats.unlockedBadges.badgeStreak = true;
        }
        if (quizType === "Grammar" && correct === 5) {
            stats.unlockedBadges.badgeGrammar = true;
        }
        if (stats.customTopicsSolved.length >= 3) {
            stats.unlockedBadges.badgePolymath = true;
        }
        
        saveStats(stats);
        
        // Choose sound theme
        if (correct === 5) {
            playSound('victory_perfect');
        } else if (correct >= 4) {
            playSound('victory_good');
        } else {
            playSound('defeat');
        }
        
        // Render Score report visuals
        progressFill.style.width = "100%";
        showPanel(scorePanel);
        
        // Render large percentage SVG ring
        scoreChartCircle.style.strokeDasharray = `${pct}, 100`;
        scoreChartPercentageText.textContent = `${pct}%`;
        
        // Adjust score rating titles
        let titleStr = "Keep Learning!";
        let descStr = `You got ${correct} out of ${totalQs} questions correct. Practice makes perfect scholar consistency!`;
        
        if (pct === 100) {
            titleStr = "Perfect AI Mastery! 🏆";
            descStr = `Flawless score! You got all ${correct} questions correct. Your conceptual understanding is elite level.`;
        } else if (pct >= 80) {
            titleStr = "Exceptional Scholar! 🎓";
            descStr = `Terrific performance! You got ${correct} out of ${totalQs} correct. Keep building your streak.`;
        } else if (pct >= 60) {
            titleStr = "Strong Understanding! 👍";
            descStr = `Good effort! You answered ${correct} correct. Review your mistake analysis block to lock in the gaps.`;
        }
        
        scoreRatingText.textContent = titleStr;
        scoreRatingDescText.textContent = descStr;
        
        scoreCorrectValue.textContent = correct;
        scoreIncorrectValue.textContent = totalQs - correct;
        scoreTimeValue.textContent = `${timeSpentSeconds}s`;
        
        // Render mistakes list
        mistakeListContainer.innerHTML = "";
        
        if (currentQuizMistakes.length === 0) {
            mistakeListContainer.innerHTML = `
                <div style="text-align:center; padding: 20px 0; color: var(--color-accent); font-weight:600;">
                    🌟 Perfect Score Achievement! No mistakes recorded. Pure perfection!
                </div>
            `;
            generateStudyGuideBtn.classList.add("hidden"); // Disable study guide if flawless
        } else {
            generateStudyGuideBtn.classList.remove("hidden");
            currentQuizMistakes.forEach((m, idx) => {
                const item = document.createElement("div");
                item.className = "mistake-item";
                item.innerHTML = `
                    <span class="mistake-question">${m.question}</span>
                    <div class="mistake-answers-row">
                        <span class="mistake-user-choice">Your Answer: ${m.selected}</span>
                        <span class="mistake-correct-choice">Correct Answer: ${m.correct}</span>
                    </div>
                    <span class="mistake-exp-text"><strong>Conceptual Key:</strong> ${m.explanation}</span>
                `;
                mistakeListContainer.appendChild(item);
            });
        }
    }

    // ── AI PERSONALIZED GUIDE GENERATOR (API COLLABORATOR) ──
    async function buildStudyGuide() {
        playSound('click');
        showLoader("Consulting Lumi AI Tutors...", "Analyzing your quiz mistake vectors to build custom grammar rules and conceptual guides.");
        
        try {
            const res = await fetch(`${API_BASE}/games/scholar/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mistakes: currentQuizMistakes,
                    quiz_type: quizTopicName
                })
            });
            const data = await res.json();
            
            if (data.error) {
                showLumiAlert(data.error);
                hideLoader();
                return;
            }
            
            hideLoader();
            showPanel(guidePanel);
            
            // Populate Personalized Study Guide UI elements
            guideTopicTitle.textContent = `AI Scholar Roadmap: ${quizTopicName}`;
            guideSummaryText.textContent = data.summary;
            
            // Strengths
            guideStrengthsList.innerHTML = "";
            data.strengths.forEach(str => {
                const li = document.createElement("li");
                li.textContent = str;
                guideStrengthsList.appendChild(li);
            });
            
            // Weaknesses
            guideWeaknessesList.innerHTML = "";
            data.weaknesses.forEach(wk => {
                const li = document.createElement("li");
                li.textContent = wk;
                guideWeaknessesList.appendChild(li);
            });
            
            // Study guide concepts rules container
            guideRulesContainer.innerHTML = "";
            data.study_guide.forEach(guide => {
                const card = document.createElement("div");
                card.className = "rule-card";
                card.innerHTML = `
                    <h4>📘 Concept: ${guide.concept}</h4>
                    <p>${guide.rule}</p>
                    <div class="rule-tip">💡 <strong>Mnemonic Hint:</strong> ${guide.quick_tip}</div>
                `;
                guideRulesContainer.appendChild(card);
            });
            
            // Recommendations
            guideRecommendationsList.innerHTML = "";
            data.recommendations.forEach(rec => {
                const li = document.createElement("li");
                li.textContent = rec;
                guideRecommendationsList.appendChild(li);
            });
            
            playSound('victory_good');
            
        } catch (e) {
            console.error("Failed to compile custom AI study guide roadmap:", e);
            showLumiAlert("Encountered failure talking to Lumi Tutor backend. Ensure your Flask server is up and key is set.");
            hideLoader();
        }
    }

    // ── CLICK LISTENERS & INTEGRATIONS ──
    startGrammarBtn.addEventListener("click", initGrammarQuiz);
    startCustomBtn.addEventListener("click", initCustomQuiz);
    
    quitArenaBtn.addEventListener("click", () => {
        playSound('click');
        if (confirm("Are you sure you want to quit this educational challenge? Unfinished tests count as N/A score.")) {
            stopTimer();
            stopQuizTick();
            showPanel(dashboardPanel);
        }
    });
    
    scoreCloseBtn.addEventListener("click", () => {
        playSound('click');
        showPanel(dashboardPanel);
    });
    
    generateStudyGuideBtn.addEventListener("click", buildStudyGuide);
    
    closeGuideBtn.addEventListener("click", () => {
        playSound('click');
        showPanel(scorePanel);
    });

    // Handle pressing Enter key on custom topic forge input
    customTopicInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            initCustomQuiz();
        }
    });
});
