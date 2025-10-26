/* ---------- Judging logic (updated to send selected lang) ---------- */
const URL = "https://diphycercal-aurore-introrsely.ngrok-free.dev";
const form = document.getElementById('codeForm');
const codeInput = document.getElementById('codeInput');
const submitBtn = document.getElementById('submitBtn');
const statusPanel = document.getElementById('statusPanel');
const statusText = document.getElementById('statusText');
const casesContainer = document.getElementById('casesContainer');
const langSelect = document.getElementById('langSelect');
const codeLabel = document.getElementById('codeLabel');

const TEMPLATES = {
  python: "print('hello')\n",
  cpp:
`#include <bits/stdc++.h>
using namespace std;
int main(){
  ios::sync_with_stdio(false);
  cin.tie(nullptr);
  cout << "hello\\n";
  return 0;
}
`,
  java:
`import java.io.*;
public class Main {
  public static void main(String[] args) throws Exception {
    System.out.println("hello");
  }
}
`
};

function applyTemplateFor(lang){
  codeInput.placeholder = TEMPLATES[lang] || '';
}

applyTemplateFor(langSelect.value);
langSelect.addEventListener('change', () => {
  applyTemplateFor(langSelect.value);
});

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function formatTime(ns){ return (typeof ns==='number'&&Number.isFinite(ns))?(ns/1e6).toFixed(2)+' ms':'—'; }
function formatMemory(b){ return (typeof b==='number'&&Number.isFinite(b))?(b/1024).toFixed(0)+' KB':'—'; }

function renderCases(cases){
  if(!Array.isArray(cases)||cases.length===0){ casesContainer.innerHTML='<p>No cases available.</p>'; return; }
  const rows=cases.map((t,i)=>{
    const s=t.ok?'case-status-ok':'case-status-fail';
    const msg=(t.msg||'').replace(/\n/g,'<br />');
    return `<tr><td>Case ${i+1}</td><td class="${s}">${t.status||(t.ok?'Accepted':'Failed')}</td><td>${formatTime(t.time)}</td><td>${formatMemory(t.memory)}</td><td>${msg}</td></tr>`;
  }).join('');
  casesContainer.innerHTML=`<table class="cases-table"><thead><tr><th>Case</th><th>Status</th><th>Time</th><th>Memory</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`;

  for (let idx=0; idx<cases.length; idx++) {
    const test = cases[idx];
    let msg = (test.msg || '');
    const row = casesContainer.querySelector(`tbody tr:nth-child(${idx + 1})`);
    if (idx === 0) {
      casesContainer._scoreTotal = 0;
      casesContainer._anyFail = false;
      const prev = document.getElementById('totalScoreBadge');
      if (prev) prev.remove();
    }
    if (!test.ok) casesContainer._anyFail = true;

    const match = msg.match(/-?\d[\d,]*(?:\.\d+)?/);
    if (match) {
      const value = Number(match[0].replace(/,/g, ''));
      test.extractedNumber = value;
      casesContainer._scoreTotal = (casesContainer._scoreTotal || 0) + value;

      if (row) {
        const cell = row.cells[4];
        if (cell) {
          const badge = document.createElement('span');
          badge.style.marginLeft = '10px';
          badge.style.color = '#9ee6ff';
          badge.style.fontWeight = '700';
          badge.textContent = `Extracted: ${value}`;
          cell.appendChild(badge);
        }
      }
    }
    if (idx === cases.length - 1) {
      const finalScore = casesContainer._anyFail ? 0 : (casesContainer._scoreTotal || 0);
      const totalEl = document.createElement('div');
      totalEl.id = 'totalScoreBadge';
      totalEl.style.marginTop = '12px';
      totalEl.style.padding = '10px 14px';
      totalEl.style.background = '#0b2a2f';
      totalEl.style.color = '#9ee6ff';
      totalEl.style.fontWeight = '700';
      totalEl.style.border = '1px solid #07494f';
      totalEl.style.display = 'inline-block';
      totalEl.textContent = `Total Score: ${finalScore}`;
      statusPanel.prepend(totalEl);
    }
  }
}

async function pollForResult(sid){
  let attempt=0;
  while(true){
    attempt++;
    try{
      const r=await fetch(`${URL}/result/${encodeURIComponent(sid)}`,{headers:{'ngrok-skip-browser-warning':'true'}});
      if(!r.ok) throw new Error('Result request failed');
      const payload=await r.json();
      if(payload&&payload.status==='done') return payload;
      statusText.textContent=`In queue (attempt ${attempt})...`;
    }catch(e){ console.error(e); statusText.textContent='Judging...'; }
    await sleep(1000);
  }
}

form.addEventListener('submit',async e=>{
  e.preventDefault();
  const code=codeInput.value.trim();
  const lang=langSelect.value;                 // <- NEW
  if(!code){ statusPanel.classList.remove('hidden'); statusText.textContent='Please enter some code before submitting.'; return; }
  submitBtn.disabled=true; submitBtn.textContent='Submitting...';
  statusPanel.classList.remove('hidden'); statusText.textContent='Submitting your solution...'; casesContainer.innerHTML='';
  try{
    const payload={pid:'ahc001',lang,code};   // <- NEW
    const send=async(body,ct)=>{ const opt={method:'POST',body,headers:{'ngrok-skip-browser-warning':'true'}}; if(ct) opt.headers['Content-Type']=ct; const r=await fetch(`${URL}/submit`,opt); if(!r.ok) throw new Error('Submission failed'); return r.json(); };
    let sub;
    try{ sub=await send(JSON.stringify(payload),'application/json'); }catch{ sub=await send(JSON.stringify(payload),'text/plain;charset=UTF-8'); }
    const {sid}=sub||{}; if(!sid) throw new Error('Judge did not return a submission id.');
    statusText.textContent='Submission received. Fetching results...';
    const result=await pollForResult(sid);
    statusText.textContent=''; renderCases(result.cases);
  }catch(e){ console.error(e); statusText.textContent='Error: '+(e.message||'Unknown error'); }
  finally{ submitBtn.disabled=false; submitBtn.textContent='Submit Solution'; }
});