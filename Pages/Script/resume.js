/* ==========================================================================
   CVForge AI — resume.js
   Dynamic File Upload, API Handling, and Dashboard Rendering
   ========================================================================== */

'use strict';

const API_BASE = 'http://localhost:5001/api';

// State
let selectedFile = null;
let analysisData = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const sampleBtn = document.getElementById('sampleBtn');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');

const heroSection = document.getElementById('heroSection');
const uploadSection = document.getElementById('uploadSection');
const resultsSection = document.getElementById('resultsSection');

const jdToggleBtn = document.getElementById('jdToggleBtn');
const jdContainer = document.getElementById('jdContainer');
const jobDescriptionInput = document.getElementById('jobDescriptionInput');

const analysisStatus = document.getElementById('analysisStatus');
const progressBarFill = document.getElementById('progressBarFill');
const statusTitle = document.getElementById('statusTitle');
const statusDesc = document.getElementById('statusDesc');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

/* ── EVENT BINDINGS ─────────────────────────────────────────────────────── */

// File input triggers
selectFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files[0]);
});

// Drag and drop events
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
    }, false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    handleFileSelection(file);
});

// Job Description Toggle
jdToggleBtn.addEventListener('click', () => {
    jdToggleBtn.classList.toggle('active');
    jdContainer.classList.toggle('hidden');
});

// Analyze Click
analyzeBtn.addEventListener('click', startAnalysis);

// Try Sample Click
sampleBtn.addEventListener('click', trySampleAnalysis);

// Reset / Reanalyze Click
reanalyzeBtn.addEventListener('click', resetToUploadState);

// Tabs Switch Handler
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update active tab buttons
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update visible tab panes
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
            if (pane.id === `pane-${targetTab}`) {
                pane.classList.add('active');
            }
        });
    });
});

/* ── FUNCTIONS ──────────────────────────────────────────────────────────── */

function handleFileSelection(file) {
    if (!file) return;
    
    // Check file extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'txt') {
        showLumiAlert('Unsupported file type. Please upload a PDF or TXT file.');
        return;
    }
    
    // Check file size (5MB cap)
    if (file.size > 5 * 1024 * 1024) {
        showLumiAlert('File size exceeds the 5MB limit.');
        return;
    }
    
    selectedFile = file;
    
    // Update drop zone UI
    const content = dropZone.querySelector('.drop-zone-content');
    content.innerHTML = `
        <div class="upload-icon-wrapper" style="color: var(--color-accent); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05);">
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <h3 style="color: var(--text-primary);">${esc(file.name)}</h3>
        <p class="file-types" style="color: var(--color-accent); font-weight: 500;">Resume loaded successfully</p>
        <button class="btn btn-secondary select-btn" id="removeFileBtn" style="margin-top:10px;">Remove File</button>
    `;
    
    // Re-bind click for remove button
    const removeBtn = document.getElementById('removeFileBtn');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetDropZone();
    });
    
    // Enable analyze button
    analyzeBtn.classList.remove('disabled');
    analyzeBtn.removeAttribute('disabled');
}

function resetDropZone() {
    selectedFile = null;
    analyzeBtn.classList.add('disabled');
    analyzeBtn.setAttribute('disabled', 'true');
    
    const content = dropZone.querySelector('.drop-zone-content');
    content.innerHTML = `
        <div class="upload-icon-wrapper">
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        </div>
        <h3>Drag & drop your resume</h3>
        <p class="file-types">Supports PDF and TXT formats (Max 5MB)</p>
        <button class="btn btn-secondary select-btn" id="selectFileBtn">Browse Files</button>
    `;
    
    // Re-bind select files click
    const selectBtn = document.getElementById('selectFileBtn');
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    fileInput.value = ''; // Clear value
}

