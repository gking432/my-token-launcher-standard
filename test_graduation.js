// Test script to manually check graduation events and logic
// Run this in your browser console

const MODULE_ADDRESS = "0x5961dc0cdccca02f9fd135ef9df791c549bfd6b91136d37829afa44909edd32a";
const RESOURCE_ADDRESS = "0xa9c99dc8aeb5d96a639a2d7d6eb4413a558085443ba6bfce1a634e708e050427";

// Function to manually check for graduation events
async function checkGraduationEvents() {
  try {
    console.log('🔍 Checking for graduation events...');
    
    // Method 1: Try to get events by event handle (will fail without EventHandle)
    try {
      const response = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${RESOURCE_ADDRESS}/events/${MODULE_ADDRESS}::token_launcher/GraduationReadyEvent?start=0&limit=10`);
      const events = await response.json();
      console.log('✅ Graduation events found:', events);
    } catch (error) {
      console.log('❌ Event handle query failed (expected without EventHandle):', error.message);
    }
    
    // Method 2: Get recent transactions and look for graduation events
    console.log('🔍 Checking recent transactions for graduation events...');
    const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${MODULE_ADDRESS}/transactions?start=0&limit=20`);
    const transactions = await txResponse.json();
    
    // Look for transactions that might contain graduation events
    for (const tx of transactions) {
      if (tx.events) {
        for (const event of tx.events) {
          if (event.type && event.type.includes('TokenGraduatedEvent')) {
            console.log('🎉 Found graduation event in transaction:', tx.hash);
            console.log('Event data:', event.data);
          }
        }
      }
    }
    
    // Method 3: Check if any tokens have graduated by looking at vault states
    console.log('🔍 Checking vault states for graduated tokens...');
    const vaultResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${RESOURCE_ADDRESS}/resources`);
    const resources = await vaultResponse.json();
    
    for (const resource of resources) {
      if (resource.type && resource.type.includes('TokenVault')) {
        console.log('Token vault found:', resource.type);
        if (resource.data && resource.data.is_graduated) {
          console.log('🎉 Found graduated token:', resource.data);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking graduation events:', error);
  }
}

// Function to test graduation logic manually
async function testGraduationLogic() {
  console.log('🧪 Testing graduation logic...');
  
  // Check current graduation threshold
  console.log('📊 Graduation threshold: 1283 APT');
  
  // You can manually check if any tokens have reached this threshold
  // by looking at their total_apt_spent in the vault
  
  console.log('💡 To test graduation:');
  console.log('1. Create a token');
  console.log('2. Buy tokens until total_apt_spent >= 1283 APT');
  console.log('3. Check if is_graduated becomes true');
  console.log('4. Look for TokenGraduatedEvent in transaction events');
}

// Run the tests
console.log('🚀 Starting graduation tests...');
checkGraduationEvents();
testGraduationLogic();

// Export functions for manual use
window.checkGraduationEvents = checkGraduationEvents;
window.testGraduationLogic = testGraduationLogic; 