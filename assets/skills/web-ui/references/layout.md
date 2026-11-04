# 布局心智模型：Flex 与 Grid

来源参考：[冰可乐的前端笔记 · CSS 布局进阶](https://note.bingkele.cc/content/docs/45)。这里只保留可复用的判断方法，不复制原文。

## 先定轴，再选属性

Flex 的属性语义由轴决定：

- `justify-content` 沿主轴排列；`align-items` 沿交叉轴对齐。
- `flex-direction: row` 时主轴水平；`column` 时主轴垂直。
- 先确认主轴，再判断该用 `justify-*` 还是 `align-*`，不要凭属性名猜。

## Flex 的尺寸分配

按三步理解：

1. `flex-basis` 决定起始尺寸（`auto` 会参考内容/宽度）。
2. 有剩余空间时按 `flex-grow` 分配。
3. 空间不足时按 `flex-shrink` 压缩，但会被 `min-width` 限制。

常见写法：

- `flex: 1` ≈ `flex: 1 1 0%`，倾向平均分剩余空间。
- `flex: 0 0 auto` 不伸不缩，按内容/宽度。

## 最常见的溢出

Flex 子项默认 `min-width: auto`，长 URL、英文串或不可断词内容会拒绝收缩，把布局撑爆。

需要收缩的列：

```css
flex: 1;
min-width: 0;
overflow: hidden;
text-overflow: ellipsis;
```

先加 `min-width: 0`，再决定 `overflow` 和文本截断；不要先改父容器宽度。

## 选型

- **一维排列、顺序/对齐/分配空间**：Flex。
- **同时定义行列、区域对齐、卡片网格**：Grid。
- 复杂页面区域明确时，`grid-template-areas` 往往比多层 Flex 嵌套更易读。
- 自适应卡片优先 `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`，少写媒体查询。
- 间距优先 `gap`，不要用“最后一个元素去掉 margin”。

## 排查顺序

1. 先看轴和 `flex-direction` 是否符合预期。
2. 再看 `flex-basis/grow/shrink` 和 `min-width`。
3. 检查内容是否不可断词、是否被固定宽度限制。
4. 临时加 `outline` 看盒子边界，确认是布局还是溢出。
5. 在实际目标宽度看截图；不要只凭 CSS 推断视觉结果。

## 常用配方

- 居中：`display:flex; align-items:center; justify-content:center`。
- 左固定 + 右自适应：左 `width`，右 `flex:1; min-width:0`。
- 顶部固定 + 底部贴底：页面 `min-height:100vh; flex-direction:column`，主区 `flex:1`。
