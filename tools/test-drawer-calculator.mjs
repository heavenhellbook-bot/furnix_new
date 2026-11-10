import assert from 'node:assert/strict';
import { calculateDrawer, selectDrawerLength, findDrawerSlides } from '../drawer-calculator.js';
import { DRAWER_SLIDES } from '../drawer-slides-data.js';
const base = {mode:'external',widthMm:564,depthMm:500,heightMm:200,thicknessMm:18};
let checks=0; const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
let r=calculateDrawer(base);
eq(r.lengthMm,450); eq(r.parts.map(p=>[p.lengthMm,p.widthMm,p.quantity]),[[440,515,1],[515,150,1],[515,150,1],[440,180,2]]);eq(r.slides.map(s=>s.article),['104563','104554']);
r=calculateDrawer({...base,mode:'internal',widthMm:800,depthMm:504,heightMm:455,thicknessMm:16,facadeThicknessMm:16});
eq(r.availableDepthMm,480);eq(r.lengthMm,450);eq(r.parts.map(p=>[p.lengthMm,p.widthMm,p.quantity]),[[440,758,1],[758,405,1],[758,405,1],[440,435,2]]);eq(r.slides.map(s=>s.article),['104559','104892']);
for(const mode of ['external','internal']) {
 const offset=mode==='external'?304:299;
 for(let i=0;i<6;i++) {
  const lo=offset+50*i,hi=lo+51;
  eq(selectDrawerLength(lo,mode),i ? 300+(i-1)*50 : 0);
  eq(selectDrawerLength(lo+0.5,mode),i ? 300+(i-1)*50 : 300);
  eq(selectDrawerLength(lo+1,mode),300+i*50);
  eq(selectDrawerLength(hi-0.1,mode),300+i*50);
  eq(selectDrawerLength(hi,mode),i===5?0:350+i*50);
 }
}
for(const key of ['widthMm','depthMm','heightMm','thicknessMm']) for(const value of ['',null,'abc',Infinity,'1x']) {r=calculateDrawer({...base,[key]:value});eq(r.status,'invalid');eq(r.parts,[]);eq(Boolean(r.errors[key]),true);}
for(const [key,value] of [['widthMm',199],['widthMm',801],['heightMm',108],['heightMm',801],['thicknessMm',17],['depthMm',304]]) eq(calculateDrawer({...base,[key]:value}).status,'invalid');
for(const value of [200,800]) eq(calculateDrawer({...base,widthMm:value}).status,'calculated');
for(const value of [109,800]) eq(calculateDrawer({...base,heightMm:value}).status,'calculated');
eq(calculateDrawer({...base,widthMm:'564,5'}).parts[0].widthMm,515.5);
eq(calculateDrawer({...base,depthMm:304.5}).lengthMm,300);
eq(calculateDrawer({...base,depthMm:605}).status,'no-length');eq(calculateDrawer({...base,depthMm:605}).parts,[]);
eq(calculateDrawer({...base,mode:'internal',depthMm:624,facadeThicknessMm:16}).status,'no-length');
eq(calculateDrawer({...base,mode:'internal',depthMm:326,facadeThicknessMm:16}).status,'invalid');
eq(calculateDrawer({...base,mode:'internal',depthMm:326.5,facadeThicknessMm:19}).lengthMm,300);
eq(calculateDrawer({...base,mode:'internal',facadeThicknessMm:17}).status,'invalid');
eq(calculateDrawer({...base,facadeThicknessMm:'bad'}).status,'calculated');
eq(calculateDrawer({...base,depthMm:305,thicknessMm:16}).status,'no-article');eq(findDrawerSlides(300,16),[]);
for(const length of [300,350,400,450,500,550]) for(const thickness of [16,18,19]) {
 const rows=findDrawerSlides(length,thickness);
 eq(rows.every(s=>s.article!=='0'&&s.clip==='Clip 3D'),true);
 eq(new Set(rows.map(s=>s.article+':'+s.execution)).size,rows.length);
 if(thickness===19) eq(rows.map(s=>s.article),findDrawerSlides(length,18).map(s=>s.article));
}
eq(DRAWER_SLIDES.length,35);
console.log('Drawer checks passed:',checks);
