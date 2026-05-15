const { Router } = require("express");
const { z } = require("zod");
const { WalrusClient, WalrusFormError } = require("@form-walrus/client");
const { stringify } = require("csv-stringify");
const XLSX = require("xlsx");
const { logEvent, getLogsForForm, EVENT_TYPES } = require("./security-logger");
const fs = require("fs");
const path = require("path");

const router = Router();
const walrus = new WalrusClient();

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const FORM_REGISTRY_ID = process.env.NEXT_PUBLIC_FORM_REGISTRY_ID || "";

// In-memory notes registry (legacy)
const notesRegistry = new Map();

// Data Directory and File Paths
const DATA_DIR = path.join(__dirname, "data");
const REGISTRY_FILE = path.join(DATA_DIR, "form-registry.json");
const CREATOR_INDEX_FILE = path.join(DATA_DIR, "creator-index.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}
ensureDataDir();

// --- Registry Persistence Helpers ---

function readRegistry() {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return {};
    const content = fs.readFileSync(REGISTRY_FILE, "utf8");
    const parsed = JSON.parse(content);
    try {
      fs.writeFileSync(
        REGISTRY_FILE + ".backup",
        content,
        "utf8"
      );
    } catch {}
    return parsed;
  } catch (e: any) {
    console.error("Registry read error:", e.message);
    try {
      const backup = fs.readFileSync(
        REGISTRY_FILE + ".backup",
        "utf8"
      );
      return JSON.parse(backup);
    } catch {
      return {};
    }
  }
}

function writeRegistry(data) {
  const tempPath = REGISTRY_FILE + ".tmp";
  try {
    fs.writeFileSync(
      tempPath,
      JSON.stringify(data, null, 2),
      "utf8"
    );
    fs.renameSync(tempPath, REGISTRY_FILE);
  } catch (e: any) {
    console.error("Registry write failed:", e.message);
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {}
  }
}

// Raw access to registry entry
function getRegistryEntry(formId) {
  const registry = readRegistry();
  return registry[formId] || null;
}

// Get form ONLY if not deleted
function getActiveForm(formId) {
  const entry = getRegistryEntry(formId);
  if (!entry || entry.deleted) return null;
  return entry;
}

function saveForm(formId, formData) {
  const registry = readRegistry();
  registry[formId] = { 
    ...formData, 
    schema_blob_id: formId,
    title: formData.title || "Untitled Form",
    description: formData.description || "",
    is_private: !!formData.is_private,
    creator_address: (formData.creator_address || "").toLowerCase().trim(),
    created_at: Date.now(),   // Ensure fresh timestamp
    total_submissions: formData.total_submissions || 0,
    submission_index_blob_id: formData.submission_index_blob_id || null,
    response_limit: formData.response_limit || null,
    expiry_date: formData.expiry_date || null,
    cover_image_blob_id: formData.cover_image_blob_id || null,
    deleted: false 
  };
  writeRegistry(registry);
}

function updateForm(formId, updates) {
  const registry = readRegistry();
  if (registry[formId]) {
    registry[formId] = { 
      ...registry[formId], 
      ...updates, 
      updated_at: Date.now() 
    };
    writeRegistry(registry);
  }
}

// --- Creator Index Helpers ---

