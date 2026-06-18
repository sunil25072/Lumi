/* ==========================================================================
   AI Analytics Dashboard — analytics.js
   Dynamic File Parsing, Chart.js Visualization, and Gemini AI Analysis
   ========================================================================== */

'use strict';

const API_BASE = 'http://localhost:5001/api';

// State
let parsedDataset = null; // Holds the parsed data, columns, and statistical summary
let analysisResults = null; // Holds the JSON output from Gemini AI
let activeCharts = []; // Tracks Chart.js instances to destroy them before re-render

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const sampleBtn = document.getElementById('sampleBtn');
const reanalyzeBtn = document.getElementById('reanalyzeBtn');
const downloadReportBtn = document.getElementById('downloadReportBtn');

const heroSection = document.getElementById('heroSection');
const uploadSection = document.getElementById('uploadSection');
const resultsSection = document.getElementById('resultsSection');
const previewSection = document.getElementById('previewSection');

const analysisStatus = document.getElementById('analysisStatus');
const progressBarFill = document.getElementById('progressBarFill');
const statusTitle = document.getElementById('statusTitle');
const statusDesc = document.getElementById('statusDesc');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

/* ── EVENT BINDINGS ─────────────────────────────────────────────────────── */

// File input triggers
if (selectFileBtn && fileInput) {
    selectFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
}

if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag & Drop
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
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files[0]);
    });
}

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', startAIAnalysis);
}

if (sampleBtn) {
    sampleBtn.addEventListener('click', loadSampleDataset);
}

if (reanalyzeBtn) {
    reanalyzeBtn.addEventListener('click', resetToUploadState);
}

if (downloadReportBtn) {
    downloadReportBtn.addEventListener('click', downloadExecutiveReport);
}

// Tabs Switch Handler
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
            if (pane.id === `pane-${targetTab}`) {
                pane.classList.add('active');
            }
        });
    });
});

/* ── FILE HANDLING & PARSING ────────────────────────────────────────────── */

function handleFileSelection(file) {
    if (!file) return;
    
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
        alert('Unsupported file type. Please upload a CSV or Excel file.');
        return;
    }
    
    // Check file size (15MB cap)
    if (file.size > 15 * 1024 * 1024) {
        alert('File size exceeds the 15MB limit.');
        return;
    }
    
    const reader = new FileReader();
    
    // Show quick loader text
    const content = dropZone.querySelector('.drop-zone-content');
    content.innerHTML = `
        <div class="loader-spinner" style="margin: 0 auto 15px;"></div>
        <h3>Parsing dataset file...</h3>
        <p class="file-types">Reading data dimensions and columns.</p>
    `;
    
    if (ext === 'csv') {
        reader.onload = function(e) {
            parseCSVData(e.target.result, file.name, file.size);
        };
        reader.readAsText(file);
    } else {
        reader.onload = function(e) {
            parseExcelData(e.target.result, file.name, file.size);
        };
        reader.readAsArrayBuffer(file);
    }
}

// Parse CSV using PapaParse (or fall back to manual split)
function parseCSVData(text, filename, filesize) {
    try {
        if (typeof Papa !== 'undefined') {
            Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processParsedData(results.data, filename, filesize);
                },
                error: function(err) {
                    throw new Error(err.message);
                }
            });
        } else {
            // Fallback manual CSV parser
            console.warn("PapaParse not loaded, running fallback CSV parser");
            const lines = text.split('\n');
            if (lines.length < 2) throw new Error("Dataset is empty or too short");
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = line.split(',');
                const row = {};
                headers.forEach((h, index) => {
                    let val = values[index] !== undefined ? values[index].trim() : null;
                    if (val !== null) {
                        val = val.replace(/^["']|["']$/g, '');
                        // Infer simple number types
                        if (!isNaN(val) && val !== '') {
                            val = Number(val);
                        }
                    }
                    row[h] = val;
                });
                data.push(row);
            }
            processParsedData(data, filename, filesize);
        }
    } catch (error) {
        console.error("CSV Parse error:", error);
        alert("Failed to parse CSV file: " + error.message);
        resetDropZone();
    }
}

