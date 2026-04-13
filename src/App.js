import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Edit2, Trash2, X, Upload, Search, RefreshCw, ChevronDown, ChevronUp, Calendar, AlertTriangle, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const LOCALES = ['US', 'CA-EN', 'CA-FR', 'GB', 'EU', 'DE', 'FR', 'SG', 'HK-EN', 'HK-ZH', 'AU', 'ES', 'IT', 'AP', 'TW', 'JP', 'KR'];
const SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6'];

// Razer Brand Colors - Balanced
const RAZER = {
  green: '#44D62C',
  greenDark: '#3bc026',
  greenLight: '#5ce647',
  black: '#111111',
  darkGray: '#222222',
  gray: '#666666',
  lightGray: '#e5e7eb',
  white: '#ffffff'
};


// ── Campaign Date Utilities ──────────────────────────────────────────
// Easter: Anonymous Gregorian algorithm
const getEasterDate = (year) => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

// Nth weekday of a month (e.g., 3rd Sunday of June)
// weekday: 0=Sun, 1=Mon...6=Sat
const getNthWeekday = (year, month, weekday, n) => {
  const first = new Date(year, month, 1);
  let day = 1 + ((weekday - first.getDay() + 7) % 7);
  day += (n - 1) * 7;
  return new Date(year, month, day);
};

// Black Friday = 4th Thursday of November + includes weekend
const getBlackFriday = (year) => getNthWeekday(year, 10, 4, 4);

// Fixed campaigns with auto-calculated dates
// type: 'fixed' = exact date every year, 'formula' = calculated, 'variable' = no fixed date (user sets manually)
const DEFAULT_CAMPAIGNS = [
  { name: 'CES', type: 'variable', typicalMonth: 0, typicalDay: 7, notes: 'Research Gamer category. Usually early January.' },
  { name: 'Valentines Campaign', type: 'fixed', month: 1, day: 14, notes: 'Research Gamer category' },
  { name: 'Tax Time Campaign', type: 'fixed', month: 3, day: 15, notes: 'Research Gamer category. US Tax Day.' },
  { name: 'April Fools', type: 'fixed', month: 3, day: 1, notes: 'Research Gamer category' },
  { name: 'Easter Campaign', type: 'formula', formula: 'easter', notes: 'Research Gamer category. Date varies by year.' },
  { name: 'Gamer Week', type: 'variable', typicalMonth: 5, typicalDay: 1, notes: 'Research Gamer category. Razer-specific, date varies.' },
  { name: 'PAX East', type: 'variable', typicalMonth: 2, typicalDay: 20, notes: 'Research Gamer category. Usually late March.' },
  { name: 'PAX West', type: 'variable', typicalMonth: 7, typicalDay: 29, notes: 'Research Gamer category. Usually late Aug / early Sep.' },
  { name: "Father's Day", type: 'formula', formula: 'fathers_day', notes: 'Research Gamer category. 3rd Sunday of June (US).' },
  { name: 'International Left Handed Day', type: 'fixed', month: 7, day: 13, notes: 'Research Gamer category' },
  { name: 'Intel Gamer Day', type: 'variable', typicalMonth: 7, typicalDay: 1, notes: 'Research Gamer category. Date varies.' },
  { name: 'Labor Day', type: 'formula', formula: 'labor_day', notes: 'Research Gamer category. 1st Monday of September (US).' },
  { name: 'Fall Special', type: 'variable', typicalMonth: 9, typicalDay: 1, notes: 'Research Gamer category. Date varies.' },
  { name: 'Halloween', type: 'fixed', month: 9, day: 31, notes: 'Research Gamer category' },
  { name: 'Advent Calendar', type: 'fixed', month: 11, day: 1, notes: '1st Dec every year' },
  { name: 'Christmas & HGG', type: 'fixed', month: 11, day: 1, notes: 'Holiday Gift Guide. 1st Dec every year.' },
  { name: 'BFCW', type: 'formula', formula: 'black_friday', notes: 'Black Friday Cyber Weekend' },
];

// Calculate the actual date for a campaign in a given year
const getCampaignDate = (campaign, year) => {
  if (campaign.dateOverride) return new Date(campaign.dateOverride);
  if (campaign.type === 'fixed') return new Date(year, campaign.month, campaign.day);
  if (campaign.type === 'formula') {
    switch (campaign.formula) {
      case 'easter': return getEasterDate(year);
      case 'fathers_day': return getNthWeekday(year, 5, 0, 3);
      case 'labor_day': return getNthWeekday(year, 8, 1, 1);
      case 'black_friday': return getBlackFriday(year);
      default: return null;
    }
  }
  if (campaign.type === 'variable') {
    return campaign.typicalMonth !== undefined ? new Date(year, campaign.typicalMonth, campaign.typicalDay || 1) : null;
  }
  return null;
};