function readCreatorIndexFile() {
  try {
    if (!fs.existsSync(CREATOR_INDEX_FILE)) return {};
    return JSON.parse(fs.readFileSync(CREATOR_INDEX_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeCreatorIndexFile(data) {
  try {
    fs.writeFileSync(CREATOR_INDEX_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

async function getCreatorIndex(creatorAddress) {
  const addr = (creatorAddress || "").toLowerCase().trim();
  const indexFile = readCreatorIndexFile();
  const latestBlobId = indexFile[addr];
  if (!latestBlobId) return { creator: addr, forms: [], prev_index_blob_id: null };
  
  try {
    return await walrus.downloadJSON(latestBlobId);
  } catch (e) {
    return { creator: addr, forms: [], prev_index_blob_id: null };
  }
}

async function saveCreatorIndex(creatorAddress, index) {
  const addr = (creatorAddress || "").toLowerCase().trim();
  const prev_index_blob_id = readCreatorIndexFile()[addr] || null;
  const newBlobId = await walrus.uploadJSON({
    ...index,
    creator: addr,
    updated_at: Date.now(),
    prev_index_blob_id
  });

  const indexFile = readCreatorIndexFile();
  indexFile[addr] = newBlobId;
  writeCreatorIndexFile(indexFile);
  return newBlobId;
}

// --- Sui Client Helper ---

async function getFormWalrusSui() {
  const { SuiClient } = await import("@mysten/sui/client");
  const suiClient = new SuiClient({
    url: process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443"
  });
  const { FormWalrusSuiClient } = require("@form-walrus/client");
  return new FormWalrusSuiClient(
    suiClient,
    process.env.PACKAGE_ID || "",
    process.env.FORM_REGISTRY_ID || ""
  );
}

// --- Startup Verification ---

async function verifyRegistry() {
  const registry = readRegistry();
  const activeIds = Object.keys(registry).filter(id => !registry[id].deleted);
  console.log("Registry loaded with " + activeIds.length + " active forms");
}
verifyRegistry().catch(console.error);

// --- Routes ---

router.post("/upload/image", async (req, res, next) => {
  try {
    // Accept base64 encoded image from frontend
    const { imageData, mimeType, fileName } = req.body;

    if (!imageData || !mimeType) {
      return res.status(400).json({ 
        error: "imageData and mimeType required" 
      });
    }

    // Validate mime type
    const allowedTypes = [
      "image/jpeg", "image/png",
      "image/gif", "image/webp", "image/svg+xml",
      "application/pdf", "application/octet-stream"
    ];
    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({ 
        error: "Invalid image type" 
      });
    }

    // Convert base64 to Uint8Array
    const base64Data = imageData.replace(
      /^data:image\/[a-z]+;base64,/, ""
    );
    const buffer = Buffer.from(base64Data, "base64");

    // Check size — max 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ 
        error: "Image must be under 5MB" 
      });
    }

    // Upload to Walrus via server-side walrus client
    const blobId = await walrus.uploadBlob(
      new Uint8Array(buffer),
      { epochs: 52 }
    );

    res.json({ 
      success: true,
      blob_id: blobId,
      size: buffer.length,
      mime_type: mimeType,
    });

  } catch (err: any) {
    console.error("Image upload error:", err.message);
    next(err);
  }
});

const createFormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(z.any()),
  is_private: z.boolean(),
  creator_address: z.string(),
  expiry_date: z.string().nullable().optional(),
  response_limit: z.number().nullable().optional(),
  styling: z.any().optional(),
  cover_image_blob_id: z.string().nullable().optional(),
  allowlist_id: z.string().optional(),
});

function isValidSuiAddress(addr) {
  return (
    typeof addr === "string" &&
    addr.startsWith("0x") &&
    addr.length === 66
  );
}

// POST /forms — create a new form
router.post("/forms", async (req, res, next) => {
  try {
    const data = createFormSchema.parse(req.body);
    const creator_address = data.creator_address.toLowerCase().trim();

    const schemaBlobId = await walrus.uploadJSON({
      title: data.title || "Untitled Form",
      description: data.description || "",
      fields: data.fields || [],
      is_private: !!data.is_private,
      creator_address,
      created_at: Date.now(),
      expiry_date: data.expiry_date || null,
      response_limit: data.response_limit || null,
      styling: data.styling || null,
      cover_image_blob_id: data.cover_image_blob_id || null,
    });

    const formId = schemaBlobId;

    logEvent(formId, EVENT_TYPES.FORM_CREATED, {
      creator: creator_address,
      title: data.title,
      is_private: data.is_private,
      ip: req.ip || "unknown",
    });

    saveForm(formId, {
      schema_blob_id: formId,
      title: data.title || "Untitled Form",
      description: data.description || "",
      is_private: !!data.is_private,
      creator_address,
      created_at: Date.now(),
      total_submissions: 0,
      submission_index_blob_id: null,
      response_limit: data.response_limit || null,
      expiry_date: data.expiry_date || null,
      cover_image_blob_id: data.cover_image_blob_id || null,
    });

    if (data.is_private && data.allowlist_id) {
      updateForm(formId, { 
        allowlist_id: data.allowlist_id 
      });
    }

    const creatorIndex = await getCreatorIndex(creator_address);
    creatorIndex.forms.unshift({
      form_id: formId,
      title: data.title || "Untitled Form",
      schema_blob_id: schemaBlobId,
      is_private: !!data.is_private,
      created_at: Date.now(),
      total_submissions: 0,
      submission_index_blob_id: null,
      expiry_date: data.expiry_date || null,
      response_limit: data.response_limit || null,
    });
    await saveCreatorIndex(creator_address, creatorIndex);

    res.json({
      form_id: formId,
      schema_blob_id: schemaBlobId,
      share_url: "http://localhost:3001/f/" + formId,
    });
  } catch (err) { next(err); }
});

// PATCH /forms/:form_id — update form schema
router.patch("/forms/:form_id", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { expiry_date, response_limit, seal_object_id, caller_address } = req.body;

    if (!caller_address) return res.status(401).json({ error: "caller_address required" });
    const addr = caller_address.toLowerCase().trim();

    const entry = getActiveForm(form_id);
    if (!entry) return res.status(404).json({ error: "Form not found or deleted" });
    if (entry.creator_address !== addr) return res.status(403).json({ error: "Not authorized" });

    const schema = await walrus.downloadJSON(form_id);
    if (expiry_date !== undefined) schema.expiry_date = expiry_date;
    if (response_limit !== undefined) schema.response_limit = response_limit;
    if (seal_object_id !== undefined) schema.seal_object_id = seal_object_id;
    await walrus.uploadJSON(schema);

    const creatorIndex = await getCreatorIndex(addr);
    const formIdx = creatorIndex.forms.findIndex(f => f.form_id === form_id);
    if (formIdx !== -1) {
      if (expiry_date !== undefined) creatorIndex.forms[formIdx].expiry_date = expiry_date;
      if (response_limit !== undefined) creatorIndex.forms[formIdx].response_limit = response_limit;
      if (seal_object_id !== undefined) creatorIndex.forms[formIdx].seal_object_id = seal_object_id;
      await saveCreatorIndex(addr, creatorIndex);
    }

    updateForm(form_id, {
      expiry_date: schema.expiry_date,
      response_limit: schema.response_limit,
      seal_object_id: schema.seal_object_id
    });

    res.json({ 
      success: true, 
      expiry_date: schema.expiry_date, 
      response_limit: schema.response_limit,
      seal_object_id: schema.seal_object_id
    });
  } catch (err) { next(err); }
});

