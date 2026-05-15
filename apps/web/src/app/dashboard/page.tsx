"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  Eye, 
  Copy, 
  Check, 
  Trash2, 
  ExternalLink, 
  RefreshCw,
  AlertTriangle,
  ImageIcon,
  Layout,
  CheckSquare,
  Square,
  MinusSquare,
  BarChart3,
  Loader2,
  Menu
} from "lucide-react";

const API_URL = "http://localhost:4000";

function useBreakpoint() {
  const [size, setSize] = useState({ isMobile: false, isTablet: false });
  useEffect(() => {
    const check = () => {
      setSize({
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024
      });
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return size;
}

interface FormEntry {
  form_id: string;
  id?: string;
  title: string;
  created_at: number;
  total_submissions: number;
  is_private: boolean;
  expiry_date?: string | null;
  response_limit?: number | null;
  cover_image_blob_id?: string | null;
  cover_image_url?: string | null;
  isLoadingDetails?: boolean;
}

export default function Dashboard() {
  const account = useCurrentAccount();
  const { isMobile, isTablet } = useBreakpoint();
  const [forms, setForms] = useState<FormEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error"
  } | null>(null);
  
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Bulk Selection State
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    const mappedType = (type === "success" || type === "info") ? "success" : "error";
    setToast({ message, type: mappedType });
    setTimeout(() => setToast(null), 4000);
  };

  const loadForms = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/forms?creator_address=${address}`);
      if (!res.ok) throw new Error("Failed to load your forms");
      const data = await res.json();
      
      const formList = (data.forms || [])
        .filter((f: any) => !f.deleted && f.creator_address);
      
      const formsWithDetails = await Promise.all(
        formList.map(async (f: any) => {
          try {
            const detailRes = await fetch(`${API_URL}/forms/${f.form_id}`);
            if (detailRes.ok) {
              const schema = await detailRes.json();
              const cover_image_blob_id = schema.cover_image_blob_id;
              const cover_image_url = cover_image_blob_id 
                ? `https://aggregator.walrus-mainnet.walrus.space/v1/blobs/${cover_image_blob_id}` 
                : null;

              return {
                ...f,
                title: schema.title || f.title || "Untitled Form",
                cover_image_blob_id,
                cover_image_url,
                isLoadingDetails: false
              };
            }
          } catch (e) {
            console.error(`Failed to fetch schema for ${f.form_id}`, e);
          }
          return { 
            ...f, 
            title: f.title || "Untitled Form", 
            isLoadingDetails: false 
          };
        })
      );

      setForms(formsWithDetails);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account?.address) {
      loadForms(account.address);
    } else {
      setForms([]);
      setSelected(new Set());
    }
  }, [account?.address, loadForms]);

  const copyShareUrl = (form_id: string) => {
    const url = `${window.location.origin}/f/${form_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(form_id);
    showToast("Link copied to clipboard", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredForms = useMemo(() => forms.filter(f => 
    f.title.toLowerCase().includes(search.toLowerCase()) || 
    f.form_id.toLowerCase().includes(search.toLowerCase())
  ), [forms, search]);

  const toggleSelectAll = () => {
    if (selected.size === filteredForms.length && filteredForms.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredForms.map(f => f.form_id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const deleteForm = async (formId: string) => {
    if (!account?.address) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/forms/${formId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_address: account.address }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = { error: "Could not parse response" }; }
      if (res.ok || res.status === 404 || data.success) {
        setForms(prev => prev.filter(f => f.form_id !== formId));
        setDeleteTarget(null);
        setDeleteConfirmText("");
        showToast("Form deleted successfully", "success");
      } else {
        showToast(data.error || "Delete failed", "error");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    if (!account) return;
    setDeleting(true);
    const ids = Array.from(selected);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`${API_URL}/forms/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creator_address: account.address })
          });
          return { id, ok: res.ok };
        })
      );
      const successfulIds = results.filter(r => r.ok).map(r => r.id);
      if (successfulIds.length > 0) {
        setForms(prev => prev.filter(f => !successfulIds.includes(f.form_id)));
        setSelected(prev => {
          const next = new Set(prev);
          successfulIds.forEach(id => next.delete(id));
          return next;
        });
      }
      showToast(`Deleted ${successfulIds.length} forms`, "success");
      setDeleteTarget(null);
      setDeleteConfirmText("");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!account) {
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "16px",
        background: "#050510", zIndex: 1000
      }}>
        <div style={{ fontSize: "56px" }}>🦭</div>
        <h2 style={{ fontSize: "26px", fontWeight: 800, color: "white", margin: 0 }}>Connect your wallet</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", margin: 0 }}>Your forms live on Sui — connect to access them</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: "#050510", color: "white", minHeight: "100vh", position: "relative", overflowX: "hidden", fontFamily: "'Inter', sans-serif"
    }}>
      {/* Background System */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div className="drift1" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "600px", height: "600px", top: "-100px", left: "-200px", background: "radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)", filter: "blur(80px)" }} />
        <div className="drift2" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "500px", height: "500px", top: "200px", right: "-150px", background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)", filter: "blur(80px)" }} />
        <div className="drift3" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "700px", height: "700px", bottom: "-200px", left: "30%", background: "radial-gradient(circle, rgba(6,182,212,0.25), transparent 70%)", filter: "blur(100px)" }} />
        <div className="drift1-reverse" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "400px", height: "400px", top: "50%", right: "20%", background: "radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(60px,40px) scale(1.1); } }
        @keyframes drift2 { 0% { transform: translate(0,0) scale(1.1); } 100% { transform: translate(-40px,60px) scale(1); } }
        @keyframes drift3 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(30px,-50px) scale(1.15); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .drift1 { animation: drift1 12s infinite alternate ease-in-out; }
        .drift2 { animation: drift2 15s infinite alternate ease-in-out; }
        .drift3 { animation: drift3 18s infinite alternate ease-in-out; }
        .drift1-reverse { animation: drift1 10s infinite alternate-reverse ease-in-out; }
        .skeleton-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}} />

      {/* Navbar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, height: isMobile ? "auto" : "60px", zIndex: 100,
        background: "rgba(5,5,16,0.8)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "12px 16px" : "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? "12px" : "0"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: isMobile ? "100%" : "auto" }}>
          <Link href="/" style={{ textDecoration: "none", color: "white", fontWeight: 800, fontSize: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🦭</span> FormWalrus
          </Link>
          <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 4px" }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", fontWeight: 600 }}>Dashboard</span>
        </div>
        <div style={{ width: isMobile ? "100%" : "auto", display: "flex", justifyContent: isMobile ? "flex-end" : "center" }}>
          <ConnectButton />
        </div>
      </nav>

      {/* Header Section */}
      <header style={{ padding: isMobile ? "120px 16px 0" : "116px 40px 0", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", flexDirection: isMobile ? "column" : "row", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: isMobile ? "24px" : "34px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.03em" }}>My Forms</h1>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "100px", padding: "3px 14px", fontSize: "12px", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {account.address.slice(0, 8)}...{account.address.slice(-6)}
              </div>
              <div style={{ background: "rgba(99,102,241,0.15)", borderRadius: "100px", padding: "3px 14px", fontSize: "12px", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                {forms.length} total
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ position: "relative", width: isMobile ? "100%" : "auto" }}>
              <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.2)" }} />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search forms..."
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px", padding: "9px 16px 9px 40px", color: "white",
                  fontSize: "14px", outline: "none", width: isMobile ? "100%" : "220px", transition: "all 0.2s"
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
            <Link href="/builder" style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white", padding: "10px 20px", borderRadius: "10px",
              fontWeight: 700, fontSize: "14px", textDecoration: "none",
              whiteSpace: "nowrap", transition: "all 0.2s", boxShadow: "0 0 20px rgba(99,102,241,0.2)",
              width: isMobile ? "100%" : "auto", textAlign: "center", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center"
            }}>+ New Form</Link>
          </div>
        </div>
      </header>

      {/* Select All Row */}
      <div style={{ padding: isMobile ? "20px 16px 0" : "20px 40px 0", display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 1 }}>
        <input 
          type="checkbox"
          checked={selected.size === filteredForms.length && filteredForms.length > 0}
          onChange={toggleSelectAll}
          style={{ width: "20px", height: "20px", cursor: "pointer" }}
        />
        <span style={{ fontSize: "11px", letterSpacing: "2px", color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase" }}>Select All</span>
        <button 
          onClick={() => loadForms(account.address)}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", padding: "8px", borderRadius: "6px", transition: "all 0.2s", minHeight: "44px", minWidth: "44px", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Bulk Toolbar */}
      {selected.size > 0 && (
        <div style={{
          margin: isMobile ? "16px 16px 0" : "16px 40px 0", background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.25)", borderRadius: "12px", padding: "12px 20px",
          display: "flex", alignItems: "center", gap: isMobile ? "10px" : "16px", position: "relative", zIndex: 1,
          animation: "slideInRight 0.3s ease both", flexWrap: isMobile ? "wrap" : "nowrap"
        }}>
          <div style={{ color: "#818cf8", fontWeight: 600, fontSize: "14px" }}>{selected.size} selected</div>
          <button onClick={toggleSelectAll} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700, cursor: "pointer", minHeight: "44px", padding: "0 8px" }}>Select all</button>
          <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700, cursor: "pointer", minHeight: "44px", padding: "0 8px" }}>Cancel</button>
          <button 
            onClick={() => { setDeleteTarget("__bulk__"); setDeleteConfirmText(""); }}
            style={{
              marginLeft: isMobile ? "0" : "auto", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#f87171", borderRadius: "8px", padding: "8px 16px", fontWeight: 700, cursor: "pointer",
              fontSize: "12px", transition: "all 0.2s", width: isMobile ? "100%" : "auto", minHeight: "44px"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.12)"}
          >Delete {selected.size} forms</button>
        </div>
      )}

      {/* Content Canvas */}
      <main style={{ padding: isMobile ? "24px 16px 40px" : "24px 40px 40px", position: "relative", zIndex: 1 }}>
        {loading && forms.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)"), gap: "16px", padding: "40px 0" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{ height: "110px", borderRadius: "16px" }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "14px", padding: "32px", textAlign: "center", margin: "40px 0" }}>
            <p style={{ color: "#f87171", margin: "0 0 16px", fontWeight: 600 }}>{error}</p>
            <button 
              onClick={() => loadForms(account.address)} 
              style={{ background: "white", color: "black", border: "none", padding: "8px 20px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer", minHeight: "44px" }}
            >Try reload</button>
          </div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "120px 20px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "24px" }}>
            <div style={{ fontSize: "52px", marginBottom: "20px" }}>📋</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: 600, marginBottom: "24px" }}>No forms yet</div>
            <Link href="/builder" style={{ 
              display: "inline-block", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", 
              padding: "12px 28px", borderRadius: "12px", fontWeight: 700, textDecoration: "none", fontSize: "15px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center", maxWidth: "260px", margin: "0 auto"
            }}>Create your first form →</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)"), gap: "16px" }}>
            {filteredForms.map((form) => (
              <div 
                key={form.form_id}
                style={{
                  background: selected.has(form.form_id) ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.03)",
                  border: selected.has(form.form_id) ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "16px", overflow: "hidden", transition: "all 0.2s", display: "flex", height: "auto", minHeight: "110px",
                  cursor: "default", width: "100%"
                }}
                onMouseEnter={e => {
                  if (!isMobile) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)";
                    e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.3)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isMobile) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = selected.has(form.form_id) ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {/* Left Thumbnail */}
                <div style={{ width: "100px", minHeight: "110px", flexShrink: 0, background: "rgba(255,255,255,0.03)", position: "relative" }}>
                  {form.cover_image_url ? (
                    <img src={form.cover_image_url} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.12, fontSize: "24px" }}>🖼</div>
                  )}
                  <div style={{ position: "absolute", top: 0, left: 0, padding: "8px" }}>
                    <input 
                      type="checkbox"
                      checked={selected.has(form.form_id)}
                      onChange={() => toggleSelect(form.form_id)}
                      style={{ width: "20px", height: "20px", cursor: "pointer", zIndex: 2 }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Right Content */}
                <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ fontWeight: 700, fontSize: "15px", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "white" }}>{form.title}</h3>
                    <div style={{
                      borderRadius: "6px", padding: "2px 8px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", flexShrink: 0,
                      background: form.is_private ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.06)",
                      color: form.is_private ? "#a78bfa" : "rgba(255,255,255,0.4)"
                    }}>{form.is_private ? "PRIVATE" : "PUBLIC"}</div>
                  </div>

                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
                    {form.total_submissions} submissions · {new Date(form.created_at).toLocaleDateString()}
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "auto", paddingTop: "8px", flexWrap: "wrap" }}>
                    <Link href={`/f/${form.form_id}`} target="_blank" style={{ color: "rgba(255,255,255,0.35)", transition: "color 0.2s", display: "flex", alignItems: "center", minHeight: "44px", minWidth: "44px", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.color = "white"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}>
                      <Eye size={18} />
                    </Link>
                    <button 
                      onClick={() => copyShareUrl(form.form_id)}
                      style={{ background: "none", border: "none", padding: 0, color: "rgba(255,255,255,0.35)", cursor: "pointer", transition: "color 0.2s", display: "flex", alignItems: "center", minHeight: "44px", minWidth: "44px", justifyContent: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "white"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
                    >
                      <Copy size={18} />
                    </button>
                    <Link href={`/dashboard/${form.form_id}`} style={{ color: "rgba(255,255,255,0.35)", transition: "color 0.2s", display: "flex", alignItems: "center", minHeight: "44px", minWidth: "44px", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.color = "white"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}>
                      <BarChart3 size={18} />
                    </Link>
                    <button 
                      onClick={() => { setDeleteTarget(form.form_id); setDeleteConfirmText(""); }}
                      style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, color: "rgba(239,68,68,0.4)", cursor: "pointer", transition: "color 0.2s", display: "flex", alignItems: "center", minHeight: "44px", minWidth: "44px", justifyContent: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(239,68,68,0.4)"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Modal */}
      {deleteTarget !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center"
        }}>
          <div style={{ 
            background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: isMobile ? "20px 20px 0 0" : "20px", 
            padding: isMobile ? "32px 24px calc(32px + env(safe-area-inset-bottom))" : "36px", width: isMobile ? "100%" : "420px", maxWidth: isMobile ? "100%" : "90vw", textAlign: "center"
          }}>
            <div style={{ color: "#ef4444", marginBottom: "20px", display: "flex", justifyContent: "center" }}><AlertTriangle size={48} /></div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 12px" }}>
              {deleteTarget === "__bulk__" ? `Delete ${selected.size} forms?` : "Delete this form?"}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", lineHeight: 1.5, margin: "0 0 32px" }}>
              This action cannot be undone. All submission indices will be removed from your dashboard.
            </p>
            
            <div style={{ textAlign: "left", marginBottom: "24px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", display: "block", marginBottom: "8px" }}>TYPE DELETE TO CONFIRM</label>
              <input 
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px", padding: "12px 16px", color: "white", fontSize: "16px", outline: "none"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "none", color: "white", fontWeight: 700, cursor: "pointer", minHeight: "48px" }}
              >Cancel</button>
              <button 
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={() => deleteTarget === "__bulk__" ? deleteSelected() : deleteForm(deleteTarget)}
                style={{ 
                  flex: 1, padding: "12px", borderRadius: "12px", 
                  background: deleteConfirmText === "DELETE" && !deleting ? "#ef4444" : "rgba(239,68,68,0.15)", 
                  border: "none", color: "white", fontWeight: 700, cursor: deleteConfirmText === "DELETE" && !deleting ? "pointer" : "not-allowed",
                  transition: "all 0.2s", minHeight: "48px"
                }}
              >
                {deleting ? "Deleting..." : "Delete Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: "rgba(15,15,35,0.95)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px", padding: "12px 20px", color: "white", fontSize: "14px",
          backdropFilter: "blur(20px)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", gap: "10px", animation: "slideInRight 0.3s ease both"
        }}>
          {toast.type === "success" ? <Check size={16} style={{ color: "#00D4AA" }} /> : <AlertTriangle size={16} style={{ color: "#ef4444" }} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
