module 0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090::token_launcher {
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
 
    use aptos_framework::account;
    use aptos_framework::timestamp;
   
   use aptos_framework::event;

#[event]
struct DebugState has copy, drop, store {
    total_supply: u64,      // Match vault field type
    remaining_supply: u64,  // Match vault field type
    diff: u64,             // Match vault subtraction result
}
const E_PRICE_MISMATCH: u64 = 1014; // Use a unique number not used by other error codes
    const MODULE_ADDRESS: address = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
    const RESOURCE_ADDRESS: address = @0xe90527b3338636942c64a3facfea7bcc826b1c8a8ad02092f5d93644c45c7d7d;
const E_PREMINT_FAILED: u64 = 110; // Choose a unique number not used by other error codes
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
    const E_EXCEEDS_MAX_SALE: u64 = 3;
    const E_INVALID_APT_COST: u64 = 2;
    const E_INVALID_VAULT_STATE: u64 = 4;
    const E_INVALID_TOKEN_SOLD: u64 = 10110;
    const E_INVALID_COST: u64 = 11204; // Use a unique error code
const E_EXCEEDS_SUPPLY: u64 = 101223;    
const E_SLIPPAGE_EXCEEDED: u64 = 1015;
const E_INVALID_EXPECTED_PRICE: u64 = 1016;
const E_INVALID_SLIPPAGE: u64 = 1017;
const MAX_RETRIES: u64 = 3;

// Price calculation constants
const SCALE: u128 = 100_000_000u128; // 10^8 for Octas
const PRICE_NUMERATOR: u128 = 19_029_514_756u128;
const PRICE_CONSTANT: u128 = 6_190_532_760u128; // 61.9053276 * 10^8
const MAX_TOKENS: u128 = 800_000_000u128;
const PRECISION_FACTOR: u128 = 1_000_000u128; // 10^6 for price scaling

#[event]
struct TokenSaleEvent has drop, store {
    seller: address,
    metadata_addr: address,
    amount: u64,
    price: u64,
    apt_returned: u64,
    timestamp: u64,
    tokens_sold: u128,
}

    #[event]
struct DebugEvent has drop, store {
    msg: vector<u8>,
    value: u128, // Use u128 to handle minted_supply, remaining_supply, etc.
}
    #[event]
   struct TokenCreatedEvent has drop, store {
    creator: address,
    metadata_addr: address,
    ticker: vector<u8>,
    total_supply: u64,
    minted_supply: u64,
    remaining_supply: u64,
    decimals_factor: u64,
    premint_amount: u64,
    timestamp: u64,
}
    

    #[event]
    struct TokenPurchaseEvent has drop, store {
    buyer: address,
    metadata_addr: address,
    amount: u64,
    price: u64,
    liquidity_contribution: u64,
    timestamp: u64,
    tokens_sold: u128, //
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
        total_apt_spent: u64,
        decimals_factor: u64  // Added field for token decimals scaling
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

    fun pow(base: u64, exp: u64): u64 {
        let result = 1;
        let i = 0;
        while (i < exp) {
            result = result * base;
            i = i + 1;
        };
        result
    }

public entry fun register_resource_account(admin: &signer) {
    let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
    let resource_addr = account::create_resource_address(&module_addr, b"token_launcher");
    if (!coin::is_account_registered<AptosCoin>(resource_addr)) {
        coin::register<AptosCoin>(admin); // Admin registers it
    };
}



public entry fun initialize(admin: &signer) {
    let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
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
        assert!(admin_addr == @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090, E_NOT_ADMIN);
        let module_state = borrow_global_mut<ModuleState>(@0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090);
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
    let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
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
    let minted_supply_opt = fungible_asset::supply(metadata);
    let minted_supply = option::extract(&mut minted_supply_opt);
    let minted_supply_u64 = (minted_supply / 100_000_000) as u64;
    assert!(minted_supply == (scaled_premint_amount as u128), E_PREMINT_FAILED);

    let metadata_signer = object::generate_signer_for_extending(&extend_ref);
    move_to(&metadata_signer, TokenVault {
        extend_ref,
        mint_ref,
        burn_ref,
        metadata,
        total_supply: scaled_total_supply,
        remaining_supply: scaled_remaining_supply,
        price_per_token: 10000,
        total_apt_spent: 0,
        decimals_factor
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
        total_supply,
        minted_supply: minted_supply_u64,
        remaining_supply: (scaled_remaining_supply / 100_000_000) as u64,
        decimals_factor,
        premint_amount: (scaled_premint_amount / 100_000_000) as u64,
        timestamp: timestamp::now_microseconds(),
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
    amount: u64
) acquires ModuleState, TokenVault, BuyerStore {
    let buyer_addr = signer::address_of(buyer);
    let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = @0xe90527b3338636942c64a3facfea7bcc826b1c8a8ad02092f5d93644c45c7d7d;
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    event::emit(DebugEvent { msg: b"Metadata Addr Used", value: 0 });
    let vault = borrow_global_mut<TokenVault>(metadata_addr);

    let tokens_bought = amount;
    assert!(vault.remaining_supply >= tokens_bought * vault.decimals_factor, E_INSUFFICIENT_SUPPLY);
    assert!(tokens_bought <= 798_600_000, E_EXCEEDS_MAX_SALE);
    event::emit(DebugEvent { msg: b"Tokens Bought", value: (tokens_bought as u128) });
    event::emit(DebugEvent { msg: b"Decimals Factor", value: (vault.decimals_factor as u128) });

    let total_supply = 800_000_000u128;
    let preminted_tokens = 200_000_000u64;
    let tokens_sold_before = if (vault.remaining_supply == 800_000_000 * vault.decimals_factor) { 0 } else { ((vault.total_supply - vault.remaining_supply) / vault.decimals_factor) - preminted_tokens };
    let tokens_sold_after = tokens_sold_before + tokens_bought;
    assert!(tokens_sold_after < 800_000_000, E_EXCEEDS_SUPPLY);
    event::emit(DebugEvent { msg: b"Tokens Sold Before", value: (tokens_sold_before as u128) });
    event::emit(DebugEvent { msg: b"Tokens Sold After", value: (tokens_sold_after as u128) });

    // Calculate apt_cost using the corrected hyperbolic price formula
    // Price formula: Price (Octas/token) = (4,757,378,689 / (800,000,000 - s)) + 61.9053276
    // Scaled by 10^6 for fixed-point arithmetic, with constant scaled by 10^8
    let scale = 100_000_000u128; // 10^8 for Octas
    let price_numerator = 19_029_514_756u128; // Unscaled numerator
    let price_constant = 6_190_532_760u128; // 61.9053276 * 10^8
    let price_denominator_base = 800_000_000u128;
    let price_scale = 1_000_000u128; // 10^6 to match price scaling
    let constant_scale = 100_000_000u128; // 10^8 for constant precision

    // Compute price before and after purchase (Octas/token * 10^6)
    let denominator_before = price_denominator_base - (tokens_sold_before as u128);
    let denominator_after = price_denominator_base - (tokens_sold_after as u128);
    // Hyperbolic term: (numerator * 10^6) / denominator
    let hyperbolic_before = (price_numerator * price_scale) / denominator_before;
    let hyperbolic_after = (price_numerator * price_scale) / denominator_after;
    // Constant term: 61.9053276 * 10^6 = (6,190,532,760 / 10^2)
    let constant_term = price_constant / (constant_scale / price_scale); // 6,190,532,760 / 100
    // Total price
    let price_before = hyperbolic_before + constant_term; // Octas/token * 10^6
    let price_after = hyperbolic_after + constant_term; // Octas/token * 10^6
    let average_price = (price_before + price_after) / 2; // Octas/token * 10^6
    event::emit(DebugEvent { msg: b"Price Before", value: price_before });
    event::emit(DebugEvent { msg: b"Price After", value: price_after });
    event::emit(DebugEvent { msg: b"Average Price", value: average_price });
    // Compute cost: (average_price * tokens_bought * 1000) / scale
    let apt_cost = (average_price * (tokens_bought as u128) * 100) / scale; // Convert to Octas
    assert!(apt_cost > 0, E_INVALID_COST);
    let apt_cost_u64 = apt_cost as u64;
    event::emit(DebugEvent { msg: b"APT Cost u64 Final", value: (apt_cost_u64 as u128) });

    // Transfer APT
    coin::transfer<AptosCoin>(buyer, resource_addr, apt_cost_u64);

    // Update vault state
    vault.total_apt_spent = vault.total_apt_spent + apt_cost_u64;
    vault.remaining_supply = vault.remaining_supply - (tokens_bought * vault.decimals_factor);
    // Set price_per_token to the average transaction price
    vault.price_per_token = if (tokens_bought > 0) { 
        ((apt_cost_u64 as u128) / (tokens_bought as u128)) as u64 
    } else { 
        vault.price_per_token 
    };

    // Mint tokens and update buyer store
    if (!exists<BuyerStore>(buyer_addr)) {
        move_to(buyer, BuyerStore { stores: vector::empty() });
    };
    let buyer_store = get_or_create_token_store(buyer, vault.metadata);
    fungible_asset::mint_to(&vault.mint_ref, buyer_store, tokens_bought * vault.decimals_factor);

    // Update market cap
    let token_metadata_mut = table::borrow_mut(&mut state.token_metadata, creator_addr);
    let total_sold = (vault.total_supply - vault.remaining_supply) as u128;
    let price = vault.price_per_token as u128;
    let decimals = vault.decimals_factor as u128;
    token_metadata_mut.market_cap = ((total_sold * price) / decimals) as u64;

    // Emit event
    event::emit(TokenPurchaseEvent {
        buyer: buyer_addr,
        metadata_addr,
        amount: tokens_bought * vault.decimals_factor,
        price: vault.price_per_token,
        liquidity_contribution: apt_cost_u64,
        timestamp: timestamp::now_microseconds(),
        tokens_sold: (tokens_sold_before as u128),
    });
}

public entry fun sell_tokens(
    seller: &signer,
    creator_addr: address,
    ticker: vector<u8>,
    amount: u64
) acquires ModuleState, TokenVault, BuyerStore {
    let seller_addr = signer::address_of(seller);
    let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = @0xe90527b3338636942c64a3facfea7bcc826b1c8a8ad02092f5d93644c45c7d7d;
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    let vault = borrow_global_mut<TokenVault>(metadata_addr);

    let seller_store = get_or_create_token_store(seller, vault.metadata);
    let seller_balance = fungible_asset::balance(seller_store);
    event::emit(DebugEvent { msg: b"Seller Balance", value: seller_balance as u128 });
    event::emit(DebugEvent { msg: b"Amount to Burn", value: amount as u128 });
    assert!(seller_balance >= amount * vault.decimals_factor, E_INSUFFICIENT_LIQUIDITY);

    let total_supply = 800_000_000u128;
    let preminted_tokens = 200_000_000u64;
    let tokens_sold_before = if (vault.remaining_supply == 800_000_000 * vault.decimals_factor) { 
        0 
    } else { 
        ((vault.total_supply - vault.remaining_supply) / vault.decimals_factor) - preminted_tokens 
    };
    event::emit(DebugEvent { msg: b"Tokens Sold Before", value: tokens_sold_before as u128 });

    // Calculate price using the same formula as buy_tokens
    let scale = 100_000_000u128; // 10^8 for Octas
    let price_numerator = 19_029_514_756u128; // Unscaled numerator
    let price_constant = 6_190_532_760u128; // 61.9053276 * 10^8
    let price_scale = 1_000_000u128; // 10^6 for price scaling
    let constant_scale = 100_000_000u128; // 10^8 for constant precision

    // Calculate price before and after selling
    let denominator_before = total_supply - (tokens_sold_before as u128);
    let denominator_after = denominator_before + (amount as u128);
    
    // Hyperbolic term: (numerator * 10^6) / denominator
    let hyperbolic_before = (price_numerator * price_scale) / denominator_before;
    let hyperbolic_after = (price_numerator * price_scale) / denominator_after;
    
    // Constant term: 61.9053276 * 10^6
    let constant_term = price_constant / (constant_scale / price_scale);
    
    // Total price
    let price_before = hyperbolic_before + constant_term;
    let price_after = hyperbolic_after + constant_term;
    let average_price = (price_before + price_after) / 2;
    
    // Calculate APT to return
    let apt_out = (average_price * (amount as u128) * 100) / scale;
    let apt_out_u64 = apt_out as u64;
    event::emit(DebugEvent { msg: b"APT Out", value: apt_out as u128 });
    assert!(apt_out > 0 || amount == 0, E_INSUFFICIENT_APT_OUT);

    let actual_balance = coin::balance<AptosCoin>(resource_addr);
    state.apt_amount = actual_balance;
    event::emit(DebugEvent { msg: b"Resource Balance", value: actual_balance as u128 });
    assert!(state.apt_amount >= apt_out_u64, E_INSUFFICIENT_APT);

    // Update vault state
    vault.remaining_supply = vault.remaining_supply + (amount * vault.decimals_factor);
    fungible_asset::burn_from(&vault.burn_ref, seller_store, amount * vault.decimals_factor);

    vault.total_apt_spent = if (vault.total_apt_spent >= apt_out_u64) { 
        vault.total_apt_spent - apt_out_u64 
    } else { 
        0 
    };
    state.apt_amount = state.apt_amount - apt_out_u64;

    vault.price_per_token = if (amount > 0) { 
        ((apt_out_u64 as u128) * 100_000_000u128 / (amount as u128)) as u64 
    } else { 
        vault.price_per_token 
    };

    let token_metadata_mut = table::borrow_mut(&mut state.token_metadata, creator_addr);
    let total_sold = (vault.total_supply - vault.remaining_supply) as u128;
    let price = vault.price_per_token as u128;
    let decimals = vault.decimals_factor as u128;
    token_metadata_mut.market_cap = ((total_sold * price) / decimals) as u64;

    let resource_signer = account::create_signer_with_capability(&state.resource_signer_cap);
    coin::transfer<AptosCoin>(&resource_signer, seller_addr, apt_out_u64);

    event::emit(TokenSaleEvent {
        seller: seller_addr,
        metadata_addr,
        amount: amount,
        price: vault.price_per_token,
        apt_returned: apt_out_u64,
        timestamp: timestamp::now_microseconds(),
        tokens_sold: (tokens_sold_before as u128),
    });
}

     

   

public entry fun withdraw_apt(admin: &signer, amount: u64) acquires ModuleState {
    let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
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
        let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
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
        let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
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
        let module_addr = @0x965f2de54b3037c386d4d28500b0cd5771942b10704a0324c8464348c15ce090;
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
    let resource_addr = account::create_resource_address(&@0xe90527b3338636942c64a3facfea7bcc826b1c8a8ad02092f5d93644c45c7d7d, b"token_launcher");
    (resource_addr, coin::is_account_registered<AptosCoin>(resource_addr))
}
}