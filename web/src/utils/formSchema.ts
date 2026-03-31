import type { FormContent, FormType } from "../types";
import { juniorMajorCategories, provinces, undergradMajorCategories } from "./mapping";

export type EditorKind =
  | { type: "input"; placeholder?: string }
  | { type: "textarea"; placeholder?: string; rows?: number }
  | { type: "number"; placeholder?: string }
  | { type: "date"; placeholder?: string }
  | { type: "radio"; options: { label: string; value: any }[] }
  | { type: "select"; options: { label: string; value: any }[]; mode?: "multiple" }
  | { type: "checkbox"; label: string }
  | { type: "checkboxGroup"; options: string[] | ((content: any) => string[]) }
  | {
      type: "subjectSelection";
      fixed: string[];
      optional: string[];
      maxOptional: number;
    };

export type Condition = {
  name: (string | number)[];
  equals?: any;
  in?: any[];
  includes?: any;
};

export type FieldDef = {
  name: (string | number)[];
  label: string;
  span?: 2;
  required?: boolean;
  requiredWhen?: Condition;
  editor: EditorKind;
  visibleWhen?: Condition;
};

export type SectionDef = {
  key: string;
  title: string;
  description?: string;
  step: number;
  fields: FieldDef[];
};

export function getMajorCategories(type: FormType) {
  return type === "undergrad" ? undergradMajorCategories : juniorMajorCategories;
}

function optionStrings(values: string[]) {
  return values.map((v) => ({ label: v, value: v }));
}

export const ORAL_EXAM_STATUS_VALUES = ["合格", "不合格", "未参加"] as const;
export const TUITION_RANGE_VALUES = [
  "无要求",
  "1万以内",
  "1-2万",
  "2-3万",
  "3-5万",
  "5-10万",
  "10万以上"
] as const;
export const HOUSEHOLD_TYPE_VALUES = ["城市户口", "农村户口", "高校专项", "农村地方专项"] as const;
export const UPGRADE_INTENT_VALUES = ["升本", "不升本"] as const;

const tuitionOptions = optionStrings([...TUITION_RANGE_VALUES]);
const householdOptions = optionStrings([...HOUSEHOLD_TYPE_VALUES]);

