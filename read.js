import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const pdfs={te:"/read-pdf/te",en:"/read-pdf/en",hi:"/read-pdf/hi",ta:"/read-pdf/ta",kn:"/read-pdf/kn"};
const buttons=document.querySelectorAll(".reader-lang");
const canvas=document.getElementById("pdfCanvas");
const ctx=canvas.getContext("2d",{alpha:false});
const wrap=document.getElementById("canvasWrap");
const pageContainer=document.getElementById("pageContainer");
const message=document.getElementById("readerMessage");
const errorBox=document.getElementById("readerError");
const pageNum=document.getElementById("pageNum");
const pageCount=document.getElementById("pageCount");
const prevBtn=document.getElementById("prevBtn");
const nextBtn=document.getElementById("nextBtn");
const zoomIn=document.getElementById("zoomIn");
const zoomOut=document.getElementById("zoomOut");
const zoomReset=document.getElementById("zoomReset");
let pdf=null,currentPage=1,scale=1,loadingTask=null,rendering=false;

function showError(text){message.style.display="none";wrap.hidden=true;errorBox.textContent=text;errorBox.style.display="block";}
function setLoading(text){message.style.display="flex";message.querySelector("h1").textContent=text;errorBox.style.display="none";}
async function renderPage(){
 if(!pdf||rendering)return;
 rendering=true; prevBtn.disabled=currentPage<=1; nextBtn.disabled=currentPage>=pdf.numPages; pageNum.textContent=currentPage;
 try{
  const page=await pdf.getPage(currentPage);
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
 setLoading("Loading book…"); currentPage=1; scale=1;
 if(loadingTask){try{await loadingTask.destroy();}catch{}}
 if(pdf){try{await pdf.destroy();}catch{}}
 try{
  loadingTask=pdfjsLib.getDocument({url,withCredentials:true,disableAutoFetch:false,disableStream:false});
  pdf=await loadingTask.promise; pageCount.textContent=pdf.numPages;
  await renderPage();
 }catch(e){console.error("PDF load error",e);showError("Unable to open this language PDF. Please check the local server and PDF file.");}
}
buttons.forEach(b=>b.addEventListener("click",()=>openLanguage(b.dataset.lang)));
prevBtn.addEventListener("click",()=>{if(currentPage>1){currentPage--;renderPage()}});
nextBtn.addEventListener("click",()=>{if(pdf&&currentPage<pdf.numPages){currentPage++;renderPage()}});
zoomIn.addEventListener("click",()=>{scale=Math.min(scale+0.2,2.5);renderPage()});
zoomOut.addEventListener("click",()=>{scale=Math.max(scale-0.2,0.6);renderPage()});
zoomReset.addEventListener("click",()=>{scale=1;renderPage()});
document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("dragstart",e=>e.preventDefault());
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&["s","p","u"].includes(e.key.toLowerCase()))e.preventDefault();if(e.key==="ArrowLeft"&&!prevBtn.disabled)prevBtn.click();if(e.key==="ArrowRight"&&!nextBtn.disabled)nextBtn.click();});
window.addEventListener("resize",()=>{if(pdf)renderPage()});
openLanguage("te");