// DELETE /forms/:form_id
router.delete("/forms/:form_id", async (req, res, next) => {
  try {
    const { form_id } = req.params;

    // Accept both field names for compatibility
    const creator_address =
      req.body.creator_address ||
      req.body.caller_address;

    if (!creator_address) {
      return res.status(401).json({
        error: "creator_address required",
      });
    }

    const registry = readRegistry();
    const formMeta = registry[form_id];

    // If form not in registry just return success
    if (!formMeta) {
      return res.json({
        success: true,
        message: "Form not found or already deleted",
        form_id,
      });
    }

    // Check ownership — case insensitive
    const normalize = (s: string) =>
      (s || "").toLowerCase().trim();

    if (
      formMeta.creator_address &&
      normalize(formMeta.creator_address) !==
      normalize(creator_address)
    ) {
      return res.status(403).json({
        error: "Not authorized. Only the form creator can delete this form.",
      });
    }

    // Mark as deleted instead of removing
    // This preserves Walrus blob references
    registry[form_id] = {
      ...formMeta,
      deleted: true,
      deleted_at: Date.now(),
      deleted_by: creator_address,
    };

    writeRegistry(registry);

    console.log("Form deleted:", form_id.slice(0, 8) + "...");

    res.json({
      success: true,
      message: "Form deleted successfully",
      form_id,
    });
  } catch (err: any) {
    console.error("Delete error:", err.message);
    next(err);
  }
});

// PATCH /forms/:form_id/allowlist
router.patch("/forms/:form_id/allowlist", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { allowlist_id, caller_address } = req.body;

    if (!allowlist_id || !caller_address) {
      return res.status(400).json({ 
        error: "allowlist_id and caller_address required" 
      });
    }

    const formMeta = getRegistryEntry(form_id);
    if (!formMeta) {
      return res.status(404).json({ 
        error: "Form not found" 
      });
    }

    updateForm(form_id, { allowlist_id });

    res.json({ 
      success: true, 
      allowlist_id 
    });
  } catch (err) { next(err); }
});

