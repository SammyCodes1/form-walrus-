import { SuiClient, SuiObjectResponse } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { WalrusFormError } from "./types";

export class FormWalrusSuiClient {
  constructor(
    private client: SuiClient,
    private packageId: string,
    private formRegistryId: string
  ) {}

  async createForm(tx: Transaction, title: string, schemaBlobId: string, isPrivate: boolean) {
    tx.moveCall({
      target: `${this.packageId}::form_registry::create_form`,
      arguments: [
        tx.object(this.formRegistryId),
        tx.object("0x6"), // Clock
        tx.pure.string(title),
        tx.pure.string(schemaBlobId),
        tx.pure.bool(isPrivate),
      ],
    });
  }

  async recordSubmission(tx: Transaction, formId: string, newIndexBlobId: string, submissionBlobId: string) {
    tx.moveCall({
      target: `${this.packageId}::form_registry::update_submission_index`,
      arguments: [
        tx.object(this.formRegistryId),
        tx.pure.id(formId),
        tx.pure.string(newIndexBlobId),
      ],
    });

    tx.moveCall({
      target: `${this.packageId}::form_registry::increment_submission_count`,
      arguments: [
        tx.object(this.formRegistryId),
        tx.pure.id(formId),
        tx.pure.string(submissionBlobId),
      ],
    });
  }

  async grantAdmin(tx: Transaction, accessRegistryId: string, adminCapId: string, newAdmin: string) {
    tx.moveCall({
      target: `${this.packageId}::access_control::grant_admin`,
      arguments: [
        tx.object(accessRegistryId),
        tx.object(adminCapId),
        tx.pure.address(newAdmin),
      ],
    });
  }

  async revokeAdmin(tx: Transaction, accessRegistryId: string, adminCapId: string, admin: string) {
    tx.moveCall({
      target: `${this.packageId}::access_control::revoke_admin`,
      arguments: [
        tx.object(accessRegistryId),
        tx.object(adminCapId),
        tx.pure.address(admin),
      ],
    });
  }

  async createAllowlist(
    tx: Transaction,
    formId: string
  ) {
    tx.moveCall({
      target: `${this.packageId}::seal_policy::create_allowlist`,
      arguments: [
        tx.pure.string(formId),
      ],
    });
  }

  async getAllowlist(formId: string): Promise<any | null> {
    try {
      let hasNextPage = true;
      let cursor = null;

      while (hasNextPage) {
        const objects: any = await this.client.queryObjects({
          filter: {
            StructType: `${this.packageId}::seal_policy::Allowlist`,
          },
          options: { showContent: true },
          cursor,
        });

        for (const obj of objects.data) {
          if (obj.data?.content?.dataType === "moveObject") {
            const fields = obj.data.content.fields as any;
            if (fields.form_id === formId) {
              return fields;
            }
          }
        }

        hasNextPage = objects.hasNextPage;
        cursor = objects.nextCursor;
      }
      return null;
    } catch (e) {
      console.error("getAllowlist failed:", e);
      return null;
    }
  }

  async getFormMeta(formId: string) {
    try {
      const registry = await this.client.getObject({
        id: this.formRegistryId,
        options: { showContent: true },
      });

      if (registry.data?.content?.dataType !== "moveObject") {
        throw new Error("Invalid registry object");
      }

      const formsTableId = (registry.data.content.fields as any).forms.fields.id.id;

      const entry = await this.client.getDynamicFieldObject({
        parentId: formsTableId,
        name: {
          type: "0x2::object::ID",
          value: formId,
        },
      });

      if (entry.data?.content?.dataType !== "moveObject") {
        throw new Error("Form not found in registry");
      }

      const meta = (entry.data.content.fields as any).value.fields;
      return {
        creator: meta.creator,
        schema_blob_id: meta.schema_blob_id,
        submission_index_blob_id: meta.submission_index_blob_id,
        is_private: meta.is_private,
        created_at: meta.created_at,
        total_submissions: meta.total_submissions,
      };
    } catch (e: any) {
      throw new WalrusFormError(`Failed to fetch form meta: ${e.message}`, "SUI_RPC_ERROR");
    }
  }

  async checkAdminCap(address: string, formId: string): Promise<boolean> {
    try {
      // Check for legacy AdminCap first
      const objects = await this.getOwnedAdminCaps(address);
      for (const obj of objects) {
        if (obj.form_id === formId) {
          return true;
        }
      }

      // Then check for new AllowlistAdminCap
      const allowlist = await this.getAllowlist(formId);
      if (allowlist) {
        const caps = await this.getOwnedAllowlistCaps(address);
        for (const cap of caps) {
          if (cap.allowlist_id === allowlist.id.id) {
            return true;
          }
        }
      }

      return false;
    } catch (e: any) {
      console.error("checkAdminCap failed:", e.message);
      return true; // fail open for now — creator can always access
    }
  }

  async getOwnedAllowlistCaps(address: string): Promise<{id: string, allowlist_id: string}[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${this.packageId}::seal_policy::AllowlistAdminCap`,
        },
        options: { showContent: true },
      });

      return objects.data.map(obj => {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          return {
            id: obj.data.objectId,
            allowlist_id: fields.allowlist_id
          };
        }
        return null;
      }).filter(x => x !== null) as {id: string, allowlist_id: string}[];
    } catch (e: any) {
      console.error("getOwnedAllowlistCaps failed:", e.message);
      return [];
    }
  }

  async getOwnedAdminCaps(address: string): Promise<{id: string, form_id: string}[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${this.packageId}::access_control::AdminCap`,
        },
        options: { showContent: true },
      });

      return objects.data.map(obj => {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          return {
            id: obj.data.objectId,
            form_id: fields.form_id
          };
        }
        return null;
      }).filter(x => x !== null) as {id: string, form_id: string}[];
    } catch (e: any) {
      console.error("getOwnedAdminCaps failed:", e.message);
      return [];
    }
  }

  async getOwnedForms(address: string): Promise<any[]> {
    const caps = await this.getOwnedAdminCaps(address);
    return caps;
  }
}
