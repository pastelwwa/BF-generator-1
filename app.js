const c = document.getElementById("c");
const ctx = c.getContext("2d");

const FONT1_PX = 60;  // duży
const FONT2_PX = 30;  // mały
const LH1 = Math.round(FONT1_PX * 1.1);
const LH2 = Math.round(FONT2_PX * 1.2);

let state = {
  img: null,
  zoom: 100,
  offx: 0,
  offy: 0,
  bright: 100,
  sat: 100,
  cont: 100,
  sharp: 100,
  text1: "",
  text2: "",
  showGrid: true,
};

function el(id){ return document.getElementById(id); }
function loadImage(src){
  return new Promise((res,rej)=>{
    const i = new Image();
    i.onload=()=>res(i);
    i.onerror=rej;
    i.src=src;
  });
}

// preload zasobów
async function preload(){
  try {
    const base = "pliki/";
    [state.tlo, state.mask, state.nakladka, state.logo] = await Promise.all([
      loadImage(base+"tlo.png"),
      loadImage(base+"fotoramka.png"),
      loadImage(base+"nakladka.png"),
      loadImage(base+"logo.png"),
    ]);

    // fonty
    const f1 = document.fonts.load(`${FONT1_PX}px "TT-Travels-Next-DemiBold"`);
    const f2 = document.fonts.load(`${FONT2_PX}px "TT-Commons-Medium"`);
    await Promise.all([f1, f2, document.fonts.ready]);

    el("status").textContent = "Zasoby OK. Wczytaj zdjęcie i kliknij Podgląd.";
  } catch(e){
    el("status").textContent = "Błąd ładowania zasobów: "+e;
  }
}

// render
function render(){
  ctx.clearRect(0,0,c.width,c.height);

  ctx.drawImage(state.tlo,0,0);

  if(state.img){
    ctx.save();
    ctx.translate(c.width/2 + state.offx, c.height/2 + state.offy);
    const scale = state.zoom/100;
    ctx.scale(scale,scale);

    // korekcje
    ctx.filter = `brightness(${state.bright}%) contrast(${state.cont}%) saturate(${state.sat}%)`;
    ctx.drawImage(state.img, -state.img.width/2, -state.img.height/2);

    ctx.restore();
  }

  ctx.drawImage(state.nakladka,0,0);
  ctx.drawImage(state.logo,0,0);

  ctx.fillStyle="white";
  ctx.textBaseline="bottom";

  // duży tekst
  ctx.font = `${FONT1_PX}px "TT-Travels-Next-DemiBold", Arial, sans-serif`;
  const lines1 = (state.text1||"").toUpperCase().split("\n");
  for(let i=0;i<lines1.length;i++){
    const line = lines1[lines1.length-1-i];
    const y = 1154 - i*LH1;
    ctx.fillText(line, 70, y);
  }

  // mały tekst
  ctx.font = `${FONT2_PX}px "TT-Commons-Medium", Arial, sans-serif`;
  const lines2 = (state.text2||"").split("\n");
  for(let i=0;i<lines2.length;i++){
    const y = 1201 + i*LH2;
    ctx.fillText(lines2[i], 75, y);
  }

  // siatka
  if(state.showGrid){
    ctx.strokeStyle="rgba(255,255,255,0.3)";
    ctx.lineWidth=1;
    for(let i=1;i<3;i++){
      ctx.beginPath();
      ctx.moveTo((c.width/3)*i,0);
      ctx.lineTo((c.width/3)*i,c.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0,(c.height/3)*i);
      ctx.lineTo(c.width,(c.height/3)*i);
      ctx.stroke();
    }
  }
}

// save
function saveImage(type){
  const nameBase = (el("outname").value || "wynik").replace(/[^a-zA-Z0-9_.-]/g,"_");
  const ext = type==="png" ? "png" : "jpg";
  const mime = type==="png" ? "image/png" : "image/jpeg";
  c.toBlob((blob)=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nameBase}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, mime, (type==="jpg"?0.9:undefined));
}

