// --- Canvas i stałe ---
const W = 1081, H = 1447;
const c = document.getElementById("c");
const ctx = c.getContext("2d");
const loaderOverlay = document.getElementById("loaderOverlay");

// --- Fonty / interlinia ---
const FONT1_PX = 60;
const FONT2_PX = 30;
const FONT3_PX = 25;
const LH1 = Math.round(FONT1_PX * 1.05);
const LH2 = Math.round(FONT2_PX * 1.15);
const LH3 = Math.round(FONT3_PX * 1.15);

// --- Parametr layoutu + nagłówek ---
const params = new URLSearchParams(location.search);
const LAYOUT = (params.get('layout') || 'D').toUpperCase();
const layoutTitle = document.getElementById('layoutTitle');
layoutTitle.textContent = (LAYOUT === 'M')
  ? 'Generator z małym zdjęciem'
  : 'Generator z dużym zdjęciem';
if (LAYOUT === 'M') document.getElementById('smallTextRow').style.display = '';

const el = id => document.getElementById(id);
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

// --- Stan aplikacji ---
const state = {
  ramka:null, nakladka:null, napis:null,
  img:null, imgAngle:0,
  baseScale:1, zoomExtra:0, offx:0, offy:0,
  bright:100, sat:100, cont:100, sharp:100,
  bgColor:'#FF0000',
  text1:"", text2:"", text3:"", showGrid:true,
  maskBBox:{x:0,y:0,w:W,h:H}, _renderForExport:false
};

// --- Helpers ---
function hideLoader(){
  if (loaderOverlay) loaderOverlay.style.display = 'none';
}

function loadImage(src){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>res(i);
    i.onerror=rej;
    i.src=src;
  });
}

function computeMaskBBox(maskImg){
  const off=document.createElement('canvas');
  off.width=W; off.height=H;
  const octx=off.getContext('2d');
  octx.drawImage(maskImg,0,0,W,H);
  const img=octx.getImageData(0,0,W,H), d=img.data;
  let minx=W, miny=H, maxx=-1, maxy=-1;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const a=d[(y*W+x)*4+3];
      if(a>10){
        if(x<minx)minx=x;
        if(x>maxx)maxx=x;
        if(y<miny)miny=y;
        if(y>maxy)maxy=y;
      }
    }
  }
  if(maxx<minx) return {x:0,y:0,w:W,h:H};
  return {x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1};
}

function applySharpen(srcCanvas, amountPct){
  const amount=Math.max(0,Math.min(2,amountPct/100));
  if(amount===1) return srcCanvas;
  const w=srcCanvas.width,h=srcCanvas.height,sctx=srcCanvas.getContext('2d');
  const src=sctx.getImageData(0,0,w,h), dst=sctx.createImageData(w,h);
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
  const ang=state.imgAngle%4;
  const iw=(ang%2===0)?img.width:img.height;
  const ih=(ang%2===0)?img.height:img.width;
  const {w:mw,h:mh}=state.maskBBox;
  // zawsze min. wypełnienie ramki (bez pustych pól)
  return Math.max(mw/iw, mh/ih);
}

// --- Zawijanie tekstu ---
function wrapParagraph(ctx, text, maxWidth){
  const t=(text||'').trim();
  if(!t) return [];
  const words=t.split(/\s+/);
  const lines=[];
  let line='';
  for(const w of words){
    const test=line ? (line+' '+w) : w;
    if(ctx.measureText(test).width <= maxWidth){
      line=test;
    }else{
      if(line) lines.push(line);
      line=w;
    }
  }
  if(line) lines.push(line);
  return lines;
}

function wrapTextPreserveBreaks(ctx, text, maxWidth){
  if(!text) return [];
  const paras=String(text).split('\n');
  const out=[];
  for(const p of paras){
    const lines=wrapParagraph(ctx,p,maxWidth);
    if(lines.length===0) out.push('');
    else out.push(...lines);
  }
  return out;
}

