import * as Crypto from 'expo-crypto';

/** Collision-free identifier for locally created rows. */
export function createId(): string {
  return Crypto.randomUUID();
}