export function getFormSchema(type: FormType): SectionDef[] {
  const base: SectionDef[] = [
    {
      key: "basic",
      title: "基本信息",
      step: 0,
      fields: [
        { name: ["parentPhone"], label: "家长电话", editor: { type: "input", placeholder: "请输入" } },
        { name: ["name"], label: "姓名", required: true, editor: { type: "input", placeholder: "请输入" } },
        {
          name: ["gender"],
          label: "性别",
          editor: { type: "radio", options: [{ label: "男", value: "男" }, { label: "女", value: "女" }] }
        },
        { name: ["ethnicity"], label: "民族", editor: { type: "input", placeholder: "请输入" } },
        { name: ["birthDate"], label: "出生日期", editor: { type: "date", placeholder: "请选择" } },
        { name: ["height"], label: "身高", editor: { type: "input", placeholder: "例如：170cm" } },
        { name: ["weight"], label: "体重", editor: { type: "input", placeholder: "例如：60kg" } },
        {
          name: ["graduateStatus"],
          label: "届别",
          required: true,
          editor: { type: "radio", options: [{ label: "应届", value: "应届" }, { label: "往届", value: "往届" }] }
        },
        { name: ["candidatePhone"], label: "考生电话", required: true, editor: { type: "input", placeholder: "请输入" } },
        { name: ["homeAddress"], label: "家庭住址", span: 2, editor: { type: "input", placeholder: "请输入" } },
        { name: ["idNumber"], label: "身份证号", required: true, span: 2, editor: { type: "input", placeholder: "请输入" } },
        { name: ["examNumber"], label: "考生号", required: true, editor: { type: "input", placeholder: "请输入" } },
        { name: ["referrer"], label: "推荐人", editor: { type: "input", placeholder: "请输入，若无推荐人请填无" } }
      ]
    },
    {
      key: "school",
      title: "学业与学校信息",
      step: 0,
      fields: [
        {
          name: ["candidateCategory"],
          label: "考试类别",
          required: true,
          editor: {
            type: "radio",
            options: [
              { label: "普通", value: "普通" },
              { label: "艺术", value: "艺术" },
              { label: "体育", value: "体育" }
            ]
          }
        },
        {
          name: ["professionalScore"],
          label: "专业成绩",
          editor: { type: "input", placeholder: "请输入" },
          visibleWhen: { name: ["candidateCategory"], in: ["艺术", "体育"] },
          requiredWhen: { name: ["candidateCategory"], in: ["艺术", "体育"] }
        },
        {
          name: ["advantageSubjects"],
          label: "优势学科",
          required: true,
          editor: {
            type: "checkboxGroup",
            options: (content) => {
              const base = ["数学", "语文", "英语", "物理", "化学", "生物", "政治", "历史", "地理"];
              const exam = (content as any)?.candidateCategory;
              if (exam === "艺术") return [...base, "艺术"];
              if (exam === "体育") return [...base, "体育"];
              return base;
            }
          }
        },
        { name: ["graduateSchool"], label: "毕业学校", required: true, editor: { type: "input", placeholder: "请输入" } },
        { name: ["className"], label: "班级", editor: { type: "input", placeholder: "请输入" } },
        { name: ["classTeacher"], label: "班主任", editor: { type: "input", placeholder: "请输入" } },
        {
          name: ["physicalExamConclusion"],
          label: "体检结论",
          editor: { type: "input", placeholder: "请输入" },
          requiredWhen: { name: ["physicalExamNormal"], equals: false }
        },
        {
          name: ["physicalExamNormal"],
          label: "体检是否正常",
          required: true,
          editor: { type: "radio", options: [{ label: "正常", value: true }, { label: "不正常", value: false }] }
        }
      ]
    },
    {
      key: "body",
      title: "身体情况",
      description: "可按实际情况勾选并补充说明",
      step: 1,
      fields: [
        { name: ["body", "myopia", "has"], label: "近视", editor: { type: "checkbox", label: "有近视" } },
        {
          name: ["body", "myopia", "leftDegree"],
          label: "左眼度数",
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["body", "myopia", "has"], equals: true },
          requiredWhen: { name: ["body", "myopia", "has"], equals: true }
        },
        {
          name: ["body", "myopia", "rightDegree"],
          label: "右眼度数",
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["body", "myopia", "has"], equals: true },
          requiredWhen: { name: ["body", "myopia", "has"], equals: true }
        },
        { name: ["body", "leftHanded"], label: "左利手", editor: { type: "checkbox", label: "左利手" } },
        { name: ["body", "colorBlind"], label: "色盲", editor: { type: "checkbox", label: "色盲" } },
        { name: ["body", "colorWeak"], label: "色弱", editor: { type: "checkbox", label: "色弱" } },
        { name: ["body", "colorRecognitionIssue"], label: "色觉识别不全", editor: { type: "checkbox", label: "色觉识别不全" } },
        { name: ["body", "hepatitisB"], label: "乙肝", editor: { type: "checkbox", label: "乙肝" } },
        { name: ["body", "physicalDisability"], label: "肢体残疾", editor: { type: "checkbox", label: "肢体残疾" } },
        {
          name: ["body", "medicalHistoryNote"],
          label: "病史/其他身体情况备注",
          span: 2,
          editor: { type: "textarea", rows: 3, placeholder: "请输入" }
        }
      ]
    },
    {
      key: "scores",
      title: "高考成绩",
      step: 3,
      fields: [
        { name: ["scores", "totalScore"], label: "总分", required: true, editor: { type: "number", placeholder: "请输入" } },
        { name: ["scores", "rank"], label: "位次", required: true, editor: { type: "number", placeholder: "请输入" } },
        {
          name: ["scores", "subjectsSelected"],
          label: "选科情况",
          required: true,
          editor: {
            type: "subjectSelection",
            fixed: ["数学", "语文", "英语"],
            optional: ["物理", "化学", "生物", "政治", "历史", "地理"],
            maxOptional: 3
          }
        },
        {
          name: ["scores", "chineseScore"],
          label: "语文",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "语文" }
        },
        {
          name: ["scores", "mathScore"],
          label: "数学",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "数学" }
        },
        {
          name: ["scores", "englishScore"],
          label: "英语",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "英语" }
        },
        {
          name: ["scores", "physicsScore"],
          label: "物理",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "物理" }
        },
        {
          name: ["scores", "chemistryScore"],
          label: "化学",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "化学" }
        },
        {
          name: ["scores", "biologyScore"],
          label: "生物",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "生物" }
        },
        {
          name: ["scores", "politicsScore"],
          label: "政治",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "政治" }
        },
        {
          name: ["scores", "historyScore"],
          label: "历史",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "历史" }
        },
        {
          name: ["scores", "geographyScore"],
          label: "地理",
          required: true,
          editor: { type: "number", placeholder: "请输入" },
          visibleWhen: { name: ["scores", "subjectsSelected"], includes: "地理" }
        }
      ]
    },
    {
      key: "family",
      title: "家庭与资源",
      step: 2,
      fields: [
        { name: ["fatherOccupation"], label: "父亲职业", editor: { type: "input", placeholder: "请输入" } },
        { name: ["motherOccupation"], label: "母亲职业", editor: { type: "input", placeholder: "请输入" } },
        {
          name: ["socialResources"],
          label: "社会资源（方便推荐学校和专业）",
          span: 2,
          editor: { type: "textarea", rows: 3, placeholder: "请输入" }
        }
      ]
    }
  ];

  const undergradSpecial: SectionDef = {
    key: "undergradSpecial",
    title: "本科专属志愿条件",
    step: 4,
    fields: [
      {
        name: ["advanceBatchOptions"],
        label: "提前批意向",
        editor: {
          type: "checkboxGroup",
          options: [
            "军队院校",
            "公安政法类",
            "免费师范生",
            "免费医学生",
            "免费农学生",
            "小语种",
            "飞行航海类",
            "综合评价",
            "港澳院校",
            "直招士官",
            "其他"
          ]
        }
      },
      {
        name: ["advanceBatchOtherNote"],
        label: "提前批其他备注",
        editor: { type: "input", placeholder: "如选择其他请填写" },
        visibleWhen: { name: ["advanceBatchOptions"], equals: "__hasOther" },
        requiredWhen: { name: ["advanceBatchOptions"], equals: "__hasOther" }
      },
      {
        name: ["specialBatchOptions"],
        label: "特殊类型批",
        editor: {
          type: "checkboxGroup",
          options: [
            "高校专项",
            "国家专项",
            "地方专项",
            "强基计划",
            "综合评价",
            "高水平运动队",
            "小语种",
            "涉农专业",
            "其他"
          ]
        }
      },
      {
        name: ["specialBatchOtherNote"],
        label: "特殊类型其他备注",
        editor: { type: "input", placeholder: "如选择其他请填写" },
        visibleWhen: { name: ["specialBatchOptions"], equals: "__hasOther" },
        requiredWhen: { name: ["specialBatchOptions"], equals: "__hasOther" }
      },
      {
        name: ["targetMajorNotes"],
        label: "意向专业类 / 目标专业选择说明",
        span: 2,
        editor: { type: "textarea", rows: 3, placeholder: "请输入" }
      },
      {
        name: ["intendedProvinces"],
        label: "意向省份（多选）",
        required: true,
        editor: { type: "select", mode: "multiple", options: optionStrings([...provinces]) }
      },
      {
        name: ["schoolLevelTags"],
        label: "院校层级（多选）",
        editor: { type: "checkboxGroup", options: ["985", "211", "双一流", "双一流学科"] }
      },
      {
        name: ["schoolNatureTags"],
        label: "院校属性（多选）",
        editor: { type: "checkboxGroup", options: ["公办", "民办", "与港澳台合作办学", "中外合作办学"] }
      },
      {
        name: ["oralExamStatus"],
        label: "口语考试",
        editor: { type: "select", options: optionStrings([...ORAL_EXAM_STATUS_VALUES]) }
      },
      { name: ["tuitionRange"], label: "学费区间", editor: { type: "select", options: tuitionOptions } },
      { name: ["householdType"], label: "户籍类型", editor: { type: "select", options: householdOptions } },
      {
        name: ["publicFundIntent"],
        label: "公费生意向",
        editor: { type: "select", options: optionStrings(["有意向", "无意向"]) }
      },
      {
        name: ["postgraduateIntent"],
        label: "读研意向",
        editor: { type: "select", options: optionStrings(["有意向", "无意向"]) }
      },
      {
        name: ["employmentIntent"],
        label: "就业意向",
        editor: { type: "select", options: optionStrings(["有意向", "无意向"]) }
      },
      { name: ["extraPreferenceNotes"], label: "其他选项备注", span: 2, editor: { type: "input", placeholder: "请输入" } }
    ]
  };

  const juniorSpecial: SectionDef = {
    key: "juniorSpecial",
    title: "专科专属志愿条件",
    step: 4,
    fields: [
      { name: ["juniorPlanIntent"], label: "升学规划意向", editor: { type: "input", placeholder: "请输入" } },
      { name: ["bachelorProvincePreference"], label: "本科目标省份偏好", editor: { type: "input", placeholder: "请输入" } },
      { name: ["bachelorLevelPreference"], label: "本科层次偏好", editor: { type: "input", placeholder: "请输入" } },
      { name: ["majorTypePreference"], label: "专业类型偏好", editor: { type: "input", placeholder: "请输入" } },
      { name: ["costPreferenceRank"], label: "费用偏好排序/说明", editor: { type: "input", placeholder: "请输入" } },
      { name: ["examSubjectPreference"], label: "考试科目偏好", editor: { type: "input", placeholder: "请输入" } },
      { name: ["overseasOrInternationalPlan"], label: "出国留学/国际本科意向", editor: { type: "input", placeholder: "请输入" } },
      {
        name: ["intendedProvinces"],
        label: "意向省份（多选）",
        required: true,
        editor: { type: "select", mode: "multiple", options: optionStrings([...provinces]) }
      },
      {
        name: ["schoolNatureTags"],
        label: "院校属性（多选）",
        editor: { type: "checkboxGroup", options: ["公办", "民办", "与港澳台合作办学", "中外合作办学"] }
      },
      {
        name: ["oralExamStatus"],
        label: "口语考试",
        editor: { type: "select", options: optionStrings([...ORAL_EXAM_STATUS_VALUES]) }
      },
      {
        name: ["upgradeIntent"],
        label: "专升本意向",
        editor: { type: "select", options: optionStrings([...UPGRADE_INTENT_VALUES]) }
      },
      { name: ["tuitionRange"], label: "学费区间", editor: { type: "select", options: tuitionOptions } },
      { name: ["householdType"], label: "户籍类型", editor: { type: "select", options: householdOptions } },
      {
        name: ["publicFundMajorIntent"],
        label: "公费型专业意向",
        editor: { type: "select", options: optionStrings(["有意向", "无意向"]) }
      },
      { name: ["extraPreferenceNotes"], label: "其他备注", span: 2, editor: { type: "input", placeholder: "请输入" } }
    ]
  };

  const step5: SectionDef[] = [
    {
      key: "step2Text",
      title: "梦想院校/备注",
      step: 5,
      fields: [
        { name: ["dreamUniversityOrCity"], label: "梦中大学或城市", span: 2, editor: { type: "textarea", rows: 4, placeholder: "请输入" } },
        { name: ["finalRemarks"], label: "备注", span: 2, editor: { type: "textarea", rows: 4, placeholder: "请输入" } }
      ]
    }
  ];

  return [...base, type === "undergrad" ? undergradSpecial : juniorSpecial, ...step5];
}

