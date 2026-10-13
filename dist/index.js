import { mkdir, realpath, rm } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { randomInt } from "node:crypto";
import { Service } from "@deepseek-ai/cordis";
import { bindTypertRemote } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";
//#region src/index.ts
/**
* Host 半：临时工作区的 Remote 服务。
*
* 创建（命名、建目录、注册 Workspace）与删除都在 Host 完成，Client 只发指令。
* 名字与路径的生成规则因此不必跨端约定。
*/
/** Remote 命名空间；Client 侧服务键为 `remote.tmpWks`。 */
var NAMESPACE = "tmpWks";
/** DSH home 下存放临时工作区的容器目录名。 */
var CONTAINER = "tmp";
/** 临时目录名前缀；删除时据此识别本插件创建的目录。 */
var PREFIX = "tmp-";
/** 随机名字符集，剔除易混淆的 0/O/1/l/I。 */
var ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
/** 随机名长度，单位：字符。 */
var ID_LENGTH = 6;
/** 目录重名后的最大重试次数，单位：次。 */
var MAX_ATTEMPTS = 5;
/** 生成一个随机目录名。 */
function shortId() {
	let id = "";
	for (let i = 0; i < ID_LENGTH; i += 1) id += ALPHABET[randomInt(31)];
	return id;
}
/**
* 判断 child 是否位于 parent 之下。
* @param parent - 父目录绝对路径。
* @param child - 待判断的绝对路径。
* @returns 严格位于其下时为 true；相等不算在内。
*/
function isInside(parent, child) {
	return child.startsWith(parent.endsWith(sep) ? parent : `${parent}${sep}`);
}
/**
* 校验目标确实是本插件创建的临时目录。
*
* 沿用调用方给出的路径与解析软链后的路径各校验一次，避免经由软链删到容器之外。
* @param home - DSH home 绝对路径。
* @param target - 待删除目录的绝对路径。
* @returns 校验结论；通过时给出可安全删除的真实路径。
*/
async function verifyTempDir(home, target) {
	const container = resolve(home, CONTAINER);
	const wanted = resolve(target);
	const reject = (base, candidate) => {
		if (candidate === base) return "refused-container";
		if (!isInside(base, candidate)) return "refused-outside";
		if (!basename(candidate).startsWith(PREFIX)) return "refused-prefix";
	};
	const shallow = reject(container, wanted);
	if (shallow !== void 0) return {
		ok: false,
		reason: shallow
	};
	let realContainer;
	let realWanted;
	try {
		realContainer = await realpath(container);
		realWanted = await realpath(wanted);
	} catch (error) {
		if (error?.code === "ENOENT") return {
			ok: false,
			reason: "missing"
		};
		throw error;
	}
	const deep = reject(realContainer, realWanted);
	if (deep !== void 0) return {
		ok: false,
		reason: deep
	};
	return {
		ok: true,
		path: realWanted
	};
}
/**
* 承载 Remote 方法的服务。
*
* Gateway 依据接收者的 `typertRemote` 绑定定位服务，因此必须是 Cordis Service。
*/
var TmpWksService = class extends Service {
	static inject = ["dshHomePath", "workspaceRegistry"];
	constructor(ctx) {
		super(ctx, NAMESPACE);
		this.typertRemote = bindTypertRemote(this, NAMESPACE, { namespace: NAMESPACE });
	}
	/** 容器目录绝对路径。 */
	container() {
		return resolve(this.ctx.dshHomePath(), CONTAINER);
	}
	/**
	* 创建临时工作区：生成未占用的目录名、建目录并登记为 Workspace。
	* @returns 新建的 Workspace 标识、目录路径与显示名。
	*/
	async create() {
		const container = this.container();
		await mkdir(container, { recursive: true });
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
			const path = join(container, `${PREFIX}${shortId()}`);
			try {
				await mkdir(path);
			} catch (error) {
				if (error?.code === "EEXIST") continue;
				throw error;
			}
			const workspace = await this.ctx.workspaceRegistry.create(path);
			return {
				workspaceId: String(workspace.id),
				path: workspace.path,
				title: workspace.title
			};
		}
		throw new Error(`could not allocate a unique temp directory name in ${MAX_ATTEMPTS} attempts`);
	}
	/**
	* 删除一个本插件创建的临时目录。
	* @param request - `path` 为待删除目录的绝对路径。
	* @returns 删除结果码；越界目标以 `refused-*` 拒绝，不会触碰磁盘。
	*/
	async deleteDirectory(request) {
		const verdict = await verifyTempDir(this.ctx.dshHomePath(), request.path);
		if (!verdict.ok) return { code: verdict.reason };
		try {
			await rm(verdict.path, { recursive: true });
			return { code: "deleted" };
		} catch (error) {
			if (error?.code === "ENOENT") return { code: "missing" };
			return {
				code: "delete-failed",
				message: String(error?.message ?? error)
			};
		}
	}
};
/**
* 机读的 Typert 贡献，供 Gateway 解析端点与参数。
*
* 参数 codec 必须为 `strict`（Client 侧 `requireStrictInputs` 强制要求）；结果都是
* JSON 安全值，用 `src-json` 即可。`service` 取上面注册的 Service key。
*/
var CONTRIBUTION = {
	package: "dsh-tmp-wks",
	face: "host",
	schemas: [],
	invocations: [{
		id: "dsh-tmp-wks#tmpWks/create",
		service: NAMESPACE,
		namespace: NAMESPACE,
		method: "create",
		invocation: { kind: "direct" },
		parameters: [],
		result: { mode: "src-json" }
	}, {
		id: "dsh-tmp-wks#tmpWks/deleteDirectory",
		service: NAMESPACE,
		namespace: NAMESPACE,
		method: "deleteDirectory",
		invocation: { kind: "direct" },
		parameters: [{
			name: "request",
			wire: "request",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: "dsh-tmp-wks#tmpWks/deleteDirectory:request",
				create: () => z.object({ path: z.string().min(1) })
			}
		}],
		result: { mode: "src-json" }
	}],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
/** 声明依赖：注册贡献需要 `typert`，`dshHomePath` 在 apply 期间即被读取。 */
var inject = ["typert", "dshHomePath"];
/**
* 挂载服务与 Remote 贡献。
* @param ctx - 插件所在的 Cordis 上下文。
*/
function apply(ctx) {
	ctx.effect(() => {
		const fiber = ctx.plugin(TmpWksService);
		return () => void fiber.dispose();
	}, "dsh-tmp-wks: service");
	ctx.effect(() => {
		const dispose = ctx.typert.register(CONTRIBUTION);
		return () => void dispose();
	}, "dsh-tmp-wks: remote contribution");
}
//#endregion
export { apply, inject };
