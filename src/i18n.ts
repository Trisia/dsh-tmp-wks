/** 界面文案与占位符替换。 */

/** 文案查询函数，按 key 返回当前语言的文本。 */
export type Translate = (key: string) => string

/** 插件在 locale 服务中的命名空间。 */
export const NS = 'dshTmpWks'

/** 界面文案字典。 */
export const DICTS = {
  zh: {
    'action.create': '新建临时会话',
    'action.creating': '正在创建临时工作区…',
    'error.noHost': '当前客户端不支持临时工作区（宿主未提供 Remote 服务）',
    'error.badResponse': '宿主返回的创建结果不完整',
    'manage.title': '临时工作区',
    'manage.empty': '暂无由「新建临时会话」创建的临时工作区。',
    'manage.delete': '删除',
    'manage.cancel': '取消',
    'manage.close': '关闭',
    'delete.title': '删除临时工作区',
    'delete.desc': '将把「{name}」从工作区列表中移除，并删除磁盘上的临时目录。',
    'delete.dirHint': '目录：{path}',
    'delete.pending': '正在删除…',
    'delete.failed': '删除失败：{message}',
    'delete.dirFailed': '工作区已移除，但目录未能删除（{code}）。',
    'cleanup.title': '清理临时目录',
    'cleanup.desc': '工作区已从列表移除，但它的临时目录仍在磁盘上：{name}。要现在清理吗？',
    'cleanup.confirm': '清理目录',
    'cleanup.keep': '保留',
  },
  en: {
    'action.create': 'New temp session',
    'action.creating': 'Creating temp workspace…',
    'error.noHost': 'This client does not support temp workspaces (no host Remote service)',
    'error.badResponse': 'The host returned an incomplete creation result',
    'manage.title': 'Temp workspaces',
    'manage.empty': 'No temp workspaces created from "New temp session" yet.',
    'manage.delete': 'Delete',
    'manage.cancel': 'Cancel',
    'manage.close': 'Close',
    'delete.title': 'Delete temp workspace',
    'delete.desc': 'Removes "{name}" from the workspace list and deletes its temp directory on disk.',
    'delete.dirHint': 'Directory: {path}',
    'delete.pending': 'Deleting…',
    'delete.failed': 'Delete failed: {message}',
    'delete.dirFailed': 'Workspace removed, but its directory could not be deleted ({code}).',
    'cleanup.title': 'Clean up temp directory',
    'cleanup.desc': 'The workspace was removed from the list, but its temp directory is still on disk: {name}. Clean it up now?',
    'cleanup.confirm': 'Clean up',
    'cleanup.keep': 'Keep',
  },
}

/**
 * 替换文案中的 `{name}` 形式占位符。
 * @param text - 含占位符的文案。
 * @param values - 占位符名到替换值的映射；缺失的占位符原样保留。
 * @returns 替换后的文案。
 */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole))
}