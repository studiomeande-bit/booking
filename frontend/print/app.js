"use strict";
const MM = 96/25.4, NS="http://www.w3.org/2000/svg";
const ERP_BASE = "https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec"; // 호스팅 시 ERP 직결 기본 URL
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
const PAPERS = {
  "A4 (210×297)":[210,297],"A3 (297×420)":[297,420],"A3+ (329×483)":[329,483],"A5 (148×210)":[148,210],"A6 (105×148)":[105,148],
  "엽서 (100×148)":[100,148],"L판 (89×127)":[89,127],"2L (127×178)":[127,178],
  "KG·4×6\" (102×152)":[102,152],"5×7\" (127×178)":[127,178],"8×10\" (203×254)":[203,254],
  "정사각 (210×210)":[210,210],"정사각 (150×150)":[150,150],
  "Letter (216×279)":[216,279],"사용자 지정…":"custom"
};
// 국가별 여권/증명 규격 + 얼굴 가이드(참고용). head=턱~정수리 mm, tol=허용오차, top=상단여백, eyeFromBottom=바닥→눈높이
const ID_PRESETS = {
  "EU·독일·솅겐 여권 (35×45)":{w:35,h:45,guide:{top:4,head:34,tol:2}},
  "한국 여권 (35×45)":{w:35,h:45,guide:{top:4,head:34,tol:2}},
  "미국 US (51×51)":{w:51,h:51,guide:{head:30,tol:5,eyeFromBottom:31.5,eyeTol:3.5}},
  "일본 Japan (35×45)":{w:35,h:45,guide:{top:4,head:34,tol:2}},
  "네덜란드 NL (35×45)":{w:35,h:45,guide:{top:6,head:28,tol:2}},
  "인도 India (51×51)":{w:51,h:51,guide:{head:30,tol:5,eyeFromBottom:31.5,eyeTol:3.5}},
  "영국 UK (35×45)":{w:35,h:45,guide:{top:4,head:31.5,tol:2.5}},
  "중국 China (33×48)":{w:33,h:48,guide:{top:5,head:30.5,tol:2.5}},
  "캐나다 Canada (50×70)":{w:50,h:70,guide:{top:8,head:33.5,tol:2.5}},
  "반명함 (30×40)":{w:30,h:40,guide:null},
  "명함판 (50×70)":{w:50,h:70,guide:null},
  "사용자 지정":{w:35,h:45,guide:null}
};
const STD_SIZES = {"포토카드 55×85 (ET-18100 갱)":[55,85],"10×15 (KG)":[100,150],"13×18":[130,180],"9×13":[90,130],"15×21":[150,210],"엽서 (105×148)":[105,148]};

/* ---------- 콜라주 프리셋 (에디토리얼·필름·아기자기, 클래식) ---------- */
/* slots: [x,y,w,h,rot] — 전체 페이지 대비 0~1 비율. 색톤은 필름/소프트 등 클래식 룩. */
function gridSlots(cols,rows,inset,gap){const s=[],w=(1-2*inset-(cols-1)*gap)/cols,h=(1-2*inset-(rows-1)*gap)/rows;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)s.push([inset+c*(w+gap),inset+r*(h+gap),w,h,0]);return s;}
const CTONE={ film:{contrast:93,sat:88,warm:14,bright:103}, soft:{bright:104,sat:94,warm:8,contrast:96}, warm:{warm:12,sat:97,bright:102,contrast:97} };
/* 손글씨·세리프·산세리프·타자기 — 전부 Mac/시스템 설치 폰트 폴백(웹폰트 X, CSP 안전) */
/* 번들 폰트 12종 카탈로그 — 그룹·라벨·CSS 스택 */
const FONTS_DEF={
  pen:{label:"펜 손글씨 (한글)",group:"손글씨",stack:'"sm-pen","Nanum Pen Script",cursive'},
  gaegu:{label:"개구 손글씨 (한글)",group:"손글씨",stack:'"sm-gaegu",cursive'},
  caveat:{label:"Caveat (영문)",group:"손글씨",stack:'"sm-caveat",cursive'},
  amatic:{label:"Amatic SC (영문)",group:"손글씨",stack:'"sm-amatic",sans-serif'},
  sacramento:{label:"Sacramento (영·웨딩)",group:"손글씨",stack:'"sm-sacramento",cursive'},
  myeongjo:{label:"나눔명조 (한글)",group:"세리프",stack:'"sm-myeongjo",serif'},
  songmyung:{label:"송명 (한글)",group:"세리프",stack:'"sm-songmyung",serif'},
  playfair:{label:"Playfair (영문)",group:"세리프",stack:'"sm-playfair",Georgia,serif'},
  dodum:{label:"고운돋움 (한글)",group:"산세리프",stack:'"sm-dodum","Noto Sans KR",sans-serif'},
  jua:{label:"주아 (한글·둥근)",group:"산세리프",stack:'"sm-jua",sans-serif'},
  bebas:{label:"Bebas Neue (영문)",group:"산세리프",stack:'"sm-bebas",sans-serif'},
  elite:{label:"Special Elite (타자기)",group:"타자기",stack:'"sm-elite",monospace'},
  bodoni:{label:"Bodoni (에디토리얼)",group:"에디토리얼",stack:'"sm-bodoni","Didot",Georgia,serif'},
  fraunces:{label:"Fraunces (에디토리얼)",group:"에디토리얼",stack:'"sm-fraunces",Georgia,serif'},
  abril:{label:"Abril Fatface (헤드라인)",group:"에디토리얼",stack:'"sm-abril",Georgia,serif'},
  dmserif:{label:"DM Serif (에디토리얼)",group:"에디토리얼",stack:'"sm-dmserif",Georgia,serif'},
  gowun:{label:"고운바탕 (한글)",group:"세리프",stack:'"sm-gowun","Nanum Myeongjo",serif'},
  archivo:{label:"Archivo (산세)",group:"산세리프",stack:'"sm-archivo",sans-serif'},
  jost:{label:"Jost (지오메트릭)",group:"산세리프",stack:'"sm-jost",sans-serif'},
  blackhan:{label:"검은고딕 (한글 임팩트)",group:"산세리프",stack:'"sm-blackhan",sans-serif'}
};
const FONT_ALIAS={hand:"pen",serif:"myeongjo",sans:"dodum",type:"elite"};
const FONT_STACK=Object.fromEntries(Object.entries(FONTS_DEF).map(([k,v])=>[k,v.stack]));
Object.entries(FONT_ALIAS).forEach(([a,k])=>{FONT_STACK[a]=FONTS_DEF[k].stack;}); // 레거시 호환
const FONT_LABEL=Object.fromEntries(Object.entries(FONTS_DEF).map(([k,v])=>[k,v.label]));

/* ============================================================ 손맛 데코 엔진 (hand-craft) */
/* 손그림 낙서 — viewBox 100. fill형=칠, stroke형=선(둥근 끝, 손그림 느낌) */
const DOODLES={
  star:{fill:1, path:"M50 6 L61 38 L95 38 L68 59 L78 93 L50 72 L22 93 L32 59 L5 38 L39 38 Z"},
  sparkle:{fill:1, path:"M50 7 C55 40 60 45 93 50 C60 55 55 60 50 93 C45 60 40 55 7 50 C40 45 45 40 50 7 Z"},
  heart:{fill:1, path:"M50 87 C13 60 9 35 28 24 C41 16 50 27 50 35 C50 27 59 16 72 24 C91 35 87 60 50 87 Z"},
  dot:{fill:1, path:"M50 16 a34 34 0 1 0 0.1 0 Z"},
  arrow:{stroke:1, w:6, path:"M10 36 C36 22 56 42 84 52 M84 52 L67 49 M84 52 L73 37"},
  squiggle:{stroke:1, w:6, path:"M6 52 C8 34 28 34 30 52 C32 70 12 70 18 50 C24 34 44 34 46 52 C48 70 66 70 70 52 C74 36 92 40 94 52"},
  spiral:{stroke:1, w:5, path:"M58 50 C58 45 50 45 50 50 C50 59 65 59 65 47 C65 32 44 32 42 50 C40 73 71 75 78 46"},
  scribble:{stroke:1, w:4, path:"M20 52 C16 24 86 22 86 50 C86 78 20 82 14 55 C10 37 34 28 62 28 C86 28 92 44 84 58"},
  check:{stroke:1, w:9, path:"M15 54 L39 79 L88 20"},
  cross:{stroke:1, w:7, path:"M28 28 L72 72 M72 28 L28 72"},
  underline:{stroke:1, w:5, path:"M6 40 C30 32 70 32 96 44"},
  rule:{stroke:1, w:3, path:"M1 50 L99 50"}
};
function doodleSVG(type,color){const d=DOODLES[type];if(!d)return"";
  const c=color||"#333";
  const inner=d.fill?`<path d="${d.path}" fill="${c}"/>`:`<path d="${d.path}" fill="none" stroke="${c}" stroke-width="${d.w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">${inner}</svg>`;}
/* 테이프 — 워시(반투명 파스텔) / 가퍼(불투명 검정), 끝이 살짝 찢긴 사각 */
function tapeSVG(kind,color){
  if(kind==="gaffer") return `<svg viewBox="0 0 100 34" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><polygon points="2,5 98,2 97,32 3,29" fill="${color||'#1d1d1d'}" opacity="0.9"/></svg>`;
  return `<svg viewBox="0 0 100 34" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><polygon points="4,3 96,1 98,33 2,31" fill="${color||'#dcccae'}" opacity="0.5"/><line x1="7" y1="11" x2="93" y2="9" stroke="#fff" stroke-width="1.4" opacity="0.35"/><line x1="7" y1="24" x2="93" y2="22" stroke="#000" stroke-width="1" opacity="0.06"/></svg>`;}
/* 종이 질감 — feTurbulence 그레인(data-uri), bg색 위에 곱하기 오버레이 */
const TEXTURES={ paper:{f:0.9,o:2,op:0.2}, kraft:{f:0.75,o:3,op:0.32}, grain:{f:1.5,o:2,op:0.16}, linen:{f:0.5,o:2,op:0.22} };
function textureURI(t){const c=TEXTURES[t];if(!c)return"";
  const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='${c.f}' numOctaves='${c.o}' stitchTiles='stitch'/><feColorMatrix type='luminanceToAlpha'/></filter><rect width='180' height='180' filter='url(#f)'/></svg>`;
  return "data:image/svg+xml;utf8,"+encodeURIComponent(svg);}
function decoAR(type){ return type&&type.indexOf("tape")===0 ? 0.34 : 1; } // 테이프는 납작
function renderTexture(){ if(!state.texture||state.texture==="none")return;
  const c=TEXTURES[state.texture]; if(!c)return;
  const ov=document.createElement("div"); ov.className="texture-ov";
  ov.style.backgroundImage=`url("${textureURI(state.texture)}")`; ov.style.backgroundSize="55mm 55mm";
  ov.style.opacity=c.op; page.appendChild(ov); }
function renderDecos(){ state.decos.forEach(d=>{
  const el=document.createElement("div"); el.className="deco"+(state.selDeco===d.id?" sel":""); el.dataset.did=d.id;
  const ar=d.ar!=null?d.ar:decoAR(d.type);
  el.style.left=d.x+"mm"; el.style.top=d.y+"mm"; el.style.width=d.size+"mm"; el.style.height=(d.size*ar)+"mm";
  el.style.transform=`rotate(${d.rot||0}deg)`; el.style.opacity=(d.opacity==null?100:d.opacity)/100;
  el.innerHTML = d.type.indexOf("tape")===0 ? tapeSVG(d.type==="tape-gaffer"?"gaffer":"washi", d.color) : doodleSVG(d.type, d.color||"#333");
  el.addEventListener("pointerdown",e=>startDecoMove(e,d));
  if(state.selDeco===d.id){
    const rz=document.createElement("div");rz.className="deco-h rz";rz.addEventListener("pointerdown",e=>startDecoResize(e,d));el.appendChild(rz);
    const ro=document.createElement("div");ro.className="deco-h ro";ro.addEventListener("pointerdown",e=>startDecoRotate(e,d));el.appendChild(ro);
  }
  page.appendChild(el); }); }
function decoEl(id){return page.querySelector('.deco[data-did="'+id+'"]');}
function decoArv(d){return d.ar!=null?d.ar:decoAR(d.type);}
function selectDeco(id){state.selDeco=id;state.sel=null;state.selText=null;render();}
function startDecoMove(e,d){e.stopPropagation();
  if(state.selDeco!==d.id){state.selDeco=d.id;state.sel=null;state.selText=null;render();}
  const st=ptMm(e),ix=d.x,iy=d.y;
  const mv=ev=>{const p=ptMm(ev);let nx=ix+p.x-st.x, ny=iy+p.y-st.y;
    if((d.rot||0)%360===0){const arv=decoArv(d);const sn=snapBox(nx,ny,d.size,d.size*arv,null);nx=sn.x;ny=sn.y;} else overlay.querySelectorAll(".snapline").forEach(n=>n.remove());
    d.x=Math.round(nx*10)/10;d.y=Math.round(ny*10)/10;const el=decoEl(d.id);if(el){el.style.left=d.x+"mm";el.style.top=d.y+"mm";}};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);overlay.querySelectorAll(".snapline").forEach(n=>n.remove());syncDecoInputs(d);scheduleHistory();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);}
function startDecoResize(e,d){e.stopPropagation();const arv=decoArv(d);const cx=d.x+d.size/2,cy=d.y+d.size*arv/2;
  const mv=ev=>{const p=ptMm(ev);let[lx,ly]=rotv(p.x-cx,p.y-cy,-(d.rot||0));const ns=Math.max(4,Math.round(Math.max(Math.abs(lx)*2,Math.abs(ly)*2/arv)));
    d.size=ns;d.x=Math.round((cx-ns/2)*10)/10;d.y=Math.round((cy-ns*arv/2)*10)/10;
    const el=decoEl(d.id);if(el){el.style.width=d.size+"mm";el.style.height=(d.size*arv)+"mm";el.style.left=d.x+"mm";el.style.top=d.y+"mm";}};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);syncDecoInputs(d);scheduleHistory();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);}
function startDecoRotate(e,d){e.stopPropagation();const arv=decoArv(d);const cx=d.x+d.size/2,cy=d.y+d.size*arv/2;
  const mv=ev=>{const p=ptMm(ev);let a=Math.atan2(p.y-cy,p.x-cx)*180/Math.PI+90;if(ev.shiftKey)a=Math.round(a/15)*15;d.rot=Math.round(a);const el=decoEl(d.id);if(el)el.style.transform=`rotate(${d.rot}deg)`;};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);syncDecoInputs(d);scheduleHistory();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);}
function syncDecoInputs(d){if($("#dc_size"))$("#dc_size").value=Math.round(d.size);if($("#dc_rot"))$("#dc_rot").value=d.rot||0;if($("#dc_rotV"))$("#dc_rotV").textContent=d.rot||0;}
function addDeco(type){const [pw,ph]=paperMm();const isTape=type.indexOf("tape")===0;const isRule=type==="rule";
  const d={id:uid++,type,x:Math.round(pw*(isRule?0.3:0.42)),y:Math.round(ph*0.44),size:isRule?Math.round(pw*0.4):isTape?Math.round(pw*0.18):Math.round(pw*0.09),ar:isRule?0.012:null,rot:isTape?-8:0,color:type==="tape-gaffer"?"#1d1d1d":(isTape?"#d9cba8":(isRule?"#1a1a1a":"#333333")),opacity:100};
  state.decos.push(d);state.selDeco=d.id;state.sel=null;state.selText=null;render();}
const DECO_LABEL={"tape-washi":"워시 테이프","tape-gaffer":"검정 테이프",star:"별",sparkle:"반짝이",heart:"하트",dot:"점",arrow:"화살표",squiggle:"물결",spiral:"스프링",scribble:"동그라미",check:"체크",cross:"엑스",underline:"밑줄",rule:"라인"};
function renderDecoProps(d){
  propsMount.innerHTML=`<div class="props"><header>꾸미기 · ${DECO_LABEL[d.type]||"요소"}</header><div class="body">
    <div class="hint" style="padding:0 0 6px">드래그=이동 · 모서리 손잡이=크기 · 위 손잡이=회전</div>
    <label class="f">크기 mm</label><input type="number" id="dc_size" value="${Math.round(d.size)}" min="4" step="1">
    <label class="f">회전 <b id="dc_rotV" style="color:var(--ink)">${d.rot||0}</b>°</label><input type="range" class="slider" id="dc_rot" min="-180" max="180" value="${d.rot||0}">
    <label class="f">불투명 <b id="dc_opV" style="color:var(--ink)">${d.opacity==null?100:d.opacity}</b>%</label><input type="range" class="slider" id="dc_op" min="10" max="100" value="${d.opacity==null?100:d.opacity}">
    <label class="f">색</label><input type="color" id="dc_color" value="${d.color||'#333333'}" style="width:100%;height:30px;padding:2px;border:1px solid var(--line);border-radius:7px;background:var(--panel);cursor:pointer">
    <div class="row" style="margin-top:9px"><button class="btn sm" id="dc_dup" style="flex:1">복제</button><button class="btn sm" id="dc_del" style="flex:1;color:#c0392b">삭제</button></div>
  </div></div>`;
  $("#dc_size").addEventListener("input",()=>{d.size=Math.max(4,+$("#dc_size").value||10);const el=decoEl(d.id);if(el){el.style.width=d.size+"mm";el.style.height=(d.size*decoArv(d))+"mm";}scheduleHistory();});
  $("#dc_rot").addEventListener("input",()=>{d.rot=+$("#dc_rot").value;$("#dc_rotV").textContent=d.rot;const el=decoEl(d.id);if(el)el.style.transform=`rotate(${d.rot}deg)`;scheduleHistory();});
  $("#dc_op").addEventListener("input",()=>{d.opacity=+$("#dc_op").value;$("#dc_opV").textContent=d.opacity;const el=decoEl(d.id);if(el)el.style.opacity=d.opacity/100;scheduleHistory();});
  $("#dc_color").addEventListener("input",()=>{d.color=$("#dc_color").value;render();});
  $("#dc_dup").addEventListener("click",()=>{const n={...d,id:uid++,x:d.x+6,y:d.y+6};state.decos.push(n);state.selDeco=n.id;render();});
  $("#dc_del").addEventListener("click",()=>{state.decos=state.decos.filter(x=>x.id!==d.id);state.selDeco=null;render();});
}
/* 손그림 스케치 프레임 SVG(삐뚤한 사각, 모서리 오버슛) */
function sketchFrameSVG(color){const c=color||"#2a2a2a";
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M4 6 C30 3 72 5 97 3 M96 4 C98 30 97 70 98 96 M97 97 C70 99 28 97 3 98 M4 97 C2 68 4 30 3 5" fill="none" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/></svg>`;}

