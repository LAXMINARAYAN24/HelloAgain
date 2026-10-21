// Local-only screening for an almost entirely black frame. This is neither
// identity verification nor a clothing/nudity detector, and cannot enforce calls.
export function isBlackFrame(rgba){
 if(!rgba||rgba.length<4)return false;
 let total=0,bright=0,count=0;
 for(let i=0;i<rgba.length;i+=4){const value=.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2];total+=value;if(value>30)bright++;count++;}
 return total/count<12&&bright/count<.005;
}
