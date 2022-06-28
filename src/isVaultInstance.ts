import { client as VaultClient } from "node-vault";

// There is no nice way to check for a vault instance,
// so we do some basic checks here
export default function isVaultInstance(
  maybeVault: unknown
): maybeVault is VaultClient {
  if (typeof maybeVault !== "object") {
    return false;
  }

  if (maybeVault === null) {
    return false;
  }

  if (Array.isArray(maybeVault)) {
    return false;
  }

  return "auths" in maybeVault;
}
