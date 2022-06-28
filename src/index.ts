import { X509Certificate } from "crypto";
import "dotenv/config";

import { name } from "../package.json";
import isVaultInstance from "./isVaultInstance";
import createClient from "./createClient";
import getAccessToken from "./getAccessToken";
import traverse from "./traverse";
import { RED } from "./constants";
import { Result, ParsedResult } from "./types";
import makeDebug from "debug";

const debug = makeDebug(name);

const count = (result: Result | ParsedResult): number =>
  Object.values(result).reduce((num, values) => (num += values.length), 0);

const parseCert = (cert: string): X509Certificate => {
  try {
    return new X509Certificate(cert);
  } catch (e) {
    console.log(`Error for cert ${cert}`, e);

    throw e;
  }
};

const isCert = (maybeCert: string | object): boolean => {
  if (typeof maybeCert !== "string") {
    return false;
  }

  return maybeCert.indexOf("-----BEGIN CERTIFICATE-----") === 0;
};

const filterParseCerts = (
  maybeCerts: Result,
  filter: (maybeCert: string) => boolean,
  parse: (cert: string) => X509Certificate
): ParsedResult => {
  const result: ParsedResult = {};

  Object.keys(maybeCerts).forEach((path) => {
    const certs = maybeCerts[path].reduce<X509Certificate[]>((acc, cert) => {
      if (!filter(cert)) {
        return acc;
      }

      acc.push(parse(cert));
      return acc;
    }, []);

    if (certs.length === 0) {
      return;
    }

    result[path] = certs;
  });

  return result;
};

export default async function vaultCertFinder(
  url: string,
  role: string,
  secret: string,
  mountPoint?: string,
  mounts?: string
) {
  try {
    const baseClient = createClient(url);
    if (typeof baseClient === "undefined") {
      return;
    }

    const token = await getAccessToken(baseClient, role, secret, mountPoint);
    if (typeof token === "undefined") {
      return;
    }

    const approleVault = createClient(url, { token });
    if (!isVaultInstance(approleVault)) {
      return;
    }

    const maybeCerts = await traverse(approleVault, mounts);
    if (!maybeCerts) {
      throw new Error("No values found from Vault");
    }

    debug(`Found ${count(maybeCerts)} secrets to be filtered`);

    // it would be much faster to filter and map this as we grab the secrets from vault
    // but clarity and easy reading wins over performance in this case
    // as the recrusive function we use to grab secrets is already fairly complex
    // if we get to a point where we are reading thousands and thousands of secrets
    // this may need to be changed
    const certs = filterParseCerts(maybeCerts, isCert, parseCert);

    debug(`Filtered secrets down to ${count(certs)} certs`);

    // returned mainly for testing purposes, but also could be used programatically
    // in the future
    return certs;
  } catch (e) {
    console.error(RED, "Unexpected error", e);
  }
}