// POST /upload-media — upload base64 media to Walrus
router.post("/upload-media", async (req, res, next) => {
  try {
    const { data, mimeType } = req.body;
    if (!data) return res.status(400).json({ error: "Missing data" });

    if (data.length > 9.5 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large (max 7MB)" });
    }

    const base64Data = data.includes(",") ? data.split(",")[1] : data;
    const buffer = Buffer.from(base64Data, "base64");
    const uint8Array = new Uint8Array(buffer);

    const result = await walrus.uploadBlob(uint8Array);
    const blobId = typeof result === 'string' ? result : (result.blobId || result);
    res.json({ blob_id: blobId });
  } catch (err) {
    next(err);
  }
});

// GET /forms — list forms for a creator
router.get("/forms", async (req, res, next) => {
  try {
    const { creator_address } = req.query;

    if (!creator_address || typeof creator_address !== "string") {
      return res.status(400).json({ error: "creator_address required" });
    }

    const registry = readRegistry();

    const forms = Object.entries(registry)
      .filter(([id, meta]) =>
        meta.creator_address === creator_address &&
        !meta.deleted
      )
      .map(([id, meta]) => ({
        id,
        form_id: id,
        title: meta.title || "Untitled Form",
        description: meta.description || "",
        is_private: meta.is_private || false,
        creator_address: meta.creator_address,
        created_at: meta.created_at || Date.now(),
        total_submissions: meta.total_submissions || 0,
        submission_index_blob_id: meta.submission_index_blob_id || null,
        response_limit: meta.response_limit || null,
        expiry_date: meta.expiry_date || null,
      }))
      .sort((a, b) => b.created_at - a.created_at);

    res.json({ forms });
  } catch (err) { next(err); }
});

// GET /forms/:form_id — get form schema
router.get("/forms/:form_id", async (req, res, next) => {
  try {
    const { form_id } = req.params;

    const entry = getRegistryEntry(form_id);
    if (entry && entry.deleted) {
      return res.status(410).json({ error: "Form has been deleted" });
    }
    
    try {
      const schema = await walrus.downloadJSON(form_id);

      logEvent(form_id, EVENT_TYPES.FORM_VIEWED, {
        ip: req.ip || "unknown",
        user_agent: req.headers["user-agent"] || "unknown",
      });
      
      if (!entry) {
        saveForm(form_id, {
          schema_blob_id: form_id,
          title: schema.title || "Untitled Form",
          description: schema.description || "",
          is_private: !!schema.is_private,
          creator_address: schema.creator_address || "",
          created_at: schema.created_at || Date.now(),
          total_submissions: 0,
          submission_index_blob_id: null,
          response_limit: schema.response_limit || null,
          expiry_date: schema.expiry_date || null,
          cover_image_blob_id: schema.cover_image_blob_id || null,
        });
      }

      const meta = entry || getRegistryEntry(form_id);
      const total_submissions = meta?.total_submissions || 0;
      const expiry_date = schema.expiry_date;
      const response_limit = schema.response_limit;
      
      const is_expired = expiry_date ? new Date(expiry_date) < new Date() : false;
      const is_full = response_limit ? total_submissions >= response_limit : false;
      const time_remaining = expiry_date ? new Date(expiry_date).getTime() - Date.now() : null;
      const spots_remaining = response_limit ? Math.max(0, response_limit - total_submissions) : null;
      const fill_percentage = response_limit ? Math.round((total_submissions / response_limit) * 100) : null;

      let status = "open";
      if (is_expired || is_full) status = "closed";
      else if (time_remaining && time_remaining < 24 * 60 * 60 * 1000) status = "closing_soon";

      return res.json({ 
        id: form_id, 
        ...schema,
        ...(meta || {}),
        allowlist_id: meta?.allowlist_id || null,
        cover_image_blob_id: meta?.cover_image_blob_id || schema?.cover_image_blob_id || null,
        is_expired,
        is_full,
        time_remaining,
        spots_remaining,
        fill_percentage,
        status
      });
    } catch (e) {
      if (entry && !entry.deleted) return res.json({ id: form_id, ...entry });
      return res.status(404).json({ error: "Form not found" });
    }
  } catch (err) { next(err); }
});

