import request from './request'

/**
 * 分析接口（对应 AnalysisController，/analysis）
 *
 * 两个接口共用一份入参 AnalysisRequest：
 * - scope：PUBLIC_SPACE 公共图库（仅管理员） / ALL_SPACE 所有用户空间（仅管理员） /
 *   SINGLE_SPACE 单个空间（spaceId 必填，普通用户只能分析自己的空间）
 * - spaceId：scope = SINGLE_SPACE 时必填
 *
 * 权限完全由后端 checkAnalysisRequest 把关：非管理员传 PUBLIC_SPACE / ALL_SPACE，
 * 或传了不属于自己的 spaceId，都会返回「非管理员用户,只能分析自己的空间」。
 * 前端只负责不给用户看不该看的选项，不做最终拦截。
 */

/**
 * 分类分析：按分类统计图片数量与占用空间
 * @param {{ scope: string, spaceId?: string }} data AnalysisRequest
 * @returns {Promise<Array<{ categoryName: string, pictureCount: number, totalSize: number }>>}
 */
export function analysisCategory(data) {
  return request.post('/analysis/category', data)
}

/**
 * 标签分析：按标签统计图片数量与占用空间
 * @param {{ scope: string, spaceId?: string }} data AnalysisRequest
 * @returns {Promise<Array<{ tagName: string, pictureCount: number, totalSize: number }>>}
 */
export function analysisTag(data) {
  return request.post('/analysis/tag', data)
}

/**
 * 图片大小分析：按体积分段统计（全量数据，不区分时间）
 * @param {{ scope: string, spaceId?: string }} data AnalysisRequest
 * @returns {Promise<Array<{ sizeRange: string, pictureCount: number, totalSize: number }>>}
 */
export function analysisSize(data) {
  return request.post('/analysis/size', data)
}

/**
 * 用户上传行为分析：唯一带时间参数的接口
 * @param {{ scope: string, spaceId?: string, timeRange?: string }} data UsageTrendRequest，
 *   timeRange = WEEK 本周按天 / MONTH 本月按天 / YEAR 本年按月，不传默认 WEEK
 * @returns {Promise<Array<{ statDate: string, pictureCount: number, userStats: Array<{ userName: string, pictureCount: number }> }>>}
 */
export function analysisTrend(data) {
  return request.post('/analysis/trend', data)
}

/**
 * 空间用量分析（排行）：只统计使用内存，不含图片数量；仅管理员
 * @returns {Promise<Array<{ spaceId: string, spaceName: string, spaceType: number, userName: string, totalSize: number, maxSize: number }>>}
 */
export function analysisSpaceUsage() {
  return request.post('/analysis/space')
}
