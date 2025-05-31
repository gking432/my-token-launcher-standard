module 0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828::token_launcher {
    use std::signer;
    use std::option;
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::object::{Self, Object, ExtendRef};
    use std::vector;
    use std::string::utf8;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::table;
    use aptos_std::bcs;
    use std::event;
    use aptos_framework::account;

    const MODULE_ADDRESS: address = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    const RESOURCE_ADDRESS: address = @0x9d626293fad28ce43ff320d80b4efc93e75cd5d9033db5dd51432cd405e05ad4;

    const E_TICKER_EXISTS: u64 = 1001;
    const E_INSUFFICIENT_SUPPLY: u64 = 1002;
    const E_METADATA_NOT_FOUND: u64 = 1003;
    const E_STORE_NOT_FOUND: u64 = 1004;
    const E_INSUFFICIENT_APT: u64 = 1005;
    const E_POOL_IMBALANCE: u64 = 1006;
    const E_INSUFFICIENT_LIQUIDITY: u64 = 1007;
    const E_INSUFFICIENT_DEX_LIQUIDITY: u64 = 1008;
    const E_POOL_NOT_FOUND: u64 = 1009;
    const E_NOT_ADMIN: u64 = 1010;
    const E_CONTRIBUTION_TOO_HIGH: u64 = 1011;
    const E_SLIPPAGE_TOO_HIGH: u64 = 1012;
    const E_ZERO_DIVISION: u64 = 1013;
    const E_INSUFFICIENT_APT_OUT: u64 = 100; // Use a unique number not already used by other error codes
    
    const E_INVALID_APT_COST: u64 = 2;


fun pow(base: u64, exp: u64): u64 {
        let result = 1;
        let i = 0;
        while (i < exp) {
            result = result * base;
            i = i + 1;
        };
        result
    }
    #[event]
struct DebugEvent has drop, store { total_apt_spent: u64, price_per_token: u64, tokens_bought: u64, apt_cost: u64 }
    #[event]
    struct TokenCreatedEvent has drop, store {
        creator: address,
        metadata_addr: address,
        ticker: vector<u8>,
        total_supply: u64
    }

    #[event]
    struct TokenPurchaseEvent has drop, store {
        buyer: address,
        metadata_addr: address,
        amount: u64,
        price: u64,
        liquidity_contribution: u64
    }

    struct ModuleState has key {
    token_metadata: table::Table<address, TokenMetadata>,
    liquidity_pools: table::Table<vector<u8>, LiquidityPool>,
    dex_pools: table::Table<vector<u8>, DexPool>,
    liquidity_contribution_bps: u64,
    extend_ref: ExtendRef,
    resource_signer_cap: account::SignerCapability, // Added
    apt_amount: u64
}

    struct TokenCounter has key {
        count: u64,
    }

    struct Vault has key {
        metadata: Object<Metadata>,
        total_supply: u64,
        remaining_supply: u64,
        price_per_token: u64
    }

    struct VaultState has key {
        creator: address,
        is_listed: bool
    }

    struct TokenStore has key {
        store: Object<fungible_asset::FungibleStore>
    }

    struct TokenStoreEntry has store {
        metadata_addr: address,
        store: Object<fungible_asset::FungibleStore>
    }

    struct BuyerStore has key {
        stores: vector<TokenStoreEntry>
    }

    struct TokenVault has key {
        extend_ref: ExtendRef,
        mint_ref: fungible_asset::MintRef,
        burn_ref: fungible_asset::BurnRef,
        metadata: Object<Metadata>,
        total_supply: u64,
        remaining_supply: u64,
        price_per_token: u64,
        total_apt_spent: u64
    }

    struct TokenMetadataEntry has store {
        original_name: vector<u8>,
        ticker: vector<u8>,
        image: vector<u8>,
        metadata_addr: address
    }

    struct TokenMetadata has key, store {
        entries: vector<TokenMetadataEntry>,
        market_cap: u64
    }

    struct LiquidityPool has key, store {
        token_metadata: Object<Metadata>,
        token_store: Object<fungible_asset::FungibleStore>,
        apt_amount: u64,
        token_b_metadata: Object<Metadata>,
        token_b_store: Object<fungible_asset::FungibleStore>,
        token_b_amount: u64
    }

    struct DexPool has key, store {
        token_metadata: Object<Metadata>,
        token_store: Object<fungible_asset::FungibleStore>,
        apt_amount: u64,
        token_b_metadata: Object<Metadata>,
        token_b_store: Object<fungible_asset::FungibleStore>,
        token_b_amount: u64
    }

    fun create_pool_key(creator_addr: address, ticker: vector<u8>): vector<u8> {
        let key = bcs::to_bytes(&creator_addr);
        vector::append(&mut key, ticker);
        key
    }

    fun calculate_price(total_apt_spent: u64): u64 {
    let x = (total_apt_spent as u128) / 100_000_000; // Whole APT
    let denominator = 11_570_000_000_000_u128; // 1.157 * 10^13
    let base = 21_u128; // 21 whole APT
    let numerator = (base + x) * (base + x); // (21 + x)^2
    let price_per_token = (numerator * 100_000_000) / denominator; // APT units per token unit
    if (price_per_token == 0) { price_per_token = 4 }; // Round up to 3.81
    (price_per_token as u64)
}

    fun get_or_create_token_store(
        owner: &signer,
        metadata: Object<Metadata>
    ): Object<fungible_asset::FungibleStore> acquires BuyerStore {
        let owner_addr = signer::address_of(owner);
        let metadata_addr = object::object_address(&metadata);
        if (exists<BuyerStore>(owner_addr)) {
            let buyer_store = borrow_global_mut<BuyerStore>(owner_addr);
            let i = 0;
            let len = vector::length(&buyer_store.stores);
            while (i < len) {
                let entry = vector::borrow(&buyer_store.stores, i);
                if (entry.metadata_addr == metadata_addr) {
                    return entry.store
                };
                i = i + 1;
            };
            let store_constructor = object::create_object(owner_addr);
            let new_store = fungible_asset::create_store(&store_constructor, metadata);
            vector::push_back(&mut buyer_store.stores, TokenStoreEntry {
                metadata_addr,
                store: new_store
            });
            new_store
        } else {
            let store_constructor = object::create_object(owner_addr);
            let new_store = fungible_asset::create_store(&store_constructor, metadata);
            let stores = vector::empty<TokenStoreEntry>();
            vector::push_back(&mut stores, TokenStoreEntry {
                metadata_addr,
                store: new_store
            });
            move_to(owner, BuyerStore { stores });
            new_store
        }
    }




public entry fun register_resource_account(admin: &signer) {
    let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    let resource_addr = account::create_resource_address(&module_addr, b"token_launcher");
    if (!coin::is_account_registered<AptosCoin>(resource_addr)) {
        coin::register<AptosCoin>(admin); // Admin registers it
    };
}



public entry fun initialize(admin: &signer) {
    let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    if (!exists<ModuleState>(module_addr)) {
        let (resource_signer, resource_signer_cap) = account::create_resource_account(admin, b"token_launcher");
        let resource_addr = signer::address_of(&resource_signer);
        if (!coin::is_account_registered<AptosCoin>(resource_addr)) {
            coin::register<AptosCoin>(&resource_signer);
        };
        move_to(admin, ModuleState {
            token_metadata: table::new(),
            liquidity_pools: table::new(),
            dex_pools: table::new(),
            liquidity_contribution_bps: 1000,
            extend_ref: object::generate_extend_ref(&object::create_object(resource_addr)),
            resource_signer_cap,
            apt_amount: 0
        });
    };
    if (!exists<TokenCounter>(module_addr)) {
        move_to(admin, TokenCounter { count: 0 });
    };
}


    public entry fun update_liquidity_contribution(
        admin: &signer,
        new_contribution_bps: u64
    ) acquires ModuleState {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828, E_NOT_ADMIN);
        let module_state = borrow_global_mut<ModuleState>(@0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828);
        assert!(new_contribution_bps <= 3000, E_CONTRIBUTION_TOO_HIGH);
        module_state.liquidity_contribution_bps = new_contribution_bps;
    }

    public entry fun pre_initialize_vault(_account: &signer, _ticker: vector<u8>) {
    }

    public entry fun create_token(
    creator: &signer,
    name: vector<u8>,
    ticker: vector<u8>,
    decimals: u8,
    total_supply: u64
) acquires ModuleState, TokenCounter {
    let creator_addr = signer::address_of(creator);
    let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let counter = borrow_global_mut<TokenCounter>(module_addr);
    counter.count = counter.count + 1;

    // Check for ticker conflict
    if (table::contains(&state.token_metadata, creator_addr)) {
        let token_metadata = table::borrow(&state.token_metadata, creator_addr);
        let i = 0;
        let len = vector::length(&token_metadata.entries);
        while (i < len) {
            let entry = vector::borrow(&token_metadata.entries, i);
            if (entry.ticker == ticker) {
                abort E_TICKER_EXISTS
            };
            i = i + 1;
        };
    };

    // Scale total_supply by 10^decimals to account for smallest units
    let decimals_factor = pow(10, decimals as u64);
    let scaled_total_supply = total_supply * decimals_factor;

    let token_constructor = object::create_named_object(creator, ticker);
    fungible_asset::add_fungibility(
        &token_constructor,
        option::some((scaled_total_supply as u128)),
        utf8(name),
        utf8(ticker),
        decimals,
        utf8(b"http://example.com/icon.png"),
        utf8(b"http://example.com")
    );

    let metadata = object::object_from_constructor_ref<Metadata>(&token_constructor);
    let metadata_addr = object::object_address(&metadata);
    let extend_ref = object::generate_extend_ref(&token_constructor);
    
    let mint_ref = fungible_asset::generate_mint_ref(&token_constructor);
    let burn_ref = fungible_asset::generate_burn_ref(&token_constructor);
    let module_signer = object::generate_signer_for_extending(&state.extend_ref);
    let dex_store_constructor = object::create_object(module_addr);
    let dex_reserve_store = fungible_asset::create_store(&dex_store_constructor, metadata);
    
    // Set 200M preminted, 800M remaining
    let scaled_premint_amount = 200000000 * decimals_factor;
    let scaled_remaining_supply = 800000000 * decimals_factor;
    fungible_asset::mint_to(&mint_ref, dex_reserve_store, scaled_premint_amount);

    let metadata_signer = object::generate_signer_for_extending(&extend_ref);
    move_to(&metadata_signer, TokenVault {
        extend_ref,
        mint_ref,
        burn_ref,
        metadata,
        total_supply: scaled_total_supply,
        remaining_supply: scaled_remaining_supply,
        price_per_token: 10000,
        total_apt_spent: 0
    });
    move_to(&metadata_signer, VaultState {
        creator: creator_addr,
        is_listed: true
    });

    let metadata_entry = TokenMetadataEntry {
        original_name: name,
        ticker,
        image: vector::empty<u8>(),
        metadata_addr
    };
    if (!table::contains(&state.token_metadata, creator_addr)) {
        table::add(&mut state.token_metadata, creator_addr, TokenMetadata {
            entries: vector[metadata_entry],
            market_cap: 0
        });
    } else {
        let creator_metadata = table::borrow_mut(&mut state.token_metadata, creator_addr);
        vector::push_back(&mut creator_metadata.entries, metadata_entry);
    };
    event::emit(TokenCreatedEvent {
        creator: creator_addr,
        metadata_addr,
        ticker,
        total_supply
    });
}

    public entry fun initialize_vault(
        creator: &signer,
        name: vector<u8>,
        ticker: vector<u8>,
        decimals: u8,
        total_supply: u64
    ) acquires ModuleState, TokenCounter {
        create_token(creator, name, ticker, decimals, total_supply);
    }

    public entry fun buy_tokens(
    buyer: &signer,
    creator_addr: address,
    ticker: vector<u8>,
    amount: u64 // Tokens in smallest units
) acquires ModuleState, TokenVault, BuyerStore {
    let buyer_addr = signer::address_of(buyer);
    let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = @0x9d626293fad28ce43ff320d80b4efc93e75cd5d9033db5dd51432cd405e05ad4;
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    let vault = borrow_global_mut<TokenVault>(metadata_addr);

    let tokens_bought = amount;
    assert!(vault.remaining_supply >= tokens_bought, E_INSUFFICIENT_SUPPLY);

    // Calculate APT cost
    let price_per_token = calculate_price(vault.total_apt_spent);
    let apt_cost = ((price_per_token as u128) * (tokens_bought as u128) / 100_000_000) as u64;
    assert!(apt_cost > 0, E_INVALID_APT_COST); // Ensure cost isnt 0

    // Debug event
    event::emit(DebugEvent { total_apt_spent: vault.total_apt_spent, price_per_token, tokens_bought, apt_cost });

    // Transfer APT to resource_addr
    coin::transfer<AptosCoin>(buyer, resource_addr, apt_cost);

    // Update vault
    vault.total_apt_spent = vault.total_apt_spent + apt_cost;
    vault.remaining_supply = vault.remaining_supply - tokens_bought;
    vault.price_per_token = calculate_price(vault.total_apt_spent); // Update price

    // Initialize BuyerStore if needed
    if (!exists<BuyerStore>(buyer_addr)) {
        move_to(buyer, BuyerStore { stores: vector::empty() });
    };

    // Mint tokens to buyer
    let buyer_store = get_or_create_token_store(buyer, vault.metadata);
    fungible_asset::mint_to(&vault.mint_ref, buyer_store, tokens_bought);

    // Update market cap
    let token_metadata_mut = table::borrow_mut(&mut state.token_metadata, creator_addr);
    token_metadata_mut.market_cap = (vault.total_supply - vault.remaining_supply) * vault.price_per_token;

    // Emit event
    event::emit(TokenPurchaseEvent {
        buyer: buyer_addr,
        metadata_addr,
        amount: tokens_bought,
        price: vault.price_per_token,
        liquidity_contribution: apt_cost
    });
}