/* 레퍼런스(프리셋 예시 20장) 분석 기반 10종 — slots:[x,y,w,h,rot,("c"=원형)] 정규화 좌표, texts 좌표도 정규화 */
const COLLAGE_PRESETS=[
  {"key":"magazine-cover","name":"매거진 커버","cat":"에디토리얼","orient":"portrait","bg":"#f1ece2","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.1,"y":0.22,"w":0.8,"h":0.6,"rot":0}],"texts":[{"x":0.5,"y":0.045,"text":"MEAN","font":"abril","size":23,"color":"#1b1712","align":"center"},{"x":0.5,"y":0.175,"text":"SPRING EDITORIAL","font":"archivo","size":3.4,"color":"#6d6456","align":"center","tracking":0.42},{"x":0.5,"y":0.87,"text":"봄, 스튜디오의 기록","font":"gowun","size":5,"color":"#2f2b24","align":"center","tracking":0.12},{"x":0.5,"y":0.93,"text":"STUDIO MEAN — OBERURSEL · No.03","font":"archivo","size":2.9,"color":"#8a8173","align":"center","tracking":0.34}],"decos":[{"type":"rule","x":0.34,"y":0.905,"size":0.32,"ar":0.008,"rot":0,"color":"#b9b0a0"}]},
  {"key":"index-editorial","name":"인덱스 (매거진 목차)","cat":"에디토리얼","orient":"portrait","bg":"#12100c","tone":"film","texture":"grain","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.06,"y":0.2,"w":0.42,"h":0.28,"rot":0},{"x":0.52,"y":0.2,"w":0.42,"h":0.135,"rot":0},{"x":0.52,"y":0.345,"w":0.42,"h":0.135,"rot":0},{"x":0.06,"y":0.5,"w":0.278,"h":0.2,"rot":0},{"x":0.361,"y":0.5,"w":0.278,"h":0.2,"rot":0},{"x":0.662,"y":0.5,"w":0.278,"h":0.2,"rot":0},{"x":0.06,"y":0.72,"w":0.278,"h":0.18,"rot":0},{"x":0.361,"y":0.72,"w":0.278,"h":0.18,"rot":0},{"x":0.662,"y":0.72,"w":0.278,"h":0.18,"rot":0}],"texts":[{"x":0.06,"y":0.05,"text":"The Index","font":"fraunces","size":15,"color":"#f1ece1","align":"left"},{"x":0.06,"y":0.145,"text":"CONTENTS — SPRING 2026","font":"archivo","size":3.2,"color":"#b0a794","align":"left","tracking":0.4},{"x":0.94,"y":0.07,"text":"No.03","font":"bodoni","size":6,"color":"#e7e0d2","align":"right"},{"x":0.94,"y":0.95,"text":"STUDIO MEAN","font":"archivo","size":2.9,"color":"#9c9482","align":"right","tracking":0.4}],"decos":[{"type":"rule","x":0.06,"y":0.125,"size":0.88,"ar":0.008,"rot":0,"color":"#4a4437"}]},
  {"key":"cinema-bw","name":"시네마 풀블리드","cat":"에디토리얼","orient":"portrait","bg":"#0d0d0d","tone":"film","texture":"none","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0,"y":0,"w":1,"h":1,"rot":0}],"texts":[{"x":0.06,"y":0.055,"text":"STUDIO MEAN","font":"archivo","size":3.2,"color":"#efe9dd","align":"left","tracking":0.4},{"x":0.94,"y":0.055,"text":"No.07","font":"archivo","size":3.2,"color":"#efe9dd","align":"right","tracking":0.3},{"x":0.06,"y":0.8,"text":"Untitled","font":"fraunces","size":15,"color":"#f4f0e6","align":"left"},{"x":0.06,"y":0.92,"text":"FILM — OBERURSEL, GERMANY","font":"archivo","size":3,"color":"#d8d2c6","align":"left","tracking":0.36}],"decos":[{"type":"rule","x":0.06,"y":0.905,"size":0.5,"ar":0.008,"rot":0,"color":"#efe9dd"}]},
  {"key":"editorial-hero","name":"히어로 + 위성","cat":"에디토리얼","orient":"portrait","bg":"#ece7dd","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.28,"y":0.24,"w":0.44,"h":0.46,"rot":0},{"x":0.06,"y":0.28,"w":0.18,"h":0.16,"rot":-4,"frame":"polaroid"},{"x":0.06,"y":0.52,"w":0.18,"h":0.16,"rot":5,"frame":"polaroid"},{"x":0.76,"y":0.3,"w":0.18,"h":0.16,"rot":4,"frame":"polaroid"},{"x":0.76,"y":0.54,"w":0.18,"h":0.16,"rot":-5,"frame":"polaroid"}],"texts":[{"x":0.5,"y":0.055,"text":"The Portrait","font":"fraunces","size":14,"color":"#221e18","align":"center"},{"x":0.5,"y":0.155,"text":"SPRING SERIES — No.03","font":"archivo","size":3.2,"color":"#6d6557","align":"center","tracking":0.4},{"x":0.5,"y":0.83,"text":"봄, 스튜디오의 기록","font":"gowun","size":5,"color":"#39332b","align":"center","tracking":0.1}],"decos":[{"type":"rule","x":0.35,"y":0.135,"size":0.3,"ar":0.008,"rot":0,"color":"#b7ae9d"}]},
  {"key":"lookbook","name":"룩북 (가로)","cat":"에디토리얼","orient":"landscape","bg":"#f4f0e7","tone":"soft","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.05,"y":0.1,"w":0.3,"h":0.8,"rot":0},{"x":0.37,"y":0.1,"w":0.3,"h":0.8,"rot":0}],"texts":[{"x":0.7,"y":0.12,"text":"Spring\nLookbook","font":"bodoni","size":14,"color":"#201c16","align":"left"},{"x":0.7,"y":0.42,"text":"STUDIO MEAN — VOL.03","font":"archivo","size":3,"color":"#6d6456","align":"left","tracking":0.38},{"x":0.7,"y":0.52,"text":"화보처럼, 매거진처럼.\n스튜디오 민의 봄 컬렉션.","font":"gowun","size":3.6,"color":"#463f34","align":"left","tracking":0.06},{"x":0.955,"y":0.92,"text":"2026","font":"bodoni","size":5,"color":"#8a8173","align":"right"}],"decos":[{"type":"rule","x":0.7,"y":0.485,"size":0.25,"ar":0.008,"rot":0,"color":"#bcb3a2"}]},
  {"key":"zine-film","name":"필름 진 (손글씨)","cat":"필름","orient":"portrait","bg":"#f4f0e6","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.24,"y":0.3,"w":0.42,"h":0.44,"rot":0,"frame":"sketch"}],"texts":[{"x":0.03,"y":0.02,"text":"JASH","font":"pen","size":2.8,"color":"#3a3a3a","align":"left"},{"x":0.1,"y":0.07,"text":"PEOPLE JUST NEED TO\nSETTLE DOWN\nSETTLE DOWN","font":"pen","size":5,"color":"#2b2b2b","align":"left"},{"x":0.55,"y":0.37,"text":"WAIT! I HAVE SOMETHING\nTO SAY TO PEOPLE\nWHO ARE STRUGGLING x2","font":"pen","size":3.8,"color":"#2b2b2b","align":"left"},{"x":0.1,"y":0.86,"text":"I'M THE ONE\nWHO TURNED THE\nSWITCH ON","font":"pen","size":4.4,"color":"#2b2b2b","align":"left"},{"x":0.62,"y":0.86,"text":"WE HAVE TO\nSWITCH IT OFF\nSOMETIMES,","font":"pen","size":4.4,"color":"#2b2b2b","align":"left"}],"decos":[{"type":"scribble","x":0.535,"y":0.355,"size":0.13,"rot":-4,"color":"#2b2b2b"},{"type":"squiggle","x":0.85,"y":0.24,"size":0.045,"rot":0,"color":"#2b2b2b"},{"type":"squiggle","x":0.06,"y":0.52,"size":0.045,"rot":20,"color":"#2b2b2b"}]},
  {"key":"polaroid-grid","name":"폴라로이드 그리드","cat":"필름","orient":"portrait","bg":"#f2f1ec","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.06,"y":0.18,"w":0.26,"h":0.23,"rot":-3,"frame":"polaroid"},{"x":0.37,"y":0.17,"w":0.26,"h":0.23,"rot":2,"frame":"polaroid"},{"x":0.68,"y":0.18,"w":0.26,"h":0.23,"rot":-2,"frame":"polaroid"},{"x":0.06,"y":0.45,"w":0.26,"h":0.23,"rot":3,"frame":"polaroid"},{"x":0.37,"y":0.46,"w":0.26,"h":0.23,"rot":-2,"frame":"polaroid"},{"x":0.68,"y":0.45,"w":0.26,"h":0.23,"rot":4,"frame":"polaroid"},{"x":0.06,"y":0.72,"w":0.26,"h":0.23,"rot":-3,"frame":"polaroid"},{"x":0.37,"y":0.73,"w":0.26,"h":0.23,"rot":3,"frame":"polaroid"},{"x":0.68,"y":0.72,"w":0.26,"h":0.23,"rot":-4,"frame":"polaroid"}],"texts":[{"x":0.06,"y":0.055,"text":"Cute Moments","font":"caveat","size":8.5,"color":"#222","align":"left"},{"x":0.94,"y":0.075,"text":"SUMMER — 50 DAYS","font":"archivo","size":3,"color":"#8a8378","align":"right","tracking":0.34},{"x":0.5,"y":0.965,"text":"STUDIO MEAN","font":"archivo","size":2.7,"color":"#9a9388","align":"center","tracking":0.4}],"decos":[{"type":"tape-washi","x":0.09,"y":0.16,"size":0.1,"rot":-42,"color":"#cdbf9e"},{"type":"tape-gaffer","x":0.66,"y":0.925,"size":0.08,"rot":18},{"type":"star","x":0.31,"y":0.15,"size":0.05,"rot":0,"color":"#d94b3a"},{"type":"heart","x":0.5,"y":0.62,"size":0.04,"rot":0,"color":"#d0473a"}]},
  {"key":"diagonal-stack","name":"대각 폴라로이드 3컷","cat":"필름","orient":"portrait","bg":"#f6f2ea","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.05,"y":0.07,"w":0.5,"h":0.3,"rot":-5,"frame":"polaroid"},{"x":0.3,"y":0.36,"w":0.55,"h":0.32,"rot":4,"frame":"polaroid"},{"x":0.12,"y":0.66,"w":0.5,"h":0.3,"rot":-3,"frame":"polaroid"}],"texts":[{"x":0.72,"y":0.09,"text":"a day\nin film","font":"caveat","size":7,"color":"#2b2b2b","align":"left"},{"x":0.7,"y":0.9,"text":"ROLL 03","font":"archivo","size":3,"color":"#6b6459","align":"left","tracking":0.34}],"decos":[{"type":"heart","x":0.86,"y":0.42,"size":0.045,"color":"#d0473a"},{"type":"star","x":0.06,"y":0.55,"size":0.05,"color":"#e0a92e"}]},
  {"key":"couple-tape","name":"커플 · 폴라로이드 테이프","cat":"웨딩·커플","orient":"portrait","bg":"#efe9e0","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.4,"y":0.27,"w":0.5,"h":0.52,"rot":-5,"frame":"polaroid"}],"texts":[{"x":0.5,"y":0.055,"text":"OUR FIRST MONTH","font":"dmserif","size":6,"color":"#33302c","align":"center","tracking":0.14},{"x":0.05,"y":0.25,"text":"te amo\nsiempre","font":"sacramento","size":13,"color":"#8a2a22","align":"left"},{"x":0.055,"y":0.49,"text":"우리의 한 달,\n매일 더 사랑하고\n매일 더 행복하기를.","font":"gowun","size":3.8,"color":"#5a544b","align":"left","tracking":0.05},{"x":0.09,"y":0.63,"text":"04 . 06 . 2026","font":"pen","size":6,"color":"#8a2a22","align":"left"},{"x":0.5,"y":0.955,"text":"STUDIO MEAN · OBERURSEL","font":"archivo","size":2.7,"color":"#9a9184","align":"center","tracking":0.36}],"decos":[{"type":"tape-washi","x":0.4,"y":0.225,"size":0.17,"rot":-33,"color":"#d9cba8"},{"type":"scribble","x":0.035,"y":0.585,"size":0.4,"ar":0.3,"rot":-3,"color":"#8a2a22"}]},
  {"key":"couple-cinema","name":"커플 흑백 시네마 (가로)","cat":"웨딩·커플","orient":"landscape","bg":"#111","tone":"film","texture":"none","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.05,"y":0.1,"w":0.52,"h":0.8,"rot":0},{"x":0.6,"y":0.3,"w":0.34,"h":0.42,"rot":0}],"texts":[{"x":0.6,"y":0.1,"text":"Always,\nyou.","font":"fraunces","size":12,"color":"#f2efe7","align":"left"},{"x":0.6,"y":0.8,"text":"PREWEDDING — 2026","font":"archivo","size":3,"color":"#d8d2c6","align":"left","tracking":0.36},{"x":0.94,"y":0.9,"text":"studio mean","font":"sacramento","size":5,"color":"#e8e2d6","align":"right"}],"decos":[{"type":"rule","x":0.6,"y":0.78,"size":0.24,"ar":0.008,"rot":0,"color":"#e8e2d6"}]},
  {"key":"baby-pastel","name":"돌 · 파스텔 그리드","cat":"유아·성장","orient":"portrait","bg":"#f4d4d8","tone":"soft","texture":"none","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.1,"y":0.26,"w":0.25,"h":0.24,"rot":0},{"x":0.375,"y":0.26,"w":0.25,"h":0.24,"rot":0},{"x":0.65,"y":0.22,"w":0.27,"h":0.28,"rot":0},{"x":0.06,"y":0.54,"w":0.25,"h":0.24,"rot":0},{"x":0.335,"y":0.54,"w":0.25,"h":0.24,"rot":0},{"x":0.6,"y":0.57,"w":0.36,"h":0.3,"rot":0}],"texts":[{"x":0.5,"y":0.055,"text":"Seeun’s Day","font":"dmserif","size":14,"color":"#ffffff","align":"center"},{"x":0.5,"y":0.165,"text":"FIRST BIRTHDAY","font":"archivo","size":3.2,"color":"#ffffff","align":"center","tracking":0.42},{"x":0.5,"y":0.91,"text":"우리 아기 첫 생일을 축하합니다","font":"gowun","size":4,"color":"#ffffff","align":"center","tracking":0.08}],"decos":[]},
  {"key":"kids-kraft","name":"유아 크래프트 그리드","cat":"유아·성장","orient":"portrait","bg":"#e7dcc2","tone":"warm","texture":"kraft","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.09,"y":0.22,"w":0.24,"h":0.2,"rot":-2,"frame":"polaroid"},{"x":0.38,"y":0.21,"w":0.24,"h":0.2,"rot":2,"frame":"polaroid"},{"x":0.67,"y":0.22,"w":0.24,"h":0.2,"rot":-2,"frame":"polaroid"},{"x":0.09,"y":0.47,"w":0.24,"h":0.2,"rot":2,"frame":"polaroid"},{"x":0.38,"y":0.48,"w":0.24,"h":0.2,"rot":-2,"frame":"polaroid"},{"x":0.67,"y":0.47,"w":0.24,"h":0.2,"rot":3,"frame":"polaroid"},{"x":0.25,"y":0.72,"w":0.24,"h":0.2,"rot":-3,"frame":"polaroid"},{"x":0.52,"y":0.73,"w":0.24,"h":0.2,"rot":3,"frame":"polaroid"}],"texts":[{"x":0.5,"y":0.06,"text":"우리 아기 성장 일기","font":"jua","size":8.5,"color":"#7a5a2e","align":"center"},{"x":0.5,"y":0.94,"text":"STUDIO MEAN — GROWTH DIARY","font":"archivo","size":2.9,"color":"#8a744a","align":"center","tracking":0.3}],"decos":[{"type":"heart","x":0.15,"y":0.18,"size":0.035,"color":"#d07a6a"},{"type":"star","x":0.83,"y":0.68,"size":0.045,"color":"#e0a92e"}]},
  {"key":"circle-invite","name":"원형 안내장 (백일·돌)","cat":"유아·성장","orient":"portrait","bg":"#fdf7ef","tone":"soft","texture":"linen","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.28,"y":0.1,"w":0.44,"h":0.311,"rot":0,"shape":"circle"},{"x":0.1,"y":0.5,"w":0.24,"h":0.17,"rot":0,"shape":"circle"},{"x":0.66,"y":0.5,"w":0.24,"h":0.17,"rot":0,"shape":"circle"}],"texts":[{"x":0.5,"y":0.46,"text":"첫 번째 생일","font":"gowun","size":9,"color":"#a9743f","align":"center","tracking":0.06},{"x":0.5,"y":0.71,"text":"THE FIRST BIRTHDAY","font":"archivo","size":2.9,"color":"#b89168","align":"center","tracking":0.42},{"x":0.5,"y":0.78,"text":"우리 하람이 · 2026.08.15","font":"gowun","size":4.2,"color":"#6a5b4a","align":"center"}],"decos":[{"type":"sparkle","x":0.2,"y":0.12,"size":0.05,"color":"#d8a24a"},{"type":"sparkle","x":0.74,"y":0.16,"size":0.04,"color":"#d8a24a"},{"type":"rule","x":0.4,"y":0.69,"size":0.2,"ar":0.008,"rot":0,"color":"#d8b98a"}]},
  {"key":"scrapbook-kraft","name":"스크랩북 (극밀도)","cat":"스크랩북·여행","orient":"square","bg":"#e7d9b6","tone":"warm","texture":"kraft","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.04,"y":0.06,"w":0.26,"h":0.19,"rot":-4,"frame":"polaroid"},{"x":0.35,"y":0.05,"w":0.22,"h":0.17,"rot":5,"frame":"polaroid"},{"x":0.62,"y":0.07,"w":0.2,"h":0.24,"rot":-3,"frame":"polaroid"},{"x":0.1,"y":0.36,"w":0.34,"h":0.26,"rot":-2,"frame":"polaroid"},{"x":0.55,"y":0.38,"w":0.38,"h":0.26,"rot":3,"frame":"polaroid"},{"x":0.05,"y":0.68,"w":0.24,"h":0.24,"rot":4,"frame":"polaroid"},{"x":0.33,"y":0.7,"w":0.28,"h":0.24,"rot":-5,"frame":"polaroid"},{"x":0.66,"y":0.68,"w":0.26,"h":0.26,"rot":5,"frame":"polaroid"}],"texts":[{"x":0.06,"y":0.02,"text":"Progress ...","font":"pen","size":5,"color":"#3a3128","align":"left"},{"x":0.6,"y":0.02,"text":"BRANDON’s\nQUEST","font":"pen","size":4,"color":"#3a3128","align":"left"},{"x":0.44,"y":0.635,"text":"candid","font":"pen","size":5,"color":"#3a3128","align":"left"},{"x":0.7,"y":0.63,"text":"yumz!","font":"pen","size":5,"color":"#c0392b","align":"left"},{"x":0.05,"y":0.955,"text":"dual pov! ft. amelia","font":"pen","size":3.6,"color":"#3a3128","align":"left"}],"decos":[{"type":"squiggle","x":0.13,"y":0.03,"size":0.09,"rot":0,"color":"#3f6fb0"},{"type":"star","x":0.44,"y":0.34,"size":0.05,"color":"#e0a92e"},{"type":"sparkle","x":0.06,"y":0.55,"size":0.05,"color":"#e0a92e"},{"type":"heart","x":0.3,"y":0.33,"size":0.035,"color":"#d0473a"},{"type":"dot","x":0.52,"y":0.05,"size":0.028,"color":"#e0b23a"},{"type":"dot","x":0.86,"y":0.62,"size":0.03,"color":"#e07a3a"},{"type":"arrow","x":0.55,"y":0.1,"size":0.07,"rot":20,"color":"#2b2b2b"},{"type":"spiral","x":0.24,"y":0.65,"size":0.05,"color":"#3f6fb0"},{"type":"underline","x":0.7,"y":0.665,"size":0.09,"color":"#c0392b"}]},
  {"key":"filmstrip-travel","name":"필름스트립 여행 (가로)","cat":"스크랩북·여행","orient":"landscape","bg":"#e8dcc0","tone":"warm","texture":"kraft","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.04,"y":0.3,"w":0.21,"h":0.4,"rot":0,"frame":"film"},{"x":0.27,"y":0.3,"w":0.21,"h":0.4,"rot":0,"frame":"film"},{"x":0.5,"y":0.3,"w":0.21,"h":0.4,"rot":0,"frame":"film"},{"x":0.73,"y":0.3,"w":0.21,"h":0.4,"rot":0,"frame":"film"},{"x":0.6,"y":0.72,"w":0.24,"h":0.22,"rot":5,"frame":"polaroid"}],"texts":[{"x":0.04,"y":0.07,"text":"summer trip","font":"caveat","size":9,"color":"#3a3128","align":"left"},{"x":0.04,"y":0.2,"text":"EAST COAST — 12.19 KM","font":"archivo","size":3,"color":"#5a4e3a","align":"left","tracking":0.32}],"decos":[{"type":"arrow","x":0.3,"y":0.15,"size":0.08,"rot":15,"color":"#2b2b2b"},{"type":"star","x":0.9,"y":0.1,"size":0.05,"color":"#e0a92e"},{"type":"dot","x":0.52,"y":0.1,"size":0.03,"color":"#e07a3a"}]},
  {"key":"minimal-zine","name":"미니멀 필름 (여백)","cat":"미니멀·카드","orient":"portrait","bg":"#f2efe7","tone":"film","texture":"paper","frame":{"on":false,"w":0,"color":"#fff","radius":0},"slots":[{"x":0.3,"y":0.32,"w":0.4,"h":0.42,"rot":0,"frame":"sketch"}],"texts":[{"x":0.5,"y":0.13,"text":"A Quiet Day","font":"fraunces","size":9,"color":"#33302b","align":"center"},{"x":0.5,"y":0.84,"text":"STUDIO MEAN — 2026","font":"archivo","size":3,"color":"#7a7264","align":"center","tracking":0.4}],"decos":[{"type":"rule","x":0.4,"y":0.815,"size":0.2,"ar":0.008,"rot":0,"color":"#bcb3a2"}]}
];
const MEDIA = {
  "표준 (보정 없음)":"none",
  "고급 광택지 Glossy":"saturate(1.06) contrast(1.04)",
  "반광택 Luster/Satin":"saturate(1.03) contrast(1.02)",
  "무광지 Matte":"saturate(1.12) contrast(1.08) brightness(1.01)",
  "일반 용지 Plain":"saturate(1.15) contrast(1.10) brightness(1.02)",
  "프리미엄 인화지":"saturate(1.04) contrast(1.03)",
  // Epson 정품 용지 — 근사 보정 프리셋(진짜 색은 드라이버 ICC)
  "Epson 프리미엄 광택 (Premium Glossy)":"saturate(1.05) contrast(1.04)",
  "Epson 프리미엄 반광택 (Premium Semigloss)":"saturate(1.04) contrast(1.03)",
  "Epson 프리미엄 러스터 (Premium Luster)":"saturate(1.03) contrast(1.03)",
  "Epson 울트라 광택 (Ultra Premium Glossy)":"saturate(1.07) contrast(1.05)",
  "Epson 포토 광택 (Photo Paper Glossy)":"saturate(1.08) contrast(1.05) brightness(1.01)",
  "Epson 매트 헤비웨이트 (Matte Heavyweight)":"saturate(1.12) contrast(1.09) brightness(1.02)",
  "Epson 아카이벌 매트 (Archival Matte)":"saturate(1.13) contrast(1.10) brightness(1.02)",
  "Epson 벨벳 파인아트 (Velvet Fine Art)":"saturate(1.15) contrast(1.12) brightness(1.03)",
  "Epson 수채화지 (Watercolor Radiant White)":"saturate(1.16) contrast(1.12) brightness(1.03)",
  "Epson 메탈릭 광택 (Metallic Glossy)":"saturate(1.02) contrast(1.06)"
};
const MEDIA_GROUPS = {
  "기본":["표준 (보정 없음)","고급 광택지 Glossy","반광택 Luster/Satin","무광지 Matte","일반 용지 Plain","프리미엄 인화지"],
  "Epson 정품 용지 · 근사 프리셋":["Epson 프리미엄 광택 (Premium Glossy)","Epson 프리미엄 반광택 (Premium Semigloss)","Epson 프리미엄 러스터 (Premium Luster)","Epson 울트라 광택 (Ultra Premium Glossy)","Epson 포토 광택 (Photo Paper Glossy)","Epson 매트 헤비웨이트 (Matte Heavyweight)","Epson 아카이벌 매트 (Archival Matte)","Epson 벨벳 파인아트 (Velvet Fine Art)","Epson 수채화지 (Watercolor Radiant White)","Epson 메탈릭 광택 (Metallic Glossy)"]
};
// 각 Epson 용지 → 드라이버 Media Type 권장값(안내용)
const EPSON_DRIVER = {
  "Epson 프리미엄 광택 (Premium Glossy)":"Premium Glossy Photo Paper",
  "Epson 프리미엄 반광택 (Premium Semigloss)":"Premium Semigloss Photo Paper",
  "Epson 프리미엄 러스터 (Premium Luster)":"Premium Luster Photo Paper",
  "Epson 울트라 광택 (Ultra Premium Glossy)":"Ultra Premium Photo Paper Glossy",
  "Epson 포토 광택 (Photo Paper Glossy)":"Photo Paper Glossy",
  "Epson 매트 헤비웨이트 (Matte Heavyweight)":"Matte Paper Heavyweight",
  "Epson 아카이벌 매트 (Archival Matte)":"Archival/Ultra Premium Matte",
  "Epson 벨벳 파인아트 (Velvet Fine Art)":"Velvet Fine Art Paper",
  "Epson 수채화지 (Watercolor Radiant White)":"Watercolor Paper - Radiant White",
  "Epson 메탈릭 광택 (Metallic Glossy)":"Metallic Photo Paper Glossy"
};
const newAdj = () => ({bright:100,contrast:100,sat:100,warm:0,tint:0,mono:false,sepia:false,preset:"원본"});

const state = {
  paper:"A4 (210×297)", cw:210, ch:297, orient:"portrait",
  borderless:true, margin:5, bg:"#ffffff", media:"표준 (보정 없음)", dpi:300,
  mode:"free",
  library:[], items:[],
  fill:{ id:null, zoom:1, ox:50, oy:50, adj:newAdj() },
  id:{ srcId:null, cw:35, ch:45, gap:3, guides:true, autoMax:true, faceGuide:false, ox:50, oy:50, zoom:1, preset:"EU·독일·솅겐 여권 (35×45)", adj:newAdj() },
  grid:{ kind:"even", rows:2, cols:2, cw:100, ch:150, std:"10×15 (KG)", gap:3, guides:false, fit:"cover", adj:newAdj() },
  view:{ ruler:false, grid:false, step:10, snap:true },
  cal:{ offX:0, offY:0, scaleX:100, scaleY:100, rGain:100, gGain:100, bGain:100, gamma:100, sharpen:0, cropMarks:false },
  order:{ raw:"", lines:[], idx:0, sid:"", _card:false, cardSheet:"A4 (210×297)" },
  frame:{ on:false, w:3, color:"#ffffff", radius:0 },
  logo:{ on:false, type:"text", text:"Studio mean", src:"", anchor:"br", size:12, offX:6, offY:6, opacity:80, rotation:0, color:"#ffffff", bold:true },
  texts:[], selText:null,
  decos:[], selDeco:null, texture:"none",
  sel:null, scale:1, autoFit:true
};
let uid = 1;

const $ = s => document.querySelector(s);
const page=$("#page"), overlay=$("#overlay"), holder=$("#holder"), workspace=$("#workspace"), propsMount=$("#propsMount");

/* ---------- init selects ---------- */
(function(){
  const p=$("#paper"); Object.keys(PAPERS).forEach(k=>{const o=document.createElement("option");o.value=k;o.textContent=k;p.appendChild(o);}); p.value=state.paper;
  const m=$("#media"); Object.entries(MEDIA_GROUPS).forEach(([grp,items])=>{const og=document.createElement("optgroup");og.label=grp;items.forEach(k=>{const o=document.createElement("option");o.value=k;o.textContent=k;og.appendChild(o);});m.appendChild(og);}); m.value=state.media;
})();

/* ---------- geometry ---------- */
function idFitCount(pw,ph){const m=state.borderless?0:state.margin,uw=pw-2*m,uh=ph-2*m,cw=state.id.cw,ch=state.id.ch,g=state.id.gap;
  return Math.max(0,Math.floor((uw+g)/(cw+g)))*Math.max(0,Math.floor((uh+g)/(ch+g)));}
function idBestOrient(w,h){return idFitCount(h,w)>idFitCount(w,h)?"landscape":"portrait";}
function paperMm(){ let w,h; if(PAPERS[state.paper]==="custom"){w=state.cw;h=state.ch;} else {[w,h]=PAPERS[state.paper];}
  const o=(state.mode==="id"&&state.id.autoMax)?idBestOrient(w,h):state.orient;
  return o==="portrait"?[w,h]:[h,w]; }
function usableMm(){ const [w,h]=paperMm(); const m=state.borderless?0:state.margin; return {x:m,y:m,w:w-2*m,h:h-2*m}; }
/* 번들 예시 이미지(무료 Lorem Picsum/Unsplash) — 라이브러리 비었을 때 프리셋 미리보기용 */
const SAMPLES=Array.from({length:12},(_,i)=>({id:"sample-"+String(i+1).padStart(2,"0"),src:"samples/s"+String(i+1).padStart(2,"0")+".jpg",w:640,h:800,sample:true}));
function imgById(id){ return state.library.find(i=>i.id===id) || SAMPLES.find(s=>s.id===id); }
function SPP(){ return MM*state.scale; }

/* ---------- color: temp/tint SVG filter + full filter string ---------- */
function ensureTT(key,adj){
  const defs=$("#ttdefs defs"); let f=document.getElementById("tt-"+key);
  if(!f){ f=document.createElementNS(NS,"filter"); f.id="tt-"+key; f.setAttribute("color-interpolation-filters","sRGB");
    const mx=document.createElementNS(NS,"feColorMatrix"); mx.setAttribute("type","matrix"); f.appendChild(mx); defs.appendChild(f); }
  const w=adj.warm/100, t=adj.tint/100;
  const Rr=1+(w>0?w*0.35:w*0.15), Bb=1-(w>0?w*0.30:w*0.12), Gg=1-t*0.18;
  f.firstChild.setAttribute("values",`${Rr} 0 0 0 0  0 ${Gg} 0 0 0  0 0 ${Bb} 0 0  0 0 0 1 0`);
}
function toneFilter(adj,key){
  let f=`brightness(${adj.bright/100}) contrast(${adj.contrast/100}) saturate(${adj.mono?1:adj.sat/100})`;
  if(adj.mono) f+=" grayscale(1)";
  if(adj.sepia) f+=" sepia(0.55)";
  if(adj.warm||adj.tint){ ensureTT(key,adj); f+=` url(#tt-${key})`; }
  return f;
}

/* ---------- output DPI (effective resolution) ---------- */
function effDPI(sw,sh,wmm,hmm,fit){const Win=wmm/25.4,Hin=hmm/25.4;if(!Win||!Hin||!sw)return 0;
  if(fit==="contain")return Math.round(Math.min(sw/Win,sh/Hin));
  const cropW=Math.min(sw,sh*(wmm/hmm));return Math.round(cropW/Win);}
function dpiBadge(d,t){const c=d>=t?"ok":(d>=t*0.7?"warn":"bad");return `<span class="dpi-badge ${c}">${d?d+" DPI":"—"}</span>`;}
function dpiLineFor(rec,wmm,hmm,fit){if(!rec)return "";const d=effDPI(rec.w,rec.h,wmm,hmm,fit);
  return `<div class="dpi-line">출력 해상도 ${dpiBadge(d,state.dpi)} <span class="dpi-sub">원본 ${rec.w}×${rec.h}px</span></div>`;}
function gridCellMm(){const u=usableMm(),G=state.grid,g=G.gap;return G.kind==="even"?[(u.w-(G.cols-1)*g)/G.cols,(u.h-(G.rows-1)*g)/G.rows]:[G.cw,G.ch];}
function minLibRec(){return state.library.reduce((m,r)=>(!m||r.w*r.h<m.w*m.h)?r:m,null);}
function isDefaultAdj(a){return a.bright===100&&a.contrast===100&&a.sat===100&&a.warm===0&&a.tint===0&&!a.mono&&!a.sepia;}
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
/* 색보정을 원본 해상도 이미지에 구워넣기 → 인쇄 시 필터 없이 풀해상도 출력 */
function unsharp(c,w,h,amount){ // 3x3 라플라시안 언샤프
  const a=amount/100*0.9; if(a<=0)return;
  const src=c.getImageData(0,0,w,h),d=src.data,out=c.createImageData(w,h),o=out.data,rw=w<<2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)<<2;
    for(let ch=0;ch<3;ch++){const ce=d[i+ch];
      const l=x>0?d[i-4+ch]:ce,r=x<w-1?d[i+4+ch]:ce,u=y>0?d[i-rw+ch]:ce,dn=y<h-1?d[i+rw+ch]:ce;
      let v=ce+a*(4*ce-l-r-u-dn);o[i+ch]=v<0?0:v>255?255:v;}
    o[i+3]=d[i+3];}
  c.putImageData(out,0,0);}
async function bakeImage(src,adj,media,cal){const im=await loadImage(src);const iw=im.naturalWidth,ih=im.naturalHeight;
  const off=document.createElement("canvas");off.width=iw;off.height=ih;const c=off.getContext("2d");
  c.imageSmoothingQuality="high";
  let f=`brightness(${adj.bright/100}) contrast(${adj.contrast/100}) saturate(${adj.mono?1:adj.sat/100})`;
  if(adj.mono)f+=" grayscale(1)"; if(adj.sepia)f+=" sepia(0.55)"; if(media&&media!=="none")f+=" "+media;
  c.filter=f; c.drawImage(im,0,0); c.filter="none";
  const C=cal||{rGain:100,gGain:100,bGain:100,gamma:100,sharpen:0};
  const pix=adj.warm||adj.tint||C.rGain!==100||C.gGain!==100||C.bGain!==100||C.gamma!==100;
  if(pix){const dd=c.getImageData(0,0,iw,ih),a=dd.data,w=adj.warm/100,t=adj.tint/100;
    const Rr=1+(w>0?w*0.35:w*0.15),Bb=1-(w>0?w*0.30:w*0.12),Gg=1-t*0.18;
    const gr=C.rGain/100,gg=C.gGain/100,gb=C.bGain/100,ig=100/C.gamma,gm=C.gamma!==100;
    for(let i=0;i<a.length;i+=4){let r=a[i]*Rr*gr,g=a[i+1]*Gg*gg,b=a[i+2]*Bb*gb;
      if(gm){r=255*Math.pow(r<0?0:r>255?1:r/255,ig);g=255*Math.pow(g<0?0:g>255?1:g/255,ig);b=255*Math.pow(b<0?0:b>255?1:b/255,ig);}
      a[i]=r>255?255:r;a[i+1]=g>255?255:g;a[i+2]=b>255?255:b;}
    c.putImageData(dd,0,0);}
  if(C.sharpen>0&&iw*ih<=30000000) unsharp(c,iw,ih,C.sharpen);
  return off.toDataURL("image/png");}
async function printBaked(btn){
  state.sel=null; drawSelection();
  const media=MEDIA[state.media]||"none";
  const jobs=[];
  if(state.mode==="free") page.querySelectorAll(".item").forEach(el=>{const it=state.items.find(i=>String(i.id)===el.dataset.id);const rec=it&&imgById(it.src);if(it&&rec)jobs.push({img:el.querySelector("img"),adj:it.adj,sw:rec.w,sh:rec.h,wmm:it.w,hmm:it.h,fit:it.fit});});
  else if(state.mode==="fill"||(state.mode==="order"&&!state.order._card)){const im=page.querySelector(".item img"),rec=imgById(state.fill.id);if(im&&rec){const[pw,ph]=paperMm();jobs.push({img:im,adj:state.fill.adj,sw:rec.w,sh:rec.h,wmm:pw,hmm:ph,fit:"cover"});}}
  else if(state.mode==="id"||(state.mode==="order"&&state.order._card)){const rec=imgById(state.id.srcId);page.querySelectorAll(".cell img").forEach(im=>{if(rec)jobs.push({img:im,adj:state.id.adj,sw:rec.w,sh:rec.h,wmm:state.id.cw,hmm:state.id.ch,fit:"cover"});});}
  else if(state.mode==="grid"){const[cwm,chm]=gridCellMm();page.querySelectorAll(".cell img").forEach((im,i)=>{const rec=state.library[i%Math.max(1,state.library.length)];if(rec)jobs.push({img:im,adj:state.grid.adj,sw:rec.w,sh:rec.h,wmm:cwm,hmm:chm,fit:state.grid.fit});});}
  const lowJobs=jobs.filter(j=>{const d=effDPI(j.sw,j.sh,j.wmm,j.hmm,j.fit);return d&&d<state.dpi;});
  if(lowJobs.length){const worst=Math.min(...lowJobs.map(j=>effDPI(j.sw,j.sh,j.wmm,j.hmm,j.fit)));
    if(!confirm(`목표 ${state.dpi} DPI 미만인 사진이 있습니다 (최저 ${worst} DPI).\n원본 해상도가 인쇄 크기에 비해 낮으면 흐릿하게 나올 수 있습니다.\n그래도 인쇄할까요?`))return;}
  if(btn)btn.textContent="⏳ 준비 중…";
  const cal=state.cal, calBake=calNeedsBake(cal), calKey=`${cal.rGain},${cal.gGain},${cal.bGain},${cal.gamma},${cal.sharpen}`;
  const cache=new Map();
  for(const j of jobs){ if(isDefaultAdj(j.adj)&&media==="none"&&!calBake)continue;
    const k=j.img.src+"|"+JSON.stringify(j.adj)+"|"+media+"|"+calKey; let d=cache.get(k);
    if(!d){ d=await bakeImage(j.img.src,j.adj,media,cal); cache.set(k,d); }
    j.img.style.filter="none"; j.img.src=d; }
  page.style.filter="none";
  document.documentElement.style.setProperty("--print-tf", isCalDefault(cal)?"none":calTransform());
  await Promise.all(jobs.map(j=>j.img.decode?j.img.decode().catch(()=>{}):Promise.resolve()));
  // 번들 웹폰트가 아직 로딩 중이면 인쇄물만 폴백 폰트로 나간다(캔버스 경로는 ensureTextFonts 로 이미 보장).
  try{ await ensureTextFonts(); if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
  const restore=()=>{window.removeEventListener("afterprint",restore); if(btn)btn.textContent="🖨️ 인쇄"; render();};
  window.addEventListener("afterprint",restore);
  window.print();
}

/* ---------- calibration ---------- */
function isCalDefault(c){return c.offX===0&&c.offY===0&&c.scaleX===100&&c.scaleY===100;}
function calNeedsBake(c){return c.rGain!==100||c.gGain!==100||c.bGain!==100||c.gamma!==100||c.sharpen>0;}
function calTransform(){const c=state.cal;return `translate(${c.offX}mm, ${c.offY}mm) scale(${c.scaleX/100}, ${c.scaleY/100})`;}
function calLine(x,y,w,h){const d=document.createElement("div");d.className="cropmark";d.style.left=x+"mm";d.style.top=y+"mm";d.style.width=w+"mm";d.style.height=h+"mm";page.appendChild(d);}
function drawCalOverlays(){
  if(state.cal.cropMarks){const u=usableMm(),L=5,t=0.25;
    calLine(u.x,u.y,L,t);calLine(u.x,u.y,t,L);
    calLine(u.x+u.w-L,u.y,L,t);calLine(u.x+u.w-t,u.y,t,L);
    calLine(u.x,u.y+u.h-t,L,t);calLine(u.x,u.y+u.h-L,t,L);
    calLine(u.x+u.w-L,u.y+u.h-t,L,t);calLine(u.x+u.w-t,u.y+u.h-L,t,L);}
  if(!isCalDefault(state.cal)){const[pw,ph]=paperMm(),c=state.cal,Sx=c.scaleX/100,Sy=c.scaleY/100,cx=pw/2,cy=ph/2;
    const Lx=cx+(0-cx-c.offX)/Sx,Rx=cx+(pw-cx-c.offX)/Sx,Ty=cy+(0-cy-c.offY)/Sy,By=cy+(ph-cy-c.offY)/Sy;
    const g=document.createElement("div");g.className="printarea";g.style.left=Lx+"mm";g.style.top=Ty+"mm";g.style.width=(Rx-Lx)+"mm";g.style.height=(By-Ty)+"mm";page.appendChild(g);}
}
function calSVG(){const[pw,ph]=paperMm(),cx=+(pw/2).toFixed(1),cy=+(ph/2).toFixed(1),g=[];
  for(let x=0;x<=pw;x+=10)g.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ph}" stroke="#e2e2e2" stroke-width="0.12"/>`);
  for(let y=0;y<=ph;y+=10)g.push(`<line x1="0" y1="${y}" x2="${pw}" y2="${y}" stroke="#e2e2e2" stroke-width="0.12"/>`);
  const cross=(x,y,l)=>`<line x1="${x-4}" y1="${y}" x2="${x+4}" y2="${y}" stroke="#111" stroke-width="0.3"/><line x1="${x}" y1="${y-4}" x2="${x}" y2="${y+4}" stroke="#111" stroke-width="0.3"/><text x="${x+5}" y="${y-1.5}" font-size="3" fill="#111">${l}</text>`;
  const hticks=Array.from({length:11},(_,i)=>`<line x1="${20+i*10}" y1="27.5" x2="${20+i*10}" y2="32.5" stroke="#c0392b" stroke-width="0.3"/>`).join("");
  const vticks=Array.from({length:11},(_,i)=>`<line x1="17.5" y1="${45+i*10}" x2="22.5" y2="${45+i*10}" stroke="#1565c0" stroke-width="0.3"/>`).join("");
  return `<svg width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}" xmlns="http://www.w3.org/2000/svg" style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <rect x="0" y="0" width="${pw}" height="${ph}" fill="#fff"/>${g.join("")}
    <line x1="20" y1="30" x2="120" y2="30" stroke="#c0392b" stroke-width="0.5"/>${hticks}
    <text x="20" y="24" font-size="4" fill="#c0392b">가로 100 mm — 실제 길이를 자로 측정</text>
    <line x1="20" y1="45" x2="20" y2="145" stroke="#1565c0" stroke-width="0.5"/>${vticks}
    <text x="24" y="97" font-size="4" fill="#1565c0">세로 100 mm</text>
    ${cross(cx,cy,`중앙 ${cx},${cy}`)}${cross(10,10,"10,10")}${cross(pw-10,10,`${(pw-10).toFixed(0)},10`)}${cross(10,ph-10,`10,${(ph-10).toFixed(0)}`)}${cross(pw-10,ph-10,"")}
    <text x="${cx}" y="${ph-6}" font-size="3.4" fill="#111" text-anchor="middle">Studio mean 프린터 보정 · 선 길이와 십자 위치를 측정해 값을 입력하세요</text>
  </svg>`;}
function printCalibrationTarget(){
  const cp=document.getElementById("calPage"); cp.innerHTML=calSVG();
  document.documentElement.style.setProperty("--print-tf", isCalDefault(state.cal)?"none":calTransform());
  document.body.classList.add("calmode");
  const done=()=>{document.body.classList.remove("calmode");window.removeEventListener("afterprint",done);};
  window.addEventListener("afterprint",done); window.print();
}
/* printer profiles */
const PKEY="smphoto:printers", PKEY_DEF="smphoto:defaultPrinter";
function getPrinters(){try{return JSON.parse(localStorage.getItem(PKEY)||"{}");}catch(e){return {};}}
function getDefaultPrinter(){return localStorage.getItem(PKEY_DEF)||"";}
function setDefaultPrinter(n){localStorage.setItem(PKEY_DEF,n);}
function applyDefaultPrinter(){const n=getDefaultPrinter(),all=getPrinters();if(n&&all[n])Object.assign(state.cal,all[n]);}
function renderProfileSelect(sel){const all=getPrinters(),def=getDefaultPrinter(),s=$("#cal_profile");
  s.innerHTML=`<option value="">— 프린터 선택 —</option>`+Object.keys(all).map(n=>`<option value="${n}" ${n===sel?"selected":""}>${n===def?"⭐ ":""}${n}</option>`).join("");}
function saveProfile(name){const all=getPrinters();all[name]={...state.cal};try{localStorage.setItem(PKEY,JSON.stringify(all));renderProfileSelect(name);}catch(e){alert("저장 실패");}}
/* modal */
function openCal(){syncCalInputs();$("#calModal").style.display="flex";renderProfileSelect($("#cal_profile").value);}
function closeCal(){$("#calModal").style.display="none";}
function syncCalInputs(){const c=state.cal;
  $("#cal_offX").value=c.offX;$("#cal_offY").value=c.offY;$("#cal_scaleX").value=c.scaleX;$("#cal_scaleY").value=c.scaleY;
  $("#cal_rGain").value=c.rGain;$("#cal_gGain").value=c.gGain;$("#cal_bGain").value=c.bGain;$("#cal_gamma").value=c.gamma;$("#cal_sharpen").value=c.sharpen;$("#cal_crop").checked=c.cropMarks;
  $("#cal_rGainV").textContent=c.rGain+"%";$("#cal_gGainV").textContent=c.gGain+"%";$("#cal_bGainV").textContent=c.bGain+"%";$("#cal_gammaV").textContent=(c.gamma/100).toFixed(2);$("#cal_sharpenV").textContent=c.sharpen;}
function bindCal(){
  const c=()=>state.cal, nf=id=>parseFloat($("#"+id).value)||0, ni=id=>parseInt($("#"+id).value)||0;
  $("#calBtn").addEventListener("click",openCal);
  $("#cal_x").addEventListener("click",closeCal);
  $("#calModal").addEventListener("click",e=>{if(e.target.id==="calModal")closeCal();});
  ["offX","offY"].forEach(k=>$("#cal_"+k).addEventListener("input",()=>{c()[k]=nf("cal_"+k);render();}));
  ["scaleX","scaleY"].forEach(k=>$("#cal_"+k).addEventListener("input",()=>{c()[k]=parseFloat($("#cal_"+k).value)||100;render();}));
  ["rGain","gGain","bGain","gamma"].forEach(k=>$("#cal_"+k).addEventListener("input",()=>{c()[k]=ni("cal_"+k);syncCalInputs();}));
  $("#cal_sharpen").addEventListener("input",()=>{c().sharpen=ni("cal_sharpen");$("#cal_sharpenV").textContent=c().sharpen;});
  $("#cal_crop").addEventListener("change",()=>{c().cropMarks=$("#cal_crop").checked;render();});
  $("#cal_autoScale").addEventListener("click",()=>{const mx=nf("cal_measX"),my=nf("cal_measY");
    if(mx>0)c().scaleX=+(c().scaleX*100/mx).toFixed(2); if(my>0)c().scaleY=+(c().scaleY*100/my).toFixed(2);
    $("#cal_measX").value="";$("#cal_measY").value="";syncCalInputs();render();});
  $("#cal_test").addEventListener("click",printCalibrationTarget);
  $("#cal_reset").addEventListener("click",()=>{Object.assign(state.cal,{offX:0,offY:0,scaleX:100,scaleY:100,rGain:100,gGain:100,bGain:100,gamma:100,sharpen:0,cropMarks:false});document.documentElement.style.setProperty("--print-tf","none");syncCalInputs();render();});
  $("#cal_profile").addEventListener("change",()=>{const n=$("#cal_profile").value,all=getPrinters();if(n&&all[n]){Object.assign(state.cal,all[n]);syncCalInputs();render();}});
  $("#cal_saveProf").addEventListener("click",()=>{const n=$("#cal_profile").value||prompt("프로파일 이름 (예: Epson P900 + 광택지)");if(n)saveProfile(n);});
  $("#cal_saveAsProf").addEventListener("click",()=>{const n=prompt("새 프로파일 이름 (예: Epson P900 + 무광지)");if(n)saveProfile(n);});
  $("#cal_delProf").addEventListener("click",()=>{const n=$("#cal_profile").value;if(!n)return;const all=getPrinters();delete all[n];localStorage.setItem(PKEY,JSON.stringify(all));if(getDefaultPrinter()===n)setDefaultPrinter("");renderProfileSelect("");});
  $("#cal_setDefault").addEventListener("click",()=>{const n=$("#cal_profile").value;if(!n){alert("먼저 프린터를 선택하거나 저장하세요.");return;}setDefaultPrinter(n);renderProfileSelect(n);alert(`'${n}'을(를) 기본 프린터로 지정했습니다.\n앱을 열면 이 프린터의 보정이 자동 적용됩니다.`);});
}

/* ---------- 로고 · 워터마크 (행사용 편집 프리셋) ---------- */
function logoAnchorStyle(el,L){const v=L.anchor[0],h=L.anchor[1];let tx="0",ty="0";
  el.style.left=el.style.right=el.style.top=el.style.bottom="";
  if(h==="l")el.style.left=L.offX+"mm"; else if(h==="r")el.style.right=L.offX+"mm"; else{el.style.left="50%";tx="-50%";}
  if(v==="t")el.style.top=L.offY+"mm"; else if(v==="b")el.style.bottom=L.offY+"mm"; else{el.style.top="50%";ty="-50%";}
  el.style.transform=`translate(${tx},${ty}) rotate(${L.rotation}deg)`;}
function renderLogo(){
  if(!state.logo.on)return; const L=state.logo; let el;
  if(L.type==="image"&&L.src){ el=document.createElement("img"); el.src=L.src; el.style.width=L.size+"mm"; el.style.height="auto"; }
  else { el=document.createElement("div"); el.textContent=L.text||""; el.style.fontSize=L.size+"mm"; el.style.color=L.color; el.style.fontWeight=L.bold?"700":"400"; el.style.whiteSpace="nowrap"; el.style.fontFamily='"Cormorant Garamond",Georgia,"Noto Sans KR",sans-serif'; el.style.lineHeight="1"; }
  el.className="logo-ov"; el.style.opacity=L.opacity/100; logoAnchorStyle(el,L); page.appendChild(el);
}
async function drawLogoCanvas(ctx,CW,CH,ppm){
  const L=state.logo; if(!L.on)return; ctx.save(); ctx.globalAlpha=L.opacity/100; let bw,bh,draw;
  if(L.type==="image"&&L.src){ const im=await loadImage(L.src); bw=L.size*ppm; bh=bw*(im.naturalHeight/im.naturalWidth); draw=(x,y)=>ctx.drawImage(im,x,y,bw,bh); }
  else { const fs=L.size*ppm; ctx.font=`${L.bold?"700":"400"} ${fs}px "Cormorant Garamond",Georgia,sans-serif`; ctx.fillStyle=L.color; ctx.textBaseline="top"; bw=ctx.measureText(L.text||"").width; bh=fs; draw=(x,y)=>ctx.fillText(L.text||"",x,y); }
  const v=L.anchor[0],h=L.anchor[1],ox=L.offX*ppm,oy=L.offY*ppm;
  const x=h==="l"?ox:h==="r"?CW-ox-bw:(CW-bw)/2, y=v==="t"?oy:v==="b"?CH-oy-bh:(CH-bh)/2;
  ctx.translate(x+bw/2,y+bh/2); ctx.rotate(L.rotation*Math.PI/180); draw(-bw/2,-bh/2); ctx.restore();
}
const LKEY="smphoto:logos", LKEY_DEF="smphoto:logoDefault";
function getLogos(){try{return JSON.parse(localStorage.getItem(LKEY)||"{}");}catch(e){return {};}}
function saveLogo(name){const all=getLogos();all[name]={...state.logo};try{localStorage.setItem(LKEY,JSON.stringify(all));}catch(e){alert("저장 실패(용량 초과 — 이미지 로고가 큼)");}renderLogoSelect(name);}
function renderLogoSelect(sel){const all=getLogos(),def=localStorage.getItem(LKEY_DEF)||"",s=$("#logo_preset");if(!s)return;
  s.innerHTML=`<option value="">— 프리셋 선택 —</option>`+Object.keys(all).map(n=>`<option value="${n}" ${n===sel?"selected":""}>${n===def?"⭐ ":""}${n}</option>`).join("");}
function applyDefaultLogo(){const n=localStorage.getItem(LKEY_DEF),all=getLogos();if(n&&all[n])Object.assign(state.logo,all[n]);}
function openLogo(){syncLogoInputs();renderLogoSelect($("#logo_preset").value);$("#logoModal").style.display="flex";}
function closeLogo(){$("#logoModal").style.display="none";}
function syncLogoInputs(){const L=state.logo;
  $("#logo_on").checked=L.on;
  [...document.querySelectorAll("#logo_type button")].forEach(b=>b.classList.toggle("on",b.dataset.t===L.type));
  $("#logo_textRow").style.display=L.type==="text"?"block":"none"; $("#logo_imgRow").style.display=L.type==="image"?"block":"none";
  $("#logo_text").value=L.text; $("#logo_bold").checked=L.bold; $("#logo_color").value=L.color;
  $("#logo_preview").innerHTML=L.src?`<img src="${L.src}">`:'<span style="color:var(--muted);font-size:11px">이미지 없음</span>';
  [...document.querySelectorAll(".lanchor")].forEach(b=>b.classList.toggle("on",b.dataset.a===L.anchor));
  $("#logo_size").value=L.size;$("#logo_sizeV").textContent=L.size+"mm";
  $("#logo_offx").value=L.offX;$("#logo_offy").value=L.offY;
  $("#logo_op").value=L.opacity;$("#logo_opV").textContent=L.opacity+"%";
  $("#logo_rot").value=L.rotation;$("#logo_rotV").textContent=L.rotation+"°";}
function bindLogo(){
  $("#logoBtn").addEventListener("click",openLogo); $("#logo_x").addEventListener("click",closeLogo);
  $("#logoModal").addEventListener("click",e=>{if(e.target.id==="logoModal")closeLogo();});
  $("#logo_on").addEventListener("change",()=>{state.logo.on=$("#logo_on").checked;render();});
  document.querySelector("#logo_type").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.logo.type=b.dataset.t;syncLogoInputs();render();});
  $("#logo_text").addEventListener("input",()=>{state.logo.text=$("#logo_text").value;render();});
  $("#logo_bold").addEventListener("change",()=>{state.logo.bold=$("#logo_bold").checked;render();});
  $("#logo_color").addEventListener("input",()=>{state.logo.color=$("#logo_color").value;render();});
  $("#logo_pick").addEventListener("click",()=>$("#logo_img").click());
  $("#logo_img").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{state.logo.src=rd.result;state.logo.type="image";syncLogoInputs();render();};rd.readAsDataURL(f);e.target.value="";});
  $("#logo_remove").addEventListener("click",()=>{state.logo.src="";syncLogoInputs();render();});
  document.querySelector("#logo_anchor").addEventListener("click",e=>{const b=e.target.closest(".lanchor");if(!b)return;state.logo.anchor=b.dataset.a;syncLogoInputs();render();});
  $("#logo_size").addEventListener("input",()=>{state.logo.size=+$("#logo_size").value;$("#logo_sizeV").textContent=state.logo.size+"mm";render();});
  $("#logo_offx").addEventListener("input",()=>{state.logo.offX=+$("#logo_offx").value||0;render();});
  $("#logo_offy").addEventListener("input",()=>{state.logo.offY=+$("#logo_offy").value||0;render();});
  $("#logo_op").addEventListener("input",()=>{state.logo.opacity=+$("#logo_op").value;$("#logo_opV").textContent=state.logo.opacity+"%";render();});
  $("#logo_rot").addEventListener("input",()=>{state.logo.rotation=+$("#logo_rot").value;$("#logo_rotV").textContent=state.logo.rotation+"°";render();});
  $("#logo_preset").addEventListener("change",()=>{const n=$("#logo_preset").value,all=getLogos();if(n&&all[n]){Object.assign(state.logo,all[n]);syncLogoInputs();render();}});
  $("#logo_save").addEventListener("click",()=>{const n=$("#logo_preset").value||prompt("프리셋 이름 (예: ○○웨딩 로고)");if(n)saveLogo(n);});
  $("#logo_saveas").addEventListener("click",()=>{const n=prompt("새 프리셋 이름 (예: 돌잔치 로고)");if(n)saveLogo(n);});
  $("#logo_del").addEventListener("click",()=>{const n=$("#logo_preset").value;if(!n)return;const all=getLogos();delete all[n];localStorage.setItem(LKEY,JSON.stringify(all));if((localStorage.getItem(LKEY_DEF)||"")===n)localStorage.removeItem(LKEY_DEF);renderLogoSelect("");});
  $("#logo_default").addEventListener("click",()=>{const n=$("#logo_preset").value;if(!n){alert("먼저 프리셋을 선택/저장하세요.");return;}localStorage.setItem(LKEY_DEF,n);renderLogoSelect(n);alert(`'${n}'을(를) 기본 로고로 지정했습니다.\n앱을 열면 자동 적용됩니다.`);});
}

/* ============================================================ RENDER */
function applyPageSize(){
  const [w,h]=paperMm();
  page.style.width=w+"mm"; page.style.height=h+"mm";
  page.style.setProperty("--pg-bg",state.bg);
  page.style.transform=`scale(${state.scale})`;
  page.style.filter=MEDIA[state.media]||"none";
  holder.style.width=(w*MM*state.scale)+"px"; holder.style.height=(h*MM*state.scale)+"px";
  overlay.style.width=holder.style.width; overlay.style.height=holder.style.height;
  $("#pageStyle").textContent=`@page{size:${w}mm ${h}mm;margin:0;}`;
}
/* ============================================================ ORDER — ERP 작업지시서 → 로컬/드라이브 원본 매칭 → 자동 출력 셋업 */
const PRINT_SIZE_MM = {
  basic_10x15:{w:100,h:150,label:'10×15cm'}, premium_10x15:{w:100,h:150,label:'프리미엄 10×15'},
  photocard_single:{w:55,h:85,label:'포토카드(단면)'}, photocard_double:{w:55,h:85,label:'포토카드(양면)'},
  basic_a4:{w:210,h:297,label:'A4'}, premium_a4:{w:210,h:297,label:'프리미엄 A4'},
  premium_a3:{w:297,h:420,label:'A3'}, premium_a3plus:{w:329,h:483,label:'A3+'}
};
function normNum(s){return String(s||'').trim().toLowerCase().replace(/\.[a-z0-9]+$/,'');}
function numTail(s){const m=normNum(s).match(/(\d+)\s*$/);return m?String(parseInt(m[1],10)):'';}
function normPrintId(v){v=String(v||'').trim();if(PRINT_SIZE_MM[v])return v;const low=v.toLowerCase();
  if(/a3\s*\+|a3plus/.test(low))return 'premium_a3plus'; if(/a3/.test(low))return 'premium_a3';
  if(/a4/.test(low))return /prem|프리미엄/.test(low)?'premium_a4':'basic_a4';
  if(/photocard|포토카드/.test(low))return /double|양면/.test(low)?'photocard_double':'photocard_single';
  if(/10.?15|4.?6|kg|엽서/.test(low))return /prem|프리미엄/.test(low)?'premium_10x15':'basic_10x15';
  return 'basic_10x15';}
function parseOrder(text){let d;try{d=JSON.parse(text);}catch(e){throw new Error('JSON 파싱 실패');}
  const arr=Array.isArray(d)?d:(d.existingPrints||d.prints||d.lines||d.order||[]);
  if(!Array.isArray(arr))throw new Error('배열/existingPrints 형식이 아님');
  return arr.map(p=>({photoNum:String(p.photoNum??p.photo??p.num??p.number??p.photoNumber??'').trim(),
    printId:normPrintId(p.printId??p.printType??p.size??p.type??p.id),
    qty:Math.max(1,Number(p.qty??p.quantity??p.count??1)||1),
    finish:(String(p.finish||(p.border?'border':''))==='border')?'border':'full'})).filter(l=>l.photoNum);}
function matchRec(photoNum){const k=normNum(photoNum),t=numTail(photoNum);
  let r=state.library.find(x=>normNum(x.name)===k); if(r)return r;
  if(t){r=state.library.find(x=>numTail(x.name)===t); if(r)return r;}
  return null;}
function orderQueue(){const k=Object.keys(PRINT_SIZE_MM);return state.order.lines.slice().sort((a,b)=>k.indexOf(a.printId)-k.indexOf(b.printId));}
function orderStats(){const q=orderQueue();let matched=0,sheets=0;q.forEach(l=>{if(matchRec(l.photoNum))matched++;sheets+=l.qty;});return{total:q.length,matched,sheets};}
function setOrderIdx(i){const q=orderQueue();state.order.idx=Math.max(0,Math.min(i,q.length-1));render();fit();}
function syncPaperUI(){const ps=$("#paper");if(ps)ps.value=state.paper;const cwr=$("#customWrap");if(cwr)cwr.style.display=PAPERS[state.paper]==="custom"?'block':'none';
  if($("#cw"))$("#cw").value=state.cw; if($("#ch"))$("#ch").value=state.ch;
  [...$("#orient").children].forEach(x=>x.classList.toggle('on',x.dataset.o===state.orient));}
function isCardId(id){return String(id||'').startsWith('photocard');}
function cardCapacity(){ // ET-18100 갱 시트에 들어가는 55×85 카드 수
  const p=PAPERS[state.order.cardSheet]||[210,297]; const g=4;
  return Math.max(1,Math.floor((p[0]+g)/(55+g)))*Math.max(1,Math.floor((p[1]+g)/(85+g)));}
function renderOrder(){
  const q=orderQueue();
  if(!q.length){page.appendChild(hint('① 주문(작업지시서)을 붙여넣고<br>② 원본 파일을 불러오면<br>사이즈별로 자동 셋업됩니다'));return;}
  const line=q[Math.min(state.order.idx,q.length-1)], sz=PRINT_SIZE_MM[line.printId]||{w:100,h:150}, rec=matchRec(line.photoNum);
  const card=isCardId(line.printId); state.order._card=card;
  if(card){ // ET-18100은 55×85 카드 급지 불가 → 갱 시트(A4)에 타일 + 재단선, 인쇄 후 컷팅
    state.paper=state.order.cardSheet||'A4 (210×297)'; state.orient='portrait';
    syncPaperUI(); applyPageSize();
    if(rec){ state.id.srcId=rec.id; state.id.cw=sz.w; state.id.ch=sz.h; state.id.gap=4; state.id.guides=true; state.id.autoMax=false; state.id.faceGuide=false; renderId(); }
    else page.appendChild(hint('⚠ 미매칭 · 원본 파일 없음<br><b>'+line.photoNum+'</b>'));
    return;
  }
  state.paper='사용자 지정…'; state.cw=sz.w; state.ch=sz.h; state.orient=(rec&&rec.w>rec.h)?'landscape':'portrait';
  // 고객이 셀렉에서 고른 가장자리 마감을 항목별 자동 셋팅: 테두리=흰 프레임, 풀프레임=여백없음.
  state.frame.on=(line.finish==='border');
  if(state.frame.on){ state.frame.w=Math.max(3,Math.min(8,Math.round(Math.min(sz.w,sz.h)*0.04))); state.frame.color=state.frame.color||'#ffffff'; }
  syncPaperUI(); applyPageSize();
  if(rec){ state.fill.id=rec.id; renderFill(); }
  else page.appendChild(hint('⚠ 미매칭 · 원본 파일 없음<br><b>'+line.photoNum+'</b><br>원본을 더 불러오세요'));
}
function renderOrderPanel(){
  const q=orderQueue(), st=orderStats(), cur=q.length?q[Math.min(state.order.idx,q.length-1)]:null;
  const rows=q.map((l,i)=>{const sz=PRINT_SIZE_MM[l.printId]||{}, rec=matchRec(l.photoNum);
    let bw=sz.w,bh=sz.h; if(rec&&rec.w>rec.h){bw=sz.h;bh=sz.w;} const dpi=rec?effDPI(rec.w,rec.h,bw,bh,'cover'):0;
    return `<div class="oq ${i===state.order.idx?'cur':''}" data-i="${i}"><span class="onum">${l.photoNum}</span><span class="osz">${sz.label||l.printId} ×${l.qty}${l.finish==='border'?' · 🔲테두리':''}</span>${rec?dpiBadge(dpi,state.dpi):'<span class="dpi-badge bad">✗없음</span>'}</div>`;}).join('');
  propsMount.innerHTML=`<div class="props"><header>주문 인화 (ERP) <span style="text-transform:none;letter-spacing:0">${st.matched}/${st.total} 매칭</span></header><div class="body">
    <label class="f">① 주문(작업지시서) 붙여넣기</label>
    <textarea id="ord_json" rows="3" class="ord-ta" placeholder='[{"photoNum":"IMG_0045","printId":"basic_10x15","qty":2}]'>${(state.order.raw||'').replace(/</g,'&lt;')}</textarea>
    <div class="row" style="margin-top:6px"><button class="btn sm" id="ord_apply">주문 적용</button><button class="btn sm" id="ord_file">.json 파일</button></div>
    <input type="file" id="ord_fileInput" accept=".json,application/json" hidden>
    <label class="f" style="margin-top:11px">② 원본 파일 (로컬 · 드라이브 다운로드)</label>
    <div class="row"><button class="btn sm" id="ord_pick">파일 선택</button><button class="btn sm" id="ord_folder">폴더 선택</button></div>
    <div class="hint" style="padding:4px 0 0">${state.library.length}장 로드됨 · 파일명↔사진번호 자동 매칭</div>
    ${q.length?`<label class="f" style="margin-top:11px">③ 인화 큐 (사이즈별) — 클릭해 이동</label>
    <div class="oqlist">${rows}</div>
    <div class="ostep"><button class="btn sm" id="ord_prev">◀</button><span class="olvl">${state.order.idx+1} / ${q.length}</span><button class="btn sm" id="ord_next">▶</button></div>
    <div class="row" style="margin-top:7px"><button class="btn sm" id="ord_autoone" style="flex:1">🖨️ 이 장 자동출력</button><button class="btn sm" id="ord_autoall" style="flex:1">🖨️ 전체 자동출력 (${st.sheets}장)</button></div>
    <div class="hint" id="ord_helper_note" style="padding:4px 0 0">시스템 자동출력: 인화지=<b>${(state.media||'').replace(/</g,'&lt;')}</b> · 사이즈·여백없음 자동 · lp로 EPSON 직접 (헬퍼 필요)</div>
    <button class="btn sm" id="ord_pdf" style="margin-top:7px">📄 주문 전체 멀티페이지 PDF</button>
    ${cur?(isCardId(cur.printId)?(()=>{const cap=cardCapacity(),sheets=Math.ceil(cur.qty/cap),dbl=cur.printId==='photocard_double';return `<div class="hint" style="padding:6px 0 0">현재: <b>${cur.photoNum}</b> · 포토카드 <b>55×85mm</b> · <b>${cur.qty}장</b><br><b>ET-18100은 카드 급지 불가</b> → ${(state.order.cardSheet||'A4').split(' ')[0]} 1장에 <b>${cap}장</b> 갱 인쇄 후 <b>재단</b>. ${cur.qty}장 = <b>${sheets}시트</b>.${dbl?'<br>⚠ 양면(더블)은 뒷면 이미지로 2차 인쇄 필요.':''}</div><label class="f">갱 시트 (ET-18100)</label><div class="seg"><button class="cardsheet ${(state.order.cardSheet||'').startsWith('A4')?'on':''}" data-s="A4 (210×297)">A4·9장</button><button class="cardsheet ${(state.order.cardSheet||'').startsWith('A3 ')?'on':''}" data-s="A3 (297×420)">A3·20장</button><button class="cardsheet ${(state.order.cardSheet||'').startsWith('A3+')?'on':''}" data-s="A3+ (329×483)">A3+·25장</button></div>`;})():`<div class="hint" style="padding:6px 0 0">현재: <b>${cur.photoNum}</b> · ${(PRINT_SIZE_MM[cur.printId]||{}).label} · <b>${cur.qty}장</b> → 인쇄 대화상자 <b>매수 ${cur.qty}</b>로.</div>`):''}
    ${st.total-st.matched>0?`<div class="hint" style="padding:6px 0 0;color:#c98">⚠ 미매칭 ${st.total-st.matched}건 — 원본을 더 불러오세요.</div>`:''}`:''}
    <label class="f" style="margin-top:11px">④ ERP 직결 (호스팅 시 자동 로드)</label>
    <input type="text" id="ord_erpBase" placeholder="GAS /exec URL (호스팅 후 입력)" value="${(localStorage.getItem('smphoto:erpBase')||ERP_BASE||'').replace(/"/g,'&quot;')}">
    <div class="row" style="margin-top:6px"><select id="ord_sid_pick" style="flex:2"><option value="">최근 주문 세션 선택…</option></select><button class="btn sm" id="ord_list_refresh" style="flex:1">🔄 목록</button></div>
    <div class="row" style="margin-top:6px"><input type="text" id="ord_sid" placeholder="셀렉 세션 ID" style="flex:2" value="${(state.order.sid||'').replace(/"/g,'&quot;')}"><button class="btn sm" id="ord_fetch" style="flex:1">불러오기</button></div>
    <div class="hint" style="padding:6px 0 0">호스팅(예: print.studio-mean.com) 후 세션ID로 <b>주문 자동 로드</b>. file://·미호스팅 시 CORS로 실패 — 그땐 위 붙여넣기/로컬 사용. 사진 원본은 로컬 매칭 권장(고해상). 드롭다운은 암호로 보호됩니다(최초 1회 입력, 이 기기에 저장).</div>
  </div></div>`;
  $("#ord_apply").addEventListener('click',()=>{try{const l=parseOrder($("#ord_json").value);state.order.lines=l;state.order.raw=$("#ord_json").value;state.order.idx=0;render();fit();}catch(e){alert('주문 형식 오류: '+e.message);}});
  $("#ord_file").addEventListener('click',()=>$("#ord_fileInput").click());
  $("#ord_fileInput").addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{state.order.lines=parseOrder(rd.result);state.order.raw=rd.result;state.order.idx=0;render();fit();}catch(err){alert('주문 파일 오류: '+err.message);}};rd.readAsText(f);e.target.value='';});
  $("#ord_pick").addEventListener('click',()=>$("#file").click());
  $("#ord_folder").addEventListener('click',()=>{const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.webkitdirectory=true;inp.addEventListener('change',ev=>addFiles(ev.target.files));inp.click();});
  const list=document.querySelector('.oqlist'); if(list)list.addEventListener('click',e=>{const r=e.target.closest('.oq');if(r)setOrderIdx(+r.dataset.i);});
  if($("#ord_prev"))$("#ord_prev").addEventListener('click',()=>setOrderIdx(state.order.idx-1));
  if($("#ord_next"))$("#ord_next").addEventListener('click',()=>setOrderIdx(state.order.idx+1));
  document.querySelectorAll('.cardsheet').forEach(b=>b.addEventListener('click',()=>{state.order.cardSheet=b.dataset.s;render();fit();}));
  if($("#ord_pdf"))$("#ord_pdf").addEventListener('click',exportOrderPDF);
  if($("#ord_autoone"))$("#ord_autoone").addEventListener('click',()=>autoprintViaHelper(false));
  if($("#ord_autoall"))$("#ord_autoall").addEventListener('click',()=>autoprintViaHelper(true));
  if($("#ord_fetch"))$("#ord_fetch").addEventListener('click',fetchErpSession);
  if($("#ord_list_refresh"))$("#ord_list_refresh").addEventListener('click',()=>loadPrintSessionList(true));
  if($("#ord_sid_pick"))$("#ord_sid_pick").addEventListener('change',e=>{
    const v=e.target.value; if(!v)return;
    if($("#ord_sid"))$("#ord_sid").value=v;
    fetchErpSession();
  });
  if(location.protocol!=="file:") loadPrintSessionList(false); // 캐시된 암호가 있을 때만 조용히 채움
}

/* ---------- export to image (PNG/JPG/PDF) — 목표 DPI 합성, 프린터 보정 제외한 디자인 원본 ---------- */
function drawFittedCanvas(ctx,img,dx,dy,dw,dh,fit,posX,posY,rotDeg,zoom,fw,fcolor,circle){
  const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height; fw=fw||0;
  ctx.save();const cx=dx+dw/2,cy=dy+dh/2;ctx.translate(cx,cy);if(rotDeg)ctx.rotate(rotDeg*Math.PI/180);
  ctx.beginPath();if(circle)ctx.ellipse(0,0,dw/2,dh/2,0,0,Math.PI*2);else ctx.rect(-dw/2,-dh/2,dw,dh);ctx.clip();
  if(fw>0){ctx.fillStyle=fcolor||"#fff";ctx.fillRect(-dw/2,-dh/2,dw,dh);}
  const iw2=Math.max(1,dw-2*fw), ih2=Math.max(1,dh-2*fw);
  ctx.beginPath();if(circle)ctx.ellipse(0,0,iw2/2,ih2/2,0,0,Math.PI*2);else ctx.rect(-iw2/2,-ih2/2,iw2,ih2);ctx.clip();
  const base=fit==="contain"?Math.min(iw2/iw,ih2/ih):Math.max(iw2/iw,ih2/ih),s=base*(zoom||1);
  const rw=iw*s,rh=ih*s,ox=-iw2/2+(iw2-rw)*(posX==null?0.5:posX),oy=-ih2/2+(ih2-rh)*(posY==null?0.5:posY);
  ctx.imageSmoothingQuality="high";ctx.drawImage(img,ox,oy,rw,rh);ctx.restore();
}
async function renderPageCanvas(dpi){
  const [pw,ph]=paperMm(), ppm=dpi/25.4, CW=Math.round(pw*ppm), CH=Math.round(ph*ppm);
  const cvs=document.createElement("canvas");cvs.width=CW;cvs.height=CH;const ctx=cvs.getContext("2d");
  ctx.imageSmoothingQuality="high";ctx.fillStyle=state.bg;ctx.fillRect(0,0,CW,CH);
  const media=MEDIA[state.media]||"none", neutral={rGain:100,gGain:100,bGain:100,gamma:100,sharpen:0}, mm=v=>v*ppm, cache=new Map();
  const fw=state.frame.on?state.frame.w*ppm:0, fc=state.frame.color;
  const getEl=async(src,adj)=>{const k=src+"|"+JSON.stringify(adj)+"|"+media;if(cache.has(k))return cache.get(k);
    const need=!(isDefaultAdj(adj)&&media==="none");const durl=need?await bakeImage(src,adj,media,neutral):src;const el=await loadImage(durl);cache.set(k,el);return el;};
  const cut=(x,y,w,h)=>{ctx.strokeStyle="rgba(120,120,120,.85)";ctx.lineWidth=Math.max(1,0.2*ppm);ctx.setLineDash([2*ppm,1.5*ppm]);ctx.strokeRect(mm(x),mm(y),mm(w),mm(h));ctx.setLineDash([]);};
  if(state.mode==="free"){for(const it of state.items){const im=imgById(it.src);if(!im)continue;const el=await getEl(im.src,it.adj);drawFittedCanvas(ctx,el,mm(it.x),mm(it.y),mm(it.w),mm(it.h),it.fit,0.5,0.5,it.rot,1,fw,fc,it.circle);}}
  else if(state.mode==="fill"||(state.mode==="order"&&!state.order._card)){const im=imgById(state.fill.id);if(im){const el=await getEl(im.src,state.fill.adj);drawFittedCanvas(ctx,el,0,0,CW,CH,"cover",state.fill.ox/100,state.fill.oy/100,0,state.fill.zoom,fw,fc);}}
  else if(state.mode==="id"||(state.mode==="order"&&state.order._card)){const im=imgById(state.id.srcId);if(im){const el=await getEl(im.src,state.id.adj);const u=usableMm(),cw=state.id.cw,ch=state.id.ch,g=state.id.gap;
    const cols=Math.max(1,Math.floor((u.w+g)/(cw+g))),rows=Math.max(1,Math.floor((u.h+g)/(ch+g))),bw=cols*cw+(cols-1)*g,bh=rows*ch+(rows-1)*g,ox=u.x+(u.w-bw)/2,oy=u.y+(u.h-bh)/2;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=ox+c*(cw+g),y=oy+r*(ch+g);drawFittedCanvas(ctx,el,mm(x),mm(y),mm(cw),mm(ch),"cover",state.id.ox/100,state.id.oy/100,0,state.id.zoom||1,fw,fc);if(state.id.guides)cut(x,y,cw,ch);}}}
  else if(state.mode==="grid"){const u=usableMm(),G=state.grid,g=G.gap;let cols,rows,cw,ch,ox,oy;
    if(G.kind==="even"){cols=G.cols;rows=G.rows;cw=(u.w-(cols-1)*g)/cols;ch=(u.h-(rows-1)*g)/rows;ox=u.x;oy=u.y;}
    else{cw=G.cw;ch=G.ch;cols=Math.max(1,Math.floor((u.w+g)/(cw+g)));rows=Math.max(1,Math.floor((u.h+g)/(ch+g)));const bw=cols*cw+(cols-1)*g;ox=u.x+(u.w-bw)/2;oy=u.y+(u.h-(rows*ch+(rows-1)*g))/2;}
    let k=0;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const im=state.library[k%Math.max(1,state.library.length)];k++;if(!im||!state.library.length)continue;const el=await getEl(im.src,G.adj);const x=ox+c*(cw+g),y=oy+r*(ch+g);drawFittedCanvas(ctx,el,mm(x),mm(y),mm(cw),mm(ch),G.fit,0.5,0.5,0,1,fw,fc);if(G.guides)cut(x,y,cw,ch);}}
  await ensureTextFonts(); drawTextsCanvas(ctx,ppm);
  await drawLogoCanvas(ctx,CW,CH,ppm);
  return cvs;
}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
function makePDFfromJPEG(jpegDataUrl,iw,ih,pwMm,phMm){
  const bin=atob(jpegDataUrl.split(",")[1]);
  const wpt=(pwMm/25.4*72).toFixed(2), hpt=(phMm/25.4*72).toFixed(2);
  let parts=[],off=[],pos=0;const push=s=>{parts.push(s);pos+=s.length;};
  push("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  off[1]=pos;push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  off[2]=pos;push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  off[3]=pos;push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wpt} ${hpt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  off[4]=pos;push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n`);push(bin);push("\nendstream\nendobj\n");
  const content=`q\n${wpt} 0 0 ${hpt} 0 0 cm\n/Im0 Do\nQ\n`;
  off[5]=pos;push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  const xp=pos;let xref="xref\n0 6\n0000000000 65535 f \n";for(let i=1;i<=5;i++)xref+=String(off[i]).padStart(10,"0")+" 00000 n \n";push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xp}\n%%EOF`);
  const full=parts.join(""),bytes=new Uint8Array(full.length);for(let i=0;i<full.length;i++)bytes[i]=full.charCodeAt(i)&0xff;
  return new Blob([bytes],{type:"application/pdf"});
}
function makePDFmultiPage(pages){ // pages: [{jpeg, iw, ih, pwMm, phMm}]
  let parts=[],off=[],pos=0;const push=s=>{parts.push(s);pos+=s.length;};
  push("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"); const N=pages.length;
  const kids=pages.map((_,i)=>`${3+i*3} 0 R`).join(" ");
  off[1]=pos;push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  off[2]=pos;push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${N} >>\nendobj\n`);
  pages.forEach((pg,i)=>{const pageN=3+i*3,imgN=4+i*3,contN=5+i*3;
    const bin=atob(pg.jpeg.split(",")[1]), wpt=(pg.pwMm/25.4*72).toFixed(2), hpt=(pg.phMm/25.4*72).toFixed(2);
    off[pageN]=pos;push(`${pageN} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wpt} ${hpt}] /Resources << /XObject << /Im0 ${imgN} 0 R >> >> /Contents ${contN} 0 R >>\nendobj\n`);
    off[imgN]=pos;push(`${imgN} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.iw} /Height ${pg.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n`);push(bin);push("\nendstream\nendobj\n");
    const content=`q\n${wpt} 0 0 ${hpt} 0 0 cm\n/Im0 Do\nQ\n`;
    off[contN]=pos;push(`${contN} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);});
  const total=2+N*3, xp=pos; let xref=`xref\n0 ${total+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=total;i++)xref+=String(off[i]||0).padStart(10,"0")+" 00000 n \n"; push(xref);
  push(`trailer\n<< /Size ${total+1} /Root 1 0 R >>\nstartxref\n${xp}\n%%EOF`);
  const full=parts.join(""),bytes=new Uint8Array(full.length);for(let i=0;i<full.length;i++)bytes[i]=full.charCodeAt(i)&0xff;
  return new Blob([bytes],{type:"application/pdf"});
}
async function exportOrderPDF(){ // 주문 전체 → 멀티페이지 PDF (항목별 1페이지, 크기 각각)
  const q=orderQueue(); if(!q.some(l=>matchRec(l.photoNum))){alert("매칭된 주문이 없습니다.");return;}
  const btn=$("#ord_pdf"); if(btn){btn.disabled=true;btn.textContent="⏳ 생성 중…";}
  const savedIdx=state.order.idx, pdfPages=[];   // 주문 PDF 버퍼 — 문서 페이지 전역 `pages` 와 이름 충돌 방지
  try{
    for(let i=0;i<q.length;i++){ if(!matchRec(q[i].photoNum))continue;
      state.order.idx=i; render();
      const cvs=await renderPageCanvas(state.dpi), [pw,ph]=paperMm();
      pdfPages.push({jpeg:cvs.toDataURL("image/jpeg",0.92),iw:cvs.width,ih:cvs.height,pwMm:pw,phMm:ph});
    }
    downloadBlob(makePDFmultiPage(pdfPages),"studio-order.pdf");
  }catch(e){alert("멀티페이지 PDF 실패: "+(e.message||e));}
  state.order.idx=savedIdx; render(); fit();
  if(btn){btn.disabled=false;btn.textContent="📄 주문 전체 멀티페이지 PDF";}
}
/* ── 로컬 프린터 헬퍼(시스템 자동출력) ──
   127.0.0.1:17600 헬퍼가 lp로 용지크기·인화지(미디어)·여백없음을 자동 지정해 EPSON으로 직접 출력.
   각 주문 장을 원본해상도 PDF로 조판(테두리 프레임 포함)해 POST. state.media=현재 물리 인화지. */
const PRINT_HELPER_URL = "http://127.0.0.1:17600";
let _helperOk = null;
async function pingPrintHelper(){
  try{ const r=await fetch(PRINT_HELPER_URL+"/ping",{cache:"no-store"}); const j=await r.json(); _helperOk=!!(j&&j.ok); return j; }
  catch(e){ _helperOk=false; return null; }
}
function _blobToB64(blob){ return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(blob);}); }
function _orderItemDpi(line){
  const rec=matchRec(line.photoNum), sz=PRINT_SIZE_MM[line.printId]||{};
  if(!rec||!sz.w) return null;
  let bw=sz.w,bh=sz.h; if(rec.w>rec.h){bw=sz.h;bh=sz.w;}
  return Math.round(effDPI(rec.w,rec.h,bw,bh,"cover"));
}
async function _sendPrint(line,results){
  const cvs=await renderPageCanvas(state.dpi), pm=paperMm();
  const pdf=makePDFmultiPage([{jpeg:cvs.toDataURL("image/jpeg",0.92),iw:cvs.width,ih:cvs.height,pwMm:pm[0],phMm:pm[1]}]);
  const b64=await _blobToB64(pdf);
  const spec={pdfBase64:b64, sizeKey:line.printId, mediaName:state.media, borderless:true, copies:line.qty, jobName:"studio "+line.photoNum};
  let j; try{ const r=await fetch(PRINT_HELPER_URL+"/print",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(spec)}); j=await r.json(); }catch(e){ j={ok:false,error:e.message||String(e)}; }
  const rv=j&&j.resolved;
  results.push((j&&j.ok?"✅ ":"❌ ")+line.photoNum+" → "+(rv?(rv.PageSize+" · 미디어"+rv.MediaType+(rv.borderless?" · 여백없음":"")+" ×"+rv.copies):((j&&j.error)||"실패")));
  return !!(j&&j.ok);
}
// 자동출력 성공 후 ERP에 '출력완료' 기록(재인화 방지·추적). 최근주문 passcode로 게이트.
async function _recordPrintDone(count, results){
  const sid=(state.order&&state.order.sid||"").trim();
  const base=(localStorage.getItem("smphoto:erpBase")||ERP_BASE||"").trim();
  const pc=localStorage.getItem("smphoto:printListPasscode")||"";
  if(!sid||!base||!pc||!count) return;
  try{
    const url=base+(base.includes("?")?"&":"?")+"api=select-print-done";
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({data:{sessionId:sid,passcode:pc,count:count}})});
    const j=await r.json();
    if(j&&j.ok) results.push("📝 ERP 출력완료 기록 ("+count+"장)"+(j.data&&j.data.reprint?" · ⚠재출력":"")+(j.data&&j.data.inviteSent?" · 📧 픽업안내 발송됨":""));
    else results.push("📝 ERP 기록 실패: "+((j&&j.error&&j.error.message)||"확인 필요"));
  }catch(e){ results.push("📝 ERP 기록 실패(네트워크)"); }
}
async function autoprintViaHelper(all){
  const q=orderQueue();
  if(!q.length){alert("주문이 없습니다.");return;}
  const ping=await pingPrintHelper();
  if(!_helperOk){ alert("로컬 프린터 헬퍼에 연결할 수 없습니다.\n인화 헬퍼가 실행 중인지 확인해 주세요."); return; }
  const targetIdx = all ? q.map((l,i)=>i) : [Math.min(state.order.idx,q.length-1)];
  // ── 출력 전 안전점검 (셋팅 없이 눌러도 사고 방지) ──
  const printer=(ping&&ping.printer)||"";
  const printable=targetIdx.filter(i=>matchRec(q[i].photoNum));
  if(!printable.length){ alert("출력할 매칭 사진이 없습니다. 원본 파일을 먼저 불러오세요."); return; }
  const unmatched=targetIdx.length-printable.length;
  const lowdpi=printable.filter(i=>{const d=_orderItemDpi(q[i]); return d!==null && d<state.dpi;}).length;
  let online=null; try{ const s=await fetch(PRINT_HELPER_URL+"/status?printer="+encodeURIComponent(printer)); online=(await s.json()).online; }catch(e){}
  const warns=[];
  if(online===false) warns.push("⚠ 프린터가 오프라인/정지 상태로 보입니다 (전원·연결 확인).");
  if(unmatched) warns.push("⚠ 원본 없는 사진 "+unmatched+"건 — 건너뜁니다.");
  if(lowdpi) warns.push("⚠ 목표 해상도("+state.dpi+"dpi) 미달 "+lowdpi+"건 — 화질 저하 가능.");
  if(warns.length && !confirm("출력 전 점검\n\n"+warns.join("\n")+"\n\n그래도 진행할까요?")) return;
  // ── 용지 크기별 그룹 배치 (교체 지점에서 일시정지) ──
  const savedIdx=state.order.idx, results=[]; let printedSheets=0;
  const groups=[]; let cur=null;
  targetIdx.forEach(i=>{ const pid=q[i].printId; if(!cur||cur.pid!==pid){cur={pid,idxs:[]};groups.push(cur);} cur.idxs.push(i); });
  const btns=[$("#ord_autoone"),$("#ord_autoall")]; btns.forEach(b=>{if(b)b.disabled=true;});
  try{
    for(let g=0; g<groups.length; g++){
      const grp=groups[g], sz=PRINT_SIZE_MM[grp.pid]||{};
      if(all && g>0){
        const ok=confirm("🔄 용지 교체\n\n다음 용지: "+(sz.label||grp.pid)+"\n인화지: "+state.media+"\n\n프린터에 위 용지를 넣고 [확인]을 누르면 계속 출력합니다.\n(인화지 종류가 다르면 취소 → 좌측에서 변경 후 다시 실행)");
        if(!ok){ results.push("⏸ '"+(sz.label||grp.pid)+"' 그룹부터 중단됨"); break; }
      }
      for(const i of grp.idxs){
        const line=q[i];
        if(!matchRec(line.photoNum)){ results.push("⚠ "+line.photoNum+" · 원본없음(건너뜀)"); continue; }
        state.order.idx=i; render();
        if(await _sendPrint(line, results)) printedSheets+=line.qty;
      }
    }
    await _recordPrintDone(printedSheets, results); // 출력완료 → ERP 자동기록
  }catch(e){ results.push("오류: "+(e.message||e)); }
  state.order.idx=savedIdx; render(); fit();
  btns.forEach(b=>{if(b)b.disabled=false;});
  alert("🖨️ 시스템 자동출력 (인화지="+state.media+")\n\n"+results.join("\n"));
}

/* ERP 직결: 셀렉 세션 → existingPrints → 주문 라인 자동 로드 (호스팅 시 활성; file://은 CORS로 실패) */
async function fetchErpSession(){
  const base=($("#ord_erpBase")&&$("#ord_erpBase").value||"").trim(), id=($("#ord_sid")&&$("#ord_sid").value||"").trim();
  if(!base||!id){alert("ERP /exec URL과 셀렉 세션 ID를 입력하세요.");return;}
  state.order.sid=id;
  try{localStorage.setItem("smphoto:erpBase",base);}catch(e){}
  const btn=$("#ord_fetch"); if(btn){btn.disabled=true;btn.textContent="…";}
  try{
    const url=base+(base.includes("?")?"&":"?")+"api=select-session&id="+encodeURIComponent(id)+"&_ts="+Date.now();
    const r=await fetch(url,{cache:"no-store"}); const j=await r.json();
    const d=j&&(j.data||j), prints=(d&&d.existingPrints)||[];
    if(!Array.isArray(prints)||!prints.length){alert("이 세션에 인화 주문(existingPrints)이 없습니다.");}
    state.order.lines=prints.map(p=>({photoNum:String(p.photoNum??p.num??p.photo??"").trim(),printId:normPrintId(p.printId??p.printType??p.size),qty:Math.max(1,Number(p.qty??p.quantity??1)||1),finish:(String(p.finish||(p.border?"border":""))==="border")?"border":"full"})).filter(l=>l.photoNum);
    state.order.printDoneAt=(d&&d.printDoneAt)||"";
    state.order.idx=0; render(); fit();
    if(state.order.printDoneAt){ setTimeout(()=>alert("⚠ 이미 출력한 세션입니다\n\n출력완료: "+state.order.printDoneAt+((d&&d.printDoneCount)?(" · "+d.printDoneCount+"장"):"")+"\n\n재인화(재출력)가 맞으면 그대로 진행하세요."),60); }
  }catch(e){ alert("ERP 불러오기 실패: "+(e.message||e)+"\n(file://·미호스팅에선 CORS로 실패합니다 — 호스팅 후 사용하세요)"); }
  if(btn){btn.disabled=false;btn.textContent="불러오기";}
}
/* 최근 주문 세션 드롭다운: 암호는 이 기기 localStorage에 캐시(서버는 해시만 보관).
   promptIfMissing=false면 캐시된 암호가 있을 때만 조용히 새로고침(패널 열 때마다 자동). */
async function loadPrintSessionList(promptIfMissing){
  const base=($("#ord_erpBase")&&$("#ord_erpBase").value||"").trim();
  const sel=$("#ord_sid_pick");
  if(!base||!sel) return;
  let pc=localStorage.getItem("smphoto:printListPasscode")||"";
  if(!pc){
    if(!promptIfMissing) return;
    pc=(prompt("최근 주문 목록을 보려면 암호를 입력하세요:")||"").trim();
    if(!pc) return;
  }
  const btn=$("#ord_list_refresh"); if(btn){btn.disabled=true;btn.textContent="…";}
  try{
    const url=base+(base.includes("?")?"&":"?")+"api=select-print-list&passcode="+encodeURIComponent(pc)+"&_ts="+Date.now();
    const r=await fetch(url,{cache:"no-store"}); const j=await r.json();
    if(!j||!j.ok){
      localStorage.removeItem("smphoto:printListPasscode");
      if(promptIfMissing) alert("암호가 올바르지 않습니다: "+((j&&j.error&&j.error.message)||"확인 실패"));
      return;
    }
    localStorage.setItem("smphoto:printListPasscode",pc);
    const sessions=(j.data&&j.data.sessions)||[];
    sel.innerHTML='<option value="">최근 주문 세션 선택… ('+sessions.length+'건)</option>'+
      sessions.map(s=>`<option value="${esc(s.sessionId)}">${s.printDoneAt?'✓출력됨 · ':''}${esc(s.name)} · ${esc(s.shootDate)} · ${esc(s.product)} (${s.printCount}장)</option>`).join('');
  }catch(e){ if(promptIfMissing) alert("목록 불러오기 실패: "+(e.message||e)); }
  if(btn){btn.disabled=false;btn.textContent="🔄 목록";}
}
async function exportImage(fmt){
  if(!state.library.length){alert("사진을 먼저 추가하세요.");return;}
  const btns=[...document.querySelectorAll("#exp_png,#exp_jpg,#exp_pdf")];btns.forEach(b=>b.disabled=true);
  try{const cvs=await renderPageCanvas(state.dpi),[pw,ph]=paperMm();
    if(fmt==="png")await new Promise(r=>cvs.toBlob(b=>{downloadBlob(b,"studio-print.png");r();},"image/png"));
    else if(fmt==="jpg")await new Promise(r=>cvs.toBlob(b=>{downloadBlob(b,"studio-print.jpg");r();},"image/jpeg",0.95));
    else if(fmt==="pdf"){const durl=cvs.toDataURL("image/jpeg",0.95);downloadBlob(makePDFfromJPEG(durl,cvs.width,cvs.height,pw,ph),"studio-print.pdf");}
  }catch(e){alert("내보내기 실패: "+(e.message||e));}
  btns.forEach(b=>b.disabled=false);
}

/* ---------- undo / redo (debounced snapshots; 이미지 문자열은 참조 공유로 메모리 절약) ---------- */
let history=[], hpos=-1, lastSig="", histTimer=null, restoring=false;
function cloneState(){return{paper:state.paper,cw:state.cw,ch:state.ch,orient:state.orient,borderless:state.borderless,margin:state.margin,bg:state.bg,media:state.media,dpi:state.dpi,mode:state.mode,
  library:state.library.slice(),items:state.items.map(it=>({...it,adj:{...it.adj}})),fill:{...state.fill,adj:{...state.fill.adj}},id:{...state.id,adj:{...state.id.adj}},grid:{...state.grid,adj:{...state.grid.adj}},cal:{...state.cal},view:{...state.view},frame:{...state.frame},logo:{...state.logo},texts:state.texts.map(t=>({...t})),decos:state.decos.map(d=>({...d})),texture:state.texture,order:{...state.order,lines:state.order.lines.slice()}};}
function applyHist(s){Object.assign(state,{paper:s.paper,cw:s.cw,ch:s.ch,orient:s.orient,borderless:s.borderless,margin:s.margin,bg:s.bg,media:s.media,dpi:s.dpi,mode:s.mode,
  library:s.library.slice(),items:s.items.map(it=>({...it,adj:{...it.adj}})),fill:{...s.fill,adj:{...s.fill.adj}},id:{...s.id,adj:{...s.id.adj}},grid:{...s.grid,adj:{...s.grid.adj}},cal:{...s.cal},view:{...s.view},frame:{...s.frame},logo:{...s.logo},texts:(s.texts||[]).map(t=>({...t})),decos:(s.decos||[]).map(d=>({...d})),texture:s.texture||"none",order:{...s.order,lines:(s.order&&s.order.lines||[]).slice()}});state.sel=null;state.selText=null;state.selDeco=null;}
function stateSig(){return JSON.stringify({a:state.paper,b:state.cw,c:state.ch,d:state.orient,e:state.borderless,f:state.margin,g:state.bg,h:state.media,i:state.dpi,j:state.mode,k:state.items,l:state.fill,m:state.id,n:state.grid,o:state.cal,p:state.view,q:state.library.map(x=>x.id),r:state.frame,s:state.order,t:state.logo,u:state.texts,v:state.decos,w:state.texture});}

/* ============================================================ 여러 페이지 (라이브러리는 전역 공유) */
let pages=[], curPage=0;
function pageSnapshot(){return cloneState();}
function loadPage(s){applyHist({...s,library:state.library});} // 스냅샷의 library 무시 → 전역 유지
function initPages(){pages=[pageSnapshot()];curPage=0;renderPageStrip();}
function renderPageStrip(){const el=$("#pageList");if(!el)return;
  el.innerHTML=pages.map((p,i)=>`<button class="pchip${i===curPage?' on':''}" data-pi="${i}">${i+1}${pages.length>1?`<b class="px" data-del="${i}">×</b>`:''}</button>`).join("");
  el.querySelectorAll(".pchip").forEach(c=>c.addEventListener("click",e=>{const del=e.target.getAttribute("data-del");if(del!=null){e.stopPropagation();delPage(+del);}else gotoPage(+c.dataset.pi);}));
  const info=$("#pageInfo"); if(info)info.textContent=`${pages.length}페이지`;}
function gotoPage(i){if(i===curPage||i<0||i>=pages.length)return;pages[curPage]=pageSnapshot();curPage=i;loadPage(pages[i]);render();fit();initHistory();renderPageStrip();}
function addPage(dup){pages[curPage]=pageSnapshot();const s=pageSnapshot();
  if(!dup){s.items=[];s.texts=[];s.decos=[];s.id={...s.id,srcId:null};s.fill={...s.fill,id:null};}
  pages.splice(curPage+1,0,s);curPage++;loadPage(pages[curPage]);render();fit();initHistory();renderPageStrip();}
function delPage(i){if(pages.length<=1)return;
  // 페이지 삭제는 되돌릴 수 없다(아래 initHistory 가 undo 스택을 초기화) — 반드시 확인받는다.
  if(!confirm(`${i+1}페이지를 삭제할까요?\n이 페이지의 사진·텍스트·데코 배치가 모두 사라지며 되돌릴 수 없습니다.`))return;
  const isCur=(i===curPage);if(!isCur)pages[curPage]=pageSnapshot();
  pages.splice(i,1); if(curPage>i)curPage--; else if(curPage>=pages.length)curPage=pages.length-1;
  loadPage(pages[curPage]);render();fit();initHistory();renderPageStrip();}
async function exportAllPagesPDF(){
  if(pages.length<1)return; pages[curPage]=pageSnapshot(); const saved=curPage;
  const btn=$("#pagesPdf"); if(btn){btn.disabled=true;btn.textContent="⏳ 생성 중…";}
  try{ const out=[];
    // render() 가 첫 줄에서 applyPageSize() 를, renderPageCanvas 가 내부에서 ensureTextFonts() 를 이미 수행한다.
    for(let i=0;i<pages.length;i++){ loadPage(pages[i]); render();
      const cvs=await renderPageCanvas(state.dpi||300), [pw,ph]=paperMm();
      out.push({jpeg:cvs.toDataURL("image/jpeg",0.92),iw:cvs.width,ih:cvs.height,pwMm:pw,phMm:ph}); }
    downloadBlob(makePDFmultiPage(out),"studio-pages.pdf");
  }catch(e){alert("전체 PDF 실패: "+(e.message||e));}
  finally{ if(btn){btn.disabled=false;btn.textContent="🖨️ 전체 페이지 PDF";}
    curPage=saved; loadPage(pages[saved]); render(); fit(); renderPageStrip(); }
}
function scheduleHistory(){if(restoring)return;clearTimeout(histTimer);histTimer=setTimeout(commitHistory,400);}
function commitHistory(){const sig=stateSig();if(sig===lastSig)return;lastSig=sig;history=history.slice(0,hpos+1);history.push(cloneState());if(history.length>60)history.shift();hpos=history.length-1;updateUndoUI();}
function undo(){clearTimeout(histTimer);commitHistory();if(hpos>0){hpos--;doRestore();}}
function redo(){if(hpos<history.length-1){hpos++;doRestore();}}
function doRestore(){restoring=true;applyHist(history[hpos]);lastSig=stateSig();syncControls();renderThumbs();
  [...document.querySelectorAll("#modes button")].forEach(b=>b.classList.toggle("on",b.dataset.mode===state.mode));
  render();fit();updateUndoUI();restoring=false;}
function updateUndoUI(){const u=$("#undoBtn"),r=$("#redoBtn");if(u)u.disabled=hpos<=0;if(r)r.disabled=hpos>=history.length-1;}
function initHistory(){history=[cloneState()];hpos=0;lastSig=stateSig();updateUndoUI();}

function render(){
  applyPageSize(); page.innerHTML=""; overlay.innerHTML="";
  renderTexture();
  if(state.view.grid) drawGridOverlay();
  if(state.mode==="free") renderFree();
  else if(state.mode==="fill") renderFill();
  else if(state.mode==="id") renderId();
  else if(state.mode==="grid") renderGrid();
  else if(state.mode==="order") renderOrder();
  drawCalOverlays(); renderDecos(); renderTexts(); renderLogo();
  renderProps(); drawRuler(); scheduleHistory();
}
function hint(html){const e=document.createElement("div");e.className="empty-hint";e.innerHTML=html;return e;}
function applyFrame(img){if(!state.frame.on)return;img.style.boxSizing="border-box";img.style.border=`${state.frame.w}mm solid ${state.frame.color}`;img.style.borderRadius=state.frame.radius?state.frame.radius+"mm":"";}
function drawGridOverlay(){
  const [w,h]=paperMm(), s=state.view.step;
  const ov=document.createElement("div"); ov.className="grid-ov";
  ov.style.backgroundImage=`repeating-linear-gradient(0deg,rgba(0,102,204,.14) 0 .2mm,transparent .2mm ${s}mm),repeating-linear-gradient(90deg,rgba(0,102,204,.14) 0 .2mm,transparent .2mm ${s}mm)`;
  page.appendChild(ov);
}

/* ---- FREE ---- */
function renderFree(){
  if(!state.borderless){const u=usableMm(),s=document.createElement("div");s.className="safe";
    s.style.left=u.x+"mm";s.style.top=u.y+"mm";s.style.width=u.w+"mm";s.style.height=u.h+"mm";page.appendChild(s);}
  if(state.items.length===0) page.appendChild(hint("사진을 추가한 뒤<br>드래그로 배치하세요"));
  state.items.forEach(it=>{
    const el=document.createElement("div"); el.className="item"; el.dataset.id=it.id;
    el.style.left=it.x+"mm";el.style.top=it.y+"mm";el.style.width=it.w+"mm";el.style.height=it.h+"mm";
    el.style.transform=`rotate(${it.rot}deg)`;
    const im=imgById(it.src); const img=document.createElement("img");
    img.src=im?im.src:""; img.style.objectFit=it.fit; img.style.filter=toneFilter(it.adj,"it"+it.id);
    const fs=it.frameStyle||"plain";
    if(fs==="polaroid"){el.classList.add("fr-polaroid");const pt=it.w*0.045;el.style.padding=`${pt}mm ${pt}mm ${it.w*0.15}mm ${pt}mm`;}
    else if(fs==="film"){el.classList.add("fr-film");el.style.padding=`${it.h*0.1}mm 3%`;
      const a=document.createElement("div");a.className="film-hole";a.style.top="0";const b=document.createElement("div");b.className="film-hole";b.style.bottom="0";el.appendChild(a);el.appendChild(b);}
    else applyFrame(img);
    if(it.circle){el.style.borderRadius="50%";el.style.overflow="hidden";img.style.borderRadius="50%";}
    el.appendChild(img);
    if(fs==="sketch"){const sk=document.createElement("div");sk.className="sketch-fr";sk.innerHTML=sketchFrameSVG(it.frameColor||"#2a2a2a");el.appendChild(sk);}
    el.addEventListener("pointerdown",e=>startMove(e,it));
    page.appendChild(el);
  });
  drawSelection();
}
/* ---- FILL ---- */
function renderFill(){
  const im=imgById(state.fill.id);
  if(!im){ page.appendChild(hint("‘사진’에서 이미지를 선택하면<br>용지를 가득 채웁니다")); return; }
  const wrap=document.createElement("div"); wrap.className="item"; wrap.style.inset="0"; wrap.style.width="100%"; wrap.style.height="100%";
  const img=document.createElement("img"); img.src=im.src; img.style.objectFit="cover";
  img.style.objectPosition=`${state.fill.ox}% ${state.fill.oy}%`; img.style.transform=`scale(${state.fill.zoom})`;
  img.style.filter=toneFilter(state.fill.adj,"fill");
  applyFrame(img); wrap.appendChild(img); wrap.addEventListener("pointerdown",e=>startPan(e,state.fill)); page.appendChild(wrap);
}
/* ---- ID ---- */
function faceGuideSVG(cw,ch,gd){
  const cx=cw/2; let crown,chin,eye;
  if(gd.eyeFromBottom!=null){ eye=ch-gd.eyeFromBottom; crown=eye-0.46*gd.head; chin=eye+0.54*gd.head; }
  else { crown=(gd.top!=null?gd.top:(ch-gd.head)/2); chin=crown+gd.head; eye=crown+0.44*gd.head; }
  const hrx=gd.head*0.72/2, hcy=(crown+chin)/2, hry=gd.head/2;
  return `<svg class="faceguide" viewBox="0 0 ${cw} ${ch}" preserveAspectRatio="none">`
    +`<ellipse cx="${cx}" cy="${hcy}" rx="${hrx}" ry="${hry}" fill="none" stroke="#20c39a" stroke-width="0.35" stroke-dasharray="1.2 0.9"/>`
    +`<line x1="0" y1="${crown}" x2="${cw}" y2="${crown}" stroke="#20c39a" stroke-width="0.3"/>`
    +`<line x1="0" y1="${chin}" x2="${cw}" y2="${chin}" stroke="#20c39a" stroke-width="0.3"/>`
    +`<line x1="${cx}" y1="0" x2="${cx}" y2="${ch}" stroke="#20c39a" stroke-width="0.22" stroke-dasharray="1 1"/>`
    +`<line x1="${cx-2.5}" y1="${eye}" x2="${cx+2.5}" y2="${eye}" stroke="#e6a800" stroke-width="0.4"/></svg>`;
}
function renderId(){
  const u=usableMm(), cw=state.id.cw, ch=state.id.ch, g=state.id.gap;
  const cols=Math.max(1,Math.floor((u.w+g)/(cw+g))), rows=Math.max(1,Math.floor((u.h+g)/(ch+g)));
  const bw=cols*cw+(cols-1)*g, bh=rows*ch+(rows-1)*g, ox=u.x+(u.w-bw)/2, oy=u.y+(u.h-bh)/2;
  const im=imgById(state.id.srcId);
  if(!im) page.appendChild(hint("‘사진’에서 증명사진 원본을 선택하세요<br>선택한 크기로 용지에 반복 배치됩니다"));
  const flt=toneFilter(state.id.adj,"id");
  const gd=state.id.faceGuide?(ID_PRESETS[state.id.preset]||{}).guide:null;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const cell=document.createElement("div"); cell.className="cell";
    cell.style.left=(ox+c*(cw+g))+"mm";cell.style.top=(oy+r*(ch+g))+"mm";cell.style.width=cw+"mm";cell.style.height=ch+"mm";
    if(im){const img=document.createElement("img");img.src=im.src;img.style.objectPosition=`${state.id.ox}% ${state.id.oy}%`;img.style.transform=`scale(${state.id.zoom||1})`;img.style.transformOrigin=`${state.id.ox}% ${state.id.oy}%`;img.style.filter=flt;applyFrame(img);cell.appendChild(img);}
    if(gd) cell.insertAdjacentHTML("beforeend", faceGuideSVG(cw,ch,gd));
    if(state.id.guides){const gl=document.createElement("div");gl.className="guide";
      gl.style.left=cell.style.left;gl.style.top=cell.style.top;gl.style.width=cell.style.width;gl.style.height=cell.style.height;page.appendChild(gl);}
    cell.addEventListener("pointerdown",e=>startPan(e,state.id)); page.appendChild(cell);
  }
  state.id._count=im?rows*cols:0;
}
/* ---- GRID / split ---- */
function renderGrid(){
  const u=usableMm(), G=state.grid, g=G.gap; let cols,rows,cw,ch,ox,oy;
  if(G.kind==="even"){ cols=G.cols; rows=G.rows; cw=(u.w-(cols-1)*g)/cols; ch=(u.h-(rows-1)*g)/rows; ox=u.x; oy=u.y; }
  else { cw=G.cw; ch=G.ch; cols=Math.max(1,Math.floor((u.w+g)/(cw+g))); rows=Math.max(1,Math.floor((u.h+g)/(ch+g)));
    const bw=cols*cw+(cols-1)*g, bh=rows*ch+(rows-1)*g; ox=u.x+(u.w-bw)/2; oy=u.y+(u.h-bh)/2; }
  if(state.library.length===0) page.appendChild(hint("사진을 추가하면<br>칸에 순서대로 채워집니다"));
  const flt=toneFilter(G.adj,"grid"); let k=0;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const cell=document.createElement("div"); cell.className="cell";
    cell.style.left=(ox+c*(cw+g))+"mm";cell.style.top=(oy+r*(ch+g))+"mm";cell.style.width=cw+"mm";cell.style.height=ch+"mm";
    const im=state.library[k%Math.max(1,state.library.length)];
    if(im&&state.library.length){const img=document.createElement("img");img.src=im.src;img.style.objectFit=G.fit;img.style.filter=flt;applyFrame(img);cell.appendChild(img);}
    if(G.guides){const gl=document.createElement("div");gl.className="guide";
      gl.style.left=cell.style.left;gl.style.top=cell.style.top;gl.style.width=cell.style.width;gl.style.height=cell.style.height;page.appendChild(gl);}
    page.appendChild(cell); k++;
  }
  state.grid._count=state.library.length?rows*cols:0;
}
/* live re-tone without rebuild */
function retone(){
  if(state.mode==="free"){const it=state.items.find(i=>i.id===state.sel);if(it){const el=page.querySelector(`.item[data-id="${it.id}"] img`);if(el)el.style.filter=toneFilter(it.adj,"it"+it.id);}}
  else if(state.mode==="fill"){const el=page.querySelector(".item img");if(el)el.style.filter=toneFilter(state.fill.adj,"fill");}
  else if(state.mode==="id"){const f=toneFilter(state.id.adj,"id");page.querySelectorAll(".cell img").forEach(im=>im.style.filter=f);}
  else if(state.mode==="grid"){const f=toneFilter(state.grid.adj,"grid");page.querySelectorAll(".cell img").forEach(im=>im.style.filter=f);}
  scheduleHistory();
}

