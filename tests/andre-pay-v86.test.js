// v86: Andre earned $1,250 and was paid $1,250 (Pewaukee $588, Rustic Fox $125, 7/6 payment split).
'use strict';
const {boot,reporter}=require('./harness.js');
const t=reporter();
const A='rep_andre_1780776467102', PEW='sh_1779985491801', RF='sh_auto_rusticfoxcarolstream_1779985456781794';
function board(){
  const day=(n)=>({date:n,dayNum:1,repPay:{},expenses:{},payments:{},repSales:[{repId:A}]});
  const show=(id,name,date,pay)=>({id,name,startDate:date,status:'completed',numDays:1,days:[day(date)],repIds:[A],repPayout:{[A]:pay}});
  return {v:7,_applied:{},settings:{},shows:[
      show('sh_1780776300656','Kane County Flea Market','2026-06-06',100),
      show('sh_auto_foxfoundnorthauroraj_1779985456781541','Fox & Found','2026-06-20',152),
      show(PEW,'Pewaukee Beach party','2026-06-26',350),
      show(RF,'Rustic Fox — Carol Stream (Jul)','2026-07-05',125),
      show('sh_auto_waukeshacountyfair_1779985456780467','Waukesha County Fair','2026-07-15',285)],
    reps:[{id:A,name:'Andre',active:true,isSelf:false,payments:[
      {id:'rp_1780885689492',date:'2026-06-08',amount:100,showId:'sh_1780776300656'},
      {id:'rp_1782001526594',date:'2026-06-21',amount:152,showId:'sh_auto_foxfoundnorthauroraj_1779985456781541'},
      {id:'rp_1783303935212',date:'2026-07-06',note:'',amount:727},
      {id:'rp_1784511094372',date:'2026-07-20',amount:285,showId:'sh_auto_waukeshacountyfair_1779985456780467'}]}]};
}
const b=boot({dd_bs_v7:JSON.stringify(board())});
t.section('fresh board');
t.check('no boot error',b.bootError?String(b.bootError):null,null);
t.check('earned',b.run(`repEarned('${A}')`),1250);
t.check('paid',b.run(`repPaid('${A}')`),1250);
t.check('owed',b.run(`repOwed('${A}')`),0);
t.check('Pewaukee settled',b.run(`repOwed('${A}','${PEW}')`),0);
t.check('Rustic Fox settled',b.run(`repOwed('${A}','${RF}')`),0);
t.check('nothing owed anywhere',b.run(`repOwedWhere('${A}')`),'');
t.check('marker',b.run(`!!S._applied.andre_pay_1250_v86`),true);
t.check('payments count',b.run(`S.reps[0].payments.length`),5);
t.section('runs once');
const again=boot({dd_bs_v7:b.run('JSON.stringify(S)')});
t.check('still 1250 paid after reload',again.run(`repPaid('${A}')`),1250);
t.check('no duplicate payment',again.run(`S.reps[0].payments.length`),5);
t.section('hand-edited data is left alone');
const x=board(); x.reps[0].payments[2].amount=700;
const c=boot({dd_bs_v7:JSON.stringify(x)});
t.check('untouched payment',c.run(`S.reps[0].payments.find(p=>p.id==='rp_1783303935212').amount`),700);
t.check('not marked',c.run(`!!S._applied.andre_pay_1250_v86`),false);
t.done();