// Parse Excel using SheetJS (XLSX)
function parseExcelData(arrayBuffer, filename, filesize) {
    try {
        if (typeof XLSX === 'undefined') {
            throw new Error("Excel parsing engine (SheetJS) is unavailable. Please check internet connection or load a CSV instead.");
        }
        
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Take the first sheet name
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to json
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        processParsedData(jsonData, filename, filesize);
        
    } catch (error) {
        console.error("Excel Parse error:", error);
        alert("Failed to parse Excel file: " + error.message);
        resetDropZone();
    }
}

// Process parsed rows, calculate descriptive metadata, and show client-side preview
function processParsedData(rows, filename, filesize) {
    if (!rows || rows.length === 0) {
        alert("Dataset appears to be empty.");
        resetDropZone();
        return;
    }
    
    // 1. Identify columns (headers)
    const columns = Object.keys(rows[0]);
    const rowCount = rows.length;
    
    // 2. Infer column data types and collect descriptions
    const columnStats = [];
    const inferredSchema = {};
    
    columns.forEach(col => {
        // Sample values to detect data types
        let numericCount = 0;
        let nullCount = 0;
        let stringCount = 0;
        let dateCount = 0;
        
        const nonNullValues = [];
        
        rows.forEach(row => {
            const val = row[col];
            if (val === null || val === undefined || val === '') {
                nullCount++;
            } else {
                nonNullValues.push(val);
                if (typeof val === 'number') {
                    numericCount++;
                } else {
                    stringCount++;
                    // Basic date regex test
                    if (isNaN(val) && !isNaN(Date.parse(val))) {
                        dateCount++;
                    }
                }
            }
        });
        
        let type = 'String';
        if (numericCount > nonNullValues.length * 0.7) {
            type = 'Numeric';
        } else if (dateCount > nonNullValues.length * 0.7) {
            type = 'Date';
        }
        
        inferredSchema[col] = type;
        
        // Descriptive stats
        const stats = {
            name: col,
            type: type,
            missing: nullCount,
            missingPercentage: Math.round((nullCount / rowCount) * 100)
        };
        
        if (type === 'Numeric') {
            const numbers = nonNullValues.filter(v => typeof v === 'number').map(Number);
            if (numbers.length > 0) {
                stats.min = Math.min(...numbers);
                stats.max = Math.max(...numbers);
                stats.mean = Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100;
            }
        } else {
            // Count unique classes
            const uniqueVals = new Set(nonNullValues.map(v => v.toString()));
            stats.uniqueCount = uniqueVals.size;
            
            // Collect frequencies
            const freqs = {};
            nonNullValues.forEach(v => {
                const s = v.toString();
                freqs[s] = (freqs[s] || 0) + 1;
            });
            
            const sortedClasses = Object.entries(freqs).sort((a, b) => b[1] - a[1]);
            if (sortedClasses.length > 0) {
                stats.topCategory = sortedClasses[0][0];
                stats.topCategoryFreq = sortedClasses[0][1];
            }
        }
        
        columnStats.push(stats);
    });
    
    // Store parsed dataset state
    parsedDataset = {
        filename: filename,
        filesize: filesize,
        rowCount: rowCount,
        columnCount: columns.length,
        columns: columns,
        schema: inferredSchema,
        stats: columnStats,
        sample: rows.slice(0, 100), // Top 100 rows for AI context
        previewRows: rows.slice(0, 5) // Top 5 rows for HTML UI table preview
    };
    
    renderDropZoneSuccess(filename, filesize);
    renderTablePreview();
}

function renderDropZoneSuccess(filename, filesize) {
    const kb = Math.round((filesize / 1024) * 10) / 10;
    const mb = Math.round((kb / 1024) * 100) / 100;
    const displaySize = mb > 1 ? `${mb} MB` : `${kb} KB`;
    
    const content = dropZone.querySelector('.drop-zone-content');
    content.innerHTML = `
        <div class="upload-icon-wrapper" style="color: var(--color-accent); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05);">
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <h3 style="color: var(--text-primary);">${esc(filename)}</h3>
        <p class="file-types" style="color: var(--color-accent); font-weight: 500;">Dataset parsed successfully · ${displaySize}</p>
        <button class="btn btn-secondary select-btn" id="removeFileBtn" style="margin-top:12px;">Remove Dataset</button>
    `;
    
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
    parsedDataset = null;
    analysisResults = null;
    
    if (analyzeBtn) {
        analyzeBtn.classList.add('disabled');
        analyzeBtn.setAttribute('disabled', 'true');
    }
    
    const content = dropZone.querySelector('.drop-zone-content');
    if (content) {
        content.innerHTML = `
            <div class="upload-icon-wrapper">
                <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
            </div>
            <h3>Drag & drop Excel or CSV</h3>
            <p class="file-types">Supports .csv, .xlsx, .xls formats (Max 15MB)</p>
            <button class="btn btn-secondary select-btn" id="selectFileBtn">Browse Files</button>
        `;
        
        const selectBtn = document.getElementById('selectFileBtn');
        if (selectBtn) {
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }
    }
    
    if (fileInput) fileInput.value = '';
    if (previewSection) previewSection.classList.add('hidden');
}

