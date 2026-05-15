"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { FormField, FieldType, FormWalrusSuiClient, FormStyling, WalrusClient } from "@form-walrus/client";
import { 
  ConnectButton, 
  useCurrentAccount, 
  useSignAndExecuteTransaction,
  useSuiClient,
  useSignPersonalMessage
} from "@mysten/dapp-kit";
import { Transaction as SuiTransaction } from "@mysten/sui/transactions";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { CSS } from "@dnd-kit/utilities";
import { Toast, ToastType } from "@/components/Toast";
import { 
  Plus, 
  Lock as LockIcon, 
  ChevronRight, 
  Layout, 
  Check, 
  ExternalLink, 
  X, 
  Clock, 
  Search, 
  ChevronLeft, 
  Eye, 
  Zap,
  Star,
  Play,
  Upload,
  Lock,
  Target,
  Camera,
  ImageIcon,
  Loader2,
  Menu,
  Type,
  AlignLeft,
  List,
  CheckSquare,
  Paperclip,
  Link as LinkIcon,
  Trash2,
  GripVertical,
  BarChart3,
  Users,
  ShieldAlert,
  Calendar,
  Shield,
  Download,
  UserPlus,
  Copy,
  Globe,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { decryptSubmission, createSessionKey } from "@/lib/seal";
import { buildAddToAllowlistTx, buildRemoveFromAllowlistTx } from "@/lib/seal-allowlist";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const FORM_REGISTRY_ID = process.env.NEXT_PUBLIC_FORM_REGISTRY_ID || "";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

// --- Types & Constants ---
interface Submission {
  submitted_at: string;
  blob_id: string;
  respondent: string;
  fields?: Record<string, unknown>;
  tx_digest?: string;
  [key: string]: unknown;
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
  is_private: boolean;
  expiry_date: string | null;
  response_limit: number | null;
  title?: string;
  allowlist_id?: string;
}

interface Template {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  is_private?: boolean;
  fields: { type: FieldType; label: string; required?: boolean; options?: string[] }[];
}

const TEMPLATES: Template[] = [
  {
    id: "bug-report",
    title: "Bug Report",
    description: "Let users report issues with your product",
    icon: "🐛",
    color: "#FF4444",
    fields: [
      { type: "short_text", label: "What's the bug?", required: true },
      { type: "long_text", label: "Steps to reproduce", required: true },
      { type: "dropdown", label: "Severity", required: true, options: ["Critical", "High", "Medium", "Low"] },
      { type: "file_upload", label: "Screenshot (optional)" },
      { type: "url_input", label: "Page URL where bug occurred" },
      { type: "short_text", label: "Browser / Device" },
      { type: "confirmation_checkbox", label: "I confirm this is a new bug and not a duplicate" }
    ]
  },
  {
    id: "feature-request",
    title: "Feature Request",
    description: "Collect product ideas from your users",
    icon: "💡",
    color: "#7C5CFC",
    fields: [
      { type: "short_text", label: "Feature title", required: true },
      { type: "long_text", label: "Describe the feature", required: true },
      { type: "long_text", label: "What problem does it solve?", required: true },
      { type: "star_rating", label: "How important is this to you?", required: true },
      { type: "dropdown", label: "Category", options: ["UI/UX", "Performance", "Integrations", "API", "Other"] },
      { type: "short_text", label: "Your role / use case" },
      { type: "confirmation_checkbox", label: "I confirm this is a new bug and not a duplicate" }
    ]
  },
  {
    id: "user-survey",
    title: "User Survey",
    description: "Understand your users with structured questions",
    icon: "📊",
    color: "#00D4AA",
    fields: [
      { type: "section_heading", label: "About You" },
      { type: "dropdown", label: "How long have you been using our product?", options: ["Less than a month", "1-6 months", "6-12 months", "Over a year"] },
      { type: "dropdown", label: "How did you hear about us?", options: ["Twitter/X", "GitHub", "Word of mouth", "Search engine", "Other"] },
      { type: "section_heading", label: "Your Experience" },
      { type: "star_rating", label: "Overall satisfaction", required: true },
      { type: "star_rating", label: "Ease of use", required: true },
      { type: "star_rating", label: "Would you recommend us?" },
      { type: "long_text", label: "What do you like most?" },
      { type: "long_text", label: "What could be improved?" },
      { type: "confirmation_checkbox", label: "I agree to participate in follow-up research" }
    ]
  },
  {
    id: "job-application",
    title: "Job Application",
    description: "Collect applications for open positions",
    icon: "💼",
    color: "#F59E0B",
    is_private: true,
    fields: [
      { type: "short_text", label: "Full name", required: true },
      { type: "short_text", label: "Email address", required: true },
      { type: "url_input", label: "LinkedIn profile", required: true },
      { type: "url_input", label: "Portfolio / GitHub" },
      { type: "dropdown", label: "Position applying for", options: ["Frontend Engineer", "Backend Engineer", "Full Stack", "Designer", "DevRel", "Other"] },
      { type: "long_text", label: "Why do you want to join?", required: true },
      { type: "long_text", label: "Relevant experience", required: true },
      { type: "file_upload", label: "Resume / CV", required: true },
      { type: "video_upload", label: "30-second intro video (optional)" },
      { type: "confirmation_checkbox", label: "I confirm all information is accurate", required: true }
    ]
  }
];

const FIELD_TYPES = [
  { type: "short_text", label: "Short Text", icon: <Type size={16} />, color: "#60A5FA" },
  { type: "long_text", label: "Long Text", icon: <AlignLeft size={16} />, color: "#7C5CFC" },
  { type: "dropdown", label: "Dropdown", icon: <List size={16} />, color: "#00D4AA" },
  { type: "checkbox_group", label: "Checkbox", icon: <CheckSquare size={16} />, color: "#34D399" },
  { type: "star_rating", label: "Rating", icon: <Star size={16} />, color: "#F59E0B" },
  { type: "file_upload", label: "Upload", icon: <Paperclip size={16} />, color: "#F472B6" },
  { type: "url_input", label: "URL", icon: <LinkIcon size={16} />, color: "#3B82F6" },
  { type: "confirmation_checkbox", label: "Confirmation", icon: <Check size={16} />, color: "#34D399" }
];

// --- Sub-Components ---

function UploadProgress({ progress }: { progress: number }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ position: "relative", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="16" cy="16" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="transparent" />
        <circle cx="16" cy="16" r={radius} stroke="#ef4444" strokeWidth="3" fill="transparent" strokeDasharray={circumference} style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.1s linear" }} strokeLinecap="round" />
      </svg>
      <span style={{ position: "absolute", fontSize: "8px", fontWeight: 800, color: "white" }}>{Math.round(progress)}%</span>
    </div>
  );
}

