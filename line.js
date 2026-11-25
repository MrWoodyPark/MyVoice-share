'use strict';
const byId = id => document.getElementById(id);
let invite, reply, stream, recorder, context, deadline, animation, audioURL;
const read = s => JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
const encode = obj => btoa(Array.from(new TextEncoder().encode(JSON.stringify(obj)), n=>String.fromCharCode(n)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const valid = r => r && Number.isFinite(r.duration) && r.duration>0 && r.duration<=35 && Array.isArray(r.rhythm) && r.rhythm.length===80 && r.rhythm.every(n=>Number.isInteger(n)&&n>=0&&n<=1000);
function paint(id,r,t) {
  const node=byId(id), words=invite.line.trim().split(/\s+/);
  const index=Math.min(79,Math.floor(80*t/r.duration));
  const voiced=r.rhythm.filter(Boolean).length;
  const before=r.rhythm.slice(0,index).filter(Boolean).length;
  const active=Math.min(words.length-1,Math.floor(words.length*before/Math.max(1,voiced)));
  node.replaceChildren();
  for(const [i,w] of words.entries()){
    const span=document.createElement('span'); span.textContent=w+' ';
    span.style.fontWeight='700'; span.style.opacity= t<r.duration && i===active && r.rhythm[index] ? '1':'.5';node.append(span);
  }
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;height:64px;gap:1px';
  r.rhythm.forEach((hz,i)=>{const b=document.createElement('i');b.style.cssText='flex:1;border-radius:3px;background:var(--purple);height:'+ (hz?Math.min(60,Math.max(5,Math.log2(hz/50)*13)):1)+'px;opacity:'+(i<=index?1:.3);bar.append(b);});node.append(bar);
}
function show(){
  if(invite.newLine)byId('host').textContent='친구가 제안한 새 대사입니다.';else paint('host',invite,invite.duration);
  if(reply){paint('guest',reply,reply.duration);byId('play').hidden=false;byId('send').hidden=false;}
}
function animate(){
  cancelAnimationFrame(animation);const start=performance.now();
  function tick(now){const time=(now-start)/1000;if(!invite.newLine)paint('host',invite,time);paint('guest',reply,time);if(time<Math.max(invite.duration,reply.duration))animation=requestAnimationFrame(tick);}
  animation=requestAnimationFrame(tick);
}
function analyze(buf){
  const x=buf.getChannelData(0), sr=buf.sampleRate, step=Math.max(1,Math.floor(sr/8000)), rate=sr/step;
  const rhythm=Array.from({length:80},(_,i)=>{
    const start=Math.floor((x.length-1)*i/80),size=Math.min(320,Math.floor((x.length-start)/step));
    if(size<100)return 0;
    const frame=Array.from({length:size},(_,n)=>x[start+n*step]);
    if(frame.reduce((v,n)=>v+n*n,0)/size<0.00009)return 0;
    let best=0,pitch=0;
    for(let lag=Math.ceil(rate/1000);lag<=Math.min(size/2,rate/65);lag++){
      let cross=0,a=0,b=0;for(let j=0;j<size/2;j++){let u=frame[j],v=frame[j+lag];cross+=u*v;a+=u*u;b+=v*v;}
      let corr=cross/Math.sqrt(a*b||1);
      if(corr>0.75&&corr>best+0.025){best=corr;pitch=Math.round(rate/lag);}
    }return pitch;
  });
  return {duration:buf.duration,rhythm};
}
async function record(){
  if(recorder?.state==='recording'){recorder.stop();return;}
  const button=byId('record');button.disabled=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)throw Error('Safari 또는 Chrome에서 링크를 열어 주세요.');
    context=new AudioContext();await context.resume();
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    recorder=new MediaRecorder(stream);const chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=async()=>{
      button.disabled=true;clearTimeout(deadline);stream.getTracks().forEach(t=>t.stop());
      try{
        const blob=new Blob(chunks,{type:recorder.mimeType}), buf=await context.decodeAudioData(await blob.arrayBuffer());
        const result=analyze(buf);
        if(!valid(result)||!result.rhythm.some(Boolean))throw Error('목소리를 찾지 못했어요. 다시 읽어 주세요.');
        reply=result;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(blob);
        byId('audio').src=audioURL;byId('audio').hidden=false;show();animate();
        byId('status').textContent='두 사람의 리듬을 비교해 보세요.';
      }catch(e){byId('status').textContent=e.message;}
      finally{await context.close();button.disabled=false;button.textContent='다시 읽기';}
    };
    recorder.start();deadline=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},30000);
    button.disabled=false;button.textContent='녹음 마치기';byId('status').textContent='녹음 중 · 최대 30초';
  }catch(e){stream?.getTracks().forEach(t=>t.stop());if(context?.state!=='closed')await context?.close();button.disabled=false;byId('status').textContent='마이크를 확인해 주세요. '+e.message;}
}
try{
  if(location.hash.length>12000)throw Error();
  const nextLine = location.hash.startsWith('#next=') ? decodeURIComponent(location.hash.slice(6)).trim() : '';
  if(nextLine && Array.from(nextLine).length>120)throw Error();
  invite=nextLine ? {line:nextLine,rhythm:Array(80).fill(0),duration:1,locale:'ko-KR',newLine:true} : read(location.hash.slice(1));
  if(!valid(invite)||typeof invite.line!=='string'||!invite.line.trim()||Array.from(invite.line).length>600)throw Error();
  if(invite.reply){if(!valid(invite.reply))throw Error();reply=invite.reply;}
  byId('line').textContent=invite.line;byId('studio').hidden=false;byId('status').textContent=reply?'두 사람의 한 줄 교환':'친구가 같은 대사로 초대했어요.';show();
}catch{byId('status').textContent='초대 링크 전체를 다시 열어 주세요.';}
byId('record').onclick=record;byId('play').onclick=animate;
byId('send').onclick=async()=>{
 const url=new URL(location.href);url.hash=encode({...invite,reply});
 try{if(navigator.share)await navigator.share({title:'두 사람의 한 줄 교환',url:url.href});else{await navigator.clipboard.writeText(url.href);byId('status').textContent='답장 링크를 복사했어요.';}}
 catch(e){if(e.name!=='AbortError'){location.hash=url.hash;byId('status').textContent='주소창의 답장 링크를 복사하세요.';}}
};
window.addEventListener('pagehide',()=>{clearTimeout(deadline);stream?.getTracks().forEach(t=>t.stop());});

