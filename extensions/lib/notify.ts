/**
 * 用户提示的单一实现
 *
 * 目标：收敛各扩展对宿主 UI 通知的守卫与兜底，向用户呈现一条提示——有真实 UI 时走宿主通知，否则写 stderr，
 *   使提示在无界面模式下不被静默丢弃。
 * 范围：只做「走宿主通知还是写 stderr」这一个判定与呈现；不组装消息文本、不加前缀、不关心调用方语义，前缀由调用方自备。
 * 不包含：消息内容的构造（各处语义不同，前缀与措辞由调用方给出）、各扩展的入口与注册逻辑、通知之外的其它宿主能力。
 *
 * 判定规则：须同时满足「ctx.hasUI 为真」与「ctx.ui.notify 可用」两条，才走宿主通知。
 *   只判 ui.notify 是否为函数是不够的：宿主在 print 与 json 模式下会绑一个存在但什么都不做的 no-op 通知函数，
 *   此时该判定为真，提示被吞掉且 stderr 兜底永不执行——这正是本模块要修掉的缺陷形态，不得退回只判函数存在。
 * 兜底走 stderr 的原因：JSON 模式把 stdout 留给协议，诊断信息必须避开 stdout。
 * 异常一律吞掉：提示失败是旁路故障，不得升级为会话中断。
 * 依赖：只用语言内建能力，不引入宿主包，故任何扩展均可安全导入。
 */

export type NotifyType = "info" | "warning" | "error";
type HostContext = { hasUI?: unknown; ui?: { notify?: (message: string, type?: string) => void } };

export function notifyUser(ctx: HostContext | undefined, message: string, type: NotifyType = "warning"): void {
	try {
		if (ctx && ctx.hasUI === true && ctx.ui && typeof ctx.ui.notify === "function") {
			ctx.ui.notify(message, type);
			return;
		}
	} catch {
		// 宿主通知抛错不得升级为会话中断，落到 stderr 兜底
	}
	console.error(message);
}