// --- Render ---
function render(){
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0,0,W,H);

  // zdjęcie + maska
  if(state.img && state.ramka){
    const off=document.createElement('canvas');
    off.width=W; off.height=H;
    const octx=off.getContext('2d');
    octx.filter=`brightness(${state.bright/100}) saturate(${state.sat/100}) contrast(${state.cont/100})`;

    const scale = state.baseScale * (1 + state.zoomExtra/100);
    const ang = state.imgAngle % 4;
    const cx = state.maskBBox.x + state.maskBBox.w/2 + state.offx;
    const cy = state.maskBBox.y + state.maskBBox.h/2 + state.offy;

    octx.save();
    octx.translate(cx,cy);
    octx.rotate(ang*Math.PI/2);
    const srcW=(ang%2===0)?state.img.width:state.img.height;
    const srcH=(ang%2===0)?state.img.height:state.img.width;
    octx.drawImage(state.img, -srcW*scale/2, -srcH*scale/2, srcW*scale, srcH*scale);
    octx.restore();

    octx.globalCompositeOperation='destination-in';
    octx.drawImage(state.ramka,0,0,W,H);
    const sharpened=(state.sharp===100)?off:applySharpen(off,state.sharp);
    ctx.drawImage(sharpened,0,0);
  }

  // PNG warstwy
  if(state.nakladka) ctx.drawImage(state.nakladka,0,0,W,H);
  if(state.napis)    ctx.drawImage(state.napis,0,0,W,H);

  // Teksty
  ctx.fillStyle="#fff";
  ctx.textAlign="left";
  ctx.textBaseline="alphabetic";

  // DUŻY – TT Travels
  const useF1=document.fonts.check(`${FONT1_PX}px "TT-Travels-Next-DemiBold"`);
  ctx.font=`${FONT1_PX}px ${useF1?'"TT-Travels-Next-DemiBold"':'Arial'}, sans-serif`;
  const left1=70, maxWidth1=W-left1*2;
  const lines1=wrapTextPreserveBreaks(ctx,(state.text1||'').toUpperCase(),maxWidth1);
  for(let i=0;i<lines1.length;i++){
    const y=(LAYOUT==='D'?1154:189) - i*LH1;
    ctx.fillText(lines1[lines1.length-1-i],left1,y);
  }

  // MAŁY – TT Commons
  const useF2=document.fonts.check(`${FONT2_PX}px "TT-Commons-Medium"`);
  ctx.font=`${FONT2_PX}px ${useF2?'"TT-Commons-Medium"':'Arial'}, sans-serif`;
  const left2=75, maxWidth2=W-left2*2;
  const lines2=wrapTextPreserveBreaks(ctx,state.text2||'',maxWidth2);
  for(let i=0;i<lines2.length;i++){
    const y=(LAYOUT==='D'?1201:236) + i*LH2;
    ctx.fillText(lines2[i],left2,y);
  }

  // MNIEJSZY – tylko M
  if(LAYOUT==='M'){
    const useF3=document.fonts.check(`${FONT3_PX}px "TT-Commons-Medium"`);
    ctx.font=`${FONT3_PX}px ${useF3?'"TT-Commons-Medium"':'Arial'}, sans-serif`;
    const left3=75, maxWidth3=570-left3;
    const lines3=wrapTextPreserveBreaks(ctx,state.text3||'',maxWidth3);
    for(let i=0;i<lines3.length;i++){
      const y=366 + i*LH3;
      ctx.fillText(lines3[i],left3,y);
    }
  }

  // Siatka tylko podgląd
  if(state.showGrid && !state._renderForExport){
    ctx.strokeStyle="rgba(255,255,255,.5)";
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(W/3,0); ctx.lineTo(W/3,H);
    ctx.moveTo(2*W/3,0); ctx.lineTo(2*W/3,H);
    ctx.moveTo(0,H/3);   ctx.lineTo(W,H/3);
    ctx.moveTo(0,2*H/3); ctx.lineTo(W,2*H/3);
    ctx.stroke();
  }
}

// --- Preload zasobów (blokuje loader tylko do realnego końca) ---
async function preload(){
  try{
    const base='pliki/', p=LAYOUT+'_';
    const [ramka,nakladka,napis] = await Promise.all([
      loadImage(base+p+'ramka.png'),
      loadImage(base+p+'nakladka.png'),
      loadImage(base+p+'napis.png'),
    ]);

    state.ramka=ramka;
    state.nakladka=nakladka;
    state.napis=napis;
    state.maskBBox=computeMaskBBox(ramka);

    el('status').textContent='Zasoby OK. Wczytaj zdjęcie.';
    render();

    // fonty łapiemy w tle (nie blokują)
    document.fonts.load(`${FONT1_PX}px "TT-Travels-Next-DemiBold"`).then(()=>render()).catch(()=>{});
    document.fonts.load(`${FONT2_PX}px "TT-Commons-Medium"`).then(()=>render()).catch(()=>{});

    hideLoader();
  }catch(e){
    el('status').textContent='Błąd ładowania zasobów: '+e;
    // zdejmij loader, żeby nie blokować
    hideLoader();
  }
}

