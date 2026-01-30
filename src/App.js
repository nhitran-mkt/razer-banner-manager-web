import React, { useState, useEffect } from 'react';
import { Download, Plus, Edit2, Trash2, X, Upload, Search, RefreshCw } from 'lucide-react';
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


export default function RazerBannerTool() {
  const [banners, setBanners] = useState([]);
  const [arrangements, setArrangements] = useState({});
  const [currentWork, setCurrentWork] = useState(() => {
    const empty = {};
    LOCALES.forEach(loc => { empty[loc] = {}; });
    return empty;
  });
  const [baseline, setBaseline] = useState(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState(null);
  const [draggedBannerIndex, setDraggedBannerIndex] = useState(null);
  const [draggedBanner, setDraggedBanner] = useState(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [viewingTab, setViewingTab] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [modals, setModals] = useState({ addBanner: false, findReplace: false, duplicate: false, editBanner: null, saveTab: false, duplicateTab: false, confirmDelete: null });

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
      } catch (e) { console.error('Load failed', e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('razer-banner-data', JSON.stringify({ arrangements, banners, baseline, baselineSnapshot, currentWork }));
  }, [arrangements, banners, baseline, baselineSnapshot, currentWork]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if (viewingTab) return;
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
  }, [historyIndex, history, viewingTab]);

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

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const newArrangements = {};
        let latestDate = null;
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (jsonData.length < 14) return;
          
          const headers = jsonData[12];
          const localeIndices = {};
          headers.forEach((header, idx) => {
            const trimmed = String(header).trim();
            if (trimmed === 'Position') return;
            if (trimmed.includes('IT')) localeIndices['IT'] = idx;
            else if (LOCALES.includes(trimmed)) localeIndices[trimmed] = idx;
          });
          
          const arrangement = {};
          LOCALES.forEach(loc => { arrangement[loc] = {}; });
          
          for (let i = 13; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            const position = String(row[0]).trim();
            if (!SLOTS.includes(position)) continue;
            LOCALES.forEach(locale => {
              const idx = localeIndices[locale];
              if (idx !== undefined && row[idx]) {
                const bannerName = String(row[idx]).trim();
                if (bannerName) arrangement[locale][position] = bannerName;
              }
            });
          }
          
          newArrangements[sheetName] = arrangement;
          if (!latestDate || sheetName > latestDate) latestDate = sheetName;
        });
        
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
        setBaseline(latestDate);
        
        const baselineData = newArrangements[latestDate];
        if (baselineData) {
          setBaselineSnapshot(JSON.parse(JSON.stringify(baselineData)));
          setCurrentWork(JSON.parse(JSON.stringify(baselineData)));
          
          // Show detailed import message
          let message = `✅ Imported ${Object.keys(newArrangements).length} tabs`;
          if (addedCount > 0) message += `, +${addedCount} new banners`;
          if (skippedCount > 0) message += ` (${skippedCount} existing kept)`;
          showToast(message);
        }
      } catch (error) {
        console.error('Import failed:', error);
        showToast('❌ Import failed');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDragOver = (e, locale, slot) => {
    e.preventDefault();
    if (!draggedBanner || viewingTab) return;
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
    
    if (!draggedBanner || viewingTab) { resetDragState(); return; }

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
    if (viewingTab) { e.preventDefault(); return; }
    e.stopPropagation();
    setDraggedBanner(bannerName);
    setDraggedFromSlot({ locale, slot });
    setDraggedBannerIndex(null);
  };

  const getHighlightColor = (locale, slot) => {
    if (viewingTab || !baselineSnapshot) return 'none';
    const oldBanner = baselineSnapshot?.[locale]?.[slot];
    const newBanner = currentWork?.[locale]?.[slot];
    if (!newBanner || oldBanner === newBanner) return 'none';
    for (const loc of LOCALES) {
      if (Object.values(baselineSnapshot?.[loc] || {}).includes(newBanner)) return 'blue';
    }
    return 'red';
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
    if (viewingTab) return;
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

  const saveAsTab = (tabName, setAsBaseline) => {
    if (!tabName.trim()) return;
    const newArrangements = { ...arrangements, [tabName]: JSON.parse(JSON.stringify(currentWork)) };
    setArrangements(newArrangements);
    if (setAsBaseline) {
      setBaseline(tabName);
      setBaselineSnapshot(JSON.parse(JSON.stringify(currentWork)));
    }
    setModals(prev => ({ ...prev, saveTab: false }));
    showToast(`✅ Saved as "${tabName}"`);
  };

  const duplicateTab = (sourceTab, newTabName, loadToWorking) => {
    if (!sourceTab || !newTabName.trim()) return;
    const sourceData = arrangements[sourceTab];
    if (!sourceData) return;
    
    const newArrangements = { ...arrangements, [newTabName]: JSON.parse(JSON.stringify(sourceData)) };
    setArrangements(newArrangements);
    
    if (loadToWorking) {
      setCurrentWork(JSON.parse(JSON.stringify(sourceData)));
      setBaseline(newTabName);
      setBaselineSnapshot(JSON.parse(JSON.stringify(sourceData)));
    }
    
    setModals(prev => ({ ...prev, duplicateTab: false }));
    showToast(`✅ Created "${newTabName}" from "${sourceTab}"`);
  };

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Razer Banner Manager';
      workbook.created = new Date();

      // Colors matching preview UI
      const colors = {
        headerBg: '1A1A1A',           // Dark header background (matches preview)
        headerFont: 'FFFFFF',          // White text for header
        slotABg: 'FEFCE8',            // Zone A - light yellow (matches #fefce8)
        slotBBg: 'ECFDF5',            // Zone B - light green (matches #ecfdf5)
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

      const getExportHighlightColor = (data, locale, slot) => {
        if (!baselineSnapshot) return 'none';
        const oldBanner = baselineSnapshot?.[locale]?.[slot];
        const newBanner = data?.[locale]?.[slot];
        if (!newBanner || oldBanner === newBanner) return 'none';
        for (const loc of LOCALES) {
          if (Object.values(baselineSnapshot?.[loc] || {}).includes(newBanner)) return 'blue';
        }
        return 'red';
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
              const highlight = getExportHighlightColor(data, locale, slot);
              if (highlight === 'red') cell.font = { bold: true, color: { argb: colors.changedFont } };
              else if (highlight === 'blue') cell.font = { bold: true, color: { argb: colors.movedFont } };
              else cell.font = { color: { argb: colors.normalFont } };
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

  const displayData = viewingTab ? (arrangements[viewingTab] || {}) : currentWork;
  const sortedDates = Object.keys(arrangements).sort().reverse();
  const getSlotBg = (slot) => slot.startsWith('A') ? '#fefce8' : '#f0fdf4';
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
                RAZER HOMEPAGE BANNER BUILDER
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Drag & drop anywhere • Swap A↔B slots • Auto-import banners</p>
            </div>
            {baseline && (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: RAZER.white, padding: '8px 16px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)' }}>
                Baseline: <span style={{ fontWeight: 700 }}>{baseline}</span>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ backgroundColor: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            
            {/* Group 1: File */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: RAZER.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>File</span>
              <div style={{ width: 1, height: 24, backgroundColor: RAZER.lightGray }} />
              <label style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                backgroundColor: RAZER.green, color: RAZER.white, 
                padding: '8px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                <Upload size={15} /> Import
                <input type="file" accept=".xlsx" onChange={handleImportExcel} style={{ display: 'none' }} />
              </label>
              <button onClick={exportExcel} style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                backgroundColor: RAZER.green, color: RAZER.white, 
                padding: '8px 14px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                <Download size={15} /> Export
              </button>
              <button 
                onClick={() => setModals(prev => ({ ...prev, saveTab: true }))} 
                disabled={viewingTab}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  backgroundColor: viewingTab ? '#9ca3af' : RAZER.black, color: RAZER.white, 
                  padding: '8px 14px', borderRadius: 4, border: 'none', 
                  cursor: viewingTab ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                <Plus size={15} /> Save Tab
              </button>
            </div>

            <div style={{ width: 1, height: 28, backgroundColor: '#d1d5db' }} />

            {/* Group 2: Edit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: RAZER.gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Edit</span>
              <div style={{ width: 1, height: 24, backgroundColor: RAZER.lightGray }} />
              <div style={{ display: 'flex' }}>
                <button 
                  onClick={() => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex - 1]))); showToast('↶ Undo'); } }} 
                  disabled={historyIndex <= 0 || viewingTab} 
                  title="Undo (Ctrl+Z)"
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    backgroundColor: '#f3f4f6', color: '#374151', padding: '8px 12px', 
                    borderRadius: '4px 0 0 4px', border: '1px solid #d1d5db', borderRight: 'none', 
                    cursor: (historyIndex <= 0 || viewingTab) ? 'not-allowed' : 'pointer', 
                    opacity: (historyIndex <= 0 || viewingTab) ? 0.5 : 1, fontSize: 14 
                  }}
                >↶</button>
                <button 
                  onClick={() => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex + 1]))); showToast('↷ Redo'); } }} 
                  disabled={historyIndex >= history.length - 1 || viewingTab} 
                  title="Redo (Ctrl+Y)"
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    backgroundColor: '#f3f4f6', color: '#374151', padding: '8px 12px', 
                    borderRadius: '0 4px 4px 0', border: '1px solid #d1d5db', 
                    cursor: (historyIndex >= history.length - 1 || viewingTab) ? 'not-allowed' : 'pointer', 
                    opacity: (historyIndex >= history.length - 1 || viewingTab) ? 0.5 : 1, fontSize: 14 
                  }}
                >↷</button>
              </div>
              <button 
                onClick={() => setModals(prev => ({ ...prev, findReplace: true }))} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  backgroundColor: '#f3f4f6', color: '#374151', padding: '8px 14px', 
                  borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 13, fontWeight: 500 
                }}
              >
                <Search size={15} /> Find & Replace
              </button>
              <button 
                onClick={() => setModals(prev => ({ ...prev, duplicate: true }))} 
                disabled={viewingTab} 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  backgroundColor: '#f3f4f6', color: '#374151', padding: '8px 14px', 
                  borderRadius: 4, border: '1px solid #d1d5db', 
                  cursor: viewingTab ? 'not-allowed' : 'pointer', 
                  opacity: viewingTab ? 0.5 : 1, fontSize: 13, fontWeight: 500 
                }}
              >
                <RefreshCw size={15} /> Duplicate
              </button>
            </div>

            {/* Group 3: View */}
            {Object.keys(arrangements).length > 0 && (
              <>
                <div style={{ width: 1, height: 28, backgroundColor: '#d1d5db' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: RAZER.gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>View</span>
                  <div style={{ width: 1, height: 24, backgroundColor: RAZER.lightGray }} />
                  <select 
                    value={viewingTab || ''} 
                    onChange={(e) => setViewingTab(e.target.value || null)} 
                    style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '8px 12px', fontSize: 13, backgroundColor: 'white', minWidth: 160 }}
                  >
                    <option value="">📝 Working</option>
                    {sortedDates.map(d => <option key={d} value={d}>📅 {d}</option>)}
                  </select>
                  <button 
                    onClick={() => setModals(prev => ({ ...prev, duplicateTab: true }))} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 6, 
                      backgroundColor: '#f3f4f6', color: '#374151', padding: '8px 14px', 
                      borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 13, fontWeight: 500 
                    }}
                  >
                    Copy Tab
                  </button>
                </div>
              </>
            )}

            <div style={{ flex: 1 }} />

            {/* Reset to Baseline */}
            <button 
              onClick={() => { 
                if (!baseline || !baselineSnapshot) {
                  showToast('⚠️ No baseline set');
                  return;
                }
                setCurrentWork(JSON.parse(JSON.stringify(baselineSnapshot)));
                showToast('✓ Reverted to baseline');
              }} 
              disabled={!baseline || viewingTab}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                backgroundColor: (!baseline || viewingTab) ? '#f3f4f6' : 'white', 
                color: (!baseline || viewingTab) ? '#9ca3af' : '#dc2626', 
                padding: '8px 14px', 
                borderRadius: 4, 
                border: `1px solid ${(!baseline || viewingTab) ? '#e5e7eb' : '#fca5a5'}`, 
                cursor: (!baseline || viewingTab) ? 'not-allowed' : 'pointer', 
                fontSize: 13, fontWeight: 500 
              }}
            >
              <RefreshCw size={15} /> Reset All
            </button>
          </div>
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
                    draggable={!viewingTab}
                    onDragStart={() => { if (!viewingTab) { setDraggedBanner(banner.name); setDraggedBannerIndex(index); setDraggedFromSlot(null); } }}
                    onDragEnd={resetDragState}
                    onDragOver={(e) => { if (!viewingTab) { e.preventDefault(); e.stopPropagation(); } }}
                    onDrop={(e) => { if (!viewingTab) { e.preventDefault(); e.stopPropagation(); if (draggedBannerIndex !== null && draggedBannerIndex !== index && !draggedFromSlot) handleBannerReorder(draggedBannerIndex, index); resetDragState(); } }}
                    style={{ 
                      backgroundColor: '#fafafa', 
                      border: '1px solid #e0e0e0', 
                      borderLeft: `3px solid ${RAZER.green}`,
                      borderRadius: 6, padding: 10, 
                      cursor: !viewingTab ? 'grab' : 'default', 
                      opacity: viewingTab ? 0.5 : (draggedBannerIndex === index ? 0.5 : 1),
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
                      {!viewingTab && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={(e) => { e.stopPropagation(); setModals(prev => ({ ...prev, editBanner: banner })); }} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Edit2 size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); removeBanner(banner.name); }} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      )}
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
              borderBottom: `2px solid ${RAZER.green}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: RAZER.black, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚀 GO LIVE
                </span>
                <input 
                  type="datetime-local" 
                  style={{ 
                    fontSize: 12, padding: '4px 8px', borderRadius: 4, 
                    border: `1px solid ${RAZER.green}`, backgroundColor: 'white', color: RAZER.black,
                    fontWeight: 500
                  }}
                />
                <span style={{ fontSize: 11, color: RAZER.gray }}>SGT</span>
              </div>
              {viewingTab && (
                <span style={{ 
                  backgroundColor: RAZER.green, color: 'white', 
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', 
                  borderRadius: 4 
                }}>
                  Viewing: {viewingTab}
                </span>
              )}
            </div>
            
            {/* Grid Table */}
            <div style={{ padding: 16 }}>
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: '#1a1a1a', color: RAZER.white, padding: 12, fontWeight: 700, position: 'sticky', left: 0, zIndex: 10, borderBottom: `2px solid ${RAZER.green}`, borderRight: '1px solid #333' }}>Slot</th>
                  {LOCALES.map((loc, idx) => (
                    <th key={loc} style={{ backgroundColor: '#1a1a1a', color: RAZER.white, padding: 12, fontWeight: 700, minWidth: 110, borderBottom: `2px solid ${RAZER.green}`, borderRight: idx < LOCALES.length - 1 ? '1px solid #333' : 'none' }}>{loc}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot, slotIdx) => (
                  <tr key={slot}>
                    <td style={{ 
                      padding: 10, fontWeight: 700, 
                      position: 'sticky', left: 0, zIndex: 10, 
                      backgroundColor: slot.startsWith('A') ? '#fefce8' : '#ecfdf5',
                      color: slot.startsWith('A') ? '#92400e' : '#166534',
                      borderBottom: '1px solid #d1d5db',
                      borderRight: '1px solid #d1d5db'
                    }}>{slot}</td>
                    {LOCALES.map((locale, locIdx) => {
                      const banner = displayData?.[locale]?.[slot];
                      const isHovering = hoverSlot?.locale === locale && hoverSlot?.slot === slot;
                      return (
                        <td 
                          key={`${locale}-${slot}`}
                          onDragOver={(e) => !viewingTab && handleDragOver(e, locale, slot)}
                          onDragLeave={() => setHoverSlot(null)}
                          onDrop={(e) => !viewingTab && handleDrop(e, locale, slot)}
                          style={{ 
                            padding: 8, 
                            backgroundColor: slot.startsWith('A') ? '#fefce8' : '#ecfdf5', 
                            boxShadow: isHovering ? (hoverSlot?.eligible ? `inset 0 0 0 2px ${RAZER.green}` : 'inset 0 0 0 2px #ef4444') : 'none',
                            transition: 'box-shadow 0.15s ease',
                            borderBottom: '1px solid #d1d5db',
                            borderRight: locIdx < LOCALES.length - 1 ? '1px solid #d1d5db' : 'none'
                          }}
                        >
                          {banner ? (
                            <div 
                              draggable={!viewingTab} 
                              onDragStart={(e) => handleCellDragStart(e, locale, slot, banner)} 
                              onDragEnd={resetDragState} 
                              style={{ position: 'relative' }}
                              onMouseEnter={(e) => { if (!viewingTab) { const btn = e.currentTarget.querySelector('.clear-btn'); if (btn) btn.style.opacity = '1'; } }}
                              onMouseLeave={(e) => { const btn = e.currentTarget.querySelector('.clear-btn'); if (btn) btn.style.opacity = '0'; }}
                            >
                              <div style={{ 
                                fontSize: 13, cursor: viewingTab ? 'default' : 'grab', 
                                color: getTextColor(locale, slot), 
                                fontWeight: getHighlightColor(locale, slot) !== 'none' ? 700 : 500 
                              }}>{banner}</div>
                              {!viewingTab && (
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
                              )}
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
                  <td style={{ padding: 10, fontWeight: 700, position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'white', borderRight: '1px solid #d1d5db', color: RAZER.gray }}>Status</td>
                  {LOCALES.map((locale, idx) => {
                    const status = getLocaleStatus(locale);
                    return (
                      <td key={locale} style={{ 
                        padding: 8, textAlign: 'center', fontSize: 12, fontWeight: 600,
                        backgroundColor: 'white',
                        color: status.status === 'error' ? '#dc2626' : status.status === 'warning' ? '#d97706' : '#16a34a',
                        borderRight: idx < LOCALES.length - 1 ? '1px solid #d1d5db' : 'none'
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
      {modals.saveTab && <SaveTabModal onSave={saveAsTab} onClose={() => setModals(prev => ({ ...prev, saveTab: false }))} />}
      {modals.duplicateTab && <DuplicateTabModal tabs={Object.keys(arrangements)} onDuplicate={duplicateTab} onClose={() => setModals(prev => ({ ...prev, duplicateTab: false }))} />}
      
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

function SaveTabModal({ onSave, onClose }) {
  const now = new Date();
  const defaultName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const [tabName, setTabName] = useState(defaultName);
  const [setAsBaseline, setSetAsBaseline] = useState(false);
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Save as New Tab</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Tab Name</label>
          <input 
            type="text" 
            value={tabName} 
            onChange={(e) => setTabName(e.target.value)} 
            style={inputStyle} 
            placeholder="e.g. 2026-01-29 10:00" 
          />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Format: YYYY-MM-DD HH:mm (e.g. 2026-01-29 10:00, 2026-01-29 16:00)</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input 
              type="checkbox" 
              checked={setAsBaseline} 
              onChange={(e) => setSetAsBaseline(e.target.checked)} 
            />
            Set as new baseline
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!tabName.trim()) return alert('Enter tab name'); onSave(tabName.trim(), setAsBaseline); }} style={btnPrimary}>Save Tab</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DuplicateTabModal({ tabs, onDuplicate, onClose }) {
  const [sourceTab, setSourceTab] = useState(tabs[0] || '');
  const now = new Date();
  const defaultName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const [newTabName, setNewTabName] = useState(defaultName);
  const [loadToWorking, setLoadToWorking] = useState(true);
  
  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2 style={modalTitle}>Copy Tab</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Source Tab</label>
          <select value={sourceTab} onChange={(e) => setSourceTab(e.target.value)} style={inputStyle}>
            {tabs.map(tab => <option key={tab} value={tab}>{tab}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>New Tab Name</label>
          <input 
            type="text" 
            value={newTabName} 
            onChange={(e) => setNewTabName(e.target.value)} 
            style={inputStyle} 
            placeholder="e.g. 2026-01-29 16:00" 
          />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Tip: Use time suffix like "10:00" for 10am, "16:00" for 4pm</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input 
              type="checkbox" 
              checked={loadToWorking} 
              onChange={(e) => setLoadToWorking(e.target.checked)} 
            />
            Load to Working area & set as baseline
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!sourceTab || !newTabName.trim()) return alert('Fill all fields'); onDuplicate(sourceTab, newTabName.trim(), loadToWorking); }} style={btnPrimary}>Create Copy</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
