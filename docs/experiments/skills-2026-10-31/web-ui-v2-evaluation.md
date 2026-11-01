# 地球探索页 Web UI 测试与验收

日期：2026-10-31。状态：已完成一次隔离 DSH 真实调用及同会话继续运行；**题目未交付，也没有 A/B 结果**。

## 改题原因

旧的 [`earth-web-ui.txt`](tasks/earth-web-ui.txt) 预设 Canvas、简单大陆、150–250 行和工具调用顺序，容易把作品压成最小实现。四次隔离 DSH 调用和用户指出的页面文案问题，保留在 [`skills-fusion-execution-2026-10-31.md`](../../skills-fusion-execution-2026-10-31.md)；旧题不覆盖。

上一版“改进 Patchwork 侧栏”需要构造任务、证据、连接和会话切换等多个宿主状态，用户难以直接复核。新题 [`earth-explorer-web-ui-v2.txt`](tasks/earth-explorer-web-ui-v2.txt) 保留地球主题，但交付物是浏览器可打开的文件；地点切换、拖动、暂停和两种视口都能直接检查。题面不点名技能，不给组件、颜色、布局或实现算法。

## 调研依据

- [Anthropic Skill Creator 原始技能](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)区分可客观断言的结果与需人工判断的设计品质，并建议同题对照技能与基线。
- [WebDev Arena 官方说明](https://arena.ai/blog/webdev-arena)采用可交互网页产物及人的成对选择；本题不能只用代码运行成功或模型自评判定 UI 品质。
- [Playwright 操作断言](https://playwright.dev/docs/writing-tests)和[截图比较](https://playwright.dev/docs/test-snapshots)适合检查控件、行为和目标视口；截图比较要固定浏览器、平台、字体和动画状态。

## 评估方法，不发给受测模型

只发送 [`earth-explorer-web-ui-v2.txt`](tasks/earth-explorer-web-ui-v2.txt)。本文件须从受测模型可读取的工作区副本中排除，否则不能称为盲测。两组使用同一固定仓库快照、模型、预算、DSH 版本、工具权限与浏览器环境，并使用独立 `DSH_HOME`、工作区和输出目录；绝不安装到主 DSH。记录题面哈希、技能版本、运行日志、耗时和 token。

只切换 `web-ui` 技能。现有 `prepare-skills-eval-overlay.mjs` 的 `core` 对 `none` 会同时改变其他六个技能，不能归因给 `web-ui`；对照副本应仅排除 `assets/skills/web-ui/` 注册，并核对实际技能目录和加载日志。一次运行只能给个案结论，不能宣称整体技能收益。

| 门槛 | 复核办法 |
| --- | --- |
| 交付 | `earth-explorer.html` 实际存在、可离线打开；阻断网络后无运行时外部请求、资源缺失或未处理异常；若有 `earth-assets/`，路径与来源可核对。 |
| 桌面与手机 | 在 1440×900、390×844 记录首屏截图；地球明显是主角，控件可见、可触及，页面没有横向溢出。 |
| 拖动 | 先暂停自转，再分别用鼠标和触控拖动；球体可见区域的前后画面发生相应变化，不以按钮文案变化代替验证。 |
| 地点 | 逐一选择北京、伦敦、纽约；选中状态与标记可见，地球转到相应区域；人工核对标记大致位置，不只检查文字。 |
| 自转 | 暂停后等待一段固定时间，球体画面保持稳定；继续后画面再次变化。截图比较前先让过渡结束。 |
| 输入与文案 | 用 Tab、Enter/Space 完成地点切换和暂停；焦点可见。页面不出现制作方法、功能清单、虚构“实时”数据或自我评价。 |

客观门槛未过即标记未完成。通过后再隐藏组别，让人并排操作两份产物，比较地球的可辨认度、光照与空间感、视觉层级、文字克制和手机适配；允许“两边都不好”或“差不多”，记录具体原因。视觉偏好不强行折成像素分数，截图差异也不能单独证明交互正确。

## 2026-10-31 首轮真实结果

官方 DSH `0.2.1-rc.2`、Patchwork preset、StepFun `step-5-preview` 在新建的独立 `DSH_HOME`、Agent 目录和空工作区运行。主 DSH 未改动。原题 SHA256 为 `f6eb634a9ad712e936e8f88a19457b0f17e3278c3f78d460cf38c31ba6ea7168`。隔离目录为 `C:\Users\Administrator\AppData\Local\Temp\patchwork-earth-v2-5b52147359d64aa9aaeba41ef80d8ee6`，其 `earth-v2-run.json`、`earth-v2-resume.json`、`earth-v2-write-now.json` 保存原始会话事件；凭据没有写入 overlay 或实验报告。

| 阶段 | 实际结果 |
| --- | --- |
| 原题，8192 输出 token | 27 次请求、664.9 秒，`max-tokens`；写了浏览器探测脚本，没有 `earth-explorer.html`。 |
| 同会话纠偏，8192 输出 token | 1 次请求、118.9 秒，全部输出用于推演，`max-tokens`；仍未写目标文件。 |
| 同会话直接写入提醒，16384 输出 token | 11 次请求、900.0 秒后隔离超时 `aborted`；7 次针对目标 HTML 的 `write` 都被 `restate the current task after new input before mutation` 拒绝。模型末尾调用 `patchwork_task define`，但超时前未再次写入。 |

为便于审查，已从第三阶段最后一次被拒绝的 `write` 调用参数中**原样回收** HTML，保存为 [`artifacts/earth-explorer-step5-v2-raw.html`](../../archive/removed-evidence.md#earth-explorer-raw)。回收文件 27,117 字节，SHA256 为 `872279bcdb3f4369665edf08d0fa9c61c06a8a37bc7602ac1a5f468f2a7d778d`，与会话参数逐字一致。它是模型生成的候选产物，**不是 DSH Agent 成功写出的交付物**。

静态检查：内联 JavaScript 可解析，无运行时 HTTP(S) URL 或 `fetch`。独立 Playwright 驱动 Edge 以 1440×900 和 390×844 打开回收文件，WebGL context 存在、无页面异常或外部请求、无横向溢出；按钮状态、鼠标/触控拖动和暂停/继续的内部状态会变化。但两张实际截图都只有星空，**地球不可见，主验收失败**。`draw()` 把像素尺寸 `R` 直接用于视场角 `2*atan(R*0.5*1.06/dist)`；在两种视口下球体投影半径约 0.94 像素。地点按钮会选中城市，伦敦和纽约的标记文字仍停在“北京”，因此地点呈现也未通过。独立截图和 `earth-v2-validation.json` 留在上述隔离目录。

## 用户反馈后的本地修订

用户指出页面左上角的操作提示既小又不适合放在作品界面。修订版为 [`artifacts/earth-explorer-step5-v2.html`](../../archive/removed-evidence.md#earth-explorer-revision)，26,450 字节，SHA256 为 `d6f89e42c306186fe2e98eb0d3f2a762a5bc3ffeab7346b68ff6fecf7877cce1`。它删除左上角副标题和底部快捷键提示，放大保留的页面标题；同时修正球体投影、纹理东西方向、地点朝向和标记投影。**这些修改由本地人工修订完成，不属于 DSH Agent 的原始交付，也不能计入该次技能评测成绩。**

同一 Playwright 脚本在 Edge 中复测修订版：1440×900 和 390×844 截图均可见地球，页面没有横向溢出、运行时异常或外部请求；三个城市的按钮选中状态与标记文字一致，暂停后 yaw 不变、继续后变化，鼠标和触控拖动改变视角。截图和 `earth-v2-validation.json` 在 `C:\Users\Administrator\AppData\Local\Temp\patchwork-earth-v2-fix-20261031`。原稿使用手绘简化海岸线，城市与大陆的地理准确性仍需人工审查；本轮复测不代表原始模型产物通过验收。
