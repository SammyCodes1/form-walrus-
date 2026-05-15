"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FormField } from "@form-walrus/client";
import { 
  useSuiClient, 
  useCurrentAccount, 
  useSignAndExecuteTransaction,
  ConnectButton
} from "@mysten/dapp-kit";
import { SealClient, getAllowlistedKeyServers } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { toHex } from "@mysten/bcs";
import { ToastType } from "@/components/Toast";
import { 
  Check, 
  AlertCircle, 
  Copy, 
  Lock as LockIcon
} from "lucide-react";
import Link from "next/link";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0x21e7032ae20cbb5cdbd9f44994d7a1a983e5d48318e9b89dbc195595e548c823";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

// Circular Progress Component
function UploadProgress({ progress }: { progress: number }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ position: "relative", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx="16" cy="16" r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
          fill="transparent"
        />
        <circle
          cx="16" cy="16" r={radius}
          stroke="#ef4444"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.1s linear" }}
          strokeLinecap="round"
        />
      </svg>
      <span style={{ position: "absolute", fontSize: "8px", fontWeight: 800, color: "white" }}>{Math.round(progress)}%</span>
    </div>
  );
}

export default function RespondentPage({ params }: { params: { form_id: string } }) {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const isMobile = useIsMobile();

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

  // Preserved State
  const [formSchema, setFormSchema] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Additional logic state
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submissionBlobId, setSubmissionBlobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [formLoaded, setFormLoaded] = useState(false);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const missingRequiredFields = useMemo(() => {
    return fields.filter(f => {
      if (!f.required) return false;
      const val = answers[f.id];
      if (f.type === "checkbox_group") return !val || (val as string[]).length === 0;
      if (f.type === "confirmation_checkbox") return !val;
      return !val || String(val).trim() === "";
    });
  }, [fields, answers]);

  const fetchFormWithRetry = useCallback(async (formId: string, attempt = 1) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_URL + "/forms/" + formId);
      if (res.status === 404) throw new Error("Form not found");
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      setFormSchema(data);
      setTitle(data.title || "Untitled Form");
      setFields(data.fields || []);
      setIsPrivate(data.is_private || false);
      setLoading(false);
      
      setTimeout(() => setFormLoaded(true), 3000);
      
    } catch (err: any) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000));
        return fetchFormWithRetry(formId, attempt + 1);
      } else {
        setLoading(false);
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    fetchFormWithRetry(params.form_id);
    return () => {
      Object.values(previews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [params.form_id, fetchFormWithRetry]);

  const handleSubmit = async () => {
    if (missingRequiredFields.length > 0) {
      showToast(`Please fill out required fields.`, "warning");
      return;
    }

    let localTxDigest = null;
    if (account) {
      try {
        const tx = new Transaction();
        tx.setGasBudget(10000000);
        const [coin] = tx.splitCoins(tx.gas, [0]);
        tx.transferObjects([coin], account.address);
        const result = await signAndExecute({ transaction: tx });
        localTxDigest = result.digest;
      } catch (e) {
        if ((e as Error).message.toLowerCase().includes("rejected")) {
          showToast("Transaction rejected.", "error");
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const fieldValues: Record<string, any> = {};
      fields.forEach((f, idx) => { 
        if (f.type !== "section_heading") {
          fieldValues[f.label || f.type || `f_${idx}`] = answers[f.id]; 
        }
      });

      let submissionPayload = {
        fields: fieldValues,
        respondent_address: account?.address || null,
        media_blob_ids: (answers.media_blob_ids as string[]) || [],
        tx_digest: localTxDigest || null,
      };

      const allowlistId = formSchema?.allowlist_id || formSchema?.seal_object_id;
      if (formSchema?.is_private && allowlistId) {
        try {
          // 1. Generate a unique ID for this submission
          const submissionId = toHex(crypto.getRandomValues(new Uint8Array(32)));

          // 2. Build the seal_approve transaction
          const tx = new Transaction();
          tx.moveCall({
            target: `${PACKAGE_ID}::seal_policy::seal_approve`,
            arguments: [
              tx.pure.address(params.form_id),
              tx.pure.address(account?.address || ""),
            ],
          });
          await tx.build({ client: suiClient });

          // 3. Encrypt submission data
          const dataToEncrypt = new TextEncoder().encode(
            JSON.stringify(answers)
          );
          const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
            threshold: 2,
            packageId: PACKAGE_ID,
            id: submissionId,
            data: dataToEncrypt,
          });

          // 4. Upload encrypted bytes to Walrus via API
          const base64 = btoa(String.fromCharCode(...encryptedBytes));
          
          const fetchUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000") + "/upload-media";
          const walrusRes = await fetch(fetchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: base64,
              mimeType: "application/octet-stream",
              fileName: "encrypted_submission.bin",
            }),
          });

          if (!walrusRes.ok) {
            const err = await walrusRes.json();
            throw new Error(err.error || "Walrus storage failed");
          }
          
          // Then submit via POST /forms/:form_id/submit with:
          // { fields: { encrypted: base64, submissionId }, respondent_address }
          submissionPayload = { 
            fields: { encrypted: base64, submissionId } as any, 
            respondent_address: account?.address || null, 
            media_blob_ids: (answers.media_blob_ids as string[]) || [], 
            tx_digest: localTxDigest || null, 
          } as any;

        } catch (e: any) {
          console.error("Seal setup failed:", e);
          const proceed = window.confirm("Security layer error: " + e.message + "\n\nSubmit without encryption?");
          if (!proceed) { setSubmitting(false); return; }
        }
      }

      const res = await fetch(`${API_URL}/forms/${params.form_id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submissionPayload) });
      if (!res.ok) throw new Error("Submission failed");
      const result = await res.json();
      setSubmissionBlobId(result.blob_id);
      setSubmitted(true);
    } catch (e: any) { showToast("Error: " + e.message, "error"); }
    finally { setSubmitting(false); }
  };

  const handleFileUpload = async (fId: string, file: File) => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [fId]: url }));
    }

    const toBase64 = (file: File) => new Promise<string>(
      (resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    );

    try {
      setUploadProgress(prev => ({ ...prev, [fId]: 0 }));
      
      const base64 = await toBase64(file);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const response = await fetch(API_URL + "/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: base64,
          mimeType: file.type,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await response.json();
      const blobId = data.blob_id;
      
      if (!blobId) throw new Error("No Blob ID returned");

      setUploadProgress(prev => ({ ...prev, [fId]: 100 }));

      const currentMedia = (answers.media_blob_ids as string[]) || [];
      setAnswers(v => ({ ...v, [fId]: file.name, [`${fId}_blobId`]: blobId, media_blob_ids: [...currentMedia, blobId] }));
    } catch (err: any) { 
      showToast("Upload failed: " + err.message, "error"); 
      setUploadProgress(prev => { const n = { ...prev }; delete n[fId]; return n; });
      if (previews[fId]) { URL.revokeObjectURL(previews[fId]); setPreviews(prev => { const n = { ...prev }; delete n[fId]; return n; }); }
    }
  };

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#050510", zIndex: 1000 }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
      <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" }} />
      <p style={{ marginTop: "16px", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Loading form...</p>
    </div>
  );

  if (error) return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#050510", zIndex: 1000 }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "48px", textAlign: "center", maxWidth: "400px", backdropFilter: "blur(24px)" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 8px", color: "white" }}>Form not found</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "24px" }}>{error}</p>
        <Link href="/" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>← Back to home</Link>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#050510", color: "white", minHeight: "100vh", position: "relative", overflowX: "hidden", fontFamily: "'Inter', sans-serif" }}>
      {/* Background System */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div className="drift1" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "600px", height: "600px", top: "-100px", left: "-200px", background: "radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)", filter: "blur(80px)" }} />
        <div className="drift2" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "500px", height: "500px", top: 200, right: "-150px", background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)", filter: "blur(80px)" }} />
        <div className="drift3" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "700px", height: "700px", bottom: "-200px", left: "30%", background: "radial-gradient(circle, rgba(6,182,212,0.25), transparent 70%)", filter: "blur(100px)" }} />
        <div className="drift1-reverse" style={{ position: "fixed", zIndex: 0, pointerEvents: "none", width: "400px", height: "400px", top: "50%", right: "20%", background: "radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes drift1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(60px,40px) scale(1.1); } } @keyframes drift2 { 0% { transform: translate(0,0) scale(1.1); } 100% { transform: translate(-40px,60px) scale(1); } } @keyframes drift3 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(30px,-50px) scale(1.15); } } @keyframes scaleIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } } .drift1 { animation: drift1 12s infinite alternate ease-in-out; } .drift2 { animation: drift2 15s infinite alternate ease-in-out; } .drift3 { animation: drift3 18s infinite alternate ease-in-out; } .drift1-reverse { animation: drift1 10s infinite alternate-reverse ease-in-out; } .scale-in { animation: scaleIn 0.4s ease-out; } .field-input:focus { border-color: rgba(99,102,241,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }` }} />

      <main style={{ minHeight: "100vh", padding: isMobile ? "0" : "80px 24px 60px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ 
          width: "100%", 
          maxWidth: isMobile ? "100%" : "620px", 
          background: "rgba(255,255,255,0.04)", 
          border: isMobile ? "none" : "1px solid rgba(255,255,255,0.1)", 
          borderRadius: isMobile ? "0" : "24px", 
          backdropFilter: "blur(24px)", 
          padding: isMobile ? "24px 20px 100px" : "48px", 
          marginBottom: isMobile ? "0" : "40px", 
          boxShadow: isMobile ? "none" : "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          minHeight: isMobile ? "100vh" : "auto"
        }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: isMobile ? "40px 0" : "20px 0" }}>
              <div className="scale-in" style={{ fontSize: "56px" }}>✅</div>
              <h2 style={{ fontSize: isMobile ? "22px" : "24px", fontWeight: 800, marginTop: "16px", marginBottom: "4px" }}>Response submitted!</h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "15px", marginBottom: "24px" }}>Stored permanently on Walrus</p>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "24px" }} />
              <div style={{ textAlign: "left", marginBottom: "32px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "8px" }}>Submission ID:</label>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", color: "#a78bfa", fontFamily: "monospace", wordBreak: "break-all", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ flex: 1 }}>{submissionBlobId}</span>
                  <button onClick={() => { navigator.clipboard.writeText(submissionBlobId || ""); showToast("ID copied to clipboard", "success"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", padding: "4px", borderRadius: "4px", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "white"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}><Copy size={14} /></button>
                </div>
              </div>
              <button onClick={() => setSubmitted(false)} style={{ color: "#818cf8", cursor: "pointer", fontSize: "14px", textDecoration: "underline", background: "none", border: "none", minHeight: "44px" }}>Submit another response</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "32px" }}>
                {formSchema?.cover_image_url && <img src={formSchema.cover_image_url} alt="Cover" style={{ width: "100%", height: isMobile ? "180px" : "200px", objectFit: "cover", borderRadius: "14px", marginBottom: "28px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }} />}
                <h1 style={{ fontSize: isMobile ? "22px" : "26px", fontWeight: 800, color: "white", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{title}</h1>
                {formSchema?.description && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: isMobile ? "14px" : "15px", lineHeight: 1.6, margin: "0 0 28px" }}>{formSchema.description}</p>}
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {formSchema?.is_private && !account ? (
                  <div style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    background: "rgba(124,92,252,0.05)",
                    border: "1px dashed rgba(124,92,252,0.3)",
                    borderRadius: "16px",
                    margin: "20px 0"
                  }}>
                    <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔒</div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Connect wallet to submit this private form</h3>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "24px" }}>
                      This form uses Seal encryption to protect your privacy. A wallet connection is required to authorize the encryption.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <ConnectButton />
                    </div>
                  </div>
                ) : (
                  <>
                    {fields.map((f, i) => (
                      <div key={f.id} style={{ marginBottom: "28px" }}>
                        {f.type === "section_heading" ? (
                          <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#7C5CFC", borderBottom: "1px solid rgba(124,92,252,0.1)", paddingBottom: "8px" }}>{f.label}</h3>
                        ) : (
                          <>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: "10px" }}>
                              {f.label} {f.required && <span style={{ color: "#f87171", marginLeft: "4px" }}>*</span>}
                            </label>

                            {(f.type === "short_text" || f.type === "text") && <input className="field-input" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px 16px", color: "white", fontSize: "16px", outline: "none", boxSizing: "border-box", transition: "all 0.2s", minHeight: "48px" }} placeholder={f.placeholder || "Your answer..."} value={answers[f.id] as string || ""} onChange={e => setAnswers({...answers, [f.id]: e.target.value})} />}
                            {f.type === "long_text" && <textarea className="field-input" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px 16px", color: "white", fontSize: "16px", outline: "none", boxSizing: "border-box", transition: "all 0.2s", minHeight: "120px", resize: "vertical" }} placeholder={f.placeholder || "Enter detailed response..."} value={answers[f.id] as string || ""} onChange={e => setAnswers({...answers, [f.id]: e.target.value})} />}
                            {f.type === "dropdown" && <div style={{ position: "relative" }}><select style={{ width: "100%", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px 16px", color: "white", fontSize: "16px", outline: "none", appearance: "none", cursor: "pointer", boxSizing: "border-box", minHeight: "48px" }} value={answers[f.id] as string || ""} onChange={e => setAnswers({...answers, [f.id]: e.target.value})}><option value="" disabled>Select option...</option>{(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}</select><div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.2)" }}>▾</div></div>}
                            {(f.type === "checkbox" || f.type === "checkbox_group") && <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{(f.options || []).map(o => { const curr = (answers[f.id] as string[]) || []; const checked = curr.includes(o); return <div key={o} onClick={() => { const next = checked ? curr.filter(c => c !== o) : [...curr, o]; setAnswers({...answers, [f.id]: next}); }} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "10px", cursor: "pointer", background: checked ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid", borderColor: checked ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)", transition: "all 0.2s", minHeight: "48px" }}><div style={{ width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0, background: checked ? "#6366f1" : "transparent", border: checked ? "2px solid #6366f1" : "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>{checked && <Check size={14} strokeWidth={4} />}</div><span style={{ fontSize: "15px", color: checked ? "white" : "rgba(255,255,255,0.6)" }}>{o}</span></div>; })}</div>}
                            {f.type === "star_rating" && <div style={{ display: "flex", gap: isMobile ? "12px" : "8px", justifyContent: isMobile ? "center" : "flex-start" }}>{[1, 2, 3, 4, 5].map(s => { const active = (answers[f.id] as number || 0) >= s; return <div key={s} onClick={() => setAnswers({...answers, [f.id]: s})} style={{ fontSize: isMobile ? "40px" : "32px", cursor: "pointer", transition: "all 0.15s", color: active ? "#f59e0b" : "rgba(255,255,255,0.15)", textShadow: active ? "0 0 12px rgba(245,158,11,0.6)" : "none", transform: active ? "scale(1.1)" : "scale(1)", minHeight: "44px", minWidth: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>★</div>; })}</div>}

                            {f.type === "file_upload" && (
                              <div 
                                style={{
                                  border: "2px dashed rgba(255,255,255,0.12)", borderRadius: "12px", padding: isMobile ? "40px 20px" : "32px", textAlign: "center",
                                  cursor: "pointer", background: "rgba(255,255,255,0.02)", transition: "all 0.2s", position: "relative",
                                  overflow: "hidden", minHeight: isMobile ? "140px" : "auto"
                                }}
                                onClick={() => document.getElementById(`file-${f.id}`)?.click()}
                              >
                                {uploadProgress[f.id] !== undefined && uploadProgress[f.id] < 100 ? (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                                    <UploadProgress progress={uploadProgress[f.id]} />
                                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Uploading...</div>
                                  </div>
                                ) : previews[f.id] ? (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <img src={previews[f.id]} alt="Preview" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", borderRadius: "8px", marginBottom: "12px" }} />
                                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600 }}>{answers[f.id] as string}</div>
                                    <div style={{ marginTop: "8px", fontSize: "10px", color: "#00D4AA", fontWeight: 800 }}>✓ Ready</div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📎</div>
                                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "4px" }}>
                                      {answers[f.id] ? (answers[f.id] as string) : (isMobile ? "Tap to upload" : "Click or drop to upload")}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>Max 10MB</div>
                                  </>
                                )}
                                <input 
                                  type="file" id={`file-${f.id}`} className="hidden" 
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(f.id, file);
                                  }}
                                />
                              </div>
                            )}

                            {f.type === "url" && <div style={{ position: "relative" }}><div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.2)" }}>🔗</div><input type="url" className="field-input" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px 16px 14px 44px", color: "white", fontSize: "16px", outline: "none", boxSizing: "border-box", minHeight: "48px" }} placeholder="https://..." value={answers[f.id] as string || ""} onChange={e => setAnswers({...answers, [f.id]: e.target.value})} /></div>}
                            {f.type === "confirmation_checkbox" && <div onClick={() => setAnswers({...answers, [f.id]: !answers[f.id]})} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "10px", cursor: "pointer", background: answers[f.id] ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid", borderColor: answers[f.id] ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)", transition: "all 0.2s", minHeight: "48px" }}><div style={{ width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0, background: answers[f.id] ? "#6366f1" : "transparent", border: answers[f.id] ? "2px solid #6366f1" : "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>{answers[f.id] && <Check size={14} strokeWidth={4} />}</div><span style={{ fontSize: "15px", color: answers[f.id] ? "white" : "rgba(255,255,255,0.6)" }}>{f.label}</span></div>}
                          </>
                        )}
                      </div>
                    ))}

                    <div style={{ 
                      position: isMobile ? "fixed" : "static", 
                      bottom: isMobile ? 0 : "auto", 
                      left: isMobile ? 0 : "auto", 
                      right: isMobile ? 0 : "auto",
                      padding: isMobile ? "16px" : "0",
                      background: isMobile ? "rgba(12,12,16,0.95)" : "transparent",
                      backdropFilter: isMobile ? "blur(20px)" : "none",
                      borderTop: isMobile ? "1px solid rgba(255,255,255,0.1)" : "none",
                      zIndex: 100
                    }}>
                      <button onClick={handleSubmit} disabled={submitting || missingRequiredFields.length > 0} style={{ width: "100%", height: "54px", marginTop: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "14px", color: "white", fontSize: "16px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", boxShadow: "0 0 40px rgba(99,102,241,0.35)", transition: "all 0.2s", opacity: submitting ? 0.6 : 1 }} onMouseEnter={e => { if (!submitting) { e.currentTarget.style.boxShadow = "0 0 60px rgba(99,102,241,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; } }} onMouseLeave={e => { if (!submitting) { e.currentTarget.style.boxShadow = "0 0 40px rgba(99,102,241,0.35)"; e.currentTarget.style.transform = "translateY(0)"; } }}>{submitting ? "Submitting..." : "Submit Response"}</button>
                    </div>
                  </>
                )}
              </div>

              <footer style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>Powered by 🦭 FormWalrus · Stored permanently on Walrus</footer>
            </>
          )}
        </div>
      </main>

      {/* Floating Info Banner for Private Forms */}
      {isPrivate && formLoaded && !submitted && (
        <div style={{ position: "fixed", bottom: "24px", left: "24px", zIndex: 100 }}>
          {formSchema?.allowlist_id ? <div style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", color: "#00D4AA", fontSize: "12px", fontWeight: 600 }}><LockIcon size={14} /> Encrypted with Seal</div> : <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", color: "#F59E0B", fontSize: "12px", fontWeight: 600 }}><AlertCircle size={14} /> Encryption not configured</div>}
        </div>
      )}

      {toast && <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, padding: "12px 18px", borderRadius: "10px", background: "rgba(15,15,35,0.95)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: "13px", fontWeight: 500, backdropFilter: "blur(20px)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>{toast.message}</div>}
    </div>
  );
}
