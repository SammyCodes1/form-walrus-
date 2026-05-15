module form_walrus::seal_policy {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use std::string::{Self, String};

    // Allowlist object — stored on-chain
    // Controls who can decrypt private form submissions
    public struct Allowlist has key, store {
        id: UID,
        form_id: String,
        creator: address,
        members: Table<address, bool>,
    }

    // Admin capability — held by form creator
    public struct AllowlistAdminCap has key, store {
        id: UID,
        allowlist_id: ID,
    }

    // Create a new allowlist for a private form
    // Creator is automatically added as a member
    public entry fun create_allowlist(
        form_id: String,
        ctx: &mut TxContext
    ) {
        let creator = tx_context::sender(ctx);

        let mut members = table::new<address, bool>(ctx);
        table::add(&mut members, creator, true);

        let allowlist = Allowlist {
            id: object::new(ctx),
            form_id,
            creator,
            members,
        };

        let allowlist_id = object::id(&allowlist);

        let admin_cap = AllowlistAdminCap {
            id: object::new(ctx),
            allowlist_id,
        };

        // Share allowlist so Seal key server can read it
        transfer::share_object(allowlist);

        // Transfer admin cap to creator
        transfer::transfer(admin_cap, creator);
    }

    // Add an address to the allowlist
    // Only holder of AllowlistAdminCap can call this
    public entry fun add_to_allowlist(
        allowlist: &mut Allowlist,
        _cap: &AllowlistAdminCap,
        member: address,
        _ctx: &mut TxContext
    ) {
        if (!table::contains(&allowlist.members, member)) {
            table::add(&mut allowlist.members, member, true);
        }
    }

    // Remove an address from the allowlist
    public entry fun remove_from_allowlist(
        allowlist: &mut Allowlist,
        _cap: &AllowlistAdminCap,
        member: address,
        _ctx: &mut TxContext
    ) {
        if (table::contains(&allowlist.members, member)) {
            table::remove(&mut allowlist.members, member);
        }
    }

    // Check if an address is in the allowlist
    // Called by Seal key server to authorize decryption
    public fun is_member(
        allowlist: &Allowlist,
        member: address
    ): bool {
        table::contains(&allowlist.members, member)
    }

    // Seal entry function — required by Seal protocol
    // Key server calls this to verify access
    public fun seal_approve(
        id: vector<u8>,
        allowlist: &Allowlist,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        assert!(
            is_member(allowlist, caller),
            0 // ENotAuthorized
        );
        let _ = id;
    }

    // Get the allowlist ID for a form
    public fun get_allowlist_id(
        allowlist: &Allowlist
    ): ID {
        object::id(allowlist)
    }
}
