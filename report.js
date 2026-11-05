(function (root) {
  'use strict';
  function decodeReport(hash) {
    if (!hash.startsWith('#r=') || hash.length > 4096) throw Error('올바른 결과 링크가 아닙니다.');
    const token = hash.slice(3);
    if (!/^[A-Za-z0-9_-]+$/.test(token) || token.length % 4 === 1) throw Error('링크가 잘렸거나 손상되었습니다.');
    const raw = atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - token.length % 4) % 4));
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
    if (!data || data.v !== 1) throw Error('지원하지 않는 결과 버전입니다.');
    const hz = x => typeof x === 'number' && Number.isFinite(x) && x >= 65 && x <= 1000;
    const noPitch = data.median == null && data.low == null && data.high == null;
    if (!noPitch && !(hz(data.median) && hz(data.low) && hz(data.high) && data.low <= data.median && data.median <= data.high)) throw Error('음높이 데이터가 올바르지 않습니다.');
    if (!Array.isArray(data.notes) || data.notes.length > 5 || data.notes.some(n => !n || typeof n.name !== 'string' || !/^[A-G]♯?[1-6]$/.test(n.name) || !Number.isInteger(n.percent) || n.percent < 0 || n.percent > 100)) throw Error('음계 데이터가 올바르지 않습니다.');
    if (noPitch && data.notes.length) throw Error('음높이 데이터가 없습니다.');
    if (data.notes.reduce((sum, n) => sum + n.percent, 0) > 103) throw Error('음계 비율이 올바르지 않습니다.');
    if (data.score != null && (!Number.isInteger(data.score) || data.score < 0 || data.score > 100)) throw Error('인식 점수가 올바르지 않습니다.');
    if (data.profile != null && !['male', 'female'].includes(data.profile)) throw Error('비교 기준이 올바르지 않습니다.');
    if ((data.profile == null) !== (data.reference == null) || (data.reference != null && !hz(data.reference))) throw Error('연구 참고값이 올바르지 않습니다.');
    return data;
  }
  if (typeof module !== 'undefined') module.exports = { decodeReport };
  root.decodeVoiceReport = decodeReport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
