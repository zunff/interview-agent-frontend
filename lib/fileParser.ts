import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

export interface ParseResult {
  text: string;
  error: string | null;
}

export const parsePDF = async (file: File): Promise<ParseResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    
    const loadingTask = pdfjsLib.getDocument({
      data: typedArray,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return {
      text: fullText.trim(),
      error: null
    };
  } catch (error) {
    console.error('PDF解析错误:', error);
    return {
      text: '',
      error: 'PDF文件解析失败，请检查文件格式'
    };
  }
};

export const parseDOCX = async (file: File): Promise<ParseResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({
      arrayBuffer: arrayBuffer
    });
    return {
      text: result.value,
      error: null
    };
  } catch (error) {
    console.error('DOCX解析错误:', error);
    return {
      text: '',
      error: 'DOCX文件解析失败，请检查文件格式'
    };
  }
};

export const parseFile = async (file: File): Promise<ParseResult> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  switch (fileExtension) {
    case 'pdf':
      return await parsePDF(file);
    case 'docx':
      return await parseDOCX(file);
    default:
      return {
        text: '',
        error: '不支持的文件格式，请上传PDF或DOCX文件'
      };
  }
};

export const isValidFileType = (file: File): boolean => {
  const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const validExtensions = ['pdf', 'docx'];
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  return validTypes.includes(file.type) || !!(fileExtension && validExtensions.includes(fileExtension));
};

export const isValidFileSize = (file: File, maxSizeMB: number = 10): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};