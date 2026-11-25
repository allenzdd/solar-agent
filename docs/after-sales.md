# 小源售后查询

入口：小源「···」中的设备质保、备件物流、转到人工客服，或直接输入自然语言。

- 查询设备 DEMO-SZ-INV-001 的质保
- 查询设备 DEMO-SZ-ESS-001 的质保（2026-12-10 到期）
- 查询设备 DEMO-SZ-INV-002 的质保（已过保）
- 查询备件物流，SN DEMO-SZ-INV-001（两条记录）
- 查询备件物流，服务单号 DEMO-SR-2026111801（运输中）
- 查询备件物流，RMA DEMO-RMA-2026111201（已签收）
- 转到人工客服

只读接口：

- GET /api/workspace/service/examples
- GET /api/workspace/service/warranty?sn=DEMO-SZ-INV-001
- GET /api/workspace/service/logistics?query=DEMO-SZ-INV-001

Agent 工具：query_device_warranty({sn})、query_spare_parts_logistics({query})。工具与HTTP使用 server/after-sales.mjs 的同一提供层。固定演示记录不关联真实设备，不会因未知SN编造质保或物流记录。查询返回来源、样例截至时间、实际查询时间。运输中样例的到货日为固定快照计划，不是实时配送承诺。

质保日期按北京时间计算，截止日全天有效。临近到期阈值30天。扫码在浏览器本地使用 BarcodeDetector 读取照片，不上传图片；不支持时提示手动输入SN。当前HTTP站点及不支持该API的浏览器可能无法扫码。

人工转接复用既有模拟客服流程，卡片转接将SN、质保期或RMA及状态带入摘要，不创建真实工单、不向外部平台发送消息。直接query也会先给出服务选择与转接入口。

接真实厂家或物流系统时，应替换 server/after-sales.mjs 提供层，同时添加账号鉴权、记录访问权限、承运商/厂家连接配置；不可直接在当前公开演示接口暴露真实收件人信息。
