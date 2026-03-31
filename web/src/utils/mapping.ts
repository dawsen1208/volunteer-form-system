import type { AuthRole, FormStatus, FormType } from "../types";

export function mapFormType(type: FormType): string {
  if (type === "undergrad") return "本科志愿单";
  return "专科志愿单";
}

export function mapFormStatus(status: FormStatus): string {
  if (status === "draft") return "草稿";
  return "已提交";
}

export function mapRole(role: AuthRole): string {
  if (role === "user") return "用户";
  return "管理员";
}

export const undergradMajorCategories = [
  "哲学",
  "经济学",
  "法学",
  "教育学",
  "文学",
  "历史学",
  "理学",
  "工学",
  "农学",
  "医学",
  "管理学",
  "艺术学"
] as const;

export const juniorMajorCategories = [
  "农林牧渔大类",
  "资源环境大类",
  "能源动力与材料大类",
  "土木建筑大类",
  "水利大类",
  "装备制造大类",
  "生物与化工大类",
  "轻工纺织大类",
  "食品药品与粮食大类",
  "交通运输大类",
  "电子与信息大类",
  "医药卫生大类",
  "财经商贸大类",
  "旅游大类",
  "文化艺术大类",
  "新闻传播类",
  "教育与体育大类",
  "公安与司法大类",
  "公共管理与服务大类"
] as const;

export const provinces = [
  "北京",
  "天津",
  "上海",
  "重庆",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "陕西",
  "甘肃",
  "青海",
  "内蒙古",
  "广西",
  "西藏",
  "宁夏",
  "新疆"
] as const;
