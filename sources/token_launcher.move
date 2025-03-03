module 0xc156a41155e21f972e4158caf1cac90311543b062f49b45536d6fd17708a4198::token_launcher {
    use aptos_framework::managed_coin;
    use std::signer;

    struct GenericMemecoin has key {}

    /// Initializes the GenericMemecoin type (called once by the module owner)
    public entry fun initialize(account: &signer) {
        // Initialize the coin with default parameters (can be updated later if needed)
        managed_coin::initialize<GenericMemecoin>(
            account,
            b"GenericMemecoin", // Default name
            b"GM",             // Default symbol
            6,                 // Decimals
            false              // Non-burnable
        );
    }

    /// Creates new tokens by minting additional GenericMemecoin tokens
    public entry fun create_token(
        account: &signer,
        name: vector<u8>,
        symbol: vector<u8>,
        decimals: u8,
        total_supply: u64
    ) {
        // Register a CoinStore for GenericMemecoin on the caller's account
        managed_coin::register<GenericMemecoin>(account);

        // Mint the total supply to the caller's address
        managed_coin::mint<GenericMemecoin>(account, signer::address_of(account), total_supply);

        // Note: We can't update the name and symbol here because managed_coin::initialize
        // can only be called once, and metadata updates aren't supported by managed_coin.
        // The name and symbol are stored in local storage by your app for display purposes.
    }
}