// POST /forms/:form_id/submit — submit a response
router.post("/forms/:form_id/submit", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { 
      fields, 
      respondent_address, 
      media_blob_ids, 
      tx_digest,
      is_encrypted,
      encrypted_blob_id 
    } = req.body;

    const entry = getActiveForm(form_id);
    if (!entry) return res.status(410).json({ error: "Form is no longer available (deleted)" });

    const schema = await walrus.downloadJSON(form_id);

    if (schema.expiry_date && new Date(schema.expiry_date) < new Date()) {
      return res.status(403).json({ error: "Form closed", code: "FORM_EXPIRED" });
    }

    const currentTotal = entry.total_submissions || 0;
    if (schema.response_limit && currentTotal >= schema.response_limit) {
      return res.status(403).json({ error: "Response limit reached", code: "RESPONSE_LIMIT_REACHED" });
    }

    const submissionPayload = {
      form_id,
      fields,
      submitted_at: Date.now(),
      respondent: respondent_address || "anonymous",
      media_blob_ids: media_blob_ids || [],
      tx_digest: tx_digest || null,
      is_private: entry.is_private || false,
      is_encrypted: !!is_encrypted,
      encrypted_blob_id: encrypted_blob_id || null,
    };

    const blobId = await walrus.uploadJSON(submissionPayload);

    logEvent(form_id, EVENT_TYPES.SUBMISSION_RECEIVED, {
      respondent: respondent_address || "anonymous",
      blob_id: blobId,
      tx_digest: tx_digest || null,
      ip: req.ip || "unknown",
      is_encrypted: !!is_encrypted,
    });

    let subIndex = { form_id, submissions: [] };
    if (entry.submission_index_blob_id) {
      try { subIndex = await walrus.downloadJSON(entry.submission_index_blob_id); } catch (e) {}
    }
    subIndex.submissions.push({ 
      blob_id: blobId, 
      submitted_at: Date.now(), 
      respondent: respondent_address || "anonymous",
      is_encrypted: !!is_encrypted 
    });
    const newSubIndexBlobId = await walrus.uploadJSON(subIndex);

    updateForm(form_id, {
      submission_index_blob_id: newSubIndexBlobId,
      total_submissions: currentTotal + 1
    });

    const creatorIndex = await getCreatorIndex(schema.creator_address);
    const indexForm = creatorIndex.forms.find(f => f.form_id === form_id);
    if (indexForm) {
      indexForm.total_submissions = currentTotal + 1;
      indexForm.submission_index_blob_id = newSubIndexBlobId;
      await saveCreatorIndex(schema.creator_address, creatorIndex);
    }

    res.json({ success: true, blob_id: blobId });
  } catch (err) { next(err); }
});

