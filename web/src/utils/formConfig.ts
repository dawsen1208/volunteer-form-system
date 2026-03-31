import type {
  JuniorFormContent,
  MajorPreferenceItem,
  UndergradFormContent
} from "../types";

function createDefaultMajorPreferences(): MajorPreferenceItem[] {
  return Array.from({ length: 10 }).map((_, i) => ({
    index: i + 1,
    majorCategory: "",
    majorName: ""
  }));
}

export function createDefaultUndergradContent(): UndergradFormContent {
  return {
    fillTime: new Date().toISOString(),
    parentPhone: "",
    name: "",
    gender: "",
    ethnicity: "",
    birthDate: "",
    height: "",
    weight: "",
    graduateStatus: "",
    candidatePhone: "",
    homeAddress: "",
    idNumber: "",
    examNumber: "",
    referrer: "",
    candidateCategory: "",
    professionalScore: "",
    advantageSubjects: [],
    graduateSchool: "",
    className: "",
    classTeacher: "",
    physicalExamConclusion: "",
    physicalExamNormal: undefined,
    body: {
      myopia: { has: false, leftDegree: undefined, rightDegree: undefined },
      leftHanded: false,
      colorBlind: false,
      colorWeak: false,
      colorRecognitionIssue: false,
      hepatitisB: false,
      physicalDisability: false,
      medicalHistoryNote: ""
    },
    scores: {
      totalScore: undefined,
      rank: undefined,
      subjectsSelected: ["数学", "语文", "英语"],
      chineseScore: undefined,
      mathScore: undefined,
      englishScore: undefined,
      physicsScore: undefined,
      chemistryScore: undefined,
      biologyScore: undefined,
      politicsScore: undefined,
      historyScore: undefined,
      geographyScore: undefined
    },
    fatherOccupation: "",
    motherOccupation: "",
    socialResources: "",
    advanceBatchOptions: [],
    advanceBatchOtherNote: "",
    specialBatchOptions: [],
    specialBatchOtherNote: "",
    targetMajorNotes: "",
    intendedProvinces: [],
    schoolLevelTags: [],
    schoolNatureTags: [],
    oralExamStatus: undefined,
    tuitionRange: undefined,
    householdType: undefined,
    publicFundIntent: undefined,
    postgraduateIntent: undefined,
    employmentIntent: undefined,
    extraPreferenceNotes: "",
    majorPreferences: createDefaultMajorPreferences(),
    dreamUniversityOrCity: "",
    finalRemarks: ""
  };
}

export function createDefaultJuniorContent(): JuniorFormContent {
  return {
    fillTime: new Date().toISOString(),
    parentPhone: "",
    name: "",
    gender: "",
    ethnicity: "",
    birthDate: "",
    height: "",
    weight: "",
    graduateStatus: "",
    candidatePhone: "",
    homeAddress: "",
    idNumber: "",
    examNumber: "",
    referrer: "",
    candidateCategory: "",
    professionalScore: "",
    advantageSubjects: [],
    graduateSchool: "",
    className: "",
    classTeacher: "",
    physicalExamConclusion: "",
    physicalExamNormal: undefined,
    body: {
      myopia: { has: false, leftDegree: undefined, rightDegree: undefined },
      leftHanded: false,
      colorBlind: false,
      colorWeak: false,
      colorRecognitionIssue: false,
      hepatitisB: false,
      physicalDisability: false,
      medicalHistoryNote: ""
    },
    scores: {
      totalScore: undefined,
      rank: undefined,
      subjectsSelected: ["数学", "语文", "英语"],
      chineseScore: undefined,
      mathScore: undefined,
      englishScore: undefined,
      physicsScore: undefined,
      chemistryScore: undefined,
      biologyScore: undefined,
      politicsScore: undefined,
      historyScore: undefined,
      geographyScore: undefined
    },
    fatherOccupation: "",
    motherOccupation: "",
    socialResources: "",
    juniorPlanIntent: "",
    bachelorProvincePreference: "",
    bachelorLevelPreference: "",
    majorTypePreference: "",
    costPreferenceRank: "",
    examSubjectPreference: "",
    overseasOrInternationalPlan: "",
    intendedProvinces: [],
    schoolNatureTags: [],
    oralExamStatus: undefined,
    upgradeIntent: undefined,
    tuitionRange: undefined,
    householdType: undefined,
    publicFundMajorIntent: undefined,
    extraPreferenceNotes: "",
    majorPreferences: createDefaultMajorPreferences(),
    dreamUniversityOrCity: "",
    finalRemarks: ""
  };
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeDefaults<T extends Record<string, any>>(defaults: T, existing: any): T {
  if (!isPlainObject(existing)) return defaults;
  const out: any = { ...defaults };
  for (const key of Object.keys(existing)) {
    const next = existing[key];
    if (next === undefined) continue;
    if (Array.isArray(next)) {
      out[key] = next;
      continue;
    }
    if (isPlainObject(next) && isPlainObject(out[key])) {
      out[key] = deepMergeDefaults(out[key], next);
      continue;
    }
    out[key] = next;
  }
  return out;
}

export function mergeDefaultContent(type: "undergrad" | "junior", existing: any) {
  const defaults = type === "undergrad" ? createDefaultUndergradContent() : createDefaultJuniorContent();
  const merged = deepMergeDefaults(defaults as any, existing) as any;

  if (typeof merged.fillTime !== "string" || !merged.fillTime.trim()) {
    merged.fillTime = new Date().toISOString();
  }

  if (!Array.isArray(merged.advantageSubjects)) {
    merged.advantageSubjects = [];
  }

  if (!Array.isArray(merged.scores?.subjectsSelected)) {
    merged.scores = merged.scores ?? {};
    merged.scores.subjectsSelected = ["数学", "语文", "英语"];
  }

  const rows: MajorPreferenceItem[] = Array.isArray(merged.majorPreferences)
    ? merged.majorPreferences
    : createDefaultMajorPreferences();
  const normalized = rows.map((r, i) => ({
    index: typeof r?.index === "number" ? r.index : i + 1,
    majorCategory: typeof r?.majorCategory === "string" ? r.majorCategory : "",
    majorName: typeof r?.majorName === "string" ? r.majorName : ""
  }));
  if (normalized.length < 10) {
    for (let i = normalized.length; i < 10; i++) {
      normalized.push({ index: i + 1, majorCategory: "", majorName: "" });
    }
  }
  merged.majorPreferences = normalized;

  return merged;
}
