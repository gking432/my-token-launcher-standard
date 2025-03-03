import WalletConnect from '../components/WalletConnect';
import CreateToken from '../components/CreateToken';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl mb-4">Aptos Token Launcher</h1>
      <WalletConnect />
      <CreateToken />
    </div>
  );
}