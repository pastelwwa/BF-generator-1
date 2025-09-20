// Stałe canvas
const W = 1081, H = 1447;
const c = document.getElementById("c");
const ctx = c.getContext("2d");

// Fonty i odstępy
const FONT1_PX = 60; // duży
const FONT2_PX = 30; // mały
const LH1 = Math.round(FONT1_PX * 1.05);
const LH2 = Math.round(FONT2_PX * 1.15);

// Stan
const state = {
  tlo:null, mask:null, nakladka:null, logo:null,
  img:null, imgAngle:0,
  baseScale:1,          // minimalny scale (cover)
  zoomExtra:0,          // nadmiar powyżej cover (0..200%)
  offx:0, offy:0,
  bright:100, sat:100, cont:100, sharp:100,
  text1:"", text2:"", showGrid:true,
  maskBBox:{x:0,y:0,w:W,h:H}
};

const el = id => document.getElementById(id);
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

function loadImage(src){
  return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
}

// bbox nieprzezroczystości maski (dla cover)
function computeMaskBBox(maskImg){
  const off=document.createElement('canvas'); off.width=W; off.height=H;
  const octx=off.getContext('2d');
  octx.drawImage(maskImg,0,0,W,H);
  const img=octx.getImageData(0,0,W,H), d=img.data;
  let minx=W, miny=H, maxx=-1, maxy=-1;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const a=d[(y*W+x)*4+3];
      if(a>10){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
    }
  }
  if(maxx<minx) return {x:0,y:0,w:W,h:H};
  return {x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1};
}

function applySharpen(srcCanvas, amountPct){
  const amount=Math.max(0,Math.min(2,amountPct/100));
  if(amount===1) return srcCanvas;
  const w=srcCanvas.width,h=srcCanvas.height;
  const sctx=srcCanvas.getContext('2d');
  const src=sctx.getImageData(0,0,w,h);
  const dst=sctx.createImageData(w,h);
  const k=[0,-1*amount,0,-1*amount,1+4*amount,-1*amount,0,-1*amount,0];
  const sd=src.data, dd=dst.data, row=w*4;
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const idx=(y*w+x)*4;
      for(let ch=0;ch<3;ch++){
        let acc=0;
        acc+=sd[idx-row-4+ch]*k[0];
        acc+=sd[idx-row  +ch]*k[1];
        acc+=sd[idx-row+4+ch]*k[2];
        acc+=sd[idx-4    +ch]*k[3];
        acc+=sd[idx      +ch]*k[4];
        acc+=sd[idx+4    +ch]*k[5];
        acc+=sd[idx+row-4+ch]*k[6];
        acc+=sd[idx+row  +ch]*k[7];
        acc+=sd[idx+row+4+ch]*k[8];
        dd[idx+ch]=Math.max(0,Math.min(255,acc));
      }
      dd[idx+3]=sd[idx+3];
    }
  }
  sctx.putImageData(dst,0,0);
  return srcCanvas;
}

function computeBaseScaleForImage(img){
  const ang = state.imgAngle % 4;
  const iw = (ang%2===0)? img.width : img.height;
  const ih = (ang%2===0)? img.height: img.width;
  const mw = state.maskBBox.w, mh = state.maskBBox.h;
  return Math.max(mw/iw, mh/ih); // cover
}