// GET /forms/:form_id/analytics
router.get("/forms/:form_id/analytics", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { caller_address } = req.query;

    if (!caller_address) return res.status(401).json({ error: "caller_address required" });
    const addr = caller_address.toLowerCase().trim();

    const entry = getActiveForm(form_id);
    if (!entry || (entry.creator_address || "").toLowerCase().trim() !== addr) {
      return res.status(403).json({ error: "Unauthorized access to form analytics" });
    }

    const schema = await walrus.downloadJSON(form_id);
    const fields = schema.fields || [];
    const totalFields = fields.filter(f => f.type !== "section_heading").length;
    const requiredFields = fields.filter(f => f.required).length;

    if (!entry.submission_index_blob_id) {
      const dailyMap = new Map();
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toLocaleDateString(), 0);
      }
      return res.json({
        total_submissions: 0,
        completion_rate: 0,
        unique_respondents: 0,
        anonymous_count: 0,
        wallet_signed_count: 0,
        submissions_by_day: Array.from(dailyMap.entries()).map(([name, value]) => ({ name: name.split("/").slice(0, 2).join("/"), value })),
        avg_fields_filled: 0,
        last_submission_at: null,
        first_submission_at: null,
        is_private: entry.is_private || false,
        allowlist_id: entry.allowlist_id || null,
        expiry_date: entry.expiry_date || null,
        response_limit: entry.response_limit || null,
        total_fields: totalFields,
        required_fields: requiredFields,
      });
    }

    const index = await walrus.downloadJSON(entry.submission_index_blob_id);
    const submissions = index.submissions || [];
    
    const fullSubmissions = await Promise.all(
      submissions.map(async (entry) => {
        try { return { ...entry, data: await walrus.downloadJSON(entry.blob_id) }; } catch (e) { return { ...entry, data: null }; }
      })
    );

    const total = fullSubmissions.length;
    const uniqueAddresses = new Set(fullSubmissions.filter(s => s.respondent !== "anonymous" && s.respondent).map(s => s.respondent));
    const uniqueRespondents = uniqueAddresses.size;
    
    const anonymousCount = fullSubmissions.filter(s => !s.respondent || s.respondent === "anonymous").length;
    const walletSignedCount = fullSubmissions.filter(s => s.data?.tx_digest).length;

    let fullCount = 0;
    let totalFieldsFilledAcrossAll = 0;

    fullSubmissions.forEach(s => {
      if (!s.data) return;
      if (s.data.is_encrypted || s.data.fields?.encrypted) { 
        fullCount++; 
        totalFieldsFilledAcrossAll += totalFields; 
        return; 
      }
      const filledCount = Object.keys(s.data.fields || {}).filter(k => {
        const val = s.data.fields[k];
        return val !== undefined && val !== null && String(val).trim() !== "";
      }).length;
      totalFieldsFilledAcrossAll += filledCount;
      if (filledCount >= totalFields && totalFields > 0) fullCount++;
    });

    const completionRate = parseFloat((total > 0 ? (fullCount / total) * 100 : 0).toFixed(1));
    const avgFieldsFilled = parseFloat((total > 0 ? totalFieldsFilledAcrossAll / total : 0).toFixed(1));

    const dailyMap = new Map();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      dailyMap.set(d.toLocaleDateString(), 0);
    }
    fullSubmissions.forEach(s => {
      const dateKey = new Date(s.submitted_at).toLocaleDateString();
      if (dailyMap.has(dateKey)) dailyMap.set(dateKey, dailyMap.get(dateKey) + 1);
    });

    const submissionsByDay = Array.from(dailyMap.entries()).map(([name, value]) => ({ 
      name: name.split("/").slice(0, 2).join("/"), 
      value 
    }));

    res.json({
      total_submissions: total,
      completion_rate: completionRate,
      unique_respondents: uniqueRespondents,
      anonymous_count: anonymousCount,
      wallet_signed_count: walletSignedCount,
      submissions_by_day: submissionsByDay,
      avg_fields_filled: avgFieldsFilled,
      last_submission_at: total > 0 
        ? submissions[submissions.length - 1].submitted_at 
        : null,
      first_submission_at: total > 0 
        ? submissions[0].submitted_at 
        : null,
      is_private: entry?.is_private || false,
      allowlist_id: entry?.allowlist_id || null,
      expiry_date: entry?.expiry_date || null,
      response_limit: entry?.response_limit || null,
      total_fields: totalFields,
      required_fields: requiredFields,
    });
  } catch (err) { next(err); }
});

// GET /forms/:form_id/submissions — get all submissions (admin)
router.get("/forms/:form_id/submissions", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { caller_address } = req.query;
    if (!caller_address) return res.status(401).json({ error: "caller_address required" });
    const addr = caller_address.toLowerCase().trim();

    const entry = getActiveForm(form_id);
    if (!entry || (entry.creator_address || "").toLowerCase().trim() !== addr) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    if (!entry.submission_index_blob_id) return res.json({ entries: [] });

    const index = await walrus.downloadJSON(entry.submission_index_blob_id);
    const entries = index.submissions || [];

    logEvent(form_id, EVENT_TYPES.SUBMISSION_VIEWED, {
      viewer: addr,
      count: entries.length,
      ip: req.ip || "unknown",
    });

    res.json({ entries });
  } catch (err) { next(err); }
});

// PATCH /submissions/:blob_id/notes
router.patch("/submissions/:blob_id/notes", async (req, res, next) => {
  try {
    const { blob_id } = req.params;
    const { text, priority, status, tags, saved_by, pinned } = req.body;
    const prev_note_blob_id = notesRegistry.get(blob_id) || null;
    const noteBlobId = await walrus.uploadJSON({ submission_id: blob_id, text, priority, status, tags, saved_by, pinned: !!pinned, saved_at: Date.now(), prev_note_blob_id });
    notesRegistry.set(blob_id, noteBlobId);
    res.json({ success: true, note_blob_id: noteBlobId });
  } catch (err) { next(err); }
});