public entry fun sell_tokens(
    seller: &signer,
    creator_addr: address,
    ticker: vector<u8>,
    amount: u64
) acquires ModuleState, TokenVault, BuyerStore {
    let seller_addr = signer::address_of(seller);
    let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = @0x9d626293fad28ce43ff320d80b4efc93e75cd5d9033db5dd51432cd405e05ad4;
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    let vault = borrow_global_mut<TokenVault>(metadata_addr);

    // Check seller's balance
    let seller_store = get_or_create_token_store(seller, vault.metadata);
    assert!(fungible_asset::balance(seller_store) >= amount, E_INSUFFICIENT_LIQUIDITY);

// Calculate tokens left before the sale
let x_before = vault.total_apt_spent as u128;
let denominator_before = 21 + x_before;
let numerator = 16_800_000_000_u128; // 16,800,000,000
let y_before = numerator / denominator_before;

    // Add tokens back to the pool
    vault.remaining_supply = vault.remaining_supply + amount;

// Calculate the APT to give back
let y_after = (y_before + (amount as u128)) as u128;
let temp = 16_800_000_000_u128 - y_after;
let x_after = if (temp > 0) {
    (numerator / temp) - 21
} else {
    0
};
let apt_out = if ((vault.total_apt_spent as u128) > x_after) {
    ((vault.total_apt_spent as u128) - x_after) as u64
} else {
    0
};
assert!(apt_out > 0, E_INSUFFICIENT_APT_OUT);

    // Check if there's enough APT to pay the seller
    let actual_balance = coin::balance<AptosCoin>(resource_addr);
    state.apt_amount = actual_balance;
    assert!(state.apt_amount >= apt_out, E_INSUFFICIENT_APT);

    // Burn tokens from the seller
    fungible_asset::burn_from(&vault.burn_ref, seller_store, amount);

    // Subtract APT from total_apt_spent
    vault.total_apt_spent = vault.total_apt_spent - apt_out;

    // Transfer APT to the seller
    let resource_signer = account::create_signer_with_capability(&state.resource_signer_cap);
    coin::transfer<AptosCoin>(&resource_signer, seller_addr, apt_out);
    state.apt_amount = state.apt_amount - apt_out;

    // Update price per token
    vault.price_per_token = calculate_price(vault.total_apt_spent);

    // Update market cap (placeholder for now)
    let token_metadata_mut = table::borrow_mut(&mut state.token_metadata, creator_addr);
    let tokens_sold_whole = (vault.total_supply - vault.remaining_supply);
    token_metadata_mut.market_cap = (tokens_sold_whole * vault.price_per_token);
}

     

   