async function sendNext(line) {
  if(!line.trim())return;
  const url=new URL(location.href);
  url.hash='next='+encodeURIComponent(Array.from(line.trim()).slice(0,120).join(''));
  try {
    if(navigator.share)await navigator.share({title:'다음 대사를 읽어 줘',url:url.href});
    else {await navigator.clipboard.writeText(url.href);byId('status').textContent='다음 대사 링크를 복사했습니다.';}
  } catch(e){if(e.name!=='AbortError')byId('status').textContent='링크를 공유할 수 없습니다.';}
}
byId('next-send').onclick=()=>sendNext(byId('next-line').value);
byId('quiz-file').onchange=async event=>{
  const box=byId('quiz');box.replaceChildren();
  try{
    const file=event.target.files[0];if(!file)return;
    if(file.size>8*1024*1024)throw Error();
    const html=await file.text();
    // Only read known fields. Never mount or execute the supplied HTML.
    const sources=[...html.matchAll(/<audio controls src="(data:audio\/mp4;base64,[a-zA-Z0-9+/=]+)"/g)];
    const answer=html.match(/<meta name="myvoice-answer" content="([AB])">/)?.[1];
    const question=html.match(/<blockquote>([^<]*)<\/blockquote><p>([^<]*)<\/p>/);
    if(sources.length!==2||!answer||!question)throw Error();
    const title=document.createElement('p');title.textContent=question[1]+' · '+question[2];box.append(title);
    const verdict=document.createElement('p');
    for(const [i,m] of sources.entries()){
      const audio=document.createElement('audio');audio.controls=true;audio.src=m[1];
      const btn=document.createElement('button');const label=i?'B':'A';btn.textContent=label+' 선택';
      btn.onclick=()=>{verdict.textContent=label===answer?'맞혔어요!':'보낸 사람이 고른 의도는 '+answer+'였어요.';};
      box.append(audio,btn);
    }
    const input=document.createElement('input');input.placeholder='친구에게 낼 다음 대사';input.maxLength=120;
    const send=document.createElement('button');send.textContent='다음 대사 보내기';send.onclick=()=>sendNext(input.value);
    box.append(verdict,input,send);
  }catch{box.textContent='내 목소리 분석에서 만든 퀴즈 파일을 선택해 주세요.';}
};