// GET /submissions/:blob_id/notes/history
router.get("/submissions/:blob_id/notes/history", async (req, res, next) => {
  try {
    const { blob_id } = req.params;
    const history = [];
    let currentBlobId = notesRegistry.get(blob_id);
    while (currentBlobId) {
      try {
        const note = await walrus.downloadJSON(currentBlobId);
        history.push({ ...note, id: currentBlobId });
        currentBlobId = note.prev_note_blob_id;
      } catch (e) { break; }
    }
    res.json(history);
  } catch (err) { next(err); }
});

// GET /forms/:form_id/admins
router.get("/forms/:form_id/admins", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const schema = await walrus.downloadJSON(form_id);
    
    const creator = { 
      address: schema.creator_address, 
      role: "creator", 
      added_at: schema.created_at || Date.now() 
    };
    
    const otherAdmins = (schema.admins || []).map(addr => ({
      address: addr,
      role: "admin",
      added_at: Date.now() // Approximation
    }));

    res.json({ admins: [creator, ...otherAdmins] });
  } catch (err) { next(err); }
});

// POST /forms/:form_id/admins — add an admin (metadata only)
router.post("/forms/:form_id/admins", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { admin_address, caller_address } = req.body;

    if (!caller_address || !admin_address) {
      return res.status(400).json({ error: "Missing addresses" });
    }

    const entry = getActiveForm(form_id);
    if (!entry || entry.creator_address !== caller_address.toLowerCase()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const schema = await walrus.downloadJSON(form_id);
    if (!schema.admins) schema.admins = [];
    
    const addr = admin_address.toLowerCase();
    if (!schema.admins.includes(addr)) {
      schema.admins.push(addr);
      await walrus.uploadJSON(schema);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /forms/:form_id/admins/:address — remove an admin (metadata only)
router.delete("/forms/:form_id/admins/:address", async (req, res, next) => {
  try {
    const { form_id, address } = req.params;
    const { caller_address } = req.body;

    if (!caller_address) {
      return res.status(401).json({ error: "caller_address required" });
    }

    const entry = getActiveForm(form_id);
    if (!entry || entry.creator_address !== caller_address.toLowerCase()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const schema = await walrus.downloadJSON(form_id);
    if (schema.admins) {
      schema.admins = schema.admins.filter(a => a !== address.toLowerCase());
      await walrus.uploadJSON(schema);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /submissions/:blob_id — get full submission data from Walrus
router.get("/submissions/:blob_id", async (req, res, next) => {
  try {
    const { blob_id } = req.params;
    const data = await walrus.downloadJSON(blob_id);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: "Submission not found on Walrus" });
  }
});

// GET /forms/:form_id/export
router.get("/forms/:form_id/export", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { caller_address } = req.query;
    if (!caller_address) return res.status(401).json({ error: "caller_address required" });
    const addr = caller_address.toLowerCase().trim();

    const entry = getActiveForm(form_id);
    if (!entry || (entry.creator_address || "").toLowerCase().trim() !== addr) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!entry.submission_index_blob_id) return res.status(404).json({ error: "No submissions found" });

    const schema = await walrus.downloadJSON(form_id);
    const fields = (schema.fields || []).filter(f => f.type !== "section_heading");
    const fieldLabels = fields.map(f => f.label || f.type);
    const headers = ["No.", "Submitted At", "Respondent", "Walrus Blob ID", ...fieldLabels];

    const index = await walrus.downloadJSON(entry.submission_index_blob_id);
    const submissions = index.submissions || [];
    const dataRows = [];

    for (let i = 0; i < submissions.length; i++) {
      const entry = submissions[i];
      try {
        const submission = await walrus.downloadJSON(entry.blob_id);
        const row = [
          i + 1,
          new Date(entry.submitted_at).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          entry.respondent === "anonymous" ? "Anonymous" : entry.respondent,
          entry.blob_id
        ];
        fields.forEach(field => {
          const label = field.label || field.type;
          const value = submission.fields?.[label];
          if (value === undefined || value === null) row.push("");
          else if (typeof value === "number" && field.type === "star_rating") row.push("★".repeat(value) + "☆".repeat(5 - value) + " (" + value + "/5)");
          else if (typeof value === "boolean") row.push(value ? "✓ Confirmed" : "✗ Not confirmed");
          else if (Array.isArray(value)) row.push(value.length > 0 ? value.join(" | ") : "None selected");
          else if (typeof value === "object" && value !== null) row.push(value.blobId ? "Uploaded: " + value.blobId.slice(0, 12) + "..." : JSON.stringify(value).slice(0, 50));
          else row.push(String(value));
        });
        dataRows.push(row);
      } catch (e) {}
    }

    const ws = XLSX.utils.aoa_to_sheet([[schema.title + " — Submissions Export"], ["Exported: " + new Date().toLocaleString(), "", "Total: " + submissions.length + " responses"], [], headers, ...dataRows]);
    ws["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 68 }, { wch: 50 }, ...fieldLabels.map(l => ({ wch: Math.min(Math.max(l.length + 6, 18), 40) }))];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    ws["!freeze"] = { xSplit: 0, ySplit: 4 };

    const wsSummary = XLSX.utils.aoa_to_sheet([["FORM SUBMISSION REPORT", ""], [""], ["Form Title", schema.title || "Untitled"], ["Form ID", form_id], ["Total Submissions", submissions.length], ["Export Date", new Date().toLocaleString()], ["Network", "Sui Testnet"], ["Storage", "Walrus Decentralized Storage"], [""], ["FIELD BREAKDOWN", ""], ["Field Name", "Type", "Required"], ...(schema.fields || []).filter(f => f.type !== "section_heading").map(f => [f.label || "Unnamed field", f.type || "unknown", f.required ? "Yes" : "No"])]);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 35 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const safeTitle = (schema.title || "form").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 20);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=" + safeTitle + "_" + new Date().toISOString().slice(0,10) + ".xlsx");
    res.send(buf);
  } catch (err) { next(err); }
});

router.get("/forms/:form_id/security-logs", async (req, res, next) => {
  try {
    const { form_id } = req.params;
    const { caller_address } = req.query;

    if (!caller_address) {
      return res.status(401).json({ error: "caller_address required" });
    }

    const formMeta = getRegistryEntry(form_id);
    if (formMeta?.creator_address) {
      const normalized = (addr) => addr.toLowerCase().trim();
      if (normalized(formMeta.creator_address) !== normalized(caller_address)) {
        return res.status(403).json({ error: "Only the form creator can view security logs" });
      }
    }

    const logs = getLogsForForm(form_id);

    const summary = {
      total_events: logs.length,
      form_views: logs.filter(l => l.event === "form_viewed").length,
      submissions: logs.filter(l => l.event === "submission_received").length,
      submission_views: logs.filter(l => l.event === "submission_viewed").length,
      unauthorized_attempts: logs.filter(l => l.event === "unauthorized_access").length,
      exports: logs.filter(l => l.event === "export_downloaded").length,
      admin_changes: logs.filter(l =>
        l.event === "admin_granted" || l.event === "admin_revoked"
      ).length,
    };

    res.json({ logs, summary });
  } catch (err) { next(err); }
});

router.post("/forms/:form_id/setup-encryption",
  async (req, res, next) => {
    try {
      const { form_id } = req.params;
      const { creator_address } = req.body;

      if (!creator_address) {
        return res.status(400).json({ 
          error: "creator_address required" 
        });
      }

      const formMeta = getRegistryEntry(form_id);
      if (!formMeta) {
        return res.status(404).json({ 
          error: "Form not found" 
        });
      }

      // Verify creator
      const normalize = (s: string) => 
        (s || "").toLowerCase().trim();
      
      if (
        formMeta.creator_address &&
        normalize(formMeta.creator_address) !== 
        normalize(creator_address)
      ) {
        return res.status(403).json({ 
          error: "Not authorized" 
        });
      }

      // Generate allowlist ID if not set
      if (!formMeta.allowlist_id) {
        const allowlistId = 
          "allowlist_" + form_id.slice(0, 20) + 
          "_" + creator_address.slice(2, 10);
        
        updateForm(form_id, { 
          allowlist_id: allowlistId,
          is_private: true,
        });

        return res.json({
          success: true,
          allowlist_id: allowlistId,
          message: "Encryption configured for this form",
        });
      }

      return res.json({
        success: true,
        allowlist_id: formMeta.allowlist_id,
        message: "Encryption was already configured",
      });

    } catch (err) { next(err); }
  }
);

module.exports = router;
