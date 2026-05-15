module form_walrus::form_registry {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use std::string::String;
    use form_walrus::access_control;

    public struct FormMeta has store {
        id: ID,
        creator: address,
        schema_blob_id: String,
        submission_index_blob_id: String,
        is_private: bool,
        created_at: u64,
        total_submissions: u64,
    }

    public struct FormRegistry has key {
        id: UID,
        forms: Table<ID, FormMeta>,
    }

    public struct FormCreated has copy, drop {
        form_id: ID,
        creator: address,
        schema_blob_id: String,
    }

    public struct SubmissionRecorded has copy, drop {
        form_id: ID,
        blob_id: String,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(FormRegistry {
            id: object::new(ctx),
            forms: table::new(ctx),
        });
    }

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx)
    }

    public fun create_form(
        registry: &mut FormRegistry,
        clock: &Clock,
        title: String,
        schema_blob_id: String,
        is_private: bool,
        ctx: &mut TxContext
    ): ID {
        let form_uid = object::new(ctx);
        let form_id = object::uid_to_inner(&form_uid);
        let creator = tx_context::sender(ctx);

        let meta = FormMeta {
            id: form_id,
            creator,
            schema_blob_id: schema_blob_id,
            submission_index_blob_id: std::string::utf8(b""), // Empty initially
            is_private,
            created_at: clock::timestamp_ms(clock),
            total_submissions: 0,
        };

        table::add(&mut registry.forms, form_id, meta);

        access_control::create_admin_cap(form_id, creator, ctx);

        sui::event::emit(FormCreated {
            form_id,
            creator,
            schema_blob_id,
        });

        object::delete(form_uid);
        form_id
    }

    public fun update_submission_index(
        registry: &mut FormRegistry,
        form_id: ID,
        new_blob_id: String
    ) {
        let meta = table::borrow_mut(&mut registry.forms, form_id);
        meta.submission_index_blob_id = new_blob_id;
    }

    public fun increment_submission_count(
        registry: &mut FormRegistry,
        form_id: ID,
        submission_blob_id: String
    ) {
        let meta = table::borrow_mut(&mut registry.forms, form_id);
        meta.total_submissions = meta.total_submissions + 1;

        sui::event::emit(SubmissionRecorded {
            form_id,
            blob_id: submission_blob_id,
        });
    }

    public fun get_form_meta(registry: &FormRegistry, form_id: ID): (address, String, String, bool, u64, u64) {
        let meta = table::borrow(&registry.forms, form_id);
        (
            meta.creator,
            meta.schema_blob_id,
            meta.submission_index_blob_id,
            meta.is_private,
            meta.created_at,
            meta.total_submissions
        )
    }
}