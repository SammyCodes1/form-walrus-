"use client";

import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID || "";

// Create a new Seal allowlist for a private form
// Called when a private form is published
// Returns the transaction to be signed by the creator
export function buildCreateAllowlistTx(
  formId: string,
  creatorAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(creatorAddress);
  tx.setGasBudget(10000000);

  // Call the Move contract to create an allowlist
  // The creator is automatically added as the first member
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policy::create_allowlist`,
    arguments: [
      tx.pure.string(formId),
    ],
  });

  return tx;
}

// Add an admin address to the allowlist
export function buildAddToAllowlistTx(
  allowlistId: string,
  adminCapId: string,
  addressToAdd: string,
  callerAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(callerAddress);
  tx.setGasBudget(10000000);

  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policy::add_to_allowlist`,
    arguments: [
      tx.object(allowlistId),
      tx.object(adminCapId),
      tx.pure.address(addressToAdd),
    ],
  });

  return tx;
}

// Remove an address from the allowlist
export function buildRemoveFromAllowlistTx(
  allowlistId: string,
  adminCapId: string,
  addressToRemove: string,
  callerAddress: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(callerAddress);
  tx.setGasBudget(10000000);

  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policy::remove_from_allowlist`,
    arguments: [
      tx.object(allowlistId),
      tx.object(adminCapId),
      tx.pure.address(addressToRemove),
    ],
  });

  return tx;
}