/* ============================================================ SELECTION overlay */
function drawSelection(){
  overlay.querySelectorAll(".sel-box,.snapline").forEach(n=>n.remove());
  if(state.mode!=="free"||state.sel==null) return;
  const it=state.items.find(i=>i.id===state.sel); if(!it) return;
  const s=SPP(); const box=document.createElement("div"); box.className="sel-box";
  box.style.left=(it.x*s)+"px";box.style.top=(it.y*s)+"px";box.style.width=(it.w*s)+"px";box.style.height=(it.h*s)+"px";
  box.style.transform=`rotate(${it.rot}deg)`; box.style.transformOrigin="center";
  ["nw","ne","sw","se"].forEach(p=>{const h=document.createElement("div");h.className="handle "+p;h.addEventListener("pointerdown",e=>startResize(e,it,p));box.appendChild(h);});
  const rh=document.createElement("div");rh.className="handle rot";rh.addEventListener("pointerdown",e=>startRotate(e,it));box.appendChild(rh);
  overlay.appendChild(box);
}

/* ============================================================ POINTER */
function ptMm(e){const r=overlay.getBoundingClientRect();return {x:(e.clientX-r.left)/SPP(),y:(e.clientY-r.top)/SPP()};}
function rotv(x,y,d){const a=d*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return[x*c-y*s,x*s+y*c];}
function snap(v){return Math.round(v*10)/10;}

