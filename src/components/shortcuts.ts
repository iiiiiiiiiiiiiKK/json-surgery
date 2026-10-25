/** Keyboard shortcut definitions, kept separate so the component file only exports components. */

export interface Shortcut {
  keys: string[];
  label: string;
  group: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'Shift', 'F'], label: '格式化 JSON', group: '操作' },
  { keys: ['Ctrl', 'Shift', 'M'], label: '压缩 JSON', group: '操作' },
  { keys: ['Ctrl', 'Shift', 'S'], label: '按键名排序（数组顺序保持不变）', group: '操作' },
  { keys: ['Ctrl', 'Shift', 'C'], label: '复制全部内容', group: '操作' },
  { keys: ['Ctrl', 'Shift', 'D'], label: '下载 .json 文件', group: '操作' },
  { keys: ['Ctrl', 'Shift', 'K'], label: '清空编辑器', group: '操作' },
  { keys: ['Ctrl', 'Shift', 'O'], label: '打开本地 .json 文件', group: '操作' },
  { keys: ['Ctrl', 'Enter'], label: '重新解析并刷新分析结果', group: '操作' },
  { keys: ['Ctrl', 'F'], label: '编辑器内搜索', group: '编辑器' },
  { keys: ['Ctrl', 'Z'], label: '撤销', group: '编辑器' },
  { keys: ['Ctrl', 'Shift', 'Z'], label: '重做', group: '编辑器' },
  { keys: ['Ctrl', 'B'], label: '显示 / 隐藏右侧面板', group: '界面' },
  { keys: ['Ctrl', '1'], label: '切换到「树形」面板', group: '界面' },
  { keys: ['Ctrl', '2'], label: '切换到「查询」面板', group: '界面' },
  { keys: ['Ctrl', '3'], label: '切换到「统计」面板', group: '界面' },
  { keys: ['Ctrl', '4'], label: '切换到「Diff」面板', group: '界面' },
  { keys: ['Ctrl', 'Shift', 'T'], label: '切换深色 / 浅色主题', group: '界面' },
  { keys: ['Ctrl', 'Shift', 'U'], label: '加载示例数据', group: '界面' },
  { keys: ['Esc'], label: '关闭对话框', group: '界面' },
];
