export interface JobInfo {
  jobName: string;
  jobSalary: string;
  company: string;
  jobDescription: string;
}

/**
 * 从 BOSS 直聘页面源码中提取岗位信息
 */
export function parseBossZhipin(html: string): JobInfo | null {
  try {
    const info: Partial<JobInfo> = {};

    // 提取基本信息（从 JavaScript 变量中）
    const jobNameMatch = html.match(/job_name:\s*'([^']+)'/);
    if (jobNameMatch) {
      info.jobName = jobNameMatch[1];
    }

    const jobSalaryMatch = html.match(/job_salary:\s*'([^']+)'/);
    if (jobSalaryMatch) {
      info.jobSalary = jobSalaryMatch[1];
    }

    const companyMatch = html.match(/company:\s*'([^']+)'/);
    if (companyMatch) {
      info.company = companyMatch[1];
    }

    // 提取岗位描述：从 <div class="job-sec-text"> 中获取
    const secMatch = html.match(/class="job-sec-text">([\s\S]*?)<\/div>/);
    if (secMatch) {
      let desc = secMatch[1]
        .replace(/<br\s*\/?>/g, '\n')   // <br/> → 换行
        .replace(/<[^>]+>/g, '')         // 移除剩余 HTML 标签
        .replace(/\s+/g, ' ')            // 合并所有空白字符（换行、多空格等）
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/【/g, '\n【')          // 在【前换行，增加可读性
        .trim();

      info.jobDescription = desc;
    }

    // 验证必需字段
    if (!info.jobName || !info.jobDescription) {
      return null;
    }

    return info as JobInfo;
  } catch (error) {
    console.error('解析 BOSS 直聘页面失败:', error);
    return null;
  }
}
