export async function psdToCanvas(file){
  if(typeof PSD!=='undefined'){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          const psd=PSD.fromURL(reader.result);
          if(psd.image&&psd.image.toPng){
            const png=psd.image.toPng();
            const img=new Image();
            img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);resolve(canvas)};
            img.onerror=reject;img.src=png.toDataURL();return;
          }
          reject(new Error('Unsupported PSD format'));
        }catch(err){reject(err)}
      };
      reader.onerror=reject;
      reader.readAsArrayBuffer(file);
    });
  }else{throw new Error('PSD support requires psd.js')}
}
