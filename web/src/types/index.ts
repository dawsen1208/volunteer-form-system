export type AuthRole = "user" | "admin";

export type UserAuthInfo = {
  role: "user";
  token: string;
  userId?: string;
  phone?: string;
};

export type AdminAuthInfo = {
  role: "admin";
  token: string;
};

export type LoginResponse =
  | ({ role: "user"; token: string; isNew?: boolean } & Partial<Pick<UserAuthInfo, "userId" | "phone">>)
  | ({ role: "admin"; token: string } & Partial<Record<string, never>>);

export type ApiResponse<T> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string };

export type FormType = "undergrad" | "junior";
export type FormStatus = "draft" | "submitted";

export type MajorPreferenceItem = {
  index: number;
  majorCategory: string;
  majorName: string;
};

export type BodyCondition = {
  myopia?: { has?: boolean; leftDegree?: number; rightDegree?: number };
  leftHanded?: boolean;
  colorBlind?: boolean;
  colorWeak?: boolean;
  colorRecognitionIssue?: boolean;
  hepatitisB?: boolean;
  physicalDisability?: boolean;
  medicalHistoryNote?: string;
};

export type ExamScores = {
  totalScore?: number;
  rank?: number;
  subjectsSelected?: string[];
  chineseScore?: number;
  mathScore?: number;
  englishScore?: number;
  physicsScore?: number;
  chemistryScore?: number;
  biologyScore?: number;
  politicsScore?: number;
  historyScore?: number;
  geographyScore?: number;
};

export type BaseFormContent = {
  fillTime?: string;
  parentPhone?: string;
  name?: string;
  gender?: string;
  ethnicity?: string;
  birthDate?: string;
  height?: string;
  weight?: string;
  graduateStatus?: string;
  candidatePhone?: string;
  homeAddress?: string;
  idNumber?: string;
  examNumber?: string;
  referrer?: string;
  candidateCategory?: string;
  professionalScore?: string;
  advantageSubjects?: string[];
  graduateSchool?: string;
  className?: string;
  classTeacher?: string;
  physicalExamConclusion?: string;
  physicalExamNormal?: boolean;
  body?: BodyCondition;
  scores?: ExamScores;
  fatherOccupation?: string;
  motherOccupation?: string;
  socialResources?: string;
  intendedProvinces?: string[];
  schoolNatureTags?: string[];
  oralExamStatus?: string;
  tuitionRange?: string;
  householdType?: string;
  extraPreferenceNotes?: string;
  majorPreferences?: MajorPreferenceItem[];
  dreamUniversityOrCity?: string;
  finalRemarks?: string;
};

export type UndergradFormContent = BaseFormContent & {
  advanceBatchOptions?: string[];
  advanceBatchOtherNote?: string;
  specialBatchOptions?: string[];
  specialBatchOtherNote?: string;
  targetMajorNotes?: string;
  schoolLevelTags?: string[];
  oralExamStatus?: string;
  publicFundIntent?: string;
  postgraduateIntent?: string;
  employmentIntent?: string;
};

export type JuniorFormContent = BaseFormContent & {
  juniorPlanIntent?: string;
  bachelorProvincePreference?: string;
  bachelorLevelPreference?: string;
  majorTypePreference?: string;
  costPreferenceRank?: string;
  examSubjectPreference?: string;
  overseasOrInternationalPlan?: string;
  upgradeIntent?: string;
  publicFundMajorIntent?: string;
};

export type FormContent = UndergradFormContent | JuniorFormContent;

export type FormRecord = {
  _id: string;
  type: FormType;
  status: FormStatus;
  content: FormContent;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminFormRecord = FormRecord & {
  userId?: { _id: string; phone?: string };
};
