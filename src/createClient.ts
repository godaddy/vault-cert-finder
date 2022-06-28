import makeDebug from "debug";
import vault from "node-vault";

import { name } from "../package.json";
import { API_VERSION, RED } from "./constants";

const debug = makeDebug(name);

const defaultOptions = {
  apiVersion: API_VERSION,
};

export default function createClient(url: string, options = {}) {
  try {
    debug(
      "Creating vault client (api %s) for endpoint %s",
      defaultOptions.apiVersion,
      url
    );

    if ("token" in options) {
      debug("With access token from approle login");
    }

    return vault({
      endpoint: url,
      ...defaultOptions,
      ...options,
    });
  } catch (e) {
    console.error(RED, "Could not create vault client", e);
  }
}
