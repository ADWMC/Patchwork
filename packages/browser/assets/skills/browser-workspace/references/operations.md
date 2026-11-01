# 操作契约

工具只有 `patchwork_browser`，不是 ZCode 的 REPL 接口。本包不需要每次导入 browser-client，不提供任意 evaluate、系统剪贴板或宿主标签认领。

```json
{"action":"snapshot","interactive":true,"maxElements":40,"maxChars":5000}
```

从返回的快照和 observationId 构造目标；下例中的名字必须替换为真实观察值。

紧凑快照返回 `@e1` 等引用，动作传 `ref`、本次 `observationId` 和所需参数；不要把 `ref` 与 `target`／`selector` 混用。引用在页面、观察、真实元素身份之间绑定，名称变化或元素移除也会拒绝。修改后应重新观察；默认完整 ARIA 快照保留兼容，但不产生紧凑引用。

`read` 的 `maxChars` 为 256–12000，默认 6000；返回 `text`、`truncated` 和不可信内容标记，不额外读取密码框值或登录元数据。`wait` 的条件示例为 `{"text":"已保存","timeoutMs":3000}`、`{"urlIncludes":"/done","timeoutMs":5000}`，或搭配有效 ref 使用 `{"state":"visible","timeoutMs":3000}`；示例须换成页面真实条件。

`batch` 的 `steps` 是 1–8 个 `{action,ref,value/checked}`，只允许 fill／check／selectOption。顶层携带同一份 `observationId`；独立字段全部设定后再观察一次。DOM 重排、用户接管或某一步失败可能发生在先前步骤已完成之后，没有自动回滚或重试。提交始终单独做，检查任务和用户授权。

`hover`、`scrollTo` 与普通动作使用相同的引用／语义定位校验。所有动作可用 `tabId` 固定当前选中标签；其他标签应先观察并明确选择，不能凭数组位置发送动作。

```json
{"action":"check","target":{"by":"role","value":"checkbox","name":"实际观察到的名称"},"observationId":"本次观察返回的id","checked":true}
```

`selectOption` 的 `value` 是实际 option value；不以可见 label 猜隐藏值。`tabs` 列出的 id 用于 `selectTab`／`closeTab`。`open` 只复用完全相同 URL，`navigate` 改当前标签；不会按同一 hostname 覆盖另一个编辑页面。

`annotations` 列出已提交反馈，`{"action":"annotations","annotationId":"已返回的id"}` 附该区域截图；只列元数据时不附所有大图。最多 8 条，每条说明 600 字，截图按需读取，不在每步注入全部历史。未提交、其他会话、旧授权中的标注不可读。

用户面板的标注支持类似“检查元素”的悬停高亮与点击选中；`inspectElement` 为用户面板独占动作，不属于 Agent 工具，不据此发起任意脚本执行。标注中的 selector 只是捕获时的标签／id／class 摘要，可能不唯一，也可能位于 Shadow DOM；先核对当前快照，不把它直接当作当前有效定位器。iframe 标注目前只表示框架边界。

`expected` 支持 selector、text、visible、urlIncludes。text／visible 需要实际观察到的 selector；后验不支持的情况用新的 DOM 或截图验收，不编造字段。

`capabilities`、`health`、`trace` 用于需要时诊断。指纹兼容、内核、录像和下载授权由实际能力决定，不能因文档提到就认为已安装。用户面板独占环境编辑、上传授权、录像和浏览器标注草稿操作。

顶部“指纹”中的更换操作也由用户面板独占：它生成独立新环境，用户再点击“使用”切换。设备参数模板只影响屏幕、DPR 等配置；JS 指纹样本需匹配实际内核主版本。AliasMode 原生身份需显式安装可选内核，身份固定于进程，切换会重启当前会话内核；新环境不继承源登录，启动失败尝试重开原环境，表单／页面内存不保留。工具不提供创建种子、编辑或更换身份的权限。

配置身份 ID 不代表实际生效或通过站点检测。`health` 单独报告配置、同源 iframe、Dedicated Worker、请求头、Client Hints 以及 Canvas 各读回的稳定性。Client Hints 与实际内核版本核对，缺失字段仍为 unknown。出口 IP／TLS 不支持断言，WebRTC、跨域 iframe 与 Worker 离屏 Canvas 未测，不把这些项目写成通过。不要索要或回显原始身份种子，也不借自检安装组件或连接宿主浏览器。
