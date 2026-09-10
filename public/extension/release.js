"use strict";
(async()=>{
  const sources=["/api/v1/extension/update-manifest","/extension/releases/latest.json"];
  let lastError=new Error("Không thể tải manifest.");
  for(const source of sources){
    try{
      const separator=source.includes("?")?"&":"?";
      const response=await fetch(`${source}${separator}t=${Date.now()}`,{cache:"no-store"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const update=await response.json();
      document.getElementById("version").textContent=`v${update.version||"—"}`;
      const mandatory=document.getElementById("mandatory");
      mandatory.textContent=update.mandatory?"Cập nhật bắt buộc":"Cập nhật tùy chọn";
      mandatory.classList.toggle("mandatory",update.mandatory===true);
      document.getElementById("notes").textContent=update.releaseNotes||"Không có ghi chú phát hành.";
      document.getElementById("download").href=update.downloadUrl||"/api/v1/extension/download";
      return;
    }catch(error){lastError=error;}
  }
  document.getElementById("version").textContent="Không thể tải";
  document.getElementById("mandatory").textContent=lastError.message;
})();
