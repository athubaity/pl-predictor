import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import QRCodeLib from "qrcode";
const h = React.createElement;

// QRCode component using qrcode library
function QRCode({ value, bgColor = "#ffffff", fgColor = "#000000", level = "M", size = 128 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (canvasRef.current && value) {
            QRCodeLib.toCanvas(canvasRef.current, value, {
                color: {
                    dark: fgColor,
                    light: bgColor
                },
                errorCorrectionLevel: level,
                margin: 2,
                width: size,
                height: size
            }).catch(console.error);
        }
    }, [value, bgColor, fgColor, level, size]);
    
    return h("canvas", { 
        ref: canvasRef,
        style: {
            borderRadius: "8px"
        }
    });
}

const VERSION = "14";
const STORAGE_KEY = `pl-predictor-v${VERSION}`;
const THEME_STORAGE_KEY = "pl-predictor-theme";
const DEFAULT_THEME = "dark";
const TIME_ZONE = "Asia/Riyadh";
const DEFAULT_CREST_URL = "https://crests.football-data.org/PL.svg";
// Tiny 1x1 PNG fallback to keep canvas origin-clean on iOS
const DEFAULT_CREST_DATAURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=";

// Debug logger for mobile debugging with caching
const DEBUG_STORAGE_KEY = `pl-predictor-debug-v${VERSION}`;
const DEBUG_TOGGLE_STORAGE_KEY = `pl-predictor-debug-toggle-v${VERSION}`;
const MAX_DEBUG_MESSAGES = 50;

function debugLog(message, type = 'info', category = 'general') {
    const timestamp = new Date().toLocaleTimeString();
    const debugEntry = {
        id: Date.now() + Math.random(), // Unique ID for each message
        timestamp: timestamp,
        type: type.toUpperCase(),
        category: category,
        message: message,
        fullMessage: `[${timestamp}] ${type.toUpperCase()}: ${message}`
    };
    
    // Add to console
    console.log(debugEntry.fullMessage);
    
    // Load existing debug messages from localStorage
    let debugMessages = [];
    try {
        const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
        if (stored) {
            debugMessages = JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Could not load debug messages from storage:", e);
    }
    
    // Add new message
    debugMessages.push(debugEntry);
    
    // Keep only last MAX_DEBUG_MESSAGES messages
    if (debugMessages.length > MAX_DEBUG_MESSAGES) {
        debugMessages = debugMessages.slice(-MAX_DEBUG_MESSAGES);
    }
    
    // Save to localStorage
    try {
        localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(debugMessages));
    } catch (e) {
        console.warn("Could not save debug messages to storage:", e);
    }
}

function clearDebugLogs() {
    try {
        localStorage.removeItem(DEBUG_STORAGE_KEY);
    } catch (e) {
        console.warn("Could not clear debug messages from storage:", e);
    }
}

function getDebugMessages() {
    try {
        const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn("Could not load debug messages from storage:", e);
        return [];
    }
}

function getDebugMessageCount() {
    return getDebugMessages().length;
}

function getDebugToggleState() {
    try {
        const stored = localStorage.getItem(DEBUG_TOGGLE_STORAGE_KEY);
        return stored === 'true';
    } catch (e) {
        console.warn("Could not load debug toggle state from storage:", e);
        return false;
    }
}

function setDebugToggleState(enabled) {
    try {
        localStorage.setItem(DEBUG_TOGGLE_STORAGE_KEY, enabled.toString());
    } catch (e) {
        console.warn("Could not save debug toggle state to storage:", e);
    }
}

const FALLBACK_FIXTURES = [
    {
        week: 1,
        matches: [
            { home: "Manchester United", away: "Fulham", kickoff: "2024-08-16T19:00:00Z", venue: "Old Trafford" },
            { home: "Ipswich Town", away: "Liverpool", kickoff: "2024-08-17T11:30:00Z", venue: "Portman Road" },
            { home: "Chelsea", away: "Manchester City", kickoff: "2024-08-18T15:30:00Z", venue: "Stamford Bridge" }
        ]
    },
    {
        week: 2,
        matches: [
            { home: "Arsenal", away: "Leicester City", kickoff: "2024-08-24T14:00:00Z", venue: "Emirates Stadium" },
            { home: "Everton", away: "Brighton", kickoff: "2024-08-24T14:00:00Z", venue: "Goodison Park" },
            { home: "Tottenham Hotspur", away: "Newcastle United", kickoff: "2024-08-25T16:30:00Z", venue: "Tottenham Hotspur Stadium" }
        ]
    },
    {
        week: 3,
        matches: [
            { home: "Liverpool", away: "Chelsea", kickoff: "2024-08-31T11:30:00Z", venue: "Anfield" },
            { home: "Manchester City", away: "Arsenal", kickoff: "2024-09-01T15:30:00Z", venue: "Etihad Stadium" },
            { home: "Aston Villa", away: "West Ham United", kickoff: "2024-09-02T19:00:00Z", venue: "Villa Park" }
        ]
    }
];

const CREST_CANONICAL_IDS = {
    "Arsenal": 57,
    "Aston Villa": 58,
    "Bournemouth": 1044,
    "Brentford": 402,
    "Brighton": 397,
    "Brighton and Hove Albion": 397,
    "Brighton & Hove Albion": 397,
    "Burnley": 328,
    "Chelsea": 61,
    "Crystal Palace": 354,
    "Everton": 62,
    "Fulham": 63,
    "Ipswich Town": 349,
    "Leeds United": 341,
    "Leicester City": 338,
    "Liverpool": 64,
    "Luton Town": 389,
    "Manchester City": 65,
    "Manchester United": 66,
    "Newcastle United": 67,
    "Nottingham Forest": 351,
    "Sheffield United": 356,
    "Spurs": 73,
    "Sunderland": 71,
    "Southampton": 340,
    "Tottenham Hotspur": 73,
    "West Ham United": 563,
    "Wolverhampton Wanderers": 76
};

