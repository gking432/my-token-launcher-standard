"use client";

import React, { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos"; // ✅ Correct package

// Initialize AptosClient
const client = new AptosClient("https://fullnode.devnet.aptoslabs.com/v1"); 

export default function CreateToken() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return alert("Connect wallet first!");

    const payload = {
      type: "entry_function_payload",
      function: "0x3::token::create_token_script", // ✅ Replace with your actual Move module function
      type_arguments: [],
      arguments: [name, symbol, parseInt(supply)],
      data: {} as any
    };

    try {
      const response = await signAndSubmitTransaction(payload); // ✅ Now response is defined
      await client.waitForTransactionWithResult(response.hash);
      console.log("Tx Hash:", response.hash);
      alert(`Token created! Tx: https://explorer.aptoslabs.com/txn/${response.hash}?network=testnet`);

      // ✅ Store token under user's wallet
      const walletString = String(account.address);
      let users = JSON.parse(localStorage.getItem("users") || "{}");

      if (!users[walletString]) {
        users[walletString] = { launchedTokens: [] };
      }
      
      users[walletString].launchedTokens.push({
        name,
        symbol,
        supply,
        txHash: response.hash, // ✅ Now response.hash exists
      });

      localStorage.setItem("users", JSON.stringify(users));

    } catch (error) {
      console.error("Error creating token:", error);
      alert("Failed to launch token. Check console for details.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4">
      <input
        type="text"
        placeholder="Token Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full mb-2 p-2 border"
      />
      <input
        type="text"
        placeholder="Symbol"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="w-full mb-2 p-2 border"
      />
      <input
        type="number"
        placeholder="Supply"
        value={supply}
        onChange={(e) => setSupply(e.target.value)}
        className="w-full mb-2 p-2 border"
      />
      <button type="submit" className="bg-[#434852] text-white px-4 py-2 rounded">
        Launch Token
      </button>
    </form>
  );
}