function showSnap(vert,posMm){ // vert=true → vertical line at x=posMm
  const s=SPP(),l=document.createElement("div");l.className="snapline";
  if(vert){l.style.left=(posMm*s-0.5)+"px";l.style.top="0";l.style.width="1.5px";l.style.height="100%";}
  else{l.style.top=(posMm*s-0.5)+"px";l.style.left="0";l.style.height="1.5px";l.style.width="100%";}
  overlay.appendChild(l);
}
function snapGuideLines(skipItemId){ // 용지 + 다른 사진의 좌/중앙/우 · 상/중앙/하 가이드
  const [pw,ph]=paperMm(), u=usableMm();
  const xLines=[u.x, u.x+u.w, pw/2, u.x+u.w/2], yLines=[u.y, u.y+u.h, ph/2, u.y+u.h/2];
  state.items.forEach(o=>{ if(o.id===skipItemId)return; xLines.push(o.x,o.x+o.w/2,o.x+o.w); yLines.push(o.y,o.y+o.h/2,o.y+o.h); });
  return {xLines,yLines};
}
function snapBox(x,y,w,h,skipItemId){ // 상자의 좌/중앙/우 · 상/중앙/하를 가이드에 스냅 + 가이드선
  overlay.querySelectorAll(".snapline").forEach(n=>n.remove());
  if(!state.view.snap) return {x,y};
  const th=6/SPP(), {xLines,yLines}=snapGuideLines(skipItemId);
  const xA=[[x,0],[x+w/2,w/2],[x+w,w]], yA=[[y,0],[y+h/2,h/2],[y+h,h]];
  let bx=null; xA.forEach(([ap,off])=>xLines.forEach(L=>{const d=Math.abs(ap-L);if(d<th&&(!bx||d<bx.d))bx={d,v:L-off,line:L};}));
  if(bx){ x=snap(bx.v); showSnap(true,bx.line); }
  let by=null; yA.forEach(([ap,off])=>yLines.forEach(L=>{const d=Math.abs(ap-L);if(d<th&&(!by||d<by.d))by={d,v:L-off,line:L};}));
  if(by){ y=snap(by.v); showSnap(false,by.line); }
  return {x,y};
}
function applySnap(it,nx,ny){ if(it.rot%360!==0){overlay.querySelectorAll(".snapline").forEach(n=>n.remove());return{x:nx,y:ny};} return snapBox(nx,ny,it.w,it.h,it.id); }

