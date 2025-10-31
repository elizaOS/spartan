import type { UUID } from '@elizaos/core';

export type Position = {
  id: UUID;
  timestamp: string;
  chain: string;
  token: string;
  strategy: string;
  walletAddress: string;
  solAmount: string;
  tokenAmount: number;
  close?: {
    timestamp: number;
    outAmount: string;
    type: string;
  }
}