import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './pocketbase';
import { WorkOrder, Notice } from './types';
import { RefreshCw, Maximize2, Minimize2, Pause, Play, ArrowLeft, Megaphone, Plus, X, Trash2, ListChecks, Clock, PlayCircle, Truck, CheckCircle } from 'lucide-react';

interface Props {
  loggedInUser?: { username: string; department: string } | null;
  liveScreenUser?: any;
  onBack?: () => void;
}

interface PageDef {
  key: string;
  label: string;
  status: string;
  icon: React.ReactNode;
}

const PAGES: PageDef[] = [
  { key: 'pending', label: 'In Queue', status: 'Not Started', icon: <Clock size={22} /> },
  { key: 'wip', label: 'Work In Progress', status: 'Work Started', icon: <PlayCircle size={22} /> },
  { key: 'qc', label: 'Ready For QC', status: 'Ready for QC', icon: <ListChecks size={22} /> },
  { key: 'ready-dispatch', label: 'Ready for Dispatch', status: 'Ready for despatch', icon: <Truck size={22} /> },
  { key: 'dispatched-today', label: 'Todays Dispatched', status: 'Dispatched', icon: <CheckCircle size={22} /> },
];

const DEPT_COLUMNS = [
  { key: 'Wood_Work', label: 'Wood Work' },
  { key: 'Corrugation', label: 'Corrugation' },
];