// bind
function bindUI(){
  el("photoInput").addEventListener("change",e=>{
    const file = e.target.files[0];
    if(file){
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload=()=>{
        state.img=img;
        render();
        URL.revokeObjectURL(url);
      };
      img.src=url;
    }
  });

  ["zoom","offx","offy","bright","sat","cont","sharp"].forEach(id=>{
    el(id).addEventListener("input", e=>{
      state[id]=+e.target.value;
      render();
    });
  });

  el("text1").addEventListener("input",e=>{ state.text1=e.target.value; render(); });
  el("text2").addEventListener("input",e=>{ state.text2=e.target.value; render(); });
  el("showGrid").addEventListener("change",e=>{ state.showGrid=e.target.checked; render(); });

  el("renderBtn").addEventListener("click",render);
  el("savePngBtn").addEventListener("click",()=> saveImage("png"));
  el("saveJpgBtn").addEventListener("click",()=> saveImage("jpg"));

  el("autoFitBtn").addEventListener("click",()=>{
    state.zoom=100; state.offx=0; state.offy=0;
    el("zoom").value=100; el("offx").value=0; el("offy").value=0;
    render();
  });

  el("rotateBtn").addEventListener("click",()=>{
    if(!state.img) return;
    const off = document.createElement("canvas");
    off.width=state.img.height;
    off.height=state.img.width;
    const octx=off.getContext("2d");
    octx.translate(off.width/2,off.height/2);
    octx.rotate(Math.PI/2);
    octx.drawImage(state.img,-state.img.width/2,-state.img.height/2);
    const rotated = new Image();
    rotated.onload=()=>{ state.img=rotated; render(); };
    rotated.src=off.toDataURL();
  });

  el("resetCorrBtn").addEventListener("click",()=>{
    state.zoom=100; state.offx=0; state.offy=0;
    state.bright=100; state.sat=100; state.cont=100; state.sharp=100;
    ["zoom","offx","offy","bright","sat","cont","sharp"].forEach(id=> el(id).value=state[id]);
    render();
  });

  el("resetAllBtn").addEventListener("click",()=>{
    state={...state,img:null,zoom:100,offx:0,offy:0,bright:100,sat:100,cont:100,sharp:100,text1:"",text2:"",showGrid:true};
    ["zoom","offx","offy","bright","sat","cont","sharp"].forEach(id=> el(id).value=state[id]);
    el("text1").value=""; el("text2").value=""; el("showGrid").checked=true;
    render();
  });

  el("fullscreenBtn").addEventListener("click",()=>{
    if(!document.fullscreenElement){
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  });

  el("checkBtn").addEventListener("click",()=> preload().then(render));
}

// gesty dotykowe
let dragging=false, lastX=0,lastY=0;
c.addEventListener("mousedown",e=>{dragging=true; lastX=e.clientX; lastY=e.clientY;});
window.addEventListener("mouseup",()=>dragging=false);
window.addEventListener("mousemove",e=>{
  if(dragging){
    state.offx += e.clientX-lastX;
    state.offy += e.clientY-lastY;
    lastX=e.clientX; lastY=e.clientY;
    render();
  }
});

// dotyk
c.addEventListener("touchstart",e=>{
  if(e.touches.length===1){
    dragging=true;
    lastX=e.touches[0].clientX;
    lastY=e.touches[0].clientY;
  }
},{passive:false});

c.addEventListener("touchmove",e=>{
  e.preventDefault(); // blokada scrolla
  if(e.touches.length===1 && dragging){
    state.offx += e.touches[0].clientX-lastX;
    state.offy += e.touches[0].clientY-lastY;
    lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    render();
  } else if(e.touches.length===2){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    const dist=Math.hypot(dx,dy);
    if(state.lastDist){
      const dz=(dist-state.lastDist)/2;
      state.zoom=Math.min(300,Math.max(50,state.zoom+dz));
      el("zoom").value=state.zoom;
      render();
    }
    state.lastDist=dist;
  }
},{passive:false});

c.addEventListener("touchend",()=>{dragging=false; state.lastDist=null;});

preload().then(bindUI);
