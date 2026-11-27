"use strict";
const SOC_MIN = 10, SOC_MAX = 98;   /* 仅作为默认值：每座电站可用自身 socMin / socMax 覆盖 */
/* ================= 时间 / 时区 / 地理 / 电价 基础库 ================= */
const D2R = Math.PI / 180;
const SIMTIME = { utc: Date.now(), speed: 3600, running: true, anchored: false };
let lastTickWall = Date.now();
const BAT_MODE_NAME = { auto:'自动', charge:'强制充电', discharge:'强制放电', idle:'待机' };
const TYPE_NAME = { ci:'工商业', res:'户用' };
const MODE_NAME  = { self:'全自发自用', surplus:'自发自用余电上网' };
const PLANT_MAX  = 20;

let plantSeq = 0;
const PLANTS = [];          /* 全部仿真电站 */
let SIM = null;             /* 当前打开详情的电站 */
let simView = 'list';       /* list | detail | create */

/* 国家明细：时区 / 纬度 / 经度 / 货币 / 默认电价(当地货币每 kWh) / 城市
   电价默认值为典型参考值，创建时可修改 */
const GEO = {
  /* —— 亚洲 —— */
  '中国':      { tz:'Asia/Shanghai', lat:31.2, lng:121.5, cur:'CNY', sym:'¥', retail:0.62, fit:0.35,
                 cities:['上海','北京','苏州','杭州','深圳','广州','南京','成都','西安','青岛','武汉','合肥','天津','重庆','宁波','济南','郑州','长沙','福州','厦门','无锡','郑州','东莞','佛山','昆明','南昌','沈阳','大连','哈尔滨','兰州','乌鲁木齐','海口','南宁','贵阳','太原','石家庄','呼和浩特','西宁','银川','拉萨'] },
  '中国香港':  { tz:'Asia/Hong_Kong', lat:22.3, lng:114.17, cur:'HKD', sym:'HK$', retail:1.20, fit:0.50, cities:['香港','九龙','新界','葵涌','沙田'] },
  '中国澳门':  { tz:'Asia/Macau', lat:22.19, lng:113.54, cur:'MOP', sym:'MOP$', retail:1.20, fit:0.50, cities:['澳门','氹仔','路环'] },
  '中国台湾':  { tz:'Asia/Taipei', lat:25.03, lng:121.56, cur:'TWD', sym:'NT$', retail:4.20, fit:2.50, cities:['台北','新北','桃园','台中','台南','高雄','新竹','彰化','嘉义'] },
  '日本':      { tz:'Asia/Tokyo', lat:35.68, lng:139.69, cur:'JPY', sym:'¥', retail:28.0, fit:10.0, cities:['东京','横滨','大阪','名古屋','札幌','福冈','神户','京都','仙台','广岛'] },
  '韩国':      { tz:'Asia/Seoul', lat:37.57, lng:126.98, cur:'KRW', sym:'₩', retail:150, fit:70, cities:['首尔','釜山','仁川','大邱','大田','光州','蔚山','水原','济州'] },
  '蒙古':      { tz:'Asia/Ulaanbaatar', lat:47.89, lng:106.91, cur:'MNT', sym:'₮', retail:350, fit:150, cities:['乌兰巴托','达尔汗','额尔登特'] },
  '越南':      { tz:'Asia/Ho_Chi_Minh', lat:10.82, lng:106.63, cur:'VND', sym:'₫', retail:2800, fit:1200, cities:['胡志明市','河内','岘港','海防','芹苴','顺化','芽庄'] },
  '泰国':      { tz:'Asia/Bangkok', lat:13.76, lng:100.5, cur:'THB', sym:'฿', retail:4.20, fit:2.20, cities:['曼谷','清迈','普吉','春武里','罗勇','孔敬','合艾'] },
  '马来西亚':  { tz:'Asia/Kuala_Lumpur', lat:3.14, lng:101.69, cur:'MYR', sym:'RM', retail:0.50, fit:0.20, cities:['吉隆坡','槟城','新山','怡保','马六甲','古晋','哥打基纳巴卢'] },
  '新加坡':    { tz:'Asia/Singapore', lat:1.35, lng:103.82, cur:'SGD', sym:'S$', retail:0.28, fit:0.12, cities:['新加坡','裕廊','淡滨尼','兀兰'] },
  '印度尼西亚':{ tz:'Asia/Jakarta', lat:-6.2, lng:106.85, cur:'IDR', sym:'Rp', retail:1500, fit:700, cities:['雅加达','泗水','万隆','棉兰','巴厘岛','三宝垄','望加锡'] },
  '菲律宾':    { tz:'Asia/Manila', lat:14.6, lng:120.98, cur:'PHP', sym:'₱', retail:11.0, fit:5.0, cities:['马尼拉','宿务','达沃','奎松','克拉克','伊洛伊洛'] },
  '印度':      { tz:'Asia/Kolkata', lat:19.08, lng:72.88, cur:'INR', sym:'₹', retail:8.20, fit:3.50, cities:['孟买','新德里','班加罗尔','海得拉巴','金奈','加尔各答','浦那','艾哈迈达巴德','斋浦尔','古尔冈'] },
  '巴基斯坦':  { tz:'Asia/Karachi', lat:24.86, lng:67.0, cur:'PKR', sym:'₨', retail:45, fit:18, cities:['卡拉奇','拉合尔','伊斯兰堡','拉瓦尔品第','费萨拉巴德'] },
  '孟加拉国':  { tz:'Asia/Dhaka', lat:23.81, lng:90.41, cur:'BDT', sym:'৳', retail:10, fit:5, cities:['达卡','吉大港','库尔纳','锡尔赫特'] },
  '斯里兰卡':  { tz:'Asia/Colombo', lat:6.93, lng:79.86, cur:'LKR', sym:'Rs', retail:30, fit:15, cities:['科伦坡','康提','加勒','贾夫纳'] },
  '尼泊尔':    { tz:'Asia/Kathmandu', lat:27.72, lng:85.32, cur:'NPR', sym:'Rs', retail:12, fit:6, cities:['加德满都','博卡拉','拉利特普尔'] },
  '哈萨克斯坦':{ tz:'Asia/Almaty', lat:43.24, lng:76.95, cur:'KZT', sym:'₸', retail:45, fit:20, cities:['阿拉木图','阿斯塔纳','奇姆肯特','卡拉干达'] },
  '乌兹别克斯坦':{ tz:'Asia/Tashkent', lat:41.3, lng:69.24, cur:'UZS', sym:'soʻm', retail:1200, fit:500, cities:['塔什干','撒马尔罕','布哈拉','纳曼干'] },
  '伊朗':      { tz:'Asia/Tehran', lat:35.69, lng:51.39, cur:'IRR', sym:'﷼', retail:50000, fit:20000, cities:['德黑兰','伊斯法罕','设拉子','马什哈德','大不里士'] },
  '伊拉克':    { tz:'Asia/Baghdad', lat:33.31, lng:44.36, cur:'IQD', sym:'ع.د', retail:150, fit:60, cities:['巴格达','巴士拉','摩苏尔','埃尔比勒'] },
  '沙特阿拉伯':{ tz:'Asia/Riyadh', lat:24.71, lng:46.68, cur:'SAR', sym:'﷼', retail:0.32, fit:0.15, cities:['利雅得','吉达','达曼','麦加','麦地那','利雅得新城'] },
  '阿拉伯联合酋长国':{ tz:'Asia/Dubai', lat:25.2, lng:55.27, cur:'AED', sym:'د.إ', retail:0.42, fit:0.18, cities:['迪拜','阿布扎比','沙迦','阿治曼','哈伊马角'] },
  '卡塔尔':    { tz:'Asia/Qatar', lat:25.29, lng:51.53, cur:'QAR', sym:'﷼', retail:0.36, fit:0.16, cities:['多哈','赖扬','沃克拉'] },
  '科威特':    { tz:'Asia/Kuwait', lat:29.37, lng:47.98, cur:'KWD', sym:'د.ك', retail:0.03, fit:0.012, cities:['科威特城','哈瓦利','艾哈迈迪'] },
  '以色列':    { tz:'Asia/Jerusalem', lat:31.77, lng:35.21, cur:'ILS', sym:'₪', retail:0.60, fit:0.25, cities:['特拉维夫','耶路撒冷','海法','贝尔谢巴'] },
  '约旦':      { tz:'Asia/Amman', lat:31.95, lng:35.93, cur:'JOD', sym:'JD', retail:0.10, fit:0.05, cities:['安曼','扎尔卡','亚喀巴','伊尔比德'] },
  '土耳其':    { tz:'Europe/Istanbul', lat:41.01, lng:28.98, cur:'TRY', sym:'₺', retail:2.80, fit:1.20, cities:['伊斯坦布尔','安卡拉','伊兹密尔','布尔萨','安塔利亚','加济安泰普'] },
  '格鲁吉亚':  { tz:'Asia/Tbilisi', lat:41.72, lng:44.79, cur:'GEL', sym:'₾', retail:0.25, fit:0.12, cities:['第比利斯','巴统','库塔伊西'] },
  '阿塞拜疆':  { tz:'Asia/Baku', lat:40.41, lng:49.87, cur:'AZN', sym:'₼', retail:0.20, fit:0.10, cities:['巴库','占贾','苏姆盖特'] },
  '塞浦路斯':  { tz:'Asia/Nicosia', lat:35.19, lng:33.38, cur:'EUR', sym:'€', retail:0.25, fit:0.07, cities:['尼科西亚','利马索尔','拉纳卡','帕福斯'] },

  /* —— 欧洲 —— */
  '俄罗斯':    { tz:'Europe/Moscow', lat:55.75, lng:37.62, cur:'RUB', sym:'₽', retail:5.50, fit:2.50, cities:['莫斯科','圣彼得堡','新西伯利亚','叶卡捷琳堡','喀山','索契'] },
  '乌克兰':    { tz:'Europe/Kiev', lat:50.45, lng:30.52, cur:'UAH', sym:'₴', retail:4.50, fit:2.20, cities:['基辅','哈尔科夫','敖德萨','利沃夫','第聂伯罗'] },
  '波兰':      { tz:'Europe/Warsaw', lat:52.23, lng:21.01, cur:'PLN', sym:'zł', retail:0.75, fit:0.35, cities:['华沙','克拉科夫','罗兹','弗罗茨瓦夫','波兹南','格但斯克'] },
  '捷克':      { tz:'Europe/Prague', lat:50.08, lng:14.44, cur:'CZK', sym:'Kč', retail:4.50, fit:2.00, cities:['布拉格','布尔诺','俄斯特拉发','比尔森'] },
  '斯洛伐克':  { tz:'Europe/Bratislava', lat:48.15, lng:17.11, cur:'EUR', sym:'€', retail:0.22, fit:0.08, cities:['布拉迪斯拉发','科希策','日利纳'] },
  '匈牙利':    { tz:'Europe/Budapest', lat:47.5, lng:19.04, cur:'HUF', sym:'Ft', retail:90, fit:35, cities:['布达佩斯','德布勒森','塞格德','米什科尔茨'] },
  '罗马尼亚':  { tz:'Europe/Bucharest', lat:44.43, lng:26.11, cur:'RON', sym:'lei', retail:1.30, fit:0.50, cities:['布加勒斯特','克卢日','蒂米什瓦拉','康斯坦察'] },
  '保加利亚':  { tz:'Europe/Sofia', lat:42.7, lng:23.32, cur:'BGN', sym:'лв', retail:0.42, fit:0.18, cities:['索非亚','普罗夫迪夫','瓦尔纳','布尔加斯'] },
  '希腊':      { tz:'Europe/Athens', lat:37.98, lng:23.73, cur:'EUR', sym:'€', retail:0.22, fit:0.09, cities:['雅典','塞萨洛尼基','帕特雷','伊拉克利翁'] },
  '意大利':    { tz:'Europe/Rome', lat:41.9, lng:12.5, cur:'EUR', sym:'€', retail:0.28, fit:0.10, cities:['罗马','米兰','那不勒斯','都灵','博洛尼亚','佛罗伦萨','威尼斯','巴勒莫','卡塔尼亚'] },
  '西班牙':    { tz:'Europe/Madrid', lat:40.42, lng:-3.7, cur:'EUR', sym:'€', retail:0.22, fit:0.08, cities:['马德里','巴塞罗那','瓦伦西亚','塞维利亚','萨拉戈萨','马拉加','毕尔巴鄂','穆尔西亚'] },
  '葡萄牙':    { tz:'Europe/Lisbon', lat:38.72, lng:-9.14, cur:'EUR', sym:'€', retail:0.22, fit:0.08, cities:['里斯本','波尔图','布拉加','科英布拉','法鲁'] },
  '法国':      { tz:'Europe/Paris', lat:48.86, lng:2.35, cur:'EUR', sym:'€', retail:0.25, fit:0.06, cities:['巴黎','马赛','里昂','图卢兹','尼斯','南特','波尔多','里尔','斯特拉斯堡'] },
  '德国':      { tz:'Europe/Berlin', lat:52.52, lng:13.4, cur:'EUR', sym:'€', retail:0.35, fit:0.08, cities:['柏林','慕尼黑','汉堡','科隆','法兰克福','斯图加特','杜塞尔多夫','莱比锡','德累斯顿','汉诺威','纽伦堡','不来梅'] },
  '奥地利':    { tz:'Europe/Vienna', lat:48.21, lng:16.37, cur:'EUR', sym:'€', retail:0.25, fit:0.08, cities:['维也纳','格拉茨','林茨','萨尔茨堡','因斯布鲁克'] },
  '瑞士':      { tz:'Europe/Zurich', lat:47.38, lng:8.54, cur:'CHF', sym:'CHF', retail:0.28, fit:0.10, cities:['苏黎世','日内瓦','巴塞尔','伯尔尼','洛桑','卢塞恩'] },
  '比利时':    { tz:'Europe/Brussels', lat:50.85, lng:4.35, cur:'EUR', sym:'€', retail:0.30, fit:0.08, cities:['布鲁塞尔','安特卫普','根特','列日','布鲁日'] },
  '荷兰':      { tz:'Europe/Amsterdam', lat:52.37, lng:4.9, cur:'EUR', sym:'€', retail:0.30, fit:0.09, cities:['阿姆斯特丹','鹿特丹','海牙','乌得勒支','埃因霍温','格罗宁根'] },
  '卢森堡':    { tz:'Europe/Luxembourg', lat:49.61, lng:6.13, cur:'EUR', sym:'€', retail:0.28, fit:0.08, cities:['卢森堡市','阿尔泽特','迪基希'] },
  '英国':      { tz:'Europe/London', lat:51.51, lng:-0.13, cur:'GBP', sym:'£', retail:0.30, fit:0.06, cities:['伦敦','曼彻斯特','伯明翰','格拉斯哥','利物浦','利兹','布里斯托','爱丁堡','卡迪夫'] },
  '爱尔兰':    { tz:'Europe/Dublin', lat:53.35, lng:-6.26, cur:'EUR', sym:'€', retail:0.28, fit:0.08, cities:['都柏林','科克','戈尔韦','利默里克'] },
  '丹麦':      { tz:'Europe/Copenhagen', lat:55.68, lng:12.57, cur:'DKK', sym:'kr', retail:0.30, fit:0.07, cities:['哥本哈根','奥胡斯','欧登塞','奥尔堡'] },
  '挪威':      { tz:'Europe/Oslo', lat:59.91, lng:10.75, cur:'NOK', sym:'kr', retail:0.16, fit:0.05, cities:['奥斯陆','卑尔根','特隆赫姆','斯塔万格'] },
  '瑞典':      { tz:'Europe/Stockholm', lat:59.33, lng:18.07, cur:'SEK', sym:'kr', retail:0.20, fit:0.06, cities:['斯德哥尔摩','哥德堡','马尔默','乌普萨拉','林雪平'] },
  '芬兰':      { tz:'Europe/Helsinki', lat:60.17, lng:24.94, cur:'EUR', sym:'€', retail:0.18, fit:0.06, cities:['赫尔辛基','坦佩雷','图尔库','奥卢','埃斯波'] },
  '冰岛':      { tz:'Atlantic/Reykjavik', lat:64.15, lng:-21.94, cur:'ISK', sym:'kr', retail:0.18, fit:0.06, cities:['雷克雅未克','阿克雷里','科帕沃于尔'] },
  '塞尔维亚':  { tz:'Europe/Belgrade', lat:44.79, lng:20.45, cur:'RSD', sym:'дин', retail:12, fit:5, cities:['贝尔格莱德','诺维萨德','尼什'] },
  '克罗地亚':  { tz:'Europe/Zagreb', lat:45.81, lng:15.98, cur:'EUR', sym:'€', retail:0.22, fit:0.08, cities:['萨格勒布','斯普利特','里耶卡','杜布罗夫尼克'] },
  '斯洛文尼亚':{ tz:'Europe/Ljubljana', lat:46.06, lng:14.5, cur:'EUR', sym:'€', retail:0.22, fit:0.08, cities:['卢布尔雅那','马里博尔','采列'] },
  '爱沙尼亚':  { tz:'Europe/Tallinn', lat:59.44, lng:24.75, cur:'EUR', sym:'€', retail:0.20, fit:0.07, cities:['塔林','塔尔图','纳尔瓦'] },
  '拉脱维亚':  { tz:'Europe/Riga', lat:56.95, lng:24.11, cur:'EUR', sym:'€', retail:0.20, fit:0.07, cities:['里加','陶格夫皮尔斯','利耶帕亚'] },
  '立陶宛':    { tz:'Europe/Vilnius', lat:54.69, lng:25.28, cur:'EUR', sym:'€', retail:0.20, fit:0.07, cities:['维尔纽斯','考纳斯','克莱佩达'] },

  /* —— 非洲 —— */
  '埃及':      { tz:'Africa/Cairo', lat:30.04, lng:31.24, cur:'EGP', sym:'E£', retail:2.50, fit:1.00, cities:['开罗','亚历山德拉','吉萨','卢克索','阿斯旺'] },
  '摩洛哥':    { tz:'Africa/Casablanca', lat:33.57, lng:-7.59, cur:'MAD', sym:'DH', retail:1.20, fit:0.50, cities:['卡萨布兰卡','拉巴特','马拉喀什','非斯','丹吉尔'] },
  '阿尔及利亚':{ tz:'Africa/Algiers', lat:36.75, lng:3.04, cur:'DZD', sym:'دج', retail:12, fit:5, cities:['阿尔及尔','奥兰','君士坦丁'] },
  '突尼斯':    { tz:'Africa/Tunis', lat:36.8, lng:10.18, cur:'TND', sym:'د.ت', retail:0.35, fit:0.15, cities:['突尼斯','斯法克斯','苏塞'] },
  '尼日利亚':  { tz:'Africa/Lagos', lat:6.52, lng:3.38, cur:'NGN', sym:'₦', retail:180, fit:60, cities:['拉各斯','阿布贾','卡诺','伊巴丹','阿贝奥库塔'] },
  '肯尼亚':    { tz:'Africa/Nairobi', lat:-1.29, lng:36.82, cur:'KES', sym:'KSh', retail:22, fit:8, cities:['内罗毕','蒙巴萨','基苏木','纳库鲁'] },
  '埃塞俄比亚':{ tz:'Africa/Addis_Ababa', lat:9.03, lng:38.74, cur:'ETB', sym:'Br', retail:8, fit:3, cities:['亚的斯亚贝巴','德雷达瓦','贡德尔'] },
  '加纳':      { tz:'Africa/Accra', lat:5.6, lng:-0.19, cur:'GHS', sym:'₵', retail:1.20, fit:0.50, cities:['阿克拉','库马西','塔科拉迪'] },
  '南非':      { tz:'Africa/Johannesburg', lat:-26.2, lng:28.05, cur:'ZAR', sym:'R', retail:2.60, fit:0.90, cities:['约翰内斯堡','开普敦','德班','比勒陀利亚','伊丽莎白港'] },
  '坦桑尼亚':  { tz:'Africa/Dar_es_Salaam', lat:-6.79, lng:39.21, cur:'TZS', sym:'TSh', retail:350, fit:140, cities:['达累斯萨拉姆','阿鲁沙','多多马'] },
  '乌干达':    { tz:'Africa/Kampala', lat:0.35, lng:32.58, cur:'UGX', sym:'USh', retail:700, fit:280, cities:['坎帕拉','恩德培','金贾'] },
  '塞内加尔':  { tz:'Africa/Dakar', lat:14.72, lng:-17.47, cur:'XOF', sym:'CFA', retail:130, fit:60, cities:['达喀尔','捷斯','圣路易'] },
  '安哥拉':    { tz:'Africa/Luanda', lat:-8.84, lng:13.23, cur:'AOA', sym:'Kz', retail:60, fit:25, cities:['罗安达','洛比托','本格拉'] },
  '赞比亚':    { tz:'Africa/Lusaka', lat:-15.42, lng:28.28, cur:'ZMW', sym:'ZK', retail:4, fit:1.6, cities:['卢萨卡','恩多拉','基特韦'] },
  '莫桑比克':  { tz:'Africa/Maputo', lat:-25.97, lng:32.57, cur:'MZN', sym:'MT', retail:12, fit:5, cities:['马普托','贝拉','楠普拉'] },

  /* —— 北美洲 —— */
  '美国':      { tz:'America/New_York', lat:40.71, lng:-74.01, cur:'USD', sym:'$', retail:0.16, fit:0.05,
                 cities:['纽约','洛杉矶','芝加哥','休斯敦','凤凰城','费城','圣安东尼奥','圣迭戈','达拉斯','圣何塞','奥斯汀','西雅图','旧金山','波士顿','迈阿密','丹佛','亚特兰大','拉斯维加斯'] },
  '加拿大':    { tz:'America/Toronto', lat:43.65, lng:-79.38, cur:'CAD', sym:'C$', retail:0.18, fit:0.06,
                 cities:['多伦多','温哥华','蒙特利尔','卡尔加里','渥太华','埃德蒙顿','温尼伯','魁北克','哈利法克斯'] },
  '墨西哥':    { tz:'America/Mexico_City', lat:19.43, lng:-99.13, cur:'MXN', sym:'MX$', retail:3.20, fit:1.20, cities:['墨西哥城','瓜达拉哈拉','蒙特雷','普埃布拉','坎昆','蒂华纳'] },
  '危地马拉':  { tz:'America/Guatemala', lat:14.63, lng:-90.51, cur:'GTQ', sym:'Q', retail:1.50, fit:0.60, cities:['危地马拉城','克萨尔特南戈','埃斯昆特拉'] },
  '哥斯达黎加':{ tz:'America/Costa_Rica', lat:9.93, lng:-84.08, cur:'CRC', sym:'₡', retail:90, fit:35, cities:['圣何塞','阿拉胡埃拉','卡塔戈'] },
  '巴拿马':    { tz:'America/Panama', lat:8.98, lng:-79.52, cur:'PAB', sym:'B/.', retail:0.18, fit:0.06, cities:['巴拿马城','科隆','戴维'] },
  '古巴':      { tz:'America/Havana', lat:23.13, lng:-82.38, cur:'CUP', sym:'$', retail:5, fit:2, cities:['哈瓦那','圣地亚哥','卡马圭'] },
  '多米尼加':  { tz:'America/Santo_Domingo', lat:18.49, lng:-69.93, cur:'DOP', sym:'RD$', retail:9, fit:3.5, cities:['圣多明各','圣地亚哥','拉罗马纳'] },
  '牙买加':    { tz:'America/Jamaica', lat:18.01, lng:-76.79, cur:'JMD', sym:'J$', retail:25, fit:9, cities:['金斯敦','蒙特哥贝','西班牙镇'] },

  /* —— 南美洲 —— */
  '巴西':      { tz:'America/Sao_Paulo', lat:-23.55, lng:-46.63, cur:'BRL', sym:'R$', retail:0.75, fit:0.30, cities:['圣保罗','里约热内卢','巴西利亚','贝洛奥里藏特','库里蒂巴','阿雷格里港','萨尔瓦多','累西腓','福塔莱萨'] },
  '阿根廷':    { tz:'America/Argentina/Buenos_Aires', lat:-34.6, lng:-58.38, cur:'ARS', sym:'$', retail:90, fit:35, cities:['布宜诺斯艾利斯','科尔多瓦','罗萨里奥','门多萨','拉普拉塔'] },
  '智利':      { tz:'America/Santiago', lat:-33.45, lng:-70.67, cur:'CLP', sym:'$', retail:150, fit:60, cities:['圣地亚哥','瓦尔帕莱索','康塞普西翁','安托法加斯塔'] },
  '秘鲁':      { tz:'America/Lima', lat:-12.05, lng:-77.04, cur:'PEN', sym:'S/', retail:0.65, fit:0.25, cities:['利马','阿雷基帕','库斯科','特鲁希略'] },
  '哥伦比亚':  { tz:'America/Bogota', lat:4.71, lng:-74.07, cur:'COP', sym:'$', retail:650, fit:260, cities:['波哥大','麦德林','卡利','巴兰基亚','卡塔赫纳'] },
  '厄瓜多尔':  { tz:'America/Guayaquil', lat:-2.19, lng:-79.89, cur:'USD', sym:'$', retail:0.12, fit:0.05, cities:['基多','瓜亚基尔','昆卡'] },
  '乌拉圭':    { tz:'America/Montevideo', lat:-34.9, lng:-56.16, cur:'UYU', sym:'$U', retail:8, fit:3, cities:['蒙得维的亚','萨尔托','派桑杜'] },
  '玻利维亚':  { tz:'America/La_Paz', lat:-16.5, lng:-68.15, cur:'BOB', sym:'Bs', retail:1.0, fit:0.4, cities:['拉巴斯','圣克鲁斯','科恰班巴'] },
  '巴拉圭':    { tz:'America/Asuncion', lat:-25.26, lng:-57.58, cur:'PYG', sym:'₲', retail:600, fit:240, cities:['亚松森','东方城','恩卡纳西翁'] },
  '委内瑞拉':  { tz:'America/Caracas', lat:10.48, lng:-66.9, cur:'VES', sym:'Bs.', retail:0.05, fit:0.02, cities:['加拉加斯','马拉开波','瓦伦西亚'] },

  /* —— 大洋洲 —— */
  '澳大利亚':  { tz:'Australia/Sydney', lat:-33.87, lng:151.21, cur:'AUD', sym:'A$', retail:0.32, fit:0.06, cities:['悉尼','墨尔本','布里斯班','珀斯','阿德莱德','黄金海岸','堪培拉','纽卡斯尔','霍巴特','达尔文'] },
  '新西兰':    { tz:'Pacific/Auckland', lat:-36.85, lng:174.76, cur:'NZD', sym:'NZ$', retail:0.28, fit:0.08, cities:['奥克兰','惠灵顿','基督城','汉密尔顿','但尼丁'] },
  '斐济':      { tz:'Pacific/Fiji', lat:-18.14, lng:178.44, cur:'FJD', sym:'FJ$', retail:0.35, fit:0.12, cities:['苏瓦','楠迪','劳托卡'] },
  '巴布亚新几内亚':{ tz:'Pacific/Port_Moresby', lat:-9.44, lng:147.18, cur:'PGK', sym:'K', retail:0.90, fit:0.35, cities:['莫尔兹比港','莱城','芒特哈根'] }
};

