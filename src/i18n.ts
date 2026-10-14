/** 界面文案与占位符替换。 */

/** 文案查询函数，按 key 返回当前语言的文本。 */
export type Translate = (key: string) => string

/** 插件在 locale 服务中的命名空间。 */
export const NS = 'dshTmpWks'

/** 界面文案字典。 */
export const DICTS = {
  zh: {
    'action.create': '新建临时会话',
    'action.creating': '创建中…',
    'error.noHost': '当前环境不支持临时工作区',
    'error.badResponse': '创建失败，返回结果不完整',
    'manage.title': '临时工作区',
    'manage.cancel': '取消',
    'manage.close': '关闭',
    'refuse.container': '这是存放目录本身，不能删。',
    'refuse.outside': '这个目录不在存放目录里，不能删。',
    'refuse.unknown': '这个目录不是本插件创建的，不能删。确实要清掉请手动删除。',
    'cleanup.title': '清理临时目录',
    'cleanup.desc': '工作区已从列表移除，但临时目录还在磁盘上，要现在清理吗？',
    'cleanup.confirm': '清理目录',
    'cleanup.keep': '保留',
    'delete.pending': '删除中…',
    'delete.failed': '删除失败：{message}',
    'delete.dirFailed': '目录删除失败（{code}）。',
    'settings.title': '临时工作区',
    'settings.desc': '设置临时工作区的存放位置和目录命名。',
    'settings.tempDir.label': '存放目录',
    'settings.tempDir.hint': '相对路径基于 DSH 主目录，绝对路径则直接使用。',
    'settings.dirPrefix.label': '目录名前缀',
    'settings.dirPrefix.hint': '只影响新目录的命名，不影响已有目录能否删除。',
    'settings.confirmDirDelete.label': '删除前询问是否清理目录',
    'settings.confirmDirDelete.hint': '关闭后，删除工作区时会直接删掉磁盘目录。',
    'settings.save': '保存',
    'settings.saving': '保存中…',
    'settings.saved': '已保存',
    'settings.reset': '恢复默认',
    'settings.overridden': '已自定义',
    'settings.current': '当前：{value}',
    'settings.unavailable': '当前环境不支持修改配置。',
    'settings.invalidPrefix': '只能是单个目录名，不能含路径分隔符。',
    'settings.rejected': '配置未能保存，已恢复为原值。',
  },
  en: {
    'action.create': 'New temp session',
    'action.creating': 'Creating…',
    'error.noHost': 'Temp workspaces are not available here',
    'error.badResponse': 'Creation failed: incomplete response',
    'manage.title': 'Temp workspaces',
    'manage.cancel': 'Cancel',
    'manage.close': 'Close',
    'refuse.container': 'This is the container directory itself, so it cannot be deleted.',
    'refuse.outside': 'This directory is outside the container, so it cannot be deleted.',
    'refuse.unknown': 'This directory was not created by this plugin, so it cannot be deleted. Delete it manually if you need it gone.',
    'cleanup.title': 'Clean up temp directory',
    'cleanup.desc': 'The workspace was removed from the list, but its temp directory is still on disk. Clean it up now?',
    'cleanup.confirm': 'Clean up',
    'cleanup.keep': 'Keep',
    'delete.pending': 'Deleting…',
    'delete.failed': 'Delete failed: {message}',
    'delete.dirFailed': 'Could not delete the directory ({code}).',
    'settings.title': 'Temp workspaces',
    'settings.desc': 'Where temp workspaces are stored, and how their directories are named.',
    'settings.tempDir.label': 'Container directory',
    'settings.tempDir.hint': 'Relative to the DSH home; an absolute path is used as-is.',
    'settings.dirPrefix.label': 'Directory name prefix',
    'settings.dirPrefix.hint': 'Affects new directory names only, not whether an existing one can be deleted.',
    'settings.confirmDirDelete.label': 'Ask before cleaning up the directory',
    'settings.confirmDirDelete.hint': 'When off, deleting a workspace deletes its directory right away.',
    'settings.save': 'Save',
    'settings.saving': 'Saving…',
    'settings.saved': 'Saved',
    'settings.reset': 'Reset to default',
    'settings.overridden': 'Customized',
    'settings.current': 'Current: {value}',
    'settings.unavailable': 'The configuration cannot be edited here.',
    'settings.invalidPrefix': 'Use a single directory name with no path separators.',
    'settings.rejected': 'The change could not be saved; the previous value was restored.',
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