class HelloAgainCapture extends AudioWorkletProcessor {
 constructor(){super();this.samples=new Int16Array(2400);this.offset=0;}
 process(inputs){const input=inputs[0]?.[0];if(input)for(const value of input){this.samples[this.offset++]=Math.max(-32768,Math.min(32767,Math.round(value*32767)));if(this.offset===2400){this.port.postMessage(this.samples.buffer,[this.samples.buffer]);this.samples=new Int16Array(2400);this.offset=0;}}return true;}
}
registerProcessor('helloagain-capture',HelloAgainCapture);
