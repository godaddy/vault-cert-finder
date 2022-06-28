import path from "path";
import makeDebug from "debug";
import { client as VaultClient } from "node-vault";

import { name } from "../package.json";
import { RED } from "./constants";
import isApiResponseError from "./isApiResponseError";
import { MountsResponse, Mounts, List, Result } from "./types";

const debug = makeDebug(name);

const explodeMounts = (filterMounts: string): string[] =>
  filterMounts.split(",").map((mount) => `${mount}/`);

const getKvMounts = async (
  client: VaultClient,
  filterMounts?: string // should be comma seperated
): Promise<Mounts> => {
  const explodedMounts =
    typeof filterMounts === "string" ? explodeMounts(filterMounts) : [];
  debug("Only going to include mounts", explodedMounts);
  const mountsResponse: MountsResponse = await client.mounts();
  const mounts =
    typeof mountsResponse?.data === "object" ? mountsResponse.data : {};

  return Object.keys(mounts).reduce<Mounts>((obj, mountName) => {
    const isKv = mounts[mountName].type === "kv";
    if (
      !isKv ||
      (explodedMounts.length > 0 && !explodedMounts.includes(mountName))
    ) {
      debug(
        `Not using mount ${mountName} because it's ${
          !isKv ? "not key/value" : "not in --mounts option"
        }`
      );
      return obj;
    }

    obj[mountName] = mounts[mountName];
    return obj;
  }, {});
};

const versionedPath = (
  path: string,
  version?: string,
  inject?: string
): string => {
  if (version !== "2" || typeof inject === "undefined") {
    return path;
  }

  // v2 of kv engine requires us to add an extra part of the path
  const split = path.split("/");
  split.splice(1, 0, inject);

  return split.join("/");
};

const isDir = (path: string): boolean => path[path.length - 1] === "/";

/**
 * Recursive function that accepts a path that could be a dir or secret
 * if we get a path we'll read the secrets and return them, otherwise we keep
 * traversing until we find a secret or no more dirs
 */
const findValuesInMount = async (
  client: VaultClient,
  vaultPath: string,
  version?: string
): Promise<Result | undefined> => {
  try {
    if (!isDir(vaultPath)) {
      debug(
        `Finding values in mount for vault path ${vaultPath} (v${
          version || "1"
        })`
      );

      let { data } = await client.read(
        versionedPath(vaultPath, version, "data")
      );
      // in kv v2 data = { data: { s }}
      if (version === "2") {
        data = data.data;
      }

      debug(`Got value for path ${vaultPath}`, data);
      return { [vaultPath]: Object.values(data) };
    }

    const {
      data: { keys: kvKeys },
    }: List = await client.list(versionedPath(vaultPath, version, "metadata"));

    debug(
      `Listing values from kv path ${vaultPath} (v${version || "1"})`,
      kvKeys
    );

    let acc: Result = {};

    await Promise.all(
      kvKeys.map(async (value) => {
        const result = await findValuesInMount(
          client,
          path.join(vaultPath, value),
          version
        );
        acc = { ...acc, ...result };
      })
    );

    return acc;
  } catch (e) {
    if (
      e instanceof Error &&
      isApiResponseError(e) &&
      e.response.statusCode === 404
    ) {
      console.log(RED, `Warning: Got 404 for path ${vaultPath}`);
    }
  }
};

export default async function traverse<P>(
  client: VaultClient,
  mounts?: string
) {
  try {
    debug("Attempting to get key/value mounts");
    const kvMounts = await getKvMounts(client, mounts);
    debug("Got key/value mounts", kvMounts);

    let acc: Result = {};
    await Promise.all(
      Object.keys(kvMounts).map(async (mountName) => {
        const mount = kvMounts[mountName];
        const valuesInMount = await findValuesInMount(
          client,
          mountName,
          mount?.options?.version
        );

        if (!valuesInMount) {
          return;
        }

        acc = {
          ...acc,
          ...valuesInMount,
        };
      })
    );

    debug("Finished traversing");

    return acc;
  } catch (e) {
    if (e instanceof Error && isApiResponseError(e)) {
      if (e.response.statusCode === 403) {
        console.log(
          RED,
          `
          Permission denied, the vault server likely does not have the correct policy setup.
          Use DEBUG=node-vault to determine which path you are looking at, then ensure you have the appropriate policy setup.
          E.g permission denied at GET /v1/sys/mounts would mean you need to add the "READ" permission to /sys/mounts
          See the readme for details on /sys/mounts
          `
        );
      }

      console.error(
        RED,
        "With response body errors",
        e.response.body?.errors,
        e.response.body?.data
      );
    } else {
      // we dont want to handle the error here, we just wanted to log some extra information, so we re-throw
      console.error(e);
      throw e;
    }
  }
}
