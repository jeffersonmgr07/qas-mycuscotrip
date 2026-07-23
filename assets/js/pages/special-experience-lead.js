"use strict";
(function(){
  const form=document.querySelector("[data-special-lead-form]");
  if(!form)return;
  const whatsapp=form.dataset.whatsapp||"51900608980";
  const status=document.querySelector("[data-special-lead-status]");
  form.addEventListener("submit",function(event){
    event.preventDefault();
    if(!form.checkValidity()){form.reportValidity();return;}
    const data=Object.fromEntries(new FormData(form).entries());
    const experience=form.dataset.experience||data.experience||"Experiencia especial";
    const lines=[
      `Hola My Cusco Trip, quiero solicitar información sobre ${experience}.`,
      "",
      `Nombre: ${data.fullName||""}`,
      `Correo: ${data.email||""}`,
      `WhatsApp: ${data.whatsapp||""}`,
      `País: ${data.country||""}`,
      `Fecha aproximada: ${data.travelDate||"Por definir"}`,
      `Viajeros: ${data.travelers||"1"}`,
      `Mensaje: ${data.message||"Sin mensaje adicional"}`
    ];
    try{localStorage.setItem(`mct_special_lead_${Date.now()}`,JSON.stringify({...data,experience,page:location.href,createdAt:new Date().toISOString()}));}catch(e){}
    if(typeof window.mctTrack==="function"){
      window.mctTrack("generate_lead",{lead_type:form.dataset.leadType||"special_experience",item_name:experience,travelers:Number(data.travelers||1)},{metaEventName:"Lead",tiktokEventName:"SubmitForm"});
    }
    if(status)status.classList.add("is-visible");
    const url=`https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url,"_blank","noopener");
  });
})();