// Render data preview metadata boxes and top 5 rows table
function renderTablePreview() {
    if (!parsedDataset) return;
    
    previewSection.classList.remove('hidden');
    
    // Set metadata cards
    document.getElementById('metaRows').textContent = parsedDataset.rowCount.toLocaleString();
    document.getElementById('metaCols').textContent = parsedDataset.columnCount.toLocaleString();
    
    // Inferred categorical count vs numeric
    let numeric = 0;
    let category = 0;
    Object.values(parsedDataset.schema).forEach(v => {
        if (v === 'Numeric') numeric++;
        else category++;
    });
    document.getElementById('metaTypes').textContent = `${numeric} Num, ${category} Str`;
    
    // Generate preview table HTML
    const tableHeader = document.getElementById('previewTableHeader');
    const tableBody = document.getElementById('previewTableBody');
    
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Render table headers with visual icons representing numeric vs string
    parsedDataset.columns.forEach(col => {
        const type = parsedDataset.schema[col];
        const typeIcon = type === 'Numeric' ? '🔢' : type === 'Date' ? '📅' : '🔤';
        
        const th = document.createElement('th');
        th.innerHTML = `<span style="font-size:11px; margin-right:4px;">${typeIcon}</span>${esc(col)}`;
        tableHeader.appendChild(th);
    });
    
    // Render 5 preview rows
    parsedDataset.previewRows.forEach(row => {
        const tr = document.createElement('tr');
        parsedDataset.columns.forEach(col => {
            const td = document.createElement('td');
            const val = row[col];
            td.textContent = val !== null && val !== undefined ? val.toString() : 'null';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

/* ── AI ANALYTICS SERVICE CALL ──────────────────────────────────────────── */

async function startAIAnalysis() {
    if (!parsedDataset) return;
    
    // Disable UI inputs
    analyzeBtn.classList.add('disabled');
    analyzeBtn.setAttribute('disabled', 'true');
    sampleBtn.classList.add('disabled');
    sampleBtn.setAttribute('disabled', 'true');
    if (document.getElementById('removeFileBtn')) {
        document.getElementById('removeFileBtn').classList.add('disabled');
        document.getElementById('removeFileBtn').setAttribute('disabled', 'true');
    }
    
    analysisStatus.classList.remove('hidden');
    
    // Progress bar animations
    let progress = 10;
    progressBarFill.style.width = `${progress}%`;
    statusTitle.textContent = "Scanning Column Metadata & Schema...";
    statusDesc.textContent = "Evaluating database types, missing rows, and statistical spreads.";
    
    const interval = setInterval(() => {
        if (progress < 40) {
            progress += 5;
            progressBarFill.style.width = `${progress}%`;
        } else if (progress === 40) {
            statusTitle.textContent = "Constructing Analytical Prompts...";
            statusDesc.textContent = "Sending schema summary, aggregates, and 100 data records to Gemini API.";
            progress += 5;
            progressBarFill.style.width = `${progress}%`;
        } else if (progress < 85) {
            progress += 2;
            progressBarFill.style.width = `${progress}%`;
            if (progress === 60) {
                statusTitle.textContent = "Inferring Mathematical Correlations...";
                statusDesc.textContent = "AI model calculating correlations, dynamic KPIs, and trend segments.";
            } else if (progress === 76) {
                statusTitle.textContent = "Generating Predictive Trends...";
                statusDesc.textContent = "Gemini computing chart visual configurations and executive forecasting.";
            }
        }
    }, 450);
    
    // Construct summarized statistical payload to avoid high-token limits
    const payload = {
        filename: parsedDataset.filename,
        rowCount: parsedDataset.rowCount,
        columnCount: parsedDataset.columnCount,
        schema: parsedDataset.schema,
        stats: parsedDataset.stats,
        sample: parsedDataset.sample
    };
    
    try {
        const response = await fetch(`${API_BASE}/analyze-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        clearInterval(interval);
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'AI analytics service encountered an error.');
        }
        
        progress = 95;
        progressBarFill.style.width = `${progress}%`;
        statusTitle.textContent = "Finalizing calculations...";
        statusDesc.textContent = "Assembling the glassmorphic dashboards.";
        
        analysisResults = await response.json();
        
        setTimeout(() => {
            progressBarFill.style.width = "100%";
            renderAnalyticsDashboard(analysisResults);
        }, 800);
        
    } catch (error) {
        clearInterval(interval);
        console.error("AI Analysis failed:", error);
        alert("An error occurred during AI analysis: " + error.message);
        
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

/* ── PRE-LOADED SAMPLE DATASET FOR WOW-FACTOR ────────────────────────────── */

function loadSampleDataset() {
    analyzeBtn.classList.add('disabled');
    analyzeBtn.setAttribute('disabled', 'true');
    sampleBtn.classList.add('disabled');
    sampleBtn.setAttribute('disabled', 'true');
    
    analysisStatus.classList.remove('hidden');
    
    let progress = 10;
    progressBarFill.style.width = `${progress}%`;
    statusTitle.textContent = "Pre-loading: 'SaaS_Q1_Revenue_Metrics.xlsx'...";
    statusDesc.textContent = "Fetching pre-analyzed SaaS revenues, subscriber metrics, and churn lists.";
    
    const interval = setInterval(() => {
        progress += 10;
        progressBarFill.style.width = `${progress}%`;
        
        if (progress === 30) {
            statusTitle.textContent = "Processing column schema...";
            statusDesc.textContent = "Parsed schema: Date (📅), Subscription_Type (🔤), Active_Users (🔢), MRR_USD (🔢), Churn_Rate (🔢).";
        } else if (progress === 50) {
            statusTitle.textContent = "Consulting Gemini AI Model...";
            statusDesc.textContent = "Generating interactive financial graphs and SaaS forecasting models.";
        } else if (progress === 70) {
            statusTitle.textContent = "Structuring KPI metrics cards...";
            statusDesc.textContent = "Computing gross margins, average order value, and subscription segments.";
        } else if (progress === 90) {
            statusTitle.textContent = "Assembling trends and observations...";
            statusDesc.textContent = "Formulating Q2 forecasting and anomaly observation lists.";
        } else if (progress >= 100) {
            clearInterval(interval);
            
            // Gorgeous premium SaaS sample report
            const sampleAIResults = {
                kpi_metrics: [
                    { label: "Total Revenue (Q1)", value: "$248,500", change: "+14.2%", positive: true, context: "vs last quarter" },
                    { label: "Active Subscribers", value: "8,450", change: "+8.5%", positive: true, context: "Net new: 660 accounts" },
                    { label: "Gross Churn Rate", value: "2.1%", change: "-0.4%", positive: true, context: "Record low retention risk" },
                    { label: "Avg. Customer Life (LTV)", value: "$1,820", change: "+12.1%", positive: true, context: "ARPU is rising steadily" }
                ],
                charts: [
                    {
                        type: "line",
                        title: "Subscribers & MRR Revenue Growth Trend (Q1)",
                        labels: ["Jan", "Feb", "Mar", "Apr", "May (Proj)", "Jun (Proj)"],
                        datasets: [
                            { label: "Revenue (MRR in USD)", data: [55000, 62000, 69000, 78000, 84000, 91000] },
                            { label: "Active Users (x10 scale)", data: [42000, 48000, 55000, 63000, 71000, 80000] }
                        ]
                    },
                    {
                        type: "bar",
                        title: "Revenue by Subscription Segment (in USD)",
                        labels: ["Starter Plan", "Growth Plan", "Scale Plan", "Enterprise Suite"],
                        datasets: [
                            { label: "Q1 Sales", data: [42500, 85000, 72000, 49000] }
                        ]
                    },
                    {
                        type: "doughnut",
                        title: "Acquisition Channel Share",
                        labels: ["Organic Search", "Paid Ads", "Referrals", "Direct Traffic", "Events/PR"],
                        datasets: [
                            { label: "Acquisitions", data: [35, 25, 20, 12, 8] }
                        ]
                    },
                    {
                        type: "radar",
                        title: "Performance Ratings by Dimension",
                        labels: ["Support Speed", "Feature Depth", "System Uptime", "UX Design", "Integrations", "Cost Value"],
                        datasets: [
                            { label: "Premium Tier Rating", data: [88, 75, 99, 90, 82, 85] }
                        ]
                    }
                ],
                insights: [
                    {
                        category: "success",
                        level: "success",
                        title: "Accelerating Enterprise Revenue Velocity",
                        description: "Enterprise tier accounts saw a 28% increase in subscription upgrades this quarter, despite comprising only 6% of total subscriber count. They contribute over 19% of absolute Q1 revenues, confirming an ideal upmarket product alignment."
                    },
                    {
                        category: "warning",
                        level: "warning",
                        title: "Paid Channel CAC Inflation Detected",
                        description: "Paid Acquisition CAC (Customer Acquisition Cost) spiked by 18.4% in February/March due to increased bidding competition on primary search keywords. This compressed startup margins, suggesting a needed shift towards Organic and SEO-driven referral loops."
                    },
                    {
                        category: "danger",
                        level: "danger",
                        title: "Starter Plan Churn Concentration",
                        description: "Over 82% of all registered subscriber churn is heavily concentrated in the 'Starter Plan' ($19/mo) within the first 14 days of activation. This points to a significant onboarding friction point, potentially related to complex feature configuration or lack of clear tutorial walkthroughs."
                    },
                    {
                        category: "info",
                        level: "info",
                        title: "Highly Positive System Reliability Corelation",
                        description: "Our statistical model indicates a very strong positive correlation (R = 0.89) between 'Weekly Active Hours' and 'API Integrations Active'. Users with more than 3 third-party integrations activated have a near-zero churn coefficient."
                    }
                ],
                trends: [
                    {
                        title: "Q2 Predictive Growth Forecast",
                        impact: "positive",
                        description: "Extrapolating Q1 growth vectors, gross MRR is highly projected to reach $91,000 by June, representing a 22.3% semester-over-semester expansion. Active subscribers will likely break past the 9,500 account boundary if the current Organic search trend is sustained."
                    },
                    {
                        title: "Seasonality Conversion Dip",
                        impact: "neutral",
                        description: "Analysis of historical cohorts shows a recurring 5% contraction in new web conversions during late May due to global corporate summer schedules. We advise allocating ad budgets towards early May to pre-emptively capture Q2 pipeline value."
                    },
                    {
                        title: "LTV Expansion Vector",
                        impact: "positive",
                        description: "LTV expands steadily as customers adopt secondary integrations. Up-selling database sync modules can boost account MRR by an average of 14% without customer friction, yielding a major opportunity for expansion revenue."
                    }
                ],
                executive_summary: "# AI Executive SaaS Report (Q1)\n\n### Strategic Overview\nThis dataset profiles Q1 business performance, financial telemetry, and customer subscription dynamics. **Q1 closed with impressive absolute expansion**, achieving a gross Q1 Revenue of **$248,500** (+14.2% QoQ) and driving Active Subscribers to **8,450**. System reliability, customer satisfaction (LTV at $1,820), and low retention churn (2.1%) represent excellent performance metrics across all benchmarks.\n\n### Key Revenue Drivers\n- **Upmarket Momentum:** The Enterprise Suite accounts grew by 28%, expanding their share to 19% of absolute Q1 revenues.\n- **Channel Strength:** Organic Search remains the highest-yielding acquisition channel (35% share), indicating robust product-led growth (PLG) dynamics.\n\n### Tactical Risks & Growth Recommendations\n1. **Optimize Onboarding friction:** Focus engineering resources on the first 14 days of the *Starter Plan*. Introducing progressive onboarding guides can reduce churn concentration by a projected 15-20%.\n2. **Stabilize paid CAC:** Restructure search marketing bids to emphasize high-relevance niche keywords, balancing customer acquisition costs. \n3. **Monetize Integration Add-ons:** Introduce micro-fees or specialized add-ons for the most popular API integrations to secure massive low-friction expansion revenue."
            };
            
            renderAnalyticsDashboard(sampleAIResults);
        }
    }, 120);
}

/* ── DASHBOARD RENDERING ────────────────────────────────────────────────── */

function renderAnalyticsDashboard(data) {
    // Transition sections
    heroSection.style.display = 'none';
    uploadSection.style.display = 'none';
    previewSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    
    // Smooth scroll to top of main results
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 1. Set KPI Cards
    const kpiContainer = document.getElementById('kpiContainer');
    kpiContainer.innerHTML = '';
    
    data.kpi_metrics.forEach((kpi, idx) => {
        const card = document.createElement('div');
        // Vary designs with CSS gradients
        let themeClass = "";
        let iconMarkup = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>
            </svg>`;
        
        if (idx === 1) themeClass = "kpi-accent";
        else if (idx === 2) {
            themeClass = "kpi-warning";
            iconMarkup = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>
                </svg>`;
        }
        
        const trendClass = kpi.positive ? 'positive' : 'negative';
        const trendSymbol = kpi.positive ? '▲' : '▼';
        
        card.className = `glass-card kpi-card ${themeClass}`;
        card.innerHTML = `
            <div class="kpi-header">
                <span>${esc(kpi.label)}</span>
                <div class="kpi-icon-wrap">${iconMarkup}</div>
            </div>
            <div class="kpi-value">${esc(kpi.value)}</div>
            <div class="kpi-footer">
                <span class="kpi-trend ${trendClass}">${trendSymbol} ${esc(kpi.change)}</span>
                <span class="kpi-context">${esc(kpi.context)}</span>
            </div>
        `;
        kpiContainer.appendChild(card);
    });
    
    // 2. Render Dynamic Charts via Chart.js
    renderCharts(data.charts);
    
    // 3. Tab 1: Executive Summary
    document.getElementById('executiveSummary').textContent = data.executive_summary ? data.executive_summary.replace(/^[#\s*-_]+/gm, '').split('\n\n')[0] : 'Analysis complete.';
    
    // Load full report markdown
    const reportMarkdown = document.getElementById('reportMarkdown');
    if (data.executive_summary) {
        reportMarkdown.innerHTML = renderMarkdown(data.executive_summary);
    } else {
        reportMarkdown.innerHTML = "<p>No full report generated.</p>";
    }
    
    // 4. Tab 2: Insight Stream
    const insightsFeed = document.getElementById('insightsFeed');
    insightsFeed.innerHTML = '';
    
    if (data.insights && data.insights.length > 0) {
        data.insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = 'insight-card';
            
            let badgeClass = insight.level || 'info';
            let badgeText = insight.level ? insight.level.toUpperCase() : 'INFO';
            
            card.innerHTML = `
                <div class="insight-badge ${badgeClass}">${badgeText}</div>
                <div class="insight-content">
                    <h4>${esc(insight.title)}</h4>
                    <p>${esc(insight.description)}</p>
                </div>
            `;
            insightsFeed.appendChild(card);
        });
    } else {
        insightsFeed.innerHTML = `<p style="color:var(--text-muted);">No observations detected.</p>`;
    }
    
    // 5. Tab 3: Trends & Forecasting
    const trendsContainer = document.getElementById('trendsContainer');
    trendsContainer.innerHTML = '';
    
    if (data.trends && data.trends.length > 0) {
        data.trends.forEach(trend => {
            const card = document.createElement('div');
            card.className = 'trend-card';
            
            const impactClass = trend.impact || 'neutral';
            
            card.innerHTML = `
                <div class="trend-header-row">
                    <h4 class="trend-card-title">${esc(trend.title)}</h4>
                    <span class="trend-impact-badge ${impactClass}">${impactClass.toUpperCase()} IMPACT</span>
                </div>
                <p class="trend-desc">${esc(trend.description)}</p>
            `;
            trendsContainer.appendChild(card);
        });
    } else {
        trendsContainer.innerHTML = `<p style="color:var(--text-muted);">No core trends identified.</p>`;
    }
}

// Destroy previous graphs and render Chart.js items with premium gradients
function renderCharts(chartConfigs) {
    // Destroy previous Chart instances
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
    
    const chartsContainer = document.getElementById('chartsContainer');
    chartsContainer.innerHTML = '';
    
    if (!chartConfigs || chartConfigs.length === 0) {
        chartsContainer.innerHTML = `<div class="chart-card glass-card" style="grid-column: 1/-1; text-align:center; padding:40px;">No visualization generated.</div>`;
        return;
    }
    
    // Premium Harmonious Palettes (Gradients and borders)
    const colorThemes = [
        { fill: 'rgba(99, 102, 241, 0.25)', border: '#6366F1', glow: 'rgba(99, 102, 241, 0.4)' }, // Electric Indigo
        { fill: 'rgba(168, 85, 247, 0.25)', border: '#A855F7', glow: 'rgba(168, 85, 247, 0.4)' }, // Royal Violet
        { fill: 'rgba(16, 185, 129, 0.25)', border: '#10B981', glow: 'rgba(16, 185, 129, 0.4)' }, // Emerald
        { fill: 'rgba(245, 158, 11, 0.25)', border: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)' }, // Amber
        { fill: 'rgba(236, 72, 153, 0.25)', border: '#EC4899', glow: 'rgba(236, 72, 153, 0.4)' }  // Hot Pink
    ];
    
    const pieDoughnutPalette = [
        '#6366F1', '#A855F7', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444'
    ];
    
    chartConfigs.forEach((config, index) => {
        const card = document.createElement('div');
        card.className = 'chart-card glass-card';
        
        const chartId = `dynamicChart_${index}`;
        
        card.innerHTML = `
            <div class="chart-header">
                <h4 class="chart-title">${esc(config.title)}</h4>
            </div>
            <div class="chart-body">
                <canvas id="${chartId}"></canvas>
            </div>
        `;
        chartsContainer.appendChild(card);
        
        const ctx = document.getElementById(chartId).getContext('2d');
        
        // Build datasets mapped with our glowing themes
        let datasets = [];
        
        if (config.type === 'pie' || config.type === 'doughnut') {
            datasets = [{
                label: config.datasets[0].label || 'Share',
                data: config.datasets[0].data,
                backgroundColor: pieDoughnutPalette.slice(0, config.labels.length),
                borderColor: '#151b2e',
                borderWidth: 2
            }];
        } else {
            datasets = config.datasets.map((d, dIdx) => {
                const theme = colorThemes[(index + dIdx) % colorThemes.length];
                
                // Construct a visual gradient for standard fills
                const gradient = ctx.createLinearGradient(0, 0, 0, 240);
                gradient.addColorStop(0, theme.fill);
                gradient.addColorStop(1, 'rgba(21, 27, 46, 0.1)');
                
                return {
                    label: d.label,
                    data: d.data,
                    backgroundColor: config.type === 'bar' ? theme.border : gradient,
                    borderColor: theme.border,
                    borderWidth: 2.5,
                    pointBackgroundColor: theme.border,
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6,
                    tension: config.type === 'line' ? 0.35 : 0,
                    fill: true
                };
            });
        }
        
        // Define highly sleek Dark Mode chart options
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        color: '#94A3B8',
                        font: { family: 'Outfit', size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(7, 9, 19, 0.95)',
                    titleColor: '#F8FAFC',
                    titleFont: { family: 'Outfit', weight: '600' },
                    bodyColor: '#94A3B8',
                    bodyFont: { family: 'Inter' },
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true,
                    cornerRadius: 8
                }
            },
            scales: config.type === 'pie' || config.type === 'doughnut' || config.type === 'radar' ? {} : {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748B',
                        font: { family: 'Inter', size: 11 }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.03)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748B',
                        font: { family: 'Inter', size: 11 },
                        padding: 8
                    }
                }
            }
        };
        
        try {
            const chartInstance = new Chart(ctx, {
                type: config.type,
                data: {
                    labels: config.labels,
                    datasets: datasets
                },
                options: options
            });
            activeCharts.push(chartInstance);
        } catch (chartErr) {
            console.error("Failed to render chart:", config.title, chartErr);
        }
    });
}

function resetToUploadState() {
    resultsSection.classList.add('hidden');
    heroSection.style.display = 'block';
    uploadSection.style.display = 'block';
    
    if (previewSection) previewSection.classList.add('hidden');
    if (analysisStatus) analysisStatus.classList.add('hidden');
    progressBarFill.style.width = "0%";
    
    resetDropZone();
    
    // Destroy charts
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Download executive markdown report as a text file
function downloadExecutiveReport() {
    if (!analysisResults || !analysisResults.executive_summary) return;
    
    const text = analysisResults.executive_summary;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Analytics_Executive_Report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ── HELPERS ────────────────────────────────────────────────────────────── */

function esc(s) {
    if (!s) return "";
    return s.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Simple Markdown parser
function renderMarkdown(text) {
    if (!text) return "";
    
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^\s*# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\s*## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^\s*### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\s*>\s+(.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/^\s*[-•]\s+(.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}
