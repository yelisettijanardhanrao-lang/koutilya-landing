import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const pdfs={te:"/read-pdf/te",en:"/read-pdf/en"};
const buttons=document.querySelectorAll(".reader-lang");
const canvas=document.getElementById("pdfCanvas");
const ctx=canvas.getContext("2d",{alpha:false});
const wrap=document.getElementById("canvasWrap");
const message=document.getElementById("readerMessage");
const errorBox=document.getElementById("readerError");
const pageNum=document.getElementById("pageNum");
const pageCount=document.getElementById("pageCount");
const zoomIn=document.getElementById("zoomIn");
const zoomOut=document.getElementById("zoomOut");
const zoomReset=document.getElementById("zoomReset");
let pdf=null,currentPage=1,scale=1,loadingTask=null,rendering=false,fitMobile=true;
let touchStartX=0,touchStartY=0,touchStartTime=0;

function showError(text){message.style.display="none";wrap.hidden=true;errorBox.textContent=text;errorBox.style.display="block";}
function setLoading(text){message.style.display="flex";message.querySelector("h1").textContent=text;errorBox.style.display="none";}
function isMobile(){return window.matchMedia("(max-width:700px)").matches;}
async function fitPageToMobileWidth(page){
 if(!isMobile()||!fitMobile)return;
 const base=page.getViewport({scale:1});
 const available=Math.max(280,wrap.clientWidth-12);
 scale=Math.min(1,Math.max(0.35,available/base.width));
}
async function renderPage(){
 if(!pdf||rendering)return;
 rendering=true; pageNum.textContent=currentPage;
 try{
  const page=await pdf.getPage(currentPage);
  await fitPageToMobileWidth(page);
  const viewport=page.getViewport({scale});
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.floor(viewport.width*dpr); canvas.height=Math.floor(viewport.height*dpr);
  canvas.style.width=Math.floor(viewport.width)+"px"; canvas.style.height=Math.floor(viewport.height)+"px";
  await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
  wrap.hidden=false; message.style.display="none";
  zoomReset.textContent=Math.round(scale*100)+"%";
 }catch(e){console.error(e);showError("Unable to render this page.");}
 finally{rendering=false;}
}
async function openLanguage(lang){
 const url=pdfs[lang]; if(!url)return;
 buttons.forEach(b=>b.classList.toggle("active",b.dataset.lang===lang));
 setLoading("Loading book…"); currentPage=1; scale=1; fitMobile=true;
 if(loadingTask){try{await loadingTask.destroy();}catch{}}
 if(pdf){try{await pdf.destroy();}catch{}}
 try{
  const response=await fetch(url,{credentials:"same-origin",cache:"default"});
  if(!response.ok)throw new Error("PDF request failed: "+response.status);
  const data=new Uint8Array(await response.arrayBuffer());
  loadingTask=pdfjsLib.getDocument({data,disableWorker:true});
  pdf=await loadingTask.promise; pageCount.textContent=pdf.numPages;
  await renderPage();
 }catch(e){console.error("PDF load error",e);showError("Unable to open this language PDF. Please check the server and PDF file.");}
}

async function goToPage(page){
 if(!pdf||rendering||page<1||page>pdf.numPages)return;
 currentPage=page;
 await renderPage();
}

buttons.forEach(b=>b.addEventListener("click",()=>openLanguage(b.dataset.lang)));

zoomIn.addEventListener("click",()=>{fitMobile=false;scale=Math.min(scale+0.2,2.5);renderPage()});
zoomOut.addEventListener("click",()=>{fitMobile=false;scale=Math.max(scale-0.2,0.6);renderPage()});
zoomReset.addEventListener("click",()=>{fitMobile=false;scale=1;renderPage()});

wrap.addEventListener("touchstart",e=>{
 if(e.touches.length!==1)return;
 const t=e.touches[0];
 touchStartX=t.clientX;
 touchStartY=t.clientY;
 touchStartTime=Date.now();
},{passive:true});

wrap.addEventListener("touchend",e=>{
 if(e.changedTouches.length!==1||!pdf)return;
 const t=e.changedTouches[0];
 const dx=t.clientX-touchStartX;
 const dy=t.clientY-touchStartY;
 const dt=Date.now()-touchStartTime;
 const horizontal=Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.2&&dt<800;

 // At zoom levels above the normal page view, keep horizontal swiping
 // available for moving around the enlarged page instead of changing pages.
 if(!horizontal||scale>1.05)return;

 if(dx<0)goToPage(currentPage+1);
 else goToPage(currentPage-1);
},{passive:true});

document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("dragstart",e=>e.preventDefault());
document.addEventListener("keydown",e=>{
 if((e.ctrlKey||e.metaKey)&&["s","p","u"].includes(e.key.toLowerCase()))e.preventDefault();
 if(e.key==="ArrowLeft")goToPage(currentPage-1);
 if(e.key==="ArrowRight")goToPage(currentPage+1);
});
window.addEventListener("resize",()=>{if(pdf){if(isMobile())fitMobile=true;renderPage()}});
openLanguage("te");
