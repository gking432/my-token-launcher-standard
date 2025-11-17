const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey, RawTransaction, AccountAddress, U64 } = require("@aptos-labs/ts-sdk");

const MODULE_ADDRESS = "0x8c699e8fa969a555f46629c345d6c10d9512a3398a4353e7af4c2bcf95b9c96d";
const BUYER_ADDRESS = "0x0b48dab8685a30b756235e6df2284b6f572c9a60480cff0072bd7811b1ee9021";
const METADATA_ADDRESS = "0x0e7b3d24a4711ca9be2dade384bf3e3151970511c6583c11802cc397f0f6f3cf";
const TOKEN_AMOUNT = 10000;
const SLIPPAGE_BPS = 500; // 5%

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: "https://fullnode.testnet.aptoslabs.com/v1",
});

const aptos = new Aptos(config);

async function getTokenDetails(metadataAddress) {
  try {
    // Try to get the fungible asset metadata
    const metadata = await aptos.getFungibleAssetMetadata({
      fungibleAssetMetadataAddress: metadataAddress,
    });
    
    console.log("Token metadata:", metadata);
    
    // Extract creator and ticker from metadata
    // The creator is usually the account that created the asset
    // The ticker/symbol is in the metadata
    return {
      creator: metadata.creator_address || null,
      ticker: metadata.symbol || null,
      name: metadata.name || null,
    };
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    // Try alternative method - query the module state
    try {
      const resource = await aptos.getAccountResource({
        accountAddress: MODULE_ADDRESS,
        resourceType: `${MODULE_ADDRESS}::token_launcher::ModuleState`,
      });
      console.log("Module state:", resource);
    } catch (e) {
      console.error("Error fetching module state:", e);
    }
    return null;
  }
}

async function buyTokens() {
  console.log("🔍 Fetching token details...");
  const tokenDetails = await getTokenDetails(METADATA_ADDRESS);
  
  if (!tokenDetails || !tokenDetails.creator || !tokenDetails.ticker) {
    console.error("❌ Could not fetch token details. You may need to provide creator address and ticker manually.");
    console.log("Token details found:", tokenDetails);
    return;
  }
  
  console.log("✅ Token details:", tokenDetails);
  console.log(`\n📝 Buying ${TOKEN_AMOUNT} tokens:`);
  console.log(`   Creator: ${tokenDetails.creator}`);
  console.log(`   Ticker: ${tokenDetails.ticker}`);
  console.log(`   Buyer: ${BUYER_ADDRESS}`);
  console.log(`   Slippage: ${SLIPPAGE_BPS / 100}%\n`);
  
  // Convert ticker to bytes
  const tickerBytes = Array.from(Buffer.from(tokenDetails.ticker, 'utf8'));
  
  // Note: You'll need to provide the private key for the buyer address
  // For security, we'll prompt or you can set it as an environment variable
  const privateKeyHex = process.env.BUYER_PRIVATE_KEY;
  
  if (!privateKeyHex) {
    console.error("❌ BUYER_PRIVATE_KEY environment variable not set!");
    console.log("Set it with: export BUYER_PRIVATE_KEY=0x...");
    return;
  }
  
  try {
    const privateKey = new Ed25519PrivateKey(privateKeyHex);
    const account = Account.fromPrivateKey({ privateKey });
    
    console.log("🔐 Account loaded:", account.accountAddress.toString());
    
    // Build the transaction
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${MODULE_ADDRESS}::token_launcher::buy_tokens`,
        typeArguments: [],
        functionArguments: [
          tokenDetails.creator,
          tickerBytes,
          TOKEN_AMOUNT,
          SLIPPAGE_BPS,
        ],
      },
    });
    
    console.log("📦 Transaction built, signing...");
    
    // Sign and submit
    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });
    
    console.log("⏳ Transaction submitted:", pendingTxn.hash);
    console.log("Waiting for confirmation...");
    
    const executedTxn = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });
    
    console.log("✅ Transaction confirmed!");
    console.log(`View on explorer: https://explorer.aptoslabs.com/txn/${pendingTxn.hash}?network=testnet`);
    
  } catch (error) {
    console.error("❌ Transaction failed:", error);
    if (error.message) {
      console.error("Error message:", error.message);
    }
    if (error.error) {
      console.error("Error details:", JSON.stringify(error.error, null, 2));
    }
  }
}

buyTokens();

