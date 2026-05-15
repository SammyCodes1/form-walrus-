module form_walrus::access_control {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};

    public struct AdminCap has key, store {
        id: UID,
        form_id: ID,
    }

    public fun form_id(cap: &AdminCap): ID {
        cap.form_id
    }

    public struct AccessRegistry has key {
        id: UID,
        form_id: ID,
        admins: Table<address, bool>,
    }

    public(package) fun create_admin_cap(form_id: ID, creator: address, ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
            form_id,
        };
        
        let mut registry = AccessRegistry {
            id: object::new(ctx),
            form_id,
            admins: table::new(ctx),
        };

        table::add(&mut registry.admins, creator, true);

        transfer::transfer(admin_cap, creator);
        transfer::share_object(registry);
    }

    public fun grant_admin(registry: &mut AccessRegistry, _cap: &AdminCap, new_admin: address) {
        assert!(registry.form_id == _cap.form_id, 0);
        if (!table::contains(&registry.admins, new_admin)) {
            table::add(&mut registry.admins, new_admin, true);
        };
    }

    public fun revoke_admin(registry: &mut AccessRegistry, _cap: &AdminCap, admin: address) {
        assert!(registry.form_id == _cap.form_id, 0);
        if (table::contains(&registry.admins, admin)) {
            table::remove(&mut registry.admins, admin);
        };
    }

    public fun is_authorized(registry: &AccessRegistry, addr: address): bool {
        table::contains(&registry.admins, addr)
    }
}