const getDaysUntil = (targetDate) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const formatCampaignDate = (date) => {
  if (!date) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function RazerBannerTool() {
  const [banners, setBanners] = useState([]);
  const [arrangements, setArrangements] = useState({});
  const [currentWork, setCurrentWork] = useState(() => {
    const empty = {};
    LOCALES.forEach(loc => { empty[loc] = {}; });
    return empty;
  });
  const [currentTabName, setCurrentTabName] = useState(null); // Track working tab name
  const [isEditingWorking, setIsEditingWorking] = useState(false); // Track if user clicked +New
  const [baseline, setBaseline] = useState(null); // Current working baseline
  const [baselineSnapshot, setBaselineSnapshot] = useState(null);
  const [tabBaselines, setTabBaselines] = useState({}); // Each tab's baseline: { "3-Feb": "2-Feb", "4-Feb": "3-Feb" }
  const [importedHighlights, setImportedHighlights] = useState({}); // Colors from Excel
  const [goLiveDates, setGoLiveDates] = useState({}); // Go Live dates per tab: { tabName: 'datetime' }
  const [draggedBannerIndex, setDraggedBannerIndex] = useState(null);
  const [draggedBanner, setDraggedBanner] = useState(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [modals, setModals] = useState({ addBanner: false, findReplace: false, duplicate: false, editBanner: null, saveTab: false, confirmDelete: null, newArrangement: false, deleteTab: false, renameTab: false, addCampaign: false });

  // Campaign Tracker state
  const [campaigns, setCampaigns] = useState(() => {
    // Initialize with default campaigns, all active for current year
    return DEFAULT_CAMPAIGNS.map(c => ({ ...c, active: true, id: c.name }));
  });
  const [campaignPanelOpen, setCampaignPanelOpen] = useState(false);

  // Guard: prevent save effect from overwriting localStorage before load completes
  const hasLoaded = useRef(false);

  // Load RazerF5 font
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'RazerF5';
        src: url('https://assets2.razerzone.com/fonts/razer-f5-bold.woff2') format('woff2');
        font-weight: bold;
      }
      @font-face {
        font-family: 'RazerF5';
        src: url('https://assets2.razerzone.com/fonts/razer-f5-regular.woff2') format('woff2');
        font-weight: normal;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('razer-banner-data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.arrangements) setArrangements(data.arrangements);
        if (data.banners) setBanners(data.banners);
        if (data.baseline) setBaseline(data.baseline);
        if (data.baselineSnapshot) setBaselineSnapshot(data.baselineSnapshot);
        if (data.currentWork) setCurrentWork(data.currentWork);
        if (data.importedHighlights) setImportedHighlights(data.importedHighlights);
        if (data.goLiveDates) setGoLiveDates(data.goLiveDates);
        if (data.currentTabName) setCurrentTabName(data.currentTabName);
        if (data.tabBaselines) setTabBaselines(data.tabBaselines);
        if (data.isEditingWorking) setIsEditingWorking(data.isEditingWorking);
        if (data.campaigns && Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
      } catch (e) { console.error('Load failed', e); }
    }
    // Mark load as complete — save effect can now write safely
    hasLoaded.current = true;
  }, []);

  useEffect(() => {
    // Skip saving until initial load from localStorage is complete
    // This prevents the default empty state from overwriting real data
    if (!hasLoaded.current) return;

    try {
      localStorage.setItem('razer-banner-data', JSON.stringify({
        arrangements,
        banners,
        baseline,
        baselineSnapshot,
        currentWork,
        importedHighlights,
        goLiveDates,
        currentTabName,
        tabBaselines,
        isEditingWorking,
        campaigns
      }));
    } catch (e) {
      console.error('Save to localStorage failed:', e);
      // Likely quota exceeded — warn the user
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        showToast('⚠️ Storage full! Export your data to avoid losing work.');
      }
    }
  }, [arrangements, banners, baseline, baselineSnapshot, currentWork, importedHighlights, goLiveDates, currentTabName, tabBaselines, isEditingWorking, campaigns]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex - 1])));
          showToast('↶ Undo');
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex + 1])));
          showToast('↷ Redo');
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [historyIndex, history]);

  const showToast = (msg) => setToastMessage(msg);
  
  const saveToHistory = (work) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(work)));
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const extractBannersFromArrangements = (arrangementData) => {
    const bannerNames = new Set();
    Object.values(arrangementData).forEach(arrangement => {
      LOCALES.forEach(locale => {
        SLOTS.forEach(slot => {
          const bannerName = arrangement?.[locale]?.[slot];
          if (bannerName?.trim()) bannerNames.add(bannerName.trim());
        });
      });
    });
    return Array.from(bannerNames);
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Use XLSX for data parsing (more reliable)
      const xlsxWorkbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      
      // Use ExcelJS for color reading
      const excelJsWorkbook = new ExcelJS.Workbook();
      await excelJsWorkbook.xlsx.load(arrayBuffer);
      
      const newArrangements = {};
      const newHighlights = {}; // Store colors: { tabName: { locale: { slot: 'red'|'blue' } }
      const newGoLiveDates = {}; // Store Go Live dates: { tabName: 'datetime' }
      const validSheetNames = [];
      
      xlsxWorkbook.SheetNames.forEach(sheetName => {
        const sheet = xlsxWorkbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

        // Find header row dynamically — scan ALL rows for the row containing "Position" + locale codes
        // This handles files where data starts at row 13, 14, 17, or any row
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;
          const rowStrings = row.map(cell => String(cell).trim());
          // Header row must contain "Position" (or "Slot") AND at least one locale code
          const hasPositionCol = rowStrings.some(s => s === 'Position' || s === 'Slot');
          const hasLocaleCol = rowStrings.some(s => LOCALES.includes(s) || LOCALES.some(loc => s.includes(loc)));
          if (hasPositionCol && hasLocaleCol) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) return; // Skip sheets without valid headers

        // Read Go Live date — scan rows ABOVE the header row for datetime values
        // Look for a row containing "Go Live" label or a date value
        for (let rowIdx = 0; rowIdx < headerRowIndex; rowIdx++) {
          const row = jsonData[rowIdx];
          if (!row) continue;
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cellValue = row[colIdx];
            if (!cellValue) continue;
            const cellStr = String(cellValue).trim();
            if (!cellStr || cellStr === 'Go Live' || cellStr === 'GO LIVE') continue;

            let dateValue = null;

            // Try parsing as date string
            const parsed = new Date(cellStr);
            if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
              dateValue = parsed;
            }

            // Also check raw cell for Excel serial date
            const rawCell = rawData[rowIdx]?.[colIdx];
            if (typeof rawCell === 'number' && rawCell > 40000 && rawCell < 60000) {
              dateValue = new Date((rawCell - 25569) * 86400 * 1000);
            }

            if (dateValue) {
              const year = dateValue.getFullYear();
              const month = String(dateValue.getMonth() + 1).padStart(2, '0');
              const day = String(dateValue.getDate()).padStart(2, '0');
              const hours = String(dateValue.getHours()).padStart(2, '0');
              const minutes = String(dateValue.getMinutes()).padStart(2, '0');
              newGoLiveDates[sheetName] = `${year}-${month}-${day}T${hours}:${minutes}`;
              break;
            }
          }
          if (newGoLiveDates[sheetName]) break; // Found a date, stop scanning
        }

        // Map header columns to locale indices
        // Handles variations like "IT (no blade)", "IT", etc.
        const headers = jsonData[headerRowIndex];
        const localeIndices = {};
        headers.forEach((header, idx) => {
          const trimmed = String(header).trim();
          if (trimmed === 'Position' || trimmed === 'Slot') return;
          // Check each locale — match exact or as substring (e.g. "IT (no blade)" → IT)
          for (const locale of LOCALES) {
            if (trimmed === locale || (locale === 'IT' && trimmed.toUpperCase().startsWith('IT'))) {
              localeIndices[locale] = idx;
              break;
            }
          }
        });
        
        const arrangement = {};
        const highlights = {};
        LOCALES.forEach(loc => { arrangement[loc] = {}; highlights[loc] = {}; });
        
        // Get ExcelJS sheet for color reading
        const excelJsSheet = excelJsWorkbook.getWorksheet(sheetName);
        
        // Read data rows after header
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          const position = String(row[0]).trim();
          if (!SLOTS.includes(position)) continue;
          
          LOCALES.forEach(locale => {
            const idx = localeIndices[locale];
            if (idx !== undefined && row[idx]) {
              const bannerName = String(row[idx]).trim();
              if (bannerName) {
                arrangement[locale][position] = bannerName;
                
                // Read color from ExcelJS (row is 1-based, col is 1-based)
                if (excelJsSheet) {
                  const excelRow = i + 1; // Convert to 1-based
                  const excelCol = idx + 1; // Convert to 1-based
                  const cell = excelJsSheet.getCell(excelRow, excelCol);
                  const fontColor = cell.font?.color?.argb;
                  if (fontColor) {
                    const hex = fontColor.length === 8 ? fontColor.substring(2) : fontColor;
                    const hexUpper = hex.toUpperCase();
                    // Red colors
                    if (hexUpper === 'FF0000' || hexUpper === 'DC2626' || hexUpper.startsWith('FF') && hexUpper.endsWith('0000')) {
                      highlights[locale][position] = 'red';
                    }
                    // Blue colors
                    else if (hexUpper === '0000FF' || hexUpper === '2563EB' || hexUpper.startsWith('00') && hexUpper.endsWith('FF')) {
                      highlights[locale][position] = 'blue';
                    }
                  }
                }
              }
            }
          });
        }
        
        newArrangements[sheetName] = arrangement;
        newHighlights[sheetName] = highlights;
        validSheetNames.push(sheetName);
      });
      
      if (validSheetNames.length === 0) {
        showToast('❌ No valid data found in Excel');
        e.target.value = '';
        return;
      }
      
      // Use LAST valid sheet as the current tab (most recent)
      const latestTab = validSheetNames[validSheetNames.length - 1];
      
      const allBannerNames = extractBannersFromArrangements(newArrangements);
      const existingBannerNames = banners.map(b => b.name);
      const newBannersToAdd = [];
      let addedCount = 0;
      let skippedCount = 0;
      const now = new Date().toISOString();
      
      allBannerNames.forEach(name => {
        if (!existingBannerNames.includes(name)) {
          newBannersToAdd.push({ name, eligibleLocales: LOCALES, createdAt: now });
          addedCount++;
        } else {
          skippedCount++;
        }
      });
      
      // Put new banners on TOP, existing banners below
      const updatedBanners = [...newBannersToAdd, ...banners];
      
      setBanners(updatedBanners);
      setArrangements(newArrangements);
      setImportedHighlights(newHighlights); // Store colors from Excel
      setGoLiveDates(newGoLiveDates); // Store Go Live dates from Excel
      
      // Load latest tab directly - NOT as "Working"
      const baselineData = newArrangements[latestTab];
      if (baselineData) {
        setCurrentWork(JSON.parse(JSON.stringify(baselineData)));
        setCurrentTabName(latestTab); // Show tab name, not "Working"
        setBaseline(latestTab); // Set as baseline too
        setBaselineSnapshot(JSON.parse(JSON.stringify(baselineData)));
        
        let message = `✅ Imported ${validSheetNames.length} tabs`;
        if (addedCount > 0) message += `, +${addedCount} new banners`;
        showToast(message);
      }
    } catch (error) {
      console.error('Import failed:', error);
      showToast('❌ Import failed: ' + error.message);
    }
    e.target.value = '';
  };

  const handleDragOver = (e, locale, slot) => {
    e.preventDefault();
    if (!draggedBanner ) return;
    const banner = banners.find(b => b.name === draggedBanner);
    setHoverSlot({ locale, slot, eligible: banner?.eligibleLocales.includes(locale) });
  };

  const resetDragState = () => {
    setDraggedBanner(null);
    setDraggedFromSlot(null);
    setDraggedBannerIndex(null);
  };

  const handleDrop = (e, targetLocale, targetSlot) => {
    e.preventDefault();
    e.stopPropagation();
    setHoverSlot(null);
    
    if (!draggedBanner ) { resetDragState(); return; }

    const draggedBannerObj = banners.find(b => b.name === draggedBanner);
    if (!draggedBannerObj || !draggedBannerObj.eligibleLocales.includes(targetLocale)) {
      showToast(`❌ "${draggedBanner}" NOT allowed in ${targetLocale}`);
      resetDragState();
      return;
    }

    saveToHistory(currentWork);
    const sourceInfo = draggedFromSlot;
    const targetBanner = currentWork?.[targetLocale]?.[targetSlot] || null;

    setCurrentWork(prev => {
      const newWork = JSON.parse(JSON.stringify(prev));
      if (!newWork[targetLocale]) newWork[targetLocale] = {};

      if (sourceInfo) {
        const { locale: sourceLocale, slot: sourceSlot } = sourceInfo;
        if (!newWork[sourceLocale]) newWork[sourceLocale] = {};
        if (sourceLocale === targetLocale && sourceSlot === targetSlot) return prev;

        // SAME LOCALE: Swap behavior
        if (sourceLocale === targetLocale) {
          if (targetBanner) {
            newWork[sourceLocale][sourceSlot] = targetBanner;
            newWork[targetLocale][targetSlot] = draggedBanner;
            showToast(`🔄 Swapped: ${draggedBanner} ↔ ${targetBanner}`);
          } else {
            delete newWork[sourceLocale][sourceSlot];
            newWork[targetLocale][targetSlot] = draggedBanner;
            showToast(`✅ Moved: ${draggedBanner}`);
          }
        } 
        // DIFFERENT LOCALE: Duplicate (copy, don't remove source)
        else {
          newWork[targetLocale][targetSlot] = draggedBanner;
          // Keep source intact - this is a COPY operation
          showToast(`📋 Copied: ${draggedBanner} → ${targetLocale}`);
        }
      } else {
        newWork[targetLocale][targetSlot] = draggedBanner;
        showToast(targetBanner ? `✅ Replaced: ${targetBanner} → ${draggedBanner}` : `✅ Placed: ${draggedBanner}`);
      }
      return newWork;
    });
    resetDragState();
  };

  const handleCellDragStart = (e, locale, slot, bannerName) => {
    
    e.stopPropagation();
    setDraggedBanner(bannerName);
    setDraggedFromSlot({ locale, slot });
    setDraggedBannerIndex(null);
  };

  const getHighlightColor = (locale, slot) => {
    // ALWAYS check if current tab has imported/saved colors from Excel first
    // This preserves colors from imported tabs
    if (currentTabName && importedHighlights[currentTabName]?.[locale]?.[slot]) {
      return importedHighlights[currentTabName][locale][slot];
    }
    
    // Determine which baseline to use:
    // - For Working tab: use current baseline
    // - For saved tab: use that tab's stored baseline
    let effectiveBaseline = null;
    let effectiveSnapshot = null;
    
    if (isEditingWorking && !currentTabName) {
      // Working tab - use current baseline
      effectiveBaseline = baseline;
      effectiveSnapshot = baselineSnapshot;
    } else if (currentTabName && tabBaselines[currentTabName]) {
      // Saved tab - use its stored baseline
      effectiveBaseline = tabBaselines[currentTabName];
      effectiveSnapshot = arrangements[effectiveBaseline] ? arrangements[effectiveBaseline] : null;
    }
    
    // If no baseline, no comparison highlights
    if (!effectiveSnapshot) return 'none';
    
    // Get current banner in this slot
    const newBanner = currentWork?.[locale]?.[slot];
    if (!newBanner) return 'none';
    
    // Get what was in this slot in baseline
    const oldBanner = effectiveSnapshot?.[locale]?.[slot];
    
    // If same banner in same slot, no highlight
    if (oldBanner === newBanner) return 'none';
    
    // Check if this banner exists in THIS LOCALE in the baseline (any slot)
    // This determines if banner is NEW to this locale or just MOVED within locale
    const baselineLocaleData = effectiveSnapshot?.[locale] || {};
    const existsInThisLocale = Object.values(baselineLocaleData).includes(newBanner);
    
    // If banner exists in this locale in baseline → blue (moved within locale)
    // If banner doesn't exist in this locale in baseline → red (new for this locale)
    return existsInThisLocale ? 'blue' : 'red';
  };

  const getLocaleStatus = (locale) => {
    const data = currentWork[locale] || {};
    const values = Object.values(data);
    const duplicates = values.filter((b, i) => values.indexOf(b) !== i);
    const filled = Object.keys(data).length;
    const ineligibleBanners = values.filter(bannerName => {
      const banner = banners.find(b => b.name === bannerName);
      return banner && !banner.eligibleLocales.includes(locale);
    });
    if (ineligibleBanners.length > 0) return { status: 'error', message: `🚫 ${ineligibleBanners.join(', ')}` };
    if (duplicates.length > 0) return { status: 'error', message: `${duplicates.length} dup` };
    if (filled < 9) return { status: 'warning', message: `${filled}/9` };
    return { status: 'success', message: '✓' };
  };

  const clearSlot = (locale, slot) => {
    
    saveToHistory(currentWork);
    setCurrentWork(prev => {
      const newLocale = { ...prev[locale] };
      delete newLocale[slot];
      return { ...prev, [locale]: newLocale };
    });
    showToast('🗑️ Cleared');
  };

  const handleBannerReorder = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const newBanners = [...banners];
    const [moved] = newBanners.splice(fromIndex, 1);
    newBanners.splice(toIndex, 0, moved);
    setBanners(newBanners);
    showToast('✅ Reordered');
  };

  const addNewBanner = (name, eligibleLocales) => {
    if (banners.find(b => b.name === name)) { showToast('❌ Already exists'); return; }
    // Add new banner on TOP with createdAt timestamp
    setBanners(prev => [{ name, eligibleLocales, createdAt: new Date().toISOString() }, ...prev]);
    setModals(prev => ({ ...prev, addBanner: false }));
    showToast(`✅ Added: ${name}`);
  };

  const removeBanner = (name) => {
    setModals(prev => ({ ...prev, confirmDelete: name }));
  };

  const confirmRemoveBanner = () => {
    const name = modals.confirmDelete;
    if (!name) return;
    setBanners(prev => prev.filter(b => b.name !== name));
    const newWork = { ...currentWork };
    LOCALES.forEach(locale => { SLOTS.forEach(slot => { if (newWork[locale]?.[slot] === name) delete newWork[locale][slot]; }); });
    setCurrentWork(newWork);
    setModals(prev => ({ ...prev, confirmDelete: null }));
    showToast(`🗑️ Removed: ${name}`);
  };

  const updateBannerLocales = (name, locales) => {
    setBanners(prev => prev.map(b => b.name === name ? { ...b, eligibleLocales: locales } : b));
    setModals(prev => ({ ...prev, editBanner: null }));
    showToast(`✅ Updated: ${name}`);
  };

  const duplicateArrangement = (sourceLocale, targetLocales) => {
    const sourceData = currentWork[sourceLocale] || {};
    setCurrentWork(prev => {
      const newWork = { ...prev };
      targetLocales.forEach(targetLocale => { newWork[targetLocale] = { ...sourceData }; });
      return newWork;
    });
    setModals(prev => ({ ...prev, duplicate: false }));
    showToast(`✅ Copied to ${targetLocales.length} locale(s)`);
  };

  const findReplace = (find, replace, locales) => {
    if (!find.trim()) return;
    const newWork = { ...currentWork };
    let count = 0;
    locales.forEach(locale => {
      SLOTS.forEach(slot => {
        if (newWork[locale]?.[slot] === find.trim()) {
          if (replace.trim()) newWork[locale][slot] = replace.trim();
          else delete newWork[locale][slot];
          count++;
        }
      });
    });
    setCurrentWork(newWork);
    setModals(prev => ({ ...prev, findReplace: false }));
    showToast(`✅ Replaced ${count} occurrence(s)`);
  };

  const saveAsTab = (tabName) => {
    if (!tabName.trim()) return;
    
    // If we had a previous tab name, remove it first (rename scenario)
    const newArrangements = { ...arrangements };
    const newHighlights = { ...importedHighlights };
    const newGoLiveDates = { ...goLiveDates };
    const newTabBaselines = { ...tabBaselines };
    
    if (currentTabName && currentTabName !== tabName) {
      // Rename: move data from old name to new name
      if (newArrangements[currentTabName]) {
        delete newArrangements[currentTabName];
      }
      // Move highlights if any
      if (newHighlights[currentTabName]) {
        newHighlights[tabName] = newHighlights[currentTabName];
        delete newHighlights[currentTabName];
      }
      // Move goLive date
      if (newGoLiveDates[currentTabName]) {
        newGoLiveDates[tabName] = newGoLiveDates[currentTabName];
        delete newGoLiveDates[currentTabName];
      }
      // Move tab baseline
      if (newTabBaselines[currentTabName]) {
        newTabBaselines[tabName] = newTabBaselines[currentTabName];
        delete newTabBaselines[currentTabName];
      }
    } else if (!currentTabName && newGoLiveDates['__working__']) {
      // Transfer from __working__ to new tab name
      newGoLiveDates[tabName] = newGoLiveDates['__working__'];
      delete newGoLiveDates['__working__'];
    }
    
    // Save current work under new name
    newArrangements[tabName] = JSON.parse(JSON.stringify(currentWork));
    
    // Save this tab's baseline (the baseline it was created from)
    if (baseline && !newTabBaselines[tabName]) {
      newTabBaselines[tabName] = baseline;
    }
    
    // Generate highlights for new tab based on baseline comparison
    if (baseline && baselineSnapshot && !newHighlights[tabName]) {
      const highlights = {};
      LOCALES.forEach(locale => {
        highlights[locale] = {};
        const baselineLocaleData = baselineSnapshot?.[locale] || {};
        SLOTS.forEach(slot => {
          const oldBanner = baselineSnapshot?.[locale]?.[slot];
          const newBanner = currentWork?.[locale]?.[slot];
          if (newBanner && oldBanner !== newBanner) {
            // Check if banner exists in THIS LOCALE in baseline (any slot)
            const existsInThisLocale = Object.values(baselineLocaleData).includes(newBanner);
            highlights[locale][slot] = existsInThisLocale ? 'blue' : 'red';
          }
        });
      });
      newHighlights[tabName] = highlights;
    }
    
    setArrangements(newArrangements);
    setImportedHighlights(newHighlights);
    setGoLiveDates(newGoLiveDates);
    setTabBaselines(newTabBaselines);
    
    // Set as current working tab name but DO NOT change baseline
    // This keeps the color highlighting intact
    setCurrentTabName(tabName);
    setIsEditingWorking(false); // No longer editing unsaved working
    
    setModals(prev => ({ ...prev, saveTab: false }));
    showToast(`✅ Saved as "${tabName}"`);
  };
  
  // Create new arrangement from a selected baseline
  const createNewArrangement = (baselineTab) => {
    const baselineData = arrangements[baselineTab];
    if (!baselineData) return;
    
    setCurrentWork(JSON.parse(JSON.stringify(baselineData)));
    setCurrentTabName(null); // Fresh working, unsaved
    setIsEditingWorking(true); // Now editing Working tab
    setBaseline(baselineTab);
    setBaselineSnapshot(JSON.parse(JSON.stringify(baselineData)));
    showToast(`✅ New arrangement from "${baselineTab}"`);
  };
  
  // Cancel/remove Working tab
  const cancelWorking = () => {
    setIsEditingWorking(false);
    // Clear working go live date
    const newGoLiveDates = { ...goLiveDates };
    delete newGoLiveDates['__working__'];
    setGoLiveDates(newGoLiveDates);
    
    // Load baseline tab for editing
    if (baseline && arrangements[baseline]) {
      setCurrentWork(JSON.parse(JSON.stringify(arrangements[baseline])));
      setCurrentTabName(baseline);
      setBaselineSnapshot(JSON.parse(JSON.stringify(arrangements[baseline])));
    } else {
      // No baseline, load first available tab
      const firstTab = Object.keys(arrangements)[0];
      if (firstTab) {
        setCurrentWork(JSON.parse(JSON.stringify(arrangements[firstTab])));
        setCurrentTabName(firstTab);
        setBaseline(firstTab);
        setBaselineSnapshot(JSON.parse(JSON.stringify(arrangements[firstTab])));
      } else {
        setCurrentWork({});
        setCurrentTabName(null);
        setBaselineSnapshot(null);
      }
    }
    showToast('🗑️ Cancelled working tab');
  };

  // Delete a tab
  const deleteTab = (tabName) => {
    if (!tabName || !arrangements[tabName]) return;
    
    const newArrangements = { ...arrangements };
    delete newArrangements[tabName];
    
    // Also remove from importedHighlights
    const newHighlights = { ...importedHighlights };
    delete newHighlights[tabName];
    
    // Also remove from goLiveDates
    const newGoLiveDates = { ...goLiveDates };
    delete newGoLiveDates[tabName];
    
    // Also remove from tabBaselines
    const newTabBaselines = { ...tabBaselines };
    delete newTabBaselines[tabName];
    
    setArrangements(newArrangements);
    setImportedHighlights(newHighlights);
    setGoLiveDates(newGoLiveDates);
    setTabBaselines(newTabBaselines);
    
    // If deleted tab was current, switch to another
    if (currentTabName === tabName) {
      const remainingTabs = Object.keys(newArrangements);
      if (remainingTabs.length > 0) {
        const newCurrentTab = remainingTabs[remainingTabs.length - 1];
        setCurrentWork(JSON.parse(JSON.stringify(newArrangements[newCurrentTab])));
        setCurrentTabName(newCurrentTab);
        setBaseline(newCurrentTab);
        setBaselineSnapshot(JSON.parse(JSON.stringify(newArrangements[newCurrentTab])));
      } else {
        // No tabs left
        setCurrentWork({});
        setCurrentTabName(null);
        setBaseline(null);
        setBaselineSnapshot(null);
      }
    }
    
    // If deleted tab was baseline, clear baseline
    if (baseline === tabName) {
      setBaseline(null);
      setBaselineSnapshot(null);
    }
    
    setModals(prev => ({ ...prev, deleteTab: false }));
    showToast(`🗑️ Deleted "${tabName}"`);
  };

  // Rename a tab
  const renameTab = (oldName, newName) => {
    if (!oldName || !newName || !arrangements[oldName] || oldName === newName) return;
    if (arrangements[newName]) {
      showToast('❌ Tab name already exists');
      return;
    }
    
    const newArrangements = { ...arrangements };
    newArrangements[newName] = newArrangements[oldName];
    delete newArrangements[oldName];
    
    const newHighlights = { ...importedHighlights };
    if (newHighlights[oldName]) {
      newHighlights[newName] = newHighlights[oldName];
      delete newHighlights[oldName];
    }
    
    const newGoLiveDates = { ...goLiveDates };
    if (newGoLiveDates[oldName]) {
      newGoLiveDates[newName] = newGoLiveDates[oldName];
      delete newGoLiveDates[oldName];
    }
    
    const newTabBaselines = { ...tabBaselines };
    if (newTabBaselines[oldName]) {
      newTabBaselines[newName] = newTabBaselines[oldName];
      delete newTabBaselines[oldName];
    }
    // Also update any tabs that use oldName as their baseline
    Object.keys(newTabBaselines).forEach(tab => {
      if (newTabBaselines[tab] === oldName) {
        newTabBaselines[tab] = newName;
      }
    });
    
    setArrangements(newArrangements);
    setImportedHighlights(newHighlights);
    setGoLiveDates(newGoLiveDates);
    setTabBaselines(newTabBaselines);
    
    if (currentTabName === oldName) {
      setCurrentTabName(newName);
    }
    if (baseline === oldName) {
      setBaseline(newName);
    }
    
    setModals(prev => ({ ...prev, renameTab: false }));
    showToast(`✅ Renamed to "${newName}"`);
  };

  // ── Campaign Management ──────────────────────────────────────────
  const currentYear = new Date().getFullYear();

  const toggleCampaignActive = (id) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const deleteCampaign = (id) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    showToast('🗑️ Campaign removed');
  };

  const addCampaign = (name, date, notes) => {
    const newCampaign = {
      id: `custom_${Date.now()}`,
      name,
      type: 'custom',
      dateOverride: date || null,
      notes: notes || '',
      active: true
    };
    setCampaigns(prev => [...prev, newCampaign]);
    setModals(prev => ({ ...prev, addCampaign: false }));
    showToast(`✅ Added: ${name}`);
  };

  const updateCampaignDate = (id, newDate) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, dateOverride: newDate || null } : c));
  };

  // Build sorted campaign list with calculated dates
  const campaignsWithDates = campaigns
    .filter(c => c.active)
    .map(c => {
      const date = getCampaignDate(c, currentYear);
      const daysUntil = date ? getDaysUntil(date) : null;
      return { ...c, date, daysUntil };
    })
    .sort((a, b) => {
      if (a.date === null && b.date === null) return 0;
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date - b.date;
    });

  // Upcoming = within 7 days AND not past
  const urgentCampaigns = campaignsWithDates.filter(c => c.daysUntil !== null && c.daysUntil >= 0 && c.daysUntil <= 7);
  // Next upcoming (for slim bar fallback when nothing is within 7 days)
  const nextUpcoming = campaignsWithDates.find(c => c.daysUntil !== null && c.daysUntil > 0);

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Razer Banner Manager';
      workbook.created = new Date();

      // Colors matching preview UI
      const colors = {
        headerBg: '1A1A1A',           // Dark header background (matches preview)
        headerFont: 'FFFFFF',          // White text for header
        slotABg: 'FFFFCC',            // Zone A - light yellow (#FFFFCC)
        slotBBg: 'DAF2D0',            // Zone B - light green (#DAF2D0)
        slotAFont: '92400E',          // Zone A slot label color
        slotBFont: '166534',          // Zone B slot label color
        statusBg: 'FFFFFF',           // Status row - white background
        statusSuccessFont: '16A34A',
        statusWarningFont: 'D97706',
        statusErrorFont: 'DC2626',
        changedFont: 'DC2626',        // Red for changed
        movedFont: '2563EB',          // Blue for moved
        normalFont: '111111',         // Normal text
        borderColor: 'D1D5DB',
        razerGreen: '44D62C'          // Razer green accent
      };

      const thinBorder = {
        top: { style: 'thin', color: { argb: colors.borderColor } },
        left: { style: 'thin', color: { argb: colors.borderColor } },
        bottom: { style: 'thin', color: { argb: colors.borderColor } },
        right: { style: 'thin', color: { argb: colors.borderColor } }
      };

      const greenBottomBorder = {
        top: { style: 'thin', color: { argb: colors.borderColor } },
        left: { style: 'thin', color: { argb: colors.borderColor } },
        bottom: { style: 'medium', color: { argb: colors.razerGreen } },
        right: { style: 'thin', color: { argb: colors.borderColor } }
      };

      const getExportHighlightColor = (data, locale, slot, tabName) => {
        // First check if tab has saved highlights from import
        if (tabName && importedHighlights[tabName]?.[locale]?.[slot]) {
          return importedHighlights[tabName][locale][slot];
        }
        
        // Determine effective baseline for this tab
        let effectiveSnapshot = null;
        if (tabName === 'Current Work') {
          // For current work, use the active baseline
          if (isEditingWorking && !currentTabName) {
            effectiveSnapshot = baselineSnapshot;
          } else if (currentTabName && tabBaselines[currentTabName]) {
            const baselineTab = tabBaselines[currentTabName];
            effectiveSnapshot = arrangements[baselineTab] || null;
          }
        } else if (tabName && tabBaselines[tabName]) {
          // For saved tabs, use their stored baseline
          const baselineTab = tabBaselines[tabName];
          effectiveSnapshot = arrangements[baselineTab] || null;
        }
        
        // If no baseline found, no highlighting
        if (!effectiveSnapshot) return 'none';
        
        const oldBanner = effectiveSnapshot?.[locale]?.[slot];
        const newBanner = data?.[locale]?.[slot];
        if (!newBanner || oldBanner === newBanner) return 'none';
        
        // Check if banner exists in THIS LOCALE in baseline (any slot)
        const baselineLocaleData = effectiveSnapshot?.[locale] || {};
        const existsInThisLocale = Object.values(baselineLocaleData).includes(newBanner);
        
        return existsInThisLocale ? 'blue' : 'red';
      };

      const getExportLocaleStatus = (data, locale) => {
        const locData = data[locale] || {};
        const values = Object.values(locData);
        const duplicates = values.filter((b, i) => values.indexOf(b) !== i);
        const filled = Object.keys(locData).length;
        const ineligible = values.filter(bn => {
          const b = banners.find(x => x.name === bn);
          return b && !b.eligibleLocales.includes(locale);
        });
        if (ineligible.length > 0) return { status: 'error', message: `ERROR: ${ineligible.join(', ')}` };
        if (duplicates.length > 0) return { status: 'error', message: `${duplicates.length} duplicates` };
        if (filled < 9) return { status: 'warning', message: `${filled}/9 filled` };
        return { status: 'success', message: '✓ Complete' };
      };

      const allTabs = { 'Current Work': currentWork, ...arrangements };
      
      Object.keys(allTabs).forEach(tabName => {
        const data = allTabs[tabName];
        const ws = workbook.addWorksheet(tabName.substring(0, 31));
        ws.columns = [{ header: 'Slot', key: 'position', width: 12 }, ...LOCALES.map(loc => ({ header: loc, key: loc, width: 20 }))];

        // Header row - dark background, white text, green bottom border
        const headerRow = ws.getRow(1);
        headerRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
          cell.font = { bold: true, color: { argb: colors.headerFont } };
          cell.border = greenBottomBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        headerRow.height = 28;

        // Data rows
        SLOTS.forEach(slot => {
          const rowData = { position: slot };
          LOCALES.forEach(locale => { rowData[locale] = data?.[locale]?.[slot] || ''; });
          const row = ws.addRow(rowData);
          row.height = 25;
          row.eachCell((cell, colNum) => {
            const isSlotA = slot.startsWith('A');
            // Slot column uses same bg as data cells
            const bgColor = isSlotA ? colors.slotABg : colors.slotBBg;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            cell.border = thinBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (colNum === 1) {
              // Slot label (A1, A2, B1, etc.) - bold with appropriate color
              cell.font = { bold: true, color: { argb: isSlotA ? colors.slotAFont : colors.slotBFont } };
            } else {
              const locale = LOCALES[colNum - 2];
              if (locale) {
                const highlight = getExportHighlightColor(data, locale, slot, tabName);
                if (highlight === 'red') cell.font = { bold: true, color: { argb: colors.changedFont } };
                else if (highlight === 'blue') cell.font = { bold: true, color: { argb: colors.movedFont } };
                else cell.font = { color: { argb: colors.normalFont } };
              } else {
                cell.font = { color: { argb: colors.normalFont } };
              }
            }
          });
        });

        // Status row - white background, colored text only
        const statusRowData = { position: 'Status' };
        LOCALES.forEach(locale => { statusRowData[locale] = getExportLocaleStatus(data, locale).message; });
        const statusRow = ws.addRow(statusRowData);
        statusRow.height = 25;
        statusRow.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.statusBg } };
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum === 1) {
            cell.font = { bold: true, color: { argb: '6B7280' } }; // Gray text for "Status" label
          } else {
            const locale = LOCALES[colNum - 2];
            const status = getExportLocaleStatus(data, locale);
            const fontColor = status.status === 'error' ? colors.statusErrorFont : status.status === 'warning' ? colors.statusWarningFont : colors.statusSuccessFont;
            cell.font = { bold: true, color: { argb: fontColor } };
          }
        });

        ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Razer_Banner_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ Exported with colors!');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('❌ Export failed');
    }
  };

  const sortedDates = Object.keys(arrangements).reverse(); // Latest added tabs first
  
  // Display data: always use currentWork (editable)
  const displayData = currentWork;
  
  // Effective tab for GO LIVE display
  const effectiveTab = currentTabName || (isEditingWorking ? '__working__' : sortedDates[0]);
  
  const getSlotBg = (slot) => slot.startsWith('A') ? '#FFFFCC' : '#DAF2D0';
  const getTextColor = (locale, slot) => {
    const c = getHighlightColor(locale, slot);
    return c === 'red' ? '#dc2626' : c === 'blue' ? '#2563eb' : RAZER.black;
  };

  const fontFamily = "'RazerF5', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', padding: 16, fontFamily }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{ 
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', 
          backgroundColor: RAZER.black, color: 'white', padding: '12px 24px', borderRadius: 6, 
          zIndex: 9999, fontWeight: 500, 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          fontFamily
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* Header - Black background, green text */}
        <div style={{ 
          background: RAZER.black, 
          color: 'white', borderRadius: 8, padding: '24px 28px', marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 4, fontFamily, letterSpacing: '0.05em', color: RAZER.green }}>
                RAZER HOMEPAGE BANNER BUILDER Y26
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Drag & drop anywhere • Swap A↔B slots • Auto-import banners</p>
            </div>
            {(() => {
              // Show effective baseline for current context
              const effectiveBaseline = (isEditingWorking && !currentTabName) 
                ? baseline 
                : (currentTabName && tabBaselines[currentTabName]) 
                  ? tabBaselines[currentTabName] 
                  : null;
              return effectiveBaseline ? (
                <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: RAZER.white, padding: '8px 16px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)' }}>
                  Baseline: <span style={{ fontWeight: 700 }}>{effectiveBaseline}</span>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Toolbar - Minimal Clean */}
        <div style={{ 
          backgroundColor: 'white', borderRadius: 8, 
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', 
          padding: '12px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          {/* Tab Selector - Primary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {Object.keys(arrangements).length > 0 ? (
              <select 
                value={currentTabName || (isEditingWorking ? '__working__' : sortedDates[0] || '')} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__working__') {
                    // Switch back to Working tab (if exists)
                    return;
                  } else if (val && arrangements[val]) {
                    // Load selected tab for editing
                    setCurrentWork(JSON.parse(JSON.stringify(arrangements[val])));
                    setCurrentTabName(val);
                    setIsEditingWorking(false);
                    // DON'T clear baseline - keep it for future Working tabs
                  }
                }} 
                style={{ 
                  border: '2px solid #166534', borderRadius: 8, padding: '10px 16px', 
                  fontSize: 14, backgroundColor: '#f0fdf4', minWidth: 200, fontWeight: 600,
                  color: '#166534', cursor: 'pointer'
                }}
              >
                {/* Working option - only if editing unsaved */}
                {isEditingWorking && !currentTabName && (
                  <option value="__working__">📝 Working (unsaved)</option>
                )}
                {/* Saved tabs */}
                {sortedDates.map(d => (
                  <option key={d} value={d}>
                    {d === currentTabName ? '📝 ' : '📅 '}{d}{d === baseline ? ' ★' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ 
                padding: '10px 16px', fontSize: 13, color: '#64748b', 
                backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1'
              }}>
                Import Excel to start →
              </div>
            )}
            
            {/* New button - disabled when already editing Working */}
            {Object.keys(arrangements).length > 0 && (
              <button 
                onClick={() => setModals(prev => ({ ...prev, newArrangement: true }))} 
                disabled={isEditingWorking && !currentTabName}
                title={isEditingWorking && !currentTabName ? 'Save or cancel current Working first' : 'Create new arrangement'}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  backgroundColor: (isEditingWorking && !currentTabName) ? '#e5e7eb' : '#166534', 
                  color: '#fff', 
                  padding: '10px 18px', borderRadius: 8, border: 'none', 
                  cursor: (isEditingWorking && !currentTabName) ? 'not-allowed' : 'pointer', 
                  fontSize: 14, fontWeight: 700,
                  opacity: (isEditingWorking && !currentTabName) ? 0.5 : 1
                }}
              >
                <Plus size={16} /> New
              </button>
            )}
            
            {/* Save button - only when editing */}
            {(isEditingWorking || currentTabName) && (
              <button 
                onClick={() => setModals(prev => ({ ...prev, saveTab: true }))} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  backgroundColor: '#0f172a', 
                  color: '#fff', 
                  padding: '10px 18px', borderRadius: 8, border: 'none', 
                  cursor: 'pointer', 
                  fontSize: 14, fontWeight: 700
                }}
              >
                Save
              </button>
            )}
            
            {/* Cancel Working button - show when editing unsaved Working */}
            {isEditingWorking && !currentTabName && (
              <button 
                onClick={cancelWorking}
                title="Cancel Working"
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '10px 14px', borderRadius: 8,
                  backgroundColor: '#fef2f2', color: '#dc2626',
                  border: '1px solid #fecaca', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600
                }}
              >
                <X size={16} /> Cancel
              </button>
            )}
            
            {/* Delete Tab button */}
            {Object.keys(arrangements).length > 0 && (
              <button 
                onClick={() => setModals(prev => ({ ...prev, deleteTab: true }))} 
                title="Delete Tab"
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: 8,
                  backgroundColor: '#fff4e5', color: '#c2410c',
                  border: '1px solid #fed7aa', cursor: 'pointer'
                }}
              >
                <Trash2 size={18} />
              </button>
            )}
            
            {/* Rename Tab button - show when viewing/editing any saved tab */}
            {(currentTabName || (!isEditingWorking && sortedDates.length > 0)) && (
              <button 
                onClick={() => setModals(prev => ({ ...prev, renameTab: true }))} 
                title="Rename Tab"
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: 8,
                  backgroundColor: '#f0f9ff', color: '#0369a1',
                  border: '1px solid #bae6fd', cursor: 'pointer'
                }}
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
          
          {/* Divider */}
          <div style={{ width: 1, height: 32, backgroundColor: '#e2e8f0' }} />
          
          {/* File - Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 6, cursor: 'pointer',
              backgroundColor: '#f1f5f9', color: '#475569',
              border: '1px solid #e2e8f0'
            }} title="Import Excel">
              <Upload size={18} />
              <input type="file" accept=".xlsx" onChange={handleImportExcel} style={{ display: 'none' }} />
            </label>
            <button onClick={exportExcel} title="Export Excel" style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 6, cursor: 'pointer',
              backgroundColor: '#f1f5f9', color: '#475569',
              border: '1px solid #e2e8f0'
            }}>
              <Download size={18} />
            </button>
          </div>
          
          {/* Divider */}
          <div style={{ width: 1, height: 32, backgroundColor: '#e2e8f0' }} />
          
          {/* Edit - Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button 
              onClick={() => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex - 1]))); showToast('↶ Undo'); }}} 
              disabled={historyIndex <= 0} 
              title="Undo"
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6,
                backgroundColor: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0',
                cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                opacity: historyIndex <= 0 ? 0.4 : 1
              }}
            >↶</button>
            <button 
              onClick={() => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex + 1]))); showToast('↷ Redo'); }}} 
              disabled={historyIndex >= history.length - 1} 
              title="Redo"
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6,
                backgroundColor: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0',
                cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                opacity: historyIndex >= history.length - 1 ? 0.4 : 1
              }}
            >↷</button>
            <button 
              onClick={() => setModals(prev => ({ ...prev, findReplace: true }))} 
              title="Find & Replace"
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6,
                backgroundColor: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0', cursor: 'pointer'
              }}
            >
              <Search size={18} />
            </button>
            <button 
              onClick={() => setModals(prev => ({ ...prev, duplicate: true }))} 
              disabled={false} 
              title="Duplicate Arrangement"
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6,
                backgroundColor: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                opacity: 1
              }}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          
          <div style={{ flex: 1 }} />
          
          {/* Reset */}
          <button 
            onClick={() => { 
              // Determine effective baseline for current tab
              let effectiveBaseline = null;
              let effectiveSnapshot = null;
              
              if (isEditingWorking && !currentTabName) {
                // Working tab - use current baseline
                effectiveBaseline = baseline;
                effectiveSnapshot = baselineSnapshot;
              } else if (currentTabName && tabBaselines[currentTabName]) {
                // Saved tab - use its stored baseline
                effectiveBaseline = tabBaselines[currentTabName];
                effectiveSnapshot = arrangements[effectiveBaseline] ? arrangements[effectiveBaseline] : null;
              }
              
              if (!effectiveBaseline || !effectiveSnapshot) { 
                showToast('⚠️ No baseline for this tab'); 
                return; 
              }
              setCurrentWork(JSON.parse(JSON.stringify(effectiveSnapshot)));
              showToast(`✓ Reset to ${effectiveBaseline}`);
            }} 
            disabled={!(isEditingWorking ? baseline : (currentTabName && tabBaselines[currentTabName]))}
            title="Reset to Baseline"
            style={{ 
              display: 'flex', alignItems: 'center', gap: 6, 
              backgroundColor: (!(isEditingWorking ? baseline : (currentTabName && tabBaselines[currentTabName]))) ? '#f8fafc' : '#fef2f2', 
              color: (!(isEditingWorking ? baseline : (currentTabName && tabBaselines[currentTabName]))) ? '#94a3b8' : '#dc2626', 
              padding: '8px 14px', borderRadius: 6, 
              border: `1px solid ${(!(isEditingWorking ? baseline : (currentTabName && tabBaselines[currentTabName]))) ? '#e2e8f0' : '#fecaca'}`, 
              cursor: (!(isEditingWorking ? baseline : (currentTabName && tabBaselines[currentTabName]))) ? 'not-allowed' : 'pointer', 
              fontSize: 13, fontWeight: 500 
            }}
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        {/* Campaign Tracker Bar */}
        <div style={{
          backgroundColor: urgentCampaigns.length > 0 ? '#fef3c7' : 'white',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          marginBottom: 20,
          border: urgentCampaigns.length > 0 ? '1px solid #f59e0b' : '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {/* Slim Bar — always visible */}
          <div
            onClick={() => setCampaignPanelOpen(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px', cursor: 'pointer', userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} color={urgentCampaigns.length > 0 ? '#d97706' : '#6b7280'} />
                <span style={{ fontWeight: 700, fontSize: 13, color: RAZER.black }}>Campaigns</span>
              </div>
              {urgentCampaigns.length > 0 ? (
                urgentCampaigns.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    backgroundColor: c.daysUntil <= 3 ? '#fecaca' : '#fef08a',
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    color: c.daysUntil <= 3 ? '#991b1b' : '#92400e'
                  }}>
                    <AlertTriangle size={12} />
                    {c.name} — {c.daysUntil === 0 ? 'TODAY' : c.daysUntil === 1 ? 'Tomorrow' : `${c.daysUntil}d`}
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {nextUpcoming
                    ? `Next: ${nextUpcoming.name} (${formatCampaignDate(nextUpcoming.date)}, ${nextUpcoming.daysUntil}d away)`
                    : 'No upcoming campaigns'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{campaigns.filter(c => c.active).length} active</span>
              {campaignPanelOpen ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
            </div>
          </div>

          {/* Expanded Panel */}
          {campaignPanelOpen && (
            <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 20px' }}>
              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: RAZER.black }}>
                  {currentYear} Campaign Calendar
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setModals(prev => ({ ...prev, addCampaign: true })); }}
                    style={{
                      backgroundColor: RAZER.green, color: 'white', border: 'none', borderRadius: 4,
                      padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <Plus size={12} /> Add Campaign
                  </button>
                </div>
              </div>

              {/* Campaign List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {campaignsWithDates.map(c => {
                  const isPast = c.daysUntil !== null && c.daysUntil < 0;
                  const isUrgent = c.daysUntil !== null && c.daysUntil >= 0 && c.daysUntil <= 7;
                  const isVariable = c.type === 'variable';
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 6, fontSize: 13,
                      backgroundColor: isPast ? '#f9fafb' : isUrgent ? '#fef3c7' : '#ffffff',
                      border: `1px solid ${isPast ? '#e5e7eb' : isUrgent ? '#f59e0b' : '#e5e7eb'}`,
                      opacity: isPast ? 0.5 : 1
                    }}>
                      {/* Date badge */}
                      <div style={{
                        minWidth: 54, textAlign: 'center', padding: '4px 6px', borderRadius: 4,
                        backgroundColor: isPast ? '#e5e7eb' : isUrgent ? '#dc2626' : '#f1f5f9',
                        color: isPast ? '#9ca3af' : isUrgent ? 'white' : '#374151',
                        fontSize: 11, fontWeight: 700, lineHeight: 1.3
                      }}>
                        {c.date ? (
                          <>
                            <div>{c.date.toLocaleDateString('en-US', { month: 'short' })}</div>
                            <div style={{ fontSize: 14 }}>{c.date.getDate()}</div>
                          </>
                        ) : <div>TBD</div>}
                      </div>

                      {/* Campaign info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: RAZER.black, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {c.name}
                          {isVariable && !c.dateOverride && (
                            <span style={{ fontSize: 9, backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 4px', borderRadius: 3, fontWeight: 500 }}>date varies</span>
                          )}
                        </div>
                        {c.notes && <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.notes}</div>}
                      </div>

                      {/* Days countdown */}
                      <div style={{ fontSize: 11, fontWeight: 600, color: isPast ? '#9ca3af' : isUrgent ? '#dc2626' : '#6b7280', whiteSpace: 'nowrap' }}>
                        {c.daysUntil === null ? '' : c.daysUntil === 0 ? 'TODAY' : c.daysUntil < 0 ? `${Math.abs(c.daysUntil)}d ago` : `${c.daysUntil}d`}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        {/* Edit date (for variable/custom campaigns) */}
                        {(c.type === 'variable' || c.type === 'custom') && (
                          <input
                            type="date"
                            value={c.dateOverride || ''}
                            onChange={(e) => updateCampaignDate(c.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            title="Set date"
                            style={{
                              width: 20, height: 20, opacity: 0.5, cursor: 'pointer',
                              border: 'none', padding: 0, backgroundColor: 'transparent'
                            }}
                          />
                        )}
                        {/* Toggle active */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCampaignActive(c.id); }}
                          title={c.active ? 'Skip this year' : 'Activate'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: '#9ca3af', fontSize: 14
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Show inactive campaigns */}
                {campaigns.filter(c => !c.active).length > 0 && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #d1d5db', paddingTop: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>
                      Skipped this year ({campaigns.filter(c => !c.active).length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {campaigns.filter(c => !c.active).map(c => (
                        <div key={c.id} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 4, fontSize: 11,
                          backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb'
                        }}>
                          {c.name}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCampaignActive(c.id); }}
                            title="Re-activate"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: RAZER.green, fontWeight: 700, fontSize: 11 }}
                          >+</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }}
                            title="Delete permanently"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#dc2626', fontWeight: 700, fontSize: 11 }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left Panel - Banners */}
          <div style={{ 
            backgroundColor: 'white', borderRadius: 8, 
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 16, 
            position: 'sticky', top: 16, alignSelf: 'start',
            border: `2px solid ${RAZER.green}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontWeight: 600, fontSize: 14, color: RAZER.black }}>
                Banners <span style={{ color: RAZER.gray, fontWeight: 400 }}>({banners.length})</span>
              </h2>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setModals(prev => ({ ...prev, addBanner: true }))}
                  style={{
                    backgroundColor: RAZER.green, color: RAZER.white, border: 'none',
                    borderRadius: 4, cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700
                  }}
                >
                  <Plus size={14} /> Add
                </button>
                {banners.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete all ${banners.length} banners? This cannot be undone.`)) {
                        setBanners([]);
                        showToast(`🗑️ Deleted all banners`);
                      }
                    }}
                    style={{
                      backgroundColor: '#dc2626', color: RAZER.white, border: 'none',
                      borderRadius: 4, cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 700
                    }}
                  >
                    <Trash2 size={14} /> Del All
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: 11, color: RAZER.gray, marginBottom: 12 }}>Drag to any slot (A↔B supported)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
              {banners.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: RAZER.gray, fontSize: 13 }}>
                  No banners yet.<br/>Import Excel or add manually.
                </div>
              ) : (
                banners.map((banner, index) => (
                  <div 
                    key={banner.name} 
                    draggable={true}
                    onDragStart={() => { setDraggedBanner(banner.name); setDraggedBannerIndex(index); setDraggedFromSlot(null); }}
                    onDragEnd={resetDragState}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedBannerIndex !== null && draggedBannerIndex !== index && !draggedFromSlot) handleBannerReorder(draggedBannerIndex, index); resetDragState(); }}
                    style={{ 
                      backgroundColor: '#fafafa', 
                      border: '1px solid #e0e0e0', 
                      borderLeft: `3px solid ${RAZER.green}`,
                      borderRadius: 6, padding: 10, 
                      cursor: true ? 'grab' : 'default', 
                      opacity: draggedBannerIndex === index ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* NEW indicator - small green dot for banners created today */}
                        {banner.createdAt && new Date(banner.createdAt).toDateString() === new Date().toDateString() && (
                          <div style={{ 
                            width: 6, height: 6, 
                            backgroundColor: RAZER.green, 
                            borderRadius: '50%',
                            flexShrink: 0
                          }} title="Added today" />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: RAZER.black }}>{banner.name}</div>
                          <div style={{ fontSize: 11, color: RAZER.gray }}>{banner.eligibleLocales.length === LOCALES.length ? 'All locales' : `${banner.eligibleLocales.length} locales`}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); setModals(prev => ({ ...prev, editBanner: banner })); }} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Edit2 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeBanner(banner.name); }} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Grid */}
          <div style={{ backgroundColor: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `2px solid ${RAZER.green}`, overflow: 'hidden' }}>
            {/* GO LIVE Header Bar */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: '10px 16px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: `2px solid ${RAZER.green}`,
              borderRadius: '6px 6px 0 0',
              position: 'relative',
              zIndex: 100
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: RAZER.black, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚀 GO LIVE
                </span>
                {(() => {
                  const activeTab = effectiveTab;
                  const storedDate = goLiveDates[activeTab] || '';
                  const datePart = storedDate.split('T')[0] || '';
                  const timePart = storedDate.split('T')[1] || '16:00';
                  
                  // Parse day/month from stored date (format: YYYY-MM-DD)
                  let day = '';
                  let month = '';
                  if (datePart) {
                    const parts = datePart.split('-');
                    if (parts.length === 3) {
                      month = parseInt(parts[1], 10); // 1-12
                      day = parseInt(parts[2], 10); // 1-31
                    }
                  }
                  
                  const isReadOnly = !isEditingWorking && !currentTabName;
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  
                  const updateDate = (newDay, newMonth) => {
                    const year = new Date().getFullYear();
                    const monthStr = String(newMonth).padStart(2, '0');
                    const dayStr = String(newDay).padStart(2, '0');
                    setGoLiveDates(prev => ({ ...prev, [activeTab]: `${year}-${monthStr}-${dayStr}T${timePart}` }));
                  };
                  
                  return (
                    <>
                      {/* Day dropdown */}
                      <select
                        value={day}
                        disabled={isReadOnly}
                        onChange={(e) => updateDate(e.target.value, month || 1)}
                        style={{ 
                          fontSize: 13, padding: '8px 12px', borderRadius: 6, 
                          border: `1px solid ${RAZER.green}`, 
                          backgroundColor: isReadOnly ? '#f3f4f6' : 'white', 
                          color: RAZER.black,
                          fontWeight: 600, 
                          cursor: isReadOnly ? 'default' : 'pointer',
                          minWidth: 60
                        }}
                      >
                        <option value="">--</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      
                      {/* Month dropdown */}
                      <select
                        value={month}
                        disabled={isReadOnly}
                        onChange={(e) => updateDate(day || 1, e.target.value)}
                        style={{ 
                          fontSize: 13, padding: '8px 12px', borderRadius: 6, 
                          border: `1px solid ${RAZER.green}`, 
                          backgroundColor: isReadOnly ? '#f3f4f6' : 'white', 
                          color: RAZER.black,
                          fontWeight: 600, 
                          cursor: isReadOnly ? 'default' : 'pointer',
                          minWidth: 70
                        }}
                      >
                        <option value="">---</option>
                        {months.map((m, i) => (
                          <option key={m} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      
                      {/* Time input */}
                      <input 
                        type="time" 
                        value={timePart}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const currentDate = datePart || `${new Date().getFullYear()}-01-01`;
                          setGoLiveDates(prev => ({ ...prev, [activeTab]: `${currentDate}T${e.target.value}` }));
                        }}
                        style={{ 
                          fontSize: 13, padding: '8px 12px', borderRadius: 6, 
                          border: `1px solid ${RAZER.green}`, 
                          backgroundColor: isReadOnly ? '#f3f4f6' : 'white', 
                          color: RAZER.black,
                          fontWeight: 500, 
                          cursor: isReadOnly ? 'default' : 'pointer'
                        }}
                      />
                    </>
                  );
                })()}
                <span style={{ fontSize: 11, color: RAZER.gray }}>SGT</span>
              </div>
            </div>
            
            {/* Grid Table */}
            <div style={{ padding: '16px 16px 16px 16px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
              <style>{`
                .grid-scroll-container {
                  display: block;
                  width: 100%;
                  max-width: 100%;
                  overflow-x: scroll;
                  overflow-y: hidden;
                  -webkit-overflow-scrolling: touch;
                }
                .grid-scroll-container::-webkit-scrollbar {
                  height: 16px;
                  background: #f1f5f9;
                }
                .grid-scroll-container::-webkit-scrollbar-track {
                  background: #f1f5f9;
                  border-radius: 8px;
                }
                .grid-scroll-container::-webkit-scrollbar-thumb {
                  background: #94a3b8;
                  border-radius: 8px;
                  border: 3px solid #f1f5f9;
                }
                .grid-scroll-container::-webkit-scrollbar-thumb:hover {
                  background: #64748b;
                }
                /* Firefox */
                .grid-scroll-container {
                  scrollbar-width: auto;
                  scrollbar-color: #94a3b8 #f1f5f9;
                }
              `}</style>
              <div className="grid-scroll-container" style={{ maxHeight: 'none' }}>
                <table style={{ width: '1900px', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: '#1a1a1a', color: RAZER.white, padding: 12, fontWeight: 700, position: 'sticky', left: 0, zIndex: 5, borderBottom: `2px solid ${RAZER.green}`, borderTop: '1px solid #333', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}>Slot</th>
                  {LOCALES.map((loc, idx) => (
                    <th key={loc} style={{ backgroundColor: '#1a1a1a', color: RAZER.white, padding: 12, fontWeight: 700, minWidth: 110, borderBottom: `2px solid ${RAZER.green}`, borderTop: '1px solid #333', borderRight: '1px solid #333' }}>{loc}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot, slotIdx) => (
                  <tr key={slot}>
                    <td style={{ 
                      padding: 10, fontWeight: 700, 
                      position: 'sticky', left: 0, zIndex: 5, 
                      backgroundColor: slot.startsWith('A') ? '#FFFFCC' : '#DAF2D0',
                      color: slot.startsWith('A') ? '#92400e' : '#166534',
                      borderTop: slotIdx === 0 ? '1px solid #d1d5db' : 'none',
                      borderBottom: '1px solid #d1d5db',
                      borderLeft: '1px solid #d1d5db',
                      borderRight: '1px solid #d1d5db'
                    }}>{slot}</td>
                    {LOCALES.map((locale, locIdx) => {
                      const banner = displayData?.[locale]?.[slot];
                      const isHovering = hoverSlot?.locale === locale && hoverSlot?.slot === slot;
                      return (
                        <td 
                          key={`${locale}-${slot}`}
                          onDragOver={(e) => handleDragOver(e, locale, slot)}
                          onDragLeave={() => setHoverSlot(null)}
                          onDrop={(e) => handleDrop(e, locale, slot)}
                          style={{ 
                            padding: 8, 
                            backgroundColor: slot.startsWith('A') ? '#FFFFCC' : '#DAF2D0', 
                            boxShadow: isHovering ? (hoverSlot?.eligible ? `inset 0 0 0 2px ${RAZER.green}` : 'inset 0 0 0 2px #ef4444') : 'none',
                            transition: 'box-shadow 0.15s ease',
                            borderTop: slotIdx === 0 ? '1px solid #d1d5db' : 'none',
                            borderBottom: '1px solid #d1d5db',
                            borderRight: '1px solid #d1d5db'
                          }}
                        >
                          {banner ? (
                            <div 
                              draggable={true} 
                              onDragStart={(e) => handleCellDragStart(e, locale, slot, banner)} 
                              onDragEnd={resetDragState} 
                              style={{ position: 'relative' }}
                              onMouseEnter={(e) => { const btn = e.currentTarget.querySelector('.clear-btn'); if (btn) btn.style.opacity = '1'; }}
                              onMouseLeave={(e) => { const btn = e.currentTarget.querySelector('.clear-btn'); if (btn) btn.style.opacity = '0'; }}
                            >
                              <div style={{ 
                                fontSize: 13, cursor: 'grab', 
                                color: getTextColor(locale, slot), 
                                fontWeight: getHighlightColor(locale, slot) !== 'none' ? 700 : 500 
                              }}>{banner}</div>
                              <button 
                                className="clear-btn"
                                onClick={() => clearSlot(locale, slot)} 
                                style={{ 
                                  position: 'absolute', top: -6, right: -6, 
                                  backgroundColor: '#ef4444', color: 'white', 
                                  borderRadius: '50%', padding: 3, border: 'none', cursor: 'pointer',
                                  opacity: 0, transition: 'opacity 0.15s'
                                }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>
                              {isHovering && !hoverSlot?.eligible ? '🚫' : '—'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Status Row */}
                <tr>
                  <td style={{ padding: 10, fontWeight: 700, position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'white', borderBottom: '1px solid #d1d5db', borderLeft: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', color: RAZER.gray }}>Status</td>
                  {LOCALES.map((locale, idx) => {
                    const status = getLocaleStatus(locale);
                    return (
                      <td key={locale} style={{ 
                        padding: 8, textAlign: 'center', fontSize: 12, fontWeight: 600,
                        backgroundColor: 'white',
                        color: status.status === 'error' ? '#dc2626' : status.status === 'warning' ? '#d97706' : '#16a34a',
                        borderBottom: '1px solid #d1d5db',
                        borderRight: '1px solid #d1d5db'
                      }}>
                        {status.message}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modals.addBanner && <AddBannerModal onSave={addNewBanner} onClose={() => setModals(prev => ({ ...prev, addBanner: false }))} />}
      {modals.editBanner && <EditBannerModal banner={modals.editBanner} onSave={updateBannerLocales} onClose={() => setModals(prev => ({ ...prev, editBanner: null }))} />}
      {modals.findReplace && <FindReplaceModal banners={banners} onReplace={findReplace} onClose={() => setModals(prev => ({ ...prev, findReplace: false }))} />}
      {modals.duplicate && <DuplicateModal onDuplicate={duplicateArrangement} onClose={() => setModals(prev => ({ ...prev, duplicate: false }))} />}
      {modals.saveTab && <SaveTabModal onSave={saveAsTab} onClose={() => setModals(prev => ({ ...prev, saveTab: false }))} currentName={currentTabName} />}
      {modals.newArrangement && <NewArrangementModal tabs={Object.keys(arrangements)} onCreate={createNewArrangement} onClose={() => setModals(prev => ({ ...prev, newArrangement: false }))} />}
      {modals.deleteTab && <DeleteTabModal tabs={Object.keys(arrangements)} currentTab={currentTabName} onDelete={deleteTab} onClose={() => setModals(prev => ({ ...prev, deleteTab: false }))} />}
      {modals.renameTab && <RenameTabModal currentName={currentTabName || sortedDates[0]} onRename={renameTab} onClose={() => setModals(prev => ({ ...prev, renameTab: false }))} />}
      {modals.addCampaign && <AddCampaignModal onSave={addCampaign} onClose={() => setModals(prev => ({ ...prev, addCampaign: false }))} />}

      {/* Confirm Delete Modal */}
      {modals.confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 8, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: RAZER.black }}>🗑️ Delete Banner?</h3>
            <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 8 }}>
              Are you sure you want to delete <strong>"{modals.confirmDelete}"</strong>?
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
              This will also remove it from all slots in the grid.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={confirmRemoveBanner} 
                style={{ flex: 1, backgroundColor: '#dc2626', color: 'white', padding: 10, borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                Delete
              </button>
              <button 
                onClick={() => setModals(prev => ({ ...prev, confirmDelete: null }))} 
                style={{ flex: 1, backgroundColor: '#f3f4f6', color: '#374151', padding: 10, borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Components - Clean styling
const modalOverlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 };
const modalBox = { backgroundColor: 'white', borderRadius: 8, padding: 24, maxWidth: 600, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' };
const modalTitle = { fontSize: 18, fontWeight: 600, marginBottom: 20, color: RAZER.black };
const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 4, padding: 10, fontSize: 14 };
const btnPrimary = { flex: 1, backgroundColor: RAZER.green, color: 'white', padding: 10, borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 700 };
const btnSecondary = { flex: 1, backgroundColor: '#f3f4f6', color: '#374151', padding: 10, borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 500 };

function AddBannerModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [selectedLocales, setSelectedLocales] = useState(LOCALES);
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Add New Banner</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Banner Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Summer Sale 2026" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Eligible Locales</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedLocales(LOCALES)} style={{ fontSize: 11, padding: '4px 10px', backgroundColor: RAZER.green, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>All</button>
              <button onClick={() => setSelectedLocales([])} style={{ fontSize: 11, padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>None</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', padding: 10, borderRadius: 4 }}>
            {LOCALES.map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={selectedLocales.includes(locale)} onChange={(e) => { if (e.target.checked) setSelectedLocales(prev => [...prev, locale]); else setSelectedLocales(prev => prev.filter(l => l !== locale)); }} />
                {locale}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!name.trim() || selectedLocales.length === 0) return alert('Fill all fields'); onSave(name.trim(), selectedLocales); }} style={btnPrimary}>Add Banner</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function EditBannerModal({ banner, onSave, onClose }) {
  const [selectedLocales, setSelectedLocales] = useState(banner.eligibleLocales);
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Edit: {banner.name}</h2>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Eligible Locales</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedLocales(LOCALES)} style={{ fontSize: 11, padding: '4px 10px', backgroundColor: RAZER.green, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>All</button>
              <button onClick={() => setSelectedLocales([])} style={{ fontSize: 11, padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>None</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', padding: 10, borderRadius: 4 }}>
            {LOCALES.map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={selectedLocales.includes(locale)} onChange={(e) => { if (e.target.checked) setSelectedLocales(prev => [...prev, locale]); else setSelectedLocales(prev => prev.filter(l => l !== locale)); }} />
                {locale}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (selectedLocales.length === 0) return alert('Select at least one'); onSave(banner.name, selectedLocales); }} style={btnPrimary}>Save Changes</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function FindReplaceModal({ banners, onReplace, onClose }) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [selectedLocales, setSelectedLocales] = useState(LOCALES);
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Find & Replace</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Find Banner</label>
          <select value={find} onChange={(e) => setFind(e.target.value)} style={inputStyle}>
            <option value="">-- Select banner --</option>
            {banners.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Replace With (empty = remove)</label>
          <input type="text" value={replace} onChange={(e) => setReplace(e.target.value)} style={inputStyle} placeholder="New banner name or leave empty" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>In Locales</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedLocales(LOCALES)} style={{ fontSize: 11, padding: '4px 10px', backgroundColor: RAZER.green, color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>All</button>
              <button onClick={() => setSelectedLocales([])} style={{ fontSize: 11, padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>None</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 140, overflowY: 'auto', border: '1px solid #e5e7eb', padding: 10, borderRadius: 4 }}>
            {LOCALES.map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={selectedLocales.includes(locale)} onChange={(e) => { if (e.target.checked) setSelectedLocales(prev => [...prev, locale]); else setSelectedLocales(prev => prev.filter(l => l !== locale)); }} />
                {locale}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => onReplace(find, replace, selectedLocales)} style={btnPrimary}>Replace All</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DuplicateModal({ onDuplicate, onClose }) {
  const [sourceLocale, setSourceLocale] = useState('US');
  const [targetLocales, setTargetLocales] = useState([]);
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Duplicate Arrangement</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Source Locale</label>
          <select value={sourceLocale} onChange={(e) => setSourceLocale(e.target.value)} style={inputStyle}>
            {LOCALES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Copy To</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', padding: 10, borderRadius: 4 }}>
            {LOCALES.filter(l => l !== sourceLocale).map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={targetLocales.includes(locale)} onChange={(e) => { if (e.target.checked) setTargetLocales(prev => [...prev, locale]); else setTargetLocales(prev => prev.filter(l => l !== locale)); }} />
                {locale}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (targetLocales.length === 0) return alert('Select target locales'); onDuplicate(sourceLocale, targetLocales); }} style={btnPrimary}>Duplicate</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SaveTabModal({ onSave, onClose, currentName }) {
  const now = new Date();
  const defaultName = currentName || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const [tabName, setTabName] = useState(defaultName);
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>{currentName ? 'Rename & Save Tab' : 'Save Tab'}</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Tab Name</label>
          <input 
            type="text" 
            value={tabName} 
            onChange={(e) => setTabName(e.target.value)} 
            style={inputStyle} 
            placeholder="e.g. 2-Feb-Vday" 
          />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            {currentName ? `Current: "${currentName}" → Will be renamed` : 'This will become your current working tab'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!tabName.trim()) return alert('Enter tab name'); onSave(tabName.trim()); }} style={btnPrimary}>Save</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function NewArrangementModal({ tabs, onCreate, onClose }) {
  const [selectedBaseline, setSelectedBaseline] = useState(tabs[tabs.length - 1] || '');
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>New Arrangement</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Create a new arrangement starting from an existing tab as baseline.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Select Baseline</label>
          <select value={selectedBaseline} onChange={(e) => setSelectedBaseline(e.target.value)} style={inputStyle}>
            {tabs.map(tab => <option key={tab} value={tab}>{tab}</option>)}
          </select>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            Changes will be highlighted compared to this baseline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!selectedBaseline) return; onCreate(selectedBaseline); onClose(); }} style={btnPrimary}>Create New</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DeleteTabModal({ tabs, currentTab, onDelete, onClose }) {
  const [selectedTab, setSelectedTab] = useState(tabs[0] || '');
  
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={{ ...modalTitle, color: '#dc2626' }}>🗑️ Delete Tab</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Select Tab to Delete</label>
          <select value={selectedTab} onChange={(e) => setSelectedTab(e.target.value)} style={inputStyle}>
            {tabs.map(tab => (
              <option key={tab} value={tab}>
                {tab} {tab === currentTab ? '(current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ 
          padding: 12, backgroundColor: '#fef2f2', borderRadius: 6, 
          marginBottom: 16, fontSize: 13, color: '#991b1b' 
        }}>
          ⚠️ Delete "<strong>{selectedTab}</strong>"? This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => onDelete(selectedTab)} 
            style={{ ...btnPrimary, backgroundColor: '#dc2626' }}
          >
            Delete
          </button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RenameTabModal({ currentName, onRename, onClose }) {
  const [newName, setNewName] = useState(currentName || '');
  
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={{ ...modalTitle, color: '#0369a1' }}>✏️ Rename Tab</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Current Name</label>
          <div style={{ padding: '10px 12px', backgroundColor: '#f3f4f6', borderRadius: 6, fontSize: 14, color: '#6b7280' }}>
            {currentName}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>New Name</label>
          <input 
            type="text" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            style={inputStyle} 
            placeholder="Enter new tab name"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => { if (newName.trim() && newName !== currentName) onRename(currentName, newName.trim()); }} 
            disabled={!newName.trim() || newName === currentName}
            style={{ 
              ...btnPrimary, 
              backgroundColor: (!newName.trim() || newName === currentName) ? '#94a3b8' : '#0369a1',
              cursor: (!newName.trim() || newName === currentName) ? 'not-allowed' : 'pointer'
            }}
          >
            Rename
          </button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function AddCampaignModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Add Campaign</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Campaign Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. RazerCon 2026" autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Leave empty if date is TBD</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="e.g. Check with Product team for assets" />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!name.trim()) return alert('Enter campaign name'); onSave(name.trim(), date || null, notes.trim()); }} style={btnPrimary}>Add Campaign</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
