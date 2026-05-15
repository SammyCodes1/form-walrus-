const fs = require("fs");
const path = require("path");

const SECURITY_LOG_FILE = path.join(__dirname, "../data/security-logs.json");

// Event types
const EVENT_TYPES = {
  FORM_CREATED: "form_created",
  FORM_VIEWED: "form_viewed",
  SUBMISSION_RECEIVED: "submission_received",
  SUBMISSION_VIEWED: "submission_viewed",
  ADMIN_GRANTED: "admin_granted",
  ADMIN_REVOKED: "admin_revoked",
  UNAUTHORIZED_ACCESS: "unauthorized_access",
  EXPORT_DOWNLOADED: "export_downloaded",
  FORM_DELETED: "form_deleted",
  SEAL_DECRYPT_ATTEMPT: "seal_decrypt_attempt",
  NOTES_SAVED: "notes_saved",
};

function readLogsFile() {
  try {
    if (!fs.existsSync(SECURITY_LOG_FILE)) return {};
    return JSON.parse(fs.readFileSync(SECURITY_LOG_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeLogsFile(data) {
  try {
    const dataDir = path.join(__dirname, "../data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(SECURITY_LOG_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write security logs:", e.message);
  }
}

function logEvent(formId, eventType, details = {}) {
  const logs = readLogsFile();
  if (!logs[formId]) logs[formId] = [];

  const entry = {
    id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    event: eventType,
    timestamp: Date.now(),
    ...details,
  };

  // Keep max 200 logs per form (newest first)
  logs[formId].unshift(entry);
  if (logs[formId].length > 200) {
    logs[formId] = logs[formId].slice(0, 200);
  }

  writeLogsFile(logs);
  return entry;
}

function getLogsForForm(formId) {
  const logs = readLogsFile();
  return logs[formId] || [];
}

module.exports = { logEvent, getLogsForForm, EVENT_TYPES };
