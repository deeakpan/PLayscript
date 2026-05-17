export async function waitWrite(
  publicClient: { waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{ status: string }> },
  writeResult: unknown,
) {
  const hash =
    typeof writeResult === "string"
      ? writeResult
      : (writeResult as { transactionHash?: string; hash?: string })?.transactionHash ??
        (writeResult as { hash?: string })?.hash;
  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error(`waitWrite: expected tx hash, got ${String(writeResult)}`);
  }
  const rec = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
  if (rec.status !== "success") throw new Error(`Transaction failed: ${hash}`);
  return rec;
}
