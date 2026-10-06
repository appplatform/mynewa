import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

/** 키 순서를 고정한 JSON. 해시 입력을 결정적으로 만든다. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

// ── Merkle tree (증거 계층 앵커링) ───────────────────────────────
// 리프는 sha256(0x00 || data), 내부 노드는 sha256(0x01 || left || right)로 2차 원상 공격을 막는다.
// 홀수 노드는 그대로 위로 올린다.

const leafHash = (data: string) => sha256Hex(`00${data}`);
const nodeHash = (l: string, r: string) => sha256Hex(`01${l}${r}`);

export interface MerkleProofStep { sibling: string; position: 'left' | 'right' }

export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256Hex('');
  let level = leaves.map(leafHash);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i]!;
      const r = level[i + 1];
      next.push(r === undefined ? l : nodeHash(l, r));
    }
    level = next;
  }
  return level[0]!;
}

export function merkleProof(leaves: string[], index: number): MerkleProofStep[] {
  if (index < 0 || index >= leaves.length) throw new Error('index out of range');
  let level = leaves.map(leafHash);
  let i = index;
  const proof: MerkleProofStep[] = [];
  while (level.length > 1) {
    const isRight = i % 2 === 1;
    const sib = isRight ? level[i - 1] : level[i + 1];
    if (sib !== undefined) proof.push({ sibling: sib, position: isRight ? 'left' : 'right' });
    const next: string[] = [];
    for (let j = 0; j < level.length; j += 2) {
      const l = level[j]!;
      const r = level[j + 1];
      next.push(r === undefined ? l : nodeHash(l, r));
    }
    level = next;
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyMerkleProof(leaf: string, proof: MerkleProofStep[], root: string): boolean {
  let h = leafHash(leaf);
  for (const step of proof) h = step.position === 'left' ? nodeHash(step.sibling, h) : nodeHash(h, step.sibling);
  return h === root;
}
