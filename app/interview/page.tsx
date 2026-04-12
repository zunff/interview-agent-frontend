'use client';

import { redirect } from 'next/navigation';
import { useInterviewStore } from '../../store/interviewStore';

export default function InterviewPage() {
  const sessionId = useInterviewStore(state => state.sessionId);
  
  // 如果没有会话ID，重定向到首页
  if (!sessionId) {
    redirect('/');
  }
  
  // 重定向到具体的面试会话页面
  redirect(`/interview/${sessionId}`);
}
