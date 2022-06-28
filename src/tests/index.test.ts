// I recommend collapsing the server.use calls when reading this file as they can get quite long

import { X509Certificate } from "crypto";
import { rest } from "msw";
import { setupServer } from "msw/node";
import vaultCertFinder from "../index";
import fixtureCerts from "./fixtures/certs.json";

const HOST = "http://0.0.0.0";

const server = setupServer(
  rest.get(`${HOST}/v1/mountOne`, (req, res, ctx) => {
    return res();
  }),
  rest.get(`${HOST}/v1/mountTwo`, (req, res, ctx) => {
    return res();
  }),
  rest.post(`${HOST}/v1/auth/approle/login`, (req, res, ctx) => {
    return res(
      ctx.json({
        auth: {
          client_token: "abc123",
        },
        auths: [],
      })
    );
  })
);

jest.setTimeout(20000);

describe("int tests", () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  test("with no certificates returns nothing", async () => {
    server.use(
      rest.get(`${HOST}/v1/sys/mounts`, (req, res, ctx) => {
        return res();
      })
    );

    const certs = await vaultCertFinder(HOST, "role", "secret");
    expect(certs).toEqual({});
  });

  test("with non-kv mounts returns nothing", async () => {
    server.use(
      rest.get(`${HOST}/v1/sys/mounts`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              "mountOne/": {
                type: "not-kv",
              },
              "mountTwo/": {
                type: "also-not-kv",
              },
            },
          })
        );
      })
    );

    const certs = await vaultCertFinder(HOST, "role", "secret");
    expect(certs).toEqual({});
  });

  test("with kv mounts with no content returns nothing", async () => {
    server.use(
      rest.all("*", (req, res, ctx) => {
        if (req.method !== "LIST") {
          return;
        }

        return res(
          ctx.json({
            data: {
              keys: [],
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/sys/mounts`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              "mountOne/": {
                type: "kv",
              },
              "mountTwo/": {
                type: "kv",
                options: { version: "2" },
              },
            },
          })
        );
      })
    );

    const certs = await vaultCertFinder(HOST, "role", "secret");
    expect(certs).toEqual({});
  });

  test("with kv mounts with content but no certs returns nothing", async () => {
    server.use(
      rest.all("*", (req, res, ctx) => {
        if (req.method !== "LIST") {
          return;
        }

        return res(
          ctx.json({
            data: {
              keys: req.url.href.includes("mountOne")
                ? ["secretOne", "secretTwo"]
                : ["secretThree", "secretFour"],
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/sys/mounts`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              "mountOne/": {
                type: "kv",
              },
              "mountTwo/": {
                type: "kv",
                options: { version: "2" },
              },
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountOne/secretOne`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              secretOneKeyOne: "valueOne",
              secretOneKeyTwo: "valueTwo",
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountOne/secretTwo`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              secretTwoKeyOne: "valueOne",
              secretTwoKeyTwo: "valueTwo", // TODO: use private keys here to make sure it doesn't return them
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountTwo/data/secretThree`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              data: {
                secretThreeKeyOne: "valueOne",
                secretThreeKeyTwo: "valueTwo",
              },
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountTwo/data/secretFour`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              data: {
                secretFourKeyOne: "valueOne",
                secretFourKeyTwo: "valueTwo",
              },
            },
          })
        );
      })
    );

    const certs = await vaultCertFinder(HOST, "role", "secret");
    expect(certs).toEqual({});
  });

  test("with kv mounts with content with certs nested returns certs", async () => {
    const getKeys = (href: string): string[] => {
      if (href.includes("mountOne")) {
        return ["secretOne", "secretTwo"];
      }

      if (href.includes("mountThree")) {
        return ["secretFour"];
      }

      return ["secretThree", "mountThree/"];
    };

    server.use(
      rest.all("*", (req, res, ctx) => {
        if (req.method !== "LIST") {
          return;
        }

        return res(
          ctx.json({
            data: {
              keys: getKeys(req.url.href),
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/sys/mounts`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              "mountOne/": {
                type: "kv",
              },
              "mountTwo/": {
                type: "kv",
                options: { version: "2" },
              },
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountOne/secretOne`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              secretOneKeyOne: "valueOne",
              secretOneKeyTwo: "valueTwo",
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountOne/secretTwo`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              secretTwoKeyOne: "valueOne",
              secretTwoKeyTwo: "valueTwo", // TODO: use private keys here to make sure it doesn't return them
            },
          })
        );
      }),
      rest.get(`${HOST}/v1/mountTwo/data/secretThree`, (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              data: {
                secretThreeKeyOne: "valueOne",
                secretThreeKeyTwo: "valueTwo",
              },
            },
          })
        );
      }),
      rest.get(
        `${HOST}/v1/mountTwo/data/mountThree/secretFour`,
        (req, res, ctx) => {
          return res(
            ctx.json({
              data: {
                data: {
                  secretFourKeyOne: fixtureCerts[0],
                  secretFourKeyTwo: "valueTwo",
                },
              },
            })
          );
        }
      )
    );

    const certs = await vaultCertFinder(HOST, "role", "secret");
    expect(certs?.["mountTwo/mountThree/secretFour"][0]).toBeInstanceOf(
      X509Certificate
    );
  });
});