const CREST_ALIAS_MAP = {
    "AFC Bournemouth": "Bournemouth",
    "Bournemouth AFC": "Bournemouth",
    "Brighton": "Brighton & Hove Albion",
    "Brighton and Hove Albion": "Brighton & Hove Albion",
    "Brighton Hove Albion": "Brighton & Hove Albion",
    "Brighton & Hove": "Brighton & Hove Albion",
    "Forest": "Nottingham Forest",
    "Nottingham Forest FC": "Nottingham Forest",
    "Wolverhampton": "Wolverhampton Wanderers",
    "Wolves": "Wolverhampton Wanderers",
    "Spurs": "Tottenham Hotspur",
    "Sunderland": "Sunderland",
    "Sunderland AFC": "Sunderland",
    "Tottenham": "Tottenham Hotspur",
    "West Ham": "West Ham United",
    "Leicester": "Leicester City",
    "Leicester City FC": "Leicester City",
    "Leeds": "Leeds United",
    "Leeds Utd": "Leeds United",
    "Newcastle": "Newcastle United",
    "Newcastle Utd": "Newcastle United",
    "Ipswich": "Ipswich Town",
    "Ipswich Town FC": "Ipswich Town",
    "Manchester Utd": "Manchester United",
    "Manchester United FC": "Manchester United",
    "Man United": "Manchester United",
    "Man Utd": "Manchester United",
    "Man City": "Manchester City",
    "Manchester City FC": "Manchester City",
    "West Ham Utd": "West Ham United",
    "Sheffield Utd": "Sheffield United"
};

const kickoffFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
});

const CREST_LOOKUP = buildCrestLookup(CREST_CANONICAL_IDS, CREST_ALIAS_MAP);

// Badge caching system
const BADGE_CACHE = new Map();
const BADGE_CACHE_KEY = `pl-predictor-badges-v${VERSION}`;

// Load cached badges on startup
function loadCachedBadges() {
    try {
        const cached = localStorage.getItem(BADGE_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            Object.entries(parsed).forEach(([team, dataUrl]) => {
                BADGE_CACHE.set(team, dataUrl);
            });
        }
    } catch (e) {
        console.warn("Could not load cached badges:", e);
    }
}

