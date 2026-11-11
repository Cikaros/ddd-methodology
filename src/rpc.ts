/**
 * src/rpc.ts —— RPC 契约（server ↔ tui/外部客户端）。
 *
 * 边界：只放 Rpc.define，不含实现（§8.4 契约与实现分离）。
 * 事件数据必须是 object；id 为命名空间（前缀 rpc.ddd.*）。
 * 外部客户端可直连 POST /api/rpc/ddd/{method}；入参须服务端校验（不能只靠 TS 类型）。
 */

import { Rpc } from "@opencode/plugin/rpc";

const emptyInput = { type: "object", properties: {}, additionalProperties: false } as const;

const gateReading = {
  type: "object",
  properties: {
    id: { type: "string" },
    verdict: { type: "string" },
    examined: { type: "number" },
    unrecognized: { type: "number" },
    remedy: { type: "string" },
  },
  required: ["id", "verdict", "examined", "unrecognized"],
  additionalProperties: false,
} as const;

export const Ddd = Rpc.define({
  id: "ddd",
  methods: {
    gates: {
      input: emptyInput,
      output: {
        type: "object",
        properties: {
          readings: { type: "array", items: gateReading },
          summary: {
            type: "object",
            properties: {
              pass: { type: "number" },
              block: { type: "number" },
              visible: { type: "number" },
              na: { type: "number" },
            },
            required: ["pass", "block", "visible", "na"],
            additionalProperties: false,
          },
        },
        required: ["readings", "summary"],
        additionalProperties: false,
      },
    },
    board: {
      input: emptyInput,
      output: {
        type: "object",
        properties: {
          pending: { type: "number" },
          inProgress: { type: "number" },
          blocked: { type: "number" },
        },
        required: ["pending", "inProgress", "blocked"],
        additionalProperties: false,
      },
    },
  },
  events: {
    refreshed: {
      schema: {
        type: "object",
        properties: {
          gate: { type: "string" },
          verdict: { type: "string" },
        },
        required: ["gate", "verdict"],
        additionalProperties: false,
      },
    },
  },
});

export type DddContract = typeof Ddd;