function startMove(e,it){
  e.stopPropagation(); select(it.id);
  const st=ptMm(e), ix=it.x, iy=it.y;
  const mv=ev=>{const p=ptMm(ev); let nx=snap(ix+(p.x-st.x)), ny=snap(iy+(p.y-st.y));
    const sn=applySnap(it,nx,ny); it.x=sn.x; it.y=sn.y; updateItemEl(it); drawSelBoxOnly(it);};
  const up=()=>{overlay.querySelectorAll(".snapline").forEach(n=>n.remove());window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);renderProps();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);
}
function startResize(e,it,pos){
  e.stopPropagation(); const cx=it.x+it.w/2, cy=it.y+it.h/2, w0=it.w, h0=it.h;
  const mv=ev=>{const p=ptMm(ev); let[lx,ly]=rotv(p.x-cx,p.y-cy,-it.rot);
    const s=Math.max(Math.abs(lx)/(w0/2),Math.abs(ly)/(h0/2)); const nw=Math.max(5,w0*s), nh=Math.max(5,h0*s);
    it.w=snap(nw);it.h=snap(nh);it.x=snap(cx-nw/2);it.y=snap(cy-nh/2);updateItemEl(it);drawSelBoxOnly(it);};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);renderProps();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);
}
function startRotate(e,it){
  e.stopPropagation(); const cx=it.x+it.w/2, cy=it.y+it.h/2;
  const mv=ev=>{const p=ptMm(ev); let a=Math.atan2(p.y-cy,p.x-cx)*180/Math.PI+90; if(ev.shiftKey)a=Math.round(a/15)*15; it.rot=Math.round(a*10)/10;updateItemEl(it);drawSelBoxOnly(it);};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);renderProps();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);
}
function startPan(e,obj){
  e.stopPropagation();
  const isId=(obj===state.id), [pw,ph]=paperMm();
  const fw=Math.max(1,(isId?state.id.cw:pw)*SPP()), fh=Math.max(1,(isId?state.id.ch:ph)*SPP()); // 프레임 화면크기 → 프레임 가로지르면 포커스 100% 이동(자연스러움)
  const st={x:e.clientX,y:e.clientY}, ox=obj.ox, oy=obj.oy;
  const mv=ev=>{obj.ox=Math.min(100,Math.max(0,ox-(ev.clientX-st.x)/fw*100));obj.oy=Math.min(100,Math.max(0,oy-(ev.clientY-st.y)/fh*100));
    page.querySelectorAll(".cell img,.item img").forEach(im=>{im.style.objectPosition=`${obj.ox}% ${obj.oy}%`;if(obj.zoom!=null)im.style.transformOrigin=`${obj.ox}% ${obj.oy}%`;});};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);scheduleHistory();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);
}
function updateItemEl(it){const el=page.querySelector(`.item[data-id="${it.id}"]`);if(!el)return;
  el.style.left=it.x+"mm";el.style.top=it.y+"mm";el.style.width=it.w+"mm";el.style.height=it.h+"mm";el.style.transform=`rotate(${it.rot}deg)`;
  el.querySelector("img").style.objectFit=it.fit;scheduleHistory();}
