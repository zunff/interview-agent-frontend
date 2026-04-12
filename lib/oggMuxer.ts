/**
 * 最小化 OGG/Opus 容器封装器。
 * 将裸 Opus 帧封装为 OGG 页面，输出以 "OggS" 魔数开头的数据流。
 */

// OGG CRC32 查找表（多项式 0x04C11DB7）
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) ? ((r << 1) ^ 0x04C11DB7) >>> 0 : (r << 1) >>> 0;
    }
    table[i] = r >>> 0;
  }
  return table;
})();

function oggCrc32(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xFF]) >>> 0;
  }
  return crc >>> 0;
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeInt64LE(view: DataView, offset: number, value: number): void {
  // JS number 精度足够处理 granule position（最多 48 位有效）
  writeUint32LE(view, offset, value & 0xFFFFFFFF);
  writeUint32LE(view, offset + 4, Math.floor(value / 0x100000000) & 0xFFFFFFFF);
}

/**
 * 构建一个 OGG 页面。
 * pageHeaderFlags: bit0=continuation, bit1=BOS(beginning of stream), bit2=EOS(end of stream)
 */
function buildOggPage(
  serialNo: number,
  pageSeq: number,
  granulePos: number,
  pageHeaderFlags: number,
  segmentData: Uint8Array,
): Uint8Array {
  // 计算段表
  const segments: number[] = [];
  let remaining = segmentData.length;
  while (remaining >= 255) {
    segments.push(255);
    remaining -= 255;
  }
  if (remaining > 0 || segmentData.length === 0) {
    segments.push(remaining);
  }

  const headerSize = 27 + segments.length;
  const pageSize = headerSize + segmentData.length;
  const page = new Uint8Array(pageSize);
  const view = new DataView(page.buffer);

  // OGG 页面头
  page[0] = 0x4F; // 'O'
  page[1] = 0x67; // 'g'
  page[2] = 0x67; // 'g'
  page[3] = 0x53; // 'S'
  page[4] = 0;    // version
  page[5] = pageHeaderFlags; // header type
  writeInt64LE(view, 6, granulePos);   // granule position
  writeUint32LE(view, 14, serialNo);   // serial number
  writeUint32LE(view, 18, pageSeq);    // page sequence number
  writeUint32LE(view, 22, 0);          // checksum placeholder
  page[26] = segments.length;          // segment count

  // 段表
  for (let i = 0; i < segments.length; i++) {
    page[27 + i] = segments[i];
  }

  // 段数据
  page.set(segmentData, headerSize);

  // 计算 CRC 并写入
  const crc = oggCrc32(page);
  writeUint32LE(view, 22, crc);

  return page;
}

export class OggOpusMuxer {
  private serialNo: number;
  private pageSeq = 0;
  private granulePos = 0;
  private sampleRate: number;
  private channels: number;

  constructor(sampleRate: number = 48000, channels: number = 1) {
    this.serialNo = Math.floor(Math.random() * 0xFFFFFFFF);
    this.sampleRate = sampleRate;
    this.channels = channels;
  }

  /**
   * 返回 Opus Identification Header + Comment Header 的 OGG 页面（合并）。
   * 应该在流的最开始发送。
   */
  getHeaderPages(): Uint8Array {
    // ---- Opus Identification Header (19 bytes) ----
    const idHeader = new Uint8Array(19);
    const idView = new DataView(idHeader.buffer);
    // Magic "OpusHead"
    idHeader[0] = 0x4F; idHeader[1] = 0x70; idHeader[2] = 0x75; idHeader[3] = 0x73;
    idHeader[4] = 0x48; idHeader[5] = 0x65; idHeader[6] = 0x61; idHeader[7] = 0x64;
    idHeader[8] = 1;             // version
    idHeader[9] = this.channels; // channel count
    writeUint16LE(idView, 10, 3840);  // pre-skip (recommended 3840 for 48kHz)
    writeUint32LE(idView, 12, this.sampleRate);
    writeUint16LE(idView, 16, 0);     // output gain
    idHeader[18] = 0;                 // channel mapping family (0 = mono/stereo)

    // ---- Opus Comment Header (minimal) ----
    const vendorString = new TextEncoder().encode('interview-agent');
    const commentHeader = new Uint8Array(8 + 4 + vendorString.length);
    const commentView = new DataView(commentHeader.buffer);
    // Magic "OpusTags"
    commentHeader[0] = 0x4F; commentHeader[1] = 0x70; commentHeader[2] = 0x75; commentHeader[3] = 0x73;
    commentHeader[4] = 0x54; commentHeader[5] = 0x61; commentHeader[6] = 0x67; commentHeader[7] = 0x73;
    // Vendor string length + vendor string
    writeUint32LE(commentView, 8, vendorString.length);
    commentHeader.set(vendorString, 12);
    // No user comments (count = 0 is omitted since we already included vendor string)
    // Actually need to write vendor length, vendor string, then comment count (0)
    // Rebuild with proper size
    const commentFinal = new Uint8Array(8 + 4 + vendorString.length + 4);
    const commentFinalView = new DataView(commentFinal.buffer);
    commentFinal[0] = 0x4F; commentFinal[1] = 0x70; commentFinal[2] = 0x75; commentFinal[3] = 0x73;
    commentFinal[4] = 0x54; commentFinal[5] = 0x61; commentFinal[6] = 0x67; commentFinal[7] = 0x73;
    writeUint32LE(commentFinalView, 8, vendorString.length);
    commentFinal.set(vendorString, 12);
    writeUint32LE(commentFinalView, 12 + vendorString.length, 0); // user comment list length = 0

    // 构建 OGG 页面
    const idPage = buildOggPage(this.serialNo, this.pageSeq++, 0, 0x02, idHeader); // BOS flag
    const commentPage = buildOggPage(this.serialNo, this.pageSeq++, 0, 0x00, commentFinal);

    // 合并两页
    const result = new Uint8Array(idPage.length + commentPage.length);
    result.set(idPage, 0);
    result.set(commentPage, idPage.length);
    return result;
  }

  /**
   * 将一个 Opus 帧封装为一个 OGG audio page。
   * @param opusFrame 裸 Opus 帧数据
   * @param frameSamples 该帧包含的 PCM 样本数（用于 granule position）
   */
  muxFrame(opusFrame: Uint8Array, frameSamples: number): Uint8Array {
    this.granulePos += frameSamples;
    return buildOggPage(
      this.serialNo,
      this.pageSeq++,
      this.granulePos,
      0x00, // normal page
      opusFrame,
    );
  }

  /**
   * 返回流的结束页面（EOS）。
   */
  getEndPage(): Uint8Array {
    return buildOggPage(
      this.serialNo,
      this.pageSeq++,
      this.granulePos,
      0x04, // EOS flag
      new Uint8Array(0),
    );
  }
}
