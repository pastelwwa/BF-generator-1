// BF Generator (PWA) — Canvas 1081x1447
const W = 1081, H = 1447;

// ELEMENTY UI
const el = (id)=>document.getElementById(id);
const c = el('c'); const ctx = c.getContext('2d');

const state = {
  // obraz i warstwy
  img: null, tlo: null, mask: null, nakladka: null, logo: null,
  // dopasowanie
  zoom: 100, offx: 0, offy: 0,
  // korekcje
  bright: 100, sat: 100, cont: 100, sharp: 100,
  // tekst
  text1: "", text2: "",
  showGrid: true
};

function loadImage(src){
  return new Promise((res, rej)=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function preload(){
  try{
    // zasoby
    const base = 'pliki/';
    [state.tlo, state.mask, state.nakladka, state.logo] = await Promise.all([
      loadImage(base+'tlo.png'),
      loadImage(base+'fotoramka.png'),
      loadImage(base+'nakladka.png'),
      loadImage(base+'logo.png'),
    ]);
    el('status').textContent = 'Zasoby OK. Wczytaj zdjęcie i kliknij Podgląd.';
  }catch(e){
    el('status').textContent = 'Błąd ładowania zasobów: ' + e;
  }
}

function drawGrid(){
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W/3,0); ctx.lineTo(W/3,H);
  ctx.moveTo(2*W/3,0); ctx.lineTo(2*W/3,H);
  ctx.moveTo(0,H/3); ctx.lineTo(W,H/3);
  ctx.moveTo(0,2*H/3); ctx.lineTo(W,2*H/3);
  ctx.stroke();
  ctx.restore();
}

function applySharpen(srcCanvas, amountPct){
  // prosta konwolucja (kernel sharpen); amount 0–200%
  const amount = Math.max(0, Math.min(2, amountPct/100));
  if(amount === 1) return srcCanvas; // 100% = standardowy kernel
  const w = srcCanvas.width, h = srcCanvas.height;
  const sctx = srcCanvas.getContext('2d');
  const src = sctx.getImageData(0,0,w,h);
  const dst = sctx.createImageData(w,h);
  // kernel bazowy
  const k = [
     0,        -1*amount, 0,
    -1*amount,  1+4*amount, -1*amount,
     0,        -1*amount, 0
  ];
  const {data:sd} = src, dd = dst.data;
  const row = w*4;
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      for(let ch=0; ch<3; ch++){
        let acc=0, idx=(y*w+x)*4 + ch;
        acc += sd[idx - row - 4]*k[0];
        acc += sd[idx - row    ]*k[1];
        acc += sd[idx - row + 4]*k[2];
        acc += sd[idx - 4     ]*k[3];
        acc += sd[idx         ]*k[4];
        acc += sd[idx + 4     ]*k[5];
        acc += sd[idx + row - 4]*k[6];
        acc += sd[idx + row    ]*k[7];
        acc += sd[idx + row + 4]*k[8];
        dd[idx] = Math.max(0, Math.min(255, acc));
      }
      dd[(y*w+x)*4 + 3] = sd[(y*w+x)*4 + 3]; // alfa
    }
  }
  sctx.putImageData(dst,0,0);
  return srcCanvas;
}

function render(){
  if(!state.tlo){ return; }

  // 1) tło
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(state.tlo, 0,0, W,H);

  // 2) warstwa zdjęcia z maską w offscreen canvas
  if(state.img && state.mask){
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d');

    // korekcje (Canvas 2D filter — Safari wspiera)
    const b = state.bright/100, s = state.sat/100, co = state.cont/100;
    octx.filter = `brightness(${b}) saturate(${s}) contrast(${co})`;

    // rysuj zdjęcie z transformacją (zoom i przesunięcie względem środka maski)
    const scale = state.zoom/100;
    octx.save();
    // środek całego pola = środek canvasu (maskę mamy tej samej wielkości co cały plik)
    const cx = W/2 + state.offx;
    const cy = H/2 + state.offy;
    const iw = state.img.width * scale;
    const ih = state.img.height * scale;
    octx.drawImage(state.img, cx - iw/2, cy - ih/2, iw, ih);
    octx.restore();

    // przycięcie do maski (destination-in)
    octx.save();
    octx.globalCompositeOperation = 'destination-in';
    octx.drawImage(state.mask, 0,0, W,H);
    octx.restore();

    // ostrość (konwolucja) – jeśli != 100
    const sharpened = (state.sharp===100) ? off : applySharpen(off, state.sharp);

    // wklej na główny
    ctx.drawImage(sharpened, 0,0);
  }

  // 3) nakładka i logo
  if(state.nakladka) ctx.drawImage(state.nakladka, 0,0, W,H);
  if(state.logo)     ctx.drawImage(state.logo,     0,0, W,H);

  // 4) teksty
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const FONT1_PX = 60;  // ~60 pt
  const FONT2_PX = 30;  // ~30 pt
  ctx.font = `${FONT1_PX}px "TT-Travels-DemiBold", Arial, sans-serif`;

  // duży tekst – linie w górę od y=1109
  const lines1 = (state.text1 || '').toUpperCase().split('\n');
  const lh1 = Math.round(FONT1_PX * 1.0);
  for(let i=0;i<lines1.length;i++){
    const line = lines1[lines1.length-1-i]; // od dołu
    const y = 1109 - i*lh1;
    ctx.fillText(line, 70, y);
  }

  // mały tekst – linie w dół od y=1185
  ctx.font = `${FONT2_PX}px "TT-Commons-Medium", Arial, sans-serif`;
  const lines2 = (state.text2 || '').split('\n');
  const lh2 = Math.round(FONT2_PX * 1.1);
  for(let i=0;i<lines2.length;i++){
    const y = 1185 + i*lh2;
    ctx.fillText(lines2[i], 75, y);
  }

  // 5) siatka podglądu (tylko UI)
  if(state.showGrid) drawGrid();
}

