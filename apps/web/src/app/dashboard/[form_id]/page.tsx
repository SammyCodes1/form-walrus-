"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useCurrentAccount, ConnectButton, useSuiClient, useSignPersonalMessage, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { FormWalrusSuiClient } from "@form-walrus/client";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Download, 
  Shield, 
  TrendingUp, 
  Users, 
  Eye, 
  Calendar,
  ChevronLeft,
  Lock as LockIcon,
  Search,
  X,
  Copy,
  ExternalLink,
  Check,
  Star,
  UserPlus,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { Toast, ToastType } from "@/components/Toast";
import { useSubmissionNotifications } from "@/hooks/useSubmissionNotifications";
import { SealClient, SessionKey, getAllowlistedKeyServers } from "@mysten/seal";
import { fromHex } from "@mysten/bcs";

interface Submission {
  submitted_at: string;
  blob_id: string;
  respondent: string;
  fields?: Record<string, any>;
  tx_digest?: string;
  [key: string]: unknown;
}

interface SelectedSubmission extends Partial<Submission> {
  isLoading?: boolean;
  error?: string;
}

interface AdminEntry {
  address: string;
  role: "creator" | "admin";
  added_at: number;
}

interface Analytics {
  total_submissions: number;
  completion_rate: number;
  unique_respondents: number;
  anonymous_count: number;
  wallet_signed_count: number;
  submissions_by_day: { name: string, value: number }[];
  avg_fields_filled: number;
  last_submission_at: number | null;
  first_submission_at: number | null;
  is_private: boolean;
  expiry_date: string | null;
  response_limit: number | null;
  title?: string;
  allowlist_id?: string;
}