/* 全球国家清单（未收录明细的国家沿用所属大洲默认值时区与电价） */
const COUNTRIES = [
  { g:'亚洲', items:['中国','中国香港','中国澳门','中国台湾','日本','韩国','朝鲜','蒙古','越南','老挝','柬埔寨','泰国','缅甸','马来西亚','新加坡','印度尼西亚','菲律宾','文莱','东帝汶','印度','巴基斯坦','孟加拉国','斯里兰卡','尼泊尔','不丹','马尔代夫','阿富汗','哈萨克斯坦','吉尔吉斯斯坦','塔吉克斯坦','乌兹别克斯坦','土库曼斯坦','伊朗','伊拉克','叙利亚','黎巴嫩','约旦','以色列','巴勒斯坦','沙特阿拉伯','阿拉伯联合酋长国','卡塔尔','巴林','科威特','阿曼','也门','土耳其','格鲁吉亚','亚美尼亚','阿塞拜疆','塞浦路斯'] },
  { g:'欧洲', items:['俄罗斯','乌克兰','白俄罗斯','摩尔多瓦','波兰','捷克','斯洛伐克','匈牙利','罗马尼亚','保加利亚','塞尔维亚','克罗地亚','斯洛文尼亚','波斯尼亚和黑塞哥维那','黑山','北马其顿','阿尔巴尼亚','希腊','意大利','西班牙','葡萄牙','法国','德国','奥地利','瑞士','列支敦士登','比利时','荷兰','卢森堡','英国','爱尔兰','丹麦','挪威','瑞典','芬兰','冰岛','爱沙尼亚','拉脱维亚','立陶宛','马耳他','摩纳哥','安道尔','圣马力诺','梵蒂冈'] },
  { g:'非洲', items:['埃及','利比亚','突尼斯','阿尔及利亚','摩洛哥','苏丹','南苏丹','埃塞俄比亚','厄立特里亚','吉布提','索马里','肯尼亚','乌干达','坦桑尼亚','卢旺达','布隆迪','刚果（金）','刚果（布）','中非共和国','喀麦隆','乍得','尼日尔','尼日利亚','贝宁','多哥','加纳','科特迪瓦','利比里亚','塞拉利昂','几内亚','几内亚比绍','塞内加尔','冈比亚','毛里塔尼亚','马里','布基纳法索','佛得角','圣多美和普林西比','赤道几内亚','加蓬','安哥拉','赞比亚','马拉维','莫桑比克','津巴布韦','博茨瓦纳','纳米比亚','南非','莱索托','斯威士兰','马达加斯加','毛里求斯','塞舌尔','科摩罗'] },
  { g:'北美洲', items:['美国','加拿大','墨西哥','危地马拉','伯利兹','萨尔瓦多','洪都拉斯','尼加拉瓜','哥斯达黎加','巴拿马','古巴','牙买加','海地','多米尼加','巴哈马','巴巴多斯','特立尼达和多巴哥','格林纳达','圣卢西亚','圣文森特和格林纳丁斯','安提瓜和巴布达','圣基茨和尼维斯','多米尼克'] },
  { g:'南美洲', items:['巴西','阿根廷','智利','秘鲁','哥伦比亚','委内瑞拉','厄瓜多尔','玻利维亚','巴拉圭','乌拉圭','圭亚那','苏里南'] },
  { g:'大洋洲', items:['澳大利亚','新西兰','巴布亚新几内亚','斐济','所罗门群岛','瓦努阿图','萨摩亚','汤加','基里巴斯','图瓦卢','密克罗尼西亚联邦','马绍尔群岛','帕劳','瑙鲁'] }
];
const COUNTRY_REGION = {};
COUNTRIES.forEach(g => g.items.forEach(n => { COUNTRY_REGION[n] = g.g; }));

const REGION_DEF = {
  '亚洲':      { tz:'Asia/Shanghai', lat:30.0, lng:105.0, cur:'USD', sym:'$', retail:0.16, fit:0.07 },
  '欧洲':      { tz:'Europe/Berlin', lat:50.0, lng:10.0,  cur:'EUR', sym:'€', retail:0.26, fit:0.08 },
  '非洲':      { tz:'Africa/Nairobi', lat:5.0, lng:25.0,  cur:'USD', sym:'$', retail:0.16, fit:0.07 },
  '北美洲':    { tz:'America/New_York', lat:32.0, lng:-95.0, cur:'USD', sym:'$', retail:0.16, fit:0.05 },
  '南美洲':    { tz:'America/Sao_Paulo', lat:-15.0, lng:-50.0, cur:'USD', sym:'$', retail:0.14, fit:0.06 },
  '大洋洲':    { tz:'Australia/Sydney', lat:-27.0, lng:133.0, cur:'AUD', sym:'A$', retail:0.30, fit:0.08 }
};
function geoOf(name){
  const g = GEO[name];
  if (g) return g;
  const d = REGION_DEF[COUNTRY_REGION[name] || '亚洲'];
  return Object.assign({ cities: [] }, d);
}
function citiesOf(name){ return geoOf(name).cities || []; }
function pad2(n){ return String(n).padStart(2, '0'); }

