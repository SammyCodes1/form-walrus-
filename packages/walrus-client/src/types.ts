export type FieldType = 
  | "short_text" 
  | "long_text" 
  | "rich_text" 
  | "dropdown" 
  | "checkbox_group" 
  | "star_rating" 
  | "file_upload" 
  | "video_upload" 
  | "url_input" 
  | "confirmation_checkbox" 
  | "section_heading";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for dropdown, checkbox_group
}

export interface FormStyling {
  primaryColor: string;
  backgroundColor: string;
  fontFamily: "sans" | "serif" | "mono";
  logoUrl?: string;
  borderRadius: "none" | "small" | "medium" | "large" | "full";
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
  styling?: FormStyling;
}

export type SubmissionPayload = Record<string, unknown>;

export interface SubmissionRef {
  submissionId: string;
  blobId: string;
  submittedAt: number;
  respondentAddress?: string;
}

export interface SubmissionIndex {
  entries: SubmissionRef[];
  prev_index_blob_id: string | null;
}

export interface MediaManifest {
  chunks: string[];
  totalSize: number;
  mimeType: string;
}

export interface AdminNotes {
  note: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "new" | "reviewed" | "actioned";
  updatedAt: number;
}

export class WalrusFormError extends Error {
  code: string;
  txDigest?: string;

  constructor(message: string, code: string, txDigest?: string) {
    super(message);
    this.name = "WalrusFormError";
    this.code = code;
    this.txDigest = txDigest;
  }
}