const API_URL = "http://localhost:4000";
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0x21e7032ae20cbb5cdbd9f44994d7a1a983e5d48318e9b89dbc195595e548c823";
const FORM_REGISTRY_ID = process.env.NEXT_PUBLIC_FORM_REGISTRY_ID || "";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function DashboardDetail({ params }: { params: { form_id: string } }) {
  const account = useCurrentAccount();
  const isMobile = useIsMobile();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [decryptedSubmissions, setDecryptedSubmissions] = useState<Record<string, any>>({});
  const [bulkDecrypting, setBulkDecrypting] = useState(false);

  // Create SealClient using the dapp-kit suiClient
  const sealClient = useMemo(() => {
    const serverIds = getAllowlistedKeyServers("mainnet");
    return new SealClient({
      suiClient,
      serverConfigs: serverIds.map((id: string) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false,
    });
  }, [suiClient]);

  const formWalrusSui = useMemo(() => {
    return new FormWalrusSuiClient(suiClient, PACKAGE_ID, FORM_REGISTRY_ID);
  }, [suiClient]);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<SelectedSubmission | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, rate: 0, active: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin Management State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [isGranting, setIsGranting] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Security Logs State
  const [showSecurityLogs, setShowSecurityLogs] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [logSummary, setLogSummary] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // Notes State
  const [noteText, setNoteText] = useState("");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [priority, setPriority] = useState("Low");
  const [decryptedFields, setDecryptedFields] = useState<Record<string, any> | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

  const handleBulkDecrypt = async () => {
    if (!account?.address || bulkDecrypting) return;
    setBulkDecrypting(true);
    showToast("Sign in your wallet to authorize decryption (valid for 10 min)", "info");

    try {
      // 1. Create or use existing SessionKey
      let currentSessionKey = sessionKey;
      if (!currentSessionKey) {
        currentSessionKey = await SessionKey.create({
          address: account.address,
          packageId: PACKAGE_ID,
          ttlMin: 10,
          signer: {
            sign: (message: Uint8Array) => new Promise((resolve, reject) => {
              signPersonalMessage(
                { message },
                {
                  onSuccess: (result) => resolve(fromHex(result.signature)),
                  onError: reject
                }
              );
            }),
          },
          suiClient,
        });
        setSessionKey(currentSessionKey);
      }

      // 2. Decrypt all private submissions
      const newDecrypted: Record<string, any> = { ...decryptedSubmissions };
      
      for (const s of submissions) {
        if (s.fields?.encrypted && !newDecrypted[s.blob_id]) {
          try {
            const encryptedBase64 = s.fields.encrypted;
            const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            const submissionId = s.fields.submissionId;

            const tx = new Transaction();
            tx.moveCall({
              target: `${PACKAGE_ID}::seal_policy::seal_approve`,
              arguments: [
                tx.pure.address(submissionId),
                tx.pure.address(account.address),
              ],
            });
            const txBytes = await tx.build({ client: suiClient });

            const decryptedBytes = await sealClient.decrypt({
              data: encryptedBytes,
              sessionKey: currentSessionKey,
              txBytes,
            });
            
            const decrypted = new TextDecoder().decode(decryptedBytes);
            newDecrypted[s.blob_id] = JSON.parse(decrypted);
          } catch (err) {
            console.error(`Failed to decrypt submission ${s.blob_id}:`, err);
          }
        }
      }

      setDecryptedSubmissions(newDecrypted);
      showToast("All submissions decrypted successfully", "success");
    } catch (e: any) {
      console.error("Bulk decryption failed:", e);
      showToast("Decryption failed: " + e.message, "error");
    } finally {
      setBulkDecrypting(false);
    }
  };

  const handleDecrypt = async (submission: any) => {
    if (!account?.address) return;
    setDecrypting(true);
    setDecryptError("");

    try {
      // 1. Create SessionKey (requires wallet signature — user approves once)
      let currentSessionKey = sessionKey;
      if (!currentSessionKey) {
        currentSessionKey = await SessionKey.create({
          address: account.address,
          packageId: PACKAGE_ID,
          ttlMin: 10,
          signer: {
            sign: (message: Uint8Array) => new Promise((resolve, reject) => {
              signPersonalMessage(
                { message },
                {
                  onSuccess: (result) => resolve(fromHex(result.signature)),
                  onError: reject
                }
              );
            }),
          },
          suiClient,
        });
        setSessionKey(currentSessionKey);
      }

      const encryptedBase64 = submission.fields.encrypted;
      const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const submissionId = submission.fields.submissionId;

      // 2. Build approval transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policy::seal_approve`,
        arguments: [
          tx.pure.address(submissionId),
          tx.pure.address(account.address),
        ],
      });
      const txBytes = await tx.build({ client: suiClient });

      // 3. Decrypt
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey: currentSessionKey,
        txBytes,
      });
      const decrypted = new TextDecoder().decode(decryptedBytes);
      const answers = JSON.parse(decrypted);

      setDecryptedFields(answers);
      setDecryptedSubmissions(prev => ({ ...prev, [submission.blob_id]: answers }));

    } catch (e: any) {
      console.error("Decryption failed:", e);
      setDecryptError(e.message);
    }
    setDecrypting(false);
  };

  // Notifications State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const {
    newSubmission,
    notificationCount,
    clearNotifications,
  } = useSubmissionNotifications(
    params.form_id,
    account?.address || "",
    notificationsEnabled && !!account?.address
  );

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
  };

  const fetchAdmins = useCallback(async () => {
    if (!account?.address) return;
    setLoadingAdmins(true);
    try {
      const res = await fetch(`${API_URL}/forms/${params.form_id}/admins?caller_address=${account.address}`);
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (e) {
      console.error("Failed to fetch admins", e);
    } finally {
      setLoadingAdmins(false);
    }
  }, [params.form_id, account]);

  useEffect(() => {
    if (showAdminModal) {
      fetchAdmins();
    }
  }, [showAdminModal, fetchAdmins]);

  const handleGrantAccess = async () => {
    if (!newAdminAddress.startsWith("0x") || newAdminAddress.length !== 66) {
      setAddressError("Invalid Sui address");
      return;
    }
    if (!account) return;
    
    setAddressError(null);
    setIsGranting(true);
    
    try {
      const allowlistId = analytics?.allowlist_id || (analytics as any)?.seal_object_id;
      if (!allowlistId) throw new Error("Allowlist not found for this form");

      const caps = await formWalrusSui.getOwnedAllowlistCaps(account.address);
      const adminCap = caps.find(c => c.allowlist_id === allowlistId);
      
      if (!adminCap) throw new Error("You don't have the AdminCap for this allowlist");

      const tx = buildAddToAllowlistTx(allowlistId, adminCap.id, newAdminAddress, account.address);
      
      await signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          // Also notify backend
          try {
            await fetch(`${API_URL}/forms/${params.form_id}/admins`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                admin_address: newAdminAddress,
                caller_address: account.address
              })
            });
          } catch (e) {
            console.warn("Backend admin sync failed:", e);
          }

          showToast("Access granted successfully", "success");
          setNewAdminAddress("");
          fetchAdmins();
        },
        onError: (err) => {
          showToast("Failed to grant access: " + err.message, "error");
        }
      });
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeAccess = async (adminAddress: string) => {
    if (!account) return;
    
    try {
      const allowlistId = analytics?.allowlist_id || (analytics as any)?.seal_object_id;
      if (!allowlistId) throw new Error("Allowlist not found for this form");

      const caps = await formWalrusSui.getOwnedAllowlistCaps(account.address);
      const adminCap = caps.find(c => c.allowlist_id === allowlistId);
      
      if (!adminCap) throw new Error("You don't have the AdminCap for this allowlist");

      const tx = buildRemoveFromAllowlistTx(allowlistId, adminCap.id, adminAddress, account.address);
      
      await signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          // Also notify backend
          try {
            await fetch(`${API_URL}/forms/${params.form_id}/admins/${adminAddress}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                caller_address: account.address
              })
            });
          } catch (e) {
            console.warn("Backend admin sync failed:", e);
          }

          showToast("Access revoked successfully", "success");
          fetchAdmins();
        },
        onError: (err) => {
          showToast("Failed to revoke access: " + err.message, "error");
        }
      });
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  useEffect(() => {
    if (selectedSubmission?.blob_id) {
      fetch(`${API_URL}/submissions/${selectedSubmission.blob_id}/notes/history`)
        .then(res => res.json())
        .then(data => {
          setNoteHistory(data);
          setNoteText("");
          setHasUnsavedChanges(false);
        });
    }
  }, [selectedSubmission]);

  const saveNote = useCallback(async () => {
    if (!selectedSubmission?.blob_id || !noteText.trim() || !account) return;
    
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_URL}/submissions/${selectedSubmission.blob_id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteText,
          priority,
          status: "Updated",
          caller_address: account.address
        })
      });
      
      if (res.ok) {
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        const histRes = await fetch(`${API_URL}/submissions/${selectedSubmission.blob_id}/notes/history`);
        const histData = await histRes.json();
        setNoteHistory(histData);
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (e) {
      console.error("Save failed", e);
      setSaveStatus('idle');
    }
  }, [selectedSubmission, noteText, priority, account]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timeout = setTimeout(() => {
      saveNote();
    }, 2000);
    return () => clearTimeout(timeout);
  }, [saveNote, hasUnsavedChanges]);

  const fetchAllData = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const [subRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/forms/${params.form_id}/submissions?caller_address=${account.address}`),
        fetch(`${API_URL}/forms/${params.form_id}/analytics?caller_address=${account.address}`)
      ]);

      if (!subRes.ok || !analyticsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const subData = await subRes.json();
      const analyticsData = await analyticsRes.json();

      setSubmissions(subData.entries || []);
      setAnalytics(analyticsData);
      setLoading(false);

      const duration = 1500;
      const startTime = performance.now();
      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setStats({
          total: Math.floor(easeOut * analyticsData.total_submissions),
          rate: Math.floor(easeOut * analyticsData.completion_rate),
          active: Math.floor(easeOut * analyticsData.unique_respondents)
        });
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [params.form_id, account]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (!newSubmission) return;
    const timer = setTimeout(clearNotifications, 8000);
    return () => clearTimeout(timer);
  }, [newSubmission, clearNotifications]);

  const trendData = useMemo(() => {
    if (!analytics?.submissions_by_day) return [];
    return analytics.submissions_by_day;
  }, [analytics]);

  const exportExcel = () => {
    if (account) {
      window.open(`${API_URL}/forms/${params.form_id}/export?caller_address=${account.address}`, "_blank");
    }
  };

  const fetchSecurityLogs = async () => {
    if (!account?.address) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_URL}/forms/${params.form_id}/security-logs?caller_address=${account.address}`);
      const data = await res.json();
      if (res.ok) {
        setSecurityLogs(data.logs || []);
        setLogSummary(data.summary || null);
      } else {
        setSecurityLogs([]);
      }
    } catch (e) {
      console.error("Failed to load security logs:", e);
    }
    setLogsLoading(false);
  };

  const viewSubmission = async (s: Submission) => {
    setDecryptedFields(null);
    setIsPanelOpen(true);
    setSelectedSubmission({ ...s, isLoading: true });
    try {
      const res = await fetch(`${API_URL}/submissions/${s.blob_id}`);
      if (!res.ok) throw new Error("Failed to load submission data");
      const data = await res.json();
      
      setSelectedSubmission({ ...s, fields: data.fields || {}, isLoading: false, ...data });
    } catch (e: any) {
      setSelectedSubmission({ ...s, error: e.message, isLoading: false });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderFieldValue = (val: unknown) => {
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "number") {
      return (
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(star => (
            <Star key={star} size={14} fill={star <= val ? "#F59E0B" : "transparent"} className={star <= val ? "text-[#F59E0B]" : "text-white/10"} />
          ))}
        </div>
      );
    }
    if (typeof val === "boolean") {
      return val ? (
        <span className="bg-[#00D4AA10] text-[#00D4AA] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#00D4AA20] flex items-center gap-1.5"><Check size={10} /> Confirmed</span>
      ) : (
        <span className="bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-red-500/20 flex items-center gap-1.5"><X size={10} /> No</span>
      );
    }
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return String(val);
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center p-12 text-center">
        <div className="max-w-md w-full bg-[#0C0C10] border border-[rgba(255,255,255,0.06)] rounded-[18px] py-12 px-8 animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-[#7C5CFC] mx-auto mb-6"><LockIcon size={32} /></div>
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-[rgba(240,240,245,0.55)] mb-8">Connect your wallet to view form analytics and submissions.</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F0F0F5] flex flex-col overflow-hidden" style={{ animation: "fadeIn 0.4s ease both" }}>
      <nav className="h-14 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(8,8,12,0.85)] backdrop-blur-[20px] saturate-[180%] flex items-center justify-between px-3 sm:px-6 sticky top-0 z-[100] gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.02] hover:bg-white/5 transition-all text-white/40"><ChevronLeft size={18} /></Link>
          <div className="min-w-0">
             <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] sm:max-w-[200px]">{analytics?.title || "Form Analytics"}</h1>
             <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/20 px-1 sm:px-1.5 py-0.5 bg-white/5 rounded border border-white/5">{params.form_id.slice(0, 8)}...</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setNotificationsEnabled(prev => !prev)
              clearNotifications()
            }}
            title={
              notificationsEnabled 
                ? "Notifications on — click to disable" 
                : "Notifications off — click to enable"
            }
            style={{
              position: "relative",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "0.5px solid " + (
                notificationsEnabled
                  ? "rgba(124,92,252,0.3)"
                  : "rgba(255,255,255,0.08)"
              ),
              background: notificationsEnabled
                ? "rgba(124,92,252,0.1)"
                : "transparent",
              color: notificationsEnabled
                ? "#A78BFA"
                : "rgba(240,240,245,0.4)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
          >
            {notificationsEnabled ? "🔔" : "🔕"}

            {notificationCount > 0 && (
              <div style={{
                position: "absolute",
                top: "-5px",
                right: "-5px",
                background: "#FF5566",
                color: "#fff",
                borderRadius: "50%",
                width: "17px",
                height: "17px",
                fontSize: "9px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #050507",
                fontFamily: "inherit",
              }}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </div>
            )}
          </button>
          
          <button onClick={() => { setShowSecurityLogs(true); fetchSecurityLogs(); }} className="w-9 h-9 sm:w-auto sm:px-4 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[12px] font-bold text-white/60 hover:bg-white/5 transition-all flex items-center justify-center gap-2" title="Security">
            <ShieldAlert size={16} /> <span className="hidden sm:inline">Security</span>
          </button>
          
          <button onClick={exportExcel} className="w-9 h-9 sm:w-auto sm:px-4 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[12px] font-bold text-white/60 hover:bg-white/5 transition-all flex items-center justify-center gap-2" title="Export">
             <Download size={15} /> <span className="hidden sm:inline">Export</span>
          </button>
          
          <button onClick={() => setShowAdminModal(true)} className="w-9 h-9 sm:w-auto sm:px-4 rounded-xl border border-[#7C5CFC33] bg-[#7C5CFC11] text-[12px] font-bold text-[#9B7DFF] hover:bg-[#7C5CFC22] transition-all flex items-center justify-center gap-2" title="Admin">
             <Shield size={15} /> <span className="hidden sm:inline">Admin</span>
          </button>

          {analytics?.is_private && (
            <button 
              onClick={handleBulkDecrypt} 
              disabled={bulkDecrypting}
              className="w-9 h-9 sm:w-auto sm:px-4 rounded-xl border border-[#00D4AA33] bg-[#00D4AA11] text-[12px] font-bold text-[#00D4AA] hover:bg-[#00D4AA22] transition-all flex items-center justify-center gap-2" 
              title="Decrypt Submissions"
            >
              {bulkDecrypting ? <Loader2 size={15} className="animate-spin" /> : <LockIcon size={15} />}
              <span className="hidden sm:inline">{bulkDecrypting ? "Decrypting..." : "Decrypt All"}</span>
            </button>
          )}
          
          {!isMobile && <div className="h-4 w-px bg-white/10 mx-1" />}
          <ConnectButton />
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Spinner size={32} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Indexing Walrus Clusters...</p>
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto space-y-8 sm:space-y-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-up">
               {[
                 { label: "Submissions", value: stats.total, icon: <Users size={isMobile ? 16 : 20} />, color: "#7C5CFC", bg: "rgba(124,92,252,0.1)", trend: `+${analytics?.wallet_signed_count} signed` },
                 { label: "Completion", value: `${stats.rate}%`, icon: <TrendingUp size={isMobile ? 16 : 20} />, color: "#00D4AA", bg: "rgba(0,212,170,0.1)", trend: `${analytics?.avg_fields_filled} avg fields` },
                 { label: "Respondents", value: stats.active, icon: <Eye size={isMobile ? 16 : 20} />, color: "#60A5FA", bg: "rgba(96,165,250,0.1)", trend: `${analytics?.anonymous_count} anonymous` },
                 { label: "Last Active", value: analytics?.last_submission_at ? new Date(analytics.last_submission_at).toLocaleDateString() : "—", icon: <Calendar size={isMobile ? 16 : 20} />, color: "#F59E0B", bg: "rgba(245,158,11,0.1)", trend: analytics?.last_submission_at ? "Stable" : "No data" }
               ].map((card, i) => (
                 <div key={i} className="bg-[#0C0C10] border border-[rgba(255,255,255,0.06)] rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all hover:border-white/10 group">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                       <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all group-hover:scale-110" style={{ background: card.bg, color: card.color }}>{card.icon}</div>
                       <span className="text-[8px] sm:text-[10px] font-bold text-white/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-white/5 bg-white/[0.02] truncate max-w-[50%]">{card.trend}</span>
                    </div>
                    <div className="text-[20px] sm:text-[32px] font-bold text-white mb-0.5 sm:mb-1">{card.value}</div>
                    <div className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.05em] text-white/30 truncate">{card.label}</div>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2">
                 <div className="bg-[#0C0C10] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 h-[420px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <TrendingUp size={16} className="text-[#7C5CFC]" /> Submission Activity
                       </h3>
                    </div>
                    <div className="flex-1 min-h-0">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={trendData}>
                           <defs>
                             <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#7C5CFC" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#7C5CFC" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: "rgba(255,255,255,0.2)", fontSize: 10}} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{fill: "rgba(255,255,255,0.2)", fontSize: 10}} />
                           <Tooltip 
                             contentStyle={{backgroundColor: "rgba(8,8,12,0.9)", border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '12px', backdropFilter: 'blur(10px)', color: "white"}}
                             itemStyle={{color: '#7C5CFC', fontSize: '12px'}}
                           />
                           <Area type="monotone" dataKey="value" stroke="#7C5CFC" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                         </AreaChart>
                       </ResponsiveContainer>
                    </div>
                 </div>
               </div>

               <div className="bg-gradient-to-br from-[#111116] to-[#050507] border border-[#7C5CFC11] rounded-2xl p-8 relative overflow-hidden flex flex-col">
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative ${analytics?.is_private ? 'text-[#7C5CFC] bg-[#7C5CFC15]' : 'text-white/20 bg-white/5'}`}>
                       <LockIcon size={28} />
                       {analytics?.is_private && <div className="absolute inset-0 bg-[#7C5CFC] opacity-20 blur-2xl animate-pulse" />}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Privacy Shield</h3>
                    <p className="text-sm text-white/40 leading-relaxed mb-8">
                       {analytics?.is_private 
                         ? "This form is private. Responses are stored in encrypted blobs accessible only via your AdminCap."
                         : "This form is currently public. Submissions are stored on Walrus and can be indexed by explorers."}
                    </p>
                  </div>
               </div>
            </div>

            <div className="bg-[#0C0C10] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden animate-fade-up">
              <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.01] gap-4">
                 <div className="flex items-center gap-3">
                   <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Recent Activity</h3>
                   <span className="bg-white/5 text-white/40 px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/5">{submissions.length} total</span>
                 </div>
                 <div className="relative w-full sm:w-auto">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                   <input type="text" placeholder="Filter submissions..." className="bg-[#1a1a2e] border border-white/[0.15] rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-[#7C5CFC] w-full sm:w-64 transition-all" />
                 </div>
              </div>

              {!isMobile ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.01]">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Respondent</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Submitted At</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Walrus Blob ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/20 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.length === 0 ? (
                        <tr><td colSpan={5} className="py-20 text-center text-white/20 italic text-sm">Waiting for incoming submissions...</td></tr>
                      ) : (
                        submissions.map((s) => (
                          <tr 
                            key={s.blob_id} 
                            onClick={() => viewSubmission(s)}
                            className="border-t border-white/5 hover:bg-white/[0.02] transition-all cursor-pointer group"
                          >
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C5CFC] to-[#9B7DFF] flex items-center justify-center text-[10px] font-black text-white">
                                      {s.respondent.slice(2, 4).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-mono text-white/60 group-hover:text-white transition-colors">{s.respondent.slice(0, 10)}...{s.respondent.slice(-6)}</span>
                                    {decryptedSubmissions[s.blob_id] && (
                                      <span className="text-[10px] text-[#00D4AA] font-bold mt-0.5 truncate max-w-[180px]">
                                        {Object.values(decryptedSubmissions[s.blob_id].fields || decryptedSubmissions[s.blob_id])
                                          .filter(v => typeof v === 'string' || typeof v === 'number')
                                          .slice(0, 2)
                                          .join(" · ")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-xs text-white/40">
                                {new Date(s.submitted_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-white/20">{s.blob_id.slice(0, 12)}...</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleCopy(s.blob_id, s.blob_id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/5 transition-all"><Copy size={12} className="text-white/20" /></button>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                {s.tx_digest ? (
                                  <span className="bg-[#00D4AA10] text-[#00D4AA] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#00D4AA20]">Signed</span>
                                ) : (
                                  <span className="bg-white/5 text-white/30 px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/5">Anonymous</span>
                                )}
                            </td>
                            <td className="px-6 py-5 text-right">
                                <button className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40 group-hover:bg-[#7C5CFC] group-hover:text-white transition-all">Details →</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {submissions.length === 0 ? (
                    <div className="py-20 text-center text-white/20 italic text-sm">Waiting for incoming submissions...</div>
                  ) : (
                    submissions.map((s) => (
                      <div 
                        key={s.blob_id}
                        onClick={() => viewSubmission(s)}
                        style={{ 
                          background: "rgba(255,255,255,0.03)",
                          border: "0.5px solid rgba(255,255,255,0.08)",
                          borderRadius: "12px",
                          padding: "14px 16px",
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7C5CFC] to-[#9B7DFF] flex items-center justify-center text-[8px] font-black text-white">
                                {s.respondent.slice(2, 4).toUpperCase()}
                             </div>
                             <div className="flex flex-col min-w-0">
                               <span className="text-xs font-mono text-white/60">{s.respondent.slice(0, 8)}...{s.respondent.slice(-4)}</span>
                               {decryptedSubmissions[s.blob_id] && (
                                  <span className="text-[9px] text-[#00D4AA] font-bold mt-0.5 truncate max-w-[150px]">
                                    {Object.values(decryptedSubmissions[s.blob_id].fields || decryptedSubmissions[s.blob_id])
                                      .filter(v => typeof v === 'string' || typeof v === 'number')
                                      .slice(0, 2)
                                      .join(" · ")}
                                  </span>
                               )}
                             </div>
                           </div>                           {s.tx_digest ? (
                              <span className="bg-[#00D4AA10] text-[#00D4AA] px-2 py-0.5 rounded-full text-[8px] font-bold border border-[#00D4AA20]">Signed</span>
                            ) : (
                              <span className="bg-white/5 text-white/30 px-2 py-0.5 rounded-full text-[8px] font-bold border border-white/5">Anon</span>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                           <div className="text-[10px] text-white/30">
                              {new Date(s.submitted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                           </div>
                           <div className="text-[10px] font-bold text-[#7C5CFC] uppercase tracking-wider">View Details →</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isPanelOpen && selectedSubmission && (
        <div className="fixed inset-0 z-[1000] flex justify-end items-end sm:items-stretch">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={() => setIsPanelOpen(false)} />
           <div 
             className="w-full sm:max-w-[420px] bg-[#0C0C10] border-t sm:border-t-0 sm:border-l border-white/10 h-[92vh] sm:h-full relative z-10 flex flex-col shadow-2xl rounded-t-[24px] sm:rounded-t-0 animate-slide-in-up sm:animate-slide-in-right"
             style={{ animation: isMobile ? "slideInUp 0.4s cubic-bezier(0.22,1,0.36,1) both" : "slideInRight 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
           >
              {isMobile && (
                <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.2)", margin: "12px auto 0", flexShrink: 0 }} />
              )}
              <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between">
                 <div>
                    <h2 className="text-base sm:text-lg font-bold text-white mb-1">Submission Details</h2>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/20">Received {selectedSubmission.submitted_at ? new Date(selectedSubmission.submitted_at).toLocaleString() : "Unknown date"}</p>
                 </div>
                 <button onClick={() => setIsPanelOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-all text-white/30"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar">
                 <section className="space-y-3 sm:space-y-4">
                    <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Respondent</label>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                       <div className="flex items-center gap-3 mb-4 sm:mb-6">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#7C5CFC] to-[#9B7DFF] flex items-center justify-center text-[10px] font-black text-white">
                             {selectedSubmission.respondent?.slice(2, 4).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="text-xs sm:text-sm font-bold text-white truncate">{selectedSubmission.respondent}</p>
                             <button onClick={() => handleCopy(selectedSubmission.respondent || "", 'addr')} className="text-[9px] sm:text-[10px] font-bold text-[#7C5CFC] hover:underline uppercase tracking-widest">{copiedId === 'addr' ? 'Copied!' : 'Copy Address'}</button>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => window.open(`https://walruscan.com/testnet/en/blob/${selectedSubmission.blob_id}`, "_blank")} className="flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all border border-white/5"><ExternalLink size={12} /> Walrus</button>
                          {selectedSubmission.tx_digest && <button onClick={() => window.open(`https://suiscan.xyz/testnet/tx/${selectedSubmission.tx_digest}`, "_blank")} className="flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all border border-white/5"><ExternalLink size={12} /> Suiscan</button>}
                       </div>
                    </div>
                 </section>

                 <section className="space-y-3 sm:space-y-4">
                    <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Responses</label>
                    <div className="space-y-3 sm:space-y-4">
                       {selectedSubmission.isLoading ? (
                          <div className="flex flex-col items-center py-10 gap-3"><Spinner size={20} /><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Decrypting Blob...</p></div>
                       ) : (selectedSubmission as any).fields?.encrypted ? (
                          <div style={{
                            padding: "16px",
                            background: "rgba(124,92,252,0.06)",
                            border: "0.5px solid rgba(124,92,252,0.2)",
                            borderRadius: "12px",
                            textAlign: "center",
                          }}>
                            {!decryptedFields ? (
                              <>
                                <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                                  🔐
                                </div>
                                <div style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "white",
                                  marginBottom: "4px",
                                }}>
                                  Encrypted with Seal
                                </div>
                                <div style={{
                                  fontSize: "11px",
                                  color: "rgba(240,240,245,0.4)",
                                  marginBottom: "14px",
                                }}>
                                  Sign with wallet to decrypt
                                </div>
                                {decryptError && (
                                  <div style={{
                                    fontSize: "11px",
                                    color: "#FF5566",
                                    marginBottom: "10px",
                                    padding: "8px",
                                    background: "rgba(255,85,102,0.08)",
                                    borderRadius: "6px",
                                  }}>
                                    {decryptError}
                                  </div>
                                )}
                                <button
                                  onClick={() => handleDecrypt(selectedSubmission)}
                                  disabled={decrypting}
                                  style={{
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    border: "none",
                                    background: decrypting
                                      ? "rgba(124,92,252,0.3)"
                                      : "linear-gradient(135deg, #7C5CFC, #A855F7)",
                                    color: "#fff",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: decrypting ? "not-allowed" : "pointer",
                                    fontFamily: "inherit",
                                    width: "100%",
                                    minHeight: "44px"
                                  }}
                                >
                                  {decrypting 
                                    ? "🔑 Decrypting..." 
                                    : "🔑 Decrypt with Wallet"}
                                </button>
                              </>
                            ) : (
                              <>
                                <div style={{
                                  fontSize: "11px",
                                  color: "#00D4AA",
                                  marginBottom: "12px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  justifyContent: "center",
                                }}>
                                  ✓ Decrypted successfully
                                  <button
                                    onClick={() => setDecryptedFields(null)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "rgba(240,240,245,0.4)",
                                      cursor: "pointer",
                                      fontSize: "11px",
                                    }}
                                  >
                                    (hide)
                                  </button>
                                </div>
                                {Object.entries((decryptedFields as any).fields || decryptedFields).map(
                                  ([key, value]: any, i) => {
                                    if (["form_id","submitted_at",
                                         "respondent_address",
                                         "media_blob_ids","tx_digest",
                                         "encrypted","encrypted_blob_id",
                                         "is_encrypted"].includes(key)) return null;
                                    return (
                                      <div key={i} style={{
                                        textAlign: "left",
                                        padding: "10px 0",
                                        borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                                      }}>
                                        <div style={{
                                          fontSize: "9px",
                                          color: "rgba(240,240,245,0.4)",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.06em",
                                          marginBottom: "4px",
                                        }}>{key.replace(/_/g, ' ')}</div>
                                        <div style={{
                                          fontSize: "13px",
                                          color: "white",
                                        }}>
                                          {typeof value === "boolean"
                                            ? value ? "✓ Confirmed" : "✗ No"
                                            : typeof value === "number"
                                            ? "★".repeat(value) + 
                                              "☆".repeat(Math.max(0, 5 - value))
                                            : Array.isArray(value)
                                            ? value.join(", ")
                                            : String(value)}
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </>
                            )}
                          </div>
                       ) : selectedSubmission.fields ? (
                          Object.entries(selectedSubmission.fields).map(([key, value]) => {
                             const skip = ["form_id", "submitted_at", "respondent_address", "media_blob_ids", "_encrypted", "seal_object_id"];
                             if (skip.includes(key.toLowerCase())) return null;
                             if (key.toLowerCase().endsWith("blobid")) return null;
                             return (
                                <div key={key} className="space-y-1.5 pb-3 sm:pb-4 border-b border-white/[0.03] last:border-0">
                                   <p className="text-[9px] sm:text-[10px] font-bold text-white/30 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                                   <div className="text-[13px] sm:text-[14px] text-white/80 leading-relaxed">{renderFieldValue(value)}</div>
                                </div>
                             );
                          })
                       ) : <p className="text-xs italic text-white/20">No response data found</p>}
                    </div>
                 </section>

                 <section className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                       <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Admin Notes</label>
                       {saveStatus === 'saving' && <span className="text-[9px] font-bold text-[#7C5CFC] uppercase tracking-widest animate-pulse">Saving...</span>}
                       {saveStatus === 'saved' && <span className="text-[9px] font-bold text-[#00D4AA] uppercase tracking-widest">Saved</span>}
                    </div>
                    <div className="space-y-3">
                       <div className="flex gap-1.5 sm:gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                          {["Low", "Med", "High", "Critical"].map(p => (
                             <button key={p} onClick={() => { setPriority(p); setHasUnsavedChanges(true); }} className={`flex-1 min-w-[70px] py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${priority.startsWith(p) ? 'bg-[#7C5CFC11] border-[#7C5CFC44] text-[#9B7DFF]' : 'bg-white/5 border-white/5 text-white/20 hover:text-white/40'}`}>{p}</button>
                          ))}
                       </div>
                       <textarea 
                          value={noteText}
                          onChange={(e) => { setNoteText(e.target.value); setHasUnsavedChanges(true); }}
                          placeholder="Internal team notes..."
                          className="w-full bg-[#1a1a2e] border border-white/[0.15] rounded-xl p-4 text-sm text-white focus:border-[#7C5CFC55] outline-none transition-all resize-none h-32 shadow-inner"
                       />
                       <button onClick={saveNote} className="w-full py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.1] text-[11px] font-bold uppercase tracking-widest text-white/60 transition-all min-height-[44px]">Manual Save</button>
                    </div>
                 </section>
              </div>

              <div className="p-5 sm:p-6 border-t border-white/5 bg-black/20 flex gap-3 pb-8 sm:pb-6">
                 <button onClick={() => handleCopy(selectedSubmission.blob_id || "", 'blob')} className="flex-1 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white font-bold text-xs uppercase tracking-widest transition-all min-height-[44px]">Copy Blob ID</button>
                 <button onClick={() => setIsPanelOpen(false)} className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-widest transition-all min-height-[44px]">Close</button>
              </div>
           </div>
        </div>
      )}

      {showSecurityLogs && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-6 bg-black/80 backdrop-blur-[10px] animate-fade-in">
          <div className="bg-[#0C0C10] border border-[rgba(107,60,255,0.3)] rounded-t-[20px] sm:rounded-[20px] w-full sm:max-w-[640px] h-[95vh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-slide-in-up sm:animate-scale-in">
            {isMobile && (
              <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.2)", margin: "12px auto 0", flexShrink: 0 }} />
            )}
            <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white mb-1">🔐 Security Audit Logs</h2>
                <p className="text-[9px] sm:text-[11px] text-white/40 uppercase tracking-wider">Historical trail of form access</p>
              </div>
              <button onClick={() => setShowSecurityLogs(false)} className="text-white/30 hover:text-white transition-colors"><X size={24} /></button>
            </div>

            {logSummary && (
              <div className="grid grid-cols-4 border-b border-white/5 bg-white/[0.01]">
                {[
                  { label: "Views", val: logSummary.form_views, color: "#9B7DFF" },
                  { label: "Entries", val: logSummary.submissions, color: "#00D4AA" },
                  { label: "Exports", val: logSummary.exports, color: "#60A5FA" },
                  { label: "Blocked", val: logSummary.unauthorized_attempts, color: "#FF5566" }
                ].map((s, i) => (
                  <div key={i} className="p-3 sm:p-4 text-center border-r border-white/5 last:border-0">
                    <p className="text-[14px] sm:text-[18px] font-black" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-[8px] sm:text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-black/20">
               {logsLoading ? (
                 <div className="flex flex-col items-center justify-center py-20 gap-3"><Spinner size={24} /><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Fetching Audit Trail...</p></div>
               ) : (
                 <div className="space-y-1">
                    {securityLogs.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl hover:bg-white/[0.02] group transition-all">
                         <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                           l.event.includes('unauthorized') ? 'bg-red-500/10 text-red-400' :
                           l.event.includes('submission') ? 'bg-teal-500/10 text-teal-400' : 'bg-white/5 text-white/30'
                         }`}>
                            {l.event.includes('view') ? <Eye size={14} /> : l.event.includes('submission') ? <ExternalLink size={14} /> : <Shield size={14} />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4">
                               <p className="text-[12px] sm:text-[13px] font-bold text-white/80 capitalize">{l.event.replace(/_/g, ' ')}</p>
                               <p className="text-[9px] sm:text-[10px] font-medium text-white/20 flex-shrink-0">{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-white/30 truncate">{l.ip} · {l.respondent || l.viewer || l.attempted_by || 'Unknown'}</p>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            <div className="p-4 border-t border-white/5 flex justify-between items-center bg-black/40 pb-8 sm:pb-4">
               <span className="text-[9px] sm:text-[10px] font-bold text-white/20 uppercase tracking-widest">Encrypted & Permanent</span>
               <button onClick={fetchSecurityLogs} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all">Refresh Logs</button>
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-6 bg-black/80 backdrop-blur-[10px] animate-fade-in">
           <div className="bg-[#0C0C10] border border-white/10 rounded-t-[24px] sm:rounded-[20px] w-full sm:max-w-[480px] p-6 sm:p-8 shadow-2xl animate-slide-in-up sm:animate-scale-in">
              {isMobile && (
                <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.2)", margin: "0 auto 20px", flexShrink: 0 }} />
              )}
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                 <h2 className="text-lg sm:text-xl font-bold text-white">Admin Access</h2>
                 <button onClick={() => setShowAdminModal(false)} className="text-white/20 hover:text-white"><X size={24} /></button>
              </div>
              
              <div className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white/30">Grant Access</label>
                    <div className="flex gap-2">
                       <input 
                         type="text"
                         placeholder="0x... Sui address"
                         value={newAdminAddress}
                         onChange={(e) => {setNewAdminAddress(e.target.value); setAddressError(null);}}
                         className="flex-1 bg-[#1a1a2e] border border-white/[0.15] rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#7C5CFC] outline-none transition-all"
                       />
                       <button onClick={handleGrantAccess} disabled={isGranting} className="h-[42px] px-4 sm:px-6 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2">
                          {isGranting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                       </button>
                    </div>
                    {addressError && <p className="text-[10px] text-red-400 font-bold">{addressError}</p>}
                 </div>

                 <div className="space-y-4 pb-4">
                    <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white/30">Existing Admins</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                       {admins.map(a => (
                         <div key={a.address} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] group">
                            <div className="min-w-0">
                               <p className="text-[11px] sm:text-xs font-mono text-white/60 truncate">{a.address}</p>
                               <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-[#7C5CFC]">{a.role}</span>
                            </div>
                            {a.role !== 'creator' && (
                              <button onClick={() => handleRevokeAccess(a.address)} className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"><ShieldAlert size={14} /></button>
                            )}
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {newSubmission && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1000,
          background: "#0C0C10",
          border: "0.5px solid rgba(0,212,170,0.3)",
          borderLeft: "3px solid #00D4AA",
          borderRadius: "12px",
          padding: "14px 18px",
          maxWidth: "320px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          animation: "slideInRight 0.3s ease both",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
          }}>
            <span style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              🎉 New submission!
            </span>
            <button
              type="button"
              onClick={clearNotifications}
              style={{
                background: "none",
                border: "none",
                color: "rgba(240,240,245,0.4)",
                cursor: "pointer",
                fontSize: "16px",
                padding: "0",
                lineHeight: 1,
              }}
            >×</button>
          </div>
          <p style={{
            fontSize: "12px",
            color: "rgba(240,240,245,0.6)",
            margin: "0 0 10px",
          }}>
            From: {
              newSubmission.respondent === "anonymous"
                ? "Anonymous"
                : (newSubmission.respondent || "")
                    .slice(0,8) + "..."
            }
          </p>
          <button
            type="button"
            onClick={() => {
              viewSubmission(newSubmission as Submission)
              clearNotifications()
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "0.5px solid rgba(0,212,170,0.3)",
              background: "rgba(0,212,170,0.08)",
              color: "#00D4AA",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              width: "100%",
            }}
          >
            View submission →
          </button>
        </div>
      )}
    </div>
  );
}