function drawSelBoxOnly(it){const box=overlay.querySelector(".sel-box");if(!box)return;const s=SPP();
  box.style.left=(it.x*s)+"px";box.style.top=(it.y*s)+"px";box.style.width=(it.w*s)+"px";box.style.height=(it.h*s)+"px";box.style.transform=`rotate(${it.rot}deg)`;}
function select(id){state.sel=id;drawSelection();renderProps();}
page.addEventListener("pointerdown",e=>{if(e.target===page||e.target.classList.contains("grid-ov")||e.target.classList.contains("safe")||e.target.classList.contains("texture-ov")){state.sel=null;state.selText=null;state.selDeco=null;page.querySelectorAll(".textbox.sel,.deco.sel").forEach(n=>n.classList.remove("sel"));drawSelection();render();}});

/* ============================================================ PROPS panel */
function colorPanelHTML(adj,pfx){
  const P=["원본","자동","비비드","인물","흑백","세피아"];
  return `<div class="csec">
    <div class="ch">색 보정 <button class="mini-reset" id="${pfx}_reset">초기화</button></div>
    <div class="slab"><span>밝기</span><b id="${pfx}_brightV">${adj.bright}</b></div><input type="range" class="slider" id="${pfx}_bright" min="50" max="150" value="${adj.bright}">
    <div class="slab"><span>대비</span><b id="${pfx}_contrastV">${adj.contrast}</b></div><input type="range" class="slider" id="${pfx}_contrast" min="50" max="150" value="${adj.contrast}">
    <div class="slab"><span>채도</span><b id="${pfx}_satV">${adj.sat}</b></div><input type="range" class="slider" id="${pfx}_sat" min="0" max="200" value="${adj.sat}">
    <div class="slab"><span>색온도 <span style="color:#c98">↔따뜻</span></span><b id="${pfx}_warmV">${adj.warm}</b></div><input type="range" class="slider" id="${pfx}_warm" min="-100" max="100" value="${adj.warm}">
    <div class="slab"><span>색조 <span style="color:#a6a">↔자홍</span></span><b id="${pfx}_tintV">${adj.tint}</b></div><input type="range" class="slider" id="${pfx}_tint" min="-100" max="100" value="${adj.tint}">
    <div class="presets" id="${pfx}_presets">${P.map(n=>`<button data-p="${n}" class="${adj.preset===n?"on":""}">${n}</button>`).join("")}</div>
  </div>`;
}
function bindColorPanel(adj,pfx,after){
  const num=id=>parseInt($("#"+id).value);
  ["bright","contrast","sat","warm","tint"].forEach(k=>{
    $("#"+pfx+"_"+k).addEventListener("input",()=>{adj[k]=num(pfx+"_"+k);$("#"+pfx+"_"+k+"V").textContent=adj[k];adj.preset="";markPresets(pfx,"");retone();(after||(()=>{}))();});
  });
  $("#"+pfx+"_reset").addEventListener("click",()=>{Object.assign(adj,newAdj());renderProps();retone();(after||(()=>{}))();});
  $("#"+pfx+"_presets").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;applyPreset(adj,b.dataset.p);renderProps();retone();(after||(()=>{}))();});
}
function markPresets(pfx,name){const box=$("#"+pfx+"_presets");if(box)[...box.children].forEach(b=>b.classList.toggle("on",b.dataset.p===name));}
function applyPreset(adj,name){
  const base=newAdj(); adj.preset=name;
  if(name==="원본"){Object.assign(adj,newAdj());adj.preset="원본";}
  else if(name==="자동"){Object.assign(adj,base,{bright:104,contrast:108,sat:107,warm:5,preset:"자동"});}
  else if(name==="비비드"){Object.assign(adj,base,{bright:101,contrast:112,sat:138,preset:"비비드"});}
  else if(name==="인물"){Object.assign(adj,base,{bright:104,contrast:97,sat:95,warm:9,preset:"인물"});}
  else if(name==="흑백"){Object.assign(adj,base,{contrast:106,mono:true,preset:"흑백"});}
  else if(name==="세피아"){Object.assign(adj,base,{sepia:true,warm:15,preset:"세피아"});}
}