/* ---------- 时区：任意 UTC 毫秒 → 指定时区的当地时间 ---------- */
const TZ_CACHE = new Map();
function tzOffsetMin(tz, utcMs){
  const bucket = Math.floor(utcMs / 60000);
  const c = TZ_CACHE.get(tz);
  if (c && c.b === bucket) return c.o;
  let off = 0;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false,
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const map = {};
    dtf.formatToParts(new Date(utcMs)).forEach(x => { if (x.type !== 'literal') map[x.type] = x.value; });
    const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, (+map.hour) % 24, +map.minute, +map.second);
    off = Math.round((asUtc - utcMs) / 60000);
  } catch (e) { off = 0; }
  TZ_CACHE.set(tz, { b: bucket, o: off });
  return off;
}
function localTime(tz, utcMs){
  const off = tzOffsetMin(tz, utcMs);
  const d = new Date(utcMs + off * 60000);
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, dd = d.getUTCDate();
  const hh = d.getUTCHours(), mm = d.getUTCMinutes();
  const doy = Math.floor((Date.UTC(y, mo - 1, dd) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  return {
    y, mo, dd, hh, mm, off, doy, minOfDay: hh * 60 + mm,
    dayKey: y * 10000 + mo * 100 + dd,
    clock: pad2(hh) + ':' + pad2(mm),
    date: y + '/' + pad2(mo) + '/' + pad2(dd),
    dateText: y + '/' + pad2(mo) + '/' + pad2(dd) + ' ' + pad2(hh) + ':' + pad2(mm),
    tzLabel: 'UTC' + (off >= 0 ? '+' : '−') + pad2(Math.floor(Math.abs(off) / 60)) + ':' + pad2(Math.abs(off) % 60)
  };
}
function dayOfYearUTC(utcMs){
  const d = new Date(utcMs);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
}

/* ---------- 确定性噪声：同一电站同一天同一分钟永远得到同一结果 ---------- */
function hash01(a, b, c){
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

/* ================= 光伏物理模型（任意地点 / 任意时刻，365 天分钟级） ================= */
/* 云量衰减：0 晴天 → 0.9 阴雨，日内平滑变化，全年各不相同但可复现 */
function cloudAtten(p, doy, minOfDay){
  const r = hash01(p.seed, doy, 17);
  let base = r < 0.34 ? r * 0.28 : (r < 0.76 ? 0.09 + (r - 0.34) * 0.85 : 0.45 + (r - 0.76) * 1.55);
  base = Math.min(0.86, Math.max(0, base + (p.cloud - 0.25) * 0.55));
  const intra = 0.05 * Math.sin(minOfDay / 46 + doy * 1.7) + (hash01(p.seed, doy, minOfDay >> 3) - 0.5) * 0.12;
  return Math.max(0, Math.min(0.95, base + intra));
}
/* 晴空辐照 → 组件温度降额 → 直流功率 → 逆变器限功率 → 交流输出 kW */
function pvAcPower(p, utcMs){
  const lt = localTime(p.tz, utcMs);
  const g = p.geo;
  const decl = 23.45 * Math.sin(2 * Math.PI * (284 + lt.doy) / 365) * D2R;
  const B = 2 * Math.PI * (lt.doy - 81) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const solarMin = lt.minOfDay + eot + 4 * (g.lng - 15 * lt.off / 60);
  const omega = 15 * (solarMin / 60 - 12) * D2R;
  const latR = g.lat * D2R;
  const sinAlt = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(omega);
  if (sinAlt <= 0.03) return 0;
  const am = 1 / Math.max(0.05, sinAlt);
  const beam = 1000 * Math.pow(0.7, Math.pow(am, 0.678));
  const ghi = beam * sinAlt + 85 * Math.max(0, sinAlt);
  const k = cloudAtten(p, lt.doy, lt.minOfDay);
  const poa = ghi * (1 - k);
  const tamb = 18 + 11 * Math.sin(2 * Math.PI * (lt.doy - 105) / 365) + 7 * sinAlt;
  const tcell = tamb + poa / 800 * 22;
  const derate = 1 - Math.max(0, tcell - 25) * 0.0038;
  /* 系统效率 PR：以 0.86 为基准，改成更低/更高的 PR 会等比例改变出力 */
  const prK = Math.max(0.5, Math.min(1.2, p.cfg.pr || 0.86)) / 0.86;
  const pdc = p.cfg.pvKwp * poa / 1000 * derate * prK;
  const pac = Math.min(p.invKw, pdc * 0.975);
  return Math.max(0, pac);
}
/* 全年发电量估算（按天）/ 单日 1440 点序列，供预览与校验 */
function pvDaySeries(p, doy, stepMin){
  stepMin = stepMin || 15;
  const out = [];
  const base = localMidnightUtc(p, doy);
  for (let m = 0; m < 1440; m += stepMin) out.push(+pvAcPower(p, base + m * 60000).toFixed(2));
  return out;
}
function localMidnightUtc(p, doy){
  const off = tzOffsetMin(p.tz, SIMTIME.utc);
  const lt = localTime(p.tz, SIMTIME.utc);
  const midnightUtc = Date.UTC(lt.y, 0, 1) + (doy - 1) * 86400000 - off * 60000;
  return midnightUtc;
}
function pvYearKwh(p){
  let sum = 0;
  const step = 30;
  for (let d = 1; d <= 365; d++) {
    const base = localMidnightUtc(p, d);
    for (let m = 0; m < 1440; m += step) sum += pvAcPower(p, base + m * 60000) * (step / 60);
  }
  return sum;
}

/* ================= 负载曲线 ================= */
const LOAD_SHAPE = {
  ci:  [0.30,0.28,0.26,0.25,0.26,0.32,0.46,0.62,0.78,0.88,0.92,0.90,0.84,0.80,0.83,0.86,0.88,0.86,0.74,0.62,0.52,0.44,0.37,0.33],
  res: [0.26,0.22,0.20,0.19,0.20,0.28,0.46,0.66,0.58,0.44,0.40,0.38,0.40,0.38,0.40,0.44,0.56,0.72,0.86,0.92,0.88,0.72,0.52,0.36]
};
function loadAt(p, lt){
  if (p.loadTable && p.loadTable.sample) {
    const v = p.loadTable.sample(lt.doy, lt.minOfDay);
    if (v != null) return Math.max(0, v * p.loadScale);
  }
  const shape = LOAD_SHAPE[p.type] || LOAD_SHAPE.ci;
  const base = shape[Math.floor(lt.minOfDay / 60) % 24];
  const season = 1 + 0.15 * Math.cos(2 * Math.PI * (lt.doy - 200) / 365);
  const wob = 0.94 + hash01(p.seed, lt.doy, lt.minOfDay >> 4) * 0.12;
  return Math.max(0, p.cfg.loadPeak * base * season * wob * p.loadScale);
}

/* ================= 建站 ================= */
function makePlant(o){
  const invKw  = Math.max(1, +o.invKw || 100);
  const ratio  = Math.min(10, Math.max(1.001, +o.ratio || 1.2));
  const batKw  = Math.max(1, +o.batKw || 100);
  const batH   = Math.max(0.5, +o.batHours || 2);
  const geo    = geoOf(o.country || '中国');
  const type   = o.type === 'res' ? 'res' : 'ci';
  const mode   = o.mode === 'self' ? 'self' : 'surplus';
  const lt0    = localTime(geo.tz, SIMTIME.utc);
  /* 储能 SOC 工作区间（%） */
  let socMin = o.socMin != null ? +o.socMin : 10;
  let socMax = o.socMax != null ? +o.socMax : 98;
  if (!isFinite(socMin)) socMin = 10;
  if (!isFinite(socMax)) socMax = 98;
  socMin = Math.max(0, Math.min(90, Math.round(socMin)));
  socMax = Math.max(socMin + 5, Math.min(100, Math.round(socMax)));
  /* 运行开始时间：当地时间 月 / 日 / 时 */
  const st = o.start || {};
  const start = {
    mo: Math.min(12, Math.max(1, Math.round(+st.mo || lt0.mo))),
    dd: Math.min(31, Math.max(1, Math.round(+st.dd || lt0.dd))),
    hh: Math.min(23, Math.max(0, Math.round(st.hh != null ? +st.hh : lt0.hh)))
  };
  const t0 = o.tariff || {};
  const tariff = {
    cur: t0.cur || o.cur || geo.cur, sym: t0.sym || o.sym || geo.sym,
    retail: t0.retail != null ? +t0.retail : (o.retail != null && o.retail !== '' ? +o.retail : geo.retail),
    fit: t0.fit != null ? +t0.fit : (o.fit != null && o.fit !== '' ? +o.fit : geo.fit)
  };
  const pvKwp = Math.round(invKw * ratio * 100) / 100;
  const p = {
    id: 'P' + (++plantSeq),
    seed: Math.floor(Math.random() * 99999) + 1,
    name: o.name, country: o.country || '中国', city: o.city,
    tz: geo.tz, geo: o.geo || { lat: geo.lat, lng: geo.lng },
    inverterThermal: o.inverterThermal || null, invTemp: 29, strategy:o.strategy||null, targetSoc:o.targetSoc||null,
    invKw: invKw, ratio: ratio, batKw: batKw, batHours: batH,
    type: type, mode: mode, tariff: tariff,
    socMin: socMin, socMax: socMax, start: start,
    cfg: {
      pvKwp: pvKwp,
      invKw: invKw,
      batKwh: Math.round(batKw * batH),
      batKw: batKw,
      loadPeak: Math.round(invKw * 0.7),
      gridKw: Math.max(200, Math.round(invKw * 1.6)),
      pr: 0.86, eff: 0.96
    },
    created: '',
    cloud: 0.25, loadScale: 1, batMode: 'auto', gridOut: false,
    soc: 96, pv: 0, load: 0, demand: 0, bat: 0, grid: 0, shed: 0, curtail: 0, batTemp: 27,
    dayPv: 0, dayLoad: 0, dayImp: 0, dayExp: 0, dayChg: 0, dayDis: 0,
    dayRev: 0, daySelf: 0, totalRev: 0, loadFromFile: false,
    hourly: new Array(24).fill(0),
    hist: [], events: [], alarmAt: {},
    totalBase: Math.round(pvKwp * 1150),
    local: null, dayKey: 0
  };
  p.created = localTime(p.tz, SIMTIME.utc).date;
  p.local = localTime(p.tz, SIMTIME.utc);
  p.dayKey = p.local.dayKey;
  return p;
}

function simClock(){
  const p = SIM || PLANTS[0];
  if (p) { const lt = localTime(p.tz, SIMTIME.utc); return lt.clock; }
  return '--:--';
}
function simDateText(){
  const p = SIM || PLANTS[0];
  if (p) return localTime(p.tz, SIMTIME.utc).dateText;
  return '';
}
function dayPhase(p){
  const lt = localTime(p.tz, SIMTIME.utc);
  const k = cloudAtten(p, lt.doy, lt.minOfDay);
  if (p.pv < 0.2) return lt.minOfDay < 720 ? '夜间 · 无光照' : '夜间 · 无光照';
  return k > 0.55 ? '白天 · 阴云遮挡' : k > 0.28 ? '白天 · 多云' : '白天 · 光照良好';
}

/* ================= 单站一步调度：光伏 → 负载 / 电池 / 电网 ================= */
// Model telemetry, not measured equipment temperatures. Rising mode is an explicit drill.
function inverterTemperature(p, utc){
  const t = p.inverterThermal;
  if (t?.mode === 'rising' && Number.isFinite(t.expiresAt) && Date.now()<=t.expiresAt && utc>=t.startUtc && utc<=t.untilUtc) {
    return Math.min(t.maxC, t.baseC + Math.max(0, utc - t.startUtc) / 60000 * t.rateCPerMinute);
  }
  return p.closed?29:30+22*Math.min(1,Math.max(0,p.pv/p.invKw));
}
function simStepPlant(p, dtMin, quiet, atUtc, noSample){
  const dtH = dtMin / 60;
  const utc = (atUtc == null) ? SIMTIME.utc : atUtc;
  const lt = localTime(p.tz, utc);
  p.local = lt;

  /* 跨天（按当地时间）结算 */
  if (p.dayKey && p.dayKey !== lt.dayKey) {
    p.totalBase += p.dayPv;
    p.totalRev += p.dayRev;
    p.dayPv = p.dayLoad = p.dayImp = p.dayExp = p.dayChg = p.dayDis = 0;
    p.dayRev = 0; p.daySelf = 0;
    p.hourly = new Array(24).fill(0);
    p.alarmAt = {};
    p.dayKey = lt.dayKey;
    if (!quiet) simEvent(p, lt.date + ' 00:00 当日统计清零', '#5f6675');
  }
  p.dayKey = lt.dayKey;

  p.pv = pvAcPower(p, utc);
  p.invTemp = inverterTemperature(p, utc);
  const demand = loadAt(p, lt);
  p.demand = demand;

  const usable = Math.max(1, p.cfg.batKwh) * 0.9;
  const strategy=p.strategy&&utc>=p.strategy.startsAt&&utc<p.strategy.endsAt?p.strategy:null;
  const socMin = strategy?strategy.min:(p.socMin != null ? p.socMin : 10);
  const socMax = strategy?strategy.max:(p.socMax != null ? p.socMax : 98);
  const target=!strategy&&Number.isFinite(p.targetSoc?.target)?p.targetSoc:null;
  if(target&&((p.batMode==='charge'&&p.soc>=target.target-1e-8)||(p.batMode==='discharge'&&p.soc<=target.target+1e-8))){p.batMode='idle';p.targetSoc={...target,direction:'stop'};if(!quiet&&globalThis.ManagerBridge)savePlantCfg();}
  const ceiling=target&&p.batMode==='charge'?Math.min(socMax,target.target):socMax;
  const floor=target&&p.batMode==='discharge'?Math.max(socMin,target.target):socMin;
  const roomKwh  = Math.max(0, (ceiling - p.soc) / 100 * usable);
  const availKwh = Math.max(0, (p.soc - floor) / 100 * usable);
  const maxChg = Math.min(p.cfg.batKw, roomKwh / (target?p.cfg.eff:1) / Math.max(dtH, 1e-6));
  const maxDis = Math.min(p.cfg.batKw, availKwh * (target?p.cfg.eff:1) / Math.max(dtH, 1e-6));

  let chg = 0, dis = 0, imp = 0, exp = 0, shed = 0, curtail = 0;
  const net = p.pv - demand;

  if (!p.gridOut) {
    if(strategy){
      const kw=strategy.rows[Math.floor(lt.minOfDay/60)]?.batKw||0;
      chg=Math.min(Math.max(0,-kw),maxChg,roomKwh/p.cfg.eff/Math.max(dtH,1e-6));
      dis=Math.min(Math.max(0,kw),maxDis,availKwh*p.cfg.eff/Math.max(dtH,1e-6));
      const balance=demand-p.pv+chg-dis;imp=Math.max(0,balance);exp=Math.max(0,-balance);
    } else if (p.batMode === 'charge') {
      chg = maxChg;
      const fromPv = Math.min(Math.max(net, 0), chg);
      imp = Math.max(0, demand - p.pv) + (chg - fromPv);
      exp = Math.max(0, net - fromPv);
    } else if (p.batMode === 'discharge') {
      dis = maxDis;
      const deficit = Math.max(0, demand - p.pv);
      const toLoad = Math.min(dis, deficit);
      imp = deficit - toLoad;
      exp = Math.max(0, net > 0 ? net : 0) + (dis - toLoad);
    } else if (p.batMode === 'idle') {
      imp = Math.max(0, -net);
      exp = Math.max(0, net);
    } else {
      if (net >= 0) { chg = Math.min(net, maxChg); exp = net - chg; }
      else { dis = Math.min(-net, maxDis); imp = -net - dis; }
    }
    if (imp > p.cfg.gridKw) { shed += imp - p.cfg.gridKw; imp = p.cfg.gridKw; }
    /* 全自发自用：不向电网反送，余电弃掉 */
    if (p.mode === 'self' && exp > 0) { curtail += exp; exp = 0; }
  } else {
    if (net >= 0) { chg = Math.min(net, maxChg); curtail = net - chg; }
    else { dis = Math.min(-net, maxDis); shed = (-net) - dis; }
  }

  const served = Math.max(0, demand - shed);
  const nextSOC=p.soc+(chg*p.cfg.eff-dis/p.cfg.eff)/usable*100*dtH;
  p.soc = strategy?Math.max(0,Math.min(100,nextSOC)):Math.max(socMin,Math.min(socMax,nextSOC));

  p.dayPv   += p.pv * dtH;
  p.dayLoad += served * dtH;
  p.dayImp  += imp * dtH;
  p.dayExp  += exp * dtH;
  p.dayChg  += chg * dtH;
  p.dayDis  += dis * dtH;
  p.hourly[Math.floor(lt.minOfDay / 60) % 24] += p.pv * dtH;

  /* 收益：自用省电费 + 余电上网收入（按国家货币计价） */
  const selfKwh = Math.max(0, (p.pv - exp - curtail) * dtH);
  const rev = selfKwh * p.tariff.retail + exp * dtH * p.tariff.fit;
  p.dayRev += rev;
  p.daySelf += selfKwh;

  p.bat = dis - chg;
  p.grid = imp - exp;
  p.load = served;
  p.shed = shed;
  p.curtail = curtail;
  p.batTemp += ((26 + Math.min(1, Math.abs(chg - dis) / Math.max(1, p.cfg.batKw)) * 16) - p.batTemp) * 0.05;

  if (!noSample) {
    p.hist.push({ utc, pv: p.pv, load: served, bat: p.bat, grid: p.grid, invTemp: p.invTemp });
    if (p.hist.length > HIST_LEN) p.hist.shift();
  }

  if (!quiet) {
    const sn = p.id;
    if (p.gridOut) simAlarm(p, 'off', '并网点失电，储能转离网供电', 'imp', sn + '-METER', 240);
    if (p.soc <= socMin + 7 && p.bat > 0 && !p.gridOut) simAlarm(p, 'soc', '储能 SOC 接近放电下限 ' + socMin + '%，已限制放电', 'hint', sn + '-ESS', 300);
    if (shed > 1) simAlarm(p, 'shed', '负载功率超过供电能力，已限电 ' + shed.toFixed(1) + ' kW', 'imp', sn + '-INV', 120);
    if (p.mode === 'self' && curtail > p.invKw * 0.2) simAlarm(p, 'clip', '全自发自用模式，余电弃光 ' + curtail.toFixed(1) + ' kW', 'hint', sn + '-INV', 300);
    if (p.batTemp > 40) simAlarm(p, 'temp', '储能电池温度偏高', 'minor', sn + '-ESS', 300);
  }
}

/* 已关闭的电站：输出清零，不再参与发电与调度（历史补一个 0 点） */
function simIdle(p, sample){
  p.local = localTime(p.tz, SIMTIME.utc);
  p.invTemp = 29;
  p.pv = 0; p.demand = 0; p.bat = 0; p.grid = 0; p.curtail = 0; p.shed = 0; p.load = 0;
  if (sample !== false) {
    p.hist.push({ pv: 0, load: 0, bat: 0, grid: 0 });
    if (p.hist.length > HIST_LEN) p.hist.shift();
  }
}
/* 全场站推进一个时间步（全局 UTC 时钟）；加速时按 ≤5 分钟细分，保证曲线与电量不失真 */
function simAdvance(dtMin){
  if (!(dtMin > 0)) return;
  const MAX = 5;
  let left = dtMin, guard = 0;
  while (left > 1e-6 && guard++ < 800) {
    const dt = Math.min(MAX, left);
    left -= dt;
    SIMTIME.utc += dt * 60000;
    const last = left <= 1e-6;
    PLANTS.forEach(p => {
      if (p.closed) { simIdle(p, last); return; }
      simStepPlant(p, dt, false, null, !last);
    });
  }
}
function simEvent(p, text, color){
  const t = p.local ? p.local.clock : localTime(p.tz, SIMTIME.utc).clock;
  p.events.unshift({ t: t, text: text, color: color || '#5f6675' });
  if (p.events.length > 9) p.events.length = 9;
}
function simAlarm(p, key, title, lv, dev, cd){
  const now = Math.floor(SIMTIME.utc / 60000);
  const last = p.alarmAt[key];
  if (last != null && now - last < (cd || 240)) return;
  p.alarmAt[key] = now;
  alarms.unshift({ title: title, lv: lv, dev: dev, st: p.name, t: localTime(p.tz, SIMTIME.utc).dateText });
  if (alarms.length > 120) alarms.length = 120;
  simEvent(p, '上报告警：' + title, '#ff9f0a');
}

/* ================= 负载功率曲线：上传 / 解析 / 缓存 ================= */
const LOAD_STORE = { table: null, name: '', meta: null, ready: false, source: 'builtin' };
const IDB_NAME = 'fs_sim_db', IDB_STORE = 'loadFiles';

function idbOpen(){
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('浏览器不支持 IndexedDB'));
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(IDB_STORE)) r.result.createObjectStore(IDB_STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key, val){
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const q = tx.objectStore(IDB_STORE).get(key);
    q.onsuccess = () => res(q.result || null);
    q.onerror = () => rej(q.error);
  });
}