function formatElapsed(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMins}m`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return `${days}d ${remHrs}h`;
}

const LiveScreen: React.FC<Props> = ({ loggedInUser, liveScreenUser, onBack }) => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNoticeManager, setShowNoticeManager] = useState(false);
  const [newNoticeText, setNewNoticeText] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [tick, setTick] = useState(0);
  const [dispatchLogs, setDispatchLogs] = useState<any[]>([]);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const rotateRef = useRef<ReturnType<typeof setInterval>>();
  const prevPageCountRef = useRef(0);
  const [badgePop, setBadgePop] = useState(false);
  const scrollPausedRef = useRef(false);
  const scrollRefs = useRef<(HTMLDivElement | null)[]>([null, null]);

  const activeNotices = useMemo(() => notices.filter(n => n.is_active), [notices]);

  const fetchData = useCallback(async () => {
    const [woRes, dlRes, noticeRes] = await Promise.all([
      supabase.from('work_orders').select('*').limit(200),
      supabase.from('dispatch_logs').select('*'),
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
    ]);
    if (!woRes.error && woRes.data) {
      const sorted = (woRes.data as WorkOrder[]).sort((a, b) => {
        const pa = a.status === 'Work Started' ? 0 : a.status === 'Ready for QC' ? 1 : a.status === 'Not Started' ? 2 : 3;
        const pb = b.status === 'Work Started' ? 0 : b.status === 'Ready for QC' ? 1 : b.status === 'Not Started' ? 2 : 3;
        if (pa !== pb) return pa - pb;
        return b.id > a.id ? 1 : -1;
      });
      setOrders(sorted);
    }
    if (!dlRes.error && dlRes.data) setDispatchLogs(dlRes.data as any[]);
    if (!noticeRes.error && noticeRes.data) setNotices((noticeRes.data as Notice[]).filter(n => n.is_active));
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const todayDispatchIds = useMemo(() => new Set(
    dispatchLogs
      .filter((dl: any) => (dl.dispatch_date || '').slice(0, 10) === todayStr)
      .map((dl: any) => Number(dl.work_order_id))
  ), [dispatchLogs]);

  const activePages = useMemo(() => {
    return PAGES.filter(p => {
      if (p.key === 'dispatched-today') {
        return orders.some(o => o.status === 'Dispatched' && todayDispatchIds.has(o.id));
      }
      return orders.some(o => o.status === p.status);
    });
  }, [orders, todayDispatchIds]);

  const pageOrders = useMemo(() => {
    const page = activePages[currentPage];
    if (!page) return [];
    if (page.key === 'dispatched-today') {
      return orders.filter(o => o.status === 'Dispatched' && todayDispatchIds.has(o.id));
    }
    return orders.filter(o => o.status === page.status);
  }, [orders, currentPage, activePages, todayDispatchIds]);

  const columnOrders = useMemo(() => {
    const grouped: Record<string, WorkOrder[]> = { Wood_Work: [], Corrugation: [] };
    pageOrders.forEach(wo => {
      const depts = wo.assigned_departments || [];
      const match = DEPT_COLUMNS.find(col => depts.includes(col.key));
      if (match) grouped[match.key].push(wo);
    });
    return grouped;
  }, [pageOrders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('live-screen-wo-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_orders' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => { if (playing) { fetchData(); setTick(t => t + 1); } }, 30000);
    return () => clearInterval(iv);
  }, [playing, fetchData]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (rotateRef.current) clearInterval(rotateRef.current);
    if (playing) {
      rotateRef.current = setInterval(() => {
        setCurrentPage(p => (p + 1) % (activePages.length || 1));
      }, 12000);
    }
    return () => { if (rotateRef.current) clearInterval(rotateRef.current); };
  }, [playing, activePages.length]);

  useEffect(() => {
    if (activePages.length > 0 && currentPage >= activePages.length) {
      setCurrentPage(activePages.length - 1);
    }
  }, [currentPage, activePages.length]);

  useEffect(() => {
    if (!playing || !autoScrollEnabled) return;
    const iv = setInterval(() => {
      scrollRefs.current.forEach((el, i) => {
        if (!el) return;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          return;
        } else if (!scrollPausedRef.current) {
          el.scrollTop += 1;
        }
      });
    }, 30);
    return () => clearInterval(iv);
  }, [playing, autoScrollEnabled]);

  useEffect(() => {
    if (pageOrders.length !== prevPageCountRef.current) {
      prevPageCountRef.current = pageOrders.length;
      setBadgePop(true);
      const t = setTimeout(() => setBadgePop(false), 400);
      return () => clearTimeout(t);
    }
  }, [pageOrders.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleAddNotice = async () => {
    const text = newNoticeText.trim();
    if (!text) return;
    const { error } = await supabase.from('notices').insert({ message: text, is_active: true });
    if (!error) { setNewNoticeText(''); fetchData(); }
  };

  const handleDeleteNotice = async (id: number | string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (!error) fetchData();
  };

  const page = activePages[currentPage] || null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 56px), repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 56px), #15171a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        *{font-family:'IBM Plex Sans',sans-serif}
        @keyframes marqueeScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .marquee-track{display:flex;white-space:nowrap;animation:marqueeScroll var(--marquee-duration,30s) linear infinite}
        .scrollbar-thin::-webkit-scrollbar{width:4px}
        .scrollbar-thin::-webkit-scrollbar-track{background:transparent}
        .scrollbar-thin::-webkit-scrollbar-thumb{background:#34393e;border-radius:4px}
        @keyframes fadeSlideIn{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pop{0%{transform:scale(1)}40%{transform:scale(1.25)}60%{transform:scale(0.9)}100%{transform:scale(1)}}
        @keyframes fillbar{from{width:0%}to{width:100%}}
        @keyframes cardSlideUp{0%{opacity:0;transform:translateY(16px) scale(0.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
        .animate-fade-in{animation:fadeSlideIn .35s ease-out}
        .animate-pop{animation:pop .35s ease-out}
        .animate-card-in{animation:cardSlideUp .4s ease-out both}
        .pager-dot{position:relative;height:6px;border-radius:3px;background:#23262b;border:1px solid #34393e;overflow:hidden;flex:1;max-width:80px}
        .pager-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px}
        .pager-dot.active .pager-fill{animation:fillbar 8s linear forwards}
        .stage-badge{font-family:'IBM Plex Mono',monospace;font-weight:600;padding:6px 18px;border-radius:6px}
      `}</style>

      {/* Notice Marquee */}
      {activeNotices.length > 0 && (
        <div className="shrink-0 mx-4 mt-3 mb-1 overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border border-amber-500/30 h-9 flex items-center" style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}>
          <div className="marquee-track flex items-center h-full" style={{ '--marquee-duration': `${Math.max(15, activeNotices.length * 8)}s` } as React.CSSProperties}>
            {[...Array(4)].flatMap(() => activeNotices).map((notice, i) => (
              <span key={`${notice.id}-${i}`} className="inline-flex items-center gap-2 mx-6 text-amber-300/80 font-bold text-sm tracking-wide">
                <Megaphone size={14} className="text-amber-400/60 shrink-0" fill="currentColor" />
                {notice.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clock State */}
      {(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB');
        const dateStr = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(now).toUpperCase();
        return (
      <div className="shrink-0 px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="px-2 py-1 rounded-lg bg-white/5 text-gray-500 hover:bg-white/10 transition-all" style={{fontFamily:'IBM Plex Mono',monospace:true}}>
                <ArrowLeft size={14} />
              </button>
            )}
            <span className="text-sm" style={{fontFamily:'IBM Plex Mono,monospace',color:'#9aa0a6'}}>
              ERP · <b style={{color:'#f3f4f6',fontWeight:600}}>{(liveScreenUser || loggedInUser)?.username || 'Live Screen'}</b>
            </span>
          </div>
          <div className="flex items-center gap-2" style={{fontFamily:'IBM Plex Mono,monospace',fontSize:'12px',fontWeight:600,color:'#e2462f',letterSpacing:'0.14em',textTransform:'uppercase'}}>
            <div style={{width:'10px',height:'10px',borderRadius:'50%',background:'#e2462f'}} />
            Live
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loggedInUser && (
            <button onClick={() => setShowNoticeManager(true)} style={{padding:'4px 10px',borderRadius:'6px',fontSize:'12px',fontWeight:700,background:'rgba(255,176,32,0.1)',color:'#ffb020',border:'1px solid rgba(255,176,32,0.3)'}} className="flex items-center gap-1.5 hover:bg-amber-500/20 transition-all">
              <Megaphone size={12} /> Notice
            </button>
          )}
          <button onClick={() => setPlaying(!playing)} className="p-1.5 rounded-lg" style={{background:'rgba(255,255,255,0.04)',color:'#5e6469'}}>
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded-lg" style={{background:'rgba(255,255,255,0.04)',color:'#5e6469'}}>
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button onClick={() => { fetchData(); setTick(t => t + 1); }} className="p-1.5 rounded-lg" style={{background:'rgba(255,255,255,0.04)',color:'#5e6469'}}>
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setAutoScrollEnabled(!autoScrollEnabled)} style={{
            padding:'4px 8px',borderRadius:'6px',fontSize:'11px',fontWeight:700,
            background:autoScrollEnabled?'rgba(73,177,107,0.15)':'rgba(226,70,47,0.12)',
            color:autoScrollEnabled?'#49b16b':'#e2462f',
            border:`1px solid ${autoScrollEnabled?'rgba(73,177,107,0.35)':'rgba(226,70,47,0.35)'}`
          }} title="Toggle auto-scroll">
            Auto {autoScrollEnabled ? 'ON' : 'OFF'}
          </button>
          <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:'12px',color:'#5e6469',textAlign:'right',marginLeft:'8px'}}>
            <div style={{fontFamily:'inherit'}}>{dateStr}</div>
            <b style={{fontFamily:'inherit',display:'block',color:'#f3f4f6',fontSize:'22px',fontWeight:600,letterSpacing:'0.03em'}}>{timeStr}</b>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Page Content */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-1 pb-1" style={{fontFamily:'IBM Plex Sans,sans-serif'}}>
        {/* Page Header - Stage Panel */}
        {page && (
        <div className="shrink-0 flex items-center gap-3 mb-3" style={{background:'#23262b',border:'1px solid #34393e',borderRadius:'8px',padding:'8px 16px',overflow:'hidden',position:'relative',justifyContent:'center'}}>
          <div style={{position:'absolute',left:0,top:0,bottom:0,width:'10px',background:page.key === 'wip' ? 'repeating-linear-gradient(135deg, #5b9cf6 0 8px, #15171a 8px 16px)' : page.key === 'qc' ? 'repeating-linear-gradient(135deg, #f59e0b 0 8px, #15171a 8px 16px)' : page.key === 'ready-dispatch' ? 'repeating-linear-gradient(135deg, #60c17a 0 8px, #15171a 8px 16px)' : page.key === 'dispatched-today' ? 'repeating-linear-gradient(135deg, #a78bfa 0 8px, #15171a 8px 16px)' : 'repeating-linear-gradient(135deg, #5e6469 0 8px, #15171a 8px 16px)'}} />
          <div style={{display:'flex',alignItems:'center',flexShrink:0}}>
            <span style={{color:page.key === 'wip' ? '#5b9cf6' : page.key === 'qc' ? '#f59e0b' : page.key === 'pending' ? '#9aa0a6' : page.key === 'ready-dispatch' ? '#60c17a' : '#a78bfa',fontSize:'18px'}}>{page.icon}</span>
          </div>
          <h1 style={{fontFamily:'Oswald,sans-serif',fontWeight:600,textTransform:'uppercase',fontSize:'26px',letterSpacing:'0.02em',color:'#f3f4f6'}}>{page.label}</h1>
          <span className={`stage-badge ${badgePop ? 'animate-pop' : ''}`} style={{
            fontFamily:'IBM Plex Mono,monospace',
            fontWeight:600,
            fontSize:'14px',
            background: page.key === 'wip' ? '#5b9cf6' : page.key === 'qc' ? '#f59e0b' : page.key === 'pending' ? '#5e6469' : page.key === 'ready-dispatch' ? '#60c17a' : '#a78bfa',
            color:'#15171a',
            padding:'4px 12px',
            borderRadius:'6px',
            flexShrink:0
          }}>
            {pageOrders.length} {pageOrders.length === 1 ? 'ORDER' : 'ORDERS'}
          </span>
        </div>
        )}

        {/* Order Columns */}
        <div key={currentPage} className="flex-1 flex flex-col min-h-0 animate-fade-in">
        {pageOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'16px',color:'#5e6469'}}>
              <div style={{width:'70px',height:'70px',border:'3px dashed #34393e',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',color:'#5e6469'}}>
                <PlayCircle size={30} />
              </div>
              <div style={{fontFamily:'Oswald,sans-serif',fontSize:'24px',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'#9aa0a6'}}>Station Idle</div>
              <div style={{fontSize:'15px',opacity:0.7}}>No active jobs queued</div>
            </div>
          </div>
        ) : (
          (() => {
            const accentColor = page.key === 'wip' ? '#5b9cf6' : page.key === 'qc' ? '#f59e0b' : page.key === 'pending' ? '#9aa0a6' : page.key === 'ready-dispatch' ? '#60c17a' : '#a78bfa';
            const textColor = page.key === 'wip' ? '#5b9cf6' : page.key === 'qc' ? '#f59e0b' : page.key === 'pending' ? '#f3f4f6' : page.key === 'ready-dispatch' ? '#60c17a' : '#a78bfa';
            return (
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
            {DEPT_COLUMNS.map((col, idx) => {
              const colOrders = columnOrders[col.key];
              return (
                <div key={col.key} className="flex flex-col min-h-0 overflow-hidden" style={{background:'#1d2024',border:'1px solid #34393e',borderRadius:'8px'}}>
                  {/* Column Header */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',padding:'14px 16px',borderBottom:'1px solid #34393e',background:'#23262b'}}>
                    <div style={{width:'12px',height:'12px',borderRadius:'50%',background:accentColor}} />
                    <span style={{fontFamily:'Oswald,sans-serif',fontWeight:600,textTransform:'uppercase',fontSize:'20px',letterSpacing:'0.04em',color:'#f3f4f6'}}>{col.label}</span>
                    <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:600,fontSize:'13px',padding:'3px 12px',borderRadius:'5px',background:accentColor,color:'#15171a'}}>{colOrders.length}</span>
                  </div>
                  {/* Column Body */}
                  <div ref={el => { scrollRefs.current[idx] = el; }} className="flex-1 overflow-y-scroll scrollbar-thin" style={{padding:'4px'}} onMouseEnter={() => { scrollPausedRef.current = true; }} onMouseLeave={() => { scrollPausedRef.current = false; }}>
                    {colOrders.length === 0 ? (
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 0',gap:'10px',color:'#5e6469'}}>
                        <PlayCircle size={24} style={{opacity:0.5}} />
                        <span style={{fontSize:'14px',fontWeight:600}}>No orders in {col.label}</span>
                      </div>
                    ) : (
                      colOrders.map((wo, idx) => {
                        const etdMs = wo.etd ? new Date(wo.etd + 'T12:00:00').getTime() : 0;
                        const daysLeft = etdMs && !isNaN(etdMs) ? Math.ceil((etdMs - Date.now()) / 86400000) : 0;
                        const isOverdue = daysLeft < 0;
                        const daysAbs = Math.abs(daysLeft);
                        const dateStr = wo.etd
                          ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(wo.etd))
                          : 'TBD';
                        return (
                        <div key={wo.id} className="animate-card-in" style={{margin:'4px',animationDelay:`${idx * 50}ms`}}>
                          <div style={{background:'#1d2024',border:`1px solid #34393e`,borderLeft:`4px solid ${accentColor}`,borderRadius:'8px',padding:'14px 16px'}}
                          >
                            <div style={{display:'flex',alignItems:'stretch',gap:'14px'}}>
                              <div style={{flex:1,display:'grid',gridTemplateColumns:'auto 1fr auto',gap:'10px 36px',alignItems:'center',minWidth:0}}>
                                <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:'18px',color:'#f3f4f6',flexShrink:0}}>#{wo.id}</span>
                                <span style={{fontWeight:600,fontSize:'18px',color:textColor,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{wo.customer}</span>
                                <span style={{display:'flex',alignItems:'center',gap:'8px',whiteSpace:'nowrap'}}>
                                  <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:'14px',fontWeight:600,color:'#9aa0a6'}}>{dateStr}</span>
                                  {wo.etd && (
                                    <span style={{
                                      fontFamily:'IBM Plex Mono,monospace',fontSize:'13px',fontWeight:700,
                                      background:isOverdue?'rgba(226,70,47,0.15)':'rgba(73,177,107,0.15)',
                                      color:accentColor,
                                      padding:'2px 7px',borderRadius:'4px'
                                    }}>
                                      {daysAbs}D {isOverdue?'over':'left'}
                                    </span>
                                  )}
                                </span>
                                <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,fontSize:'18px',color:'#f3f4f6',flexShrink:0,visibility:'hidden'}}>#{wo.id}</span>
                                <span style={{fontWeight:600,fontSize:'22px',color:textColor,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{wo.job_details}</span>
                                <span style={{fontWeight:600,fontSize:'22px',color:textColor,whiteSpace:'nowrap'}}>{wo.qty}</span>
                                </div>
                            </div>
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            );
          })()
        )}
        </div>

        {/* Pager Dots */}
        {activePages.length > 0 && (
        <div className="shrink-0 flex items-center justify-center gap-3 pt-2 pb-2">
          {activePages.map((p, i) => (
            <div key={p.key} className={`pager-dot ${i < currentPage ? 'done' : i === currentPage ? 'active' : ''}`} style={{cursor:'pointer'}} onClick={() => setCurrentPage(i)}>
              <div className="pager-fill" style={{background: i < currentPage ? '#5e6469' : p.key === 'wip' ? '#5b9cf6' : p.key === 'qc' ? '#f59e0b' : p.key === 'pending' ? '#9aa0a6' : p.key === 'ready-dispatch' ? '#60c17a' : '#a78bfa', width: i < currentPage ? '100%' : undefined}} />
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Notice Manager Modal */}
      {showNoticeManager && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg flex items-center gap-2"><Megaphone size={18} className="text-amber-400" /> Manage Notices</h3>
              <button onClick={() => setShowNoticeManager(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newNoticeText} onChange={e => setNewNoticeText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNotice(); }} placeholder="Type a notice message..." className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm outline-none placeholder:text-gray-500" />
              <button onClick={handleAddNotice} className="px-3 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 flex items-center gap-1"><Plus size={15} /> Add</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notices.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No notices yet.</p>
              ) : (
                notices.map(notice => (
                  <div key={notice.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${notice.is_active ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <span className="text-white/90 text-sm truncate">{notice.message}</span>
                    </div>
                    <button onClick={() => handleDeleteNotice(notice.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0 ml-2"><Trash2 size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveScreen;
