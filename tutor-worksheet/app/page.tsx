"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis, Mode, Question,SubjectMode,EnglishMode,EnglishQuestionType } from "@/lib/schema";
import { MathText } from "./components/math-text";
import { ProblemDiagram } from "./components/problem-diagram";
import { PencilCircle, PencilSlash, PencilStar } from "./components/pencil-marks";
import {canSelect,NO_SOLUTION} from "@/lib/teacher-review";
import type {StudyContext} from "@/lib/study-context";
import {printText} from "@/lib/text-format";
import {sampleWorksheets} from "@/lib/sample-worksheets";
import { buildPrompt, editQuestion, exportWorksheet, importWorksheet, MAX_IMPORT_BYTES } from "@/lib/worksheet";

const choices:{id:Mode;title:string;description:string}[]=[
  {id:"numbers",title:"숫자만 변경",description:"같은 풀이로 한 번 더"},
  {id:"similar",title:"비슷한 유형",description:"표현을 바꾸어 익히기"},
  {id:"applied",title:"응용 문제",description:"다른 상황에 적용하기"},
];
const englishChoices:{id:EnglishMode;title:string;description:string}[]=[
  {id:"retarget",title:"원문 유지",description:"같은 지문의 다른 부분 출제"},
  {id:"light",title:"표현만 조금 변경",description:"단어·짧은 표현 1~3곳"},
];
const steps=["AI에 요청","불러와서 고르기","출력하기"] as const;
// 마지막으로 불러온 문제 목록을 이 기기에만 보관한다. 새로고침·탭 종료 후 되살리기용.
const STORE_KEY="dasi-pulgi:last";
type Origin="paste"|"file"|"example"|"saved";
type Message={at:string;text:string;kind:"notice"|"error"};
type Saved={text:string;unit:string;count:number};
type Filter="all"|"picked"|"retry";
type Drawer="setup"|"original"|null;
type Open="solution"|"hint"|"edit";

