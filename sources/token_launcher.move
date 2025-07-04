module 0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b::token_launcher {
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
    use aptos_framework::guid;
   
   #[event]
struct DebugState has copy, drop, store {
    total_supply: u64,      // Match vault field type
    remaining_supply: u64,  // Match vault field type
    diff: u64,             // Match vault subtraction result
}
    const E_PRICE_MISMATCH: u64 = 1014; // Use a unique number not used by other error codes
    const MODULE_ADDRESS: address = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
    const RESOURCE_ADDRESS: address = @0x926a808d1985f2936a4a8c37efe9cbe5fc264beb893f2bf4ea3fc7c875e6902b;
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
    const E_INSUFFICIENT_LAUNCH_FEE: u64 = 1018;

// Fee constants
const LAUNCH_FEE_APT: u64 = 20_000_000; // 0.2 APT in Octas
const PRE_GRADUATION_PLATFORM_FEE_BPS: u128 = 90u128; // 0.9% (90 basis points)
const PRE_GRADUATION_CREATOR_FEE_BPS: u128 = 10u128; // 0.1% (10 basis points)
const PLATFORM_TREASURY_ADDRESS: address = @0xd89c5d7624a56413f3af6971d77be6047547be3a443566303ac2ac2ad7a70429;

// Phase 4: Post-Graduation Trading Fees
const POST_GRADUATION_PLATFORM_FEE_BPS: u128 = 50u128;   // 0.05%
const POST_GRADUATION_CREATOR_FEE_BPS: u128 = 200u128;   // 0.2%
const POST_GRADUATION_LP_FEE_BPS: u128 = 50u128;         // 0.05%

// --- NEW: PHASE 3 CONSTANTS & ERRORS ---

// New Error Codes for Graduation
const E_ALREADY_GRADUATED: u64 = 1019;
const E_MARKET_CAP_TOO_LOW: u64 = 1020;
const E_INSUFFICIENT_LIQUIDITY_FOR_FEE: u64 = 1021;

// Production Graduation Threshold
const GRADUATION_MARKET_CAP_APT: u64 = 1283_00000000; // 1283 APT raised

// Production Graduation Fee
const GRADUATION_FEE_TOTAL_APT: u64 = 83_00000000;    // 83 APT total (60 + 23)
const GRADUATION_PLATFORM_FEE_APT: u64 = 60_00000000;   // 60 APT to treasury
const GRADUATION_CREATOR_FEE_APT: u64 = 23_00000000;    // 23 APT to creator

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
    apt_amount: u64,
    graduation_events: event::EventHandle<TokenGraduatedEvent>
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
        decimals_factor: u64,  // Added field for token decimals scaling
        is_graduated: bool,
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

    fun calculate_price(tokens_sold: u64): u128 {
        let price_numerator = 19_029_514_756u128;
        let price_constant = 61_905_327u128; // 61.9053276 scaled
        let denominator = 800_000_000u128 - (tokens_sold as u128);
        (price_numerator / denominator) + (price_constant / 100_000_000u128)
    }

public entry fun register_resource_account(admin: &signer) {
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
    let resource_addr = account::create_resource_address(&module_addr, b"token_launcher");
    if (!coin::is_account_registered<AptosCoin>(resource_addr)) {
        coin::register<AptosCoin>(admin); // Admin registers it
    };
}



public entry fun initialize(admin: &signer) {
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
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
            apt_amount: 0,
            graduation_events: account::new_event_handle<TokenGraduatedEvent>(&resource_signer)
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
        assert!(admin_addr == @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b, E_NOT_ADMIN);
        let module_state = borrow_global_mut<ModuleState>(@0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b);
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
    
    // Launch fee collection
    let creator_balance = coin::balance<AptosCoin>(creator_addr);
    assert!(creator_balance >= LAUNCH_FEE_APT, E_INSUFFICIENT_LAUNCH_FEE);
    
    // Transfer launch fee to platform treasury
    coin::transfer<AptosCoin>(creator, PLATFORM_TREASURY_ADDRESS, LAUNCH_FEE_APT);
    
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
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
    
    // Set 800M remaining for bonding curve (no pre-minting)
    let scaled_remaining_supply = 800000000 * decimals_factor;

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
        decimals_factor,
        is_graduated: false,
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
        minted_supply: 0,
        remaining_supply: (scaled_remaining_supply / 100_000_000) as u64,
        decimals_factor,
        premint_amount: 0,
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
    amount: u64,
    max_slippage_bps: u64
) acquires ModuleState, TokenVault, BuyerStore, VaultState {
    let buyer_addr = signer::address_of(buyer);
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = @0x926a808d1985f2936a4a8c37efe9cbe5fc264beb893f2bf4ea3fc7c875e6902b;
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    event::emit(DebugEvent { msg: b"Metadata Addr Used", value: 0 });
    let vault = borrow_global_mut<TokenVault>(metadata_addr);

    // Prevent trading after graduation
    assert!(!vault.is_graduated, E_ALREADY_GRADUATED);

    // Validate slippage parameter
    assert!(max_slippage_bps > 0, E_INVALID_SLIPPAGE);
    assert!(max_slippage_bps <= 2000, E_INVALID_SLIPPAGE); // Max 20%

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

    // Calculate slippage using helper function
    let price_before = calculate_price(tokens_sold_before);
    let price_after = calculate_price(tokens_sold_after);
    let price_impact = ((price_after - price_before) * 10000) / price_before;
    assert!(price_impact <= (max_slippage_bps as u128), E_SLIPPAGE_TOO_HIGH);
    event::emit(DebugEvent { msg: b"Price Impact", value: price_impact as u128 });

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

    // Calculate trading fees ON TOP of bonding curve cost
    let (platform_fee, creator_fee) = if (vault.is_graduated) {
        // Post-graduation fees
        let platform_fee = (apt_cost * POST_GRADUATION_PLATFORM_FEE_BPS) / 10000; // 0.05%
        let creator_fee = (apt_cost * POST_GRADUATION_CREATOR_FEE_BPS) / 10000;   // 0.2%
        (platform_fee, creator_fee)
    } else {
        // Pre-graduation fees
        let platform_fee = (apt_cost * PRE_GRADUATION_PLATFORM_FEE_BPS) / 10000; // 0.9%
        let creator_fee = (apt_cost * PRE_GRADUATION_CREATOR_FEE_BPS) / 10000;   // 0.1%
        (platform_fee, creator_fee)
    };
    let total_cost = apt_cost + platform_fee + creator_fee;
    let total_cost_u64 = total_cost as u64;
    
    event::emit(DebugEvent { msg: b"Platform Fee", value: platform_fee });
    event::emit(DebugEvent { msg: b"Creator Fee", value: creator_fee });
    event::emit(DebugEvent { msg: b"Total Cost", value: total_cost });

    // Transfer total cost (bonding curve + fees)
    coin::transfer<AptosCoin>(buyer, resource_addr, total_cost_u64);

    // Get creator address from VaultState
    let vault_state = borrow_global<VaultState>(metadata_addr);
    let creator_addr = vault_state.creator;

    // Distribute fees
    let resource_signer = account::create_signer_with_capability(&state.resource_signer_cap);
    coin::transfer<AptosCoin>(&resource_signer, PLATFORM_TREASURY_ADDRESS, platform_fee as u64);
    coin::transfer<AptosCoin>(&resource_signer, creator_addr, creator_fee as u64);

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

    // Automatic graduation check
    if (!vault.is_graduated && vault.total_apt_spent >= GRADUATION_MARKET_CAP_APT) {
        // Mark token as graduated
        vault.is_graduated = true;
        
        // Pay graduation fees
        let resource_signer = account::create_signer_with_capability(&state.resource_signer_cap);
        coin::transfer<AptosCoin>(&resource_signer, PLATFORM_TREASURY_ADDRESS, GRADUATION_PLATFORM_FEE_APT);
        coin::transfer<AptosCoin>(&resource_signer, creator_addr, GRADUATION_CREATOR_FEE_APT);
        
        // Allocate tokens during graduation
        {
            let creator_has_store = false;
            let creator_tokens = 20_000_000 * vault.decimals_factor;
            let total_supply = 1_000_000_000 * vault.decimals_factor;
            let bonding_curve_supply = 800_000_000 * vault.decimals_factor;
            let tokens_sold = bonding_curve_supply - vault.remaining_supply;
            let pool_tokens = total_supply - tokens_sold - creator_tokens;
            let pool_store = get_or_create_token_store(&resource_signer, vault.metadata);

            if (exists<BuyerStore>(creator_addr)) {
                let buyer_store = borrow_global<BuyerStore>(creator_addr);
                let i = 0;
                let len = vector::length(&buyer_store.stores);
                while (i < len) {
                    let entry = vector::borrow(&buyer_store.stores, i);
                    if (entry.metadata_addr == metadata_addr) {
                        let creator_store = entry.store;
                        fungible_asset::mint_to(&vault.mint_ref, creator_store, creator_tokens);
                        creator_has_store = true;
                        break;
                    };
                    i = i + 1;
                };
            };

            if (!creator_has_store) {
                let treasury_store = get_or_create_token_store(&resource_signer, vault.metadata);
                fungible_asset::mint_to(&vault.mint_ref, treasury_store, creator_tokens);
            };

            // Always mint pool tokens
            fungible_asset::mint_to(&vault.mint_ref, pool_store, pool_tokens);

            // Emit graduation event using EventHandle
            event::emit_event(&mut state.graduation_events, TokenGraduatedEvent {
                metadata_addr,
                market_cap_at_graduation: vault.total_apt_spent,
                timestamp: timestamp::now_microseconds(),
            });
        }
    }
}

public entry fun sell_tokens(
    seller: &signer,
    creator_addr: address,
    ticker: vector<u8>,
    amount: u64,
    max_slippage_bps: u64
) acquires ModuleState, TokenVault, BuyerStore, VaultState {
    let seller_addr = signer::address_of(seller);
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
    let state = borrow_global_mut<ModuleState>(module_addr);
    let resource_addr = @0x926a808d1985f2936a4a8c37efe9cbe5fc264beb893f2bf4ea3fc7c875e6902b;
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    let vault = borrow_global_mut<TokenVault>(metadata_addr);

    // Prevent trading after graduation
    assert!(!vault.is_graduated, E_ALREADY_GRADUATED);

    // Validate slippage parameter
    assert!(max_slippage_bps > 0, E_INVALID_SLIPPAGE);
    assert!(max_slippage_bps <= 2000, E_INVALID_SLIPPAGE); // Max 20%

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

    // Calculate slippage using helper function (reverse for sells)
    let price_before = calculate_price(tokens_sold_before);
    let price_after = calculate_price(tokens_sold_before - amount);
    let price_impact = ((price_before - price_after) * 10000) / price_before;
    assert!(price_impact <= (max_slippage_bps as u128), E_SLIPPAGE_TOO_HIGH);
    event::emit(DebugEvent { msg: b"Price Impact", value: price_impact as u128 });

    // Calculate apt_out using the same formula as buy_tokens
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
    let price_before_curve = hyperbolic_before + constant_term;
    let price_after_curve = hyperbolic_after + constant_term;
    let average_price = (price_before_curve + price_after_curve) / 2;
    
    // Calculate APT to return
    let apt_out = (average_price * (amount as u128) * 100) / scale;
    let apt_out_u64 = apt_out as u64;
    event::emit(DebugEvent { msg: b"APT Out", value: apt_out as u128 });
    assert!(apt_out > 0 || amount == 0, E_INSUFFICIENT_APT_OUT);

    // Calculate trading fees ON TOP of bonding curve return
    let (platform_fee, creator_fee) = if (vault.is_graduated) {
        // Post-graduation fees
        let platform_fee = (apt_out * POST_GRADUATION_PLATFORM_FEE_BPS) / 10000; // 0.05%
        let creator_fee = (apt_out * POST_GRADUATION_CREATOR_FEE_BPS) / 10000;   // 0.2%
        (platform_fee, creator_fee)
    } else {
        // Pre-graduation fees
        let platform_fee = (apt_out * PRE_GRADUATION_PLATFORM_FEE_BPS) / 10000; // 0.9%
        let creator_fee = (apt_out * PRE_GRADUATION_CREATOR_FEE_BPS) / 10000;   // 0.1%
        (platform_fee, creator_fee)
    };
    let total_return = apt_out - platform_fee - creator_fee;
    let total_return_u64 = total_return as u64;
    
    event::emit(DebugEvent { msg: b"Platform Fee", value: platform_fee });
    event::emit(DebugEvent { msg: b"Creator Fee", value: creator_fee });
    event::emit(DebugEvent { msg: b"Total Return", value: total_return });

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

    // Get creator address from VaultState
    let vault_state = borrow_global<VaultState>(metadata_addr);
    let creator_addr = vault_state.creator;

    // Distribute fees first
    let resource_signer = account::create_signer_with_capability(&state.resource_signer_cap);
    coin::transfer<AptosCoin>(&resource_signer, PLATFORM_TREASURY_ADDRESS, platform_fee as u64);
    coin::transfer<AptosCoin>(&resource_signer, creator_addr, creator_fee as u64);

    // Seller gets remaining amount
    coin::transfer<AptosCoin>(&resource_signer, seller_addr, total_return_u64);

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

// --- NEW: GRADUATION FUNCTION ---

#[event]
struct TokenGraduatedEvent has drop, store {
    metadata_addr: address,
    market_cap_at_graduation: u64,
    timestamp: u64,
}

public entry fun withdraw_apt(admin: &signer, amount: u64) acquires ModuleState {
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
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
        let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
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
        let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
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
        let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
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
    let resource_addr = account::create_resource_address(&@0x926a808d1985f2936a4a8c37efe9cbe5fc264beb893f2bf4ea3fc7c875e6902b, b"token_launcher");
    (resource_addr, coin::is_account_registered<AptosCoin>(resource_addr))
}

#[view]
public fun get_price_impact(
    creator_addr: address,
    ticker: vector<u8>,
    amount: u64,
    is_buy: bool
): u128 acquires ModuleState, TokenVault {
    let module_addr = @0x660bb7df7eaf94ac70403e64698faf8b68e5bffe68f1051a97d130068afc7a6b;
    let state = borrow_global<ModuleState>(module_addr);
    let token_metadata = table::borrow(&state.token_metadata, creator_addr);
    let metadata_addr = find_metadata_addr(&token_metadata.entries, ticker);
    let vault = borrow_global<TokenVault>(metadata_addr);

    let total_supply = 800_000_000u128;
    let preminted_tokens = 200_000_000u64;
    let tokens_sold_before = if (vault.remaining_supply == 800_000_000 * vault.decimals_factor) { 
        0 
    } else { 
        ((vault.total_supply - vault.remaining_supply) / vault.decimals_factor) - preminted_tokens 
    };

    let price_before = calculate_price(tokens_sold_before);
    let price_after = if (is_buy) {
        calculate_price(tokens_sold_before + amount)
    } else {
        calculate_price(tokens_sold_before - amount)
    };

    if (is_buy) {
        ((price_after - price_before) * 10000) / price_before
    } else {
        ((price_before - price_after) * 10000) / price_before
    }
}
}