public entry fun withdraw_apt(admin: &signer, amount: u64) acquires ModuleState {
    let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
    let admin_addr = signer::address_of(admin);
    assert!(admin_addr == module_addr, E_NOT_ADMIN);
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = object::address_from_extend_ref(&state.extend_ref); // Get resource account address
    assert!(state.apt_amount >= amount, E_INSUFFICIENT_APT);
    let actual_balance = coin::balance<AptosCoin>(resource_addr); // Check resource account balance
    assert!(actual_balance >= amount, E_INSUFFICIENT_APT);
    let module_signer = object::generate_signer_for_extending(&state.extend_ref);
    coin::transfer<AptosCoin>(&module_signer, admin_addr, amount); // Withdraw from resource account to admin
    state.apt_amount = state.apt_amount - amount;
}

    public entry fun create_liquidity_pool(
        creator: &signer,
        token_a_ticker: vector<u8>,
        token_b_ticker: vector<u8>,
        token_a_amount: u64,
        token_b_amount: u64
    ) acquires ModuleState, BuyerStore {
        let creator_addr = signer::address_of(creator);
        let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
        let state = borrow_global_mut<ModuleState>(module_addr);
        let token_metadata = table::borrow(&state.token_metadata, creator_addr);

        let token_a_metadata_addr = find_metadata_addr(&token_metadata.entries, token_a_ticker);
        let token_b_metadata_addr = find_metadata_addr(&token_metadata.entries, token_b_ticker);
        let token_a_metadata = object::address_to_object<Metadata>(token_a_metadata_addr);
        let token_b_metadata = object::address_to_object<Metadata>(token_b_metadata_addr);

        if (!exists<BuyerStore>(creator_addr)) {
            move_to(creator, BuyerStore { stores: vector::empty<TokenStoreEntry>() });
        };
        let _buyer_store = borrow_global_mut<BuyerStore>(creator_addr);

        let token_a_store = get_or_create_token_store(creator, token_a_metadata);
        let token_b_store = get_or_create_token_store(creator, token_b_metadata);
        let token_a_pool_store = get_or_create_token_store(creator, token_a_metadata);
        let token_b_pool_store = get_or_create_token_store(creator, token_b_metadata);

        assert!(fungible_asset::balance(token_a_store) >= token_a_amount, E_INSUFFICIENT_LIQUIDITY);
        assert!(fungible_asset::balance(token_b_store) >= token_b_amount, E_INSUFFICIENT_LIQUIDITY);

        fungible_asset::transfer(creator, token_a_store, token_a_pool_store, token_a_amount);
        fungible_asset::transfer(creator, token_b_store, token_b_pool_store, token_b_amount);

        let pool_key = create_pool_key(creator_addr, token_a_ticker);
        table::add(&mut state.liquidity_pools, pool_key, LiquidityPool {
            token_metadata: token_a_metadata,
            token_store: token_a_pool_store,
            apt_amount: 0,
            token_b_metadata: token_b_metadata,
            token_b_store: token_b_pool_store,
            token_b_amount: token_b_amount
        });
    }

    fun internal_swap<CoinType>(
        trader: &signer,
        creator_addr: address,
        ticker: vector<u8>,
        input_amount: u64,
        min_output_amount: u64,
        is_token_to_coin: bool
    ) acquires ModuleState, BuyerStore {
        let trader_addr = signer::address_of(trader);
        let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
        let state = borrow_global_mut<ModuleState>(module_addr);
        let token_metadata = table::borrow(&state.token_metadata, creator_addr);
        let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);

        let pool_key = create_pool_key(creator_addr, ticker);

        let is_liquidity_pool = table::contains(&state.liquidity_pools, pool_key);
        let is_dex_pool = table::contains(&state.dex_pools, pool_key);
        assert!(is_liquidity_pool || is_dex_pool, E_POOL_NOT_FOUND);

        let output_amount: u128;
        let trader_store: Object<fungible_asset::FungibleStore>;

        if (is_liquidity_pool) {
            let pool = table::borrow_mut(&mut state.liquidity_pools, pool_key);
            assert!(object::object_address(&pool.token_metadata) == metadata_addr, E_METADATA_NOT_FOUND);

            if (is_token_to_coin) {
                let token_balance = fungible_asset::balance(pool.token_store);
                let apt_balance = pool.apt_amount;
                assert!(token_balance > 0 && apt_balance > 0, E_ZERO_DIVISION);
                let k = (token_balance as u128) * (apt_balance as u128);
                let new_token_balance = (token_balance as u128) + (input_amount as u128);
                assert!(new_token_balance > 0, E_ZERO_DIVISION);
                let new_apt_balance = k / new_token_balance;
                output_amount = (apt_balance as u128) - new_apt_balance;

                assert!(output_amount >= (min_output_amount as u128), E_SLIPPAGE_TOO_HIGH);

                trader_store = get_or_create_token_store(trader, pool.token_metadata);

                fungible_asset::transfer(trader, trader_store, pool.token_store, input_amount);

                pool.apt_amount = (new_apt_balance as u64);
                pool.token_b_amount = new_token_balance as u64;

                coin::transfer<AptosCoin>(trader, trader_addr, (output_amount as u64));
            } else {
                let token_balance = fungible_asset::balance(pool.token_store);
                let apt_balance = pool.apt_amount;
                assert!(token_balance > 0 && apt_balance > 0, E_ZERO_DIVISION);
                let k = (token_balance as u128) * (apt_balance as u128);
                let new_apt_balance = (apt_balance as u128) + (input_amount as u128);
                assert!(new_apt_balance > 0, E_ZERO_DIVISION);
                let new_token_balance = k / new_apt_balance;
                output_amount = (token_balance as u128) - new_token_balance;

                assert!(output_amount >= (min_output_amount as u128), E_SLIPPAGE_TOO_HIGH);

                trader_store = get_or_create_token_store(trader, pool.token_metadata);

                pool.apt_amount = (new_apt_balance as u64);
                pool.token_b_amount = new_token_balance as u64;

                fungible_asset::transfer(trader, pool.token_store, trader_store, (output_amount as u64));
            }
        } else {
            let pool = table::borrow_mut(&mut state.dex_pools, pool_key);
            assert!(object::object_address(&pool.token_metadata) == metadata_addr, E_METADATA_NOT_FOUND);

            if (is_token_to_coin) {
                let token_balance = fungible_asset::balance(pool.token_store);
                let apt_balance = pool.apt_amount;
                assert!(token_balance > 0 && apt_balance > 0, E_ZERO_DIVISION);
                let k = (token_balance as u128) * (apt_balance as u128);
                let new_token_balance = (token_balance as u128) + (input_amount as u128);
                assert!(new_token_balance > 0, E_ZERO_DIVISION);
                let new_apt_balance = k / new_token_balance;
                output_amount = (apt_balance as u128) - new_apt_balance;

                assert!(output_amount >= (min_output_amount as u128), E_SLIPPAGE_TOO_HIGH);

                trader_store = get_or_create_token_store(trader, pool.token_metadata);

                fungible_asset::transfer(trader, trader_store, pool.token_store, input_amount);

                pool.apt_amount = (new_apt_balance as u64);
                pool.token_b_amount = new_token_balance as u64;

                coin::transfer<AptosCoin>(trader, trader_addr, (output_amount as u64));
            } else {
                let token_balance = fungible_asset::balance(pool.token_store);
                let apt_balance = pool.apt_amount;
                assert!(token_balance > 0 && apt_balance > 0, E_ZERO_DIVISION);
                let k = (token_balance as u128) * (apt_balance as u128);
                let new_apt_balance = (apt_balance as u128) + (input_amount as u128);
                assert!(new_apt_balance > 0, E_ZERO_DIVISION);
                let new_token_balance = k / new_apt_balance;
                output_amount = (token_balance as u128) - new_token_balance;

                assert!(output_amount >= (min_output_amount as u128), E_SLIPPAGE_TOO_HIGH);

                trader_store = get_or_create_token_store(trader, pool.token_metadata);

                pool.apt_amount = (new_apt_balance as u64);
                pool.token_b_amount = new_token_balance as u64;

                fungible_asset::transfer(trader, pool.token_store, trader_store, (output_amount as u64));
            }
        };

        if (!exists<BuyerStore>(trader_addr)) {
            let stores = vector::empty<TokenStoreEntry>();
            vector::push_back(&mut stores, TokenStoreEntry {
                metadata_addr,
                store: trader_store
            });
            move_to(trader, BuyerStore { stores });
        } else {
            let buyer_store_ref = borrow_global_mut<BuyerStore>(trader_addr);
            let i = 0;
            let len = vector::length(&buyer_store_ref.stores);
            let found = false;
            while (i < len) {
                let entry = vector::borrow_mut(&mut buyer_store_ref.stores, i);
                if (entry.metadata_addr == metadata_addr) {
                    entry.store = trader_store;
                    found = true;
                    break;
                };
                i = i + 1;
            };
            if (!found) {
                vector::push_back(&mut buyer_store_ref.stores, TokenStoreEntry {
                    metadata_addr,
                    store: trader_store
                });
            };
        };
    }

    public entry fun swap_token_a_for_token_b(
        trader: &signer,
        creator_addr: address,
        ticker: vector<u8>,
        amount: u64,
        min_output: u64
    ) acquires ModuleState, BuyerStore {
        internal_swap<AptosCoin>(trader, creator_addr, ticker, amount, min_output, true);
    }

    public entry fun swap_token_b_for_token_a(
        trader: &signer,
        creator_addr: address,
        ticker: vector<u8>,
        amount: u64,
        min_output: u64
    ) acquires ModuleState, BuyerStore {
        internal_swap<AptosCoin>(trader, creator_addr, ticker, amount, min_output, false);
    }

    public entry fun migrate_to_dex(
        creator: &signer,
        ticker: vector<u8>
    ) acquires ModuleState, TokenVault, BuyerStore {
        let creator_addr = signer::address_of(creator);
        let module_addr = @0xe331209a8a9645b3b843edf492187e75056eabd5f480970cf5138020924c9828;
        let state = borrow_global_mut<ModuleState>(module_addr);
        let token_metadata = table::borrow(&state.token_metadata, creator_addr);
        let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
        let vault = borrow_global_mut<TokenVault>(metadata_addr);

        let pool_key = create_pool_key(creator_addr, ticker);
        assert!(table::contains(&state.liquidity_pools, pool_key), E_POOL_NOT_FOUND);
        let pool = table::borrow(&state.liquidity_pools, pool_key);
        assert!(pool.apt_amount >= 1000000, E_INSUFFICIENT_LIQUIDITY);

        let token_metadata_value = pool.token_metadata;
        let apt_amount_value = pool.apt_amount + state.apt_amount; // Use ModuleState APT
        let old_token_store = pool.token_store;
        let old_token_b_store = pool.token_b_store;
        let token_b_metadata_value = pool.token_b_metadata;
        let token_b_amount_value = pool.token_b_amount;

        let dex_token_store = get_or_create_token_store(creator, token_metadata_value);
        let dex_token_b_store = get_or_create_token_store(creator, token_b_metadata_value);

        let vault_signer = object::generate_signer_for_extending(&vault.extend_ref);
        fungible_asset::mint_to(&vault.mint_ref, dex_token_store, vault.remaining_supply); // Mint remaining to DEX
        coin::transfer<AptosCoin>(&vault_signer, module_addr, state.apt_amount);

        let balance = fungible_asset::balance(old_token_store);
        if (balance > 0) {
            fungible_asset::transfer(creator, old_token_store, dex_token_store, balance);
        };

        let b_balance = fungible_asset::balance(old_token_b_store);
        if (b_balance > 0) {
            fungible_asset::transfer(creator, old_token_b_store, dex_token_b_store, b_balance);
        };

        let removed_pool = table::remove(&mut state.liquidity_pools, pool_key);
        let LiquidityPool { token_metadata: _, token_store: _, apt_amount: _, token_b_metadata: _, token_b_store: _, token_b_amount: _ } = removed_pool;

        table::add(&mut state.dex_pools, pool_key, DexPool {
            token_metadata: token_metadata_value,
            token_store: dex_token_store,
            apt_amount: apt_amount_value,
            token_b_metadata: token_b_metadata_value,
            token_b_store: dex_token_b_store,
            token_b_amount: token_b_amount_value
        });
    }

    fun find_metadata_addr(entries: &vector<TokenMetadataEntry>, ticker: vector<u8>): address {
        let i = 0;
        let len = vector::length(entries);
        while (i < len) {
            let entry = vector::borrow(entries, i);
            if (entry.ticker == ticker) {
                return entry.metadata_addr
            };
            i = i + 1;
        };
        abort E_METADATA_NOT_FOUND
    }

    fun find_store(stores: &vector<TokenStoreEntry>, metadata_addr: address): Object<fungible_asset::FungibleStore> {
        let i = 0;
        let len = vector::length(stores);
        while (i < len) {
            let entry = vector::borrow(stores, i);
            if (entry.metadata_addr == metadata_addr) {
                return entry.store
            };
            i = i + 1;
        };
        abort E_STORE_NOT_FOUND
    }


#[view]
public fun get_resource_info(): (address, bool) {
    let resource_addr = account::create_resource_address(&@0x9d626293fad28ce43ff320d80b4efc93e75cd5d9033db5dd51432cd405e05ad4, b"token_launcher");
    (resource_addr, coin::is_account_registered<AptosCoin>(resource_addr))
}
}