function makeLoadTable(vals, rows, cols, name){
  return {
    rows, cols, name, vals,
    sample(doy, minOfDay){
      const r = Math.min(this.rows - 1, Math.max(0, (doy || 1) - 1));
      const c = Math.min(this.cols - 1, Math.max(0, minOfDay | 0));
      const v = this.vals[r * this.cols + c];
      return isFinite(v) ? v : null;
    }
  };
}
function loadTableStats(t){
  if (!t) return null;
  let peak = 0, sum = 0, n = 0, zero = 0;
  const step = Math.max(1, Math.floor(t.vals.length / 20000));
  for (let i = 0; i < t.vals.length; i += step) {
    const v = t.vals[i];
    if (!isFinite(v)) { zero++; continue; }
    if (v > peak) peak = v;
    sum += v; n++;
  }
  const scale = t.vals.length / Math.max(1, n);
  return { peak, yearKwh: n ? (sum * scale) / 60 : 0, rows: t.rows, cols: t.cols, name: t.name };
}

/* ---------- 单元格解析工具 ---------- */
function cellDate(v){
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000));
    return null;
  }
  const s = String(v);
  const m = s.match(/(\d{4})\D{1,2}(\d{1,2})\D{1,2}(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function cellMinute(v){
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === 'number') return v <= 1 ? Math.round(v * 1440) : Math.round(v);
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2}):(\d{2})/);
    if (m) return (+m[1]) * 60 + (+m[2]);
    const n = parseFloat(v.replace(/[^\d.\-]/g, ''));
    if (isFinite(n)) return n <= 1 ? Math.round(n * 1440) : Math.round(n);
  }
  return null;
}
const numOf = v => {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (v == null || v === '') return NaN;
  const n = parseFloat(String(v).replace(/[^\d.\-+eE]/g, ''));
  return isFinite(n) ? n : NaN;
};

/* ---------- 把二维表转成 365×1440 的表 ---------- */
function buildLoadTable(rows, name){
  if (!rows || !rows.length) throw new Error('文件里没有读到数据');
  const height = rows.length;
  const width = rows.reduce((a, r) => Math.max(a, r ? r.length : 0), 0);
  const DAYS = 365, MINS = 1440;
  const vals = new Float32Array(DAYS * MINS).fill(NaN);

  /* A. 宽表：一行一天，1440 列（可带日期列 / 表头行） */
  if (height >= 200 && width >= 200) {
    let dataStart = 1, rowStart = 0;
    const hasDateCol = cellDate(rows[1] && rows[1][0]) != null || (typeof rows[1][0] === 'string' && /[-/年]/.test(rows[1][0]));
    if (typeof rows[0][0] === 'string' && isNaN(numOf(rows[0][0]))) rowStart = 1;
    if (!hasDateCol) dataStart = 0;
    const cols = Math.min(MINS, width - dataStart);
    let day = 0;
    for (let i = rowStart; i < height && day < DAYS; i++) {
      const r = rows[i]; if (!r) continue;
      let filled = 0;
      for (let c = 0; c < cols; c++) {
        const v = numOf(r[c + dataStart]);
        if (isFinite(v)) { vals[day * MINS + c] = v; filled++; }
      }
      if (filled > 0) day++;
    }
    if (day > 0) return makeLoadTable(vals, DAYS, MINS, name);
  }

  /* B. 长表：[日期, 时间, 功率] 或 [时间, 功率] */
  if (width >= 2 && width <= 6 && height >= 100) {
    let rowStart = isNaN(numOf(rows[0][width - 1])) ? 1 : 0;
    const first = rows[rowStart] || [];
    let dcol = -1, tcol = -1, vcol = width - 1;
    for (let c = 0; c < width - 1; c++) {
      const v = first[c];
      if (cellDate(v) && dcol < 0) dcol = c;
      else if (cellMinute(v) != null && tcol < 0) tcol = c;
      else if (!isFinite(numOf(v)) && dcol < 0 && typeof v === 'string' && /[-/年]/.test(v)) dcol = c;
    }
    if (tcol < 0 && dcol === 0) tcol = 1;
    if (tcol >= 0) {
      const baseYear = (cellDate(first[dcol >= 0 ? dcol : 0]) || new Date(2026, 0, 1)).getFullYear();
      const baseJan1 = Date.UTC(baseYear, 0, 1);
      let count = 0;
      for (let i = rowStart; i < height; i++) {
        const r = rows[i]; if (!r) continue;
        const val = numOf(r[vcol]);
        const mnt = cellMinute(r[tcol]);
        if (!isFinite(val) || mnt == null) continue;
        let doy = 1;
        if (dcol >= 0) {
          const d = cellDate(r[dcol]);
          if (d) doy = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - baseJan1) / 86400000) + 1;
        } else {
          doy = Math.floor(count / MINS) + 1;
        }
        if (doy >= 1 && doy <= DAYS) { vals[(doy - 1) * MINS + (mnt % MINS)] = val; count++; }
      }
      if (count > 500) return makeLoadTable(vals, DAYS, MINS, name);
    }
  }

  /* C. 单列扁平序列：按 365×1440 顺序排列 */
  if (width === 1 && height >= MINS) {
    let k = 0;
    for (let i = 0; i < height && k < vals.length; i++) {
      const v = numOf(rows[i][0]);
      if (isFinite(v)) { vals[k++] = v; }
    }
    if (k > 500) return makeLoadTable(vals, DAYS, MINS, name);
  }

  /* D. 每行 N 点（24 / 48 / 96 / 144 …），线性插值到 1440 点 */
  if (height >= 100 && width >= 6 && width <= 288) {
    let rowStart = isNaN(numOf(rows[0][width - 1])) ? 1 : 0;
    const N = width, dayCount = Math.min(DAYS, height - rowStart);
    for (let d = 0; d < dayCount; d++) {
      const r = rows[d + rowStart] || [];
      for (let c = 0; c < N; c++) {
        const v0 = numOf(r[c]);
        if (!isFinite(v0)) continue;
        const v1 = c + 1 < N ? numOf(r[c + 1]) : v0;
        const from = Math.round(c * MINS / N), to = Math.round((c + 1) * MINS / N);
        for (let m = from; m < Math.min(MINS, to); m++) {
          const t = (to > from) ? (m - from) / (to - from) : 0;
          vals[d * MINS + m] = isFinite(v1) ? v0 + (v1 - v0) * t : v0;
        }
      }
    }
    if (dayCount > 0) return makeLoadTable(vals, DAYS, MINS, name);
  }

  throw new Error('无法识别表格格式：需要 365 天 × 1440 分钟，或 [日期, 时间, 功率] 三列');
}

async function parseLoadFile(file){
  if (!globalThis.XLSX) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('表格读取组件加载失败，请重试'));
      document.head.append(script);
    });
  }
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.csv$/i.test(file.name) || /\.txt$/i.test(file.name)) {
    wb = XLSX.read(new TextDecoder().decode(buf), { type: 'string', cellDates: true });
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  }
  if (!wb.SheetNames || !wb.SheetNames.length) throw new Error('工作簿里没有工作表');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: '' });
  return buildLoadTable(rows, file.name);
}

/* 缓存到 IndexedDB（刷新页面后可恢复） */
async function persistLoadTable(table){
  try {
    const meta = loadTableStats(table);
    await idbPut('current', { name: table.name, rows: table.rows, cols: table.cols, meta: meta, vals: table.vals.buffer });
  } catch (e) { console.warn('缓存负载曲线失败', e); }
}
async function restoreLoadTable(){
  try {
    const rec = await idbGet('current');
    if (!rec || !rec.vals) return false;
    const table = makeLoadTable(new Float32Array(rec.vals), rec.rows, rec.cols, rec.name);
    LOAD_STORE.table = table;
    LOAD_STORE.name = rec.name;
    LOAD_STORE.meta = loadTableStats(table);
    LOAD_STORE.ready = true;
    return true;
  } catch (e) { return false; }
}

/* 上传入口 */
async function onLoadFilePicked(input){
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById('cf-loadstate');
  if (st) st.textContent = '正在解析 ' + f.name + ' …';
  try {
    const t = await parseLoadFile(f);
    const meta = loadTableStats(t);
    LOAD_STORE.table = t; LOAD_STORE.name = f.name; LOAD_STORE.meta = meta;
    LOAD_STORE.ready = true; LOAD_STORE.source = 'file';
    await persistLoadTable(t);
    setTxt('cf-loadstate', '已加载 ' + f.name + ' · ' + meta.rows + '×' + meta.cols +
      ' · 峰值 ' + meta.peak.toFixed(1) + ' kW · 年用电 ' + Math.round(meta.yearKwh).toLocaleString() + ' kWh');
    const radio = document.getElementById('cf-loadmode-file');
    if (radio) radio.checked = true;
    updateLoadBadge();
    toast('负载曲线已载入：' + f.name);
  } catch (e) {
    setTxt('cf-loadstate', '解析失败：' + (e.message || e));
    toast('解析失败，请检查表格格式');
  }
  input.value = '';
}
function resetLoadFile(){
  LOAD_STORE.table = null; LOAD_STORE.name = ''; LOAD_STORE.meta = null; LOAD_STORE.ready = false;
  idbPut('current', null).catch(() => {});
  setTxt('cf-loadstate', '未加载文件，将使用内置典型曲线');
  updateLoadBadge();
}
function updateLoadBadge(){
  const el = document.getElementById('load-badge');
  if (!el) return;
  if (LOAD_STORE.ready && LOAD_STORE.table) {
    el.textContent = '已载入：' + LOAD_STORE.name;
    el.style.color = 'var(--green)';
  } else {
    el.textContent = '未加载文件';
    el.style.color = 'var(--muted)';
  }
}

/* 下载模板（365 天 × 1440 分钟，一天一行） */
function downloadLoadTemplate(){
  const DAYS = 365, MINS = 1440, peak = 100;
  const lines = [];
  const head = ['date'];
  for (let m = 0; m < MINS; m++) head.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
  lines.push(head.join(','));
  for (let d = 1; d <= DAYS; d++) {
    const dt = new Date(Date.UTC(2026, 0, 1) + (d - 1) * 86400000);
    const row = [dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate())];
    const season = 1 + 0.15 * Math.cos(2 * Math.PI * (d - 200) / 365);
    for (let m = 0; m < MINS; m++) {
      const base = LOAD_SHAPE.ci[Math.floor(m / 60) % 24];
      const wob = 0.94 + hash01(7, d, m >> 4) * 0.12;
      row.push((peak * base * season * wob).toFixed(2));
    }
    lines.push(row.join(','));
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '负载曲线模板_365天_1440分钟.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('模板已下载（CSV，可直接用 Excel 打开）');
}

const FLOW_ICON = {
  pv:   '<circle cx="0" cy="0" r="4.2" fill="none" stroke="C" stroke-width="1.5"/><path d="M0 -7.5v-2M0 7.5v2M-7.5 0h-2M7.5 0h2M-5.3 -5.3l-1.4 -1.4M5.3 5.3l1.4 1.4M5.3 -5.3l1.4 -1.4M-5.3 5.3l-1.4 1.4" stroke="C" stroke-width="1.3" stroke-linecap="round"/>',
  load: '<path d="M-6.5 1.5 0 -5l6.5 6.5V8H-6.5z" fill="none" stroke="C" stroke-width="1.6" stroke-linejoin="round"/><path d="M-2 8V3.5h4V8" fill="none" stroke="C" stroke-width="1.4"/>',
  grid: '<path d="M0 -8v16M-7 -4h14M-5 1h10M-7 6h14" stroke="C" stroke-width="1.5" stroke-linecap="round"/>',
  bat:  '<rect x="-6" y="-4.5" width="12" height="9" rx="2" fill="none" stroke="C" stroke-width="1.6"/><rect x="-8.2" y="-1.8" width="2.2" height="3.6" rx="1" fill="C"/><path d="M-1.5 -2v4M1.5 -2v4" stroke="C" stroke-width="1.2"/>'
};
function flowNode(n, color){
  return '<g transform="translate(' + n.x + ',' + n.y + ')">' +
    '<rect width="116" height="58" rx="13" fill="var(--sim-flow-node,#151922)" stroke="' + color + '" stroke-opacity=".38"/>' +
    '<circle cx="24" cy="29" r="14" fill="' + color + '" fill-opacity=".13"/>' +
    '<g transform="translate(24,29)" stroke-linecap="round">' + FLOW_ICON[n.k].replace(/C/g, color) + '</g>' +
    '<text x="42" y="25" fill="var(--sim-plot-label,#8b91a0)" font-size="10.5">' + n.name + '</text>' +
    '<text x="42" y="43" fill="var(--sim-plot-text,#fff)" font-size="14" font-weight="700">' + n.val + '</text>' +
    '</g>';
}
function flowLine(x1,y1,x2,y2,color,power,dur){
  const on = Math.abs(power) > 0.4;
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color +
    '" stroke-width="2.6" stroke-opacity="' + (on ? .95 : .16) + '" class="flow-line"' +
    ' style="animation-duration:' + dur + 's;animation-direction:' + (power < 0 ? 'reverse' : 'normal') + '"' +
    (on ? '' : ' stroke-dasharray="3 7"') + '/>';
}
function simFlow(){
  if (!SIM) return '';
  const k = SIM.cfg.invKw;
  const pv = SIM.pv, load = SIM.load, bat = SIM.bat, grid = SIM.grid;
  const nodes = [
    { k:'pv',   x:4,   y:4,   name:'光伏阵列', val: pv.toFixed(1) + ' kW', c:'var(--sim-pv,#30d158)' },
    { k:'load', x:300, y:4,   name:'负载',     val: load.toFixed(1) + ' kW', c:'var(--sim-load,#0a84ff)' },
    { k:'grid', x:4,   y:190, name: grid >= 0 ? '电网 · 取电' : '电网 · 上网', val: Math.abs(grid).toFixed(1) + ' kW', c:'var(--sim-grid,#bf5af2)' },
    { k:'bat',  x:300, y:190, name:'储能 SOC ' + SIM.soc.toFixed(0) + '%', val: Math.abs(bat).toFixed(1) + ' kW', c:'var(--sim-bat,#ff9f0a)' }
  ];
  const dur = p => (1.9 - Math.min(1, Math.abs(p) / Math.max(20, k)) * 1.45).toFixed(2);
  let s = '<svg viewBox="0 0 420 252" xmlns="http://www.w3.org/2000/svg">';
  s += flowLine(120, 62, 210, 125, 'var(--sim-pv,#30d158)', pv, dur(pv));
  s += flowLine(300, 62, 210, 125, 'var(--sim-load,#0a84ff)', -load, dur(load));
  s += flowLine(120, 190, 210, 125, 'var(--sim-grid,#bf5af2)', grid, dur(grid));
  s += flowLine(300, 190, 210, 125, 'var(--sim-bat,#ff9f0a)', bat, dur(bat));
  s += '<circle cx="210" cy="125" r="40" fill="var(--sim-flow-center,#0f1320)" stroke="rgba(58,122,254,.45)" stroke-width="1.4"/>';
  s += '<circle cx="210" cy="125" r="40" fill="none" stroke="rgba(58,122,254,.18)" stroke-width="6"/>';
  s += '<text x="210" y="120" text-anchor="middle" fill="var(--accent-text,#6f9dff)" font-size="10.5">交流母线</text>';
  s += '<text x="210" y="138" text-anchor="middle" fill="var(--sim-plot-text,#fff)" font-size="14" font-weight="700">' +
       Math.max(0, Math.min(k, pv)).toFixed(0) + '<tspan font-size="9.5" fill="var(--sim-plot-label,#8b91a0)"> kW</tspan></text>';
  s += '<text x="150" y="82" text-anchor="middle" fill="var(--sim-pv,#5fd97f)" font-size="10">' + pv.toFixed(1) + '</text>';
  s += '<text x="270" y="82" text-anchor="middle" fill="var(--sim-load,#5aa8ff)" font-size="10">' + load.toFixed(1) + '</text>';
  s += '<text x="150" y="170" text-anchor="middle" fill="var(--sim-grid,#c98cff)" font-size="10">' + Math.abs(grid).toFixed(1) + '</text>';
  s += '<text x="270" y="170" text-anchor="middle" fill="var(--sim-bat,#ffb340)" font-size="10">' + Math.abs(bat).toFixed(1) + '</text>';
  nodes.forEach(n => { s += flowNode(n, n.c); });
  return s + '</svg>';
}

