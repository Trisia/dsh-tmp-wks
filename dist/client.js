window.__ModuleLoader__.load({
	id: "dsh-tmp-wks",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/ui.tsx
		/** 管理面板与弹层共用的基础控件。 */
		/** 次要说明文字样式。 */
		var MUTED = {
			fontSize: 12,
			color: "var(--dsw-alias-label-secondary)"
		};
		/** 弹层遮罩。 */
		var MASK = {
			position: "fixed",
			inset: 0,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			pointerEvents: "auto",
			background: "var(--dsw-alias-bg-overlay)"
		};
		var CARD = {
			minWidth: 360,
			maxWidth: "90vw",
			maxHeight: "80vh",
			overflow: "auto",
			padding: 16,
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-1)",
			border: "1px solid var(--dsw-alias-border-l2)",
			color: "var(--dsw-alias-label-primary)",
			boxShadow: "0 8px 32px rgba(0,0,0,0.24)"
		};
		/** 同层多个弹层若共用 z-index，内层无法盖住外层，故按打开顺序递增。 */
		var openModals = 0;
		/** 弹层基础层级。 */
		var MASK_BASE_Z = 1e3;
		/** 分配一个新的弹层层级，单位：z-index 数值。 */
		function nextZ() {
			return MASK_BASE_Z + (openModals + 1) * 10;
		}
		/**
		* 弹层容器：遮罩 + 卡片 + 键盘与焦点处理。
		* @param props.title - 标题，同时作为无障碍名称。
		* @param props.description - 可选的说明文字。
		* @param props.footer - 底部操作区。
		* @param props.onClose - 关闭回调，由 Esc、点击遮罩或调用方触发。
		* @param props.children - 卡片主体内容。
		*/
		function Modal({ title, description, footer, onClose, children }) {
			const cardRef = react.default.useRef(null);
			const zRef = react.default.useRef(0);
			if (zRef.current === 0) zRef.current = nextZ();
			react.default.useEffect(() => {
				openModals += 1;
				return () => {
					openModals -= 1;
				};
			}, []);
			react.default.useEffect(() => {
				const previous = globalThis.document?.activeElement;
				cardRef.current?.focus();
				const onKeyDown = (event) => {
					if (event.key === "Escape") onClose();
				};
				globalThis.document?.addEventListener("keydown", onKeyDown);
				return () => {
					globalThis.document?.removeEventListener("keydown", onKeyDown);
					if (previous instanceof globalThis.HTMLElement && globalThis.document?.contains(previous)) previous.focus();
				};
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					...MASK,
					zIndex: zRef.current
				},
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: cardRef,
					role: "dialog",
					"aria-modal": true,
					"aria-label": title,
					tabIndex: -1,
					style: {
						...CARD,
						outline: "none"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 15,
								fontWeight: 600,
								marginBottom: 8
							},
							children: title
						}),
						description === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								...MUTED,
								marginBottom: 12
							},
							children: description
						}),
						children,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "flex",
								justifyContent: "flex-end",
								gap: 8,
								marginTop: 16
							},
							children: footer
						})
					]
				})
			});
		}
		/**
		* 弹层内的操作按钮。
		* @param props.variant - `primary` 为主题色实心，默认描边。
		* @param props.disabled - 禁用时不响应点击。
		* @param props.onClick - 点击回调。
		*/
		function Btn({ variant = "outline", disabled = false, onClick, children }) {
			const primary = variant === "primary";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				disabled,
				onClick,
				style: {
					padding: "5px 12px",
					borderRadius: 6,
					fontSize: 13,
					cursor: disabled ? "default" : "pointer",
					opacity: disabled ? .6 : 1,
					border: primary ? "none" : "1px solid var(--dsw-alias-border-l2)",
					background: primary ? "var(--dsw-alias-button-primary-fill)" : "transparent",
					color: primary ? "var(--dsw-alias-label-primary-foreground)" : "var(--dsw-alias-label-primary)",
					font: "inherit"
				},
				children
			});
		}
		/**
		* 带说明文字的复选框。
		* @param props.checked - 当前是否勾选。
		* @param props.disabled - 禁用时不可切换。
		* @param props.label - 说明文字。
		* @param props.onChange - 勾选状态变化回调。
		*/
		function Check({ checked, disabled = false, label, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					fontSize: 13,
					cursor: disabled ? "default" : "pointer",
					opacity: disabled ? .6 : 1
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked,
					disabled,
					onChange: (event) => onChange(event.target.checked),
					style: {
						accentColor: "var(--dsw-alias-brand-primary)",
						cursor: "inherit"
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
		}
		//#endregion
		//#region src/i18n.ts
		/** 插件在 locale 服务中的命名空间。 */
		var NS = "dshTmpWks";
		/** 界面文案字典。 */
		var DICTS = {
			zh: {
				"action.create": "新建临时会话",
				"action.creating": "正在创建临时工作区…",
				"error.noHost": "当前客户端不支持临时工作区（宿主未提供 Remote 服务）",
				"error.badResponse": "宿主返回的创建结果不完整",
				"manage.title": "临时工作区",
				"manage.empty": "暂无由「新建临时会话」创建的临时工作区。",
				"manage.delete": "删除",
				"manage.cancel": "取消",
				"manage.close": "关闭",
				"delete.title": "删除临时工作区",
				"delete.desc": "将把「{name}」从工作区列表中移除。",
				"delete.removeDir": "同时删除磁盘上的临时目录",
				"delete.dirHint": "目录：{path}",
				"delete.pending": "正在删除…",
				"delete.failed": "删除失败：{message}",
				"delete.dirFailed": "工作区已移除，但目录未能删除（{code}）。",
				"cleanup.title": "临时目录仍在",
				"cleanup.desc": "工作区「{name}」已从列表移除，但它的临时目录仍然存在。要现在清理吗？",
				"cleanup.confirm": "清理目录",
				"cleanup.keep": "保留"
			},
			en: {
				"action.create": "New temp session",
				"action.creating": "Creating temp workspace…",
				"error.noHost": "This client does not support temp workspaces (no host Remote service)",
				"error.badResponse": "The host returned an incomplete creation result",
				"manage.title": "Temp workspaces",
				"manage.empty": "No temp workspaces created from \"New temp session\" yet.",
				"manage.delete": "Delete",
				"manage.cancel": "Cancel",
				"manage.close": "Close",
				"delete.title": "Delete temp workspace",
				"delete.desc": "Removes \"{name}\" from the workspace list.",
				"delete.removeDir": "Also delete the temp directory on disk",
				"delete.dirHint": "Directory: {path}",
				"delete.pending": "Deleting…",
				"delete.failed": "Delete failed: {message}",
				"delete.dirFailed": "Workspace removed, but its directory could not be deleted ({code}).",
				"cleanup.title": "Temp directory still present",
				"cleanup.desc": "Workspace \"{name}\" was removed from the list, but its temp directory still exists. Clean it up now?",
				"cleanup.confirm": "Clean up",
				"cleanup.keep": "Keep"
			}
		};
		/**
		* 替换文案中的 `{name}` 形式占位符。
		* @param text - 含占位符的文案。
		* @param values - 占位符名到替换值的映射；缺失的占位符原样保留。
		* @returns 替换后的文案。
		*/
		function fill(text, values) {
			return text.replace(/\{(\w+)\}/g, (whole, key) => key in values ? String(values[key]) : whole);
		}
		//#endregion
		//#region src/remote.ts
		/** 本地登记项的存储键。 */
		var OWNED_KEY = "dsh-tmp-wks.owned";
		/**
		* 构造带稳定 `code` 的错误。
		* @param code - 稳定的错误码，用于查文案。
		* @param message - 可选的原始描述。
		* @returns 附带 code 的错误对象。
		*/
		function codedError(code, message) {
			const error = new Error(message ?? code);
			error.code = code;
			return error;
		}
		/**
		* 把 Remote 结果折成「值或抛错」。
		*
		* Gateway 的 unary 调用永不 reject：载体故障也走 `ok: false` 分支，必须显式检查。
		* @param result - Remote 调用返回的结果信封。
		* @returns 成功时的业务值。
		*/
		function unwrap(result) {
			if (result?.ok === true) return result.value;
			const failure = result?.error;
			throw codedError(failure?.code ?? "remoteFailed", failure?.message);
		}
		/**
		* 读取本地登记。
		* @returns 登记项数组；存储不可用或内容损坏时按空登记处理。
		*/
		function readOwned() {
			try {
				const list = JSON.parse(globalThis.localStorage?.getItem(OWNED_KEY) ?? "[]");
				return Array.isArray(list) ? list.filter((record) => typeof record?.id === "string") : [];
			} catch {
				return [];
			}
		}
		/**
		* 覆盖写入本地登记。
		* @param records - 完整的新登记内容。
		*/
		function writeOwned(records) {
			try {
				globalThis.localStorage?.setItem(OWNED_KEY, JSON.stringify(records));
			} catch {}
		}
		/**
		* 请求 Host 创建临时工作区，并把结果登记到本地。
		* @param remote - Remote 服务面；未挂载时为 undefined。
		* @returns 新建的工作区信息。
		*/
		async function createTempWorkspace(remote) {
			if (remote === void 0) throw codedError("noHost");
			const created = unwrap(await remote.create());
			if (typeof created?.workspaceId !== "string" || typeof created?.path !== "string") throw codedError("badResponse");
			writeOwned([...readOwned(), {
				id: created.workspaceId,
				path: created.path
			}]);
			return created;
		}
		/**
		* 请求 Host 删除临时目录。
		* @param remote - Remote 服务面；未挂载时为 undefined。
		* @param path - 待删除目录的绝对路径。
		* @returns 结果码；无法调用时返回 `request-failed`。
		*/
		async function deleteTempDirectory(remote, path) {
			if (remote === void 0) return "request-failed";
			const value = unwrap(await remote.deleteDirectory({ path }));
			return typeof value?.code === "string" ? value.code : "request-failed";
		}
		//#endregion
		//#region src/sidebar-button.tsx
		/** 侧边栏「新建临时会话」按钮的图标与样式。 */
		/** 虚线方框加号；用 currentColor 跟随主题。 */
		function TempIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				style: { flex: "0 0 auto" },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: 2,
					y: 2,
					width: 12,
					height: 12,
					rx: 2,
					strokeDasharray: "2.5 2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 5.5v5M5.5 8h5" })]
			});
		}
		/**
		* 侧边栏按钮样式。
		* @param wide - 侧边栏展开时左对齐显示文字，收起时只留图标。
		* @param busy - 创建中时降低不透明度并禁用指针。
		* @returns 按钮的行内样式。
		*/
		function buttonStyle(wide, busy) {
			return {
				display: "flex",
				alignItems: "center",
				justifyContent: wide ? "flex-start" : "center",
				gap: 8,
				width: "100%",
				minHeight: 32,
				padding: wide ? "0 8px" : 0,
				border: "none",
				borderRadius: 6,
				background: "transparent",
				color: "inherit",
				font: "inherit",
				fontSize: 13,
				cursor: busy ? "default" : "pointer",
				opacity: busy ? .6 : 1,
				textAlign: "left",
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis"
			};
		}
		//#endregion
		//#region src/client.tsx
		/**
		* Client 半：侧边栏「新建临时会话」按钮与临时工作区管理面板。
		*
		* 只负责界面与导航：不算路径、不生成目录名、不注册 Workspace、不碰磁盘，
		* 后端动作一律经 `ctx.remote.tmpWks`。
		*/
		/** 管理面板自己删掉的工作区 id；补救提示跳过它们，避免重复提示。 */
		var selfDeleted = /* @__PURE__ */ new Set();
		function DeleteDialog({ workspaceId, title, path, t, onClose, onDone }) {
			const [removeDir, setRemoveDir] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const close = () => {
				if (!busy) onClose();
			};
			const confirm = () => {
				setBusy(true);
				setError(null);
				onDone({
					workspaceId,
					path,
					removeDir
				}).then((outcome) => {
					setBusy(false);
					if (outcome?.failed === void 0) onClose();
					else setError(fill(t("delete.failed"), { message: outcome.failed }));
				}, (reason) => {
					setBusy(false);
					setError(fill(t("delete.failed"), { message: String(reason?.message ?? reason) }));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
				onClose: close,
				title: t("delete.title"),
				description: fill(t("delete.desc"), { name: title }),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
					disabled: busy,
					onClick: close,
					children: t("manage.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
					variant: "primary",
					disabled: busy,
					onClick: confirm,
					children: t("delete.title")
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 10
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Check, {
							checked: removeDir,
							onChange: setRemoveDir,
							disabled: busy,
							label: t("delete.removeDir")
						}),
						removeDir ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								...MUTED,
								wordBreak: "break-all"
							},
							children: fill(t("delete.dirHint"), { path })
						}) : null,
						busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "status",
							style: MUTED,
							children: t("delete.pending")
						}) : null,
						error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							style: {
								...MUTED,
								color: "var(--dsw-alias-state-error-primary)"
							},
							children: error
						})
					]
				})
			});
		}
		function ManagePanel({ t, onClose, deps }) {
			const [snapshot, setSnapshot] = react.default.useState(() => deps.workspaces.list.getSnapshot());
			const [target, setTarget] = react.default.useState(null);
			const [owned, setOwned] = react.default.useState(readOwned);
			react.default.useEffect(() => deps.workspaces.list.subscribe(() => setSnapshot(deps.workspaces.list.getSnapshot())), [deps]);
			const rows = snapshot.items.filter((item) => owned.some((record) => String(record.id) === String(item.workspaceId)));
			/** 先移除登记，再按勾选决定是否删目录。 */
			const runDelete = async ({ workspaceId, path, removeDir }) => {
				selfDeleted.add(String(workspaceId));
				try {
					await deps.workspaces.delete(workspaceId);
					const kept = readOwned().filter((record) => record.id !== workspaceId);
					writeOwned(kept);
					setOwned(kept);
				} catch (reason) {
					return { failed: String(reason?.message ?? reason) };
				}
				if (!removeDir) return {};
				const code = await deleteTempDirectory(deps.getRemote(), path);
				return code === "deleted" || code === "missing" ? {} : { failed: fill(t("delete.dirFailed"), { code }) };
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
				onClose,
				title: t("manage.title"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
					onClick: onClose,
					children: t("manage.close")
				}),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 8,
						minWidth: 320
					},
					children: [rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 13,
							color: "var(--dsw-alias-label-secondary)"
						},
						children: t("manage.empty")
					}) : rows.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "6px 8px",
							borderRadius: 6,
							background: "var(--dsw-alias-bg-layer-2)"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								flex: 1,
								minWidth: 0
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 13,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								},
								children: item.title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 11,
									color: "var(--dsw-alias-label-tertiary)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								},
								children: item.path
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => setTarget(item),
							children: t("manage.delete")
						})]
					}, String(item.workspaceId))), target === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeleteDialog, {
						workspaceId: target.workspaceId,
						title: target.title,
						path: target.path,
						t,
						onClose: () => setTarget(null),
						onDone: runDelete
					})]
				})
			});
		}
		/**
		* 事后补救提示：内置删除按钮移除了登记，但临时目录可能仍在磁盘上。
		*
		* 内置的工作区删除按钮不是 slot，既无法拦截、也无法往它的确认框加控件，
		* 只能在删除发生后对比登记与列表来发现。
		*/
		function CleanupPrompt({ deps, t }) {
			const [pending, setPending] = react.default.useState(null);
			react.default.useEffect(() => {
				const check = () => {
					const live = new Set(deps.workspaces.list.getSnapshot().items.map((item) => String(item.workspaceId)));
					const records = readOwned();
					const liveRecords = records.filter((record) => live.has(String(record.id)));
					const missing = records.find((record) => !live.has(String(record.id)) && typeof record.path === "string" && !selfDeleted.has(String(record.id)));
					if (liveRecords.length !== records.length) writeOwned(liveRecords);
					if (missing !== void 0) setPending(missing.path ?? null);
				};
				check();
				return deps.workspaces.list.subscribe(check);
			}, [deps]);
			if (pending === null) return null;
			const settle = (clean) => {
				setPending(null);
				if (clean) deleteTempDirectory(deps.getRemote(), pending);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
				onClose: () => settle(false),
				title: t("cleanup.title"),
				description: fill(t("cleanup.desc"), { name: pending }),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
					onClick: () => settle(false),
					children: t("cleanup.keep")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
					variant: "primary",
					onClick: () => settle(true),
					children: t("cleanup.confirm")
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						...MUTED,
						wordBreak: "break-all"
					},
					children: pending
				})
			});
		}
		/** 管理面板开关：模块级单例，由侧边栏按钮写入、浮层条目读取。 */
		var manager = {
			open: false,
			listeners: /* @__PURE__ */ new Set()
		};
		/** 通知所有浮层条目重新读取开关状态。 */
		function notifyManager() {
			for (const listener of manager.listeners) listener();
		}
		/** 由侧边栏按钮调用：打开管理面板。 */
		function openManager() {
			manager.open = true;
			notifyManager();
		}
		/** 由浮层条目调用：关闭管理面板。 */
		function closeManager() {
			manager.open = false;
			notifyManager();
		}
		/**
		* 订阅管理面板开关。
		* @param listener - 开关变化时被调用。
		* @returns 取消订阅函数。
		*/
		function subscribeManager(listener) {
			manager.listeners.add(listener);
			return () => void manager.listeners.delete(listener);
		}
		function ManagerOverlay({ deps, onClose, t }) {
			const [open, setOpen] = react.default.useState(manager.open);
			react.default.useEffect(() => {
				const sync = () => setOpen(manager.open);
				sync();
				return subscribeManager(sync);
			}, []);
			return open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagePanel, {
				t,
				onClose,
				deps
			}) : null;
		}
		/**
		* 本插件 Client 侧的 Remote 贡献，与 Host 的 `ctx.typert.register()` 一一对应。
		*
		* 只声明端点；`namespace` 决定挂载后的服务键 `remote.tmpWks`。参数 codec 必须
		* `strict`（Client 侧 `requireStrictInputs` 强制），这里只做参数装配，故校验器从简。
		*/
		var CONTRIBUTION = {
			package: "dsh-tmp-wks",
			descriptors: [{
				id: "dsh-tmp-wks#tmpWks/create",
				service: "tmpWks",
				namespace: "tmpWks",
				method: "create",
				invocation: { kind: "direct" },
				parameters: [],
				result: { mode: "src-json" }
			}, {
				id: "dsh-tmp-wks#tmpWks/deleteDirectory",
				service: "tmpWks",
				namespace: "tmpWks",
				method: "deleteDirectory",
				invocation: { kind: "direct" },
				parameters: [{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: "dsh-tmp-wks#tmpWks/deleteDirectory:request",
						create: () => ({ parse: (value) => value })
					}
				}],
				result: { mode: "src-json" }
			}]
		};
		/**
		* 侧边栏按钮：左键创建临时工作区并进入会话，右键打开管理面板。
		*/
		function NewTempSessionButton({ wide, getRemote, uiWorkspace, t, openManager }) {
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const label = error ?? (busy ? t("action.creating") : t("action.create"));
			const onClick = react.default.useCallback(() => {
				if (busy) return;
				setBusy(true);
				setError(null);
				createTempWorkspace(getRemote()).then((created) => {
					setBusy(false);
					uiWorkspace.startSession(created.workspaceId);
				}, (reason) => {
					setBusy(false);
					setError(reason?.code === void 0 ? String(reason?.message ?? reason) : t(`error.${reason.code}`));
				});
			}, [
				busy,
				getRemote,
				uiWorkspace,
				t
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				title: label,
				"aria-label": label,
				disabled: busy,
				onClick,
				onContextMenu: (event) => {
					event.preventDefault();
					openManager();
				},
				style: buttonStyle(wide, busy),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TempIcon, {}), wide ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }) : null]
			});
		}
		/**
		* Client 半入口，由 Vite 打包成单文件 bundle。
		* @param ctx - Client 侧根上下文。
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, "zh", DICTS.zh), "dsh-tmp-wks: zh dictionary");
			ctx.effect(() => ctx.locale.register(NS, "en", DICTS.en), "dsh-tmp-wks: en dictionary");
			ctx.effect(async () => {
				try {
					const dispose = await ctx.remote.$mount(CONTRIBUTION);
					return () => void dispose();
				} catch (error) {
					console.error("[dsh-tmp-wks] $mount failed:", error);
					throw error;
				}
			}, "dsh-tmp-wks: remote methods");
			const remote = () => ctx.get(`remote.tmpWks`);
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "new-temp-session",
				order: 50,
				locale: NS,
				inject: () => ({
					getRemote: remote,
					uiWorkspace: ctx.uiWorkspace,
					openManager
				})
			}, NewTempSessionButton));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "temp-workspace-manager",
				order: 300,
				locale: NS,
				inject: () => ({
					deps: {
						workspaces: ctx.workspaces,
						getRemote: remote
					},
					onClose: closeManager
				})
			}, ManagerOverlay));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "temp-workspace-cleanup",
				order: 310,
				locale: NS,
				inject: () => ({ deps: {
					workspaces: ctx.workspaces,
					getRemote: remote
				} })
			}, CleanupPrompt));
		}
		/** 所需 Client 服务；加载器读取此声明而非对象字面量导出。 */
		var inject = [
			"slots",
			"uiWorkspace",
			"workspaces",
			"locale",
			"remote",
			"typert"
		];
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