export function getValueAtPath(content: FormContent | undefined, path: (string | number)[]): unknown {
  let cur: any = content ?? {};
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key as any];
  }
  return cur;
}

export function normalizeVisible(visibleWhen: FieldDef["visibleWhen"], content: any): boolean {
  if (!visibleWhen) return true;
  const value = getValueAtPath(content, visibleWhen.name);
  if (visibleWhen.equals === "__hasOther") return Array.isArray(value) && value.includes("其他");
  if (Array.isArray(visibleWhen.in)) return visibleWhen.in.includes(value);
  if (visibleWhen.includes !== undefined) return Array.isArray(value) && value.includes(visibleWhen.includes);
  if ("equals" in visibleWhen) return value === visibleWhen.equals;
  return Boolean(value);
}

export function normalizeRequired(requiredWhen: FieldDef["requiredWhen"], content: any): boolean {
  if (!requiredWhen) return false;
  const value = getValueAtPath(content, requiredWhen.name);
  if (requiredWhen.equals === "__hasOther") return Array.isArray(value) && value.includes("其他");
  if (Array.isArray(requiredWhen.in)) return requiredWhen.in.includes(value);
  if (requiredWhen.includes !== undefined) return Array.isArray(value) && value.includes(requiredWhen.includes);
  if ("equals" in requiredWhen) return value === requiredWhen.equals;
  return Boolean(value);
}
