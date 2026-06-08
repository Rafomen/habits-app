export default {
  default: {
    override: {
      wrapper: "cloudflare-node" as const,
      converter: "edge" as const,
      proxyExternalRequest: "fetch" as const,
      incrementalCache: "dummy" as const,
      tagCache: "dummy" as const,
      queue: "dummy" as const,
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge" as const,
      converter: "edge" as const,
      proxyExternalRequest: "fetch" as const,
      incrementalCache: "dummy" as const,
      tagCache: "dummy" as const,
      queue: "dummy" as const,
    },
  },
};
