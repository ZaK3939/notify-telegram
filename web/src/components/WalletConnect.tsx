'use client';
import { useAccount } from 'wagmi';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  return { address, isConnected };
}