function readPhoto(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=fr.result; };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// ZDARZENIA UI
function bindUI(){
  el('photoInput').addEventListener('change', async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    state.img = await readPhoto(f);
    render();
  });

  const bindRange = (id, key)=> el(id).addEventListener('input', e=>{ state[key]=Number(e.target.value); render(); });
  bindRange('zoom','zoom'); bindRange('offx','offx'); bindRange('offy','offy');
  bindRange('bright','bright'); bindRange('sat','sat'); bindRange('cont','cont'); bindRange('sharp','sharp');

  el('text1').addEventListener('input', e=>{ state.text1 = e.target.value; render(); });
  el('text2').addEventListener('input', e=>{ state.text2 = e.target.value; render(); });
  el('showGrid').addEventListener('change', e=>{ state.showGrid = e.target.checked; render(); });

  el('autoFitBtn').addEventListener('click', ()=>{
    state.zoom=100; state.offx=0; state.offy=0;
    el('zoom').value=100; el('offx').value=0; el('offy').value=0;
    render();
  });

  el('resetCorrBtn').addEventListener('click', ()=>{
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    ['bright','sat','cont','sharp'].forEach(id=>el(id).value=100);
    render();
  });

  el('resetAllBtn').addEventListener('click', ()=>{
    state.zoom=100; state.offx=0; state.offy=0;
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    state.text1=""; state.text2="";
    ['zoom','offx','offy','bright','sat','cont','sharp'].forEach(id=>el(id).value= (id==='zoom'?100:0));
    el('bright').value=el('sat').value=el('cont').value=el('sharp').value=100;
    el('text1').value=""; el('text2').value="";
    render();
  });

  el('renderBtn').addEventListener('click', render);

  el('saveBtn').addEventListener('click', ()=>{
    const name = (el('outname').value || 'wynik.png').replace(/[^a-zA-Z0-9_.-]/g,'_');
    c.toBlob((blob)=>{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  });

  el('checkBtn').addEventListener('click', ()=>{
    const ok = !!(state.tlo && state.mask && state.nakladka && state.logo);
    el('status').textContent = ok ? 'Zasoby OK.' : 'Brakuje zasobów w folderze pliki/';
  });

  // PROSTE PAN/ZOOM MYSZKĄ
  let dragging=false, sx=0, sy=0, bx=0, by=0;
  c.addEventListener('mousedown', (e)=>{ dragging=true; sx=e.offsetX; sy=e.offsetY; bx=state.offx; by=state.offy; });
  window.addEventListener('mouseup', ()=> dragging=false);
  c.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const dx = (e.offsetX - sx) * (W / c.clientWidth);
    const dy = (e.offsetY - sy) * (H / c.clientHeight);
    state.offx = Math.round(bx + dx);
    state.offy = Math.round(by + dy);
    el('offx').value = state.offx; el('offy').value = state.offy;
    render();
  });
  c.addEventListener('wheel', (e)=>{
    e.preventDefault();
    state.zoom = Math.max(50, Math.min(300, state.zoom + (e.deltaY<0? 5 : -5)));
    el('zoom').value = state.zoom;
    render();
  }, {passive:false});
}

async function preload(){
  try {
    const base = 'pliki/';
    [state.tlo, state.mask, state.nakladka, state.logo] = await Promise.all([
      loadImage(base+'tlo.png'),
      loadImage(base+'fotoramka.png'),
      loadImage(base+'nakladka.png'),
      loadImage(base+'logo.png'),
    ]);

    // ▼ tu dodajemy ładowanie fontów
    const f1 = document.fonts.load('60px "TT Travels Next DemiBold"');
    const f2 = document.fonts.load('30px "TT Commons Medium"');
    await Promise.all([f1, f2, document.fonts.ready]);

    el('status').textContent = 'Zasoby OK. Wczytaj zdjęcie i kliknij Podgląd.';
  } catch(e) {
    el('status').textContent = 'Błąd ładowania zasobów: ' + e;
  }
}





