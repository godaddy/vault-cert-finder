import makeDebug from "debug";
import { format } from "util";
import { client as VaultClient } from "node-vault";

import { name } from "../package.json";
import isVaultInstance from "./isVaultInstance";
import isApiResponseError from "./isApiResponseError";
import { RED } from "./constants";

const debug = makeDebug(name);

const validAccessToken = (token: unknown) =>
  typeof token === "string" && token.length > 0;

export default async function getAccessToken(
  vaultClient: VaultClient,
  role: string,
  secret: string,
  mountPoint?: string
): Promise<string | undefined> {
  try {
    if (!isVaultInstance(vaultClient)) {
      throw new Error(
        "Vault client is not an instance of Vault, will not try and retrieve secrets"
      );
    }

    const options = {
      role_id: role,
      mount_point: mountPoint ?? "approle",
    };

    debug(
      "Logging into base vault client via approle with role id %s on mount point %s",
      options.role_id,
      options.mount_point
    );

    const approle = await vaultClient.approleLogin({
      ...options,
      secret_id: secret,
    });

    if (!validAccessToken(approle?.auth?.client_token)) {
      throw new Error(
        format(
          "Vault did not respond with a client token, instead responded with '%s'",
          approle?.auth?.client_token
        )
      );
    }

    return approle.auth.client_token;
  } catch (e) {
    console.error(RED, "Could not connect to vault", e);
    if (e instanceof Error && isApiResponseError(e)) {
      console.error(RED, "With response body errors", e.response.body?.errors);
    }
  }
}