// Start analysis and call backend API
async function startAnalysis() {
    if (!selectedFile) return;
    
    // Disable inputs
    analyzeBtn.classList.add('disabled');
    analyzeBtn.setAttribute('disabled', 'true');
    sampleBtn.classList.add('disabled');
    sampleBtn.setAttribute('disabled', 'true');
    if (document.getElementById('removeFileBtn')) {
        document.getElementById('removeFileBtn').classList.add('disabled');
        document.getElementById('removeFileBtn').setAttribute('disabled', 'true');
    }
    
    analysisStatus.classList.remove('hidden');
    
    // Animate progress steps
    let progress = 15;
    progressBarFill.style.width = `${progress}%`;
    statusTitle.textContent = "Extracting resume text...";
    statusDesc.textContent = "Parsing PDF sections, contact details, and headers.";
    
    const interval = setInterval(() => {
        if (progress < 45) {
            progress += 5;
            progressBarFill.style.width = `${progress}%`;
        } else if (progress === 45) {
            statusTitle.textContent = "Sending to Gemini AI...";
            statusDesc.textContent = "Assessing against professional resume benchmarks.";
            progress += 5;
            progressBarFill.style.width = `${progress}%`;
        } else if (progress < 85) {
            progress += 2;
            progressBarFill.style.width = `${progress}%`;
            if (progress === 65) {
                statusTitle.textContent = "Analyzing keyword alignment...";
                statusDesc.textContent = "Searching for critical skills gaps and keyword density.";
            } else if (progress === 78) {
                statusTitle.textContent = "Generating metric suggestions...";
                statusDesc.textContent = "Rewriting active experiences into quantitative achievements.";
            }
        }
    }, 400);

    const formData = new FormData();
    formData.append('resume', selectedFile);
    
    const jd = jobDescriptionInput.value.trim();
    if (jd) {
        formData.append('job_description', jd);
    }
    
    try {
        const response = await fetch(`${API_BASE}/score-resume`, {
            method: 'POST',
            body: formData
        });
        
        clearInterval(interval);
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to analyze resume.');
        }
        
        progress = 95;
        progressBarFill.style.width = `${progress}%`;
        statusTitle.textContent = "Finalizing calculations...";
        statusDesc.textContent = "Loading scores dashboard.";
        
        analysisData = await response.json();
        
        setTimeout(() => {
            progressBarFill.style.width = "100%";
            renderDashboard(analysisData);
        }, 800);
        
    } catch (error) {
        clearInterval(interval);
        console.error("Analysis failed:", error);
        showLumiAlert("An error occurred during resume analysis: " + error.message);
        
        // Reset status
        analysisStatus.classList.add('hidden');
        analyzeBtn.classList.remove('disabled');
        analyzeBtn.removeAttribute('disabled');
        sampleBtn.classList.remove('disabled');
        sampleBtn.removeAttribute('disabled');
        if (document.getElementById('removeFileBtn')) {
            document.getElementById('removeFileBtn').classList.remove('disabled');
            document.getElementById('removeFileBtn').removeAttribute('disabled');
        }
    }
}