function render(){
  if(!state.tlo){ return; }

  // tło
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(state.tlo,0,0,W,H);

  // zdjęcie -> offscreen -> maska
  if(state.img && state.mask){
    const off=document.createElement('canvas'); off.width=W; off.height=H;
    const octx=off.getContext('2d');

    // korekcje
    octx.filter=`brightness(${state.bright/100}) saturate(${state.sat/100}) contrast(${state.cont/100})`;

    // skalowanie: baseScale * (1+zoomExtra/100)
    const scale = state.baseScale * (1 + state.zoomExtra/100);
    const ang = state.imgAngle % 4;

    // środek maski + przesunięcia
    const cx = state.maskBBox.x + state.maskBBox.w/2 + state.offx;
    const cy = state.maskBBox.y + state.maskBBox.h/2 + state.offy;

    octx.save();
    octx.translate(cx,cy);
    octx.rotate(ang*Math.PI/2);

    // wymiary po obrocie
    const srcW = (ang%2===0)? state.img.width : state.img.height;
    const srcH = (ang%2===0)? state.img.height: state.img.width;
    const drawW = srcW*scale, drawH = srcH*scale;

    octx.drawImage(state.img, -drawW/2, -drawH/2, drawW, drawH);
    octx.restore();

    // maskowanie
    octx.save();
    octx.globalCompositeOperation='destination-in';
    octx.drawImage(state.mask,0,0,W,H);
    octx.restore();

    // ostrość
    const sharpened = (state.sharp===100)? off : applySharpen(off, state.sharp);

    ctx.drawImage(sharpened,0,0);
  }

  // nakładki
  if(state.nakladka) ctx.drawImage(state.nakladka,0,0,W,H);
  if(state.logo) ctx.drawImage(state.logo,0,0,W,H);

  // teksty
  ctx.fillStyle="#fff";
  ctx.textAlign="left";
  ctx.textBaseline="alphabetic";

  // duży (linia bazowa 1154, w górę)
  const useFont1 = document.fonts.check(`${FONT1_PX}px "TT-Travels-Next-DemiBold"`);
  ctx.font = `${FONT1_PX}px ${useFont1?'"TT-Travels-Next-DemiBold"':'Arial'}, sans-serif`;
  const lines1=(state.text1||"").toUpperCase().split("\n");
  for(let i=0;i<lines1.length;i++){
    const y=1154 - i*LH1;
    ctx.fillText(lines1[lines1.length-1-i], 70, y);
  }

  // mały (linia bazowa 1201, w dół)
  const useFont2 = document.fonts.check(`${FONT2_PX}px "TT-Commons-Medium"`);
  ctx.font = `${FONT2_PX}px ${useFont2?'"TT-Commons-Medium"':'Arial'}, sans-serif`;
  const lines2=(state.text2||"").split("\n");
  for(let i=0;i<lines2.length;i++){
    const y=1201 + i*LH2;
    ctx.fillText(lines2[i], 75, y);
  }

  // siatka
  if(state.showGrid){
    ctx.strokeStyle="rgba(255,255,255,.5)";
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(W/3,0); ctx.lineTo(W/3,H);
    ctx.moveTo(2*W/3,0); ctx.lineTo(2*W/3,H);
    ctx.moveTo(0,H/3); ctx.lineTo(W,H/3);
    ctx.moveTo(0,2*H/3); ctx.lineTo(W,2*H/3);
    ctx.stroke();
  }
}

// PRELOAD
async function preload(){
  try{
    const base='pliki/';
    [state.tlo,state.mask,state.nakladka,state.logo] = await Promise.all([
      loadImage(base+'tlo.png'),
      loadImage(base+'fotoramka.png'),
      loadImage(base+'nakladka.png'),
      loadImage(base+'logo.png'),
    ]);
    state.maskBBox = computeMaskBBox(state.mask);

    // fonty – nie blokuj renderu, ale poczekaj chwilę jeśli się da
    await Promise.allSettled([
      document.fonts.load(`${FONT1_PX}px "TT-Travels-Next-DemiBold"`),
      document.fonts.load(`${FONT2_PX}px "TT-Commons-Medium"`),
      document.fonts.ready
    ]);

    el('status').textContent='Zasoby OK. Wczytaj zdjęcie.';
  }catch(e){
    el('status').textContent='Błąd ładowania zasobów: '+e;
  }
}

// ZAPIS
function saveImage(type){
  const base=(el('outname').value||'wynik').replace(/[^a-zA-Z0-9_.-]/g,'_');
  const ext= type==='png'?'png':'jpg';
  const mime= type==='png'?'image/png':'image/jpeg';
  c.toBlob(blob=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`${base}.${ext}`;
    a.click(); URL.revokeObjectURL(a.href);
  }, mime, type==='jpg'?0.9:undefined);
}

