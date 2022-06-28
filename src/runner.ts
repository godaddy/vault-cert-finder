import { argv } from "process";

import { RED, BLACK_WITH_GREEN_BG } from "./constants";
import vaultCertFinder from "./index";
import { Options } from "./types";
import prettyCert from "./prettyCert";

const validateArgs = (args: Options) => {
  const required = ["url", "role", "secret"];
  required.forEach((option) => {
    if (!(option in args)) {
      throw new Error(`${option} option not present`);
    }

    const value = args[option];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${option} option value not present`);
    }
  });
};

/**
 * We expect arguments to be provided like `--url myurl`
 */
const normaliseArgs = () => {
  const args = argv.slice(2);
  const options: Options = {};
  for (let i = 0; i < Math.floor(args.length / 2); i++) {
    options[args[i * 2].replace("--", "")] = args[i * 2 + 1];
  }

  return options;
};

(async () => {
  try {
    const args = normaliseArgs();
    validateArgs(args);

    const certs = await vaultCertFinder(
      args.url,
      args.role,
      args.secret,
      args.mountPoint,
      args.mounts
    );

    if (typeof certs === "undefined") {
      console.log(RED, "No certificates found");
      return;
    }

    console.log(
      BLACK_WITH_GREEN_BG,
      `Found ${Object.values(certs).reduce(
        (total, arr) => total + arr.length,
        0
      )} certificates`
    );

    Object.keys(certs).forEach((path) => {
      certs[path].forEach((cert) => prettyCert(cert, path));
    });
  } catch (e) {
    console.error("Error when running via CLI", e);
  }
})();