export default function Home() {
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [origin,setOrigin]=useState<Origin>("paste");
  const [subject,setSubject]=useState<SubjectMode>("math");
  const [englishMode,setEnglishMode]=useState<EnglishMode>("retarget");
  const [englishType,setEnglishType]=useState<EnglishQuestionType>("retain");
  const [mode,setMode]=useState<Mode>("numbers");const [count,setCount]=useState(5);const [original,setOriginal]=useState("");
  const [source,setSource]=useState("");const [questions,setQuestions]=useState<Question[]>([]);
  const [warnings,setWarnings]=useState<string[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [diagramConfirmed,setDiagramConfirmed]=useState<Record<string,boolean>>({});
  const [missingAllowed,setMissingAllowed]=useState<Record<string,boolean>>({});
  const [study,setStudy]=useState<StudyContext>({});
  const [showHints,setShowHints]=useState(false);
  const [drafts,setDrafts]=useState<Record<string,{question:string;answer:string;solution:string}>>({});
  const [message,setMessage]=useState<Message|null>(null);const [reading,setReading]=useState(false);
  const [saved,setSaved]=useState<Saved|null>(null);
  const [drawer,setDrawer]=useState<Drawer>(null);
  const [opened,setOpened]=useState<Record<string,Open|undefined>>({});
  const [bigFigure,setBigFigure]=useState<Record<string,boolean>>({});
  const [filter,setFilter]=useState<Filter>("all");
  const [inView,setInView]=useState<number[]>([]);
  const [preview,setPreview]=useState(false);const [answers,setAnswers]=useState(false);
  const [student,setStudent]=useState("");const [date,setDate]=useState("");const [unit,setUnit]=useState("");
  const [spacing,setSpacing]=useState("normal");const [compactPrint,setCompactPrint]=useState(true);const [copied,setCopied]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);const resultRef=useRef<HTMLElement>(null);
  const eligible=(q:Question)=>canSelect(q,!!diagramConfirmed[q.id],!!missingAllowed[q.id]);
  const isPicked=(q:Question)=>selected.includes(q.id)&&eligible(q);
  const picked=questions.filter(isPicked);
  const prompt=buildPrompt(mode,count,original,{subject,englishMode,englishType,study});
  const loaded=questions.length>0&&!!analysis;
  const stepIndex=preview&&picked.length?2:loaded?1:0;
  const visible=questions.map((q,i)=>({q,i})).filter(({q})=>filter==="all"||(filter==="picked"?isPicked(q):q.retry));
  const hasFigure=questions.some(q=>q.diagram);

  useEffect(()=>{setDate(new Date().toLocaleDateString("sv-SE"));},[]);
  useEffect(()=>{setCopied(false);},[mode,count,original,subject,englishMode,englishType,study]);
  useEffect(()=>{try{const raw=localStorage.getItem(STORE_KEY);if(raw)setSaved(JSON.parse(raw) as Saved);}catch{/* 저장소를 쓸 수 없는 브라우저 */}},[]);
  useEffect(()=>{
    if(!analysis||!questions.length||origin==="example")return;
    const data:Saved={text:exportWorksheet(analysis,questions),unit:analysis.unit,count:questions.length};
    try{localStorage.setItem(STORE_KEY,JSON.stringify(data));setSaved(data);}catch{/* 저장 실패는 무시 */}
  },[analysis,questions,origin]);
  // 목록 머리에 '지금 보고 있는 범위'를 적기 위해 화면에 들어온 문제 번호를 추적한다.
  useEffect(()=>{
    if(!loaded||typeof IntersectionObserver==="undefined")return;
    const seen=new Set<number>();
    const observer=new IntersectionObserver(entries=>{
      for(const e of entries){const n=Number((e.target as HTMLElement).dataset.index);if(e.isIntersecting)seen.add(n);else seen.delete(n);}
      setInView([...seen].sort((a,b)=>a-b));
    },{rootMargin:"-60px 0px -100px 0px"});
    document.querySelectorAll<HTMLElement>(".row[data-index]").forEach(el=>observer.observe(el));
    return ()=>observer.disconnect();
  },[loaded,questions.length,filter]);

  const say=(at:string,text:string,kind:Message["kind"]="notice")=>setMessage({at,text,kind});
  // 메시지는 그 원인이 된 버튼 바로 옆에만 보여준다.
  const showMessage=(at:string)=>message&&message.at===at?<p className={message.kind==="error"?"msg msg-error":"msg"} role={message.kind==="error"?"alert":"status"}>{message.kind==="error"&&<strong>확인이 필요합니다. </strong>}{message.text}</p>:null;

  function load(text:string,from:Origin="paste") {
    setMessage(null);
    if(!text.trim()){say("import","붙여넣은 내용이 없습니다. AI 답변의 JSON을 먼저 붙여넣어 주세요.","error");return;}
    try {
      const data=importWorksheet(text);
      setAnalysis(data.analysis);setUnit(data.analysis.unit);setQuestions(data.questions);setWarnings(data.displayWarnings);setOrigin(from);
      setSource(from==="paste"?text:"");setFilter("all");setDrawer(null);setOpened({});setBigFigure({});
      if(/영어|english/i.test(data.analysis.subject))setSubject("english");else if(data.analysis.subject)setSubject("math");
      setSelected([]);setDrafts({});setDiagramConfirmed({});setMissingAllowed({});setPreview(false);setShowHints(false);
      const failed=data.questions.filter(q=>q.verification==="failed").length;
      const prefix={example:"예제 ",saved:"지난번 ",file:"",paste:""}[from];
      say("results",`${prefix}${data.questions.length}문제를 불러왔습니다. ${failed?`필수 도형이 빠진 ${failed}문제는 고를 수 없습니다. 도형을 포함해 다시 요청하세요.`:"정답을 확인하고 번호를 눌러 동그라미 치세요."}`);
      setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),50);
    } catch(e) {if(loaded)setDrawer("setup");say("import",e instanceof Error?e.message:"문제 파일을 읽지 못했습니다.","error");}
  }
  async function readFile(file?:File) {
    if(!file)return;setReading(true);setMessage(null);
    try {
      if(file.size>MAX_IMPORT_BYTES)throw Error("문제 파일은 1MB 이하로 불러와 주세요.");
      load(await file.text(),"file");
    }catch(e){say("import",e instanceof Error?e.message:"파일을 읽지 못했습니다.","error");}
    finally{setReading(false);}
  }
  async function copyPrompt() {
    try {await navigator.clipboard.writeText(prompt);setCopied(true);say("request","요청문을 복사했습니다. 쓰던 AI 대화에 문제 사진과 함께 붙여넣으세요.");}
    catch {say("request","이 브라우저에서는 자동 복사가 되지 않습니다. 아래 ‘요청문 직접 복사’를 열고 글을 길게 눌러 전체 선택한 뒤 복사하세요.","error");}
  }
  function saveFile() {
    if(!analysis)return;
    const blob=new Blob([exportWorksheet(analysis,questions)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="worksheet.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);say("results","전체 문제를 파일로 저장했습니다. 다른 기기에서 이 파일을 열 수 있습니다. 확인 상태는 열 때 다시 점검합니다.");
  }
  function toggle(id:string) {setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);setPreview(false);}
  function setRetry(id:string,value:boolean) {setQuestions(prev=>prev.map(item=>item.id===id?{...item,retry:value}:item));}
  function openPanel(id:string,panel:Open) {setOpened(prev=>({...prev,[id]:prev[id]===panel?undefined:panel}));}
  function applyEdit(q:Question) {
    try {
      const draft=drafts[q.id];
      const updated=editQuestion(q,draft||q);
      setQuestions(prev=>prev.map(item=>item.id===q.id?updated:item));
      setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);
      setDiagramConfirmed(prev=>({...prev,[q.id]:false}));setMissingAllowed(prev=>({...prev,[q.id]:false}));
      setDrafts(prev=>{const next={...prev};delete next[q.id];return next;});
      say(q.id,"수정한 내용을 반영했습니다. 정답·풀이와 도형 조건을 확인하고 다시 고르세요.");
    }catch{say(q.id,"문제와 정답은 비워둘 수 없습니다. 각 항목을 6,000자 이하로 작성하세요.","error");}
  }
  function goStep(i:number) {
    if(i<2){if(loaded)setDrawer("setup");setTimeout(()=>document.getElementById(i===0?"step-request":"step-import")?.scrollIntoView({behavior:"smooth",block:"start"}),30);return;}
    document.getElementById("step-print")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function openPreview() {
    setPreview(true);
    setTimeout(()=>document.getElementById("preview")?.scrollIntoView({behavior:"smooth",block:"start"}),50);
  }
  async function print(include:boolean) {
    if(!picked.length)return;
    setAnswers(include);setPreview(true);
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    await document.fonts.ready;window.print();
  }
  const range=inView.length?`${inView[0]+1}${inView.length>1?`–${inView[inView.length-1]+1}`:""}번 보는 중`:"목록";
  const pickedRetry=picked.filter(q=>q.retry).length;
  const numberOf=(q:Question)=>questions.indexOf(q)+1;

  const requestPanel=<section id="step-request" className="panel request-panel" aria-labelledby="request-title">
    <h2 id="request-title">AI에 보낼 요청 만들기</h2>
    <p className="lede">방식과 개수를 고르고 요청문을 복사해, 문제 사진과 함께 쓰던 AI 대화에 붙여넣으세요.</p>
    <div className="field"><span className="label" id="subject-label">과목</span><div className="segmented" role="group" aria-labelledby="subject-label">{([["math","수학"],["english","영어"]] as const).map(([value,label])=><button key={value} aria-pressed={subject===value} onClick={()=>setSubject(value)}>{label}</button>)}</div></div>
    {subject==="english"?<>
      <div className="field"><span className="label" id="emode-label">변형 방식</span><div className="option-list" role="group" aria-labelledby="emode-label">{englishChoices.map(c=><button key={c.id} className="option" aria-pressed={englishMode===c.id} onClick={()=>setEnglishMode(c.id)}><strong>{c.title}</strong><span>{c.description}</span></button>)}</div></div>
      <div className="field"><label className="label" htmlFor="english-type">영어 문제 유형</label><select id="english-type" value={englishType} onChange={e=>setEnglishType(e.target.value as EnglishQuestionType)}><option value="retain">원본 유형 유지</option><option value="blank">빈칸 추론</option><option value="grammar">어법</option><option value="vocabulary">문맥상 어휘</option><option value="mixed">섞어서 출제</option></select><p className="hint">원본 유형 유지는 문장삽입이면 다른 문장을, 빈칸이면 다른 부분을 출제합니다. 원문 유지에서도 어법·어휘 오류를 찾는 문제는 출제 부분 한 곳을 의도적으로 바꿀 수 있습니다.</p></div>
    </>:<div className="field"><span className="label" id="mode-label">만드는 방식</span><div className="option-list" role="group" aria-labelledby="mode-label">{choices.map(c=><button key={c.id} className="option" aria-pressed={mode===c.id} onClick={()=>setMode(c.id)}><strong>{c.title}</strong><span>{c.description}</span></button>)}</div></div>}
    <div className="field"><span className="label" id="count-label">문제 수</span><div className="segmented" role="group" aria-labelledby="count-label">{[3,5,10].map(n=><button key={n} aria-pressed={count===n} onClick={()=>setCount(n)}>{n}문제</button>)}</div></div>
    <details className="fold"><summary>사진 대신 원문 입력 (선택)</summary><label className="label" htmlFor="prompt-original">AI에 보낼 원본 문제</label><textarea id="prompt-original" maxLength={6000} rows={3} value={original} onChange={e=>setOriginal(e.target.value)} placeholder="사진을 보낼 경우 비워두세요."/></details>
    <details className="fold"><summary>수업 조건과 틀린 이유 (선택)</summary>{([["grade","학년"],["scope","배운 범위"],["methods","허용 풀이 방법"],["mistake","원본에서 틀린 이유"]] as const).map(([field,label])=><label className="label stacked" key={field}>{label}<input maxLength={240} value={study[field]||""} onChange={e=>setStudy(prev=>({...prev,[field]:e.target.value}))}/></label>)}<label className="label stacked">연습 목적<select value={study.purpose||""} onChange={e=>setStudy(prev=>({...prev,purpose:e.target.value as StudyContext["purpose"]}))}><option value="">기본</option><option value="concept">개념 다시 익히기</option><option value="accuracy">계산·표현 실수 줄이기</option><option value="independent">혼자 풀 수 있는지 확인하기</option></select></label><p className="hint">‘틀린 이유’를 적으면 학생 문제지 머리에 ‘이번에 신경 쓸 점’으로 인쇄됩니다.</p></details>
    <button className="btn btn-primary btn-block" onClick={()=>void copyPrompt()}>{copied?"요청문 복사됨 · 다시 복사":"AI에 보낼 요청문 복사"}</button>
    {showMessage("request")}
    <details className="fold"><summary>요청문 직접 복사</summary><textarea aria-label="AI 요청문" readOnly value={prompt} rows={8} onFocus={e=>e.target.select()}/></details>
    <p className="hint">ChatGPT, Claude 등 어느 AI에서나 같은 요청문을 쓰면 됩니다. 이 앱은 AI를 직접 부르지 않고, 모든 처리는 이 브라우저 안에서 합니다.</p>
  </section>;

  const importPanel=<section id="step-import" className="panel import-panel" aria-labelledby="import-title">
    <h2 id="import-title">AI 답변 붙여넣기</h2>
    <p className="lede">AI 답변의 JSON 코드 블록을 통째로 복사해 붙여넣거나, 저장해 둔 문제 파일을 여세요. 새 내용을 제대로 읽은 뒤에만 지금 목록이 바뀝니다.</p>
    <label className="label" htmlFor="import-source">AI 답변</label>
    <textarea id="import-source" className="import-source" value={source} maxLength={MAX_IMPORT_BYTES} onChange={e=>setSource(e.target.value)} rows={7} placeholder={'{\n  "unit": "일차방정식",\n  "generated_questions": [\n    {"question": "3x + 5 = 20", "answer": "5", "solution": "3x = 15이므로 x = 5"}\n  ]\n}'}/>
    <div className="btn-row"><button className="btn btn-primary" disabled={reading} onClick={()=>load(source)}>붙여넣은 문제 불러오기</button><button className="btn btn-outline" disabled={reading} onClick={()=>fileRef.current?.click()}>{reading?"파일을 읽고 있습니다...":"문제 파일 열기"}</button></div>
    {showMessage("import")}
    <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={e=>{void readFile(e.target.files?.[0]);e.target.value="";}}/>
    <p className="hint">JSON·TXT 파일 / 최대 1MB / 한 번에 30문제까지</p>
    <div className="samples"><h3>예제로 먼저 써보기</h3><p className="hint">파일 없이 바로 열립니다. 예제를 열면 지금 문제 목록이 예제로 바뀝니다.</p><ul className="sample-list">{sampleWorksheets.map(sample=><li key={sample.id}><button className="sample" onClick={()=>load(JSON.stringify(sample.data),"example")}><strong>{sample.title}</strong><span>{sample.description}</span></button></li>)}</ul></div>
  </section>;

  const originalPanel=analysis&&<section className="panel original" aria-labelledby="original-title">
    <h2 id="original-title">원본 문제{analysis.unit&&<span className="pill">{analysis.unit}</span>}</h2>
    {analysis.original_problem&&<p className="serif pre-wrap"><MathText text={analysis.original_problem}/></p>}
    <ProblemDiagram diagram={analysis.original_diagram}/>
    <p className="answer-line"><span>AI가 구한 정답</span><MathText text={analysis.answer||"정답을 제시하지 못했습니다."} displayStyle/></p>
    <p className="hint">AI의 답이 틀릴 수 있습니다. 원본 정답지와 비교한 뒤 유사문제를 쓰세요.</p>
    <details className="fold"><summary>원본 풀이</summary><p className="pre-wrap"><MathText text={analysis.solution||"원본 풀이가 없습니다. AI에 원본 풀이를 먼저 요청하세요."}/></p></details>
    <dl className="meta">{[["과목",analysis.subject],["단원",analysis.unit],["문제 유형",analysis.problem_type],["핵심 개념",analysis.concept],["난이도",analysis.difficulty]].filter(([,v])=>v).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {analysis.warning&&<p className="msg">{analysis.warning}</p>}
  </section>;

  return <>
    <div className={`app no-print ${loaded?"has-sheet":""}`}>
      <nav className="rail" aria-label="진행 단계">
        <div className="wordmark"><span className="wordmark-name"><span className="wordmark-circled">다시<PencilCircle animate={false}/></span>풀기</span><span className="wordmark-sub">나의 과외 문제지</span></div>
        <ol className="steps">{steps.map((label,i)=>{const current=i===stepIndex;const disabled=i===2&&!loaded;return <li key={label}><button className="step" aria-current={current?"step":undefined} disabled={disabled} onClick={()=>goStep(i)}><span className="step-num">{i+1}{current&&<PencilCircle/>}</span><span>{label}</span></button></li>;})}</ol>
        {saved&&(!loaded||origin==="example")&&<button className="resume" onClick={()=>load(saved.text,"saved")}><strong>지난 문제 다시 열기</strong><span>{saved.unit||"단원 없음"} · {saved.count}문제</span></button>}
        <p className="rail-foot">나의 속도로, 한 문제씩.</p>
      </nav>

      <main className="desk">
        <header className="desk-head">
          <h1>{loaded?"연습 문제 고르기":"새 문제지 만들기"}</h1>
          {loaded&&<div className="head-actions">
            {originalPanel&&(analysis?.original_problem||analysis?.answer)&&<button className="tool" aria-expanded={drawer==="original"} onClick={()=>setDrawer(drawer==="original"?null:"original")}>원본·AI 정답</button>}
            <button className="tool" aria-expanded={drawer==="setup"} onClick={()=>setDrawer(drawer==="setup"?null:"setup")}>새 요청·붙여넣기</button>
            <button className="tool" onClick={saveFile}>문제 파일 저장</button>
          </div>}
        </header>

        {!loaded&&<div className="setup">{requestPanel}{importPanel}</div>}
        {loaded&&drawer==="setup"&&<div className="setup drawer">{requestPanel}{importPanel}</div>}
        {loaded&&drawer==="original"&&<div className="drawer">{originalPanel}</div>}

        {loaded&&<section className="sheet-area" ref={resultRef} aria-labelledby="results-title">
          {showMessage("results")}
          {warnings.length>0&&<div className="msg msg-warn" role="alert"><strong>수식이 제대로 보이는지 확인하세요</strong><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
          <div className="strip-row">
            <div className="number-strip" role="group" aria-label="번호판 — 누르면 그 문제를 고르거나 뺍니다">{questions.map((q,i)=>{const on=isPicked(q);const can=eligible(q);return <button key={q.id} className={`num-chip ${on?"is-on":""} ${q.retry?"is-retry":""}`} aria-pressed={can?on:undefined} aria-disabled={!can||undefined} title={can?undefined:"아직 고를 수 없습니다 — 문제 줄에서 이유를 확인하세요"} onClick={()=>can?toggle(q.id):document.getElementById(`row-${q.id}`)?.scrollIntoView({behavior:"smooth",block:"center"})}>{i+1}{on&&<PencilCircle/>}{q.retry&&<span className="sr-only">, 오답 표시</span>}</button>;})}</div>
            <div className="bulk" role="group" aria-label="한 번에 고르기"><button className="tool" onClick={()=>{setSelected(questions.filter(eligible).map(q=>q.id));setPreview(false);}}>모두 고르기</button><button className="tool" onClick={()=>{setSelected(questions.filter(q=>q.retry&&eligible(q)).map(q=>q.id));setPreview(false);}}>오답만 고르기</button><button className="tool" disabled={!selected.length} onClick={()=>{setSelected([]);setPreview(false);}}>모두 빼기</button></div>
          </div>
          <div className="sheet">
            <div className="sheet-head">
              <h2 id="results-title" className="range"><span>{range}</span><span className="range-total"> · 전체 {questions.length}문제</span></h2>
              <div className="segmented small" role="group" aria-label="목록 보기">{([["all","전체",questions.length],["picked","고른 문제",picked.length],["retry","다시 풀 문제",questions.filter(q=>q.retry).length]] as const).map(([value,label,n])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label} {n}</button>)}</div>
            </div>
            <div className="sheet-cols" aria-hidden="true"><span>번호</span><span>상태</span><span>문제</span><span>정답 · 그림</span></div>
            {visible.length===0&&<p className="empty">{filter==="picked"?"아직 고른 문제가 없습니다. 번호를 눌러 동그라미 치세요.":"오답으로 표시한 문제가 없습니다. 문제 오른쪽 ‘오답’을 누르세요."}</p>}
            {visible.map(({q,i})=>{
              const draft=drafts[q.id]||q;
              const on=isPicked(q);
              const can=eligible(q);
              const failed=q.verification==="failed";
              const reason=failed?q.verification_note:q.diagram_review_required&&!diagramConfirmed[q.id]?"도형 재확인이 끝나야 고를 수 있습니다.":q.solution_missing&&!missingAllowed[q.id]?"풀이 없이 쓰는 것을 허용해야 고를 수 있습니다.":"";
              const status=!can?"고를 수 없음":on?(q.retry?"다시 출력":"출력"):(q.retry?"오답 · 제외":"제외");
              const box=`pick-${q.id}`;
              const panel=opened[q.id];
              const big=!!bigFigure[q.id];
              return <article key={q.id} id={`row-${q.id}`} data-index={i} className={`row ${on?"is-on":""} ${failed?"is-failed":""} ${q.retry?"is-retry":""}`}>
                <div className="row-num-cell">
                  <input id={box} type="checkbox" disabled={!can} checked={on} onChange={()=>toggle(q.id)} aria-describedby={reason?`${q.id}-reason`:undefined} aria-label={`${i+1}번 문제 고르기`}/>
                  <label className="row-num" htmlFor={box}><span className="num">{i+1}</span>{on&&<PencilCircle/>}{q.retry&&<><PencilSlash/><PencilStar/><span className="pen-note" aria-hidden="true">다시!</span></>}</label>
                </div>
                <p className={`row-status ${on?"is-on":""} ${!can?"is-blocked":""}`}>{status}</p>
                <div className="row-body">
                  {reason&&<p id={`${q.id}-reason`} className="reason">{reason}</p>}
                  <p className="question-text serif"><MathText text={q.question}/></p>
                  {big&&<div className="figure-big"><ProblemDiagram diagram={q.diagram}/></div>}
                  {q.diagram_review_required&&<div className="msg msg-warn"><strong>도형 재확인 필요</strong><p>본문이 바뀌어 기존 그림의 길이·좌표·각·교점이 조건과 다를 수 있습니다. 그림 수정이 필요하면 새 JSON을 불러오세요.</p><label className="check"><input type="checkbox" checked={!!diagramConfirmed[q.id]} onChange={e=>{setDiagramConfirmed(prev=>({...prev,[q.id]:e.target.checked}));setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);}}/>수정한 조건과 기존 도형·그래프가 일치함을 직접 확인했습니다</label></div>}
                  {q.solution_missing&&<div className="msg msg-warn"><strong>풀이 없음</strong><p>해설지에는 ‘{NO_SOLUTION}’ 안내문이 출력됩니다.</p><label className="check"><input type="checkbox" checked={!!missingAllowed[q.id]} onChange={e=>{setMissingAllowed(prev=>({...prev,[q.id]:e.target.checked}));setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);}}/>풀이 없는 상태로 쓰는 것을 허용합니다</label></div>}
                  {panel==="solution"&&<div className="row-panel"><h3>풀이</h3><p className="pre-wrap"><MathText text={q.solution_missing?NO_SOLUTION:q.solution}/></p></div>}
                  {panel==="hint"&&q.hint&&<div className="row-panel"><h3>힌트</h3><p className="pre-wrap"><MathText text={q.hint}/></p></div>}
                  {panel==="edit"&&<div className="row-panel"><h3>풀이 공간 · 내용 수정</h3><label className="label stacked">이 문제의 풀이 공간<select value={q.work_space} onChange={e=>{setQuestions(prev=>prev.map(item=>item.id===q.id?{...item,work_space:e.target.value as Question["work_space"]}:item));}}><option value="inherit">문제지 전체 설정 따르기</option><option value="compact">없음</option><option value="normal">32mm</option><option value="wide">72mm</option></select></label>{([['question','문제'],['answer','정답'],['solution','풀이']] as const).map(([field,label])=><label className="label stacked" key={field}>{label}<textarea rows={field==="answer"?2:3} maxLength={6000} value={draft[field]} onChange={e=>setDrafts(prev=>({...prev,[q.id]:{...draft,[field]:e.target.value}}))}/></label>)}<button className="btn btn-outline" onClick={()=>applyEdit(q)}>수정 반영</button>{drafts[q.id]&&<p className="hint">‘수정 반영’을 누르기 전에는 기존 내용이 출력됩니다.</p>}</div>}
                  {showMessage(q.id)}
                </div>
                <div className="row-side">
                  <p className="answer-peek"><span>정답</span><MathText text={q.answer} displayStyle/></p>
                  {q.diagram&&!big&&<div className="figure-thumb"><ProblemDiagram diagram={q.diagram}/></div>}
                </div>
                <div className="row-tools">
                  <button className="tool" aria-expanded={panel==="solution"} onClick={()=>openPanel(q.id,"solution")}>{q.solution_missing?"풀이 없음":"풀이"}</button>
                  {q.hint&&<button className="tool" aria-expanded={panel==="hint"} onClick={()=>openPanel(q.id,"hint")}>힌트</button>}
                  {q.diagram&&<button className="tool" aria-pressed={big} onClick={()=>setBigFigure(prev=>({...prev,[q.id]:!big}))}>그림 크게</button>}
                  <button className="tool" aria-expanded={panel==="edit"} onClick={()=>openPanel(q.id,"edit")}>수정</button>
                  <button className="tool tool-toggle" aria-pressed={q.retry} onClick={()=>setRetry(q.id,!q.retry)}>오답 표시</button>
                </div>
              </article>;
            })}
          </div>
          <p className="hint sheet-note">{hasFigure&&"그림은 입력된 좌표로 그린 개략도입니다. 축 배율은 다를 수 있고, 점만 닿는 영역은 이웃이 아닙니다. 문제 조건과 직접 대조하세요. "}‘오답’으로 표시한 문제는 학생 종이에 별표와 ‘다시!’로 나옵니다. 마지막으로 불러온 문제는 이 기기에 남아, 새로고침해도 ‘지난 문제 다시 열기’로 되살릴 수 있습니다.</p>
          <div className="tally"><p><span className="pen-count" aria-hidden="true">{picked.length}</span><span className="sr-only">{picked.length}</span>문제 골랐습니다{picked.length>0&&<span className="tally-sub"> · {picked.map(q=>`${numberOf(q)}번`).join(" · ")}{pickedRetry>0&&` · 다시 풀 문제 ${pickedRetry}개`}</span>}</p><button className="btn btn-primary" disabled={!picked.length} onClick={openPreview}>문제지 미리보기</button></div>
        </section>}
      </main>

      {loaded&&<aside id="step-print" className="print-panel" aria-labelledby="print-title">
        <h2 id="print-title">출력 준비</h2>
        <p className="lede">{picked.length?`${picked.length}문제 · 전체 ${questions.length}문제 중`:"왼쪽 번호를 눌러 문제를 고르세요."}</p>
        {picked.some(q=>q.solution_missing)&&<p className="msg msg-warn" role="status">고른 문제 중 풀이 없음 {picked.filter(q=>q.solution_missing).length}개 — 해설지에는 ‘{NO_SOLUTION}’이 들어갑니다.</p>}
        <div className="grid-2"><label className="label stacked">학생 이름<input value={student} maxLength={40} onChange={e=>setStudent(e.target.value)} placeholder="이름"/></label><label className="label stacked">날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
        <label className="label stacked">단원<input value={unit} maxLength={80} onChange={e=>setUnit(e.target.value)}/></label>
        <label className="label stacked">풀이 공간<select value={spacing} onChange={e=>setSpacing(e.target.value)}><option value="normal">기본 · 32mm</option><option value="wide">넓게 · 72mm</option><option value="compact">없음 · 빈 공간 줄이기</option></select></label>
        <label className="check"><input type="checkbox" checked={showHints} onChange={e=>setShowHints(e.target.checked)}/>문제지에 힌트 포함</label>
        <label className="check"><input type="checkbox" checked={compactPrint} onChange={e=>setCompactPrint(e.target.checked)}/>글·수식 줄 간격 줄이기</label>
        <div className="print-buttons"><button className="btn btn-primary btn-block" disabled={!picked.length} onClick={()=>void print(false)}>학생용 출력<span>문제만</span></button><button className="btn btn-outline btn-block" disabled={!picked.length} onClick={()=>void print(true)}>교사용 출력<span>문제 + 정답·해설</span></button></div>
        <div className="preview-box">
          <button className="mini-sheet" disabled={!picked.length} onClick={openPreview} aria-label={`${answers?"교사용":"학생용"} 미리보기 크게 보기`}>
            <span key={answers?"back":"front"} className={`mini-page ${answers?"is-back":""}`} aria-hidden="true">
              <span className="mini-title">{answers?"정답 및 해설":<><span className="mini-circled">다시<PencilCircle animate={false}/></span>풀기</>}</span>
              <span className="mini-rule"/>
              {(picked.length?picked:questions.slice(0,3)).slice(0,5).map((q,i)=><span className="mini-line" key={q.id}><b>{i+1}</b>{q.retry&&!answers&&<PencilStar/>}<i/><i/></span>)}
            </span>
          </button>
          <div className="preview-side"><span className="label" id="flip-label">미리보기</span><div className="segmented small" role="group" aria-labelledby="flip-label"><button aria-pressed={!answers} onClick={()=>setAnswers(false)}>학생용</button><button aria-pressed={answers} onClick={()=>setAnswers(true)}>교사용</button></div><span className="mini-caption">{picked.length?"종이를 누르면 크게 봅니다":"문제를 고르면 미리 봅니다"}</span></div>
        </div>
        <details className="fold print-guide"><summary>인쇄 창 설정 안내</summary><ol><li>대상: ‘PDF로 저장’ 또는 프린터</li><li>용지: A4 · 배율 100%</li><li>머리글·바닥글: 끄기</li></ol></details>
      </aside>}
    </div>

    {preview&&!!picked.length&&<div id="preview" className={`print-document spacing-${spacing} ${compactPrint?"print-compact":""}`}>
      <div className="preview-head no-print"><h2>{answers?"교사용 미리보기 · 문제 + 정답·해설":"학생용 미리보기 · 문제만"}</h2><button className="tool" onClick={()=>setAnswers(!answers)}>{answers?"학생용으로 뒤집기":"교사용으로 뒤집기"}</button></div>
      <section className="worksheet"><header className="worksheet-header"><div className="paper-title"><h1><span className="paper-circled">다시<PencilCircle animate={false}/></span>풀기</h1><p>한 번 틀려도, 한 번 더.</p></div><div className="worksheet-info"><span>이름 <b>{student||" "}</b></span><span>날짜 <b>{date||" "}</b></span><span>단원 <b>{unit||" "}</b></span></div>{study.mistake?.trim()&&<p className="worksheet-focus"><strong>이번에 신경 쓸 점</strong>{study.mistake.trim()}</p>}</header>
        {picked.map((q,i)=><article className="print-question" key={q.id}><div><p className="question-text"><strong className="print-number">{i+1}</strong>{q.retry&&<span className="print-retry"><PencilStar/>다시!</span>}<MathText text={printText(q.question,compactPrint)}/></p><ProblemDiagram diagram={q.diagram}/>{showHints&&q.hint&&<p className="print-hint">힌트 <MathText text={q.hint}/></p>}<div className={`work-space space-${q.work_space}`}/></div></article>)}
        <footer className="paper-foot">다시풀기 · 나의 속도로, 한 문제씩.</footer>
      </section>
      {answers&&<section className="answer-sheet"><header className="worksheet-header"><div className="paper-title"><h1>정답 및 해설</h1><p>다시풀기{unit?` · ${unit}`:""}</p></div><div className="worksheet-info"><span>이름 <b>{student||" "}</b></span><span>날짜 <b>{date||" "}</b></span></div></header>{picked.map((q,i)=><article className="print-answer" key={q.id}><h2><span className="print-number">{i+1}</span>정답 <MathText text={q.answer} displayStyle/></h2><p className="pre-wrap"><MathText text={printText(q.solution_missing?NO_SOLUTION:q.solution,compactPrint)}/></p></article>)}</section>}
    </div>}
  </>;
}
