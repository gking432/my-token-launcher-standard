import React from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { GoogleLogin as GoogleLoginButton } from '@react-oauth/google';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const config = new AptosConfig({ network: Network.TESTNET, fullnode: "https://fullnode.testnet.aptoslabs.com/v1" });
const client = new Aptos(config);

const GoogleLogin: React.FC = () => {
  const { connect } = useWallet();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      // Decode the JWT token
      const token = credentialResponse.credential;
      const [headerB64, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64));

      // Create a unique identifier from the Google account
      const googleId = payload.sub;
      const email = payload.email;

      // Create a deterministic Aptos address from the Google account
      const addressBytes = new TextEncoder().encode(`${googleId}:${email}`);
      const hash = await crypto.subtle.digest('SHA-256', addressBytes);
      const address = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Connect with the generated address
      await connect('Google');
    } catch (error) {
      console.error('Error handling Google login:', error);
    }
  };

  const handleGoogleError = () => {
    console.error('Google login failed');
  };

  return (
    <div className="google-login-container">
      <GoogleLoginButton
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap
        theme="filled_blue"
        size="large"
        text="continue_with"
        shape="rectangular"
        width="250"
      />
    </div>
  );
};

export default GoogleLogin; 