// Simulated High-End Sample Analysis for Instant Wow-Factor
function trySampleAnalysis() {
    analyzeBtn.classList.add('disabled');
    analyzeBtn.setAttribute('disabled', 'true');
    sampleBtn.classList.add('disabled');
    sampleBtn.setAttribute('disabled', 'true');
    
    analysisStatus.classList.remove('hidden');
    
    let progress = 10;
    progressBarFill.style.width = `${progress}%`;
    statusTitle.textContent = "Loading sample resume file...";
    statusDesc.textContent = "Pre-loading: 'Alex_Mercer_FullStack_Engineer.pdf'";
    
    const interval = setInterval(() => {
        progress += 10;
        progressBarFill.style.width = `${progress}%`;
        
        if (progress === 30) {
            statusTitle.textContent = "Extracting details...";
            statusDesc.textContent = "Extracted: BS Computer Science, 5+ yrs experience, React, Node, Python, AWS.";
        } else if (progress === 50) {
            statusTitle.textContent = "Sending to Gemini Flash model...";
            statusDesc.textContent = "Scoring formatting, ATS visibility, and achievement metrics.";
        } else if (progress === 70) {
            statusTitle.textContent = "Detecting standard keyword matches...";
            statusDesc.textContent = "Keywords parsed against Senior Engineer benchmarks.";
        } else if (progress === 90) {
            statusTitle.textContent = "Optimizing bullet descriptions...";
            statusDesc.textContent = "Synthesizing metric suggestions.";
        } else if (progress >= 100) {
            clearInterval(interval);
            
            // Sample developer data
            const sampleData = {
                overall_score: 79,
                formatting_score: 90,
                keyword_score: 72,
                skills_score: 82,
                impact_score: 68,
                rating: "Good",
                executive_summary: "Strong Full-Stack Engineer resume with a clean layout and an excellent balance of technical skills. The professional experience sections are highly detailed, but they lack sufficient quantitative metrics (such as percentages, dollars, or time saved) which are essential for showing the direct business impact of your engineering work. Keywords are well-integrated, though a few standard deployment and testing skills are missing.",
                strengths: [
                    "Excellent technical skills structure with separate sections for Languages, Frameworks, and Tools.",
                    "Clean, professional chronological layout that is highly readable for ATS parsers.",
                    "Active, strong action verbs used at the start of each bullet point (e.g., 'Designed', 'Architected', 'Implemented').",
                    "Strong educational background and relevant certification details clearly marked."
                ],
                improvements: [
                    "Several project descriptions are listed as tasks ('Responsible for maintaining APIs') rather than accomplishments with business metrics.",
                    "Lacks clear indicator of testing methodologies (e.g., Jest, Cypress, TDD) which are vital for a senior level role.",
                    "No mention of CI/CD pipeline ownership or orchestration details beyond 'using git'.",
                    "Summary section is a bit generic; replace it with a profile that highlights specific scales managed."
                ],
                found_keywords: [
                    "React.js", "Node.js", "Python", "JavaScript", "REST APIs", "AWS (EC2/S3)", "Docker", "SQL", "Git", "Agile", "TypeScript", "Redux", "PostgreSQL", "NoSQL"
                ],
                missing_keywords: [
                    "CI/CD (Jenkins/GitHub Actions)", "TDD / Unit Testing", "Kubernetes", "GraphQL", "Microservices", "System Design", "Cypress", "Elasticsearch", "Performance Optimization"
                ],
                bullet_suggestions: [
                    {
                        original: "Worked on building new features for our primary SaaS dashboard using React and Redux.",
                        enhanced: "Architected and delivered 12+ high-impact dashboard widgets using React/Redux, reducing page load latency by 32% and increasing daily active user engagement by 18%.",
                        impact: "Reduced Latency & Boosted Engagement"
                    },
                    {
                        original: "Responsible for writing backend API endpoints in Node.js and connecting them to a PostgreSQL database.",
                        enhanced: "Designed and optimized 45+ Node.js REST endpoints, rewriting complex SQL queries to decrease DB query response times by 40% under peak loads.",
                        impact: "40% Faster Query Speed"
                    },
                    {
                        original: "Maintained cloud resources on AWS and helped with the team containerization using Docker.",
                        enhanced: "Orchestrated Docker containers across AWS EC2 instances, implementing auto-scaling policies that improved system uptime to 99.98% and cut hosting bills by $1,200/month.",
                        impact: "$14.4k Annual Cost Savings"
                    }
                ],
                formatting_insights: [
                    {
                        category: "Font Readability",
                        status: "success",
                        message: "Excellent choice of professional sans-serif fonts. Standard modern spacing makes it highly parsable for both machines and recruiters."
                    },
                    {
                        category: "Document Length",
                        status: "success",
                        message: "Optimal length. The resume fits perfectly on 2 pages, which is ideal for an engineer with 5 years of active professional tenure."
                    },
                    {
                        category: "Contact Details",
                        status: "warning",
                        message: "Phone and email are present, but your GitHub and LinkedIn URLs are missing hyperlinked anchors. Ensure these are clickable."
                    },
                    {
                        category: "Section Headings",
                        status: "success",
                        message: "Clear chronological headings. Standard naming conventions ('Education', 'Experience', 'Skills') allow ATS tools to categorize content easily."
                    }
                ]
            };
            
            // Add job alignment if a job description is filled
            const jdVal = jobDescriptionInput.value.trim();
            if (jdVal) {
                sampleData.jd_alignment = {
                    score: 75,
                    description: "The resume shows high technical overlap for standard frontend and backend demands but is missing key architecture and CI/CD tools requested in the description."
                };
            }
            
            renderDashboard(sampleData);
        }
    }, 150);
}