// Save badges to cache
function saveCachedBadges() {
    try {
        const toSave = Object.fromEntries(BADGE_CACHE);
        localStorage.setItem(BADGE_CACHE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn("Could not save cached badges:", e);
    }
}

// Download and cache badge
async function downloadAndCacheBadge(teamName) {
    const originalUrl = crestUrl(teamName);
    const proxyUrl = "https://corsproxy.io/?";
    const proxiedUrl = proxyUrl + originalUrl;

    try {
      const response = await fetch(proxiedUrl, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            BADGE_CACHE.set(teamName, dataUrl);
            saveCachedBadges();
            resolve(dataUrl);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        console.warn(`Proxy fetch failed ${response.status} for ${teamName}`);
      }
    } catch (e) {
      console.error(`CORS proxy badge error for ${teamName}:`, e);
    }
    return DEFAULT_CREST_DATAURL;
  }

// Get badge (cached or download)
async function getBadge(teamName) {
    if (BADGE_CACHE.has(teamName)) {
      return BADGE_CACHE.get(teamName);
    }
    const dataUrl = await downloadAndCacheBadge(teamName);
    return dataUrl || DEFAULT_CREST_DATAURL;
  }

// Initialize badge cache
loadCachedBadges();

function App() {
    const [theme, setTheme] = useState(getInitialTheme);
    const [fixtures, setFixtures] = useState([]);
    const [activeWeek, setActiveWeek] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(null);
    const [predictions, setPredictions] = useState(loadInitialPredictions);
    const [exportState, setExportState] = useState({ busy: false, error: null, last: null });

    const captureRef = useRef(null);

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    useEffect(() => {
        let cancelled = false;

        async function initialise() {
            setLoading(true);
            const { fixtures: resolvedFixtures, fallbackReason } = await resolveFixtures();
            if (cancelled) {
                return;
            }
            // Filter fixtures to only show current week matches that are still being played
            const filteredFixtures = filterCurrentWeekMatches(resolvedFixtures);
            setFixtures(filteredFixtures);
            setNotice(fallbackReason);
            // Automatically set to current week instead of first week
            const currentWeek = getCurrentWeek(resolvedFixtures);
            setActiveWeek(currentWeek);
            setLoading(false);
        }

        initialise();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        persistPredictions(predictions);
    }, [predictions]);

    const weeks = useMemo(() => {
        return fixtures
            .map((week) => Number(week.week))
            .filter((value) => Number.isFinite(value))
            .sort((a, b) => a - b);
    }, [fixtures]);

    const activeWeekData = useMemo(() => {
        if (!Number.isFinite(activeWeek)) {
            return null;
        }
        return fixtures.find((week) => Number(week.week) === Number(activeWeek)) ?? null;
    }, [fixtures, activeWeek]);

    const summaryRows = useMemo(() => buildSummaryRows(predictions), [predictions]);

    // This block appeared incomplete in the original; wrapping it in a useMemo fixes syntax without changing intent.
    const hasAnyPredictionThisWeek = useMemo(() => {
        if (!activeWeekData) {
            return false;
        }
        return activeWeekData.matches.some((match, index) => {
            const id = buildMatchId(activeWeekData.week, match, index);
            const entry = predictions[id];
            return entry?.home !== undefined || entry?.away !== undefined;
        });
    }, [activeWeekData, predictions]);

    const handleThemeSelect = useCallback((nextTheme) => {
        setTheme(nextTheme === "light" ? "light" : "dark");
    }, []);

    const handleScoreChange = useCallback((matchId, key, value) => {
        setPredictions((current) => {
            const next = { ...current };
            const existing = next[matchId] ?? { home: "", away: "" };
            const cleaned = sanitiseScore(value);
            const updated = { ...existing, [key]: cleaned };
            if (updated.home === "" && updated.away === "") {
                delete next[matchId];
            } else {
                next[matchId] = updated;
            }
            return next;
        });
    }, []);

    const handleExport = useCallback(async () => {
        debugLog("Export function called", "info", "export");
        
        if (!activeWeekData) {
            debugLog("No active week data - export cancelled", "warning", "export");
            return;
        }
        if (exportState.busy) {
            debugLog("Export already in progress - cancelled", "warning", "export");
            return;
        }
        const ua = navigator.userAgent;
        const isIOS = /iP(ad|hone|od)/.test(ua);
        const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua);
        
        debugLog("Setting export state to busy", "info", "export");
        setExportState({ busy: true, error: null, last: exportState.last });
        
        try {
            debugLog("Checking html2canvas availability", "info", "export");
            if (typeof window === "undefined" || typeof window.html2canvas !== "function") {
                debugLog("html2canvas not available - throwing error", "error", "export");
                throw new Error("html2canvas is not available in this browser.");
            }
            debugLog("html2canvas is available", "success", "export");
            
            debugLog("Building export payload", "info", "export");
            const payload = buildExportPayload(activeWeekData, predictions);
            debugLog("Export payload built successfully", "success", "export");
            
            debugLog("Creating export container", "info", "export");
            // Create a special export container
            const exportContainer = document.createElement("div");
            exportContainer.style.position = "absolute";
            exportContainer.style.top = "-9999px";
            exportContainer.style.left = "-9999px";
            exportContainer.style.width = "1200px";
            exportContainer.style.minHeight = "auto";
            exportContainer.style.background = "linear-gradient(160deg, #020617 0%, #0f172a 40%, #020617 100%)";
            exportContainer.style.padding = "60px";
            exportContainer.style.fontFamily = "'Poppins', system-ui, sans-serif";
            exportContainer.style.color = "#f8fafc";
            exportContainer.style.borderRadius = "20px";
            exportContainer.style.display = "flex";
            exportContainer.style.flexDirection = "column";
            exportContainer.style.alignItems = "center";
            debugLog("Export container styled", "success", "export");
            
            debugLog("Creating QR code section", "info", "export");
            // Create QR code section at the top
            const qrSection = document.createElement("div");
            qrSection.style.display = "flex";
            qrSection.style.flexDirection = "column";
            qrSection.style.alignItems = "center";
            qrSection.style.marginBottom = "50px";
            qrSection.style.gap = "25px";
            qrSection.style.width = "100%";
            
            debugLog("Creating QR code canvas", "info", "export");
            // Create QR code
            const qrCanvas = document.createElement("canvas");
            qrCanvas.width = 240;
            qrCanvas.height = 240;
            debugLog("QR canvas created", "success", "export");
            
            // Ensure QR code is properly generated
            debugLog("Generating QR code data", "info", "export");
            const qrData = JSON.stringify(payload, null, 0);
            console.log("QR Data:", qrData); // Debug log
            debugLog("QR data generated", "success", "export");
            
            debugLog("Generating QR code image", "info", "export");
            await QRCodeLib.toCanvas(qrCanvas, qrData, {
                color: {
                    dark: "#000000",
                    light: "#ffffff"
                },
                errorCorrectionLevel: "M",
                margin: 4,
                width: 240,
                height: 240
            });
            debugLog("QR code generated successfully", "success", "export");
            
            debugLog("Creating QR code container", "info", "export");
            // QR code container
            const qrContainer = document.createElement("div");
            qrContainer.style.background = "#ffffff";
            qrContainer.style.padding = "25px";
            qrContainer.style.borderRadius = "25px";
            qrContainer.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.4)";
            qrContainer.style.display = "flex";
            qrContainer.style.alignItems = "center";
            qrContainer.style.justifyContent = "center";
            qrContainer.appendChild(qrCanvas);
            
            // Date and time info
            const dateInfo = document.createElement("div");
            dateInfo.style.textAlign = "center";
            dateInfo.style.fontSize = "20px";
            dateInfo.style.fontWeight = "600";
            dateInfo.style.width = "100%";
            
            const now = new Date();
            const saudiTime = new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Riyadh",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(now);
            
            dateInfo.innerHTML = `
                <div style="margin-bottom: 8px;">GW ${activeWeekData.week} | ${saudiTime}</div>
                <div style="font-size: 18px; opacity: 0.8; font-weight: 500;">GW ${activeWeekData.week}</div>
            `;
            
            qrSection.appendChild(qrContainer);
            qrSection.appendChild(dateInfo);
            
            // Create matches section
            const matchesSection = document.createElement("div");
            matchesSection.style.display = "flex";
            matchesSection.style.flexDirection = "column";
            matchesSection.style.gap = "20px";
            matchesSection.style.width = "100%";
            matchesSection.style.maxWidth = "1000px";
            matchesSection.style.alignItems = "center";
            
            // Add each match
            for (const [index, match] of activeWeekData.matches.entries()) {
                const matchId = buildMatchId(activeWeekData.week, match, index);
                const stored = predictions[matchId] ?? { home: "", away: "" };
                
                const matchCard = document.createElement("div");
                matchCard.style.background = "rgba(15, 23, 42, 0.8)";
                matchCard.style.border = "1px solid rgba(148, 163, 184, 0.2)";
                matchCard.style.borderRadius = "20px";
                matchCard.style.padding = "25px";
                matchCard.style.display = "flex";
                matchCard.style.alignItems = "center";
                matchCard.style.justifyContent = "space-between";
                matchCard.style.gap = "40px";
                matchCard.style.width = "110%";
                matchCard.style.minHeight = "80px";
                matchCard.style.maxWidth = "none";
                
                // Home team (right side)
                const homeTeam = document.createElement("div");
                homeTeam.style.display = "flex";
                homeTeam.style.alignItems = "center";
                homeTeam.style.gap = "15px";
                homeTeam.style.fontSize = "18px";
                homeTeam.style.fontWeight = "600";
                homeTeam.style.flex = "1";
                homeTeam.style.justifyContent = "flex-end";
                homeTeam.style.minWidth = "300px";
                homeTeam.style.maxWidth = "350px";
                
                const homeName = document.createElement("span");
                homeName.textContent = match.home;
                homeName.style.fontSize = "28px";
                homeName.style.fontWeight = "600";
                homeName.style.textAlign = "right";
                homeName.style.flex = "1";
                homeTeam.appendChild(homeName);
                
                if (!isSafari) {
                const homeBadge = document.createElement("img");
                homeBadge.crossOrigin = "anonymous";
                homeBadge.src = await getBadge(match.home);
                homeBadge.style.width = "80px";
                homeBadge.style.height = "80px";
                homeBadge.style.borderRadius = "10%";
                homeBadge.style.objectFit = "contain";
                homeBadge.style.background = "none";
                homeBadge.style.padding = "1px";
                homeBadge.style.flexShrink = "0";
                homeBadge.style.border = "none";
                homeTeam.appendChild(homeBadge);
                }
                
                // Center section with scores and match info
                const centerSection = document.createElement("div");
                centerSection.style.display = "flex";
                centerSection.style.flexDirection = "column";
                centerSection.style.alignItems = "center";
                centerSection.style.gap = "15px";
                centerSection.style.minWidth = "300px";
                centerSection.style.maxWidth = "350px";
                
                // Scores row
                const scoresRow = document.createElement("div");
                scoresRow.style.display = "flex";
                scoresRow.style.alignItems = "center";
                scoresRow.style.gap = "25px";
                
                const homeScore = document.createElement("div");
                homeScore.style.width = "100px";
                homeScore.style.height = "100px";
                homeScore.style.background = "linear-gradient(135deg, #2563eb, #7c3aed)";
                homeScore.style.borderRadius = "50%";
                homeScore.style.display = "flex";
                homeScore.style.alignItems = "center";
                homeScore.style.justifyContent = "center";
                homeScore.style.fontWeight = "700";
                homeScore.style.color = "white";
                homeScore.style.fontSize = "40px";
                homeScore.textContent = stored.home || "0";
                
                const vsText = document.createElement("span");
                vsText.textContent = "vs";
                vsText.style.fontSize = "16px";
                vsText.style.fontWeight = "500";
                vsText.style.opacity = "0.8";
                
                const awayScore = document.createElement("div");
                awayScore.style.width = "100px";
                awayScore.style.height = "100px";
                awayScore.style.background = "linear-gradient(135deg, #2563eb, #7c3aed)";
                awayScore.style.borderRadius = "50%";
                awayScore.style.display = "flex";
                awayScore.style.alignItems = "center";
                awayScore.style.justifyContent = "center";
                awayScore.style.fontWeight = "700";
                awayScore.style.color = "white";
                awayScore.style.fontSize = "40px";
                awayScore.textContent = stored.away || "0";
                
                scoresRow.appendChild(homeScore);
                scoresRow.appendChild(vsText);
                scoresRow.appendChild(awayScore);
                
                // Match info
                const matchInfo = document.createElement("div");
                matchInfo.style.textAlign = "center";
                matchInfo.style.fontSize = "16px";
                matchInfo.style.opacity = "0.9";
                matchInfo.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 6px;">${formatKickoff(match.kickoff)}</div>
                    <div style="font-size: 14px; opacity: 0.7; line-height: 1.3;">${match.venue}</div>
                `;
                
                centerSection.appendChild(scoresRow);
                centerSection.appendChild(matchInfo);
                
                // Away team (left side)
                const awayTeam = document.createElement("div");
                awayTeam.style.display = "flex";
                awayTeam.style.alignItems = "center";
                awayTeam.style.gap = "15px";
                awayTeam.style.fontSize = "18px";
                awayTeam.style.fontWeight = "600";
                awayTeam.style.flex = "1";
                awayTeam.style.justifyContent = "flex-start";
                awayTeam.style.minWidth = "300px";
                awayTeam.style.maxWidth = "350px";
                
                if (!isSafari) {
                const awayBadge = document.createElement("img");
                awayBadge.crossOrigin = "anonymous";
                awayBadge.src = await getBadge(match.away);
                awayBadge.style.width = "80px";
                awayBadge.style.height = "80px";
                awayBadge.style.borderRadius = "10%";
                awayBadge.style.objectFit = "contain";
                awayBadge.style.background = "none";
                awayBadge.style.padding = "1px";
                awayBadge.style.flexShrink = "0";
                awayBadge.style.border = "none";
                awayTeam.appendChild(awayBadge);
                }

                const awayName = document.createElement("span");
                awayName.textContent = match.away;
                awayName.style.fontSize = "28px";
                awayName.style.fontWeight = "600";
                awayName.style.textAlign = "left";
                awayName.style.flex = "1";
                awayTeam.appendChild(awayName);
                
                matchCard.appendChild(homeTeam);
                matchCard.appendChild(centerSection);
                matchCard.appendChild(awayTeam);
                matchesSection.appendChild(matchCard);
            }
            
            exportContainer.appendChild(qrSection);
            exportContainer.appendChild(matchesSection);
            
            debugLog("Adding export container to DOM", "info", "export");
            // Add to DOM temporarily
            document.body.appendChild(exportContainer);
            debugLog("Export container added to DOM", "success", "export");
            
            debugLog("Waiting for images to load", "info", "export");
            // Wait for all images to load
            const images = exportContainer.querySelectorAll('img');
            debugLog(`Found ${images.length} images to load`, "info", "export");
            await Promise.all(Array.from(images).map(img => {
                img.crossOrigin = "anonymous";
                return new Promise((resolve) => {
                    if (img.complete) {
                        resolve();
                    } else {
                        img.onload = resolve;
                        img.onerror = resolve;
                        // Timeout after 3 seconds
                        setTimeout(resolve, 3000);
                    }
                });
            }));
            
            debugLog("Images loaded, waiting for rendering", "success", "export");
            // Small delay to ensure rendering is complete
            await new Promise(resolve => setTimeout(resolve, 500));
            debugLog("Rendering delay completed", "success", "export");
            
            debugLog(`Device detection - iOS: ${isIOS}, Browser is safari: ${isSafari}`, "info", "device");

            debugLog("Starting html2canvas conversion", "info", "export");
            
            // Add timeout wrapper to prevent hanging
            const html2canvasPromise = window.html2canvas(exportContainer, {
                backgroundColor: null,
                scale: 2,
                useCORS: true,
                logging: false,
                imageTimeout: 15000,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0
            });
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("html2canvas operation timed out after 30 seconds")), 10000);
            });
            
            const canvas = await Promise.race([html2canvasPromise, timeoutPromise]);
            debugLog("html2canvas conversion completed", "success", "export");
            
            debugLog("Cleaning up export container", "info", "export");
            // Clean up
            document.body.removeChild(exportContainer);
            debugLog("Export container removed from DOM", "success", "export");
            
            debugLog("Converting canvas to data URL", "info", "export");
            const dataUrl = canvas.toDataURL("image/png", 0.92);
            const fileName = `gw-${activeWeekData.week}-predictions.png`;
            debugLog("Canvas converted to data URL", "success", "export");

            // Try sharing first, with timeout and proper fallback
            let shareSuccessful = false;
            
            // Detect if we're on a mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                            (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
            
            debugLog(`Device detection - Mobile: ${isMobile}`, "info", "device");
            debugLog(`User Agent: ${navigator.userAgent}`, "info", "device");
            
            // Check if Web Share API is supported
            if (navigator.share && isMobile) {
                debugLog("Web Share API detected, attempting sharing", "info", "sharing");
                try {
                    // For iPhone Safari, try a simpler approach first
                    if (isIOS) {
                        // For iOS, try text sharing first (more reliable)
                        debugLog("iOS detected, trying text sharing first", "info", "sharing");
                        
                        const sharePromise = navigator.share({
                            title: `GW ${activeWeekData.week} Predictions`,
                            text: `Check out my predictions for GW ${activeWeekData.week}!`,
                            url: window.location.href
                        });
                        
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error("Share operation timed out")), 8000);
                        });
                        
                        debugLog("Starting iOS text sharing with 8s timeout", "info", "sharing");
                        await Promise.race([sharePromise, timeoutPromise]);
                        shareSuccessful = true;
                        debugLog("Share successful with text/URL on iOS", "success", "sharing");
                        
                    } else {
                        // For Android, try file sharing first
                        debugLog("Android detected, checking file sharing support", "info");
                        const canShareFiles = navigator.canShare && 
                                             typeof navigator.canShare === 'function' && 
                                             navigator.canShare({ files: [] });
                        
                        debugLog(`Android file sharing support: ${canShareFiles}`, "info");
                        
                        if (canShareFiles) {
                            debugLog("Android detected with file sharing support", "info");
                            
                            // Convert data URL to blob
                            debugLog("Converting image to blob", "info");
                            const response = await fetch(dataUrl);
                            if (!response.ok) {
                                throw new Error("Failed to convert image to blob");
                            }
                            const blob = await response.blob();
                            
                            // Create file object
                            const file = new File([blob], fileName, { type: "image/png" });
                            debugLog(`Created file object: ${fileName} (${blob.size} bytes)`, "info");
                            
                            // Create a promise that rejects after 8 seconds
                            const sharePromise = navigator.share({
                                files: [file],
                                title: `GW ${activeWeekData.week} Predictions`,
                                text: `Check out my predictions for GW ${activeWeekData.week}!`,
                            });
                            
                            const timeoutPromise = new Promise((_, reject) => {
                                setTimeout(() => reject(new Error("Share operation timed out")), 8000);
                            });
                            
                            debugLog("Starting Android file sharing with 8s timeout", "info");
                            await Promise.race([sharePromise, timeoutPromise]);
                            shareSuccessful = true;
                            debugLog("Share successful with files on Android", "success");
                        } else {
                            // Android without file sharing
                            debugLog("Android detected without file sharing support", "info");
                            const sharePromise = navigator.share({
                                title: `GW ${activeWeekData.week} Predictions`,
                                text: `Check out my predictions for GW ${activeWeekData.week}!`,
                                url: window.location.href
                            });
                            
                            const timeoutPromise = new Promise((_, reject) => {
                                setTimeout(() => reject(new Error("Share operation timed out")), 8000);
                            });
                            
                            debugLog("Starting Android text sharing with 8s timeout", "info");
                            await Promise.race([sharePromise, timeoutPromise]);
                            shareSuccessful = true;
                            debugLog("Share successful with text/URL on Android", "success");
                        }
                    }
                    
                } catch (err) {
                    debugLog(`Share failed: ${err.message}`, "error");
                    shareSuccessful = false;
                    // Don't show alert here, just fall back to download
                }
            } else if (!isMobile) {
                // For desktop browsers, skip sharing and go directly to clipboard/download
                debugLog("Desktop browser detected, skipping Web Share API", "info");
                shareSuccessful = false;
            } else {
                debugLog("Web Share API not supported", "info");
                shareSuccessful = false;
            }
            
            // If sharing failed or is not available, try clipboard fallback for mobile
            if (!shareSuccessful) {
                debugLog("Sharing failed, trying clipboard fallback", "info");
                
                // Try clipboard API as a fallback for mobile devices
                if (navigator.clipboard && navigator.clipboard.write && isMobile) {
                    debugLog("Clipboard API available, attempting clipboard copy", "info");
                    try {
                        debugLog("Converting image to blob for clipboard", "info");
                        const response = await fetch(dataUrl);
                        const blob = await response.blob();
                        const clipboardItem = new ClipboardItem({
                            'image/png': blob
                        });
                        
                        // Add timeout for clipboard operation too
                        const clipboardPromise = navigator.clipboard.write([clipboardItem]);
                        const clipboardTimeout = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error("Clipboard operation timed out")), 5000);
                        });
                        
                        debugLog("Starting clipboard copy with 5s timeout", "info");
                        await Promise.race([clipboardPromise, clipboardTimeout]);
                        debugLog("Image copied to clipboard successfully", "success");
                        shareSuccessful = true;
                    } catch (clipboardErr) {
                        debugLog(`Clipboard fallback failed: ${clipboardErr.message}`, "error");
                        shareSuccessful = false;
                    }
                } else {
                    debugLog("Clipboard API not available or not mobile", "info");
                }
                
                // Final fallback: download the image
                if (!shareSuccessful) {
                    debugLog("All sharing methods failed, downloading image", "info");
                    try {
                        const link = document.createElement("a");
                        link.download = fileName;
                        link.href = dataUrl;
                        link.click();
                        debugLog("Downloaded image as final fallback", "success");
                        shareSuccessful = true; // Mark as successful since download worked
                    } catch (downloadErr) {
                        debugLog(`Download fallback also failed: ${downloadErr.message}`, "error");
                        shareSuccessful = false;
                    }
                }
            }
            
            // Safety net: If we're on iOS and nothing worked, force download
            if (!shareSuccessful && isIOS) {
                debugLog("iOS safety net: forcing download", "info");
                try {
                    const link = document.createElement("a");
                    link.download = fileName;
                    link.href = dataUrl;
                    link.click();
                    shareSuccessful = true;
                    debugLog("iOS safety net download successful", "success");
                } catch (safetyErr) {
                    debugLog(`iOS safety net download failed: ${safetyErr.message}`, "error");
                }
            }
            
            // Final result logging
            const method = shareSuccessful ? (navigator.share ? "share" : "clipboard") : "download";
            debugLog(`Export completed successfully using method: ${method}`, "success");
            
            // Update export state with success message
            const successMessage = shareSuccessful ? 
                (navigator.share ? "Shared successfully!" : "Copied to clipboard!") : 
                "Downloaded successfully!";
            
            setExportState({ 
                busy: false, 
                error: null, 
                last: { 
                    week: activeWeekData.week, 
                    payload, 
                    dataUrl,
                    method: method
                } 
            });
        } catch (error) {
            debugLog(`Export failed with error: ${error.message}`, "error");
            let message = "Failed to export predictions.";

            if (error instanceof Error) {
                if (error.message.includes("timed out")) {
                    message = "Export timed out. Please try again.";
                    debugLog("Export timed out", "error");
                } else if (error.message.includes("html2canvas")) {
                    message = "Export tool not available. Please refresh the page and try again.";
                    debugLog("html2canvas not available", "error");
                } else {
                    message = `Export failed: ${error.message}`;
                    debugLog(`General export error: ${error.message}`, "error");
                }
            }
            
            setExportState({ busy: false, error: message, last: null });
        }
    }, [activeWeekData, predictions, exportState.busy, exportState.last]);

    return h(
        "div",
        { className: "app" },
        h(
            "header",
            { className: "hero" },
            h(
                "div",
                { className: "hero__top" },
                h(
                    "div",
                    { className: "hero__copy" },
                    h("h1", { className: "hero__heading" }, "Premier League Matchweek Predictor"),
                    h(
                        "p",
                        { className: "hero__subheading" },
                        "Keep track of upcoming fixtures, capture your score predictions, and come back each week with everything saved locally in your browser."
                    )
                ),
                h(ThemeToggle, { theme, onSelect: handleThemeSelect })
            ),
            h(
                "div",
                { className: "hero__week-selector" },
                loading
                    ? h("p", { className: "empty-state" }, "Loading fixtures...")
                    : weeks.length === 0
                    ? h("p", { className: "empty-state" }, "No fixtures available yet.")
                    : h(WeekMenu, { weeks, activeWeek, onWeekChange: setActiveWeek })
            ),
            h(
                "div",
                { className: "hero__actions" },
                h(
                    "button",
                    {
                        type: "button",
                        className: "button button--primary",
                        onClick: handleExport,
                        disabled: exportState.busy || !activeWeekData
                    },
                    exportState.busy ? "Preparing image..." : "Export matchweek graphic"
                ),
                exportState.error
                    ? h("span", { className: "export-status export-status--error" }, exportState.error)
                    : null,
                null
            ),
            notice ? h("div", { className: "notice" }, notice) : null
        ),
        h(MainLayout, {
            loading,
            activeWeekData,
            predictions,
            onScoreChange: handleScoreChange,
            captureRef
        }),
        h(SummaryPanel, { summaryRows }),
        h(DebugToggle),
        h(DebugPanel)
    );
}

function ThemeToggle({ theme, onSelect }) {
    return h(
        "div",
        { className: "theme-toggle" },
        h(
            "button",
            {
                type: "button",
                className: "theme-toggle__button",
                "aria-label": "Switch to light mode",
                "aria-pressed": theme === "light" ? "true" : "false",
                onClick: () => onSelect("light")
            },
            "☀️"
        ),
        h(
            "button",
            {
                type: "button",
                className: "theme-toggle__button",
                "aria-label": "Switch to dark mode",
                "aria-pressed": theme === "dark" ? "true" : "false",
                onClick: () => onSelect("dark")
            },
            "🌙"
        )
    );
}

function MainLayout({ loading, activeWeekData, predictions, onScoreChange, captureRef }) {
    return h(
        "section",
        { className: "layout" },
        h(
            "div",
            { className: "panel" },
            loading
                ? h("div", { className: "empty-state" }, "Loading fixtures...")
                : !activeWeekData
                ? h("div", { className: "empty-state" }, "Select a matchweek to start predicting.")
                : h(MatchesList, {
                      captureRef,
                      week: activeWeekData.week,
                      matches: activeWeekData.matches,
                      predictions,
                      onScoreChange
                  })
        )
    );
}

function WeekMenu({ weeks, activeWeek, onWeekChange }) {
    const sorted = useMemo(() => [...weeks].sort((a, b) => a - b), [weeks]);
    const selectId = "week-select";
    const handleChange = useCallback(
        (event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) {
                onWeekChange(value);
            }
        },
        [onWeekChange]
    );
    return h(
        "div",
        { className: "week-menu" },
        h("label", { htmlFor: selectId }, "Matchweek"),
        h(
            "select",
            {
                id: selectId,
                value: Number.isFinite(activeWeek) ? String(activeWeek) : "",
                onChange: handleChange
            },
            [
                h("option", { key: "placeholder", value: "" }, "Select gameweek"),
                ...sorted.map((week) => h("option", { key: week, value: String(week) }, `GW ${week}`))
            ]
        )
    );
}

function MatchesList({ captureRef, week, matches, predictions, onScoreChange }) {
    const captureProps = captureRef ? { ref: captureRef } : {};
    return h(
        "div",
        { className: "matches", "aria-live": "polite", ...captureProps },
        h("h2", { className: "panel__heading" }, `Gameweek ${week}`),
        matches.length === 0
            ? h("div", { className: "empty-state" }, "No fixtures scheduled for this week.")
            : matches.map((match, index) => {
                  const matchId = buildMatchId(week, match, index);
                  const stored = predictions[matchId] ?? { home: "", away: "" };
                  return h(
                      "article",
                      { className: "match-card", key: matchId },
                      h(
                          "div",
                          { className: "match-card__teams" },
                          h(TeamRow, {
                              teamName: match.home,
                              value: stored.home ?? "",
                              onChange: (value) => onScoreChange(matchId, "home", value)
                          }),
                          h(TeamRow, {
                              teamName: match.away,
                              value: stored.away ?? "",
                              onChange: (value) => onScoreChange(matchId, "away", value)
                          })
                      ),
                      h("div", { className: "match-card__time" }, formatKickoff(match.kickoff))
                  );
              })
    );
}

function TeamRow({ teamName, value, onChange }) {
    const crest = crestUrl(teamName);
    return h(
        "div",
        { className: "team-row" },
        h(
            "span",
            { className: "team-row__crest" },
            h("img", { src: crest, alt: `${teamName} crest`, loading: "lazy" })
        ),
        h("span", { className: "team-row__name" }, teamName),
        h(
            "span",
            { className: "team-row__input" },
            h("input", {
                type: "number",
                inputMode: "numeric",
                min: "0",
                max: "20",
                value,
                onChange: (event) => onChange(event.target.value)
            })
        )
    );
}

function SummaryPanel({ summaryRows }) {
    return h(
        "section",
        { className: "panel" },
        h("h2", { className: "panel__heading" }, "Prediction summary"),
        summaryRows.length === 0
            ? h("p", { className: "empty-state" }, "No predictions recorded yet. Enter scores to see them here.")
            : h(
                  "div",
                  { className: "summary" },
                  summaryRows.map((row) =>
                      h(
                          "div",
                          { className: "summary__row", key: row.matchId },
                          h("span", null, row.label),
                          h("span", { className: "summary__meta" }, `GW ${row.week} · ${row.result}`)
                      )
                  )
              )
    );
}

function DebugToggle() {
    const [isEnabled, setIsEnabled] = useState(getDebugToggleState);
    
    const handleToggle = () => {
        const newState = !isEnabled;
        setIsEnabled(newState);
        setDebugToggleState(newState);
    };
    
    return h(
        "div",
        {
            style: {
                position: "fixed",
                bottom: "10px",
                right: "10px",
                zIndex: 1001
            }
        },
        h(
            "button",
            {
                onClick: handleToggle,
                style: {
                    background: isEnabled ? "#10b981" : "#6b7280",
                    border: "none",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                    transition: "background-color 0.2s ease"
                }
            },
            isEnabled ? "🐛 Debug ON" : "🐛 Debug OFF"
        )
    );
}

function DebugPanel() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [debugMessages, setDebugMessages] = useState([]);
    const [isEnabled, setIsEnabled] = useState(getDebugToggleState);
    
    useEffect(() => {
        // Load debug messages on component mount
        setDebugMessages(getDebugMessages());
        
        // Set up interval to check for new messages and toggle state
        const interval = setInterval(() => {
            setDebugMessages(getDebugMessages());
            setIsEnabled(getDebugToggleState());
        }, 500); // Check more frequently for real-time updates
        
        return () => clearInterval(interval);
    }, []);
    
    const handleClear = () => {
        clearDebugLogs();
        setDebugMessages([]);
    };
    
    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };
    
    const getTypeColor = (type) => {
        switch (type) {
            case 'SUCCESS': return '#4ade80';
            case 'ERROR': return '#f87171';
            case 'WARNING': return '#fbbf24';
            case 'INFO': return '#60a5fa';
            default: return '#9ca3af';
        }
    };
    
    const getCategoryColor = (category) => {
        switch (category) {
            case 'device': return '#8b5cf6';
            case 'sharing': return '#06b6d4';
            case 'filtering': return '#10b981';
            case 'export': return '#f59e0b';
            default: return '#6b7280';
        }
    };
    
    if (!isEnabled || debugMessages.length === 0) {
        return null; // Don't show debug panel if not enabled or no messages
    }
    
    return h(
        "section",
        { 
            className: "debug-panel",
            style: {
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                background: "rgba(0, 0, 0, 0.95)",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: "11px",
                zIndex: 1000,
                borderTop: "1px solid #333",
                maxHeight: isExpanded ? "400px" : "40px",
                overflow: "hidden",
                transition: "max-height 0.3s ease"
            }
        },
        h(
            "div",
            {
                style: {
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#222",
                    borderBottom: "1px solid #333"
                }
            },
            h(
                "button",
                {
                    onClick: handleToggle,
                    style: {
                        background: "none",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "14px",
                        marginRight: "10px",
                        padding: "4px"
                    }
                },
                isExpanded ? "▼" : "▲"
            ),
            h(
                "span",
                { style: { flex: 1, fontWeight: "bold" } },
                `Debug Log (${debugMessages.length} messages)`
            ),
            h(
                "button",
                {
                    onClick: handleClear,
                    style: {
                        background: "#ff4444",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "10px",
                        padding: "4px 8px",
                        borderRadius: "4px"
                    }
                },
                "Clear"
            )
        ),
        isExpanded && h(
            "div",
            {
                style: {
                    padding: "8px",
                    maxHeight: "350px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                }
            },
            debugMessages.map((entry) => 
                h(
                    "div",
                    {
                        key: entry.id,
                        style: {
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            fontSize: "10px",
                            lineHeight: "1.3"
                        }
                    },
                    h(
                        "div",
                        {
                            style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                                minWidth: "80px"
                            }
                        },
                        h(
                            "span",
                            {
                                style: {
                                    color: getTypeColor(entry.type),
                                    fontWeight: "bold",
                                    fontSize: "9px"
                                }
                            },
                            entry.type
                        ),
                        h(
                            "span",
                            {
                                style: {
                                    color: getCategoryColor(entry.category),
                                    fontSize: "8px",
                                    textTransform: "uppercase"
                                }
                            },
                            entry.category
                        ),
                        h(
                            "span",
                            {
                                style: {
                                    color: "#9ca3af",
                                    fontSize: "8px"
                                }
                            },
                            entry.timestamp
                        )
                    ),
                    h(
                        "div",
                        {
                            style: {
                                flex: 1,
                                color: "#e5e7eb",
                                wordBreak: "break-word"
                            }
                        },
                        entry.message
                    )
                )
            )
        )
    );
}

async function resolveFixtures() {
    if (typeof fetch !== "function") {
        return {
            fixtures: FALLBACK_FIXTURES,
            fallbackReason: "Network fetch unavailable"
        };
    }
    try {
        const response = await fetch("fixtures-2025-26.json", { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const fixtures = normaliseFixtures(payload);
        if (!fixtures.length) {
            throw new Error("Fixture file did not include any valid matchweeks.");
        }
        return { fixtures, fallbackReason: null };
    } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown error";
        console.warn("Falling back to bundled fixtures", error);
        return {
            fixtures: FALLBACK_FIXTURES,
            fallbackReason: `Using bundled sample fixtures (${reason}).`
        };
    }
}

function normaliseFixtures(input) {
    const weeks = Array.isArray(input?.weeks) ? input.weeks : input;
    if (!Array.isArray(weeks)) {
        return [];
    }
    return weeks
        .map((week) => {
            const numericWeek = Number(week?.week);
            if (!Number.isFinite(numericWeek)) {
                return null;
            }
            const matches = Array.isArray(week?.matches) ? week.matches.map(normaliseMatch).filter(Boolean) : [];
            if (!matches.length) {
                return null;
            }
            return { week: numericWeek, matches };
        })
        .filter(Boolean)
        .sort((a, b) => a.week - b.week);
}

function getCurrentWeek(fixtures) {
    const now = new Date();
    const currentWeek = fixtures.find(week => {
        return week.matches.some(match => {
            if (!match.kickoff) return false;
            const kickoffDate = new Date(match.kickoff);
            // Check if the match is currently being played or within the next 7 days
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const matchEndTime = new Date(kickoffDate.getTime() + 2.5 * 60 * 60 * 1000);
            return (kickoffDate <= matchEndTime && kickoffDate >= new Date(now.getTime() - 2.5 * 60 * 60 * 1000)) || 
                   (kickoffDate >= now && kickoffDate <= weekFromNow);
        });
    });
    return currentWeek ? currentWeek.week : null;
}

function filterCurrentWeekMatches(fixtures) {
    const now = new Date();
    return fixtures.map(week => {
        const filteredMatches = week.matches.filter(match => {
            if (!match.kickoff) return false;
            const kickoffDate = new Date(match.kickoff);
            
            // Hide matches that started more than 20 minutes ago
            const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
            if (kickoffDate < twentyMinutesAgo) {
                return false;
            }
            
            // Show matches that are currently being played or haven't started yet
            // Consider a match as "current" if it's within 2.5 hours of kickoff (allowing for match duration + extra time)
            const matchEndTime = new Date(kickoffDate.getTime() + 2.5 * 60 * 60 * 1000);
            const isCurrent = kickoffDate <= matchEndTime && kickoffDate >= new Date(now.getTime() - 2.5 * 60 * 60 * 1000);
            
            // No debug logging for filtering
            
            return isCurrent;
        });
        return { ...week, matches: filteredMatches };
    }).filter(week => week.matches.length > 0);
}

function normaliseMatch(match) {
    const home = typeof match?.home === "string" ? match.home.trim() : "";
    const away = typeof match?.away === "string" ? match.away.trim() : "";
    if (!home || !away) {
        return null;
    }
    const kickoff = typeof match?.kickoff === "string" ? match.kickoff : "";
    const venue = typeof match?.venue === "string" ? match.venue.trim() : "";
    return { home, away, kickoff, venue };
}

function buildMatchId(week, match, index) {
    return `${String(week).padStart(2, "0")}::${match.home}::${match.away}::${index}`;
}

function formatKickoff(kickoff) {
    if (!kickoff) {
        return "Kick-off TBC";
    }
    const date = new Date(kickoff);
    if (Number.isNaN(date.getTime())) {
        return "Kick-off TBC";
    }
    return kickoffFormatter.format(date);
}

function determineResult(homeScore, awayScore) {
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
        return "";
    }
    if (homeScore > awayScore) {
        return "Home win";
    }
    if (homeScore < awayScore) {
        return "Away win";
    }
    return "Draw";
}

function buildSummaryRows(predictions) {
    return Object.entries(predictions)
        .map(([matchId, value]) => {
            const [week, home, away] = matchId.split("::");
            const homeScore = Number(value?.home);
            const awayScore = Number(value?.away);
            if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
                return null;
            }
            return {
                matchId,
                week,
                label: `${home} ${homeScore} - ${awayScore} ${away}`,
                result: determineResult(homeScore, awayScore)
            };
        })
        .filter(Boolean)
        .sort((a, b) => Number(a.week) - Number(b.week));
}

function sanitiseScore(value) {
    if (value === null || value === undefined) {
        return "";
    }
    const trimmed = String(value).trim();
    if (trimmed === "") {
        return "";
    }
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return "";
    }
    return String(Math.min(20, Math.round(numeric)));
}

function loadInitialPredictions() {
    if (typeof window === "undefined" || !window.localStorage) {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return {};
        }
        const cleaned = {};
        Object.entries(parsed).forEach(([matchId, values]) => {
            const home = sanitiseScore(values?.home);
            const away = sanitiseScore(values?.away);
            if (home === "" && away === "") {
                return;
            }
            cleaned[matchId] = { home, away };
        });
        return cleaned;
    } catch (error) {
        console.warn("Could not load predictions from storage", error);
        return {};
    }
}

function persistPredictions(predictions) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
    } catch (error) {
        console.warn("Could not persist predictions", error);
    }
}

function getInitialTheme() {
    if (typeof window === "undefined") {
        return DEFAULT_THEME;
    }
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
            return stored;
        }
        const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
        return prefersDark ? "dark" : "light";
    } catch (error) {
        console.warn("Could not read stored theme", error);
        return DEFAULT_THEME;
    }
}

function applyTheme(theme) {
    try {
        const nextTheme = theme === "light" ? "light" : "dark";
        document.documentElement.dataset.theme = nextTheme;
        document.body.dataset.theme = nextTheme;
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        }
    } catch (error) {
        console.warn("Could not apply theme", error);
    }
}

function buildExportPayload(weekData, predictions) {
    const exported_time = Math.floor(Date.now() / 1000); // epoch seconds

    const predictionsObj = {};
    weekData.matches.forEach((match, index) => {
        const matchId = buildMatchId(weekData.week, match, index);
        const entry = predictions[matchId] ?? { home: "", away: "" };

        // Crest IDs
        const homeCrestId = CREST_LOOKUP.get(normaliseClubKey(match.home));
        const awayCrestId = CREST_LOOKUP.get(normaliseClubKey(match.away));

        predictionsObj[index + 1] = {
            [homeCrestId]: {
                name: match.home,
                score_predicted: entry.home || ""
            },
            [awayCrestId]: {
                name: match.away,
                score_predicted: entry.away || ""
            }
        };
    });

    return {
        exported_time,
        game_week: weekData.week,
        predictions: predictionsObj
    };
}

function buildCrestLookup(canonical, aliases) {
    const lookup = new Map();
    Object.entries(canonical).forEach(([name, id]) => {
        lookup.set(normaliseClubKey(name), id);
    });
    Object.entries(aliases).forEach(([alias, canonicalName]) => {
        const id = canonical[canonicalName];
        if (id) {
            lookup.set(normaliseClubKey(alias), id);
        }
    });
    return lookup;
}

function crestUrl(name) {
    if (!name) {
        return DEFAULT_CREST_URL;
    }
    const key = normaliseClubKey(name);
    const id = CREST_LOOKUP.get(key);
    if (id) {
        return `https://crests.football-data.org/${id}.svg`;
    }
    return DEFAULT_CREST_URL;
}

function normaliseClubKey(name = "") {
    return String(name ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/FOOTBALL CLUB/g, "")
        .replace(/\bA?FC\b/g, "")
        .replace(/[^A-Z0-9]/g, "");
}

const rootElement = document.getElementById("root");
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(h(App));
} else {
    console.error("Root element not found.");
}