// UI
function bindUI(){
  el('photoInput').addEventListener('change', e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    const img=new Image();
    img.onload=()=>{
      state.img=img; state.imgAngle=0;
      state.baseScale=computeBaseScaleForImage(img);
      state.zoomExtra=0; el('zoomExtra').value=0;
      state.offx=0; state.offy=0; el('offx').value=0; el('offy').value=0;
      URL.revokeObjectURL(url);
      render();
    };
    img.src=url;
  });

  el('zoomExtra').addEventListener('input', e=>{ state.zoomExtra=+e.target.value; render(); });
  ['offx','offy','bright','sat','cont','sharp'].forEach(id=>{
    el(id).addEventListener('input', e=>{ state[id]=+e.target.value; render(); });
  });

  el('text1').addEventListener('input', e=>{ state.text1=e.target.value; render(); });
  el('text2').addEventListener('input', e=>{ state.text2=e.target.value; render(); });
  el('showGrid').addEventListener('change', e=>{ state.showGrid=e.target.checked; render(); });

  el('renderBtn').addEventListener('click', render);
  el('savePngBtn').addEventListener('click', ()=>saveImage('png'));
  el('saveJpgBtn').addEventListener('click', ()=>saveImage('jpg'));

  el('autoFitBtn').addEventListener('click', ()=>{
    if(!state.img) return;
    state.baseScale=computeBaseScaleForImage(state.img);
    state.zoomExtra=0; el('zoomExtra').value=0;
    state.offx=0; state.offy=0; el('offx').value=0; el('offy').value=0;
    render();
  });

  el('rotateBtn').addEventListener('click', ()=>{
    if(!state.img) return;
    state.imgAngle=(state.imgAngle+1)%4;
    state.baseScale=computeBaseScaleForImage(state.img);
    state.zoomExtra=Math.max(0,state.zoomExtra);
    render();
  });

  el('resetCorrBtn').addEventListener('click', ()=>{
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    ['bright','sat','cont','sharp'].forEach(id=>el(id).value=100);
    render();
  });

  el('resetAllBtn').addEventListener('click', ()=>{
    state.img=null; state.imgAngle=0;
    state.baseScale=1; state.zoomExtra=0; state.offx=0; state.offy=0;
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    state.text1=""; state.text2=""; state.showGrid=true;
    ['zoomExtra','offx','offy','bright','sat','cont','sharp'].forEach(id=>el(id).value=(id==='zoomExtra'?0:(id==='offx'||id==='offy'?0:100)));
    el('text1').value=""; el('text2').value=""; el('showGrid').checked=true;
    render();
  });

  el('checkBtn').addEventListener('click', ()=>{ preload().then(render); });

  el('fullscreenBtn').addEventListener('click', ()=>{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
  });

  // Gesty mysz
  let dragging=false, sx=0, sy=0, bx=0, by=0;
  c.addEventListener('mousedown', e=>{ dragging=true; sx=e.offsetX; sy=e.offsetY; bx=state.offx; by=state.offy; });
  window.addEventListener('mouseup', ()=> dragging=false);
  c.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const scaleX=W/c.clientWidth, scaleY=H/c.clientHeight;
    state.offx=Math.round(bx+(e.offsetX-sx)*scaleX);
    state.offy=Math.round(by+(e.offsetY-sy)*scaleY);
    el('offx').value=state.offx; el('offy').value=state.offy;
    render();
  });
  c.addEventListener('wheel', e=>{
    e.preventDefault();
    state.zoomExtra=Math.max(0,Math.min(200,state.zoomExtra + (e.deltaY<0?5:-5)));
    el('zoomExtra').value=state.zoomExtra; render();
  }, {passive:false});

  // Gesty dotyk – blokada scrolla, pan + pinch
  let touchDragging=false, startX=0,startY=0,baseOffX=0,baseOffY=0;
  let pinching=false, startDist=0, baseZoomExtra=0;
  function dist(t1,t2){ return Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY); }

  c.addEventListener('touchstart', e=>{
    e.preventDefault();
    if(e.touches.length===1){
      touchDragging=true; pinching=false;
      startX=e.touches[0].clientX; startY=e.touches[0].clientY;
      baseOffX=state.offx; baseOffY=state.offy;
    }else if(e.touches.length===2){
      pinching=true; touchDragging=false;
      startDist=dist(e.touches[0],e.touches[1]);
      baseZoomExtra=state.zoomExtra;
    }
  }, {passive:false});

  c.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(touchDragging && e.touches.length===1){
      const dx=e.touches[0].clientX-startX, dy=e.touches[0].clientY-startY;
      const scaleX=W/c.clientWidth, scaleY=H/c.clientHeight;
      state.offx=Math.round(baseOffX+dx*scaleX);
      state.offy=Math.round(baseOffY+dy*scaleY);
      el('offx').value=state.offx; el('offy').value=state.offy;
      render();
    }else if(pinching && e.touches.length===2){
      const d=dist(e.touches[0],e.touches[1]);
      const ratio=d/Math.max(1,startDist);
      state.zoomExtra=Math.max(0,Math.min(200,Math.round(baseZoomExtra+(ratio-1)*100)));
      el('zoomExtra').value=state.zoomExtra;
      render();
    }
  }, {passive:false});

  c.addEventListener('touchend', e=>{ e.preventDefault(); if(e.touches.length===0){ touchDragging=false; pinching=false; } }, {passive:false});

  // PWA install
  setupInstallButton();
}

// PWA install (Android/desktop prompt + iOS alert)
let deferredPrompt=null;
function setupInstallButton(){
  const btn=el('installBtn');
  btn.style.display=''; // zawsze widoczny na dole

  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt=e;
  });

  btn.addEventListener('click', async ()=>{
    if(deferredPrompt){
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt=null;
    }else if(isIOS){
      alert('Na iPhonie: Udostępnij → Dodaj do ekranu początkowego');
    }else{
      alert('Jeśli przeglądarka wspiera instalację PWA, pokaże się monit przy następnej wizycie.');
    }
  });
}

// start
preload().then(bindUI);

// SW
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./service-worker.js'));
}

function fitCanvasToViewport(){
  const preview = document.querySelector('.preview');
  const pad = 24; // margines bezpieczeństwa
  const availW = preview.clientWidth - pad;
  const headerH = document.querySelector('header').offsetHeight;
  const footerH = document.querySelector('footer').offsetHeight;
  const availH = window.innerHeight - headerH - footerH - pad;

  const scale = Math.min(availW / W, availH / H, 1); // nigdy > 1 (bez powiększania)
  c.style.width  = (W * scale) + 'px';
  c.style.height = (H * scale) + 'px';
}

window.addEventListener('resize', fitCanvasToViewport);
window.addEventListener('orientationchange', fitCanvasToViewport);
// po preload/bindUI na końcu pliku:
fitCanvasToViewport();