function DraggableField({ field, onDelete, onUpdate }: { 
  field: FormField; 
  onDelete: (id: string) => void; 
  onUpdate: (id: string, updates: Partial<FormField>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const [isHovered, setIsHovered] = useState(false);
  const { isMobile } = useBreakpoint();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    position: "relative" as "relative",
    background: "rgba(255,255,255,0.04)", border: "1px solid",
    borderColor: isHovered || isMobile ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.08)",
    borderRadius: "14px", padding: isMobile ? "16px" : "20px 24px", display: "flex", alignItems: "flex-start", gap: isMobile ? "12px" : "16px",
    marginBottom: "12px", backdropFilter: "blur(10px)"
  };

  return (
    <div ref={setNodeRef} style={style} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div {...attributes} {...listeners} style={{ color: "rgba(255,255,255,0.2)", cursor: "grab", marginTop: "4px", padding: isMobile ? "8px" : "0" }}>
        <GripVertical size={isMobile ? 20 : 18} />
      </div>
      <div style={{ flex: 1 }}>
        <input value={field.label} onChange={(e) => onUpdate(field.id, { label: e.target.value })} style={{ background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "white", fontWeight: 600, fontSize: "15px", width: "100%", padding: "4px 0", marginBottom: "12px", outline: "none" }} placeholder="Field Label" />
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 14px", color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>
          {field.type === "star_rating" ? (
            <div style={{ display: "flex", gap: "4px", color: "#F59E0B" }}>
              <Star size={16} fill="#F59E0B" /><Star size={16} fill="#F59E0B" /><Star size={16} fill="#F59E0B" /><Star size={16} fill="#F59E0B" /><Star size={16} />
            </div>
          ) : field.type === "dropdown" ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Select option...</span><span>▾</span></div>
          ) : (
            <span>{field.type.replace('_', ' ')} placeholder...</span>
          )}
        </div>
        {field.type === "dropdown" && field.options && (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {field.options.map((opt, oIdx) => (
              <div key={oIdx} style={{ display: "flex", gap: "8px" }}>
                <input value={opt} onChange={(e) => { const next = [...(field.options || [])]; next[oIdx] = e.target.value; onUpdate(field.id, { options: next }); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: "white", flex: 1, outline: "none" }} />
                <button onClick={() => onUpdate(field.id, { options: (field.options || []).filter((_, idx) => idx !== oIdx) })} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", minHeight: "32px", minWidth: "32px" }}><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => onUpdate(field.id, { options: [...(field.options || []), `Option ${(field.options || []).length + 1}`] })} style={{ alignSelf: "flex-start", fontSize: "11px", fontWeight: 700, color: "#7C5CFC", background: "none", border: "none", cursor: "pointer", marginTop: "4px", padding: "8px 0" }}>+ Add Option</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", paddingTop: "4px" }}>
        <div onClick={() => onUpdate(field.id, { required: !field.required })} title={field.required ? "Required field" : "Make required"} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "4px" }}>
          <div style={{ width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0, background: field.required ? "#ef4444" : "transparent", border: field.required ? "2px solid #ef4444" : "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", transition: "all 0.2s" }}>
            {field.required && <Check size={10} strokeWidth={4} />}
          </div>
          <span style={{ fontSize: "16px", fontWeight: 900, color: field.required ? "#ef4444" : "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>*</span>
        </div>
        <button onClick={() => onDelete(field.id)} style={{ background: "none", border: "none", color: "rgba(239,68,68,0.5)", cursor: "pointer", transition: "color 0.2s", padding: "8px" }}><Trash2 size={18} /></button>
      </div>
    </div>
  );
}

// --- Main Builder Page Component ---

export default function BuilderPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  
  const [activeTab, setActiveTab] = useState<"build" | "analyze">("build");
  const [builderTab, setBuilderTab] = useState<"fields" | "canvas" | "settings">("canvas");
  const [fields, setFields] = useState<FormField[]>([]);
  const [title, setTitle] = useState("Untitled Form");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [responseLimit, setResponseLimit] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState("");
  const [showPicker, setShowPicker] = useState(true);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [publishedFormId, setPublishedFormId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Dashboard Data State
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Cover Image State
  const [coverImageBlobId, setCoverImageBlobId] = useState("");
  const [coverImagePreview, setCoverImagePreview] = useState("");
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Custom Field State
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [customField, setCustomField] = useState({
    label: "",
    type: "short_text" as FieldType | string,
    placeholder: "",
    helpText: "",
    required: false,
    options: ["Option 1", "Option 2"],
    maxRating: 5,
    maxLength: 500,
    acceptedFileTypes: "image/*,application/pdf",
    maxFileSizeMB: 10,
    defaultValue: "",
    validationPattern: "",
    validationMessage: "",
  });
  const [newOption, setNewOption] = useState("");

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCoverImageUpload = async (file: File) => {
    if (!file) return;

    // Validate type
    const allowed = [
      "image/jpeg", "image/png",
      "image/gif", "image/webp", "image/svg+xml"
    ];
    if (!allowed.includes(file.type)) {
      alert("Please upload a JPEG, PNG, GIF, WebP or SVG");
      return;
    }

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    setCoverImageUploading(true);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Send to API which uploads via server-side daemon
      const API_URL = 
        process.env.NEXT_PUBLIC_API_URL || 
        "http://localhost:4000";

      const response = await fetch(
        API_URL + "/upload-media",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            data: base64, // Fix 1: Ensure it's 'data'
            mimeType: file.type,
            fileName: file.name,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        console.log("Upload failed response:", err); // Fix 7: Log full response
        throw new Error(err.error || "Upload failed");
      }

      const data = await response.json();

      // Fix 3: Handle blob_id format
      const blobId = typeof data.blob_id === 'object' 
        ? data.blob_id.blobId 
        : data.blob_id;

      if (!blobId) {
        throw new Error("No blob ID returned from server");
      }

      // Fix 2: Exact sequence
      setCoverImageBlobId(blobId);
      setCoverImagePreview(base64);  // show local preview immediately
      console.log("Cover image uploaded via API:", blobId);

    } catch (e: any) {
      console.error("Cover image upload failed:", e);
      setCoverImagePreview("");
      setCoverImageBlobId(""); // Fix 6: ensure both cleared on error
      alert(
        "Image upload failed: " + e.message +
        "\n\nMake sure the API server is running on port 4000."
      );
    } finally {
      setCoverImageUploading(false);
    }
  };

  const [styling, setStyling] = useState<FormStyling>({
    primaryColor: "#7C5CFC",
    backgroundColor: "#050507",
    fontFamily: "sans",
    borderRadius: "medium"
  });

  const formWalrusSui = useMemo(() => new FormWalrusSuiClient(suiClient, PACKAGE_ID, FORM_REGISTRY_ID), [suiClient]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const addField = (type: FieldType | any) => {
    // If we passed a full field object
    if (typeof type === "object" && type.id) {
      setFields([...fields, type]);
      return;
    }
    // Otherwise standard type
    setFields([...fields, { id: `f_${Date.now()}`, type, label: `New ${type.replace("_", " ")}`, required: false }]);
  };
  
  const loadTemplate = (template: Template | null) => {
    if (template) {
      setTitle(template.title); setDescription(template.description); setIsPrivate(!!template.is_private);
      setFields(template.fields.map((f, i) => ({ id: `f_${Date.now()}_${i}`, type: f.type, label: f.label, required: !!f.required, options: f.options })));
    } else {
      setTitle("Untitled Form"); setDescription(""); setIsPrivate(false); setFields([]);
    }
    setShowPicker(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const updateField = (id: string, updates: Partial<FormField>) => setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  const deleteField = (id: string) => setFields(fields.filter(f => f.id !== id));

  const publish = async (e: any) => {
    if (!account) { showToast("Connect wallet first", "warning"); return; }
    setIsPublishing(true); setPublishStep("Syncing schema...");
    try {
      const res = await fetch(`${API_URL}/forms`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          description, 
          fields, 
          is_private: isPrivate, 
          creator_address: account.address, 
          styling, 
          cover_image_blob_id: coverImageBlobId || "", // Fix 4: include blob ID string
          expiry_date: expiryDate || null,
          response_limit: responseLimit ? parseInt(responseLimit) : null,
        })
      });
      if (!res.ok) throw new Error("Schema upload failed");
      const { form_id } = await res.json();
      setPublishStep("Sui registration...");
      const tx = new SuiTransaction();
      await formWalrusSui.createForm(tx, title, form_id, isPrivate);
      await signAndExecute({ transaction: tx });
      if (isPrivate) {
        setPublishStep("Configuring Seal...");
        const allowlistId = "allowlist_" + form_id.slice(0, 20) + "_" + account.address.slice(2, 10);
        await fetch(`${API_URL}/forms/${form_id}/allowlist`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowlist_id: allowlistId, caller_address: account.address }),
        });
      }
      setPublishedFormId(form_id); setPublishedUrl(`${window.location.origin}/f/${form_id}`);
      setShowSuccessModal(true);
      showToast("Form live!", "success");
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setIsPublishing(false); setPublishStep(""); }
  };

  const fetchDashboard = useCallback(async () => {
    if (!publishedFormId || !account) return;
    setLoadingDashboard(true);
    try {
      const [subRes, anaRes] = await Promise.all([
        fetch(`${API_URL}/forms/${publishedFormId}/submissions?caller_address=${account.address}`),
        fetch(`${API_URL}/forms/${publishedFormId}/analytics?caller_address=${account.address}`)
      ]);
      const subData = await subRes.json(); const anaData = await anaRes.json();
      setSubmissions(subData.entries || []); setAnalytics(anaData);
    } catch (e) { console.error(e); }
    finally { setLoadingDashboard(false); }
  }, [publishedFormId, account]);

  useEffect(() => { if (activeTab === "analyze") fetchDashboard(); }, [activeTab, fetchDashboard]);

  return (
    <div style={{ backgroundColor: "#050510", color: "white", minHeight: "100vh", position: "relative", overflowX: "hidden", fontFamily: "'Inter', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(60px,40px) scale(1.1); } }
        @keyframes drift2 { 0% { transform: translate(0,0) scale(1.1); } 100% { transform: translate(-40px,60px) scale(1); } }
        @keyframes drift3 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(30px,-50px) scale(1.15); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes spinSlow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .drift1 { animation: drift1 12s infinite alternate ease-in-out; } .drift2 { animation: drift2 15s infinite alternate ease-in-out; } .drift3 { animation: drift3 18s infinite alternate ease-in-out; } .drift1-reverse { animation: drift1 10s infinite alternate-reverse ease-in-out; }
        .cover-image-overlay:hover .cover-action-btn { opacity: 1 !important; transform: translateY(0) !important; }
      `}} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div className="drift1" style={{ position: "fixed", zIndex: 0, width: "600px", height: "600px", top: "-100px", left: "-200px", background: "radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)", filter: "blur(80px)" }} />
        <div className="drift2" style={{ position: "fixed", zIndex: 0, width: "500px", height: "500px", top: 200, right: "-150px", background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "fixed", inset: 0, zIndex: 1, backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, height: "56px", zIndex: 200, background: "rgba(5,5,16,0.85)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: isMobile ? "0 10px" : "0 16px", gap: isMobile ? "8px" : "12px" }}>
        <Link href="/" style={{ textDecoration: "none", color: "white", display: "flex", alignItems: "center", gap: "6px" }}><span>🦭</span>{!isMobile && <span style={{ fontWeight: 800, fontSize: "16px" }}>FormWalrus</span>}</Link>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: isMobile ? "4px" : "8px" }}>
           <button onClick={() => setActiveTab("build")} style={{ background: activeTab === "build" ? "rgba(255,255,255,0.1)" : "transparent", border: "none", color: "white", padding: isMobile ? "6px 10px" : "6px 16px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
             {isMobile ? <Zap size={16} /> : "Build"}
             {isMobile && activeTab === "build" && <span style={{ fontSize: "11px" }}>Build</span>}
           </button>
           <button onClick={() => setActiveTab("analyze")} style={{ background: activeTab === "analyze" ? "rgba(255,255,255,0.1)" : "transparent", border: "none", color: "white", padding: isMobile ? "6px 10px" : "6px 16px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
             {isMobile ? <BarChart3 size={16} /> : "Analyze"}
             {isMobile && activeTab === "analyze" && <span style={{ fontSize: "11px" }}>Analyze</span>}
           </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "12px" }}>
          {!isMobile && (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "0.5px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(240,240,245,0.7)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(124,92,252,0.12)";
                e.currentTarget.style.borderColor = "rgba(124,92,252,0.3)";
                e.currentTarget.style.color = "#A78BFA";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "rgba(240,240,245,0.7)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              title="Go to your dashboard"
            >
              ◈ Dashboard
            </button>
          )}
          {isMobile && (
            <button onClick={() => router.push("/dashboard")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}><Layout size={18} /></button>
          )}
          <ConnectButton />
          {!isMobile && <button onClick={() => setShowPreview(!showPreview)} style={{ background: showPreview ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid", borderColor: showPreview ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)", color: showPreview ? "#818cf8" : "white", padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>{showPreview ? "← Close Preview" : "Preview →"}</button>}
          <button onClick={publish} disabled={isPublishing} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", padding: isMobile ? "6px 12px" : "6px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, opacity: isPublishing ? 0.5 : 1 }}>{isPublishing ? (isMobile ? "..." : "Publishing...") : (isMobile ? "Publish" : "Publish Form")}</button>
        </div>
      </nav>
      <div style={{ display: "flex", height: isMobile ? "calc(100vh - 112px)" : "calc(100vh - 56px)", marginTop: "56px", position: "relative", zIndex: 1, paddingBottom: isMobile ? "56px" : "0" }}>
        {activeTab === "build" ? (
          <>
            {(!isMobile || builderTab === "fields") && (
              <aside style={{ width: isMobile ? "100%" : "220px", background: "rgba(255,255,255,0.02)", borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)", padding: "16px", overflowY: "auto" }}>
                 <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "2px" }}>Add Fields</div>
                 <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {FIELD_TYPES.map(ft => <button key={ft.type} onClick={() => { addField(ft.type as FieldType); if (isMobile) setBuilderTab("canvas"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: "13px", cursor: "pointer", textAlign: "left", minHeight: "48px" }}><span style={{ color: ft.color }}>{ft.icon}</span><span>{ft.label}</span></button>)}
                    
                    {/* Custom Field Button */}
                    <button
                      type="button"
                      onClick={() => setShowCustomFieldModal(true)}
                      style={{
                        width: "100%",
                        padding: "14px 12px",
                        borderRadius: "10px",
                        border: "1.5px dashed rgba(124,92,252,0.4)",
                        background: "rgba(124,92,252,0.06)",
                        color: "#A78BFA",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        fontFamily: "inherit",
                        marginTop: "8px",
                        transition: "all 0.2s ease",
                        minHeight: "64px"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(124,92,252,0.12)";
                        e.currentTarget.style.borderColor = "rgba(124,92,252,0.7)";
                        e.currentTarget.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(124,92,252,0.06)";
                        e.currentTarget.style.borderColor = "rgba(124,92,252,0.4)";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <div style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "rgba(124,92,252,0.15)",
                        border: "1px solid rgba(124,92,252,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        color: "#A78BFA",
                        fontWeight: 300,
                      }}>+</div>
                      <span style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.02em" }}>Custom Field</span>
                    </button>
                 </div>
              </aside>
            )}
            {(!isMobile || builderTab === "canvas") && (
              <main style={{ flex: 1, padding: isMobile ? "20px 16px" : "32px", overflowY: "auto", background: "rgba(255,255,255,0.01)" }}>
                 <div style={{ maxWidth: "700px", margin: "0 auto" }}>
                    {fields.length === 0 ? (
                      <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "16px", textAlign: "center" }}><div><div style={{ fontSize: "32px", marginBottom: "8px" }}>✦</div><div style={{ color: "rgba(255,255,255,0.3)" }}>Add fields from the {isMobile ? "tab below" : "sidebar"}</div></div></div>
                    ) : (
                      <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}><SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>{fields.map(f => <DraggableField key={f.id} field={f} onUpdate={updateField} onDelete={deleteField} />)}</SortableContext></DndContext>
                    )}
                 </div>
              </main>
            )}
            {(!isMobile || builderTab === "settings") && (
              <aside style={{ width: isMobile ? "100%" : "280px", background: "rgba(255,255,255,0.02)", borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)", padding: "20px", overflowY: "auto" }}>
                 <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>Form Title</div>
                 <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "white", fontSize: "16px", marginBottom: "20px" }} />
                 <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>Description</div>
                 <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "white", fontSize: "16px", resize: "none" }} />
                 <div style={{ marginTop: "24px" }}>
                  <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 700, display: "block", marginBottom: "10px" }}>COVER IMAGE</label>
                  {coverImagePreview && !coverImageUploading ? (
                    <div style={{ position: "relative", width: "100%", height: "140px", borderRadius: "10px", overflow: "hidden" }}>
                       <img src={coverImagePreview} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} />
                       <div className="cover-image-overlay" style={{ position: "absolute", inset: 0, background: "rgba(5,5,7,0)", borderRadius: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", transition: "background 0.2s ease", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(5,5,7,0.65)"; const btns = e.currentTarget.querySelectorAll(".cover-action-btn"); btns.forEach((b: any) => { b.style.opacity = "1"; b.style.transform = "translateY(0)"; }); }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(5,5,7,0)"; const btns = e.currentTarget.querySelectorAll(".cover-action-btn"); btns.forEach((b: any) => { b.style.opacity = "0"; b.style.transform = "translateY(6px)"; }); }}>
                          <label className="cover-action-btn" style={{ padding: "8px 18px", borderRadius: "8px", background: "rgba(124,92,252,0.9)", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: 0, transform: "translateY(6px)", transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)", userSelect: "none", whiteSpace: "nowrap", border: "none" }}>
                             🔄 Change Image
                             <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" style={{ display: "none" }} onChange={async (e) => { const file = e.target.files?.[0]; if (file) { setCoverImagePreview(""); setCoverImageBlobId(""); await new Promise(r => setTimeout(r, 100)); await handleCoverImageUpload(file); } e.target.value = ""; }} />
                          </label>
                          <button type="button" className="cover-action-btn" onClick={() => { setCoverImagePreview(""); setCoverImageBlobId(""); }} style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(255,85,102,0.15)", border: "0.5px solid rgba(255,85,102,0.4)", color: "#FF5566", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: 0, transform: "translateY(6px)", transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1) 0.04s", whiteSpace: "nowrap" }}>🗑 Remove</button>
                       </div>
                       <div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,212,170,0.85)", backdropFilter: "blur(8px)", color: "#050507", padding: "3px 12px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em", pointerEvents: "none" }}>✓ STORED ON WALRUS</div>
                       {coverImageBlobId && <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(5,5,7,0.7)", backdropFilter: "blur(8px)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "3px 8px", fontSize: "9px", color: "rgba(240,240,245,0.5)", fontFamily: "monospace", pointerEvents: "none", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coverImageBlobId.slice(0, 14)}...</div>}
                    </div>
                  ) : coverImageUploading ? (
                    <div style={{ position: "relative", height: "140px", borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,5,7,0.8)", gap: "10px" }}>
                       <div style={{ width: "28px", height: "28px", border: "2px solid rgba(124,92,252,0.2)", borderTop: "2px solid #7C5CFC", borderRadius: "50%", animation: "spinSlow 0.8s linear infinite" }} />
                       <span style={{ fontSize: "12px", color: "rgba(240,240,245,0.6)" }}>Uploading to Walrus...</span>
                       <div style={{ width: "100%", height: "2px", background: "rgba(255,255,255,0.1)", position: "absolute", bottom: 0 }}><div style={{ width: `${coverUploadProgress}%`, height: "100%", background: "#7C5CFC", transition: "width 0.3s ease" }} /></div>
                    </div>
                  ) : (
                    <div onClick={() => coverImageInputRef.current?.click()} onDrop={async (e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) await handleCoverImageUpload(file); }} onDragOver={e => e.preventDefault()} style={{ height: "140px", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Camera size={24} style={{ color: "rgba(255,255,255,0.2)" }} /><input type="file" ref={coverImageInputRef} className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleCoverImageUpload(file); }} /></div>
                  )}
               </div>

               {/* ── PRIVACY ── */}
               <div style={{ marginTop: "24px" }}>
                 <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", 
                   fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", 
                   display: "block", marginBottom: "10px" }}>
                   PRIVACY
                 </label>
                 <div
                   onClick={() => setIsPrivate(!isPrivate)}
                   style={{
                     display: "flex", alignItems: "center", justifyContent: "space-between",
                     padding: "12px 14px", borderRadius: "10px", cursor: "pointer",
                     background: isPrivate ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                     border: isPrivate ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.06)",
                     transition: "all 0.2s"
                   }}
                 >
                   <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                     <div style={{
                       width: "32px", height: "32px", borderRadius: "8px",
                       background: isPrivate ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                       display: "flex", alignItems: "center", justifyContent: "center"
                     }}>
                       <LockIcon size={15} color={isPrivate ? "#818cf8" : "rgba(255,255,255,0.3)"} />
                     </div>
                     <div>
                       <div style={{ fontSize: "13px", fontWeight: 600, 
                         color: isPrivate ? "#818cf8" : "rgba(255,255,255,0.7)" }}>
                         {isPrivate ? "Private Form" : "Public Form"}
                       </div>
                       <div style={{ fontSize: "11px", color: "rgba(240,240,245,0.3)", marginTop: "2px" }}>
                         {isPrivate ? "Seal E2EE on Mainnet" : "Anyone with the link can respond"}
                       </div>
                     </div>
                   </div>
                   <div style={{
                     width: "44px", height: "24px", borderRadius: "12px",
                     background: isPrivate ? "#6366f1" : "rgba(255,255,255,0.08)",
                     position: "relative", transition: "background 0.2s", flexShrink: 0
                   }}>
                     <div style={{
                       position: "absolute", top: "3px",
                       left: isPrivate ? "23px" : "3px",
                       width: "18px", height: "18px", borderRadius: "50%",
                       background: "#fff", transition: "left 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                       boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                     }} />
                   </div>
                 </div>
               </div>

               {/* ── FORM TIMER (EXPIRY) ── */}
               <div style={{ marginTop: "24px" }}>
                 <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", 
                   fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", 
                   display: "block", marginBottom: "10px" }}>
                   FORM EXPIRY
                 </label>
                 <div style={{ position: "relative" }}>
                   <Clock size={14} style={{ 
                     position: "absolute", left: "12px", top: "50%", 
                     transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)",
                     pointerEvents: "none"
                   }} />
                   <input
                     type="date"
                     value={expiryDate}
                     onChange={e => setExpiryDate(e.target.value)}
                     min={new Date().toISOString().split("T")[0]}
                     style={{
                       width: "100%", paddingLeft: "36px", paddingRight: "14px",
                       paddingTop: "10px", paddingBottom: "10px",
                       background: "rgba(255,255,255,0.05)",
                       border: "1px solid rgba(255,255,255,0.1)",
                       borderRadius: "10px", color: expiryDate ? "white" : "rgba(255,255,255,0.25)",
                       fontSize: "13px", outline: "none", boxSizing: "border-box",
                       colorScheme: "dark"
                     }}
                   />
                 </div>
                 {expiryDate && (
                   <button
                     onClick={() => setExpiryDate("")}
                     style={{ marginTop: "6px", background: "none", border: "none",
                       color: "rgba(255,85,102,0.6)", fontSize: "11px", cursor: "pointer",
                       padding: 0, fontFamily: "inherit" }}
                   >
                     × Clear expiry
                   </button>
                 )}
                 <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>
                   Form stops accepting responses after this date
                 </div>
               </div>

               {/* ── RESPONSE LIMIT ── */}
               <div style={{ marginTop: "24px" }}>
                 <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", 
                   fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", 
                   display: "block", marginBottom: "10px" }}>
                   RESPONSE LIMIT
                 </label>
                 <div style={{ position: "relative" }}>
                   <Target size={14} style={{ 
                     position: "absolute", left: "12px", top: "50%", 
                     transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)",
                     pointerEvents: "none"
                   }} />
                   <input
                     type="number"
                     min="1"
                     max="100000"
                     value={responseLimit}
                     onChange={e => setResponseLimit(e.target.value)}
                     placeholder="Unlimited"
                     style={{
                       width: "100%", paddingLeft: "36px", paddingRight: "14px",
                       paddingTop: "10px", paddingBottom: "10px",
                       background: "rgba(255,255,255,0.05)",
                       border: "1px solid rgba(255,255,255,0.1)",
                       borderRadius: "10px", color: "white",
                       fontSize: "13px", outline: "none", boxSizing: "border-box"
                     }}
                   />
                 </div>
                 <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>
                   Close form automatically after N responses
                 </div>
               </div>
            </aside>
            )}
            {isMobile && (
              <div style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                height: "56px",
                background: "rgba(12,12,16,0.95)",
                backdropFilter: "blur(20px)",
                borderTop: "0.5px solid rgba(255,255,255,0.06)",
                display: "flex",
                zIndex: 100,
                paddingBottom: "env(safe-area-inset-bottom)",
              }}>
                {[
                  { id: "fields", label: "Fields", icon: "⊞" },
                  { id: "canvas", label: "Build", icon: "✏️" },
                  { id: "settings", label: "Settings", icon: "⚙️" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBuilderTab(tab.id as any)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "3px",
                      background: "none",
                      border: "none",
                      color: builderTab === tab.id
                        ? "#7C5CFC"
                        : "rgba(240,240,245,0.4)",
                      fontSize: "10px",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <main style={{ flex: 1, padding: isMobile ? "20px 16px" : "40px", overflowY: "auto" }}>
            {!publishedFormId ? <div style={{ textAlign: "center", padding: "100px 0" }}><BarChart3 size={48} style={{ color: "rgba(255,255,255,0.1)", marginBottom: "20px" }} /><h2>Publish your form to see analytics</h2></div> : loadingDashboard ? <div style={{ textAlign: "center", padding: "100px 0" }}><Loader2 size={32} className="animate-spin" /></div> : (
              <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                 <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>{[
                    { label: "Submissions", val: analytics?.total_submissions || 0, icon: <Users size={20} />, color: "#7C5CFC" },
                    { label: "Completion", val: (analytics?.completion_rate || 0) + "%", icon: <Zap size={20} />, color: "#00D4AA" },
                    { label: "Unique", val: analytics?.unique_respondents || 0, icon: <Eye size={20} />, color: "#60A5FA" },
                    { label: "Private", val: analytics?.is_private ? "Yes" : "No", icon: <Lock size={20} />, color: "#F59E0B" }
                 ].map((s, i) => (<div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: isMobile ? "16px" : "24px" }}><div style={{ color: s.color, marginBottom: "12px" }}>{s.icon}</div><div style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 800 }}>{s.val}</div><div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px" }}>{s.label}</div></div>))}</div>
                 <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", overflow: "hidden" }}><div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3>Recent Submissions</h3><button onClick={fetchDashboard} style={{ background: "none", border: "none", color: "#7C5CFC", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Refresh</button></div><table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}><thead><tr style={{ background: "rgba(255,255,255,0.02)" }}><th style={{ padding: "16px", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Respondent</th><th style={{ padding: "16px", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Date</th><th style={{ padding: "16px", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Action</th></tr></thead><tbody>{submissions.map(s => <tr key={s.blob_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}><td style={{ padding: "16px", fontSize: "13px" }}>{s.respondent.slice(0, 10)}...</td><td style={{ padding: "16px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{new Date(s.submitted_at).toLocaleDateString()}</td><td style={{ padding: "16px" }}><button style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "white", padding: "4px 12px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>View</button></td></tr>)}</tbody></table></div>
              </div>
            )}
          </main>
        )}
      </div>
      <aside style={{ position: "fixed", right: 0, top: "56px", width: "400px", height: "calc(100vh - 56px)", zIndex: 150, background: "rgba(5,5,16,0.97)", borderLeft: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", transform: showPreview ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)", padding: "24px", overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}><span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>FORM PREVIEW</span><button onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}><X size={20} /></button></div><div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>{coverImagePreview && <img src={coverImagePreview} style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "10px", marginBottom: "16px" }} />}<h2 style={{ fontSize: "18px", margin: 0 }}>{title}</h2>{description && <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "8px 0 24px" }}>{description}</p>}<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>{fields.map((f, i) => <div key={i} style={{ display: "flex", flexDirection: "column", gap: "6px" }}><label style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{f.label} {f.required && <span style={{ color: "#ef4444" }}>*</span>}</label><div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "10px", fontSize: "13px", color: "rgba(255,255,255,0.2)" }}>Placeholder...</div></div>)}</div><button style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "10px", padding: "12px", border: "none", color: "white", fontWeight: 700, marginTop: "24px", opacity: 0.8 }}>Submit Form</button></div></aside>
      {showPicker && <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,5,16,0.95)", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "40px" }}>Choose a template</h1><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", width: "100%", maxWidth: "800px" }}>{TEMPLATES.map(t => <div key={t.id} onClick={() => loadTemplate(t)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "32px", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = t.color} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}><div style={{ fontSize: "40px", marginBottom: "20px" }}>{t.icon}</div><h3 style={{ margin: "0 0 8px" }}>{t.title}</h3><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>{t.description}</p></div>)}</div><button onClick={() => setShowPicker(false)} style={{ marginTop: "40px", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontWeight: 700, cursor: "pointer" }}>Start from scratch</button></div>}
      
      {/* Custom Field Modal */}
      {showCustomFieldModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 500,
          padding: "1rem",
        }}>
          <div style={{
            background: "#0C0C10",
            border: "0.5px solid rgba(124,92,252,0.3)",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "560px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>

            {/* HEADER */}
            <div style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#F0F0F5", margin: 0 }}>✨ Create Custom Field</h2>
                <p style={{ fontSize: "11px", color: "rgba(240,240,245,0.4)", margin: "3px 0 0" }}>Customize every detail of your field</p>
              </div>
              <button type="button" onClick={() => setShowCustomFieldModal(false)} style={{ background: "none", border: "none", color: "rgba(240,240,245,0.4)", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px" }}>×</button>
            </div>

            {/* SCROLLABLE BODY */}
            <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

              {/* FIELD TYPE GRID */}
              <div>
                <label style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Field Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {[
                    { value: "short_text",  label: "Short Text",  icon: "Aa" },
                    { value: "long_text",   label: "Long Text",   icon: "¶" },
                    { value: "dropdown",    label: "Dropdown",    icon: "▾" },
                    { value: "checkbox_group", label: "Checkboxes", icon: "☑" },
                    { value: "star_rating", label: "Star Rating", icon: "★" },
                    { value: "file_upload", label: "File Upload", icon: "📎" },
                    { value: "video_upload",label: "Video",       icon: "🎥" },
                    { value: "url",         label: "URL Input",   icon: "🔗" },
                    { value: "confirmation_checkbox", label: "Confirm", icon: "✓" },
                    { value: "number",      label: "Number",      icon: "#" },
                    { value: "email",       label: "Email",       icon: "@" },
                    { value: "date",        label: "Date Picker", icon: "📅" },
                  ].map(ft => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setCustomField(prev => ({ ...prev, type: ft.value }))}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "10px",
                        border: "0.5px solid " + (customField.type === ft.value ? "rgba(124,92,252,0.7)" : "rgba(255,255,255,0.06)"),
                        background: customField.type === ft.value ? "rgba(124,92,252,0.12)" : "rgba(255,255,255,0.02)",
                        color: customField.type === ft.value ? "#A78BFA" : "rgba(240,240,245,0.5)",
                        cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>{ft.icon}</span>
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* FIELD LABEL */}
              <div>
                <label style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Field Label *</label>
                <input type="text" value={customField.label} onChange={e => setCustomField(prev => ({ ...prev, label: e.target.value }))} placeholder="e.g. What is your question?" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F0F0F5", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* PLACEHOLDER */}
              {["short_text","long_text","url","email","number"].includes(customField.type) && (
                <div>
                  <label style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Placeholder Text</label>
                  <input type="text" value={customField.placeholder} onChange={e => setCustomField(prev => ({ ...prev, placeholder: e.target.value }))} placeholder="Hint shown inside the field" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F0F0F5", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
              )}

              {/* OPTIONS */}
              {["dropdown","checkbox_group"].includes(customField.type) && (
                <div>
                  <label style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Options</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {customField.options.map((opt, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "rgba(240,240,245,0.3)", width: "16px", textAlign: "center", flexShrink: 0 }}>{i + 1}.</span>
                        <input type="text" value={opt} onChange={e => { const updated = [...customField.options]; updated[i] = e.target.value; setCustomField(prev => ({ ...prev, options: updated })); }} style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F0F0F5", fontSize: "13px", fontFamily: "inherit", outline: "none" }} />
                        <button type="button" onClick={() => setCustomField(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))} style={{ background: "none", border: "none", color: "rgba(255,85,102,0.6)", cursor: "pointer", fontSize: "16px", padding: "4px", flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newOption.trim()) { setCustomField(prev => ({ ...prev, options: [...prev.options, newOption.trim()] })); setNewOption(""); } }} placeholder="Type and press Enter to add..." style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "0.5px dashed rgba(124,92,252,0.4)", borderRadius: "8px", color: "#F0F0F5", fontSize: "13px", fontFamily: "inherit", outline: "none" }} />
                      <button type="button" onClick={() => { if (newOption.trim()) { setCustomField(prev => ({ ...prev, options: [...prev.options, newOption.trim()] })); setNewOption(""); } }} style={{ padding: "8px 16px", borderRadius: "8px", border: "0.5px solid rgba(124,92,252,0.4)", background: "rgba(124,92,252,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", fontWeight: 500 }}>+ Add</button>
                    </div>
                  </div>
                </div>
              )}

              {/* STAR RATING */}
              {customField.type === "star_rating" && (
                <div>
                  <label style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Max Stars</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[3, 5, 7, 10].map(n => (
                      <button key={n} type="button" onClick={() => setCustomField(prev => ({ ...prev, maxRating: n }))} style={{ padding: "8px 16px", borderRadius: "8px", border: "0.5px solid " + (customField.maxRating === n ? "rgba(124,92,252,0.7)" : "rgba(255,255,255,0.06)"), background: customField.maxRating === n ? "rgba(124,92,252,0.12)" : "rgba(255,255,255,0.02)", color: customField.maxRating === n ? "#A78BFA" : "rgba(240,240,245,0.5)", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 600 }}>{"★".repeat(Math.min(n, 5))}{n > 5 ? " (" + n + ")" : ""}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* HELP TEXT */}
              <div>
                <label style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Help Text (optional)</label>
                <input type="text" value={customField.helpText} onChange={e => setCustomField(prev => ({ ...prev, helpText: e.target.value }))} placeholder="Extra guidance shown below the field" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F0F0F5", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* REQUIRED TOGGLE */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "0.5px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#F0F0F5" }}>Required field</div>
                  <div style={{ fontSize: "11px", color: "rgba(240,240,245,0.35)", marginTop: "2px" }}>Respondents must fill this in</div>
                </div>
                <div onClick={() => setCustomField(prev => ({ ...prev, required: !prev.required }))} style={{ width: "44px", height: "24px", borderRadius: "12px", background: customField.required ? "#7C5CFC" : "rgba(255,255,255,0.08)", cursor: "pointer", position: "relative", transition: "background 0.2s ease", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: "3px", left: customField.required ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", gap: "10px", flexShrink: 0 }}>
              <button type="button" onClick={() => { setShowCustomFieldModal(false); setCustomField({ label: "", type: "short_text", placeholder: "", helpText: "", required: false, options: ["Option 1", "Option 2"], maxRating: 5, maxLength: 500, acceptedFileTypes: "image/*,application/pdf", maxFileSizeMB: 10, defaultValue: "", validationPattern: "", validationMessage: "", }); }} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "0.5px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(240,240,245,0.5)", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button type="button" onClick={() => { if (!customField.label.trim()) { alert("Please enter a field label"); return; } const newF: any = { id: "custom_" + Date.now(), type: customField.type as FieldType, label: customField.label.trim(), required: customField.required }; if (customField.placeholder) newF.placeholder = customField.placeholder; if (customField.helpText) newF.helpText = customField.helpText; if (["dropdown","checkbox_group"].includes(customField.type)) newF.options = customField.options.filter(o => o.trim()); if (customField.type === "star_rating") newF.maxRating = customField.maxRating; addField(newF); setShowCustomFieldModal(false); setCustomField({ label: "", type: "short_text", placeholder: "", helpText: "", required: false, options: ["Option 1", "Option 2"], maxRating: 5, maxLength: 500, acceptedFileTypes: "image/*,application/pdf", maxFileSizeMB: 10, defaultValue: "", validationPattern: "", validationMessage: "", }); }} style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #7C5CFC, #A855F7)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(124,92,252,0.3)" }}>✨ Add to Form</button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 600,
          padding: "1.5rem",
        }}>
          <div style={{
            background: "linear-gradient(180deg, #0F0F1A 0%, #050510 100%)",
            border: "1px solid rgba(124,92,252,0.2)",
            borderRadius: "24px",
            width: "100%",
            maxWidth: "480px",
            padding: "40px",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            animation: "scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
            <div style={{ width: "64px", height: "64px", background: "rgba(0,212,170,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", border: "1px solid rgba(0,212,170,0.3)" }}>
              <Zap size={32} color="#00D4AA" fill="#00D4AA" />
            </div>
            
            <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Form Published! 🚀</h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "32px" }}>Your decentralized form is now live on Walrus protocol.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left", marginBottom: "32px" }}>
              {/* URL */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "8px" }}>Public URL</label>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <Globe size={14} color="#818cf8" />
                  <span style={{ fontSize: "13px", color: "#F0F0F5", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{publishedUrl}</span>
                  <button onClick={() => { navigator.clipboard.writeText(publishedUrl); showToast("URL copied!", "success"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", padding: "4px" }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}><Copy size={14} /></button>
                </div>
              </div>

              {/* Blob ID */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "8px" }}>Walrus Blob ID</label>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <Lock size={14} color="#A78BFA" />
                  <span style={{ fontSize: "12px", color: "#A78BFA", flex: 1, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{publishedFormId}</span>
                  <button onClick={() => { navigator.clipboard.writeText(publishedFormId || ""); showToast("Blob ID copied!", "success"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", padding: "4px" }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}><Copy size={14} /></button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setShowSuccessModal(false)} style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Done</button>
              <button onClick={() => window.open(publishedUrl, "_blank")} style={{ flex: 1.5, padding: "14px", borderRadius: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 20px rgba(99,102,241,0.2)" }}>View Form</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
