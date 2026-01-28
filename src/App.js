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

  const handleDrop = (e, locale, slot) => {
    e.preventDefault();
    setHoverSlot(null);
    if (!draggedBanner || viewingTab) return;

    const banner = banners.find(b => b.name === draggedBanner);
    if (!banner.eligibleLocales.includes(locale)) {
      showToast(`❌ "${draggedBanner}" NOT allowed in ${locale}`);
      setDraggedBanner(null);
      setDraggedFromSlot(null);
      return;
    }

    saveToHistory(currentWork);

    if (draggedFromSlot) {
      const targetBanner = currentWork?.[locale]?.[slot];
      
      setCurrentWork(prev => {
        const newWork = { ...prev };
        
        if (targetBanner) {
          newWork[draggedFromSlot.locale][draggedFromSlot.slot] = targetBanner;
        } else {
          delete newWork[draggedFromSlot.locale][draggedFromSlot.slot];
        }
        
        newWork[locale] = { ...newWork[locale], [slot]: draggedBanner };
        
        return newWork;
      });
      
      if (targetBanner) {
        showToast(`🔄 Swapped ${draggedBanner} ↔ ${targetBanner}`);
      } else {
        showToast(`✅ Moved ${draggedBanner}`);
      }
    } else {
      setCurrentWork(prev => ({
        ...prev,
        [locale]: { ...prev[locale], [slot]: draggedBanner }
      }));
      showToast(`✅ Placed ${draggedBanner}`);
    }
    
    setDraggedBanner(null);
    setDraggedFromSlot(null);
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

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    Object.keys(arrangements).sort().forEach(date => {
      const arr = arrangements[date];
      const wsData = [['Position', ...LOCALES]];
      SLOTS.forEach(slot => {
        const row = [slot];
        LOCALES.forEach(locale => row.push(arr?.[locale]?.[slot] || ''));
        wsData.push(row);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), date);
    });
    XLSX.writeFile(wb, `Razer_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Exported!');
  };

  const displayData = viewingTab ? (arrangements[viewingTab] || {}) : currentWork;
  const sortedDates = Object.keys(arrangements).sort().reverse();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          backgroundColor: '#111827',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          zIndex: 50
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(to right, #059669, #047857)',
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
                  backgroundColor: '#ea580c',
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
                  backgroundColor: '#dc2626',
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
              <div style={{ fontSize: '14px', color: '#d1fae5' }}>Version 74</div>
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
                backgroundColor: '#2563eb',
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
                backgroundColor: '#9333ea',
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
                backgroundColor: '#ea580c',
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
            <button onClick={exportExcel} style={{
              width: '100%',
              backgroundColor: '#9333ea',
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
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setModals(prev => ({ ...prev, addBanner: true }))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#2563eb',
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
              backgroundColor: '#9333ea',
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
              backgroundColor: '#ea580c',
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
              backgroundColor: '#4b5563',
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
              backgroundColor: '#4b5563',
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
                  color: '#2563eb',
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
                  onDragStart={() => {
                    if (viewingTab) return;
                    setDraggedBanner(banner.name);
                    setDraggedBannerIndex(index);
                    setDraggedFromSlot(null);
                  }}
                  onDragEnd={() => setDraggedBannerIndex(null)}
                  onDragOver={(e) => {
                    if (viewingTab) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    if (viewingTab) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedBannerIndex !== null && draggedBannerIndex !== index) {
                      handleBannerReorder(draggedBannerIndex, index);
                    }
                    setDraggedBannerIndex(null);
                  }}
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '2px solid #86efac',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: !viewingTab ? 'move' : 'default',
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
                            color: '#2563eb',
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
                            color: '#dc2626',
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
                            boxShadow: isHovering ? (isEligible ? '0 0 0 4px #86efac' : '0 0 0 4px #fca5a5') : 'none'
                          }}
                        >
                          {banner ? (
                            <div
                              draggable={!viewingTab}
                              onDragStart={() => {
                                if (viewingTab) return;
                                setDraggedBanner(banner);
                                setDraggedFromSlot({ locale, slot });
                              }}
                              style={{ position: 'relative' }}
                              onMouseEnter={(e) => {
                                if (!viewingTab) {
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
                                cursor: 'move',
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
      {modals.findReplace && <FindReplaceModal onReplace={findReplace} onClose={() => setModals(prev => ({ ...prev, findReplace: false }))} />}
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
              backgroundColor: '#059669',
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
              backgroundColor: '#d1d5db',
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
              if (selectedLocales.length === 0) return alert('Select at least one locale');
              onSave(banner.name, selectedLocales);
            }}
            style={{
              flex: 1,
              backgroundColor: '#059669',
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
              backgroundColor: '#d1d5db',
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

function FindReplaceModal({ onReplace, onClose }) {
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
          <input
            type="text"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            style={{
              width: '100%',
              border: '2px solid #e5e7eb',
              borderRadius: '4px',
              padding: '8px'
            }}
            placeholder="e.g. New Year Campaign"
          />
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
              backgroundColor: '#9333ea',
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
              backgroundColor: '#d1d5db',
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
              backgroundColor: '#2563eb',
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
              backgroundColor: '#d1d5db',
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