/* ---------- 实时曲线 ---------- */
function simChartSVG(){
  if (!SIM) return '';
  const d = SIM.hist;
  const W = 404, H = 122, L = 30, R = W - 6, T = 8, B = 100;
  if (d.length < 2) return '<div style="color:var(--muted);font-size:12px;padding:20px 4px;text-align:center">采样中…</div>';
  let maxV = 40;
  d.forEach(p => { maxV = Math.max(maxV, p.pv, p.load, Math.abs(p.bat), Math.abs(p.grid)); });
  const yMax = Math.ceil(maxV / 40) * 40;
  const x = i => L + (R - L) * i / (d.length - 1);
  const y = v => B - (B - T) * Math.min(1, Math.abs(v) / yMax);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  for (let i = 0; i <= 3; i++) {
    const gy = (T + (B - T) * i / 3).toFixed(1);
    s += '<line x1="' + L + '" y1="' + gy + '" x2="' + R + '" y2="' + gy + '" stroke="var(--sim-plot-grid,#262b36)" stroke-width="1" stroke-dasharray="3 4"/>';
    s += '<text x="' + (L - 5) + '" y="' + (+gy + 3.5) + '" fill="var(--sim-plot-label,#5f6675)" font-size="9" text-anchor="end">' + Math.round(yMax * (1 - i / 3)) + '</text>';
  }
  const line = (key, color, w, dash) => {
    const pts = d.map((p, i) => x(i).toFixed(1) + ',' + y(p[key]).toFixed(1)).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="4 3"' : '') + '/>';
  };
  const area = d.map((p, i) => x(i).toFixed(1) + ',' + y(p.pv).toFixed(1)).join(' ');
  s += '<polygon points="' + L + ',' + B + ' ' + area + ' ' + R + ',' + B + '" fill="rgba(48,209,88,.12)"/>';
  s += line('pv', 'var(--sim-pv,#30d158)', 2);
  s += line('load', 'var(--sim-load,#0a84ff)', 1.8);
  s += line('bat', 'var(--sim-bat,#ff9f0a)', 1.5, true);
  s += line('grid', 'var(--sim-grid,#bf5af2)', 1.2, true);
  return s + '</svg>';
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function setTxt(id, v){ const el = document.getElementById(id); if (el) el.textContent = v; }

function showView(){
  ['list','detail','create'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = (simView === v ? '' : 'none');
  });
  if (simView === 'list') renderPlantList();
  if (simView === 'create') initCreateForm();
  if (simView === 'detail') renderPlantDetail();
}

