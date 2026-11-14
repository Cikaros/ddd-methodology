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
    intentCapture: {
      input: {
        type: "object",
        properties: {
          scenario: { type: "string", enum: ["greenfield", "incremental", "migration"] },
          who: { type: "string", maxLength: 4000 },
          result: { type: "string", maxLength: 4000 },
          accept: { type: "string", maxLength: 4000 },
          notdoing: { type: "string", maxLength: 4000 },
        },
        required: ["scenario", "who", "result", "accept", "notdoing"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { saved: { type: "boolean" }, missing: { type: "number" } },
        required: ["saved", "missing"],
        additionalProperties: false,
      },
    },
    overview: {
      input: {type:'object',properties:{sessionID:{type:'string',minLength:1,maxLength:2048}},required:['sessionID'],additionalProperties:false},
      output: {type:'object',properties:{
        phase:{type:'string'},status:{type:'string'},seq:{type:'number'},summary:{type:'string'},
        skills:{type:'array',items:{type:'string'}},
        gates:{type:'object',properties:{pass:{type:'number'},block:{type:'number'},visible:{type:'number'},na:{type:'number'}},required:['pass','block','visible','na'],additionalProperties:false},
        blockedGates:{type:'array',items:{type:'string'}},
        board:{type:'object',properties:{pending:{type:'number'},inProgress:{type:'number'},blocked:{type:'number'}},required:['pending','inProgress','blocked'],additionalProperties:false},
        canVerify:{type:'boolean'},proofSha:{type:'string'},
      },required:['phase','status','seq','summary','skills','gates','blockedGates','board','canVerify','proofSha'],additionalProperties:false},
    },
    workflow: {
      input: {type:'object',properties:{sessionID:{type:'string',minLength:1,maxLength:2048}},required:['sessionID'],additionalProperties:false},
      output: {type:'object',properties:{present:{type:'boolean'},phase:{type:'string'},status:{type:'string'},seq:{type:'number'},summary:{type:'string'},proofSha:{type:'string'}},required:['present','phase','status','seq','summary','proofSha'],additionalProperties:false},
    },
    workflowVerify: {
      input: {type:'object',properties:{sessionID:{type:'string',minLength:1,maxLength:2048},confirmed:{type:'boolean',const:true}},required:['sessionID','confirmed'],additionalProperties:false},
      output: {type:'object',properties:{status:{type:'string'},reason:{type:'string'},proofSha:{type:'string'}},required:['status','reason','proofSha'],additionalProperties:false},
    },
    workflowClose: {
      input: {type:'object',properties:{sessionID:{type:'string',minLength:1,maxLength:2048},confirmed:{type:'boolean',const:true},reason:{type:'string',minLength:3,maxLength:300}},required:['sessionID','confirmed','reason'],additionalProperties:false},
      output: {type:'object',properties:{status:{type:'string'},reason:{type:'string'}},required:['status','reason'],additionalProperties:false},
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
