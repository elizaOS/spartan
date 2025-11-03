import type { Position } from '../trading/types'

export type Metawallet = {
  strategy: string;
  keypairs: Record<string, {
    positions: Position[];
    publicKey: string;
    privateKey: string;
  }>
}