/* ================= 视图渲染 ================= */
function fmtMoney(p, v){
  const a = Math.abs(v);
  const digits = a >= 10000 ? 0 : a >= 100 ? 1 : 2;
  return p.tariff.sym + v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function renderPlantList(){
  const box = document.getElementById('sp-list');
  if (!box) return;
  setTxt('sp-count', PLANTS.length);
  setTxt('sim-sub', '我的仿真电站 · ' + PLANTS.length + ' 座 · 实时同步到 APP');
  if (!PLANTS.length) {
    box.innerHTML = '<div class="sp-empty">还没有仿真电站<br>点击右上角「创建电站」新建一座</div>';
    return;
  }
  box.innerHTML = PLANTS.map((p, i) => {
    const on = SIM && SIM.id === p.id;
    const lt = localTime(p.tz, SIMTIME.utc);
    return '<div class="sp-card' + (on ? ' on' : '') + '" onclick="openPlant(\'' + p.id + '\')">' +
      '<div class="thumb">' + houseSVG(i) + '</div>' +
      '<div class="body">' +
        '<div class="nm"><span>' + esc(p.name) + '</span>' + (p.closed ? '<i class="sp-off">已关闭</i>' : '<i class="live-dot"></i>') + '</div>' +
        '<div class="addr">' + esc(p.country) + ' · ' + esc(p.city) + ' · 当地 ' + lt.clock + '</div>' +
        '<div class="stats"><span>' + p.cfg.pvKwp.toFixed(1) + ' kWp</span>' +
          '<span>今日 ' + p.dayPv.toFixed(0) + ' 度</span>' +
          '<b>' + p.pv.toFixed(1) + ' kW</b></div>' +
        '<div class="stats" style="margin-top:3px"><span>' + TYPE_NAME[p.type] + ' · ' + MODE_NAME[p.mode] + '</span>' +
          '<span style="color:var(--sim-revenue,#ffd60a)">' + fmtMoney(p, p.dayRev) + '</span></div>' +
        '<div class="stats card-foot"><span>开始 ' + pad2(p.start.mo) + '/' + pad2(p.start.dd) + ' ' + pad2(p.start.hh) + ':00 · SOC ' + p.socMin + '–' + p.socMax + '%</span>' +
          '<span style="display:flex;gap:5px;flex-shrink:0">' +
            '<span class="card-edit" onclick="event.stopPropagation();openEdit(\'' + p.id + '\')">编辑</span>' +
            '<span class="card-edit card-share" onclick="event.stopPropagation();sharePlant(\'' + p.id + '\')">分享</span>' +
          '</span></div>' +
      '</div>' +
      '<span class="tag ' + (p.gridOut ? 'fault' : 'ok') + '">' + (p.gridOut ? '离网' : '正常') + '</span>' +
    '</div>';
  }).join('');
}

function renderPlantDetail(){
  if (!SIM) { simView = 'list'; showView(); return; }
  const p = SIM;
  const flow = document.getElementById('sim-flow');
  if (flow) flow.innerHTML = simFlow();

  setTxt('sim-phase', p.closed ? '已关闭 · 停止发电与调度' : dayPhase(p));
  const lt = p.local || localTime(p.tz, SIMTIME.utc);

  setTxt('m-pv', p.pv.toFixed(1));
  setTxt('m-load', p.load.toFixed(1));
  setTxt('m-bat', Math.abs(p.bat).toFixed(1));
  setTxt('m-soc', p.soc.toFixed(0));
  setTxt('m-grid', Math.abs(p.grid).toFixed(1));
  setTxt('m-grid-t', p.gridOut ? '电网停电' : (p.grid >= 0 ? '电网取电' : '余电上网'));

  setTxt('r-local', lt.dateText + '（UTC' + (lt.off >= 0 ? '+' : '−') + pad2(Math.floor(Math.abs(lt.off) / 60)) + ':' + pad2(Math.abs(lt.off) % 60) + '）');
  setTxt('r-inv-temp', Number.isFinite(p.invTemp) ? p.invTemp.toFixed(1) + ' ℃' + (p.inverterThermal?.mode === 'rising' ? ' · 渐升温演练（模拟）' : ' · 模拟') : '—');
  setTxt('r-type', TYPE_NAME[p.type]);
  setTxt('r-mode', MODE_NAME[p.mode]);
  setTxt('r-ratio', p.ratio.toFixed(2) + '（' + p.cfg.pvKwp.toFixed(1) + ' / ' + p.invKw + '）');
  setTxt('r-soc', (p.socMin != null ? p.socMin : 10) + '% – ' + (p.socMax != null ? p.socMax : 98) + '%（当前 ' + p.soc.toFixed(0) + '%）');
  const st = p.start || {};
  setTxt('r-start', pad2(st.mo || 1) + ' 月 ' + pad2(st.dd || 1) + ' 日 ' + pad2(st.hh || 0) + ':00（当地时间）');
  setTxt('r-tariff', '上网 ' + p.tariff.sym + p.tariff.fit + ' · 买电 ' + p.tariff.sym + p.tariff.retail + ' /kWh');
  setTxt('r-tz', p.country + ' · ' + p.city);

  setTxt('d-pv', p.dayPv.toFixed(2));
  setTxt('d-load', p.dayLoad.toFixed(0));
  setTxt('d-grid', p.dayImp.toFixed(0));
  setTxt('d-rev', fmtMoney(p, p.dayRev));
  const selfUse = p.dayPv > 0 ? Math.max(0, Math.min(100, p.daySelf / p.dayPv * 100)) : 0;
  setTxt('sim-eff', '自用率 ' + selfUse.toFixed(0) + '% · 累计 ' + fmtMoney(p, p.totalRev + p.dayRev));

  const chart = document.getElementById('sim-chart');
  if (chart) chart.innerHTML = simChartSVG();

  const log = document.getElementById('sim-log');
  if (log) {
    log.innerHTML = p.events.length
      ? p.events.map(e => '<div class="log-item"><span class="ld" style="background:' + e.color + '"></span><span class="lt">' + e.t + '</span><span>' + esc(e.text) + '</span></div>').join('')
      : '<div class="log-item" style="color:#5f6675"><span class="ld" style="background:#3a7afe"></span>仿真运行中，暂无事件</div>';
  }
  setTxt('sim-evn', p.events.length + ' 条');
  setTxt('load-badge', p.loadTable ? '负载：' + p.loadTable.name : '负载：内置典型曲线');
}

function syncDetailControls(){
  if (!SIM) return;
  const p = SIM;
  setTxt('sp-dname', p.name);
  setTxt('sp-dcap', p.cfg.pvKwp.toFixed(1) + ' kWp · ' + p.cfg.batKwh + ' kWh');
  const rc = document.getElementById('r-cloud');
  if (rc) rc.value = Math.round(p.cloud * 100);
  setTxt('v-cloud', Math.round(p.cloud * 100) + '%');
  const rl = document.getElementById('r-load');
  if (rl) rl.value = Math.round(p.loadScale * 100);
  setTxt('v-load', Math.round(p.loadScale * 100) + '%');
  document.querySelectorAll('#seg-bat span').forEach(el => el.classList.toggle('on', el.dataset.m === p.batMode));
  setTxt('v-batmode', BAT_MODE_NAME[p.batMode]);
  const tg = document.getElementById('tg-grid');
  if (tg) tg.classList.toggle('on', p.gridOut);
}

function openPlant(id){
  const p = PLANTS.find(x => x.id === id);
  if (!p) return;
  SIM = p;
  simView = 'detail';
  syncDetailControls();
  showView();
  simRender();
}
function simBack(){
  /* 编辑态点「取消」→ 回到该电站详情；新建态 → 回列表 */
  if (simView === 'create' && cfEditId) {
    const id = cfEditId;
    cfEditId = null;
    const p = PLANTS.find(x => x.id === id);
    if (p) { SIM = p; simView = 'detail'; syncDetailControls(); showView(); simRender(); return; }
  }
  cfEditId = null;
  simView = 'list';
  showView();
}
function editCurrent(){
  if (!SIM) { toast('请先打开一座电站'); return; }
  openEdit(SIM.id);
}

/* ================= 创建电站 ================= */
function initCreateForm(){
  const sel = document.getElementById('cf-country');
  if (sel && !sel.dataset.ready) {
    COUNTRIES.forEach(grp => {
      const og = document.createElement('optgroup');
      og.label = grp.g;
      grp.items.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.dataset.ready = '1';
    sel.value = '中国';
  }
  cfCountryChanged(true);
  initStartPickers();
  if (!cfEditId) {
    const now = localTime(geoOf(document.getElementById('cf-country').value || '中国').tz, SIMTIME.utc);
    setStartPickers(now.mo, now.dd, now.hh);
  }
  const err = document.getElementById('cf-err');
  if (err) err.textContent = '';
  updateLoadBadge();
  const st = document.getElementById('cf-loadstate');
  if (st) {
    st.textContent = LOAD_STORE.ready && LOAD_STORE.meta
      ? '已加载 ' + LOAD_STORE.name + ' · ' + LOAD_STORE.meta.rows + '×' + LOAD_STORE.meta.cols +
        ' · 峰值 ' + LOAD_STORE.meta.peak.toFixed(1) + ' kW · 年用电 ' + Math.round(LOAD_STORE.meta.yearKwh).toLocaleString() + ' kWh'
      : '未加载文件，将使用内置典型曲线';
  }
  cfPreview();
}

/* 国家变化：联动城市下拉 + 货币 + 默认电价 */
function cfCountryChanged(resetCity){
  const c = document.getElementById('cf-country').value || '中国';
  const geo = geoOf(c);
  const dl = document.getElementById('cf-city-list');
  if (dl) {
    dl.innerHTML = (geo.cities || []).map(x => '<option value="' + esc(x) + '">').join('');
  }
  const cityInp = document.getElementById('cf-city');
  if (cityInp) {
    cityInp.placeholder = (geo.cities && geo.cities.length) ? '选择或输入城市，如 ' + geo.cities[0] : '输入城市名称';
    if (resetCity) cityInp.value = (geo.cities && geo.cities[0]) || '';
    else if (cityInp.value && geo.cities && geo.cities.length && geo.cities.indexOf(cityInp.value) < 0) cityInp.value = geo.cities[0];
  }
  setTxt('cf-curname', geo.sym + ' ' + geo.cur);
  setTxt('cf-fitsym', geo.sym);
  setTxt('cf-retsym', geo.sym);
  const fit = document.getElementById('cf-fit');
  const ret = document.getElementById('cf-retail');
  if (fit) fit.value = geo.fit;
  if (ret) ret.value = geo.retail;
  setTxt('cf-tzinfo', geo.tz + ' · 纬度 ' + geo.lat.toFixed(1) + '°');
  cfPreview();
}

function cfPreview(){
  const inv = Math.max(1, +document.getElementById('cf-inv').value || 0);
  const ratio = Math.min(10, Math.max(1.001, +document.getElementById('cf-ratio').value || 1.2));
  const bp  = Math.max(1, +document.getElementById('cf-batp').value || 0);
  const bh  = Math.max(0.5, +document.getElementById('cf-bath').value || 0);
  const pv = inv * ratio;
  setTxt('cf-pv', pv.toFixed(1) + ' kWp');
  setTxt('cf-batkwh', Math.round(bp * bh) + ' kWh');
  setTxt('cf-load', Math.round(inv * 0.7) + ' kW');
  const sm = +((document.getElementById('cf-socmin') || {}).value || 10);
  const sx = +((document.getElementById('cf-socmax') || {}).value || 98);
  setTxt('cf-socrange', sm + '% – ' + sx + '%');
  /* 年发电量粗估：装机 × 首年等效利用小时（随纬度变化） */
  const c = document.getElementById('cf-country').value || '中国';
  const lat = Math.abs(geoOf(c).lat);
  const hours = Math.max(850, 1750 - lat * 14);
  setTxt('cf-yearpv', Math.round(pv * hours).toLocaleString() + ' kWh');
}

/* ---------- 运行开始时间：月 / 日 / 时 选择器 ---------- */
const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
function initStartPickers(){
  const mo = document.getElementById('cf-start-mo');
  const dd = document.getElementById('cf-start-dd');
  const hh = document.getElementById('cf-start-hh');
  if (!mo || mo.dataset.ready) return;
  mo.innerHTML = MONTH_DAYS.map((_, i) => '<option value="' + (i + 1) + '">' + (i + 1) + ' 月</option>').join('');
  hh.innerHTML = Array.from({ length: 24 }, (_, i) => '<option value="' + i + '">' + pad2(i) + ':00</option>').join('');
  mo.dataset.ready = '1';
  cfStartChanged();
}
function cfStartChanged(){
  const mo = document.getElementById('cf-start-mo');
  const dd = document.getElementById('cf-start-dd');
  if (!mo || !dd) return;
  const m = +mo.value || 1;
  const keep = +dd.value || 1;
  dd.innerHTML = Array.from({ length: MONTH_DAYS[m - 1] || 31 }, (_, i) =>
    '<option value="' + (i + 1) + '">' + (i + 1) + ' 日</option>').join('');
  dd.value = String(Math.min(keep, MONTH_DAYS[m - 1] || 31));
}
function setStartPickers(mo, dd, hh){
  const m = document.getElementById('cf-start-mo');
  const d = document.getElementById('cf-start-dd');
  const h = document.getElementById('cf-start-hh');
  if (!m || !d || !h) return;
  m.value = String(mo); cfStartChanged();
  d.value = String(Math.min(dd, d.options.length || 31));
  h.value = String(hh);
}

function openCreate(){
  cfEditId = null;
  simView = 'create';
  showView();
  setTxt('cf-title', '创建仿真电站');
  setTxt('cf-tag', '新建');
  const sb = document.getElementById('cf-submit'); if (sb) sb.textContent = '创建并开始运行';
  const n = document.getElementById('cf-name'); if (n) n.value = '';
  const inv = document.getElementById('cf-inv'); if (inv) inv.value = 100;
  const rt = document.getElementById('cf-ratio'); if (rt) rt.value = 1.2;
  const bp = document.getElementById('cf-batp'); if (bp) bp.value = 100;
  const bh = document.getElementById('cf-bath'); if (bh) bh.value = 2;
  const ty = document.getElementById('cf-type'); if (ty) ty.value = 'ci';
  const md = document.getElementById('cf-mode'); if (md) md.value = 'surplus';
  const sel = document.getElementById('cf-country'); if (sel) sel.value = '中国';
  cfCountryChanged(true);
  const sm = document.getElementById('cf-socmin'); if (sm) sm.value = 10;
  const sx = document.getElementById('cf-socmax'); if (sx) sx.value = 98;
  const ap = document.getElementById('cf-start-apply'); if (ap) ap.checked = true;
  const now = localTime(geoOf('中国').tz, SIMTIME.utc);
  initStartPickers();
  setStartPickers(now.mo, now.dd, now.hh);
  cfPreview();
}

/* 编辑已有电站：复用创建表单，保存时原地更新 */
let cfEditId = null;
function openEdit(id){
  const p = PLANTS.find(x => x.id === id) || (SIM && SIM.id === id ? SIM : null);
  if (!p) { toast('未找到要编辑的电站'); return; }
  cfEditId = p.id;
  simView = 'create';
  showView();
  setTxt('cf-title', '编辑电站 · ' + p.name);
  setTxt('cf-tag', '修改参数');
  const sb = document.getElementById('cf-submit'); if (sb) sb.textContent = '保存修改';
  document.getElementById('cf-name').value = p.name;
  document.getElementById('cf-country').value = p.country;
  cfCountryChanged(false);
  document.getElementById('cf-city').value = p.city;
  document.getElementById('cf-type').value = p.type;
  document.getElementById('cf-mode').value = p.mode;
  document.getElementById('cf-inv').value = p.invKw;
  document.getElementById('cf-ratio').value = p.ratio;
  document.getElementById('cf-batp').value = p.batKw;
  document.getElementById('cf-bath').value = p.batHours;
  document.getElementById('cf-socmin').value = p.socMin != null ? p.socMin : 10;
  document.getElementById('cf-socmax').value = p.socMax != null ? p.socMax : 98;
  document.getElementById('cf-fit').value = p.tariff.fit;
  document.getElementById('cf-retail').value = p.tariff.retail;
  const useFile = !!p.loadTable && !!p.loadFromFile;
  const rbB = document.getElementById('cf-loadmode-builtin');
  const rbF = document.getElementById('cf-loadmode-file');
  if (rbB && rbF) { rbB.checked = !useFile; rbF.checked = useFile; }
  const lt = localTime(p.tz, SIMTIME.utc);
  const st = p.start || { mo: lt.mo, dd: lt.dd, hh: lt.hh };
  initStartPickers();
  setStartPickers(st.mo, st.dd, st.hh);
  const ap = document.getElementById('cf-start-apply'); if (ap) ap.checked = false;
  const err = document.getElementById('cf-err'); if (err) err.textContent = '';
  cfPreview();
}

/* 当地年月日时 → UTC 时间戳 */
function utcFromLocal(tz, y, mo, dd, hh, mm){
  const naive = Date.UTC(y, mo - 1, dd, hh, mm || 0);
  let guess = naive;
  for (let i = 0; i < 3; i++) {
    guess = naive - tzOffsetMin(tz, guess) * 60000;
  }
  return guess;
}
/* 若勾选「保存后切到该时刻」，把仿真时钟跳到运行开始时间，并重演当天数据 */
function applyStartClock(p){
  const ap = document.getElementById('cf-start-apply');
  if (!ap || !ap.checked) return false;
  const y = localTime(p.tz, SIMTIME.utc).y;
  SIMTIME.utc = utcFromLocal(p.tz, y, p.start.mo, p.start.dd, p.start.hh, 0);
  SIMTIME.anchored = true;          /* 从指定时刻起按真实节奏运行，不再被本机时间拉回 */
  lastTickWall = Date.now();
  PLANTS.forEach(x => seedPlant(x));
  pushAggHist();
  return true;
}

/* 表单校验失败：红字 + 抖动 + 定位到出错字段 + toast，确保用户不会“点了没反应” */
function cfFail(msg, fieldId){
  const err = document.getElementById('cf-err');
  if (err) {
    err.textContent = '⚠ ' + msg;
    err.classList.remove('shake');
    void err.offsetWidth;
    err.classList.add('shake');
  }
  document.querySelectorAll('.cf-inp.bad').forEach(el => el.classList.remove('bad'));
  const f = fieldId ? document.getElementById(fieldId) : null;
  if (f) {
    f.classList.add('bad');
    try { f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  toast(msg);
}

function createPlant(){
  const err = document.getElementById('cf-err');
  const name    = (document.getElementById('cf-name').value || '').trim().replace(/[<>]/g, '');
  const country = document.getElementById('cf-country').value || '中国';
  const city    = (document.getElementById('cf-city').value || '').trim().replace(/[<>]/g, '');
  const type    = document.getElementById('cf-type').value || 'ci';
  const mode    = document.getElementById('cf-mode').value || 'surplus';
  const invKw   = +document.getElementById('cf-inv').value;
  const ratio   = +document.getElementById('cf-ratio').value;
  const batKw   = +document.getElementById('cf-batp').value;
  const batH    = +document.getElementById('cf-bath').value;
  const fit     = +document.getElementById('cf-fit').value;
  const retail  = +document.getElementById('cf-retail').value;
  const useFile = document.getElementById('cf-loadmode-file') && document.getElementById('cf-loadmode-file').checked;
  const geo     = geoOf(country);
  const socMin  = +document.getElementById('cf-socmin').value;
  const socMax  = +document.getElementById('cf-socmax').value;
  const start   = {
    mo: +document.getElementById('cf-start-mo').value || 1,
    dd: +document.getElementById('cf-start-dd').value || 1,
    hh: +document.getElementById('cf-start-hh').value || 0
  };
  const target  = cfEditId ? PLANTS.find(x => x.id === cfEditId) : null;

  if (!target && PLANTS.length >= PLANT_MAX) { cfFail('最多创建 ' + PLANT_MAX + ' 座仿真电站', null); return; }
  if (cfEditId && !target) { cfFail('要修改的电站已不存在，请返回列表重试', null); return; }
  if (!city) { cfFail('请选择或填写电站所在城市', 'cf-city'); return; }
  if (!(invKw > 0)) { cfFail('光伏逆变器最大交流功率需大于 0', 'cf-inv'); return; }
  if (!(ratio > 1 && ratio < 10)) { cfFail('容配比需大于 1 且小于 10（当前 ' + ratio + '）', 'cf-ratio'); return; }
  if (!(batKw > 0)) { cfFail('储能最大充放电功率需大于 0', 'cf-batp'); return; }
  if (!(batH > 0)) { cfFail('充放电小时数需大于 0', 'cf-bath'); return; }
  if (!(socMin >= 0 && socMin <= 90)) { cfFail('SOC 放电下限需在 0% – 90% 之间', 'cf-socmin'); return; }
  if (!(socMax <= 100 && socMax >= socMin + 5)) { cfFail('SOC 充电上限需比下限至少高 5%，且不超过 100%', 'cf-socmax'); return; }
  if (!(retail >= 0)) { cfFail('买电电价需为不小于 0 的数值', 'cf-retail'); return; }
  if (!(fit >= 0)) { cfFail('上网电价需为不小于 0 的数值', 'cf-fit'); return; }
  if (useFile && !LOAD_STORE.ready) { cfFail('未加载负载曲线文件，请先上传或改用内置曲线', null); return; }
  if (invKw > 100000 || batKw > 100000 || batH > 24) { cfFail('参数超出仿真范围（功率 ≤ 100000 kW，小时数 ≤ 24）', 'cf-inv'); return; }
  document.querySelectorAll('.cf-inp.bad').forEach(el => el.classList.remove('bad'));
  err.textContent = '';

  const payload = {
    name: name || (city + (type === 'res' ? '户用光储站' : '光储站')),
    country, city, type, mode, invKw, ratio, batKw, batHours: batH,
    tariff: { cur: geo.cur, sym: geo.sym, retail: retail, fit: fit },
    socMin, socMax, start
  };

  /* ---------- 编辑已有电站：原地更新，保留 id / 天气种子 / 累计数据 ---------- */
  if (target) {
    const keep = {
      id: target.id, seed: target.seed, created: target.created,
      totalBase: target.totalBase, totalRev: target.totalRev,
      geo: target.geo, inverterThermal: target.inverterThermal, strategy:target.strategy, targetSoc:target.targetSoc,
      cloud: target.cloud, loadScale: target.loadScale, batMode: target.batMode, gridOut: target.gridOut
    };
    const np = makePlant(payload);
    Object.assign(np, keep);
    if (useFile && LOAD_STORE.ready) { np.loadTable = LOAD_STORE.table; np.loadFromFile = true; }
    else { np.loadTable = null; np.loadFromFile = false; }
    const idx = PLANTS.indexOf(target);
    if (idx >= 0) PLANTS[idx] = np; else PLANTS.push(np);
    SIM = np;
    seedPlant(np);
    const jumped = applyStartClock(np);
    savePlantCfg();
    simEvent(np, '电站参数已更新：' + TYPE_NAME[np.type] + ' / ' + MODE_NAME[np.mode] + '，光伏 ' + np.cfg.pvKwp +
      ' kWp / 储能 ' + np.cfg.batKwh + ' kWh（SOC ' + np.socMin + '–' + np.socMax + '%）', '#3a7afe');
    cfEditId = null;
    renderPlantList();
    simView = 'detail';
    syncDetailControls();
    showView();
    simRender();
    publishState();
    toast('已保存「' + np.name + '」的修改' + (jumped ? '，仿真时钟已切到运行开始时间' : ''));
    return;
  }

  /* ---------- 新建 ---------- */
  const p = makePlant(payload);
  if (useFile) { p.loadTable = LOAD_STORE.table; p.loadFromFile = true; }
  PLANTS.push(p);
  seedPlant(p);
  const jumpedNew = applyStartClock(p);
  savePlantCfg();
  simEvent(p, '电站创建并网：' + TYPE_NAME[p.type] + ' / ' + MODE_NAME[p.mode] + '，光伏 ' + p.cfg.pvKwp +
    ' kWp（容配比 ' + p.ratio.toFixed(2) + '）/ 储能 ' + p.cfg.batKwh + ' kWh（SOC ' + p.socMin + '–' + p.socMax + '%）', '#30d158');
  SIM = p;
  renderPlantList();          /* 列表 DOM 立即与新数据同步，返回列表时不会看到旧内容 */
  simView = 'detail';
  syncDetailControls();
  showView();
  simRender();
  publishState();
  toast('已创建「' + p.name + '」' + (jumpedNew ? '，仿真从 ' + p.start.mo + '/' + p.start.dd + ' ' + pad2(p.start.hh) + ':00 开始' : '，按 ' + country + ' 当地时间运行'));
}

/* ================= 控件 ================= */
function simToggle(){
  SIMTIME.running = !SIMTIME.running;
  if (SIM) simEvent(SIM, SIMTIME.running ? '仿真继续运行' : '仿真已暂停', '#5f6675');
  simRender();
}
function simCycleSpeed(){
  const arr = [1, 60, 180, 600, 3600];
  SIMTIME.speed = arr[(arr.indexOf(SIMTIME.speed) + 1) % arr.length];
  if (SIMTIME.speed === 1) {
    SIMTIME.utc = Date.now();          /* 切回实时：立刻与本地时间对齐 */
    SIMTIME.anchored = false;
    lastTickWall = Date.now();
    if (SIM) simEvent(SIM, '仿真时钟已切回实时（1×），与本机时间同步', '#30d158');
    toast('实时模式：时钟已与本机时间同步');
  } else {
    if (SIM) simEvent(SIM, '时间倍率切换为 ' + SIMTIME.speed + '× 加速', '#3a7afe');
    toast('演示加速 ' + SIMTIME.speed + '×（时钟会快于真实时间）');
  }
  simRender();
}
function simSetCloud(v){
  if (!SIM) return;
  SIM.cloud = +v / 100;
  setTxt('v-cloud', v + '%');
}
function simSetLoad(v){
  if (!SIM) return;
  SIM.loadScale = +v / 100;
  setTxt('v-load', v + '%');
}
function simSetBat(m){
  if (!SIM) return;
  SIM.batMode = m;
  document.querySelectorAll('#seg-bat span').forEach(el => el.classList.toggle('on', el.dataset.m === m));
  setTxt('v-batmode', BAT_MODE_NAME[m]);
  simEvent(SIM, '储能策略：' + BAT_MODE_NAME[m], '#ff9f0a');
}
function simToggleGrid(){
  if (!SIM) return;
  SIM.gridOut = !SIM.gridOut;
  simEvent(SIM, SIM.gridOut ? '并网点停电，转离网运行' : '并网点恢复供电', SIM.gridOut ? '#ff453a' : '#30d158');
  simRender();
}

/* 预演：从当地当天 00:00 跑到当前时刻 */
function seedPlant(p){
  const sMin = p.socMin != null ? p.socMin : 10;
  const sMax = p.socMax != null ? p.socMax : 98;
  p.soc = Math.max(sMin, Math.min(sMax, Math.min(sMax, 96)));
  p.dayPv = p.dayLoad = p.dayImp = p.dayExp = p.dayChg = p.dayDis = 0;
  p.dayRev = 0; p.daySelf = 0;
  p.hourly = new Array(24).fill(0);
  p.hist = []; p.alarmAt = []; p.alarmAt = {};
  const lt = localTime(p.tz, SIMTIME.utc);
  const midnight = SIMTIME.utc - lt.minOfDay * 60000;
  p.dayKey = lt.dayKey;
  for (let m = 0; m < lt.minOfDay; m += 2) {
    simStepPlant(p, 2, true, midnight + m * 60000);
  }
  simStepPlant(p, 1, true, SIMTIME.utc);
  p.hist = [];
  p.local = localTime(p.tz, SIMTIME.utc);
}

/* ================= 存储同步层 ================= */
const SIM_KEY = 'fs_sim_state_v3';
const CFG_KEY = 'fs_sim_plants_v2';
/* 分享演示：朋友通过带参数的链接打开时，电站配置存到独立键，绝不覆盖本机真实配置 */
const CFG_DEMO_KEY = CFG_KEY + '_demo';
let DEMO_MODE = false;
function cfgKey(){ return DEMO_MODE ? CFG_DEMO_KEY : CFG_KEY; }
const AGG_HIST = [];
const alarms = [];
/* 历史采样长度：1.5 秒/点 × 200 = 5 分钟，供 APP 小源曲线卡与详情页曲线使用 */
const HIST_LEN = 200;

function r1(v){ return Math.round(v * 10) / 10; }
function r2(v){ return Math.round(v * 100) / 100; }
function toast(msg){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

function houseSVG(seed){
  const hue = [205, 35, 150, 265, 15][seed % 5];
  return '<svg class="house-thumb" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" fill="hsl(' + hue + ',35%,72%)"/>' +
    '<circle cx="78" cy="20" r="11" fill="rgba(255,255,240,.85)"/>' +
    '<rect y="62" width="100" height="38" fill="hsl(' + hue + ',30%,42%)"/>' +
    '<path d="M18 62 50 34l32 28z" fill="#f4f1ea"/>' +
    '<path d="M30 52h26l6 5H30z" fill="#25344e"/>' +
    '<path d="M31 51.5h24v-3H31z" fill="#1d2a40"/>' +
    '<rect x="42" y="56" width="11" height="16" fill="#5a4632"/>' +
    '<rect x="58" y="66" width="12" height="12" fill="#ffd98a" opacity=".9"/>' +
    '<path d="M58 66h12v12H58z" fill="none" stroke="#7a6440" stroke-width="1"/>' +
  '</svg>';
}

function pushAggHist(){
  const v = { pv:0, load:0, bat:0, grid:0 };
  PLANTS.forEach(p => { v.pv += p.pv; v.load += p.load; v.bat += p.bat; v.grid += p.grid; });
  AGG_HIST.push({ pv: r1(v.pv), load: r1(v.load), bat: r1(v.bat), grid: r1(v.grid) });
  if (AGG_HIST.length > HIST_LEN) AGG_HIST.shift();
}

function savePlantCfg(){
  const config = PLANTS.map(p => ({
      id: p.id, name: p.name, country: p.country, city: p.city,
      geo: p.geo, inverterThermal: null, strategy:p.strategy||null, targetSoc:p.targetSoc||null,
      invKw: p.invKw, ratio: p.ratio, batKw: p.batKw, batHours: p.batHours,
      type: p.type, mode: p.mode, tariff: p.tariff, created: p.created,
      socMin: p.socMin, socMax: p.socMax, start: p.start,
      seed: p.seed, useLoadFile: !!p.loadTable, loadTable: p.loadTable || null, closed: !!p.closed,
      cloud: p.cloud, loadScale: p.loadScale, batMode: p.batMode, gridOut: p.gridOut
    }));
  try { localStorage.setItem(cfgKey(), JSON.stringify(config)); } catch (e) {}
  if (globalThis.ManagerBridge) ManagerBridge.saveConfig(config);
}
function loadPlantCfg(){
  if (globalThis.ManagerBridge && ManagerBridge.serverConfig !== null) return ManagerBridge.serverConfig;
  try {
    const raw = localStorage.getItem(cfgKey());
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr : null;
  } catch (e) { return null; }
}

/* ================= 分享电站：把参数编码进链接 ================= */
const SHARE_TTL = 6 * 3600 * 1000;   /* 分享数据有效期 6 小时，避免长期残留 */

function b64u(s){
  try {
    const b = btoa(unescape(encodeURIComponent(s)));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) { return ''; }
}
function unb64u(t){
  try {
    const b = t.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
  } catch (e) { return ''; }
}
/* 精简字段（短键），一座站约 250 字节，链接可控制在 400 字符内 */
function plantToShort(p){
  return {
    n: p.name, c: p.country, ci: p.city,
    i: p.invKw, r: p.ratio, bk: p.batKw, bh: p.batHours,
    t: p.type, m: p.mode, tar: p.tariff,
    mn: p.socMin, mx: p.socMax, st: p.start, sd: p.seed
  };
}
function shortToPlant(o){
  return {
    name: o.n, country: o.c, city: o.ci,
    invKw: o.i, ratio: o.r, batKw: o.bk, batHours: o.bh,
    type: o.t, mode: o.m, tariff: o.tar,
    socMin: o.mn, socMax: o.mx, start: o.st, seed: o.sd
  };
}
function shareUrlFor(p){ return location.origin + '/app/'; }
function copyToClipboard(txt){
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(() => true).catch(() => false);
    }
  } catch (e) {}
  return Promise.resolve(false);
}
function sharePlant(id){
  const p = PLANTS.find(x => x.id === (id || (SIM && SIM.id)));
  if (!p) { toast('没有可分享的电站'); return; }
  const url = shareUrlFor(p);
  copyToClipboard(url).then(ok => {
    if (ok) { toast('链接已复制，发给朋友即可看到「' + p.name + '」'); return; }
    /* 剪贴板被拒（非 https / 权限）时退回手动复制 */
    const t = document.getElementById('toast');
    if (t) {
      t.innerHTML = '<div style="max-width:min(86vw,560px);word-break:break-all;text-align:left">'
        + '已生成分享链接，请手动复制：<br><span style="color:var(--accent-text)">' + esc(url) + '</span></div>';
      t.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { t.classList.remove('show'); }, 20000);
    }
  });
}
/* 进入页面前先决定是不是演示模式：链接里带 #p=，或本机有未过期的分享数据 */
const CFG_SHARE_KEY = 'fs_sim_share_v1';
function initShareMode(){
  let list = null, fresh = false;
  const m = /(?:^|[#&])p=([A-Za-z0-9\-_]+)/.exec(location.hash || '');
  if (m) {
    try { list = JSON.parse(unb64u(m[1])); } catch (e) { list = null; }
    if (Array.isArray(list) && list.length) {
      fresh = true;
      try { localStorage.setItem(CFG_SHARE_KEY, JSON.stringify({ t: Date.now(), list: list })); } catch (e) {}
    }
  }
  if (!Array.isArray(list) || !list.length) {
    list = null;
    try {
      const o = JSON.parse(localStorage.getItem(CFG_SHARE_KEY) || 'null');
      if (o && Array.isArray(o.list) && o.list.length && Date.now() - (o.t || 0) < SHARE_TTL) list = o.list;
      else if (o) localStorage.removeItem(CFG_SHARE_KEY);
    } catch (e) { list = null; }
  }
  if (!Array.isArray(list) || !list.length) return;
  DEMO_MODE = true;
  /* 首次进入（或链接带了新电站）才写入演示配置；之后保留访客在演示里的调整 */
  if (fresh || !localStorage.getItem(CFG_DEMO_KEY)) {
    try {
      localStorage.setItem(CFG_DEMO_KEY, JSON.stringify(list.map(o => (o && o.name != null ? o : shortToPlant(o)))));
    } catch (e) {}
  }
}
function exitDemo(ev){
  if (ev && ev.preventDefault) ev.preventDefault();
  try {
    localStorage.removeItem(CFG_DEMO_KEY);
    localStorage.removeItem(CFG_SHARE_KEY);
  } catch (e) {}
  location.href = (location.href || '').split('#')[0];
}
function showDemoTip(){
  const el = document.getElementById('demo-tip');
  if (!el) return;
  const nm = document.getElementById('demo-name');
  const n = (PLANTS[0] && PLANTS[0].name) || '演示电站';
  if (nm) nm.textContent = n + (PLANTS.length > 1 ? ' 等 ' + PLANTS.length + ' 座' : '');
  el.style.display = 'flex';
  try { document.title = n + ' · 光储电站仿真台'; } catch (e) {}
}
/* 页面已打开时又收到一条分享链接（只变 hash 不会重载）→ 主动重载进入演示模式 */
window.addEventListener('hashchange', function () {
  if (/(?:^|[#&])p=[A-Za-z0-9\-_]+/.test(location.hash || '')) location.reload();
});

/* ================= 远程指令总线：APP 小源 → 仿真台（改 SOC 区间等） ================= */
const CMD_KEY = 'fs_sim_cmd_v1';
const ACK_KEY = 'fs_sim_ack_v1';
let lastCmdTs = 0;

function initCmdBus(){
  lastCmdTs = 0;
}
function ackCmd(c, ok, msg){
  if (globalThis.ManagerBridge) ManagerBridge.ack(c, ok, msg);
}
function applyServerTargetSoc(s){
  const p=PLANTS.find(p=>p.id===s.plantId);if(!p||p.targetSoc?.commandId===s.commandId)return false;
  if(!Number.isInteger(s.target)||s.target<(p.socMin??0)||s.target>(p.socMax??100)||!['stop','charge','discharge'].includes(s.direction))return false;
  p.targetSoc={target:s.target,direction:s.direction,commandId:s.commandId,updatedAt:s.updatedAt};p.batMode=s.direction==='stop'?'idle':s.direction;p.strategy=null;return true;
}
function pollCmd(c){
  if (!c || !c.ts || c.ts <= lastCmdTs) return;
  lastCmdTs = c.ts;

  if(c.type==='target-soc'){
    const p=PLANTS.find(p=>p.id===c.plantId);
    if(!p){ackCmd(c,false,'目标电站不存在');return;}
    if(!Number.isInteger(c.target)||c.target<(p.socMin??0)||c.target>(p.socMax??100)||!['stop','charge','discharge'].includes(c.direction)||!(p.cfg.batKw>0)){ackCmd(c,false,'目标SOC或充放电方式不符合设备范围');return;}
    p.targetSoc={target:c.target,direction:c.direction};p.batMode=c.direction==='stop'?'idle':c.direction;p.strategy=null;
    savePlantCfg();simRender();publishState();ackCmd(c,true,'目标SOC已设置为 '+c.target+'%，'+({stop:'已停止手动充放电',charge:'充电至目标后停止',discharge:'放电至目标后停止'})[c.direction]+'；当前SOC未被改写');return;
  }

  if(c.type==='strategy'){
    const p=PLANTS.find(x=>x.id===c.plantId);
    if(!p){ackCmd(c,false,'目标电站不存在');return;}
    if(p.strategy?.commandId===c.id){ackCmd(c,true,'策略已接收，计划保持不变');return;}
    if(c.cancel){
      if(!p.strategy){ackCmd(c,true,'策略已撤销，当前使用电站原调度');return;}
      if(p.strategy.id!==c.planId){ackCmd(c,false,'电站当前策略已变更，请刷新后重试');return;}
      p.strategy=null;savePlantCfg();simRender();publishState();ackCmd(c,true,'已撤销策略，恢复电站原调度');return;
    }
    if(p.closed){ackCmd(c,false,'电站已关闭，请先启动电站');return;}
    if(!Number.isFinite(c.min)||!Number.isFinite(c.max)||c.min<0||c.max>100||c.max-c.min<5||!Array.isArray(c.rows)||c.rows.length!==24||c.rows.some((r,i)=>r.hour!==i||!Number.isFinite(r.batKw)||Math.abs(r.batKw)>p.cfg.batKw+.001)) {ackCmd(c,false,'策略参数或功率超出设备范围');return;}
    const lt=localTime(p.tz,SIMTIME.utc),day=new Date(Date.UTC(lt.y,lt.mo-1,lt.dd+1));
    const startsAt=utcFromLocal(p.tz,day.getUTCFullYear(),day.getUTCMonth()+1,day.getUTCDate(),0,0);
    const next=new Date(Date.UTC(lt.y,lt.mo-1,lt.dd+2)),endsAt=utcFromLocal(p.tz,next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate(),0,0);
    p.strategy={id:c.planId,commandId:c.id,min:c.min,max:c.max,rows:c.rows.map(r=>({hour:r.hour,batKw:r.batKw})),startsAt,endsAt};
    savePlantCfg();simEvent(p,'小源策略指令已执行：已安排下一仿真日24小时充放电计划','#3a7afe');simRender();publishState();
    ackCmd(c,true,'策略已接收，将于电站当地仿真时间 '+localTime(p.tz,startsAt).date+' 00:00 生效，持续一天');return;
  }

  if (c.type === 'soc') {
    const p = (c.plantId && PLANTS.find(x => x.id === c.plantId)) || SIM || PLANTS[0];
    if (!p) { ackCmd(c, false, '仿真台里没有可修改的电站'); return; }
    let min = Math.round(+c.min);
    let max = Math.round(+c.max);
    if (!isFinite(min)) min = p.socMin;
    if (!isFinite(max)) max = p.socMax;
    min = Math.max(0, Math.min(90, min));
    max = Math.max(min + 5, Math.min(100, max));
    p.socMin = min; p.socMax = max;
    p.soc = Math.max(min, Math.min(max, p.soc));
    savePlantCfg();
    simEvent(p, '储能 SOC 工作区间调整为 ' + min + '% – ' + max + '%（来自 APP 小源）', '#3a7afe');
    simRender();
    publishState();
    ackCmd(c, true, '已更新「' + p.name + '」储能 SOC 区间为 ' + min + '% – ' + max + '%');
    return;
  }
  if (c.type === 'start') {
    const p = (c.plantId && PLANTS.find(x => x.id === c.plantId)) || SIM || PLANTS[0];
    if (!p) { ackCmd(c, false, '仿真台里没有可修改的电站'); return; }
    p.start = { mo: +c.mo || 1, dd: +c.dd || 1, hh: +c.hh || 0 };
    const y = localTime(p.tz, SIMTIME.utc).y;
    SIMTIME.utc = utcFromLocal(p.tz, y, p.start.mo, p.start.dd, p.start.hh, 0);
    SIMTIME.anchored = true;
    lastTickWall = Date.now();
    PLANTS.forEach(x => seedPlant(x));
    savePlantCfg();
    simEvent(p, '运行开始时间调整为 ' + pad2(p.start.mo) + '/' + pad2(p.start.dd) + ' ' + pad2(p.start.hh) + ':00（来自 APP 小源）', '#3a7afe');
    simRender(); publishState();
    ackCmd(c, true, '已将「' + p.name + '」运行开始时间设为 ' + p.start.mo + ' 月 ' + p.start.dd + ' 日 ' + pad2(p.start.hh) + ':00');
    return;
  }
  if (c.type === 'config') {
    /* 来自 APP 小源的参数面板：把可设置的参数整块重建（保留 id / 种子 / 累计数据） */
    const p = (c.plantId && PLANTS.find(x => x.id === c.plantId)) || SIM || PLANTS[0];
    if (!p) { ackCmd(c, false, '仿真台里没有可修改的电站'); return; }
    const patch = c.patch || {};
    const num = (v, d) => (v != null && v !== '' && isFinite(+v)) ? +v : d;
    const pvKwp = num(patch.pvKwp, p.cfg.pvKwp);
    /* 容配比：没直接给时，若只改了逆变器功率则保持直流装机不变反推，否则沿用原值 */
    let ratio = num(patch.ratio, null);
    if (ratio == null && patch.invKw != null && patch.pvKwp == null) {
      ratio = pvKwp / Math.max(1, +patch.invKw);
    }
    if (ratio == null || !isFinite(ratio)) ratio = p.ratio;
    ratio = Math.min(10, Math.max(1.001, ratio));
    /* 国家 / 城市：换国家时按新国家的时区与默认电价，币种一并切换 */
    const country = (patch.country && GEO[patch.country]) ? patch.country : p.country;
    const geoNew = geoOf(country);
    const cc = country !== p.country;
    const city = (patch.city != null && String(patch.city).trim())
      ? String(patch.city).trim().replace(/[<>]/g, '').slice(0, 16)
      : (cc ? (geoNew.cities[0] || p.city) : p.city);
    /* 运行开始时间（月 / 日 / 时） */
    const st0 = p.start || {};
    const startNew = {
      mo: Math.min(12, Math.max(1, Math.round(num(patch.startMo, st0.mo)))),
      dd: Math.min(31, Math.max(1, Math.round(num(patch.startDd, st0.dd)))),
      hh: Math.min(23, Math.max(0, Math.round(num(patch.startHh, st0.hh))))
    };
    const startMoved = startNew.mo !== st0.mo || startNew.dd !== st0.dd || startNew.hh !== st0.hh;
    const payload = {
      name: (patch.name != null && String(patch.name).trim()) ? String(patch.name).trim().replace(/[<>]/g, '') : p.name,
      country: country, city: city,
      type: (patch.type === 'res' || patch.type === 'ci') ? patch.type : p.type,
      mode: (patch.mode === 'self' || patch.mode === 'surplus') ? patch.mode : p.mode,
      invKw: Math.max(1, num(patch.invKw, pvKwp / ratio)), ratio: ratio,
      batKw: Math.max(1, num(patch.batKw, p.batKw)),
      batHours: Math.min(24, Math.max(0.5, num(patch.batHours, p.batHours))),
      tariff: {
        cur: cc ? geoNew.cur : p.tariff.cur,
        sym: cc ? geoNew.sym : p.tariff.sym,
        retail: Math.max(0, num(patch.retail, cc ? geoNew.retail : p.tariff.retail)),
        fit: Math.max(0, num(patch.fit, cc ? geoNew.fit : p.tariff.fit))
      },
      socMin: num(patch.socMin, p.socMin), socMax: num(patch.socMax, p.socMax),
      start: startNew
    };
    const keep = {
      id: p.id, seed: p.seed, created: p.created,
      totalBase: p.totalBase, totalRev: p.totalRev,
      loadScale: Math.max(0.2, Math.min(3, num(patch.loadScale, p.loadScale))),
      batMode: patch.batMode || p.batMode,
      gridOut: patch.gridOut != null ? !!patch.gridOut : p.gridOut,
      cloud: Math.max(0, Math.min(1, num(patch.cloud, p.cloud))),
      closed: patch.closed != null ? !!patch.closed : !!p.closed,
      loadTable: p.loadTable, loadFromFile: p.loadFromFile,
      geo: p.geo, inverterThermal: p.inverterThermal, invTemp: p.invTemp, strategy:p.strategy, targetSoc:p.targetSoc,
      soc: p.soc, batTemp: p.batTemp
    };
    const np = makePlant(payload);
    Object.assign(np, keep);
    /* 系统效率 / 充放电效率 / 负载峰值 / 并网容量：只改数值，不重建曲线种子 */
    np.cfg.pr = Math.max(0.5, Math.min(1.2, num(patch.pr, p.cfg.pr || 0.86)));
    np.cfg.eff = Math.max(0.8, Math.min(1, num(patch.eff, p.cfg.eff || 0.96)));
    np.cfg.loadPeak = Math.max(1, Math.round(num(patch.loadPeak, p.cfg.loadPeak)));
    np.cfg.gridKw = Math.max(1, Math.round(num(patch.gridKw, p.cfg.gridKw)));
    np.soc = Math.max(np.socMin, Math.min(np.socMax, np.soc));
    if (patch.socNow != null && isFinite(+patch.socNow)) {
      np.soc = Math.max(np.socMin, Math.min(np.socMax, +patch.socNow));
    }
    const idx = PLANTS.indexOf(p);
    if (idx >= 0) PLANTS[idx] = np; else PLANTS.push(np);
    if (SIM === p) SIM = np;
    /* 运行起始时间改了：把仿真时钟拨到新的起点，所有电站曲线重算 */
    if (startMoved) {
      const y = localTime(np.tz, SIMTIME.utc).y;
      SIMTIME.utc = utcFromLocal(np.tz, y, np.start.mo, np.start.dd, np.start.hh, 0);
      SIMTIME.anchored = true;
      lastTickWall = Date.now();
      PLANTS.forEach(x => seedPlant(x));
      simEvent(np, '运行开始时间调整为 ' + pad2(np.start.mo) + '/' + pad2(np.start.dd) + ' ' + pad2(np.start.hh) +
        ':00（来自 APP 小源）', '#3a7afe');
    }
    seedPlant(np);
    savePlantCfg();
    const bits = [];
    if (cc) bits.push('地区 ' + np.country + ' · ' + np.city);
    if (np.closed) bits.push('已停机');
    bits.push('光伏 ' + np.cfg.pvKwp + ' kWp');
    bits.push('储能 ' + np.cfg.batKwh + ' kWh（SOC ' + np.socMin + '–' + np.socMax + '%）');
    bits.push('买电 ' + np.tariff.sym + np.tariff.retail + ' / 上网 ' + np.tariff.sym + np.tariff.fit);
    simEvent(np, '参数已更新（来自 APP 小源）：' + np.name + ' · ' + bits.join(' / '), '#3a7afe');
    simRender(); publishState();
    ackCmd(c, true, '已更新「' + np.name + '」：' + np.cfg.pvKwp + ' kWp · 储能 ' + np.cfg.batKwh + ' kWh · 买电 ' +
      np.tariff.sym + np.tariff.retail + ' / 上网 ' + np.tariff.sym + np.tariff.fit);
    return;
  }
  if (c.type === 'speed') {
    const sp = Math.max(1, Math.min(36000, Math.round(+c.value || 1)));
    SIMTIME.speed = sp;
    lastTickWall = Date.now();
    simEvent(SIM || PLANTS[0], '仿真倍速调整为 ' + (sp === 1 ? '实时' : sp + '× 加速') + '（来自 APP 小源）', '#3a7afe');
    simRender(); publishState();
    ackCmd(c, true, '仿真时钟已切换为 ' + (sp === 1 ? '实时（1×）' : sp + '× 加速'));
    return;
  }
  if (c.type === 'power') {
    const p = (c.plantId && PLANTS.find(x => x.id === c.plantId)) || SIM || PLANTS[0];
    if (!p) { ackCmd(c, false, '仿真台里没有可操作的电站'); return; }
    const on = !!c.on;
    p.closed = !on;
    if (!on) { p.pv = 0; p.load = 0; p.bat = 0; p.grid = 0; p.demand = 0; p.shed = 0; p.curtail = 0; }
    else { p.dayKey = localTime(p.tz, SIMTIME.utc).dayKey; simStepPlant(p, 1, true); }
    savePlantCfg();
    simEvent(p, on ? '电站已启动，恢复并网运行（来自 APP）' : '电站已关闭，停止发电与调度（来自 APP）', on ? '#30d158' : '#ff9f0a');
    simRender(); publishState();
    ackCmd(c, true, (on ? '已启动「' : '已关闭「') + p.name + '」');
    return;
  }
  if (c.type === 'delete') {
    const i = PLANTS.findIndex(x => x.id === c.plantId);
    if (i < 0) { ackCmd(c, false, '仿真台里没有这座电站'); return; }
    const nm = PLANTS[i].name;
    PLANTS.splice(i, 1);
    if (SIM && SIM.id === c.plantId) SIM = PLANTS[0] || null;
    savePlantCfg();
    simRender(); publishState();
    ackCmd(c, true, '已删除「' + nm + '」');
    return;
  }
  ackCmd(c, false, '不支持的指令类型：' + c.type);
}

function publishState(){
  const agg = {
    pv:0, dayPv:0, dayLoad:0, dayImp:0, dayExp:0, dayChg:0, dayDis:0, totalKwh:0, soc:0,
    revenue:0, totalRev:0, cur:'CNY', sym:'¥',
    hourly: new Array(24).fill(0), hist: AGG_HIST.slice(-HIST_LEN)
  };
  PLANTS.forEach(p => {
    agg.pv += p.pv; agg.dayPv += p.dayPv; agg.dayLoad += p.dayLoad;
    agg.dayImp += p.dayImp; agg.dayExp += p.dayExp; agg.dayChg += p.dayChg; agg.dayDis += p.dayDis;
    agg.totalKwh += p.totalBase + p.dayPv; agg.soc += p.soc;
    agg.revenue += p.dayRev; agg.totalRev += p.totalRev + p.dayRev;
    p.hourly.forEach((v, i) => { agg.hourly[i] += v; });
  });
  if (PLANTS.length) { agg.cur = PLANTS[0].tariff.cur; agg.sym = PLANTS[0].tariff.sym; }
  agg.soc = PLANTS.length ? agg.soc / PLANTS.length : 0;
  ['pv','dayPv','dayLoad','dayImp','dayExp','revenue','totalRev'].forEach(k => { agg[k] = r2(agg[k]); });
  agg.totalKwh = r2(agg.totalKwh); agg.soc = r1(agg.soc);
  agg.hourly = agg.hourly.map(v => r2(v));

  const base = PLANTS[0];
  const ltBase = base ? localTime(base.tz, SIMTIME.utc) : null;
  const state = {
    v: 3,
    ts: Date.now(),
    time: {
      utc: SIMTIME.utc, speed: SIMTIME.speed, running: SIMTIME.running,
      clock: ltBase ? ltBase.clock : '', dateText: ltBase ? ltBase.dateText : '',
      day: ltBase ? ltBase.doy : 1, tz: base ? base.tz : 'Asia/Shanghai',
      tzLabel: ltBase ? ltBase.tzLabel : ''
    },
    agg: agg,
    plants: PLANTS.map(p => ({
      id: p.id, name: p.name, country: p.country, city: p.city, created: p.created,
      tz: p.tz, type: p.type, mode: p.mode, ratio: p.ratio, geo: p.geo,
      socMin: p.socMin, socMax: p.socMax, start: p.start,
      invKw: p.invKw, batKw: p.batKw, batHours: p.batHours, cfg: p.cfg, tariff: p.tariff,
      loadFromFile: !!p.loadTable,
      cloud: p.cloud, loadScale: p.loadScale, batMode: p.batMode, gridOut: p.gridOut, closed: !!p.closed, targetSoc:p.targetSoc,
      pv: r2(p.pv), load: r2(p.load), demand: r2(p.demand), bat: r2(p.bat), grid: r2(p.grid),
      shed: r2(p.shed), curtail: r2(p.curtail), soc: r1(p.soc), batTemp: r1(p.batTemp), invTemp: r1(p.invTemp), inverterThermal: p.inverterThermal,
      dayPv: r2(p.dayPv), dayLoad: r2(p.dayLoad), dayImp: r2(p.dayImp), dayExp: r2(p.dayExp),
      dayChg: r2(p.dayChg), dayDis: r2(p.dayDis), dayRev: r2(p.dayRev), daySelf: r2(p.daySelf),
      totalBase: Math.round(p.totalBase), totalRev: r2(p.totalRev + p.dayRev),
      local: p.local ? { clock: p.local.clock, date: p.local.date, dateText: p.local.dateText,
                         tzLabel: p.local.tzLabel, minOfDay: p.local.minOfDay, doy: p.local.doy } : null,
      hourly: p.hourly.map(v => r1(v)),
      hist: p.hist.slice(-HIST_LEN).map(h => ({ utc: h.utc, pv: r1(h.pv), load: r1(h.load), bat: r1(h.bat), grid: r1(h.grid), invTemp: Number.isFinite(h.invTemp) ? r1(h.invTemp) : null })),
      events: p.events.slice(0, 5)
    })),
    alarms: alarms.slice(0, 30)
  };
  try { localStorage.setItem(SIM_KEY, JSON.stringify(state)); } catch (e) {}
  if (globalThis.ManagerBridge) ManagerBridge.publish(state);
}

/* ---------- 总渲染 ---------- */
function simRender(){
  const base = SIM || PLANTS[0];
  const lt = base ? localTime(base.tz, SIMTIME.utc) : null;
  setTxt('sim-time', lt ? lt.clock : '--:--');
  const modeTxt = SIMTIME.speed > 1
    ? ' · 演示加速中'
    : (SIMTIME.anchored
        ? ' · 自 ' + pad2(((SIM && SIM.start) || {}).mo || 1) + '/' + pad2(((SIM && SIM.start) || {}).dd || 1) + ' ' + pad2(((SIM && SIM.start) || {}).hh || 0) + ':00 起'
        : ' · 实时');
  setTxt('sim-day', lt ? '仿真日期 ' + lt.date + ' · ' + lt.tzLabel + modeTxt : '');
  const spd = document.getElementById('sim-spd');
  if (spd) {
    spd.textContent = SIMTIME.speed === 1 ? '实时' : SIMTIME.speed + '× 加速';
    spd.className = 'sim-spd ' + (SIMTIME.speed === 1 ? 'live' : 'hot');
  }
  const st = document.getElementById('sim-state');
  if (st) {
    st.classList.toggle('paused', !SIMTIME.running);
    st.innerHTML = '<i></i>' + (SIMTIME.running ? '运行中' : '已暂停');
  }
  if (simView === 'list') {
    renderPlantList();
    if (base) setTxt('sim-phase', dayPhase(base));
  } else if (simView === 'detail') {
    renderPlantDetail();
  }
  pushAggHist();
  publishState();
}

/* ---------- 初始化 ---------- */
/* 分享访问凭证：线上链接带 ?sharecode=xxx，页面间跳转必须原样带上，否则会提示「链接不完整」 */
function shareQuery(){
  let q = location.search || '';
  try {
    const m = q.match(/[?&]sharecode=([^&]+)/);
    if (m) localStorage.setItem('fs_sharecode', m[1]);
    else {
      const s = localStorage.getItem('fs_sharecode');
      if (s) q = '?sharecode=' + s;
    }
  } catch (e) {}
  return q;
}
function syncAppLink(){
  const a = document.getElementById('lnk-app');
  if (a) a.href = '/app/';
}

function simInit(snapshot){
  SIMTIME.utc = Date.now();
  SIMTIME.speed = 3600;           /* 默认 3600× 加速（1 秒 = 1 小时）：演示走完一天很快，顶栏可切回实时 */
  syncAppLink();                  /* 分享链接访问时，把 sharecode 透传给「打开 APP 监控」 */
  // Shared workspace configuration is restored by the management session.                /* 带分享参数访问 → 切到演示模式，配置存独立键 */

  const saved = loadPlantCfg();
  if (saved) {
    saved.forEach(o => {
      const p = makePlant(o);
      p.id = o.id || p.id;
      if (o.id && /^P\d+$/.test(o.id)) plantSeq = Math.max(plantSeq, +o.id.slice(1));
      if (o.seed) p.seed = o.seed;
      if (o.loadTable) { p.loadTable = o.loadTable; p.loadFromFile = true; }
      for (const k of ['cloud','loadScale','batMode','gridOut']) if (o[k] != null) p[k] = o[k];
      p.closed = !!o.closed;
      if (p.closed) { p.pv = 0; p.load = 0; p.bat = 0; p.grid = 0; }
      if (o.created) p.created = o.created;
      if (o.useLoadFile && LOAD_STORE.ready) { p.loadTable = LOAD_STORE.table; p.loadFromFile = true; }
      PLANTS.push(p);
      if (!snapshot?.plants?.some(saved => saved.id === p.id && Array.isArray(saved.hourly) && Array.isArray(saved.hist))) seedPlant(p);
    });
  } else {
    const p0 = makePlant({
      name: '光储仿真站', country: '中国', city: '苏州市',
      type: 'ci', mode: 'surplus', invKw: 100, ratio: 1.2, batKw: 100, batHours: 2.15
    });
    PLANTS.push(p0);
    seedPlant(p0);
    savePlantCfg();
    simEvent(p0, '仿真电站上线：光伏 ' + p0.cfg.pvKwp + ' kWp / 储能 ' + p0.cfg.batKwh + ' kWh', '#30d158');
  }

  SIM = PLANTS[0] || null;
  simView = 'list';
  initCmdBus();
  if (location.hash === '#detail' && PLANTS.length) { SIM = PLANTS[0]; simView = 'detail'; syncDetailControls(); }
  else if (location.hash === '#create') simView = 'create';
  else if (location.hash === '#reset') {
    try { localStorage.removeItem(cfgKey()); localStorage.removeItem(SIM_KEY); } catch (e) {}
  }
  if (DEMO_MODE) showDemoTip();
  showView();

  for (let i = 0; i < 12; i++) pushAggHist();

  setInterval(() => {
    const wall = Date.now();
    const wallDt = (wall - lastTickWall) / 60000;
    lastTickWall = wall;
    if (SIMTIME.running) {
      if (SIMTIME.speed === 1) {
        if (SIMTIME.anchored) {
          /* 用户指定了运行开始时间：按真实节奏从该时刻往下走，不再硬对齐本机时钟 */
          simAdvance(wallDt > 0 && wallDt < 5 ? wallDt : 1.5 / 60);
        } else {
          /* 实时模式：直接跟本机时钟对齐，避免定时器误差让显示时间越走越偏 */
          const now = Math.round(Date.now() / 1000) * 1000;
          const step = (now - SIMTIME.utc) / 60000;
          if (step > 0 && step < 5) simAdvance(step);
          else SIMTIME.utc = now;       /* 标签页休眠/切回 → 直接跳正到当前时刻 */
        }
      } else {
        simAdvance(SIMTIME.speed * 1.5 / 60);
      }
    }
    pollCmd();          /* 接收 APP 小源下发的参数修改指令（如 SOC 区间） */
    simRender();
  }, 1500);
  simRender();

  /* 异步恢复上次上传的负载曲线，恢复成功后回挂到引用它的电站 */
  Promise.resolve(restoreLoadTable()).then(ok => {
    if (ok) {
      PLANTS.forEach(p => { if (p.loadFromFile && !p.loadTable) p.loadTable = LOAD_STORE.table; });
      updateLoadBadge();
      const st = document.getElementById('cf-loadstate');
      if (st && LOAD_STORE.meta) {
        st.textContent = '已加载 ' + LOAD_STORE.name + ' · ' + LOAD_STORE.meta.rows + '×' + LOAD_STORE.meta.cols +
          ' · 峰值 ' + LOAD_STORE.meta.peak.toFixed(1) + ' kW · 年用电 ' + Math.round(LOAD_STORE.meta.yearKwh).toLocaleString() + ' kWh';
      }
    }
  }).catch(() => {});
}

// Management session starts the engine after authentication and configuration restore.
