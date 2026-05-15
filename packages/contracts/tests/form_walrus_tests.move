#[test_only]
module form_walrus::form_walrus_tests {
    use sui::test_scenario::{Self, Scenario};
    use std::string;
    use sui::clock;
    use form_walrus::form_registry::{Self, FormRegistry};
    use form_walrus::access_control::{Self, AccessRegistry, AdminCap};

    #[test]
    fun test_create_form() {
        let creator = @0xA;
        let mut scenario_val = test_scenario::begin(creator);
        let scenario = &mut scenario_val;
        
        let mut clock_obj = clock::create_for_testing(test_scenario::ctx(scenario));

        test_scenario::next_tx(scenario, creator);
        {
            // Initialization is called automatically by sui framework normally, we manually call it here
            form_registry::test_init(test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, creator);
        {
            let mut registry = test_scenario::take_shared<FormRegistry>(scenario);
            let schema_blob_id = string::utf8(b"blob123");
            
            let _form_id = form_registry::create_form(
                &mut registry,
                &clock_obj,
                string::utf8(b"My Form"),
                schema_blob_id,
                false,
                test_scenario::ctx(scenario)
            );

            test_scenario::return_shared(registry);
        };

        clock::destroy_for_testing(clock_obj);
        test_scenario::end(scenario_val);
    }
}