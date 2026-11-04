# 可访问性与动效

来源参考：[WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)、[web.dev · prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)。

## 可访问性检查

- 键盘可完成主路径；焦点可见，顺序符合阅读顺序。
- 图标按钮有可访问名称；表单有 label，错误与字段关联。
- 文本对比度足够；不只用颜色表达状态。
- 触控目标有合理尺寸；状态变化有可感知提示。
- 支持 200% 缩放/窄屏，不出现内容裁切或横向滚动。
- 动效尊重 `prefers-reduced-motion`；闪烁/自动播放可控。

## 动效判断

- 动效服务理解、反馈或空间关系，不做无意义装饰。
- 高频操作短、可中断；重复触发从当前状态接续。
- 优先 `transform` / `opacity`，避免 `transition: all` 和布局抖动。
- 进出路径一致；关闭动画后功能仍完整。

## 验证

- 实际键盘走一遍：Tab、Shift+Tab、Enter/Space、Esc。
- 实际缩放到 200% 和窄屏看裁切。
- 开启减少动态效果后复查关键状态。
- 截图不能证明键盘/读屏可用；分开报告视觉与交互证据。