// Render values into dashboard components
function renderDashboard(data) {
    // Transition sections
    heroSection.style.display = 'none';
    uploadSection.style.display = 'none';
    resultsSection.classList.remove('hidden');
    
    // Smooth scroll to top of main results
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Set Overall Score
    document.getElementById('overallScoreNum').textContent = data.overall_score;
    
    // Animate Circular Gauge
    const fillCircle = document.getElementById('gaugeScoreFill');
    const radius = fillCircle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius; // 251.2
    const offset = circumference - (data.overall_score / 100) * circumference;
    
    // Reset and apply transition
    fillCircle.style.strokeDasharray = `${circumference}`;
    fillCircle.style.strokeDashoffset = `${circumference}`;
    
    // Dynamically inject color depending on score
    let strokeColor = '#EF4444'; // Red default
    let scoreRatingClass = 'rating-poor';
    
    if (data.overall_score >= 85) {
        strokeColor = '#10B981'; // Green
        scoreRatingClass = 'rating-excellent';
    } else if (data.overall_score >= 70) {
        strokeColor = '#3B82F6'; // Blue
        scoreRatingClass = 'rating-good';
    } else if (data.overall_score >= 50) {
        strokeColor = '#F59E0B'; // Orange
        scoreRatingClass = 'rating-fair';
    }
    
    // Dynamically set stroke
    fillCircle.style.stroke = strokeColor;
    
    setTimeout(() => {
        fillCircle.style.strokeDashoffset = offset;
    }, 100);
    
    // Set rating badge
    const badge = document.getElementById('scoreRatingBadge');
    badge.textContent = data.rating;
    badge.className = `score-badge ${scoreRatingClass}`;
    
    // Set sub-scores
    document.getElementById('formatScoreText').textContent = `${data.formatting_score}/100`;
    document.getElementById('formatScoreFill').style.width = `${data.formatting_score}%`;
    document.getElementById('formatScoreFill').style.backgroundColor = getScoreColor(data.formatting_score);
    
    document.getElementById('keywordScoreText').textContent = `${data.keyword_score}/100`;
    document.getElementById('keywordScoreFill').style.width = `${data.keyword_score}%`;
    document.getElementById('keywordScoreFill').style.backgroundColor = getScoreColor(data.keyword_score);
    
    document.getElementById('skillsScoreText').textContent = `${data.skills_score}/100`;
    document.getElementById('skillsScoreFill').style.width = `${data.skills_score}%`;
    document.getElementById('skillsScoreFill').style.backgroundColor = getScoreColor(data.skills_score);
    
    document.getElementById('impactScoreText').textContent = `${data.impact_score}/100`;
    document.getElementById('impactScoreFill').style.width = `${data.impact_score}%`;
    document.getElementById('impactScoreFill').style.backgroundColor = getScoreColor(data.impact_score);
    
    // Job Description Alignment Score Card
    const jdScoreCard = document.getElementById('jdScoreCard');
    if (data.jd_alignment) {
        jdScoreCard.classList.remove('hidden');
        document.getElementById('jdScoreVal').textContent = `${data.jd_alignment.score}%`;
        document.getElementById('jdScoreDesc').textContent = data.jd_alignment.description;
    } else {
        jdScoreCard.classList.add('hidden');
    }
    
    // Tab 1: Overview
    document.getElementById('executiveSummary').textContent = data.executive_summary;
    
    const strengthsList = document.getElementById('strengthsList');
    strengthsList.innerHTML = '';
    data.strengths.forEach(str => {
        const li = document.createElement('li');
        li.textContent = str;
        strengthsList.appendChild(li);
    });
    
    const improvementsList = document.getElementById('improvementsList');
    improvementsList.innerHTML = '';
    data.improvements.forEach(imp => {
        const li = document.createElement('li');
        li.textContent = imp;
        improvementsList.appendChild(li);
    });
    
    // Tab 2: Keywords
    const foundKeywordsContainer = document.getElementById('foundKeywordsContainer');
    foundKeywordsContainer.innerHTML = '';
    if (data.found_keywords && data.found_keywords.length > 0) {
        data.found_keywords.forEach(kw => {
            const span = document.createElement('span');
            span.className = 'kw-chip found';
            span.textContent = kw;
            foundKeywordsContainer.appendChild(span);
        });
    } else {
        foundKeywordsContainer.innerHTML = `<span style="font-size: 13px; color: var(--text-muted);">No technical skills detected yet. Try adding explicit keywords in a dedicated skills list.</span>`;
    }
    
    const missingKeywordsContainer = document.getElementById('missingKeywordsContainer');
    missingKeywordsContainer.innerHTML = '';
    if (data.missing_keywords && data.missing_keywords.length > 0) {
        data.missing_keywords.forEach(kw => {
            const span = document.createElement('span');
            span.className = 'kw-chip missing';
            span.textContent = `+ ${kw}`;
            missingKeywordsContainer.appendChild(span);
        });
    } else {
        missingKeywordsContainer.innerHTML = `<span style="font-size: 13px; color: var(--color-accent);">Amazing! No major keyword gaps found. Your resume aligns well with standard requirements.</span>`;
    }
    
    // Tab 3: Bullets SUGGESTIONS
    const bulletsContainer = document.getElementById('bulletsContainer');
    bulletsContainer.innerHTML = '';
    if (data.bullet_suggestions && data.bullet_suggestions.length > 0) {
        data.bullet_suggestions.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bullet-card';
            card.innerHTML = `
                <div class="bullet-side left">
                    <span class="bullet-side-lbl original">Original Statement</span>
                    <p class="bullet-txt original">"${esc(item.original)}"</p>
                </div>
                <div class="bullet-side right">
                    <span class="bullet-side-lbl enhanced">AI Metric-Driven Recommendation</span>
                    <p class="bullet-txt enhanced">"${esc(item.enhanced)}"</p>
                    <span class="impact-badge">${esc(item.impact)}</span>
                </div>
            `;
            bulletsContainer.appendChild(card);
        });
    } else {
        bulletsContainer.innerHTML = `<div class="bullet-loading" style="padding:20px;">No generic experiences detected. Your bullet points already seem to have solid active vocabulary.</div>`;
    }
    
    // Tab 4: Formatting Insights
    const formattingGrid = document.getElementById('formattingGrid');
    formattingGrid.innerHTML = '';
    if (data.formatting_insights && data.formatting_insights.length > 0) {
        data.formatting_insights.forEach(item => {
            let statusIcon = '';
            if (item.status === 'success') {
                statusIcon = `
                    <div class="format-status-icon success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>`;
            } else if (item.status === 'warning') {
                statusIcon = `
                    <div class="format-status-icon warning">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>`;
            } else {
                statusIcon = `
                    <div class="format-status-icon danger">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>`;
            }
            
            const card = document.createElement('div');
            card.className = 'format-card';
            card.innerHTML = `
                ${statusIcon}
                <div class="format-info">
                    <h4>${esc(item.category)}</h4>
                    <p>${esc(item.message)}</p>
                </div>
            `;
            formattingGrid.appendChild(card);
        });
    } else {
        formattingGrid.innerHTML = `<div class="bullet-loading">No structural layout advice generated.</div>`;
    }
}

// Reset view back to upload state
function resetToUploadState() {
    resultsSection.classList.add('hidden');
    heroSection.style.display = 'block';
    uploadSection.style.display = 'block';
    
    // Reset inputs & buttons
    analyzeBtn.classList.remove('disabled');
    analyzeBtn.removeAttribute('disabled');
    sampleBtn.classList.remove('disabled');
    sampleBtn.removeAttribute('disabled');
    
    analysisStatus.classList.add('hidden');
    progressBarFill.style.width = "0%";
    
    resetDropZone();
    
    // Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Helper colors for progress bars
function getScoreColor(score) {
    if (score >= 85) return '#10B981'; // Green
    if (score >= 70) return '#3B82F6'; // Blue
    if (score >= 50) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
}

// String escape helper
function esc(s) {
    if (!s) return "";
    return s.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
