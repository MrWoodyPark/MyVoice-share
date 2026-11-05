'use strict';
const el = id => document.getElementById(id);
const text = (id, value) => { el(id).textContent = value; };
function render() {
  el('report').hidden = true; el('status').hidden = false; el('comparison').hidden = true;
  if (!location.hash) return;
  try {
    const r = decodeVoiceReport(location.hash);
    text('median', r.median == null ? '측정 불가' : `${r.median.toFixed(1)} Hz`);
    text('range', r.low == null ? '측정 불가' : `${r.low.toFixed(1)}–${r.high.toFixed(1)} Hz`);
    el('notes').replaceChildren();
    for (const note of r.notes) {
      const row = document.createElement('div'); row.className = 'note';
      const name = document.createElement('strong'); name.textContent = note.name;
      const bar = document.createElement('progress'); bar.max = 100; bar.value = note.percent; bar.setAttribute('aria-label', `${note.name} ${note.percent}%`);
      const percent = document.createElement('span'); percent.textContent = `${note.percent}%`;
      row.append(name, bar, percent); el('notes').append(row);
    }
    if (!r.notes.length) el('notes').textContent = '분석 가능한 유성음이 부족합니다.';
    text('score', r.score == null ? '평가 불가' : `${r.score} / 100`);
    if (r.profile && r.median != null) {
      const male = r.profile === 'male', delta = r.median - r.reference, st = 12 * Math.log2(r.median / r.reference);
      const signed = n => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
      text('profile', `${male ? '남자' : '여자'} 연구 참고값과 비교`);
      text('difference', `${signed(delta)} Hz · ${signed(st)} 반음`);
      text('reference', `참고값 ${r.reference} Hz · +는 높음, −는 낮음`);
      text('reference-note', male ? 'Saxton 등(2016)은 약 96 Hz에서 남성 음성 매력도의 정점을 보고했습니다.' : 'Borkowska·Pawlowski(2011)는 약 280 Hz 초과에서 여성 음성 매력도의 감소를 보고했습니다. 모든 여성의 최적 음높이라는 뜻은 아닙니다.');
      el('source').href = male ? 'https://doi.org/10.1093/beheco/arv178' : 'https://doi.org/10.1016/j.anbehav.2011.03.024';
      el('comparison').hidden = false;
    }
    el('status').hidden = true; el('report').hidden = false;
  } catch (_) {
    el('status').replaceChildren();
    const title = document.createElement('h2'); title.textContent = '결과 링크를 읽을 수 없습니다.';
    const detail = document.createElement('p'); detail.textContent = '링크가 잘렸거나 지원하지 않는 형식입니다. 보낸 사람에게 앱에서 링크를 다시 복사해 달라고 요청해 주세요.';
    el('status').append(title, detail);
  }
}
el('share').addEventListener('click', async () => {
  try {
    if (navigator.share) await navigator.share({ title: '내 목소리 분석 결과', url: location.href });
    else { await navigator.clipboard.writeText(location.href); text('share-status', '링크를 복사했습니다.'); }
  } catch (error) { if (error.name !== 'AbortError') text('share-status', '공유하지 못했습니다. 브라우저 주소창의 전체 링크를 복사해 주세요.'); }
});
window.addEventListener('hashchange', render); render();
