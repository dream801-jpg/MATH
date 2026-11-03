"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis, Mode, Question,SubjectMode,EnglishMode,EnglishQuestionType } from "@/lib/schema";
import { MathText } from "./components/math-text";
import { ProblemDiagram } from "./components/problem-diagram";
import {canSelect,NO_SOLUTION} from "@/lib/teacher-review";
import type {StudyContext} from "@/lib/study-context";
import {printText} from "@/lib/text-format";
import {sampleWorksheets} from "@/lib/sample-worksheets";
import { buildPrompt, editQuestion, exportWorksheet, importWorksheet, MAX_IMPORT_BYTES } from "@/lib/worksheet";

const choices:{id:Mode;title:string;description:string;symbol:string}[]=[
  {id:"numbers",title:"숫자만 변경",description:"같은 풀이로 한 번 더",symbol:"123"},
  {id:"similar",title:"비슷한 유형",description:"표현을 바꾸어 익히기",symbol:"≈"},
  {id:"applied",title:"응용 문제",description:"다른 상황에 적용하기",symbol:"↗"},
];
const englishChoices:{id:EnglishMode;title:string;description:string;symbol:string}[]=[
  {id:"retarget",title:"원문 유지",description:"같은 지문의 다른 부분 출제",symbol:"A"},
  {id:"light",title:"표현만 조금 변경",description:"단어·짧은 표현 1~3곳",symbol:"≈"},
];
const steps=[["step-request","AI에 요청"],["step-import","불러와서 고르기"],["step-print","출력하기"]] as const;
// 마지막으로 불러온 문제 목록을 이 기기에만 보관한다. 새로고침·탭 종료 후 되살리기용.
const STORE_KEY="dasi-pulgi:last";
type Origin="paste"|"file"|"example"|"saved";
type Message={at:string;text:string;kind:"notice"|"error"};
type Saved={text:string;unit:string;count:number};

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
  const [preview,setPreview]=useState(false);const [answers,setAnswers]=useState(false);
  const [student,setStudent]=useState("");const [date,setDate]=useState("");const [unit,setUnit]=useState("");
  const [spacing,setSpacing]=useState("normal");const [compactPrint,setCompactPrint]=useState(true);const [copied,setCopied]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);const resultRef=useRef<HTMLElement>(null);
  const eligible=(q:Question)=>canSelect(q,!!diagramConfirmed[q.id],!!missingAllowed[q.id]);
  const picked=questions.filter(q=>selected.includes(q.id)&&eligible(q));
  const prompt=buildPrompt(mode,count,original,{subject,englishMode,englishType,study});
  const stepIndex=preview&&picked.length?2:questions.length?1:0;

  useEffect(()=>{setDate(new Date().toLocaleDateString("sv-SE"));},[]);
  useEffect(()=>{setCopied(false);},[mode,count,original,subject,englishMode,englishType,study]);
  useEffect(()=>{try{const raw=localStorage.getItem(STORE_KEY);if(raw)setSaved(JSON.parse(raw) as Saved);}catch{/* 저장소를 쓸 수 없는 브라우저 */}},[]);
  useEffect(()=>{
    if(!analysis||!questions.length||origin==="example")return;
    const data:Saved={text:exportWorksheet(analysis,questions),unit:analysis.unit,count:questions.length};
    try{localStorage.setItem(STORE_KEY,JSON.stringify(data));setSaved(data);}catch{/* 저장 실패는 무시 */}
  },[analysis,questions,origin]);

  const say=(at:string,text:string,kind:Message["kind"]="notice")=>setMessage({at,text,kind});
  // 메시지는 그 원인이 된 버튼 바로 옆에만 보여준다.
  const showMessage=(at:string)=>message&&message.at===at?<p className={message.kind==="error"?"error-message":"notice"} role={message.kind==="error"?"alert":"status"}>{message.kind==="error"&&<strong>확인이 필요합니다. </strong>}{message.text}</p>:null;

  function load(text:string,from:Origin="paste") {
    setMessage(null);
    if(!text.trim()){say("import","붙여넣은 내용이 없습니다. AI 답변의 JSON을 먼저 붙여넣어 주세요.","error");return;}
    try {
      const data=importWorksheet(text);
      setAnalysis(data.analysis);setUnit(data.analysis.unit);setQuestions(data.questions);setWarnings(data.displayWarnings);setOrigin(from);
      setSource(from==="paste"?text:"");
      if(/영어|english/i.test(data.analysis.subject))setSubject("english");else if(data.analysis.subject)setSubject("math");
      setSelected([]);setDrafts({});setDiagramConfirmed({});setMissingAllowed({});setPreview(false);setShowHints(false);
      const failed=data.questions.filter(q=>q.verification==="failed").length;
      const prefix={example:"예제 ",saved:"지난번 ",file:"",paste:""}[from];
      say("results",`${prefix}${data.questions.length}문제를 불러왔습니다. ${failed?`필수 도형이 빠진 ${failed}문제는 선택할 수 없습니다. 도형을 포함해 다시 요청하세요.`:"정답과 풀이를 확인한 뒤 출력할 문제를 고르세요."}`);
      setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50);
    } catch(e) {say("import",e instanceof Error?e.message:"문제 파일을 읽지 못했습니다.","error");}
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
  function applyEdit(q:Question) {
    try {
      const draft=drafts[q.id];
      const updated=editQuestion(q,draft||q);
      setQuestions(prev=>prev.map(item=>item.id===q.id?updated:item));
      setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);
      setDiagramConfirmed(prev=>({...prev,[q.id]:false}));setMissingAllowed(prev=>({...prev,[q.id]:false}));
      setDrafts(prev=>{const next={...prev};delete next[q.id];return next;});
      say(q.id,"수정한 내용을 반영했습니다. 정답·풀이와 도형 조건을 확인하고 다시 선택하세요.");
    }catch{say(q.id,"문제와 정답은 비워둘 수 없습니다. 각 항목을 6,000자 이하로 작성하세요.","error");}
  }
  function goPrint() {
    setPreview(true);
    setTimeout(()=>document.getElementById("step-print")?.scrollIntoView({behavior:"smooth",block:"start"}),50);
  }
  async function print(include:boolean) {
    if(!picked.length)return;
    setAnswers(include);setPreview(true);
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    await document.fonts.ready;window.print();
  }

  return <>
    <div className="app-shell no-print">
      <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">↻</span>다시풀기<span className="brand-caption">나의 과외 문제지</span></div></header>
      <main>
        <h1 className="intro-title">틀린 문제를 AI로 다시 만들어, A4 문제지로 출력하세요.</h1>
        <nav aria-label="진행 단계"><ol className="steps">{steps.map(([id,label],i)=><li key={id}>{i<2||stepIndex===2
          ?<a href={`#${id}`} aria-current={i===stepIndex?"step":undefined}><span className="step-number">{i+1}</span>{label}</a>
          :<span className="step-off"><span className="step-number">{i+1}</span>{label}</span>}</li>)}</ol></nav>
        <div className="workspace">
          <aside>
            <section id="step-request" className="card request-card" aria-labelledby="request-title"><h2 id="request-title">어떤 연습을 만들까요?</h2><p className="muted">방식과 개수를 고르고 요청문을 복사해, 문제 사진과 함께 쓰던 AI 대화에 붙여넣으세요.</p>
              <fieldset className="subject-field"><legend>과목</legend><div className="subject-tabs" role="group" aria-label="과목 선택">{([["math","수학"],["english","영어"]] as const).map(([value,label])=><button key={value} aria-pressed={subject===value} className={subject===value?"active":""} onClick={()=>setSubject(value)}>{label}</button>)}</div></fieldset>
              {subject==="english"?<><div className="mode-grid english-mode-grid" role="group" aria-label="영어 변형 방식">{englishChoices.map(choice=><button key={choice.id} className={`mode ${englishMode===choice.id?"active":""}`} aria-pressed={englishMode===choice.id} onClick={()=>setEnglishMode(choice.id)}><span className="mode-symbol" aria-hidden="true">{choice.symbol}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div><label className="field-label" htmlFor="english-type">영어 문제 유형</label><select id="english-type" value={englishType} onChange={e=>setEnglishType(e.target.value as EnglishQuestionType)}><option value="retain">원본 유형 유지</option><option value="blank">빈칸 추론</option><option value="grammar">어법</option><option value="vocabulary">문맥상 어휘</option><option value="mixed">섞어서 출제</option></select><p className="english-mode-note">원본 유형 유지는 문장삽입이면 다른 문장을, 빈칸이면 다른 부분을 출제합니다. 원문 유지에서도 어법·어휘 오류를 찾는 문제는 출제 부분 한 곳을 의도적으로 바꿀 수 있습니다.</p></>:<div className="mode-grid" role="group" aria-label="유사문제 생성 방식">{choices.map(choice=><button key={choice.id} className={`mode ${mode===choice.id?"active":""}`} aria-pressed={mode===choice.id} onClick={()=>setMode(choice.id)}><span className="mode-symbol" aria-hidden="true">{choice.symbol}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div>}
              <fieldset><legend>생성 개수</legend><div className="count-group">{[3,5,10].map(n=><button key={n} aria-pressed={count===n} className={count===n?"active":""} onClick={()=>setCount(n)}>{n}문제</button>)}</div></fieldset>
              <details className="prompt-original"><summary>사진 대신 원문 입력 (선택)</summary><label className="field-label" htmlFor="prompt-original">AI에 보낼 원본 문제</label><textarea id="prompt-original" maxLength={6000} rows={3} value={original} onChange={e=>setOriginal(e.target.value)} placeholder="사진을 보낼 경우 비워두세요."/></details>
              <details className="lesson-settings"><summary>수업 조건과 연습 목적 (선택)</summary>{([["grade","학년"],["scope","배운 범위"],["methods","허용 풀이 방법"],["mistake","원본에서 틀린 이유"]] as const).map(([field,label])=><label className="edit-label" key={field}>{label}<input maxLength={240} value={study[field]||""} onChange={e=>setStudy(prev=>({...prev,[field]:e.target.value}))}/></label>)}<label className="edit-label">연습 목적<select value={study.purpose||""} onChange={e=>setStudy(prev=>({...prev,purpose:e.target.value as StudyContext["purpose"]}))}><option value="">기본</option><option value="concept">개념 다시 익히기</option><option value="accuracy">계산·표현 실수 줄이기</option><option value="independent">혼자 풀 수 있는지 확인하기</option></select></label><p className="hint">목적에 맞는 힌트와 해설을 AI에 요청합니다. ‘틀린 이유’를 적으면 학생 문제지 머리에 ‘이번에 신경 쓸 점’으로 인쇄됩니다.</p></details>
              <button className="button primary full" onClick={()=>void copyPrompt()}>{copied?"요청문 복사됨 · 다시 복사":"AI에 보낼 요청문 복사"}</button>
              {showMessage("request")}
              <details><summary>요청문 직접 복사</summary><textarea aria-label="AI 요청문" readOnly value={prompt} rows={10} onFocus={e=>e.target.select()}/></details>
              <p className="file-note">ChatGPT, Claude 등 어느 AI에서나 같은 요청문을 쓰면 됩니다. 이 앱은 AI를 직접 부르지 않고, 모든 처리는 이 브라우저 안에서 합니다.</p>
            </section>
          </aside>
          <div className="content-column">
            <section id="step-import" className="card import-card" aria-labelledby="import-title"><h2 id="import-title">AI가 만든 문제를 붙여넣으세요.</h2><p className="muted">AI 답변의 JSON 코드 블록을 통째로 복사해 붙여넣거나, 저장해 둔 문제 파일을 여세요. 새 내용을 제대로 읽은 뒤에만 지금 목록이 바뀝니다.</p>
              {saved&&(!questions.length||origin==="example")&&<button className="resume-button" onClick={()=>load(saved.text,"saved")}><strong>지난 문제 다시 열기</strong><small>{saved.unit||"단원 없음"} · {saved.count}문제 · 이 기기에 저장됨</small></button>}
              <label className="field-label" htmlFor="import-source">AI 답변 붙여넣기</label><textarea id="import-source" className="import-source" value={source} maxLength={MAX_IMPORT_BYTES} onChange={e=>setSource(e.target.value)} rows={7} placeholder={'{\n  "unit": "일차방정식",\n  "generated_questions": [\n    {"question": "3x + 5 = 20", "answer": "5", "solution": "3x = 15이므로 x = 5"}\n  ]\n}'}/>
              <div className="import-actions"><button className="button dark" disabled={reading} onClick={()=>load(source)}>붙여넣은 문제 불러오기 →</button><button className="button secondary" disabled={reading} onClick={()=>fileRef.current?.click()}>{reading?"파일을 읽고 있습니다...":"문제 파일 열기"}</button></div>
              {showMessage("import")}
              <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={e=>{void readFile(e.target.files?.[0]);e.target.value="";}}/>
              <p className="hint">JSON·TXT 파일 / 최대 1MB / 한 번에 30문제까지</p>
              <details className="sample-library" open={!questions.length}><summary>예제로 먼저 써보기 · {sampleWorksheets.length}개</summary><p className="hint">파일 없이 바로 열립니다. 예제를 열면 지금 문제 목록이 예제로 바뀝니다.</p><div className="sample-grid">{sampleWorksheets.map(sample=><button key={sample.id} className="sample-button" onClick={()=>load(JSON.stringify(sample.data),"example")}><strong>{sample.title}</strong><small>{sample.description}</small></button>)}</div></details>
            </section>
            {!!questions.length&&analysis&&<>
              {(analysis.original_problem||analysis.unit||analysis.original_diagram||analysis.warning||analysis.answer||analysis.solution)&&<section className="card" aria-labelledby="original-title"><h2 id="original-title">원본 문제</h2>{analysis.original_problem&&<p className="pre-wrap"><MathText text={analysis.original_problem}/></p>}<ProblemDiagram diagram={analysis.original_diagram}/><div className="original-answer"><strong>AI가 구한 원본 정답</strong><p className="original-answer-value"><MathText text={analysis.answer||"정답을 제시하지 못했습니다."}/></p><p className="hint">AI의 답이 틀릴 수 있습니다. 원본 정답지와 비교한 뒤 유사문제를 쓰세요.</p><details><summary>원본 풀이 확인</summary><p className="pre-wrap"><MathText text={analysis.solution||"원본 풀이가 없습니다. AI에 원본 풀이를 먼저 요청하세요."}/></p></details></div><dl className="metadata">{[["과목",analysis.subject],["단원",analysis.unit],["문제 유형",analysis.problem_type],["핵심 개념",analysis.concept],["난이도",analysis.difficulty]].filter(([,v])=>v).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{analysis.warning&&<p className="notice">{analysis.warning}</p>}</section>}
              <section className="results" ref={resultRef} aria-labelledby="results-title"><div className="section-heading"><h2 id="results-title">연습 문제 <span className="count-badge">{questions.length}</span></h2><button className="text-button" onClick={saveFile}>문제 파일 저장</button></div>
                {showMessage("results")}
                {warnings.length>0&&<div className="review-warning" role="alert"><strong>수식이 제대로 보이는지 확인하세요</strong><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
                <p className="hint">정답·풀이를 펼쳐 확인한 뒤, 문제 위쪽 줄을 눌러 출력할 문제를 고르세요. ‘오답으로 표시’한 문제는 학생 종이에 ‘다시 도전’으로 나옵니다. 마지막으로 불러온 문제는 이 기기에 남아, 새로고침해도 ‘지난 문제 다시 열기’로 되살릴 수 있습니다.</p>
                <div className="bulk-actions" role="group" aria-label="한 번에 선택"><button className="chip" onClick={()=>{setSelected(questions.filter(eligible).map(q=>q.id));setPreview(false);}}>선택 가능한 문제 모두 선택</button><button className="chip" onClick={()=>{setSelected(questions.filter(q=>q.retry&&eligible(q)).map(q=>q.id));setPreview(false);}}>오답 표시만 선택</button>{selected.length>0&&<button className="chip" onClick={()=>{setSelected([]);setPreview(false);}}>선택 해제</button>}</div>
                {questions.map((q,i)=>{
                  const draft=drafts[q.id]||q;
                  const isSelected=selected.includes(q.id)&&eligible(q);
                  const failed=q.verification==="failed";
                  const reason=failed?q.verification_note:q.diagram_review_required&&!diagramConfirmed[q.id]?"도형 재확인이 끝나야 선택할 수 있습니다.":q.solution_missing&&!missingAllowed[q.id]?"풀이 없이 쓰는 것을 허용해야 선택할 수 있습니다.":"";
                  return <article className={`question-card ${isSelected?"selected":""} ${failed?"failed-question":""}`} key={q.id}>
                    <label className="question-select"><input type="checkbox" disabled={!eligible(q)} checked={isSelected} onChange={()=>toggle(q.id)} aria-describedby={reason?`${q.id}-reason`:undefined}/><strong>문제 {i+1}</strong>{q.retry&&<span className="badge retry">오답</span>}<span className="select-state">{isSelected?"선택됨":eligible(q)?"눌러서 선택":"선택 불가"}</span></label>
                    {reason&&<p id={`${q.id}-reason`} className="question-reason">{reason}</p>}
                    <p className="question-text"><MathText text={q.question}/></p>
                    <ProblemDiagram diagram={q.diagram}/>
                    {q.hint&&<details><summary>힌트 보기</summary><p className="pre-wrap"><MathText text={q.hint}/></p></details>}
                    <details><summary>정답 · 풀이{q.solution_missing?" (풀이 없음)":""}</summary><p className="pre-wrap">정답: <MathText text={q.answer}/>{"\n\n"}<MathText text={q.solution_missing?NO_SOLUTION:q.solution}/></p></details>
                    {q.diagram_review_required&&<div className="review-warning"><strong>도형 재확인 필요</strong><p>본문이 바뀌어 기존 그림의 길이·좌표·각·교점이 조건과 다를 수 있습니다. 그림 수정이 필요하면 새 JSON을 불러오세요.</p><label className="check-row"><input type="checkbox" checked={!!diagramConfirmed[q.id]} onChange={e=>{setDiagramConfirmed(prev=>({...prev,[q.id]:e.target.checked}));setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);}}/>수정한 조건과 기존 도형·그래프가 일치함을 직접 확인했습니다</label></div>}
                    {q.solution_missing&&<div className="review-warning"><strong>풀이 없음</strong><p>해설지에는 ‘{NO_SOLUTION}’ 안내문이 출력됩니다.</p><label className="check-row"><input type="checkbox" checked={!!missingAllowed[q.id]} onChange={e=>{setMissingAllowed(prev=>({...prev,[q.id]:e.target.checked}));setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);}}/>풀이 없는 상태로 쓰는 것을 허용합니다</label></div>}
                    <details className="question-editor"><summary>풀이 공간 · 내용 수정</summary><label className="edit-label">이 문제의 풀이 공간<select value={q.work_space} onChange={e=>{setQuestions(prev=>prev.map(item=>item.id===q.id?{...item,work_space:e.target.value as Question["work_space"]}:item));}}><option value="inherit">문제지 전체 설정 따르기</option><option value="compact">없음</option><option value="normal">32mm</option><option value="wide">72mm</option></select></label>{([['question','문제'],['answer','정답'],['solution','풀이']] as const).map(([field,label])=><label className="edit-label" key={field}>{label}<textarea rows={field==="answer"?2:3} maxLength={6000} value={draft[field]} onChange={e=>setDrafts(prev=>({...prev,[q.id]:{...draft,[field]:e.target.value}}))}/></label>)}<button className="button secondary" onClick={()=>applyEdit(q)}>수정 반영</button>{drafts[q.id]&&<p className="hint">‘수정 반영’을 누르기 전에는 기존 내용이 출력됩니다.</p>}</details>
                    {showMessage(q.id)}
                    <div className="question-tools"><button className="chip" aria-pressed={q.retry} onClick={()=>setQuestions(prev=>prev.map(item=>item.id===q.id?{...item,retry:!item.retry}:item))}>{q.retry?"오답 표시됨 · 해제":"오답으로 표시"}</button></div>
                  </article>;
                })}
                <div className="selection-bar"><span><strong>{picked.length}</strong>문제 선택됨</span><button className="button" disabled={!picked.length} onClick={goPrint}>문제지 만들기 →</button></div>
              </section>
            </>}
          </div>
        </div>
        {preview&&!!picked.length&&<section id="step-print" className="card print-settings" aria-labelledby="print-title"><h2 id="print-title">{picked.length}문제로 문제지를 만듭니다.</h2>{picked.some(q=>q.solution_missing)&&<p className="review-warning" role="status">선택한 문제 중 풀이 없음 {picked.filter(q=>q.solution_missing).length}개가 있습니다. 해설지에는 풀이 대신 다음 안내문이 들어갑니다: {NO_SOLUTION}</p>}<div className="settings-grid"><label>학생 이름<input value={student} maxLength={40} onChange={e=>setStudent(e.target.value)} placeholder="이름 입력"/></label><label>날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>단원<input value={unit} maxLength={80} onChange={e=>setUnit(e.target.value)}/></label><label>풀이 공간<select value={spacing} onChange={e=>setSpacing(e.target.value)}><option value="normal">기본 · 풀이 공간 32mm</option><option value="wide">넓게 · 풀이 공간 72mm</option><option value="compact">없음 · 빈 공간 줄이기</option></select></label></div>
          <label className="check-row"><input type="checkbox" checked={showHints} onChange={e=>setShowHints(e.target.checked)}/>문제지에 힌트 포함</label><label className="check-row"><input type="checkbox" checked={compactPrint} onChange={e=>setCompactPrint(e.target.checked)}/>글·수식 줄 간격 줄이기</label>
          <div className="print-guide"><strong>인쇄 창이 열리면 이렇게 맞추세요</strong><ol><li>대상: ‘PDF로 저장’ 또는 프린터</li><li>용지: A4</li><li>배율: 100%</li><li>머리글·바닥글: 끄기</li></ol></div>
          <div className="print-actions"><button className="button primary" onClick={()=>void print(false)}>학생용 출력<small>문제만</small></button><button className="button dark" onClick={()=>void print(true)}>교사용 출력<small>문제 + 정답·해설</small></button></div>
          <div className="preview-switch"><span>아래 미리보기</span><div className="count-group" role="group" aria-label="미리보기 종류"><button aria-pressed={!answers} className={!answers?"active":""} onClick={()=>setAnswers(false)}>학생용</button><button aria-pressed={answers} className={answers?"active":""} onClick={()=>setAnswers(true)}>교사용</button></div></div></section>}
      </main><footer>다시풀기 <span aria-hidden="true">·</span> 나의 속도로, 한 문제씩.</footer>
    </div>
    {preview&&!!picked.length&&<div className={`print-document spacing-${spacing} ${compactPrint?"print-compact":""}`}>
      <section className="worksheet"><header className="worksheet-header"><p>한 번 틀려도, 한 번 더.</p><h1>다시 풀기</h1><div className="worksheet-info"><span>이름: {student||"________________"}</span><span>날짜: {date||"________________"}</span><span>단원: {unit||"________________"}</span></div>{study.mistake?.trim()&&<p className="worksheet-focus"><strong>이번에 신경 쓸 점</strong> {study.mistake.trim()}</p>}</header>
        {picked.map((q,i)=><article className="print-question" key={q.id}><div><p className="question-text"><strong className="print-number">{i+1}.</strong>{q.retry&&<span className="print-retry">다시 도전</span>}<MathText text={printText(q.question,compactPrint)}/></p><ProblemDiagram diagram={q.diagram}/>{showHints&&q.hint&&<p className="print-hint">힌트: <MathText text={q.hint}/></p>}<div className={`work-space space-${q.work_space}`}/></div></article>)}
      </section>
      {answers&&<section className="answer-sheet"><header className="worksheet-header"><p>다시 풀기</p><h1>정답 및 해설</h1><div className="worksheet-info"><span>{student}</span><span>{unit}</span></div></header>{picked.map((q,i)=><article className="print-answer" key={q.id}><h2>{i+1}번 · 정답: <MathText text={q.answer}/></h2><p className="pre-wrap"><MathText text={printText(q.solution_missing?NO_SOLUTION:q.solution,compactPrint)}/></p></article>)}</section>}
    </div>}
  </>;
}
