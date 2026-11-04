/*
 * 学习任务数据文件
 * ------------------------------------------------------------
 * 数据来源：目录/ 文件夹中五张目录图片（生理、病理、内科、外科、生化）
 * 说明：index.html 只负责 UI，本文件负责全部任务数据。
 *
 * 数据结构：
 *   TASKS_DATA.subjects[]         学科
 *     .chapters[]                 章（分组）
 *       .items[]                  可勾选任务
 *         kind = 'section'        小节
 *         kind = 'plus'           串讲（串·）
 *         kind = 'chapter'        无小节的章本身（章即任务）
 *         kind = 'sub'            小节下的细分知识点
 *
 * 新增/修改任务：直接编辑本文件即可，页面会自动读取；
 * 已勾选的完成状态保存在浏览器 localStorage 中，与任务 id 对应。
 */
window.TASKS_DATA = {
  version: 1,
  source: '目录图片 OCR + 人工校对',
  subjects: [
    /* ================= 生理 ================= */
    {
      id: 'physiology',
      name: '生理',
      chapters: [
        {
          id: 'phy-ch1', name: '第一章 绪论', page: 1,
          items: [
            { id: 'phy-ch1-1', name: '绪论', page: 1, kind: 'chapter' }
          ]
        },
        {
          id: 'phy-ch2', name: '第二章 细胞的基本功能', page: 12,
          items: [
            { id: 'phy-ch2-1', name: '跨膜转运', page: 12, kind: 'section' },
            { id: 'phy-ch2-2', name: '跨膜转运与临床', page: 22, kind: 'plus' },
            { id: 'phy-ch2-3', name: '细胞电活动', page: 24, kind: 'section' },
            { id: 'phy-ch2-4', name: '钾失衡对横纹肌的影响', page: 39, kind: 'plus' },
            { id: 'phy-ch2-5', name: '骨骼肌收缩', page: 41, kind: 'section' },
            { id: 'phy-ch2-6', name: '细胞信号转导', page: 55, kind: 'section' },
            { id: 'phy-ch2-7', name: '第二信使和蛋白激酶', page: 69, kind: 'plus' }
          ]
        },
        {
          id: 'phy-ch3', name: '第三章 血液', page: 75,
          items: [
            { id: 'phy-ch3-1', name: '血型', page: 75, kind: 'section' },
            { id: 'phy-ch3-2', name: '血液特性', page: 79, kind: 'section' },
            { id: 'phy-ch3-3', name: '生理性止血', page: 88, kind: 'section' }
          ]
        },
        {
          id: 'phy-ch4', name: '第四章 血液循环', page: 99,
          items: [
            { id: 'phy-ch4-1', name: '心脏泵血', page: 99, kind: 'section' },
            { id: 'phy-ch4-2', name: '心瓣膜病与心动周期', page: 109, kind: 'plus' },
            { id: 'phy-ch4-3', name: '血压', page: 110, kind: 'section' },
            { id: 'phy-ch4-4', name: '静脉回心血量的影响因素', page: 115, kind: 'plus' },
            { id: 'phy-ch4-5', name: '微循环和冠脉循环', page: 116, kind: 'section' },
            { id: 'phy-ch4-6', name: '血液循环相关考点的切入点', page: 120, kind: 'plus' },
            { id: 'phy-ch4-7', name: '心肌电活动和特性', page: 123, kind: 'section' },
            { id: 'phy-ch4-8', name: '儿茶酚胺、乙酰胆碱、E-4031 对心肌电生理的影响', page: 134, kind: 'plus' },
            { id: 'phy-ch4-9', name: '心血管调节', page: 136, kind: 'section' },
            { id: 'phy-ch4-10', name: '血管的神经支配', page: 145, kind: 'plus' }
          ]
        },
        {
          id: 'phy-ch5', name: '第五章 呼吸', page: 150,
          items: [
            { id: 'phy-ch5-1', name: '通气功能的评价', page: 150, kind: 'section' },
            { id: 'phy-ch5-2', name: '肺通气', page: 154, kind: 'section' },
            { id: 'phy-ch5-3', name: '本节小结和临床联系', page: 161, kind: 'plus' },
            { id: 'phy-ch5-4', name: '肺换气和气体运输', page: 165, kind: 'section' },
            { id: 'phy-ch5-5', name: 'CO 中毒', page: 173, kind: 'plus' },
            { id: 'phy-ch5-6', name: '呼吸调节', page: 177, kind: 'section' }
          ]
        },
        {
          id: 'phy-ch6', name: '第六章 消化', page: 183,
          items: [
            { id: 'phy-ch6-1', name: '消化概述', page: 183, kind: 'section' },
            { id: 'phy-ch6-2', name: '肌细胞的收缩', page: 185, kind: 'plus' },
            { id: 'phy-ch6-3', name: '口腔和食管的消化', page: 188, kind: 'section' },
            { id: 'phy-ch6-4', name: '胃内消化', page: 191, kind: 'section' },
            { id: 'phy-ch6-5', name: '肠内消化', page: 202, kind: 'section' },
            { id: 'phy-ch6-6', name: '消化小结', page: 208, kind: 'plus' },
            { id: 'phy-ch6-7', name: '肠内吸收', page: 211, kind: 'section' }
          ]
        },
        {
          id: 'phy-ch7', name: '第七章 能量代谢和体温', page: 215,
          items: [
            { id: 'phy-ch7-1', name: '能量代谢和体温', page: 215, kind: 'chapter' }
          ]
        },
        {
          id: 'phy-ch8', name: '第八章 泌尿', page: 225,
          items: [
            { id: 'phy-ch8-1', name: '泌尿概述', page: 225, kind: 'section' },
            { id: 'phy-ch8-2', name: '肾小球滤过', page: 233, kind: 'section' },
            { id: 'phy-ch8-3', name: '小管重吸收和分泌、尿浓缩稀释、调节', page: 240, kind: 'section' },
            { id: 'phy-ch8-4', name: '利尿剂', page: 258, kind: 'plus' }
          ]
        },
        {
          id: 'phy-ch9', name: '第九章 感觉器官的功能', page: 260,
          items: [
            { id: 'phy-ch9-1', name: '视觉', page: 260, kind: 'section' },
            { id: 'phy-ch9-2', name: '视觉传入通路', page: 271, kind: 'plus' },
            { id: 'phy-ch9-3', name: '听觉', page: 275, kind: 'section' },
            { id: 'phy-ch9-4', name: '其它感觉', page: 286, kind: 'section' }
          ]
        },
        {
          id: 'phy-ch10', name: '第十章 神经系统', page: 295,
          items: [
            { id: 'phy-ch10-1', name: '神经元及胶质细胞', page: 295, kind: 'section' },
            { id: 'phy-ch10-2', name: '脊髓病变', page: 300, kind: 'plus' },
            { id: 'phy-ch10-3', name: '突触传递、中枢抑制和易化', page: 302, kind: 'section' },
            { id: 'phy-ch10-4', name: '递质和受体', page: 312, kind: 'section' },
            { id: 'phy-ch10-5', name: '神经系统调控躯体运动', page: 318, kind: 'section' },
            { id: 'phy-ch10-6', name: '肌紧张/肌张力', page: 332, kind: 'plus' },
            { id: 'phy-ch10-7', name: '脑电波、睡眠、脑高级功能、下丘脑', page: 335, kind: 'section' },
            { id: 'phy-ch10-8', name: '下丘脑', page: 338, kind: 'plus' }
          ]
        },
        {
          id: 'phy-ch11', name: '第十一章 内分泌', page: 341,
          items: [
            { id: 'phy-ch11-1', name: '内分泌概述', page: 341, kind: 'section' },
            { id: 'phy-ch11-2', name: '钙调节激素', page: 346, kind: 'section' },
            { id: 'phy-ch11-3', name: '生长激素', page: 350, kind: 'section' },
            { id: 'phy-ch11-4', name: '胰岛素和胰高血糖素', page: 353, kind: 'section' },
            { id: 'phy-ch11-5', name: '甲状腺激素', page: 359, kind: 'section' },
            { id: 'phy-ch11-6', name: '糖皮质激素', page: 365, kind: 'section' }
          ]
        },
        {
          id: 'phy-ch12', name: '第十二章 生殖', page: 371,
          items: [
            { id: 'phy-ch12-1', name: '生殖', page: 371, kind: 'section' },
            { id: 'phy-ch12-2', name: '女性雌激素的来源', page: 377, kind: 'plus' }
          ]
        }
      ]
    },

    /* ================= 病理 ================= */
    {
      id: 'pathology',
      name: '病理',
      chapters: [
        {
          id: 'pat-ch1', name: '第一章 消化系统', page: 1,
          items: [
            { id: 'pat-ch1-1', name: '慢性胃炎、消化性溃疡、阑尾炎、胰腺疾病', page: 1, kind: 'section' },
            { id: 'pat-ch1-2', name: '病毒性肝炎', page: 6, kind: 'section' },
            { id: 'pat-ch1-3', name: '肝硬化', page: 13, kind: 'section' },
            { id: 'pat-ch1-4', name: '原发性肝癌', page: 20, kind: 'section' },
            { id: 'pat-ch1-5', name: '消化系统恶性肿瘤概述', page: 22, kind: 'plus' },
            { id: 'pat-ch1-6', name: '消化道肿瘤', page: 24, kind: 'section' }
          ]
        },
        {
          id: 'pat-ch2', name: '第二章 心血管', page: 32,
          items: [
            { id: 'pat-ch2-1', name: '感染性心内膜炎', page: 32, kind: 'section' },
            { id: 'pat-ch2-2', name: '风湿病', page: 33, kind: 'section' },
            { id: 'pat-ch2-3', name: '高血压', page: 37, kind: 'section' },
            { id: 'pat-ch2-4', name: '动脉粥样硬化', page: 40, kind: 'section' },
            { id: 'pat-ch2-5', name: '心肌疾病', page: 47, kind: 'section' }
          ]
        },
        {
          id: 'pat-ch3', name: '第三章 呼吸系统疾病', page: 52,
          items: [
            { id: 'pat-ch3-1', name: '慢支炎、肺气肿、肺心病', page: 52, kind: 'section' },
            { id: 'pat-ch3-2', name: '支扩', page: 66, kind: 'section' },
            { id: 'pat-ch3-3', name: '肺硅沉着病', page: 68, kind: 'section' },
            { id: 'pat-ch3-4', name: '肺炎', page: 70, kind: 'section' },
            { id: 'pat-ch3-5', name: '呼吸系统肿瘤', page: 75, kind: 'section' }
          ]
        },
        {
          id: 'pat-ch4', name: '第四章 内分泌系统疾病', page: 79,
          items: [
            { id: 'pat-ch4-1', name: '内分泌系统疾病', page: 79, kind: 'chapter' }
          ]
        },
        {
          id: 'pat-ch5', name: '第五章 免疫性疾病', page: 85,
          items: [
            { id: 'pat-ch5-1', name: '免疫性疾病', page: 85, kind: 'chapter' }
          ]
        },
        {
          id: 'pat-ch6', name: '第六章 生殖系统疾病', page: 93,
          items: [
            { id: 'pat-ch6-1', name: '生殖系统疾病', page: 93, kind: 'chapter' }
          ]
        },
        {
          id: 'pat-ch7', name: '第七章 乳腺疾病', page: 105,
          items: [
            { id: 'pat-ch7-1', name: '乳腺疾病', page: 105, kind: 'chapter' }
          ]
        },
        {
          id: 'pat-ch8', name: '第八章 传染', page: 108,
          items: [
            { id: 'pat-ch8-1', name: '结核', page: 108, kind: 'section' },
            { id: 'pat-ch8-2', name: '其它传染病', page: 116, kind: 'section' },
            { id: 'pat-ch8-3', name: '常考溃疡病', page: 121, kind: 'plus' }
          ]
        },
        {
          id: 'pat-ch9', name: '第九章', page: 123,
          items: [
            { id: 'pat-ch9-1', name: '损伤的修复', page: 123, kind: 'section' },
            { id: 'pat-ch9-2', name: '适应和损伤', page: 130, kind: 'section' },
            { id: 'pat-ch9-3', name: '适应', page: 130, kind: 'sub' },
            { id: 'pat-ch9-4', name: '可逆性损伤/变性', page: 134, kind: 'sub' },
            { id: 'pat-ch9-5', name: '坏死', page: 138, kind: 'sub' },
            { id: 'pat-ch9-6', name: '局部血液循环障碍', page: 149, kind: 'section' },
            { id: 'pat-ch9-7', name: '炎症', page: 159, kind: 'section' },
            { id: 'pat-ch9-8', name: '常考肉芽肿', page: 170, kind: 'plus' },
            { id: 'pat-ch9-9', name: '肿瘤', page: 172, kind: 'section' }
          ]
        }
      ]
    },

    /* ================= 内科 ================= */
    {
      id: 'internal',
      name: '内科',
      chapters: [
        {
          id: 'int-ch1', name: '第一章 呼吸', page: 1,
          items: [
            { id: 'int-ch1-1', name: 'COPD', page: 1, kind: 'section' },
            { id: 'int-ch1-2', name: '呼吸系统重要体征（上）', page: 10, kind: 'plus' },
            { id: 'int-ch1-3', name: '肺动脉高压', page: 12, kind: 'section' },
            { id: 'int-ch1-4', name: '急性肺血栓栓塞', page: 17, kind: 'section' },
            { id: 'int-ch1-5', name: '间质性肺疾病', page: 22, kind: 'section' },
            { id: 'int-ch1-6', name: '支气管扩张症', page: 27, kind: 'section' },
            { id: 'int-ch1-7', name: '支扩的鉴别诊断', page: 30, kind: 'plus' },
            { id: 'int-ch1-8', name: '急性肺脓肿', page: 31, kind: 'section' },
            { id: 'int-ch1-9', name: '肺炎', page: 33, kind: 'section' },
            { id: 'int-ch1-10', name: '呼吸系统疾病好发部位', page: 39, kind: 'plus' },
            { id: 'int-ch1-11', name: '肺结核', page: 40, kind: 'section' },
            { id: 'int-ch1-12', name: '热型', page: 44, kind: 'plus' },
            { id: 'int-ch1-13', name: '支气管哮喘', page: 47, kind: 'section' },
            { id: 'int-ch1-14', name: '支气管哮喘的鉴别诊断', page: 53, kind: 'plus' },
            { id: 'int-ch1-15', name: 'ARDS', page: 54, kind: 'section' },
            { id: 'int-ch1-16', name: '呼吸衰竭', page: 58, kind: 'section' },
            { id: 'int-ch1-17', name: '判断酸碱失衡', page: 60, kind: 'plus' },
            { id: 'int-ch1-18', name: '肺癌', page: 61, kind: 'section' },
            { id: 'int-ch1-19', name: '肺癌 TNM 分期', page: 64, kind: 'plus' },
            { id: 'int-ch1-20', name: '胸膜疾病', page: 67, kind: 'section' },
            { id: 'int-ch1-21', name: '呼吸系统疾病重要体征（下）', page: 76, kind: 'plus' }
          ]
        },
        {
          id: 'int-ch2', name: '第二章 消化', page: 78,
          items: [
            { id: 'int-ch2-1', name: '胃食管反流病', page: 78, kind: 'section' },
            { id: 'int-ch2-2', name: '胃炎', page: 83, kind: 'section' },
            { id: 'int-ch2-3', name: 'HP', page: 84, kind: 'plus' },
            { id: 'int-ch2-4', name: '消化性溃疡 & 消化道出血', page: 86, kind: 'section' },
            { id: 'int-ch2-5', name: '肠结核 + 结核性腹膜炎', page: 98, kind: 'section' },
            { id: 'int-ch2-6', name: '炎症性肠病', page: 101, kind: 'section' },
            { id: 'int-ch2-7', name: '肠结核 VS 克罗恩病 VS 溃疡性结肠炎', page: 104, kind: 'plus' },
            { id: 'int-ch2-8', name: '肠易激综合征', page: 108, kind: 'section' },
            { id: 'int-ch2-9', name: '需要内镜确诊（并可活检）的消化系统疾病', page: 110, kind: 'plus' },
            { id: 'int-ch2-10', name: '肝性脑病', page: 111, kind: 'section' },
            { id: 'int-ch2-11', name: '原发性肝细胞癌', page: 115, kind: 'section' },
            { id: 'int-ch2-12', name: '肝脏疾病影像学', page: 114, kind: 'plus' },
            { id: 'int-ch2-13', name: '肝硬化', page: 122, kind: 'section' },
            { id: 'int-ch2-14', name: '急性胰腺炎', page: 133, kind: 'section' }
          ]
        },
        {
          id: 'int-ch3', name: '第三章 泌尿', page: 143,
          items: [
            { id: 'int-ch3-1', name: '泌尿系统总论', page: 143, kind: 'section' },
            { id: 'int-ch3-2', name: '尿路感染', page: 145, kind: 'section' },
            { id: 'int-ch3-3', name: '肾衰竭', page: 151, kind: 'section' },
            { id: 'int-ch3-4', name: '透析', page: 154, kind: 'plus' },
            { id: 'int-ch3-5', name: '原发性肾小球疾病（含病理）', page: 157, kind: 'section' },
            { id: 'int-ch3-6', name: '原发性肾小球疾病的常考病例题', page: 167, kind: 'plus' }
          ]
        },
        {
          id: 'int-ch4', name: '第四章 血液', page: 180,
          items: [
            { id: 'int-ch4-1', name: '缺铁性贫血', page: 180, kind: 'section' },
            { id: 'int-ch4-2', name: '贫血概述', page: 182, kind: 'plus' },
            { id: 'int-ch4-3', name: '再生障碍性贫血', page: 187, kind: 'section' },
            { id: 'int-ch4-4', name: '溶血性贫血', page: 190, kind: 'section' },
            { id: 'int-ch4-5', name: '出血性疾病（原发免疫性血小板减少症 & 出血性疾病概述）', page: 197, kind: 'section' },
            { id: 'int-ch4-6', name: '骨髓瘤 MM', page: 203, kind: 'section' },
            { id: 'int-ch4-7', name: '骨髓增生异常性肿瘤/综合征 MDS', page: 206, kind: 'section' },
            { id: 'int-ch4-8', name: 'MDS 鉴别诊断', page: 208, kind: 'plus' },
            { id: 'int-ch4-9', name: '白血病', page: 209, kind: 'section' },
            { id: 'int-ch4-10', name: '血液系统疾病鉴别诊断', page: 217, kind: 'plus' },
            { id: 'int-ch4-11', name: '淋巴瘤（含病理）', page: 219, kind: 'section' },
            { id: 'int-ch4-12', name: '特征染色体和免疫表型小结', page: 224, kind: 'plus' }
          ]
        },
        {
          id: 'int-ch5', name: '第五章 内分泌', page: 230,
          items: [
            { id: 'int-ch5-1', name: 'Graves 病', page: 230, kind: 'section' },
            { id: 'int-ch5-2', name: '特殊类型甲亢', page: 234, kind: 'plus' },
            { id: 'int-ch5-3', name: '甲状腺功能减退症', page: 239, kind: 'section' },
            { id: 'int-ch5-4', name: '原发性醛固酮增多症', page: 242, kind: 'section' },
            { id: 'int-ch5-5', name: '嗜铬细胞瘤', page: 244, kind: 'section' },
            { id: 'int-ch5-6', name: '库欣综合征', page: 247, kind: 'section' },
            { id: 'int-ch5-7', name: '内分泌系统总论', page: 251, kind: 'section' },
            { id: 'int-ch5-8', name: '糖尿病', page: 253, kind: 'section' },
            { id: 'int-ch5-9', name: '糖尿病治疗药物小结', page: 262, kind: 'plus' }
          ]
        },
        {
          id: 'int-ch6', name: '第六章 风湿', page: 269,
          items: [
            { id: 'int-ch6-1', name: '风湿系统总论', page: 269, kind: 'section' },
            { id: 'int-ch6-2', name: '系统性红斑狼疮', page: 272, kind: 'section' },
            { id: 'int-ch6-3', name: '类风湿关节炎', page: 276, kind: 'section' },
            { id: 'int-ch6-4', name: '原发性干燥综合征', page: 280, kind: 'section' },
            { id: 'int-ch6-5', name: '系统性血管炎', page: 282, kind: 'section' }
          ]
        },
        {
          id: 'int-ch7', name: '第七章 中毒', page: 286,
          items: [
            { id: 'int-ch7-1', name: '中毒', page: 286, kind: 'chapter' }
          ]
        },
        {
          id: 'int-ch8', name: '第八章 循环', page: 293,
          items: [
            { id: 'int-ch8-1', name: '心肌疾病', page: 293, kind: 'section' },
            { id: 'int-ch8-2', name: '心包疾病', page: 298, kind: 'section' },
            { id: 'int-ch8-3', name: '感染性心内膜炎', page: 304, kind: 'section' },
            { id: 'int-ch8-4', name: '高血压', page: 308, kind: 'section' },
            { id: 'int-ch8-5', name: '循环系统重要表现', page: 315, kind: 'plus' },
            { id: 'int-ch8-6', name: '心瓣膜病', page: 319, kind: 'section' },
            { id: 'int-ch8-7', name: '冠心病', page: 329, kind: 'section' },
            { id: 'int-ch8-8', name: '收缩性心衰', page: 352, kind: 'section' },
            { id: 'int-ch8-9', name: '心衰的治疗', page: 356, kind: 'plus' },
            { id: 'int-ch8-10', name: '心律失常', page: 363, kind: 'section' },
            { id: 'int-ch8-11', name: '心律失常的治疗原则与常考心电图', page: 386, kind: 'plus' },
            { id: 'int-ch8-12', name: '心脏骤停', page: 394, kind: 'section' }
          ]
        }
      ]
    },

    /* ================= 外科 ================= */
    {
      id: 'surgery',
      name: '外科',
      chapters: [
        {
          id: 'sur-ch1', name: '一、颈部和胸部疾病', page: 1,
          items: [
            { id: 'sur-ch1-1', name: '颈部疾病', page: 1, kind: 'section' },
            { id: 'sur-ch1-2', name: '甲状腺相关疾病和用药', page: 6, kind: 'plus' },
            { id: 'sur-ch1-3', name: '食管疾病', page: 12, kind: 'section' },
            { id: 'sur-ch1-4', name: '乳腺癌', page: 15, kind: 'section' },
            { id: 'sur-ch1-5', name: '乳房疾病鉴别', page: 18, kind: 'plus' },
            { id: 'sur-ch1-6', name: '其它颈胸部疾病', page: 22, kind: 'section' }
          ]
        },
        {
          id: 'sur-ch2', name: '二、腹部和肠道疾病', page: 25,
          items: [
            { id: 'sur-ch2-1', name: '胃肿瘤', page: 25, kind: 'section' },
            { id: 'sur-ch2-2', name: '胃癌的 TNM 分期', page: 28, kind: 'plus' },
            { id: 'sur-ch2-3', name: '腹腔感染', page: 29, kind: 'section' },
            { id: 'sur-ch2-4', name: '腹部损伤', page: 31, kind: 'section' },
            { id: 'sur-ch2-5', name: '肠梗阻', page: 37, kind: 'section' },
            { id: 'sur-ch2-6', name: '急性阑尾炎', page: 43, kind: 'section' },
            { id: 'sur-ch2-7', name: '大肠癌', page: 48, kind: 'section' },
            { id: 'sur-ch2-8', name: '其它大肠与肛管疾病', page: 53, kind: 'section' },
            { id: 'sur-ch2-9', name: '直肠指检', page: 56, kind: 'plus' },
            { id: 'sur-ch2-10', name: '腹外疝', page: 58, kind: 'section' }
          ]
        },
        {
          id: 'sur-ch3', name: '三、肝胆胰脾疾病', page: 65,
          items: [
            { id: 'sur-ch3-1', name: '细菌性肝脓肿', page: 65, kind: 'section' },
            { id: 'sur-ch3-2', name: '肝解剖', page: 66, kind: 'plus' },
            { id: 'sur-ch3-3', name: '门脉高压症', page: 68, kind: 'section' },
            { id: 'sur-ch3-4', name: '胰腺肿瘤', page: 74, kind: 'section' },
            { id: 'sur-ch3-5', name: '胆系疾病', page: 78, kind: 'section' },
            { id: 'sur-ch3-6', name: '黄疸有没有 & 胆囊大不大', page: 88, kind: 'plus' }
          ]
        },
        {
          id: 'sur-ch4', name: '四、血管和泌外疾病', page: 100,
          items: [
            { id: 'sur-ch4-1', name: '周围血管疾病', page: 100, kind: 'section' },
            { id: 'sur-ch4-2', name: '泌外感染和肿瘤', page: 104, kind: 'section' },
            { id: 'sur-ch4-3', name: '尿三杯', page: 106, kind: 'plus' },
            { id: 'sur-ch4-4', name: '泌外梗阻和外伤', page: 108, kind: 'section' },
            { id: 'sur-ch4-5', name: '尿失禁', page: 112, kind: 'plus' }
          ]
        },
        {
          id: 'sur-ch5', name: '五、骨科', page: 115,
          items: [
            { id: 'sur-ch5-1', name: '运动系统畸形', page: 115, kind: 'section' },
            { id: 'sur-ch5-2', name: '运动系统慢性损伤', page: 119, kind: 'section' },
            { id: 'sur-ch5-3', name: '手外伤、股骨头坏死、膝关节损伤、神经损伤', page: 123, kind: 'section' },
            { id: 'sur-ch5-4', name: '骨与关节感染', page: 131, kind: 'section' },
            { id: 'sur-ch5-5', name: '非化脓性关节炎', page: 139, kind: 'section' },
            { id: 'sur-ch5-6', name: '非化脓性关节炎鉴别诊断', page: 140, kind: 'plus' },
            { id: 'sur-ch5-7', name: '骨肿瘤', page: 143, kind: 'section' },
            { id: 'sur-ch5-8', name: '骨肿瘤概述', page: 143, kind: 'plus' },
            { id: 'sur-ch5-9', name: '躯干骨骨折 & 脊髓损伤', page: 151, kind: 'section' },
            { id: 'sur-ch5-10', name: '颈腰椎退行性疾病', page: 158, kind: 'section' },
            { id: 'sur-ch5-11', name: '脊髓神经损伤平面判断', page: 165, kind: 'plus' },
            { id: 'sur-ch5-12', name: '四肢骨折和脱位', page: 168, kind: 'section' },
            { id: 'sur-ch5-13', name: '骨折概论', page: 183, kind: 'section' }
          ]
        },
        {
          id: 'sur-ch6', name: '六、外科总论', page: 189,
          items: [
            { id: 'sur-ch6-1', name: '输血', page: 189, kind: 'section' },
            { id: 'sur-ch6-2', name: '体液失衡', page: 191, kind: 'section' },
            { id: 'sur-ch6-3', name: '营养代谢', page: 196, kind: 'section' },
            { id: 'sur-ch6-4', name: '烧伤', page: 200, kind: 'section' },
            { id: 'sur-ch6-5', name: '感染', page: 204, kind: 'section' },
            { id: 'sur-ch6-6', name: '围术期', page: 211, kind: 'section' },
            { id: 'sur-ch6-7', name: '常考切口小结', page: 214, kind: 'plus' },
            { id: 'sur-ch6-8', name: '麻醉', page: 216, kind: 'section' },
            { id: 'sur-ch6-9', name: '休克', page: 223, kind: 'section' },
            { id: 'sur-ch6-10', name: '常考疾病休克小结', page: 226, kind: 'plus' },
            { id: 'sur-ch6-11', name: '其他外科总论', page: 228, kind: 'section' }
          ]
        }
      ]
    },

    /* ================= 生化 ================= */
    {
      id: 'biochem',
      name: '生化',
      chapters: [
        {
          id: 'bio-ch1', name: '第一部分：物质代谢', page: 1,
          items: [
            { id: 'bio-ch1-1', name: '糖无氧氧化 & 糖有氧氧化', page: 1, kind: 'section' },
            { id: 'bio-ch1-2', name: '红细胞代谢 & 高能化合物', page: 7, kind: 'plus' },
            { id: 'bio-ch1-3', name: '磷酸戊糖途径、糖原、糖异生', page: 11, kind: 'section' },
            { id: 'bio-ch1-4', name: '糖代谢小结', page: 13, kind: 'plus' },
            { id: 'bio-ch1-5', name: '氧化磷酸化', page: 17, kind: 'section' },
            { id: 'bio-ch1-6', name: '葡萄糖有氧氧化的能量计算', page: 22, kind: 'plus' },
            { id: 'bio-ch1-7', name: '血浆脂蛋白', page: 25, kind: 'section' },
            { id: 'bio-ch1-8', name: '磷脂代谢、胆固醇代谢和胆汁酸', page: 29, kind: 'section' },
            { id: 'bio-ch1-9', name: '脂肪代谢', page: 34, kind: 'section' },
            { id: 'bio-ch1-10', name: '脂代谢小结', page: 41, kind: 'plus' },
            { id: 'bio-ch1-11', name: '氨基酸代谢', page: 43, kind: 'section' },
            { id: 'bio-ch1-12', name: '氨基酸（见思维导图）', page: 48, kind: 'plus' },
            { id: 'bio-ch1-13', name: '蛋白质', page: 55, kind: 'section' },
            { id: 'bio-ch1-14', name: '核苷酸代谢', page: 60, kind: 'section' },
            { id: 'bio-ch1-15', name: '核苷酸抗代谢物', page: 65, kind: 'plus' },
            { id: 'bio-ch1-16', name: '胆色素代谢', page: 69, kind: 'section' },
            { id: 'bio-ch1-17', name: '生物转化', page: 73, kind: 'section' },
            { id: 'bio-ch1-18', name: '酶', page: 74, kind: 'section' },
            { id: 'bio-ch1-19', name: '酶在医学上的作用', page: 82, kind: 'plus' },
            { id: 'bio-ch1-20', name: '维生素', page: 83, kind: 'section' }
          ]
        },
        {
          id: 'bio-ch2', name: '第二部分：基因', page: 85,
          items: [
            { id: 'bio-ch2-1', name: '原癌基因 & 抑癌基因、基因重组、分子生物学技术', page: 85, kind: 'section' },
            { id: 'bio-ch2-2', name: '核酸', page: 93, kind: 'section' },
            { id: 'bio-ch2-3', name: 'DNA 的合成', page: 103, kind: 'section' },
            { id: 'bio-ch2-4', name: 'DNA 复制 VS 转录', page: 116, kind: 'plus' },
            { id: 'bio-ch2-5', name: '转录', page: 116, kind: 'section' },
            { id: 'bio-ch2-6', name: '翻译', page: 127, kind: 'section' },
            { id: 'bio-ch2-7', name: '基因表达的调控', page: 138, kind: 'section' },
            { id: 'bio-ch2-8', name: '真核基因', page: 152, kind: 'section' },
            { id: 'bio-ch2-9', name: 'DNA 损伤', page: 154, kind: 'section' }
          ]
        }
      ]
    }
  ]
};