function renderTextProps(t){
  const el=()=>page.querySelector(`.textbox[data-tid="${t.id}"]`);
  propsMount.innerHTML=`<div class="props"><header>텍스트 속성</header><div class="body">
    <label class="f">내용</label><textarea id="tx_text" rows="3" style="width:100%;resize:vertical;font-size:12.5px;padding:6px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink)">${t.text.replace(/</g,"&lt;")}</textarea>
    <div class="row2" style="margin-top:6px"><div><label class="f">폰트</label><select id="tx_font">${(()=>{const g={};Object.entries(FONTS_DEF).forEach(([k,v])=>{(g[v.group]=g[v.group]||[]).push([k,v.label]);});const cur=FONTS_DEF[t.font]?t.font:(FONT_ALIAS[t.font]||"pen");return Object.entries(g).map(([grp,its])=>`<optgroup label="${grp}">`+its.map(([k,l])=>`<option value="${k}" ${cur===k?"selected":""}>${l}</option>`).join("")+`</optgroup>`).join("");})()}</select></div>
    <div><label class="f">크기 mm</label><input type="number" id="tx_size" value="${t.size}" min="2" max="60" step="0.5"></div></div>
    <div class="row2" style="margin-top:6px"><div><label class="f">색</label><input type="color" id="tx_color" value="${t.color}" style="width:100%;height:30px;padding:2px;border:1px solid var(--line);border-radius:7px;background:var(--panel);cursor:pointer"></div>
    <div style="display:flex;align-items:flex-end"><label class="check"><input type="checkbox" id="tx_bold" ${t.bold?"checked":""}> 굵게</label></div></div>
    <label class="f" style="margin-top:6px">정렬(여러 줄)</label>
    <div class="seg"><button id="tx_al_left" class="${t.align==="left"?"on":""}">왼쪽</button><button id="tx_al_center" class="${t.align==="center"?"on":""}">가운데</button><button id="tx_al_right" class="${t.align==="right"?"on":""}">오른쪽</button></div>
    <label class="f">회전 <b id="tx_rotV" style="color:var(--ink)">${t.rot||0}</b>°</label><input type="range" class="slider" id="tx_rot" min="-90" max="90" value="${t.rot||0}">
    <label class="f">불투명 <b id="tx_opV" style="color:var(--ink)">${t.opacity==null?100:t.opacity}</b>%</label><input type="range" class="slider" id="tx_op" min="10" max="100" value="${t.opacity==null?100:t.opacity}">
    <label class="f">자간 (에디토리얼) <b id="tx_trkV" style="color:var(--ink)">${Math.round((t.tracking||0)*100)}</b></label><input type="range" class="slider" id="tx_trk" min="0" max="60" value="${Math.round((t.tracking||0)*100)}">
    <div class="row2" style="margin-top:6px"><div><label class="f">X mm</label><input type="number" id="tx_x" value="${t.x}" step="0.5"></div><div><label class="f">Y mm</label><input type="number" id="tx_y" value="${t.y}" step="0.5"></div></div>
    <div class="row" style="margin-top:9px"><button class="btn sm" id="tx_dup" style="flex:1">복제</button><button class="btn sm" id="tx_del" style="flex:1;color:#c0392b">삭제</button></div>
    <div class="hint" style="padding:6px 0 0">드래그로 이동 · 방향키 미세이동 · Delete 삭제</div>
  </div></div>`;
  const E=el();
  $("#tx_text").addEventListener("input",()=>{t.text=$("#tx_text").value;const n=el();if(n)n.textContent=t.text;scheduleHistory();});
  $("#tx_font").addEventListener("change",()=>{t.font=$("#tx_font").value;const n=el();if(n)n.style.fontFamily=FONT_STACK[t.font];scheduleHistory();});
  $("#tx_size").addEventListener("input",()=>{t.size=Math.max(2,+$("#tx_size").value||8);const n=el();if(n)n.style.fontSize=t.size+"mm";scheduleHistory();});
  $("#tx_color").addEventListener("input",()=>{t.color=$("#tx_color").value;const n=el();if(n)n.style.color=t.color;scheduleHistory();});
  $("#tx_bold").addEventListener("change",()=>{t.bold=$("#tx_bold").checked;const n=el();if(n)n.style.fontWeight=t.bold?"700":"400";scheduleHistory();});
  ["left","center","right"].forEach(a=>{$("#tx_al_"+a).addEventListener("click",()=>{t.align=a;["left","center","right"].forEach(b=>$("#tx_al_"+b).classList.toggle("on",b===a));const n=el();if(n)n.style.textAlign=a;scheduleHistory();});});
  $("#tx_rot").addEventListener("input",()=>{t.rot=+$("#tx_rot").value;$("#tx_rotV").textContent=t.rot;const n=el();if(n)n.style.transform=`rotate(${t.rot}deg)`;scheduleHistory();});
  $("#tx_op").addEventListener("input",()=>{t.opacity=+$("#tx_op").value;$("#tx_opV").textContent=t.opacity;const n=el();if(n)n.style.opacity=t.opacity/100;scheduleHistory();});
  $("#tx_trk").addEventListener("input",()=>{t.tracking=+$("#tx_trk").value/100;$("#tx_trkV").textContent=$("#tx_trk").value;const n=el();if(n)n.style.letterSpacing=t.tracking+"em";scheduleHistory();});
  $("#tx_x").addEventListener("input",()=>{t.x=+$("#tx_x").value||0;const n=el();if(n)n.style.left=t.x+"mm";scheduleHistory();});
  $("#tx_y").addEventListener("input",()=>{t.y=+$("#tx_y").value||0;const n=el();if(n)n.style.top=t.y+"mm";scheduleHistory();});
  $("#tx_dup").addEventListener("click",()=>{const n={...t,id:uid++,x:t.x+5,y:t.y+5};state.texts.push(n);state.selText=n.id;render();});
  $("#tx_del").addEventListener("click",()=>{state.texts=state.texts.filter(x=>x.id!==t.id);state.selText=null;render();});
}
function renderProps(){
  propsMount.innerHTML=""; let html="";
  if(state.selDeco!=null){const d=state.decos.find(x=>x.id===state.selDeco);if(d){renderDecoProps(d);return;}state.selDeco=null;}
  if(state.selText!=null){const t=state.texts.find(x=>x.id===state.selText);if(t){renderTextProps(t);return;}state.selText=null;}
  if(state.mode==="free"){
    const it=state.items.find(i=>i.id===state.sel);
    if(!it){ html=`<div class="props"><header>정렬 도구</header><div class="body">
      <div class="hint" style="padding:0 0 6px">사진을 선택하면 개별 속성이 열립니다.</div>
      <button class="btn sm" id="a_arrange">▦ 전체 균등 배치</button></div></div>`;
      propsMount.innerHTML=html; if($("#a_arrange"))$("#a_arrange").addEventListener("click",autoArrange); return;
    }
    html=`<div class="props"><header>사진 속성 <span style="text-transform:none;letter-spacing:0">${it.w}×${it.h}mm</span></header><div class="body">
      ${dpiLineFor(imgById(it.src),it.w,it.h,it.fit)}
      <div class="row2"><div><label class="f">X mm</label><input type="number" id="p_x" value="${it.x}" step="0.5"></div><div><label class="f">Y mm</label><input type="number" id="p_y" value="${it.y}" step="0.5"></div></div>
      <div class="row2"><div><label class="f">가로 mm</label><input type="number" id="p_w" value="${it.w}" step="0.5" min="5"></div><div><label class="f">세로 mm</label><input type="number" id="p_h" value="${it.h}" step="0.5" min="5"></div></div>
      <label class="check" style="margin-top:9px"><input type="checkbox" id="p_lock" ${it.lock!==false?"checked":""}> 비율 고정</label>
      <label class="check"><input type="checkbox" id="p_circle" ${it.circle?"checked":""}> 원형 크롭</label>
      <label class="f">회전 <b id="p_rotV" style="color:var(--ink)">${it.rot}</b>°</label><input type="range" class="slider" id="p_rot" min="-180" max="180" value="${it.rot}">
      <label class="f">채우기</label><div class="seg"><button id="fit_contain" class="${it.fit==="contain"?"on":""}">전체(여백)</button><button id="fit_cover" class="${it.fit==="cover"?"on":""}">채움(자름)</button></div>
      <label class="f">사진 프레임</label><div class="seg wrap4" id="pfrSeg">${["plain:없음","polaroid:폴라로이드","film:필름","sketch:스케치"].map(o=>{const[v,l]=o.split(":");return `<button data-fr="${v}" class="${(it.frameStyle||'plain')===v?'on':''}">${l}</button>`;}).join("")}</div>
      <label class="f">정렬(용지 기준)</label>
      <div class="align">
        <button data-al="L" title="왼쪽">⇤</button><button data-al="CH" title="가로중앙">↔</button><button data-al="R" title="오른쪽">⇥</button>
        <button data-al="T" title="위">⤒</button><button data-al="CV" title="세로중앙">↕</button><button data-al="B" title="아래">⤓</button>
      </div>
      ${colorPanelHTML(it.adj,"c")}
      <div class="actions"><button id="p_back">뒤로</button><button id="p_front">앞으로</button><button id="p_dup">복제</button></div>
      <div class="actions"><button class="del" id="p_del">삭제</button></div>
    </div></div>`;
    propsMount.innerHTML=html;
    const num=id=>parseFloat($("#"+id).value)||0, aspect=it.w/it.h, upd=()=>{updateItemEl(it);drawSelection();};
    $("#p_x").addEventListener("input",()=>{it.x=num("p_x");upd();});
    $("#p_y").addEventListener("input",()=>{it.y=num("p_y");upd();});
    $("#p_w").addEventListener("input",()=>{it.w=Math.max(5,num("p_w"));if($("#p_lock").checked)it.h=snap(it.w/aspect);upd();renderProps();});
    $("#p_h").addEventListener("input",()=>{it.h=Math.max(5,num("p_h"));if($("#p_lock").checked)it.w=snap(it.h*aspect);upd();renderProps();});
    $("#p_lock").addEventListener("change",()=>{it.lock=$("#p_lock").checked;});
    $("#p_circle").addEventListener("change",()=>{it.circle=$("#p_circle").checked;render();});
    $("#p_rot").addEventListener("input",()=>{it.rot=+$("#p_rot").value;$("#p_rotV").textContent=it.rot;upd();});
    $("#fit_contain").addEventListener("click",()=>{it.fit="contain";updateItemEl(it);renderProps();});
    $("#fit_cover").addEventListener("click",()=>{it.fit="cover";updateItemEl(it);renderProps();});
    $("#pfrSeg").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{it.frameStyle=b.dataset.fr;render();}));
    document.querySelector(".align").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;alignItem(it,b.dataset.al);upd();renderProps();});
    bindColorPanel(it.adj,"c");
    $("#p_del").addEventListener("click",()=>{state.items=state.items.filter(i=>i.id!==it.id);state.sel=null;render();});
    $("#p_dup").addEventListener("click",()=>{const n=JSON.parse(JSON.stringify(it));n.id=uid++;n.x+=5;n.y+=5;state.items.push(n);state.sel=n.id;render();});
    $("#p_front").addEventListener("click",()=>{state.items=state.items.filter(i=>i.id!==it.id).concat(it);render();});
    $("#p_back").addEventListener("click",()=>{state.items=[it].concat(state.items.filter(i=>i.id!==it.id));render();});
  }
  else if(state.mode==="fill"){
    html=`<div class="props"><header>꽉 채우기</header><div class="body">
      ${dpiLineFor(imgById(state.fill.id),paperMm()[0],paperMm()[1],"cover")}
      <div class="hint" style="padding:0 0 6px">이미지를 드래그해 위치를, 아래로 확대를 조절하세요.</div>
      <label class="f">확대 <b style="color:var(--ink)" id="f_zoomV">${state.fill.zoom.toFixed(2)}</b>×</label>
      <input type="range" class="slider" id="f_zoom" min="1" max="3" step="0.01" value="${state.fill.zoom}">
      ${colorPanelHTML(state.fill.adj,"c")}
      <div class="actions"><button id="f_reset">위치·확대 초기화</button></div>
    </div></div>`;
    propsMount.innerHTML=html;
    $("#f_zoom").addEventListener("input",()=>{state.fill.zoom=+$("#f_zoom").value;$("#f_zoomV").textContent=state.fill.zoom.toFixed(2);const im=page.querySelector(".item img");if(im)im.style.transform=`scale(${state.fill.zoom})`;});
    bindColorPanel(state.fill.adj,"c");
    $("#f_reset").addEventListener("click",()=>{state.fill.zoom=1;state.fill.ox=50;state.fill.oy=50;render();});
  }
  else if(state.mode==="id"){
    const opts=Object.keys(ID_PRESETS).map(k=>`<option value="${k}" ${state.id.preset===k?"selected":""}>${k}</option>`).join("");
    html=`<div class="props"><header>증명·여권 <span style="text-transform:none;letter-spacing:0">${state.id._count||0}장</span></header><div class="body">
      ${dpiLineFor(imgById(state.id.srcId),state.id.cw,state.id.ch,"cover")}
      <label class="f">규격 프리셋</label><select id="id_preset">${opts}</select>
      <div class="row2"><div><label class="f">가로 mm</label><input type="number" id="id_cw" value="${state.id.cw}" step="0.5" min="10"></div><div><label class="f">세로 mm</label><input type="number" id="id_ch" value="${state.id.ch}" step="0.5" min="10"></div></div>
      <label class="f">간격 mm <b style="color:var(--ink)" id="id_gapV">${state.id.gap}</b></label><input type="range" class="slider" id="id_gap" min="0" max="12" step="0.5" value="${state.id.gap}">
      <label class="f">사진 크기(줌) <b style="color:var(--ink)" id="id_zoomV">${Math.round((state.id.zoom||1)*100)}</b>%</label><input type="range" class="slider" id="id_zoom" min="100" max="300" step="1" value="${Math.round((state.id.zoom||1)*100)}">
      <label class="check"><input type="checkbox" id="id_guides" ${state.id.guides?"checked":""}> 재단선 표시</label>
      <label class="check"><input type="checkbox" id="id_auto" ${state.id.autoMax?"checked":""}> 매수 최대화 (용지 방향 자동)</label>
      <label class="check"><input type="checkbox" id="id_face" ${state.id.faceGuide?"checked":""}> 얼굴 가이드라인 (국가 규격)</label>
      ${state.id.faceGuide?(()=>{const gd=(ID_PRESETS[state.id.preset]||{}).guide;return gd?`<div class="hint" style="padding:3px 0 0">머리높이 ${(gd.head-gd.tol).toFixed(0)}~${(gd.head+gd.tol).toFixed(0)}mm${gd.top!=null?` · 상단여백 ${gd.top}mm`:""}${gd.eyeFromBottom!=null?` · 눈높이(바닥) ${(gd.eyeFromBottom-gd.eyeTol).toFixed(0)}~${(gd.eyeFromBottom+gd.eyeTol).toFixed(0)}mm`:""}<br><span style="color:#c98">※ 참고용 — 발급기관 최신 규정 확인 필요 · 인쇄엔 표시 안 됨</span></div>`:`<div class="hint" style="padding:3px 0 0">이 규격은 얼굴 가이드가 없습니다.</div>`;})():""}
      <div class="hint" style="padding:6px 0 0"><b style="color:var(--ink)">${state.id._count||0}장</b> · 용지 방향 ${(()=>{const p=PAPERS[state.paper]==="custom"?[state.cw,state.ch]:PAPERS[state.paper];const o=state.id.autoMax?idBestOrient(p[0],p[1]):state.orient;return o==="landscape"?"가로":"세로";})()}<br>사진을 드래그해 얼굴 위치를 맞추세요.</div>
      ${colorPanelHTML(state.id.adj,"c")}
    </div></div>`;
    propsMount.innerHTML=html;
    $("#id_preset").addEventListener("change",()=>{const k=$("#id_preset").value;state.id.preset=k;const p=ID_PRESETS[k];state.id.cw=p.w;state.id.ch=p.h;render();fit();});
    $("#id_cw").addEventListener("input",()=>{state.id.cw=Math.max(10,parseFloat($("#id_cw").value)||35);render();fit();});
    $("#id_ch").addEventListener("input",()=>{state.id.ch=Math.max(10,parseFloat($("#id_ch").value)||45);render();fit();});
    $("#id_gap").addEventListener("input",()=>{state.id.gap=+$("#id_gap").value;render();});
    $("#id_zoom").addEventListener("input",()=>{state.id.zoom=+$("#id_zoom").value/100;$("#id_zoomV").textContent=$("#id_zoom").value;page.querySelectorAll(".cell img").forEach(im=>im.style.transform=`scale(${state.id.zoom})`);scheduleHistory();});
    $("#id_guides").addEventListener("change",()=>{state.id.guides=$("#id_guides").checked;render();});
    $("#id_auto").addEventListener("change",()=>{state.id.autoMax=$("#id_auto").checked;render();fit();});
    $("#id_face").addEventListener("change",()=>{state.id.faceGuide=$("#id_face").checked;render();});
    bindColorPanel(state.id.adj,"c");
  }
  else if(state.mode==="grid"){
    const G=state.grid, std=Object.keys(STD_SIZES).map(k=>`<option value="${k}" ${G.std===k?"selected":""}>${k}</option>`).join("");
    html=`<div class="props"><header>분할·콜라주 <span style="text-transform:none;letter-spacing:0">${G._count||0}칸</span></header><div class="body">
      ${state.library.length?dpiLineFor(minLibRec(),gridCellMm()[0],gridCellMm()[1],G.fit):""}
      <label class="f">방식</label><div class="seg"><button id="gk_even" class="${G.kind==="even"?"on":""}">균등 분할</button><button id="gk_size" class="${G.kind==="size"?"on":""}">표준 사이즈</button></div>
      <div id="g_even" style="display:${G.kind==="even"?"block":"none"}">
        <label class="f">빠른 배치</label>
        <div class="align" style="grid-template-columns:repeat(5,1fr)"><button data-q="1">1</button><button data-q="2">2</button><button data-q="4">4</button><button data-q="8">8</button><button data-q="idx">인덱스</button></div>
        <div class="row2" style="margin-top:8px"><div><label class="f">행</label><input type="number" id="g_rows" value="${G.rows}" min="1" max="12"></div><div><label class="f">열</label><input type="number" id="g_cols" value="${G.cols}" min="1" max="12"></div></div>
      </div>
      <div id="g_size" style="display:${G.kind==="size"?"block":"none"}">
        <label class="f">표준 크기</label><select id="g_std">${std}</select>
        <div class="row2"><div><label class="f">가로 mm</label><input type="number" id="g_cw" value="${G.cw}" step="1" min="10"></div><div><label class="f">세로 mm</label><input type="number" id="g_ch" value="${G.ch}" step="1" min="10"></div></div>
      </div>
      <label class="f">간격 mm <b style="color:var(--ink)" id="g_gapV">${G.gap}</b></label><input type="range" class="slider" id="g_gap" min="0" max="20" step="0.5" value="${G.gap}">
      <label class="f">채우기</label><div class="seg"><button id="g_cover" class="${G.fit==="cover"?"on":""}">채움</button><button id="g_contain" class="${G.fit==="contain"?"on":""}">전체</button></div>
      <label class="check"><input type="checkbox" id="g_guides" ${G.guides?"checked":""}> 재단선 표시</label>
      ${colorPanelHTML(G.adj,"c")}
    </div></div>`;
    propsMount.innerHTML=html;
    $("#gk_even").addEventListener("click",()=>{G.kind="even";render();});
    $("#gk_size").addEventListener("click",()=>{G.kind="size";render();});
    if($("#g_rows")){$("#g_rows").addEventListener("input",()=>{G.rows=Math.max(1,parseInt($("#g_rows").value)||1);render();});
      $("#g_cols").addEventListener("input",()=>{G.cols=Math.max(1,parseInt($("#g_cols").value)||1);render();});
      document.querySelector("#g_even .align").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;quickSplit(b.dataset.q);render();});}
    if($("#g_std")){$("#g_std").addEventListener("change",()=>{G.std=$("#g_std").value;const[w,h]=STD_SIZES[G.std];G.cw=w;G.ch=h;render();});
      $("#g_cw").addEventListener("input",()=>{G.cw=Math.max(10,parseFloat($("#g_cw").value)||100);render();});
      $("#g_ch").addEventListener("input",()=>{G.ch=Math.max(10,parseFloat($("#g_ch").value)||150);render();});}
    $("#g_gap").addEventListener("input",()=>{G.gap=+$("#g_gap").value;render();});
    $("#g_cover").addEventListener("click",()=>{G.fit="cover";render();});
    $("#g_contain").addEventListener("click",()=>{G.fit="contain";render();});
    $("#g_guides").addEventListener("change",()=>{G.guides=$("#g_guides").checked;render();});
    bindColorPanel(G.adj,"c");
  }
  else if(state.mode==="order"){ renderOrderPanel(); }
}
function quickSplit(q){const G=state.grid,port=state.orient==="portrait";
  if(q==="1"){G.rows=1;G.cols=1;} else if(q==="2"){if(port){G.rows=2;G.cols=1;}else{G.rows=1;G.cols=2;}}
  else if(q==="4"){G.rows=2;G.cols=2;} else if(q==="8"){if(port){G.rows=4;G.cols=2;}else{G.rows=2;G.cols=4;}}
  else if(q==="idx"){if(port){G.rows=7;G.cols=5;}else{G.rows=5;G.cols=7;}}}

/* alignment */
function alignItem(it,al){const u=usableMm();
  if(al==="L")it.x=snap(u.x); else if(al==="R")it.x=snap(u.x+u.w-it.w); else if(al==="CH")it.x=snap(u.x+(u.w-it.w)/2);
  else if(al==="T")it.y=snap(u.y); else if(al==="B")it.y=snap(u.y+u.h-it.h); else if(al==="CV")it.y=snap(u.y+(u.h-it.h)/2);}
function autoArrange(){const n=state.items.length;if(!n)return;const u=usableMm();
  const cols=Math.ceil(Math.sqrt(n)), rows=Math.ceil(n/cols), g=4;
  const cw=(u.w-(cols-1)*g)/cols, ch=(u.h-(rows-1)*g)/rows;
  state.items.forEach((it,i)=>{const r=Math.floor(i/cols),c=i%cols;const im=imgById(it.src);const ar=im?im.w/im.h:it.w/it.h;
    let w=cw,h=w/ar; if(h>ch){h=ch;w=h*ar;} it.rot=0;it.w=snap(w);it.h=snap(h);
    it.x=snap(u.x+c*(cw+g)+(cw-w)/2);it.y=snap(u.y+r*(ch+g)+(ch-h)/2);});
  render();}
function applyCollage(p){
  const pool=state.library.length?state.library:SAMPLES; // 사진 없으면 예시 이미지로 미리보기
  if(p.orient==="square"){ if(!/정사각/.test(state.paper)) state.paper="정사각 (210×210)"; }
  else { if(/정사각/.test(state.paper)) state.paper="A4 (210×297)"; if(p.orient) state.orient=p.orient; }
  state.borderless=true; state.bg=p.bg||"#ffffff";
  state.frame={on:!!(p.frame&&p.frame.on), w:(p.frame&&p.frame.w)||3, color:(p.frame&&p.frame.color)||"#ffffff", radius:(p.frame&&p.frame.radius)||0};
  state.mode="free"; state.items=[]; state.sel=null;
  applyPageSize(); const u=usableMm();
  const tone=p.tone?CTONE[p.tone]:null;
  p.slots.forEach((s,i)=>{const rec=pool[i%pool.length];
    const o=Array.isArray(s)?{x:s[0],y:s[1],w:s[2],h:s[3],rot:s[4]||0,shape:s[5]==="c"?"circle":"rect"}:s;
    state.items.push({id:uid++, src:rec.id, x:snap(u.x+o.x*u.w), y:snap(u.y+o.y*u.h), w:snap(o.w*u.w), h:snap(o.h*u.h), rot:o.rot||0, fit:"cover", lock:true, circle:o.shape==="circle", frameStyle:o.frame||"plain", frameColor:o.frameColor, adj:tone?{...newAdj(),...tone}:newAdj()});});
  const [tpw,tph]=paperMm();
  state.texture=p.texture||"none";
  state.texts=(p.texts||[]).map(t=>({id:uid++,x:Math.round(t.x*tpw*10)/10,y:Math.round(t.y*tph*10)/10,text:t.text||"텍스트",font:t.font||"pen",size:t.size||8,color:t.color||"#333333",bold:!!t.bold,align:t.align||"left",rot:t.rot||0,opacity:t.opacity==null?100:t.opacity,tracking:t.tracking||0}));
  state.decos=(p.decos||[]).map(d=>({id:uid++,type:d.type,x:Math.round(d.x*tpw*10)/10,y:Math.round(d.y*tph*10)/10,size:Math.round((d.size||0.1)*tpw*10)/10,ar:d.ar,rot:d.rot||0,color:d.color,opacity:d.opacity==null?100:d.opacity}));
  state.selText=null; state.selDeco=null;
  syncControls();
  [...$("#modes").children].forEach(x=>x.classList.toggle("on",x.dataset.mode==="free"));
  render(); fit();
}