// --- Zapis JPG ---
function saveJPG(){
  state._renderForExport=true;
  render();
  state._renderForExport=false;

  const base=(el('outname').value||'wynik').replace(/[^a-zA-Z0-9_.-]/g,'_');
  c.toBlob(blob=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`${base}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
    render();
  }, 'image/jpeg', 0.9);
}

// --- BG toggle ---
function updateBgButtons(){
  const red = el('bgRed');
  const black = el('bgBlack');
  red.classList.remove('selected');
  black.classList.remove('selected');
  if (state.bgColor === '#FF0000') red.classList.add('selected');
  else black.classList.add('selected');
}

// --- UI & gesty ---
function bindUI(){
  // file
  el('photoBtn').addEventListener('click', ()=> el('photoInput').click());
  el('photoInput').addEventListener('change', e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    const img=new Image();
    img.onload=()=>{
      state.img=img;
      state.imgAngle=0;
      state.baseScale=computeBaseScaleForImage(img);
      state.zoomExtra=0; el('zoomExtra').value=0;
      state.offx=0; state.offy=0;
      el('offx').value=0; el('offy').value=0;
      URL.revokeObjectURL(url);
      render();
    };
    img.src=url;
  });

  // tło
  el('bgRed').addEventListener('click',()=>{
    state.bgColor='#FF0000'; updateBgButtons(); render();
  });
  el('bgBlack').addEventListener('click',()=>{
    state.bgColor='#000000'; updateBgButtons(); render();
  });

  // suwaki
  el('zoomExtra').addEventListener('input', e=>{ state.zoomExtra=+e.target.value; render(); });
  ['offx','offy','bright','sat','cont','sharp'].forEach(id=>{
    el(id).addEventListener('input', e=>{ state[id]=+e.target.value; render(); });
  });

  // teksty
  el('text1').addEventListener('input', e=>{ state.text1=e.target.value; render(); });
  el('text2').addEventListener('input', e=>{ state.text2=e.target.value; render(); });
  if(LAYOUT==='M') el('text3').addEventListener('input', e=>{ state.text3=e.target.value; render(); });
  el('showGrid').addEventListener('change', e=>{ state.showGrid=e.target.checked; render(); });

  // przyciski
  el('saveJpgBtn').addEventListener('click', saveJPG);

  el('autoFitBtn').addEventListener('click', ()=>{
    if(!state.img) return;
    state.baseScale=computeBaseScaleForImage(state.img);
    state.zoomExtra=0; el('zoomExtra').value=0;
    state.offx=0; state.offy=0;
    el('offx').value=0; el('offy').value=0;
    render();
  });

  el('rotateBtn').addEventListener('click', ()=>{
    if(!state.img) return;
    state.imgAngle=(state.imgAngle+1)%4;
    state.baseScale=computeBaseScaleForImage(state.img);
    render();
  });

  el('resetCorrBtn').addEventListener('click', ()=>{
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    ['bright','sat','cont','sharp'].forEach(id=>el(id).value=100);
    render();
  });

  el('resetAllBtn').addEventListener('click', ()=>{
    state.img=null; state.imgAngle=0; state.baseScale=1;
    state.zoomExtra=0; state.offx=0; state.offy=0;
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    state.text1=""; state.text2=""; state.text3="";
    state.showGrid=true; state.bgColor='#FF0000';
    ['zoomExtra','offx','offy','bright','sat','cont','sharp'].forEach(id=>{
      el(id).value=(id==='zoomExtra'||id==='offx'||id==='offy')?0:100;
    });
    el('text1').value=""; el('text2').value=""; if(LAYOUT==='M') el('text3').value="";
    el('showGrid').checked=true;
    updateBgButtons();
    render();
  });

  el('checkBtn').addEventListener('click', ()=>{ preload().then(render); });

  el('fullscreenBtn').addEventListener('click', ()=>{
    if(!document.fullscreenElement)
      document.documentElement.requestFullscreen().catch(console.error);
    else
      document.exitFullscreen();
  });

  // drag mysz
  let dragging=false, sx=0, sy=0, bx=0, by=0;
  c.addEventListener('mousedown', e=>{
    dragging=true; sx=e.offsetX; sy=e.offsetY; bx=state.offx; by=state.offy;
  });
  window.addEventListener('mouseup', ()=> dragging=false);
  c.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const scaleX=W/c.clientWidth, scaleY=H/c.clientHeight;
    state.offx=Math.round(bx+(e.offsetX-sx)*scaleX);
    state.offy=Math.round(by+(e.offsetY-sy)*scaleY);
    el('offx').value=state.offx;
    el('offy').value=state.offy;
    render();
  });

  // scroll = zoom
  c.addEventListener('wheel', e=>{
    e.preventDefault();
    state.zoomExtra=Math.max(0,Math.min(200,state.zoomExtra+(e.deltaY<0?5:-5)));
    el('zoomExtra').value=state.zoomExtra;
    render();
  }, {passive:false});

  // dotyk
  let touchDragging=false,startX=0,startY=0,baseOffX=0,baseOffY=0;
  let pinching=false,startDist=0,baseZoomExtra=0;
  function dist(t1,t2){ return Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY); }

  c.addEventListener('touchstart', e=>{
    e.preventDefault();
    if(e.touches.length===1){
      touchDragging=true; pinching=false;
      startX=e.touches[0].clientX;
      startY=e.touches[0].clientY;
      baseOffX=state.offx;
      baseOffY=state.offy;
    }else if(e.touches.length===2){
      pinching=true; touchDragging=false;
      startDist=dist(e.touches[0],e.touches[1]);
      baseZoomExtra=state.zoomExtra;
    }
  }, {passive:false});

  c.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(touchDragging && e.touches.length===1){
      const dx=e.touches[0].clientX-startX;
      const dy=e.touches[0].clientY-startY;
      const scaleX=W/c.clientWidth, scaleY=H/c.clientHeight;
      state.offx=Math.round(baseOffX+dx*scaleX);
      state.offy=Math.round(baseOffY+dy*scaleY);
      el('offx').value=state.offx;
      el('offy').value=state.offy;
      render();
    }else if(pinching && e.touches.length===2){
      const d=dist(e.touches[0],e.touches[1]);
      const ratio=d/Math.max(1,startDist);
      state.zoomExtra=Math.max(0,Math.min(200,Math.round(baseZoomExtra+(ratio-1)*100)));
      el('zoomExtra').value=state.zoomExtra;
      render();
    }
  }, {passive:false});

  c.addEventListener('touchend', e=>{
    e.preventDefault();
    if(e.touches.length===0){ touchDragging=false; pinching=false; }
  }, {passive:false});

  updateBgButtons();
}

// --- Canvas fit (stałe proporcje, .canvas-wrap) ---
function fitCanvasToViewport(){
  const wrap=document.querySelector('.canvas-wrap');
  if(!wrap) return;
  const preview=document.querySelector('.preview');
  const pad=16;

  const availW=preview.clientWidth - pad;
  const headerH=document.querySelector('header').offsetHeight;
  const footerH=document.querySelector('footer').offsetHeight;
  const availH=window.innerHeight - headerH - footerH - pad;

  const ratio=H/W;
  const targetW=Math.min(availW, availH/ratio);
  const targetH=targetW*ratio;

  wrap.style.width = targetW+'px';
  wrap.style.height= targetH+'px';
}

window.addEventListener('resize', fitCanvasToViewport);
window.addEventListener('orientationchange', fitCanvasToViewport);

// --- Start ---
preload().then(()=>{
  bindUI();
  fitCanvasToViewport();
  setupInstallButton();
});

// --- PWA install ---
let deferredPrompt=null;
function setupInstallButton(){
  const btn=el('installBtn');
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt=e;
  });
  btn.addEventListener('click', async ()=>{
    if(deferredPrompt){
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt=null;
    } else if(isIOS){
      alert('Na iPhonie: Udostępnij → Dodaj do ekranu początkowego');
    }
  });
}

// --- Service Worker ---
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./service-worker.js'));
}
