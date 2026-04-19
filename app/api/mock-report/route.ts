import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';

/**
 * 仅在 Mock 模式下提供 docs/final_report.md 正文，供前端拉取；不把全文打进 JS bundle。
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_MOCK_MODE !== 'true') {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const path = join(process.cwd(), 'docs', 'final_report.md');
    const text = await readFile(path, 'utf-8');
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Report file unavailable', { status: 500 });
  }
}