/* ============================================================ TEXTS (다중 캡션) */
function renderTexts(){
  state.texts.forEach(t=>{
    const el=document.createElement("div");el.className="textbox"+(state.selText===t.id?" sel":"");el.dataset.tid=t.id;
    el.style.left=t.x+"mm";el.style.top=t.y+"mm";el.style.fontSize=t.size+"mm";
    el.style.fontFamily=FONT_STACK[t.font]||FONT_STACK.sans;el.style.fontWeight=t.bold?"700":"400";
    el.style.letterSpacing=(t.tracking||0)+"em";
    const al=t.align||"left";
    el.style.color=t.color;el.style.textAlign=al;el.style.opacity=(t.opacity==null?100:t.opacity)/100;
    // align = 앵커 모서리: left→x가 왼끝, center→x가 중앙, right→x가 오른끝 (잘림 방지)
    el.style.transformOrigin=(al==="center"?"center":al==="right"?"right":"left")+" top";
    const shift=al==="center"?"translateX(-50%) ":al==="right"?"translateX(-100%) ":"";
    el.style.transform=`${shift}rotate(${t.rot||0}deg)`;el.textContent=t.text;
    el.addEventListener("pointerdown",e=>startTextMove(e,t));
    page.appendChild(el);
  });
}
function selectText(id){
  state.selText=id; state.sel=null;
  page.querySelectorAll(".textbox").forEach(n=>n.classList.toggle("sel",n.dataset.tid===String(id)));
  drawSelection(); renderProps();
}
function startTextMove(e,t){
  e.stopPropagation();
  if(state.selText!==t.id) selectText(t.id);
  const st=ptMm(e), ix=t.x, iy=t.y, el=page.querySelector(`.textbox[data-tid="${t.id}"]`);
  const mv=ev=>{const p=ptMm(ev);let nx=ix+p.x-st.x, ny=iy+p.y-st.y;
    if((t.rot||0)%360===0 && el){const r=el.getBoundingClientRect(),w=r.width/SPP(),h=r.height/SPP(),al=t.align||"left",offL=al==="center"?w/2:al==="right"?w:0;
      const sn=snapBox(nx-offL,ny,w,h,null);nx=sn.x+offL;ny=sn.y;} else overlay.querySelectorAll(".snapline").forEach(n=>n.remove());
    t.x=Math.round(nx*10)/10;t.y=Math.round(ny*10)/10;
    if(el){el.style.left=t.x+"mm";el.style.top=t.y+"mm";}};
  const up=()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up);overlay.querySelectorAll(".snapline").forEach(n=>n.remove());syncTextInputs(t);scheduleHistory();};
  window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);
}
function syncTextInputs(t){if($("#tx_x"))$("#tx_x").value=t.x;if($("#tx_y"))$("#tx_y").value=t.y;}
function addTextBlock(){
  const [pw,ph]=paperMm();
  const t={id:uid++,x:Math.round(pw*0.3),y:Math.round(ph*0.45),text:"텍스트 입력",font:"pen",size:8,color:"#333333",bold:false,align:"left",rot:0,opacity:100};
  state.texts.push(t); state.selText=t.id; state.sel=null; render();
}
/* 내보내기 전 사용 폰트 로드 보장(캔버스 fillText가 폴백으로 굽는 것 방지) */
async function ensureTextFonts(){
  if(!document.fonts||!document.fonts.load)return;
  const jobs=[];
  state.texts.forEach(t=>{const m=(FONT_STACK[t.font]||"").match(/"([^"]+)"/);if(m){try{jobs.push(document.fonts.load(`${t.bold?"700":"400"} 40px "${m[1]}"`,String(t.text||"가")));}catch(e){}}});
  try{await Promise.all(jobs);}catch(e){}
}
/* 내보내기(PNG/JPG/PDF) 캔버스에 텍스트 bake — DOM(line-height 1.28)과 동일 공식 */
function drawTextsCanvas(ctx,ppm){
  state.texts.forEach(t=>{
    const px=t.size*ppm, stack=FONT_STACK[t.font]||FONT_STACK.sans;
    ctx.save();ctx.font=`${t.bold?"700":"400"} ${px}px ${stack}`;
    try{ctx.letterSpacing=((t.tracking||0)*px)+"px";}catch(e){}
    ctx.globalAlpha=(t.opacity==null?100:t.opacity)/100;ctx.fillStyle=t.color;ctx.textBaseline="alphabetic";
    const lines=String(t.text).split("\n"), lh=px*1.28, al=t.align||"left";
    const widths=lines.map(l=>ctx.measureText(l).width), maxW=Math.max(1,...widths), H=lines.length*lh;
    // align = 앵커 모서리(DOM과 동일): left→x가 왼끝, center→중앙, right→오른끝
    const blockLeft=al==="center"?t.x*ppm-maxW/2:al==="right"?t.x*ppm-maxW:t.x*ppm;
    const cx=blockLeft+maxW/2, cy=t.y*ppm+H/2;
    ctx.translate(cx,cy); if(t.rot)ctx.rotate(t.rot*Math.PI/180);
    lines.forEach((l,i)=>{const ox=t.align==="center"?(maxW-widths[i])/2:t.align==="right"?(maxW-widths[i]):0;
      ctx.fillText(l,-maxW/2+ox,-H/2+i*lh+px*0.86);});
    ctx.restore();
  });
}

/* ============================================================ LIBRARY */
function addFiles(files){[...files].filter(f=>f.type.startsWith("image/")).forEach(f=>{const rd=new FileReader();
  rd.onload=()=>{const im=new Image();im.onload=()=>{const rec={id:uid++,src:rd.result,w:im.naturalWidth,h:im.naturalHeight,name:f.name};state.library.push(rec);
    if(state.mode==="free")addFreeItem(rec); if(state.mode==="fill"&&!state.fill.id)state.fill.id=rec.id; if(state.mode==="id"&&!state.id.srcId)state.id.srcId=rec.id;
    renderThumbs();render();};im.src=rd.result;};rd.readAsDataURL(f);});}
function addFreeItem(rec){const [pw,ph]=paperMm(),ar=rec.w/rec.h;let w=pw*0.5,h=w/ar;if(h>ph*0.6){h=ph*0.6;w=h*ar;}
  state.items.push({id:uid++,src:rec.id,x:snap((pw-w)/2),y:snap((ph-h)/2),w:snap(w),h:snap(h),rot:0,fit:"cover",lock:true,adj:newAdj()});
  state.sel=state.items[state.items.length-1].id;}
function renderThumbs(){const box=$("#thumbs");box.innerHTML="";state.library.forEach(rec=>{const t=document.createElement("div");t.className="thumb";
  if((state.mode==="fill"&&state.fill.id===rec.id)||(state.mode==="id"&&state.id.srcId===rec.id))t.classList.add("sel");
  t.innerHTML=`<img src="${rec.src}"><div class="x">×</div>`;
  t.querySelector("img").addEventListener("click",()=>{if(state.mode==="free")addFreeItem(rec);else if(state.mode==="fill")state.fill.id=rec.id;else if(state.mode==="id")state.id.srcId=rec.id;renderThumbs();render();});
  t.querySelector(".x").addEventListener("click",e=>{e.stopPropagation();state.library=state.library.filter(r=>r.id!==rec.id);state.items=state.items.filter(i=>i.src!==rec.id);
    if(state.fill.id===rec.id)state.fill.id=null;if(state.id.srcId===rec.id)state.id.srcId=null;renderThumbs();render();});
  box.appendChild(t);});}

/* ============================================================ SAVE / LOAD */
const LSKEY="smphoto:layouts";
function serialize(){return JSON.stringify({v:2,paper:state.paper,cw:state.cw,ch:state.ch,orient:state.orient,borderless:state.borderless,
  margin:state.margin,bg:state.bg,media:state.media,dpi:state.dpi,mode:state.mode,library:state.library,items:state.items,fill:state.fill,id:state.id,grid:state.grid,view:state.view,cal:state.cal,frame:state.frame,logo:state.logo,texts:state.texts,decos:state.decos,texture:state.texture,uid});}
function deserialize(str){const d=JSON.parse(str);Object.assign(state,{paper:d.paper,cw:d.cw,ch:d.ch,orient:d.orient,borderless:d.borderless,
  margin:d.margin,bg:d.bg,media:d.media||"표준 (보정 없음)",dpi:d.dpi||300,mode:d.mode,library:d.library||[],items:d.items||[],fill:d.fill,id:d.id,grid:d.grid,view:d.view||state.view,cal:d.cal||state.cal,frame:d.frame||state.frame,logo:d.logo||state.logo,texts:d.texts||[],selText:null,decos:d.decos||[],texture:d.texture||"none",selDeco:null});
  state.sel=null; uid=Math.max(d.uid||1,...state.library.map(l=>l.id),...state.items.map(i=>i.id),1)+1;
  syncControls(); renderThumbs(); render(); fit();}
function getSaved(){try{return JSON.parse(localStorage.getItem(LSKEY)||"{}");}catch(e){return {};}}
function renderSaved(){const box=$("#savedList");const all=getSaved();box.innerHTML="";
  const names=Object.keys(all);if(!names.length){box.innerHTML=`<div style="font-size:11px;color:var(--muted)">저장된 배치가 없습니다.</div>`;return;}
  names.forEach(n=>{const it=document.createElement("div");it.className="it";
    it.innerHTML=`<span class="nm" title="불러오기">${n}</span><button data-a="load" title="불러오기">↺</button><button data-a="del" title="삭제">🗑</button>`;
    it.querySelector(".nm").addEventListener("click",()=>deserialize(all[n]));
    it.querySelector('[data-a="load"]').addEventListener("click",()=>deserialize(all[n]));
    it.querySelector('[data-a="del"]').addEventListener("click",()=>{const s=getSaved();delete s[n];localStorage.setItem(LSKEY,JSON.stringify(s));renderSaved();});
    box.appendChild(it);});}
$("#saveBtn").addEventListener("click",()=>{const name=prompt("배치 이름을 입력하세요","배치 "+new Date().toLocaleString("ko-KR"));if(!name)return;
  const all=getSaved();all[name]=serialize();try{localStorage.setItem(LSKEY,JSON.stringify(all));renderSaved();}
  catch(e){alert("브라우저 저장 용량을 초과했습니다(사진이 큼). ‘파일로’ 내보내기를 사용하세요.");}});
$("#exportBtn").addEventListener("click",()=>{const blob=new Blob([serialize()],{type:"application/json"});const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="studio-print-layout.json";a.click();URL.revokeObjectURL(a.href);});
$("#importBtn").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{deserialize(rd.result);}catch(err){alert("불러올 수 없는 파일입니다.");}};rd.readAsText(f);e.target.value="";});
$("#exp_png").addEventListener("click",()=>exportImage("png"));
$("#exp_jpg").addEventListener("click",()=>exportImage("jpg"));
$("#exp_pdf").addEventListener("click",()=>exportImage("pdf"));

/* keep sidebar controls in sync after load */
function syncControls(){$("#paper").value=state.paper;$("#customWrap").style.display=PAPERS[state.paper]==="custom"?"block":"none";
  $("#cw").value=state.cw;$("#ch").value=state.ch;$("#media").value=state.media;$("#dpi").value=state.dpi;$("#bg").value=state.bg;if($("#texSel"))$("#texSel").value=state.texture||"none";if(typeof updateMediaNote==="function")updateMediaNote();
  [...$("#orient").children].forEach(x=>x.classList.toggle("on",x.dataset.o===state.orient));
  $("#borderless").checked=state.borderless;$("#marginWrap").style.display=state.borderless?"none":"block";$("#margin").value=state.margin;
  [...$("#modes").children].forEach(x=>x.classList.toggle("on",x.dataset.mode===state.mode));
  $("#v_ruler").checked=state.view.ruler;$("#v_grid").checked=state.view.grid;$("#v_snap").checked=state.view.snap;
  $("#gridStepWrap").style.display=state.view.grid?"block":"none";$("#v_step").value=state.view.step;
  $("#fr_on").checked=state.frame.on;$("#frWrap").style.display=state.frame.on?"block":"none";$("#fr_w").value=state.frame.w;$("#fr_r").value=state.frame.radius;$("#fr_c").value=state.frame.color;}

/* ============================================================ EVENTS */
$("#modes").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.mode=b.dataset.mode;state.sel=null;
  [...$("#modes").children].forEach(x=>x.classList.toggle("on",x===b));renderThumbs();render();fit();});
(function(){const sel=$("#collage");if(!sel)return;let cat="";COLLAGE_PRESETS.forEach((p,i)=>{if(p.cat!==cat){cat=p.cat;const og=document.createElement("optgroup");og.label=cat;og.id="cog_"+i;sel.appendChild(og);}sel.lastChild.appendChild(new Option(p.name,String(i)));});})();
$("#collageApply").addEventListener("click",()=>{const p=COLLAGE_PRESETS[+$("#collage").value||0];if(p)applyCollage(p);});
$("#txAdd").addEventListener("click",addTextBlock);
(function(){const pal=$("#doodlePal");if(pal){["star","sparkle","heart","dot","arrow","squiggle","spiral","scribble","check","cross","underline","rule"].forEach(t=>{const b=document.createElement("button");b.className="dgl";b.title=DECO_LABEL[t]||t;b.dataset.deco=t;b.innerHTML=doodleSVG(t,"#888");pal.appendChild(b);});}
  document.querySelectorAll("[data-deco]").forEach(b=>b.addEventListener("click",()=>addDeco(b.dataset.deco)));
  const ts=$("#texSel");if(ts)ts.addEventListener("change",()=>{state.texture=ts.value;render();});})();
$("#paper").addEventListener("change",e=>{state.paper=e.target.value;$("#customWrap").style.display=PAPERS[state.paper]==="custom"?"block":"none";render();fit();});
$("#cw").addEventListener("input",e=>{state.cw=+e.target.value||210;render();fit();});
$("#ch").addEventListener("input",e=>{state.ch=+e.target.value||297;render();fit();});
$("#orient").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.orient=b.dataset.o;[...$("#orient").children].forEach(x=>x.classList.toggle("on",x===b));render();fit();});
$("#borderless").addEventListener("change",e=>{state.borderless=e.target.checked;$("#marginWrap").style.display=e.target.checked?"none":"block";render();});
$("#margin").addEventListener("input",e=>{state.margin=+e.target.value||0;render();});
function updateMediaNote(){const n=$("#mediaNote");if(!n)return;const dv=EPSON_DRIVER[state.media];
  n.innerHTML=dv?`Epson 드라이버에서 <b>Media Type: ${dv}</b> 선택 권장. 정확한 색은 드라이버의 <b>Epson ICC 프로파일</b>로 관리하세요(앱 프리셋은 화면 근사).`:"";}
$("#media").addEventListener("change",e=>{state.media=e.target.value;updateMediaNote();applyPageSize();});
$("#dpi").addEventListener("change",e=>{state.dpi=+e.target.value;renderProps();});
$("#bg").addEventListener("input",e=>{state.bg=e.target.value;render();});
$("#fr_on").addEventListener("change",e=>{state.frame.on=e.target.checked;$("#frWrap").style.display=e.target.checked?"block":"none";render();});
$("#fr_w").addEventListener("input",e=>{state.frame.w=Math.max(0,+e.target.value||0);render();});
$("#fr_r").addEventListener("input",e=>{state.frame.radius=Math.max(0,+e.target.value||0);render();});
$("#fr_c").addEventListener("input",e=>{state.frame.color=e.target.value;render();});
$("#v_ruler").addEventListener("change",e=>{state.view.ruler=e.target.checked;drawRuler();});
$("#v_grid").addEventListener("change",e=>{state.view.grid=e.target.checked;$("#gridStepWrap").style.display=e.target.checked?"block":"none";render();});
$("#v_step").addEventListener("input",e=>{state.view.step=Math.max(1,+e.target.value||10);render();});
$("#v_snap").addEventListener("change",e=>{state.view.snap=e.target.checked;});

$("#drop").addEventListener("click",()=>$("#file").click());
$("#file").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
["dragenter","dragover"].forEach(ev=>workspace.addEventListener(ev,e=>{e.preventDefault();$("#drop").classList.add("over");}));
["dragleave","drop"].forEach(ev=>workspace.addEventListener(ev,e=>{e.preventDefault();$("#drop").classList.remove("over");}));
workspace.addEventListener("drop",e=>{if(e.dataTransfer.files.length)addFiles(e.dataTransfer.files);});
window.addEventListener("paste",e=>{if(e.clipboardData&&e.clipboardData.files.length)addFiles(e.clipboardData.files);});

window.addEventListener("keydown",e=>{if(state.mode!=="free"||state.sel==null)return;const it=state.items.find(i=>i.id===state.sel);if(!it)return;
  const tag=(e.target.tagName||"").toLowerCase();if(tag==="input"||tag==="select")return;const step=e.shiftKey?5:0.5;
  if(e.key==="ArrowLeft"){it.x=snap(it.x-step);e.preventDefault();}else if(e.key==="ArrowRight"){it.x=snap(it.x+step);e.preventDefault();}
  else if(e.key==="ArrowUp"){it.y=snap(it.y-step);e.preventDefault();}else if(e.key==="ArrowDown"){it.y=snap(it.y+step);e.preventDefault();}
  else if(e.key==="Delete"||e.key==="Backspace"){state.items=state.items.filter(i=>i.id!==it.id);state.sel=null;render();return;}
  else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="d"){e.preventDefault();const n=JSON.parse(JSON.stringify(it));n.id=uid++;n.x+=5;n.y+=5;state.items.push(n);state.sel=n.id;render();return;}
  else return; updateItemEl(it);drawSelection();renderProps();});
window.addEventListener("keydown",e=>{if(state.selText==null)return;const tag=(e.target.tagName||"").toLowerCase();if(tag==="input"||tag==="select"||tag==="textarea")return;
  const t=state.texts.find(x=>x.id===state.selText);if(!t)return;const step=e.shiftKey?5:0.5;
  if(e.key==="ArrowLeft")t.x=Math.round((t.x-step)*10)/10;else if(e.key==="ArrowRight")t.x=Math.round((t.x+step)*10)/10;
  else if(e.key==="ArrowUp")t.y=Math.round((t.y-step)*10)/10;else if(e.key==="ArrowDown")t.y=Math.round((t.y+step)*10)/10;
  else if(e.key==="Delete"||e.key==="Backspace"){state.texts=state.texts.filter(x=>x.id!==t.id);state.selText=null;render();return;}
  else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="d"){e.preventDefault();const n={...t,id:uid++,x:t.x+5,y:t.y+5};state.texts.push(n);state.selText=n.id;render();return;}
  else return;e.preventDefault();const el=page.querySelector(`.textbox[data-tid="${t.id}"]`);if(el){el.style.left=t.x+"mm";el.style.top=t.y+"mm";}syncTextInputs(t);scheduleHistory();});
window.addEventListener("keydown",e=>{if(state.selDeco==null)return;const tag=(e.target.tagName||"").toLowerCase();if(tag==="input"||tag==="select"||tag==="textarea")return;
  const d=state.decos.find(x=>x.id===state.selDeco);if(!d)return;const step=e.shiftKey?5:0.5;
  if(e.key==="ArrowLeft")d.x=Math.round((d.x-step)*10)/10;else if(e.key==="ArrowRight")d.x=Math.round((d.x+step)*10)/10;
  else if(e.key==="ArrowUp")d.y=Math.round((d.y-step)*10)/10;else if(e.key==="ArrowDown")d.y=Math.round((d.y+step)*10)/10;
  else if(e.key==="Delete"||e.key==="Backspace"){state.decos=state.decos.filter(x=>x.id!==d.id);state.selDeco=null;render();return;}
  else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="d"){e.preventDefault();const n={...d,id:uid++,x:d.x+6,y:d.y+6};state.decos.push(n);state.selDeco=n.id;render();return;}
  else return;e.preventDefault();const el=decoEl(d.id);if(el){el.style.left=d.x+"mm";el.style.top=d.y+"mm";}syncDecoInputs(d);scheduleHistory();});

/* ---------- zoom & ruler ---------- */
function fit(){const pad=state.view.ruler?96:80;const [w,h]=paperMm();
  state.scale=Math.min((workspace.clientWidth-pad)/(w*MM),(workspace.clientHeight-pad)/(h*MM));state.autoFit=true;applyPageSize();drawSelection();updateZoom();drawRuler();}
function setZoom(s){state.scale=Math.min(4,Math.max(0.05,s));state.autoFit=false;applyPageSize();drawSelection();updateZoom();drawRuler();}
function updateZoom(){$("#zLvl").textContent=Math.round(state.scale*100)+"%";}
$("#zIn").addEventListener("click",()=>setZoom(state.scale*1.15));
$("#zOut").addEventListener("click",()=>setZoom(state.scale/1.15));
$("#zFit").addEventListener("click",fit);
window.addEventListener("resize",()=>{if(state.autoFit)fit();drawRuler();});
workspace.addEventListener("scroll",drawRuler);

function drawRuler(){const c=$("#ruler");if(!state.view.ruler){c.style.display="none";return;}c.style.display="block";
  const sb=$(".sidebar").getBoundingClientRect().width;c.style.left=sb+"px";c.style.width=(window.innerWidth-sb)+"px";
  const W=window.innerWidth-sb,H=window.innerHeight;c.width=W;c.height=H;const g=c.getContext("2d");g.clearRect(0,0,W,H);
  const pr=page.getBoundingClientRect();const ox=pr.left-sb,oy=pr.top,spp=SPP(),[pw,ph]=paperMm();
  const pro=document.body.classList.contains("pro");
  g.fillStyle=pro?"rgba(26,27,29,.95)":"rgba(255,255,255,.92)";g.fillRect(0,0,W,20);g.fillRect(0,0,20,H);
  g.strokeStyle=pro?"#3a3c40":"#c3c8d0";g.lineWidth=1;g.beginPath();g.moveTo(0,20.5);g.lineTo(W,20.5);g.moveTo(20.5,0);g.lineTo(20.5,H);g.stroke();
  g.fillStyle=pro?"#9aa0a8":"#8b9099";g.font="9px -apple-system,sans-serif";g.textBaseline="top";g.strokeStyle=pro?"#55585d":"#aab0b8";
  g.beginPath();
  for(let mm=0;mm<=pw;mm+=5){const x=ox+mm*spp;if(x<20||x>W)continue;const maj=mm%10===0;g.moveTo(x+.5,20);g.lineTo(x+.5,maj?12:16);if(mm%20===0)g.fillText(mm,x+2,3);}
  for(let mm=0;mm<=ph;mm+=5){const y=oy+mm*spp;if(y<20||y>H)continue;const maj=mm%10===0;g.moveTo(20,y+.5);g.lineTo(maj?12:16,y+.5);if(mm%20===0){g.save();g.translate(3,y+2);g.fillText(mm,0,0);g.restore();}}
  g.stroke();
  // current page extent markers
  g.strokeStyle=pro?"rgba(74,158,255,.6)":"rgba(0,102,204,.5)";g.beginPath();const ex=ox+pw*spp,ey=oy+ph*spp;
  g.moveTo(ox+.5,0);g.lineTo(ox+.5,20);g.moveTo(ex+.5,0);g.lineTo(ex+.5,20);g.moveTo(0,oy+.5);g.lineTo(20,oy+.5);g.moveTo(0,ey+.5);g.lineTo(20,ey+.5);g.stroke();}

$("#printBtn").addEventListener("click",e=>{printBaked(e.currentTarget);});

/* ---------- start ---------- */
/* ---------- theme (라이트 / 프로 다크) ---------- */
function applyTheme(pro){document.body.classList.toggle("pro",pro);try{localStorage.setItem("smphoto:theme",pro?"pro":"light");}catch(e){}
  const b=$("#themeBtn");if(b){b.textContent=pro?"☀":"◐";b.title=pro?"라이트 모드로 전환":"프로(다크) 모드로 전환";}drawRuler();}
$("#themeBtn").addEventListener("click",()=>applyTheme(!document.body.classList.contains("pro")));
applyTheme(localStorage.getItem("smphoto:theme")!=="light"); // 기본: 프로(다크)

$("#undoBtn").addEventListener("click",undo);
$("#redoBtn").addEventListener("click",redo);
window.addEventListener("keydown",e=>{const tag=(e.target.tagName||"").toLowerCase();if(tag==="input"||tag==="select"||tag==="textarea")return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}
  else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}});

function initApp(){
  bindCal(); bindLogo(); applyDefaultPrinter(); applyDefaultLogo(); updateMediaNote(); renderSaved(); render(); fit(); initHistory(); initPages();
  $("#pageAdd").addEventListener("click",()=>addPage(false));
  $("#pageDup").addEventListener("click",()=>addPage(true));
  $("#pagesPdf").addEventListener("click",exportAllPagesPDF);

  /* URL ?session=<셀렉세션ID> — ERP에서 링크로 열면 주문 인화 모드로 전환 + 지시서 자동 로드 (호스팅 시) */
  try{
    const sid=new URLSearchParams(location.search).get("session");
    if(sid){
      state.mode="order"; state.order.sid=sid;
      [...document.querySelectorAll("#modes button")].forEach(b=>b.classList.toggle("on",b.dataset.mode==="order"));
      render(); fit();
      if(location.protocol!=="file:") fetchErpSession(); // file://은 CORS라 프리필만
    }
  }catch(e){}
}

/* ---------- PIN 잠금 (호스팅 도메인 전용) ----------
   ③목록과 같은 암호를 공유: select-print-list를 limit=1로 호출해 검증(별도 엔드포인트 불필요).
   file://(로컬 파일로 직접 열기)은 ERP 연결 자체가 안 되므로 잠금 없이 바로 진입. */
function _lockErpBase(){ return (localStorage.getItem("smphoto:erpBase")||ERP_BASE||"").trim(); }
async function _verifyAppPin(pin){
  const base=_lockErpBase(); if(!base) return false;
  try{
    const url=base+(base.includes("?")?"&":"?")+"api=select-print-list&limit=1&passcode="+encodeURIComponent(pin)+"&_ts="+Date.now();
    const r=await fetch(url,{cache:"no-store"}); const j=await r.json();
    return !!(j&&j.ok);
  }catch(e){ return false; }
}
function _showLock(msg){
  const ov=$("#lockOverlay"); if(ov) ov.style.display="flex";
  const err=$("#lockError"); if(err) err.textContent=msg||"";
  const inp=$("#lockPin"); if(inp){inp.value="";inp.focus();}
}
function _hideLock(){ const ov=$("#lockOverlay"); if(ov) ov.style.display="none"; }
async function _attemptUnlock(pin,silent){
  if(!pin){ if(!silent)_showLock(""); return; }
  const ok=await _verifyAppPin(pin);
  if(ok){ try{localStorage.setItem("smphoto:printListPasscode",pin);}catch(e){} _hideLock(); initApp(); return; }
  if(!silent){ try{localStorage.removeItem("smphoto:printListPasscode");}catch(e){} _showLock("PIN이 올바르지 않습니다."); }
}
if(location.protocol==="file:"){
  initApp();
}else{
  const submitBtn=$("#lockSubmit"), pinInput=$("#lockPin");
  if(submitBtn)submitBtn.addEventListener("click",()=>_attemptUnlock((pinInput.value||"").trim(),false));
  if(pinInput)pinInput.addEventListener("keydown",e=>{if(e.key==="Enter")_attemptUnlock((pinInput.value||"").trim(),false);});
  const cached=localStorage.getItem("smphoto:printListPasscode")||"";
  if(cached){ _showLock(""); _attemptUnlock(cached,true); } else { _showLock(""); }
}
