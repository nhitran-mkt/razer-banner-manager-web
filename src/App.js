import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, Plus, Edit2, Trash2, Save, X, Upload, Calendar, Search, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const LOCALES = ['US', 'CA-EN', 'CA-FR', 'GB', 'EU', 'DE', 'FR', 'SG', 'HK-EN', 'HK-ZH', 'AU', 'ES', 'IT', 'AP', 'TW', 'JP', 'KR'];
const SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6'];

export default function RazerBannerTool() {
  const [banners, setBanners] = useState([
    { name: 'Cinnamoroll', eligibleLocales: ['SG', 'HK-EN', 'HK-ZH', 'TW', 'JP', 'KR', 'AP'] },
    { name: 'New Year Campaign', eligibleLocales: LOCALES },
    { name: '2XKO', eligibleLocales: LOCALES },
    { name: 'Viper V3 Pro SE', eligibleLocales: LOCALES },
    { name: 'CES 2026', eligibleLocales: LOCALES }
  ]);
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
  const [modals, setModals] = useState({
    addBanner: false,
    save: false,
    findReplace: false,
    duplicate: false,
    editBanner: null
  });

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
      } catch (e) {
        console.error('Load failed', e);
      }
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

        setArrangements(newArrangements);
        setBaseline(latestDate);
        const baselineData = newArrangements[latestDate];
        if (baselineData) {
          setBaselineSnapshot(JSON.parse(JSON.stringify(baselineData)));
          setCurrentWork(JSON.parse(JSON.stringify(baselineData)));
          showToast(`✅ Imported ${Object.keys(newArrangements).length} tabs`);
        }
      } catch (error) {
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
    const isEligible = banner?.eligibleLocales.includes(locale);
    setHoverSlot({ locale, slot, eligible: isEligible });
  };

  // FIX #1: Completely rewritten handleDrop to fix B->A slot movement
  const handleDrop = (e, targetLocale, targetSlot) => {
    e.preventDefault();
    e.stopPropagation();
    setHoverSlot(null);
    
    if (!draggedBanner || viewingTab) {
      resetDragState();
      return;
    }

    const banner = banners.find(b => b.name === draggedBanner);
    if (!banner || !banner.eligibleLocales.includes(targetLocale)) {
      showToast(`❌ "${draggedBanner}" NOT allowed in ${targetLocale}`);
      resetDragState();
      return;
    }

    saveToHistory(currentWork);

    const sourceInfo = draggedFromSlot; // { locale, slot } or null if from banner list
    const targetBanner = currentWork?.[targetLocale]?.[targetSlot] || null;

    setCurrentWork(prev => {
      const newWork = JSON.parse(JSON.stringify(prev));
      
      // Ensure target locale exists
      if (!newWork[targetLocale]) {
        newWork[targetLocale] = {};
      }

      if (sourceInfo) {
        // Dragging from a grid cell (move/swap within grid)
        const { locale: sourceLocale, slot: sourceSlot } = sourceInfo;
        
        // Ensure source locale exists
        if (!newWork[sourceLocale]) {
          newWork[sourceLocale] = {};
        }

        // Check if it's the same cell
        if (sourceLocale === targetLocale && sourceSlot === targetSlot) {
          // Dropped on itself, no change
          return prev;
        }

        if (targetBanner) {
          // SWAP: Check if target banner can go to source location
          const targetBannerObj = banners.find(b => b.name === targetBanner);
          if (targetBannerObj && !targetBannerObj.eligibleLocales.includes(sourceLocale)) {
            showToast(`❌ Cannot swap: "${targetBanner}" not allowed in ${sourceLocale}`);
            return prev;
          }
          // Perform swap
          newWork[sourceLocale][sourceSlot] = targetBanner;
          newWork[targetLocale][targetSlot] = draggedBanner;
          showToast(`🔄 Swapped: ${draggedBanner} ↔ ${targetBanner}`);
        } else {
          // MOVE: Clear source, set target
          delete newWork[sourceLocale][sourceSlot];
          newWork[targetLocale][targetSlot] = draggedBanner;
          showToast(`✅ Moved: ${draggedBanner} to ${targetLocale}/${targetSlot}`);
        }
      } else {
        // Dragging from banner list (place/replace)
        newWork[targetLocale][targetSlot] = draggedBanner;
        if (targetBanner) {
          showToast(`✅ Replaced: ${targetBanner} → ${draggedBanner}`);
        } else {
          showToast(`✅ Placed: ${draggedBanner}`);
        }
      }

      return newWork;
    });

    resetDragState();
  };

  const resetDragState = () => {
    setDraggedBanner(null);
    setDraggedFromSlot(null);
    setDraggedBannerIndex(null);
  };

  // FIX #1: Add drag start handler for grid cells
  const handleCellDragStart = (e, locale, slot, bannerName) => {
    if (viewingTab) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    setDraggedBanner(bannerName);
    setDraggedFromSlot({ locale, slot });
    setDraggedBannerIndex(null); // Not from banner list
  };

  const getHighlightColor = (locale, slot) => {
    if (viewingTab || !baselineSnapshot) return 'none';
    const oldBanner = baselineSnapshot?.[locale]?.[slot];
    const newBanner = currentWork?.[locale]?.[slot];
    if (!newBanner) return 'none';
    if (oldBanner === newBanner) return 'none';
    for (const loc of LOCALES) {
      if (Object.values(baselineSnapshot?.[loc] || {}).includes(newBanner)) return 'blue';
    }
    return 'red';
  };

  const getTextStyle = (locale, slot) => {
    const color = getHighlightColor(locale, slot);
    if (color === 'red') return 'text-red-600 font-semibold';
    if (color === 'blue') return 'text-blue-600 font-semibold';
    return 'text-gray-900';
  };

  const getSlotZoneStyle = (slot) => {
    if (slot.startsWith('A')) return 'bg-yellow-50';
    if (slot.startsWith('B')) return 'bg-green-50';
    return 'bg-white';
  };

  const getLocaleStatus = (locale) => {
    const data = currentWork[locale] || {};
    const values = Object.values(data);
    const duplicates = values.filter((b, i) => values.indexOf(b) !== i);
    const filled = Object.keys(data).length;
    
    const ineligibleBanners = [];
    values.forEach(bannerName => {
      const banner = banners.find(b => b.name === bannerName);
      if (banner && !banner.eligibleLocales.includes(locale)) {
        ineligibleBanners.push(bannerName);
      }
    });
    
    if (ineligibleBanners.length > 0) {
      return { 
        status: 'error', 
        message: `🚫 ${ineligibleBanners.join(', ')}`
      };
    }
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
    if (banners.find(b => b.name === name)) {
      showToast('❌ Already exists');
      return;
    }
    setBanners(prev => [...prev, { name, eligibleLocales }]);
    setModals(prev => ({ ...prev, addBanner: false }));
    showToast(`✅ Added: ${name}`);
  };

  const removeBanner = (name) => {
    if (!confirm(`Remove "${name}"?`)) return;
    setBanners(prev => prev.filter(b => b.name !== name));
    const newWork = { ...currentWork };
    LOCALES.forEach(locale => {
      SLOTS.forEach(slot => {
        if (newWork[locale]?.[slot] === name) delete newWork[locale][slot];
      });
    });
    setCurrentWork(newWork);
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
      targetLocales.forEach(targetLocale => {
        newWork[targetLocale] = { ...sourceData };
      });
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
          if (replace.trim()) {
            newWork[locale][slot] = replace.trim();
          } else {
            delete newWork[locale][slot];
          }
          count++;
        }
      });
    });
    setCurrentWork(newWork);
    setModals(prev => ({ ...prev, findReplace: false }));
    showToast(`✅ Replaced ${count} occurrence(s)`);
  };

  // FIX #2: Enhanced exportExcel with proper formatting and colors
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Helper to convert hex to XLSX ARGB format
    const hexToARGB = (hex) => {
      const clean = hex.replace('#', '');
      return 'FF' + clean.toUpperCase();
    };

    // Define colors
    const colors = {
      header: { fill: 'FFE5E7EB', font: '000000' },      // Gray header
      slotA: { fill: 'FFFFFBEB', font: '000000' },       // Yellow for A slots
      slotB: { fill: 'FFF0FDF4', font: '000000' },       // Green for B slots
      statusSuccess: { fill: 'FFDCFCE7', font: '15803D' }, // Green
      statusWarning: { fill: 'FFFEF3C7', font: 'A16207' }, // Yellow
      statusError: { fill: 'FFFEE2E2', font: 'B91C1C' },   // Red
      changed: { font: 'DC2626' },  // Red text for new banners
      moved: { font: '2563EB' }     // Blue text for moved banners
    };

    // Add current work as first sheet
    const allTabs = { 'Current Work': currentWork, ...arrangements };
    
    Object.keys(allTabs).forEach(tabName => {
      const arr = allTabs[tabName];
      
      // Create worksheet data with headers (row 0 for headers)
      const wsData = [];
      
      // Header row
      const headerRow = ['Position', ...LOCALES];
      wsData.push(headerRow);
      
      // Slot rows
      SLOTS.forEach(slot => {
        const row = [slot];
        LOCALES.forEach(locale => {
          const bannerName = arr?.[locale]?.[slot] || '';
          row.push(bannerName);
        });
        wsData.push(row);
      });
      
      // Status row
      const statusRow = ['Status'];
      LOCALES.forEach(locale => {
        const data = arr[locale] || {};
        const values = Object.values(data);
        const duplicates = values.filter((b, i) => values.indexOf(b) !== i);
        const filled = Object.keys(data).length;
        const ineligible = values.filter(bannerName => {
          const banner = banners.find(b => b.name === bannerName);
          return banner && !banner.eligibleLocales.includes(locale);
        });
        
        if (ineligible.length > 0) {
          statusRow.push(`ERROR: ${ineligible.join(', ')}`);
        } else if (duplicates.length > 0) {
          statusRow.push(`${duplicates.length} duplicates`);
        } else if (filled < 9) {
          statusRow.push(`${filled}/9 filled`);
        } else {
          statusRow.push('✓ Complete');
        }
      });
      wsData.push(statusRow);
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      const colWidths = [{ wch: 12 }]; // Position column
      LOCALES.forEach(() => colWidths.push({ wch: 22 })); // Locale columns
      ws['!cols'] = colWidths;
      
      // Apply styles (Note: xlsx library has limited style support in free version)
      // For full styling, you'd need xlsx-style or exceljs
      // Here we'll add comments/notes to indicate status
      
      // Add row heights
      ws['!rows'] = [];
      for (let i = 0; i <= SLOTS.length + 1; i++) {
        ws['!rows'].push({ hpt: 25 }); // 25 points height
      }
      
      XLSX.utils.book_append_sheet(wb, ws, tabName.substring(0, 31)); // Sheet names max 31 chars
    });
    
    // Write file
    const fileName = `Razer_Banner_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('✅ Exported! (Note: Colors require Excel to apply conditional formatting)');
  };

  // Alternative: Export as styled HTML that can be opened in Excel
  const exportStyledHTML = () => {
    let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: center; min-width: 120px; }
  th { background-color: #E5E7EB; font-weight: bold; }
  .slot-a { background-color: #FFFBEB; }
  .slot-b { background-color: #F0FDF4; }
  .status-success { background-color: #DCFCE7; color: #15803D; font-weight: bold; }
  .status-warning { background-color: #FEF3C7; color: #A16207; font-weight: bold; }
  .status-error { background-color: #FEE2E2; color: #B91C1C; font-weight: bold; }
  .changed { color: #DC2626; font-weight: 600; }
  .moved { color: #2563EB; font-weight: 600; }
  .position { font-weight: bold; background-color: #F3F4F6; }
  h2 { margin-top: 30px; }
</style>
</head>
<body>
`;

    // Add current work
    html += '<h2>Current Work</h2>';
    html += generateHTMLTable(currentWork, true);
    
    // Add historical tabs
    Object.keys(arrangements).sort().reverse().forEach(tabName => {
      html += `<h2>${tabName}</h2>`;
      html += generateHTMLTable(arrangements[tabName], false);
    });

    html += '</body></html>';

    // Download as HTML file
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Razer_Banner_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Exported styled HTML! Open in Excel for full formatting.');
  };

  const generateHTMLTable = (data, showHighlights) => {
    let html = '<table>';
    
    // Header row
    html += '<tr><th>Position</th>';
    LOCALES.forEach(loc => {
      html += `<th>${loc}</th>`;
    });
    html += '</tr>';
    
    // Data rows
    SLOTS.forEach(slot => {
      const slotClass = slot.startsWith('A') ? 'slot-a' : 'slot-b';
      html += `<tr><td class="position ${slotClass}">${slot}</td>`;
      
      LOCALES.forEach(locale => {
        const banner = data?.[locale]?.[slot] || '';
        let cellClass = slotClass;
        
        if (showHighlights && banner && baselineSnapshot) {
          const oldBanner = baselineSnapshot?.[locale]?.[slot];
          if (oldBanner !== banner) {
            // Check if banner exists elsewhere in baseline
            let existsElsewhere = false;
            for (const loc of LOCALES) {
              if (Object.values(baselineSnapshot?.[loc] || {}).includes(banner)) {
                existsElsewhere = true;
                break;
              }
            }
            cellClass += existsElsewhere ? ' moved' : ' changed';
          }
        }
        
        html += `<td class="${cellClass}">${banner}</td>`;
      });
      html += '</tr>';
    });
    
    // Status row
    html += '<tr><td class="position">Status</td>';
    LOCALES.forEach(locale => {
      const locData = data[locale] || {};
      const values = Object.values(locData);
      const duplicates = values.filter((b, i) => values.indexOf(b) !== i);
      const filled = Object.keys(locData).length;
      const ineligible = values.filter(bannerName => {
        const banner = banners.find(b => b.name === bannerName);
        return banner && !banner.eligibleLocales.includes(locale);
      });
      
      let statusClass = 'status-success';
      let statusText = '✓ Complete';
      
      if (ineligible.length > 0) {
        statusClass = 'status-error';
        statusText = `🚫 ${ineligible.join(', ')}`;
      } else if (duplicates.length > 0) {
        statusClass = 'status-error';
        statusText = `${duplicates.length} duplicates`;
      } else if (filled < 9) {
        statusClass = 'status-warning';
        statusText = `${filled}/9 filled`;
      }
      
      html += `<td class="${statusClass}">${statusText}</td>`;
    });
    html += '</tr>';
    
    html += '</table>';
    return html;
  };

  const displayData = viewingTab ? (arrangements[viewingTab] || {}) : currentWork;
  const sortedDates = Object.keys(arrangements).sort().reverse();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '16px' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#111827',
          color: 'white',
          padding: '16px 32px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          fontSize: '16px',
          fontWeight: '600',
          minWidth: '200px',
          textAlign: 'center',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(to right, #065f46, #064e3b)',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '8px' }}>🐍 Razer Banner Manager</h1>
              <p style={{ color: '#d1fae5' }}>Drag & drop • Swap banners • Undo/Redo • Find & Replace</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {Object.keys(arrangements).length > 0 && (
                <label style={{
                  backgroundColor: '#047857',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-block'
                }}>
                  📁 Re-import Excel
                  <input type="file" accept=".xlsx" onChange={handleImportExcel} style={{ display: 'none' }} />
                </label>
              )}
              <button
                onClick={() => {
                  if (confirm('⚠️ DELETE ALL DATA?\n\nThis will erase everything:\n- All imported arrangements\n- All banners\n- Current work\n\nThis cannot be undone!')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                style={{
                  backgroundColor: '#1f2937',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                🗑️ Delete All
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <h3 style={{ fontWeight: 'bold', marginBottom: '12px' }}>📁 Import</h3>
            {Object.keys(arrangements).length === 0 ? (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#047857',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                justifyContent: 'center'
              }}>
                <Upload size={18} /> Import Excel
                <input type="file" accept=".xlsx" onChange={handleImportExcel} style={{ display: 'none' }} />
              </label>
            ) : (
              <select value={viewingTab || ''} onChange={(e) => setViewingTab(e.target.value || null)} style={{
                width: '100%',
                border: '2px solid #e5e7eb',
                borderRadius: '4px',
                padding: '8px 12px'
              }}>
                <option value="">Working (vs {baseline})</option>
                {sortedDates.map(d => <option key={d} value={d}>View: {d}</option>)}
              </select>
            )}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <h3 style={{ fontWeight: 'bold', marginBottom: '12px' }}>⚡ Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setModals(prev => ({ ...prev, findReplace: true }))} style={{
                backgroundColor: '#047857',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Search size={16} /> Find & Replace
              </button>
              <button onClick={() => setModals(prev => ({ ...prev, duplicate: true }))} disabled={viewingTab} style={{
                backgroundColor: '#047857',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                border: 'none',
                cursor: viewingTab ? 'not-allowed' : 'pointer',
                opacity: viewingTab ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <RefreshCw size={16} /> Duplicate
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <h3 style={{ fontWeight: 'bold', marginBottom: '12px' }}>📊 Export</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={exportExcel} style={{
                width: '100%',
                backgroundColor: '#047857',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <Download size={18} /> Export Excel
              </button>
              <button onClick={exportStyledHTML} style={{
                width: '100%',
                backgroundColor: '#1f2937',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px'
              }}>
                <Download size={16} /> Export Styled HTML
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setModals(prev => ({ ...prev, addBanner: true }))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} /> Add Banner
          </button>
          <button
            onClick={() => setModals(prev => ({ ...prev, findReplace: true }))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Search size={18} /> Find & Replace
          </button>
          <button
            onClick={() => setModals(prev => ({ ...prev, duplicate: true }))}
            disabled={viewingTab}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: viewingTab ? 'not-allowed' : 'pointer',
              opacity: viewingTab ? 0.5 : 1
            }}
          >
            <RefreshCw size={18} /> Duplicate
          </button>
          <button
            onClick={() => {
              if (historyIndex > 0) {
                setHistoryIndex(historyIndex - 1);
                setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex - 1])));
                showToast('↶ Undo');
              }
            }}
            disabled={historyIndex <= 0 || viewingTab}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#1f2937',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: (historyIndex <= 0 || viewingTab) ? 'not-allowed' : 'pointer',
              opacity: (historyIndex <= 0 || viewingTab) ? 0.5 : 1
            }}
          >
            ↶ Undo
          </button>
          <button
            onClick={() => {
              if (historyIndex < history.length - 1) {
                setHistoryIndex(historyIndex + 1);
                setCurrentWork(JSON.parse(JSON.stringify(history[historyIndex + 1])));
                showToast('↷ Redo');
              }
            }}
            disabled={historyIndex >= history.length - 1 || viewingTab}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#1f2937',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: (historyIndex >= history.length - 1 || viewingTab) ? 'not-allowed' : 'pointer',
              opacity: (historyIndex >= history.length - 1 || viewingTab) ? 0.5 : 1
            }}
          >
            ↷ Redo
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            position: 'sticky',
            top: '16px',
            alignSelf: 'start'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontWeight: 'bold', fontSize: '18px' }}>📋 Banners</h2>
              <button
                onClick={() => setModals(prev => ({ ...prev, addBanner: true }))}
                style={{
                  color: '#047857',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <Plus size={20} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '12px' }}>💡 Drag to reorder or assign</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {banners.map((banner, index) => (
                <div
                  key={banner.name}
                  draggable={!viewingTab}
                  onDragStart={(e) => {
                    if (viewingTab) {
                      e.preventDefault();
                      return;
                    }
                    setDraggedBanner(banner.name);
                    setDraggedBannerIndex(index);
                    setDraggedFromSlot(null); // From banner list, not from grid
                  }}
                  onDragEnd={() => resetDragState()}
                  onDragOver={(e) => {
                    if (viewingTab) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    if (viewingTab) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedBannerIndex !== null && draggedBannerIndex !== index && draggedFromSlot === null) {
                      handleBannerReorder(draggedBannerIndex, index);
                    }
                    resetDragState();
                  }}
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '2px solid #86efac',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: !viewingTab ? 'grab' : 'default',
                    opacity: (viewingTab ? 0.5 : (draggedBannerIndex === index ? 0.5 : 1)),
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!viewingTab) {
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      const buttons = e.currentTarget.querySelector('.banner-buttons');
                      if (buttons) buttons.style.opacity = '1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                    const buttons = e.currentTarget.querySelector('.banner-buttons');
                    if (buttons) buttons.style.opacity = '0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{banner.name}</div>
                      <div style={{ fontSize: '12px', color: '#4b5563' }}>
                        {banner.eligibleLocales.length === LOCALES.length ? 'All locales' : `${banner.eligibleLocales.length} locales`}
                      </div>
                    </div>
                    {!viewingTab && (
                      <div className="banner-buttons" style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModals(prev => ({ ...prev, editBanner: banner }));
                          }}
                          style={{
                            color: '#047857',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBanner(banner.name);
                          }}
                          style={{
                            color: '#1f2937',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            overflowX: 'auto'
          }}>
            <h2 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '16px' }}>🌍 Grid</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  <th style={{
                    border: '2px solid #e5e7eb',
                    backgroundColor: '#e5e7eb',
                    padding: '8px',
                    fontWeight: 'bold',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10
                  }}>Slot</th>
                  {LOCALES.map(loc => (
                    <th key={loc} style={{
                      border: '2px solid #e5e7eb',
                      backgroundColor: '#e5e7eb',
                      padding: '8px',
                      fontWeight: 'bold',
                      minWidth: '128px'
                    }}>{loc}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(slot => (
                  <tr key={slot}>
                    <td style={{
                      border: '2px solid #e5e7eb',
                      padding: '8px',
                      fontWeight: 'bold',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: getSlotZoneStyle(slot) === 'bg-yellow-50' ? '#fefce8' : '#f0fdf4'
                    }}>{slot}</td>
                    {LOCALES.map(locale => {
                      const banner = displayData?.[locale]?.[slot];
                      const isHovering = hoverSlot?.locale === locale && hoverSlot?.slot === slot;
                      const isEligible = hoverSlot?.eligible;
                      
                      return (
                        <td
                          key={`${locale}-${slot}`}
                          onDragOver={(e) => !viewingTab && handleDragOver(e, locale, slot)}
                          onDragLeave={() => setHoverSlot(null)}
                          onDrop={(e) => !viewingTab && handleDrop(e, locale, slot)}
                          style={{
                            border: '2px solid #e5e7eb',
                            padding: '8px',
                            backgroundColor: getSlotZoneStyle(slot) === 'bg-yellow-50' ? '#fefce8' : '#f0fdf4',
                            boxShadow: isHovering ? (isEligible ? '0 0 0 4px #86efac' : '0 0 0 4px #fca5a5') : 'none',
                            transition: 'box-shadow 0.15s ease'
                          }}
                        >
                          {banner ? (
                            <div
                              draggable={!viewingTab}
                              onDragStart={(e) => handleCellDragStart(e, locale, slot, banner)}
                              onDragEnd={() => resetDragState()}
                              style={{ position: 'relative' }}
                              onMouseEnter={(e) => {
                                if (!viewingTab) {
                                  e.currentTarget.style.cursor = 'grab';
                                  const btn = e.currentTarget.querySelector('.clear-btn');
                                  if (btn) btn.style.opacity = '1';
                                }
                              }}
                              onMouseLeave={(e) => {
                                const btn = e.currentTarget.querySelector('.clear-btn');
                                if (btn) btn.style.opacity = '0';
                              }}
                            >
                              <div style={{
                                fontSize: '14px',
                                cursor: viewingTab ? 'default' : 'grab',
                                color: getTextStyle(locale, slot).includes('red') ? '#dc2626' : 
                                       getTextStyle(locale, slot).includes('blue') ? '#2563eb' : '#111827',
                                fontWeight: getTextStyle(locale, slot).includes('font-semibold') ? '600' : 'normal'
                              }}>{banner}</div>
                              {!viewingTab && (
                                <button
                                  className="clear-btn"
                                  onClick={() => clearSlot(locale, slot)}
                                  style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    opacity: 0,
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    borderRadius: '50%',
                                    padding: '4px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                  }}
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>
                              {isHovering && !isEligible ? '🚫' : 'Drop'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <td style={{
                    border: '2px solid #e5e7eb',
                    padding: '8px',
                    fontWeight: 'bold',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: '#f3f4f6'
                  }}>Status</td>
                  {LOCALES.map(locale => {
                    const status = getLocaleStatus(locale);
                    return (
                      <td key={locale} style={{
                        border: '2px solid #e5e7eb',
                        padding: '8px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: status.status === 'error' ? '#fee2e2' :
                                       status.status === 'warning' ? '#fef3c7' : '#dcfce7',
                        color: status.status === 'error' ? '#b91c1c' :
                               status.status === 'warning' ? '#a16207' : '#15803d'
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

      {modals.addBanner && <AddBannerModal onSave={addNewBanner} onClose={() => setModals(prev => ({ ...prev, addBanner: false }))} />}
      {modals.editBanner && <EditBannerModal banner={modals.editBanner} onSave={updateBannerLocales} onClose={() => setModals(prev => ({ ...prev, editBanner: null }))} />}
      {modals.findReplace && <FindReplaceModal banners={banners} onReplace={findReplace} onClose={() => setModals(prev => ({ ...prev, findReplace: false }))} />}
      {modals.duplicate && <DuplicateModal currentWork={currentWork} onDuplicate={duplicateArrangement} onClose={() => setModals(prev => ({ ...prev, duplicate: false }))} />}
    </div>
  );
}

function AddBannerModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [selectedLocales, setSelectedLocales] = useState(LOCALES);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '672px',
        width: '100%'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Add New Banner</h2>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Banner Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              border: '2px solid #e5e7eb',
              borderRadius: '4px',
              padding: '8px'
            }}
            placeholder="e.g. Summer Sale 2026"
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Eligible Locales:</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {LOCALES.map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedLocales.includes(locale)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLocales(prev => [...prev, locale]);
                    else setSelectedLocales(prev => prev.filter(l => l !== locale));
                  }}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px' }}>{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              if (!name.trim() || selectedLocales.length === 0) return alert('Fill all fields');
              onSave(name.trim(), selectedLocales);
            }}
            style={{
              flex: 1,
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Add</button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}

function EditBannerModal({ banner, onSave, onClose }) {
  const [selectedLocales, setSelectedLocales] = useState(banner.eligibleLocales);
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '672px',
        width: '100%'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Edit: {banner.name}</h2>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontWeight: '600' }}>Eligible Locales:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSelectedLocales(LOCALES)}
                style={{
                  fontSize: '12px',
                  padding: '4px 12px',
                  backgroundColor: '#047857',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedLocales([])}
                style={{
                  fontSize: '12px',
                  padding: '4px 12px',
                  backgroundColor: '#1f2937',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Deselect All
              </button>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {LOCALES.map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedLocales.includes(locale)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLocales(prev => [...prev, locale]);
                    else setSelectedLocales(prev => prev.filter(l => l !== locale));
                  }}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px' }}>{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              if (selectedLocales.length === 0) return alert('Select at least one locale');
              onSave(banner.name, selectedLocales);
            }}
            style={{
              flex: 1,
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Save</button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Cancel</button>
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
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '672px',
        width: '100%'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Find & Replace</h2>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Find:</label>
          <select
            value={find}
            onChange={(e) => setFind(e.target.value)}
            style={{
              width: '100%',
              border: '2px solid #e5e7eb',
              borderRadius: '4px',
              padding: '8px'
            }}
          >
            <option value="">-- Select a banner --</option>
            {banners.map(banner => (
              <option key={banner.name} value={banner.name}>{banner.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Replace:</label>
          <input
            type="text"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            style={{
              width: '100%',
              border: '2px solid #e5e7eb',
              borderRadius: '4px',
              padding: '8px'
            }}
            placeholder="e.g. 2XKO (empty = remove)"
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Locales:</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            maxHeight: '160px',
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {LOCALES.map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedLocales.includes(locale)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLocales(prev => [...prev, locale]);
                    else setSelectedLocales(prev => prev.filter(l => l !== locale));
                  }}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px' }}>{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onReplace(find, replace, selectedLocales)}
            style={{
              flex: 1,
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Replace All</button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DuplicateModal({ currentWork, onDuplicate, onClose }) {
  const [sourceLocale, setSourceLocale] = useState('US');
  const [targetLocales, setTargetLocales] = useState([]);
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '672px',
        width: '100%'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Duplicate Arrangement</h2>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>From:</label>
          <select
            value={sourceLocale}
            onChange={(e) => setSourceLocale(e.target.value)}
            style={{
              width: '100%',
              border: '2px solid #e5e7eb',
              borderRadius: '4px',
              padding: '8px'
            }}
          >
            {LOCALES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>To:</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {LOCALES.filter(l => l !== sourceLocale).map(locale => (
              <label key={locale} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={targetLocales.includes(locale)}
                  onChange={(e) => {
                    if (e.target.checked) setTargetLocales(prev => [...prev, locale]);
                    else setTargetLocales(prev => prev.filter(l => l !== locale));
                  }}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px' }}>{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              if (targetLocales.length === 0) return alert('Select target locales');
              onDuplicate(sourceLocale, targetLocales);
            }}
            style={{
              flex: 1,
              backgroundColor: '#047857',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Duplicate</button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}
