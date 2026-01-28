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
      // Dragging from another slot - SWAP if target has banner
      const targetBanner = currentWork[locale]?.[slot];
      
      setCurrentWork(prev => {
        const newWork = { ...prev };
        
        if (targetBanner) {
          // SWAP: Move target banner to source slot
          newWork[draggedFromSlot.locale][draggedFromSlot.slot] = targetBanner;
        } else {
          // No swap: Just clear source slot
          delete newWork[draggedFromSlot.locale][draggedFromSlot.slot];
        }
        
        // Place dragged banner in target slot
        newWork[locale][slot] = draggedBanner;
        
        return newWork;
      });
      
      if (targetBanner) {
        showToast(`🔄 Swapped ${draggedBanner} ↔ ${targetBanner}`);
      } else {
        showToast(`✅ Moved ${draggedBanner}`);
      }
    } else {
      // Dragging from banner list - just place
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
    const ineligible = values.filter(bannerName => {
      const banner = banners.find(b => b.name === bannerName);
      return banner && !banner.eligibleLocales.includes(locale);
    });
    
    if (ineligible.length > 0) {
      const names = ineligible.join(', ');
      return { status: 'error', message: `🚫 ${names}` };
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
    <div className="min-h-screen bg-gray-50 p-4">
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50">
          {toastMessage}
        </div>
      )}

      <div className="max-w-full mx-auto">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">🐍 Razer Banner Manager</h1>
              <p className="text-green-100">Drag & drop • Auto-replace • Undo/Redo • Find & Replace</p>
            </div>
            <div className="flex gap-3">
              {Object.keys(arrangements).length > 0 && (
                <label className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-bold cursor-pointer">
                  📁 Re-import Excel
                  <input type="file" accept=".xlsx" onChange={handleImportExcel} className="hidden" />
                </label>
              )}
              <button
                onClick={() => {
                  if (confirm('⚠️ DELETE ALL DATA?\n\nThis will erase everything:\n- All imported arrangements\n- All banners\n- Current work\n\nThis cannot be undone!')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
              >
                🗑️ Delete All
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">📁 Import</h3>
            {Object.keys(arrangements).length === 0 ? (
              <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer font-medium">
                <Upload size={18} /> Import Excel
                <input type="file" accept=".xlsx" onChange={handleImportExcel} className="hidden" />
              </label>
            ) : (
              <select value={viewingTab || ''} onChange={(e) => setViewingTab(e.target.value || null)} className="w-full border-2 rounded px-3 py-2">
                <option value="">Working (vs {baseline})</option>
                {sortedDates.map(d => <option key={d} value={d}>View: {d}</option>)}
              </select>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">⚡ Actions</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => setModals(prev => ({ ...prev, findReplace: true }))} className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 text-sm">
                <Search size={16} className="inline mr-2" /> Find & Replace
              </button>
              <button onClick={() => setModals(prev => ({ ...prev, duplicate: true }))} disabled={viewingTab} className="bg-orange-600 text-white px-3 py-2 rounded hover:bg-orange-700 text-sm disabled:opacity-50">
                <RefreshCw size={16} className="inline mr-2" /> Duplicate
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">📊 Export</h3>
            <button onClick={exportExcel} className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
              <Download size={18} className="inline mr-2" /> Export Excel
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setModals(prev => ({ ...prev, addBanner: true }))}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus size={18} /> Add Banner
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
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-medium disabled:opacity-50"
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
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-medium disabled:opacity-50"
          >
            ↷ Redo
          </button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-lg">📋 Banners</h2>
                <button
                  onClick={() => setModals(prev => ({ ...prev, addBanner: true }))}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-3">💡 Drag to reorder or assign</p>
              <div className="space-y-2 max-h-screen overflow-y-auto">
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
                    className={`bg-green-50 border-2 border-green-300 rounded p-3 ${!viewingTab ? 'cursor-move hover:shadow-md hover:bg-green-100' : 'opacity-50'} ${draggedBannerIndex === index ? 'opacity-50' : ''} transition-all group`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{banner.name}</div>
                        <div className="text-xs text-gray-600">
                          {banner.eligibleLocales.length === LOCALES.length ? 'All locales' : `${banner.eligibleLocales.length} locales`}
                        </div>
                      </div>
                      {!viewingTab && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModals(prev => ({ ...prev, editBanner: banner }));
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBanner(banner.name);
                            }}
                            className="text-red-600 hover:text-red-800"
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
          </div>

          <div className="col-span-9">
            <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
              <h2 className="font-bold text-lg mb-4">🌍 Grid</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-2 bg-gray-200 p-2 font-bold sticky left-0 z-10">Slot</th>
                    {LOCALES.map(loc => (
                      <th key={loc} className="border-2 bg-gray-200 p-2 font-bold min-w-32">{loc}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map(slot => (
                    <tr key={slot}>
                      <td className={`border-2 p-2 font-bold sticky left-0 z-10 ${getSlotZoneStyle(slot)}`}>{slot}</td>
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
                            className={`border-2 p-2 ${getSlotZoneStyle(slot)} ${isHovering ? (isEligible ? 'ring-4 ring-green-400' : 'ring-4 ring-red-400') : ''}`}
                          >
                            {banner ? (
                              <div
                                className="relative group"
                                draggable={!viewingTab}
                                onDragStart={() => {
                                  if (viewingTab) return;
                                  setDraggedBanner(banner);
                                  setDraggedFromSlot({ locale, slot });
                                }}
                              >
                                <div className={`text-sm cursor-move ${getTextStyle(locale, slot)}`}>{banner}</div>
                                {!viewingTab && (
                                  <button onClick={() => clearSlot(locale, slot)} className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full p-1">
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs text-center">{isHovering && !isEligible ? '🚫' : 'Drop'}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  
                  <tr className="bg-gray-100">
                    <td className="border-2 p-2 font-bold sticky left-0 z-10">Status</td>
                    {LOCALES.map(locale => {
                      const status = getLocaleStatus(locale);
                      return (
                        <td key={locale} className={`border-2 p-2 text-center text-xs font-bold ${
                          status.status === 'error' ? 'bg-red-100 text-red-700' :
                          status.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4">Add New Banner</h2>
        <div className="mb-4">
          <label className="block font-semibold mb-2">Banner Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-2 rounded p-2"
            placeholder="e.g. Summer Sale 2026"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-2">Eligible Locales:</label>
          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto border p-2 rounded">
            {LOCALES.map(locale => (
              <label key={locale} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selectedLocales.includes(locale)} onChange={(e) => {
                  if (e.target.checked) setSelectedLocales(prev => [...prev, locale]);
                  else setSelectedLocales(prev => prev.filter(l => l !== locale));
                }} className="w-4 h-4" />
                <span className="text-sm">{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => {
            if (!name.trim() || selectedLocales.length === 0) return alert('Fill all fields');
            onSave(name.trim(), selectedLocales);
          }} className="flex-1 bg-green-600 text-white py-2 rounded">Add</button>
          <button onClick={onClose} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function EditBannerModal({ banner, onSave, onClose }) {
  const [selectedLocales, setSelectedLocales] = useState(banner.eligibleLocales);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4">Edit: {banner.name}</h2>
        <div className="mb-4">
          <label className="block font-semibold mb-2">Eligible Locales:</label>
          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto border p-2 rounded">
            {LOCALES.map(locale => (
              <label key={locale} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selectedLocales.includes(locale)} onChange={(e) => {
                  if (e.target.checked) setSelectedLocales(prev => [...prev, locale]);
                  else setSelectedLocales(prev => prev.filter(l => l !== locale));
                }} className="w-4 h-4" />
                <span className="text-sm">{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => {
            if (selectedLocales.length === 0) return alert('Select at least one locale');
            onSave(banner.name, selectedLocales);
          }} className="flex-1 bg-green-600 text-white py-2 rounded">Save</button>
          <button onClick={onClose} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4">Find & Replace</h2>
        <div className="mb-4">
          <label className="block font-semibold mb-2">Find:</label>
          <input type="text" value={find} onChange={(e) => setFind(e.target.value)} className="w-full border-2 rounded p-2" placeholder="e.g. New Year Campaign" />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-2">Replace:</label>
          <input type="text" value={replace} onChange={(e) => setReplace(e.target.value)} className="w-full border-2 rounded p-2" placeholder="e.g. 2XKO (empty = remove)" />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-2">Locales:</label>
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border p-2 rounded">
            {LOCALES.map(locale => (
              <label key={locale} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selectedLocales.includes(locale)} onChange={(e) => {
                  if (e.target.checked) setSelectedLocales(prev => [...prev, locale]);
                  else setSelectedLocales(prev => prev.filter(l => l !== locale));
                }} className="w-4 h-4" />
                <span className="text-sm">{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onReplace(find, replace, selectedLocales)} className="flex-1 bg-purple-600 text-white py-2 rounded">Replace All</button>
          <button onClick={onClose} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DuplicateModal({ currentWork, onDuplicate, onClose }) {
  const [sourceLocale, setSourceLocale] = useState('US');
  const [targetLocales, setTargetLocales] = useState([]);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4">Duplicate Arrangement</h2>
        <div className="mb-4">
          <label className="block font-semibold mb-2">From:</label>
          <select value={sourceLocale} onChange={(e) => setSourceLocale(e.target.value)} className="w-full border-2 rounded p-2">
            {LOCALES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-2">To:</label>
          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto border p-2 rounded">
            {LOCALES.filter(l => l !== sourceLocale).map(locale => (
              <label key={locale} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={targetLocales.includes(locale)} onChange={(e) => {
                  if (e.target.checked) setTargetLocales(prev => [...prev, locale]);
                  else setTargetLocales(prev => prev.filter(l => l !== locale));
                }} className="w-4 h-4" />
                <span className="text-sm">{locale}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => {
            if (targetLocales.length === 0) return alert('Select target locales');
            onDuplicate(sourceLocale, targetLocales);
          }} className="flex-1 bg-blue-600 text-white py-2 rounded">Duplicate</button>
          <button onClick={onClose} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}