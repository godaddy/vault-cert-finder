import { X509Certificate } from "crypto";

export type Options = Record<string, string>;

export type MountsResponse = {
  data?: Mounts;
};
export type Mounts = Record<string, Mount>;
export type Mount = {
  accessor: string;
  config: {
    default_lease_ttl: number;
    force_no_cache: number;
    max_lease_ttl: number;
  };
  description: string;
  external_entropy_access: boolean;
  local: boolean;
  options?: { version?: string };
  seal_wrap: boolean;
  type: "kv" | "cubbyhole";
  uuid: string;
};

export type List = {
  data: {
    keys: string[];
  };
};

export interface ApiReponseError extends Error {
  response: {
    statusCode?: number;
    body?: {
      errors?: [];
      data?: [];
    };
  };
}

export type Result = Record<string, string[]>;
export type ParsedResult = Record<string, X509Certificate[]>;
