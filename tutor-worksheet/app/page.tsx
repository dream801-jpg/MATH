"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis, Mode, Question,SubjectMode,EnglishMode,EnglishQuestionType } from "@/lib/schema";
import { MathText } from "./components/math-text";
import { ProblemDiagram } from "./components/problem-diagram";
import { inferCircleChord } from "@/lib/diagram-schema";
import {printText} from "@/lib/text-format";
import {sampleWorksheets} from "@/lib/sample-worksheets";
import { buildPrompt, checkQuestion, exampleText, exportWorksheet, importWorksheet, MAX_IMPORT_BYTES } from "@/lib/worksheet";

const choices:{id:Mode;title:string;description:string;symbol:string}[]=[
  {id:"numbers",title:"숫자만 변경",description:"같은 풀이로 한 번 더",symbol:"123"},
  {id:"similar",title:"비슷한 유형",description:"표현을 바꾸어 익히기",symbol:"≈"},
  {id:"applied",title:"응용 문제",description:"다른 상황에 적용하기",symbol:"↗"},
];
const englishChoices:{id:EnglishMode;title:string;description:string;symbol:string}[]=[
  {id:"retarget",title:"원문 유지",description:"같은 지문의 다른 부분 출제",symbol:"A"},
  {id:"light",title:"표현만 조금 변경",description:"단어·짧은 표현 1~3곳",symbol:"≈"},
];
const labels={needs_review:"정답·풀이 확인 후 선택",failed:"필수 도형 누락 · 선택 불가"};

export default function Home() {
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [subject,setSubject]=useState<SubjectMode>("math");
  const [englishMode,setEnglishMode]=useState<EnglishMode>("retarget");
  const [englishType,setEnglishType]=useState<EnglishQuestionType>("retain");
  const [mode,setMode]=useState<Mode>("numbers");const [count,setCount]=useState(5);const [original,setOriginal]=useState("");
  const [source,setSource]=useState("");const [questions,setQuestions]=useState<Question[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [drafts,setDrafts]=useState<Record<string,{question:string;answer:string;solution:string}>>({});
  const [error,setError]=useState("");const [notice,setNotice]=useState("");const [reading,setReading]=useState(false);
  const [preview,setPreview]=useState(false);const [answers,setAnswers]=useState(true);
  const [student,setStudent]=useState("");const [date,setDate]=useState("");const [unit,setUnit]=useState("");
  const [spacing,setSpacing]=useState("compact");const [compactPrint,setCompactPrint]=useState(true);const [copied,setCopied]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);const resultRef=useRef<HTMLElement>(null);
  const picked=questions.filter(q=>selected.includes(q.id)&&q.verification!=="failed");
  const prompt=buildPrompt(mode,count,original,{subject,englishMode,englishType});
  useEffect(()=>{setDate(new Date().toLocaleDateString("sv-SE"));},[]);
  useEffect(()=>{setCopied(false);},[mode,count,original,subject,englishMode,englishType]);
  function load(text:string,isExample=false) {
    setError("");setNotice("");
    try {
      const data=importWorksheet(text);
      setAnalysis(data.analysis);setUnit(data.analysis.unit);setQuestions(data.questions);setSource(text);
      setSelected([]);setDrafts({});setPreview(false);
      const failed=data.questions.filter(q=>q.verification==="failed").length;
      setNotice(`${isExample?"예제 ":""}${data.questions.length}문제를 불러왔습니다.${failed?` 필수 도형 누락 ${failed}개는 선택할 수 없습니다. 도형을 포함해 다시 요청하세요.`:" 정답과 풀이를 확인하고 문제를 선택하세요."}${data.displayWarnings.length?` 표시 점검: ${data.displayWarnings.join(" ")}`:""}`);
      setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50);
    } catch(e) {setError(e instanceof Error?e.message:"문제 파일을 읽지 못했습니다.");}
  }
  async function readFile(file?:File) {
    if(!file)return;setReading(true);setError("");
    try {
      if(file.size>MAX_IMPORT_BYTES)throw Error("문제 파일은 1MB 이하로 불러와 주세요.");
      load(await file.text());
    }catch(e){setError(e instanceof Error?e.message:"파일을 읽지 못했습니다.");}
    finally{setReading(false);}
  }
  async function copyPrompt() {
    try {await navigator.clipboard.writeText(prompt);setCopied(true);setNotice("요청문을 복사했습니다. 사용 중인 AI 대화에 문제 사진과 함께 붙여넣으세요.");}
    catch {setNotice("이 브라우저에서는 자동 복사가 지원되지 않습니다. ‘요청문 직접 복사’를 열고 글을 길게 누르거나 전체 선택해 복사하세요.");}
  }
  function saveFile() {
    if(!analysis)return;
    const blob=new Blob([exportWorksheet(analysis,questions)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="worksheet.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice("전체 문제를 파일로 저장했습니다. 다른 기기에서 이 파일을 불러올 수 있습니다. 확인 상태는 불러올 때 다시 점검합니다.");
  }
  function toggle(id:string) {setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);setPreview(false);}
  function applyEdit(q:Question) {
    try {
      const draft=drafts[q.id];
      const replacement=draft?.question!==q.question&&q.diagram?.type==="circle_chord"?inferCircleChord(draft?.question||q.question):undefined;
      const updated=checkQuestion({...q,...draft,diagram:replacement??q.diagram},q.id);
      setQuestions(prev=>prev.map(item=>item.id===q.id?updated:item));
      setSelected(prev=>prev.filter(id=>id!==q.id));setPreview(false);setError("");
      setDrafts(prev=>{const next={...prev};delete next[q.id];return next;});
      setNotice("수정한 내용을 반영했습니다. 정답·풀이와 도형의 조건을 확인하고 다시 선택하세요.");
    }catch{setError("문제와 정답을 비워둘 수 없습니다. 각 항목을 6,000자 이하로 작성하세요.");}
  }
  async function print(include:boolean) {
    setAnswers(include);setPreview(true);
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    await document.fonts.ready;window.print();
  }
  return <>
    <div className="app-shell no-print">
      <header className="topbar"><a className="brand" href="/" aria-label="처음으로"><span className="brand-mark">↻</span>다시풀기<span className="brand-caption">나의 과외 문제지</span></a><span className="private-label">API Key 없이 사용</span></header>
      <main>
        <div className="intro"><span className="eyebrow">한 번 틀려도, 한 번 더.</span><h1>쓰던 AI로 만들고,<br className="mobile-only"/> 여기서 출력하세요.</h1><p>ChatGPT · 코덱스 · Claude에서 만든 문제를 불러와 나만의 A4 문제지를 만드세요.</p></div>
        <ol className="steps" aria-label="진행 단계">{["AI에 요청하기","결과 불러오기","문제지 만들기"].map((label,i)=><li key={label} className={(i===0&&!questions.length||i===1&&questions.length&&!preview||i===2&&preview)?"current":""}><span>{String(i+1).padStart(2,"0")}</span>{label}</li>)}</ol>
        <div className="workspace">
          <aside>
            <section className="card request-card"><div className="section-label">01 · AI에 요청하기</div><h2>어떤 연습을 만들까요?</h2><p className="muted">방식과 개수를 고르고 요청문을 복사하세요. 문제 사진은 사용 중인 AI 대화에 직접 올리면 됩니다.</p>
              <fieldset className="subject-field"><legend>과목</legend><div className="subject-tabs" role="group" aria-label="과목 선택">{([["math","수학"],["english","영어"]] as const).map(([value,label])=><button key={value} aria-pressed={subject===value} className={subject===value?"active":""} onClick={()=>setSubject(value)}>{label}</button>)}</div></fieldset>
              {subject==="english"?<><div className="mode-grid english-mode-grid" role="group" aria-label="영어 변형 방식">{englishChoices.map(choice=><button key={choice.id} className={`mode ${englishMode===choice.id?"active":""}`} aria-pressed={englishMode===choice.id} onClick={()=>setEnglishMode(choice.id)}><span className="mode-symbol">{choice.symbol}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div><label className="field-label" htmlFor="english-type">영어 문제 유형</label><select id="english-type" value={englishType} onChange={e=>setEnglishType(e.target.value as EnglishQuestionType)}><option value="retain">원본 유형 유지</option><option value="blank">빈칸 추론</option><option value="grammar">어법</option><option value="vocabulary">문맥상 어휘</option><option value="mixed">섞어서 출제</option></select><p className="english-mode-note">원본 유형 유지는 문장삽입이면 다른 문장을, 빈칸이면 다른 부분을 출제합니다. 원문 유지에서도 어법·어휘 오류를 찾는 문제는 출제 부분 한 곳을 의도적으로 바꿀 수 있습니다.</p></>:<div className="mode-grid" role="group" aria-label="유사문제 생성 방식">{choices.map(choice=><button key={choice.id} className={`mode ${mode===choice.id?"active":""}`} aria-pressed={mode===choice.id} onClick={()=>setMode(choice.id)}><span className="mode-symbol">{choice.symbol}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div>}
              <fieldset><legend>생성 개수</legend><div className="count-group">{[3,5,10].map(n=><button key={n} aria-pressed={count===n} className={count===n?"active":""} onClick={()=>setCount(n)}>{n}문제</button>)}</div></fieldset>
              <details className="prompt-original"><summary>사진 대신 원문 입력 (선택)</summary><label className="field-label" htmlFor="prompt-original">AI에 보낼 원본 문제</label><textarea id="prompt-original" maxLength={6000} rows={3} value={original} onChange={e=>setOriginal(e.target.value)} placeholder="사진을 보낼 경우 비워두세요."/></details>
              <button className="button primary full" onClick={()=>void copyPrompt()}>{copied?"✓ 요청문 복사됨":"AI에 보낼 요청문 복사"}</button>
              <details><summary>요청문 직접 복사</summary><textarea aria-label="AI 요청문" readOnly value={prompt} rows={10} onFocus={e=>e.target.select()}/></details>
              <p className="file-note">어느 AI에서나 같은 요청문을 사용하세요.<br/>이 앱은 AI를 호출하지 않습니다.</p>
            </section>
            <div className="small-note"><strong>복잡한 연결 없이, 간단하게</strong><p>사진과 요청문은 AI에 보내고, 받은 결과는 이곳에 가져오세요. 앱의 불러오기·도형 표시·출력은 브라우저 안에서 처리됩니다.</p><p>새로고침하면 내용이 사라집니다. 나중에 쓰거나 다른 기기로 옮기려면 ‘문제 파일 저장’을 이용하세요.</p></div>
          </aside>
          <div className="content-column">
            {error&&<div className="error-message" role="alert">{error}</div>}
            {notice&&<div className="notice" role="status">{notice}</div>}
            <section className="card"><div className="section-label">02 · 결과 불러오기</div><h2>AI가 만든 문제를 가져오세요.</h2><p className="muted">AI 응답의 JSON을 그대로 붙여넣거나, 저장한 문제 파일을 불러오세요. 기존 문제는 새 내용을 정상적으로 읽은 뒤 교체됩니다.</p>
              <label className="field-label" htmlFor="import-source">AI 응답 붙여넣기</label><textarea id="import-source" className="import-source" value={source} maxLength={MAX_IMPORT_BYTES} onChange={e=>setSource(e.target.value)} rows={8} placeholder={'{\n  "unit": "일차방정식",\n  "generated_questions": [\n    {"question": "3x + 5 = 20", "answer": "5", "solution": "3x = 15이므로 x = 5"}\n  ]\n}'}/>
              <div className="import-actions"><button className="button dark" disabled={!source.trim()||reading} onClick={()=>load(source)}>붙여넣은 문제 불러오기 →</button><button className="button secondary" disabled={reading} onClick={()=>fileRef.current?.click()}>{reading?"파일을 읽고 있습니다...":"문제 파일 불러오기"}</button></div>
              <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={e=>{void readFile(e.target.files?.[0]);e.target.value="";}}/>
              <div className="import-foot"><span className="hint">JSON · TXT / 최대 1MB / 한 번에 30문제까지</span><button className="text-button" onClick={()=>load(exampleText,true)}>예제 5문제로 먼저 써보기 →</button></div>
              <div className="sample-library"><h3>지금까지 만든 예제</h3><p className="hint">파일 없이 바로 열어보세요. 예제를 열면 현재 문제 목록이 바뀝니다.</p><div className="sample-grid">{sampleWorksheets.map(sample=><button key={sample.id} className="sample-button" onClick={()=>load(JSON.stringify(sample.data),true)}><strong>{sample.title}</strong><small>{sample.description}</small></button>)}</div></div>
            </section>
            {!!questions.length&&analysis&&<>
              {(analysis.original_problem||analysis.unit||analysis.original_diagram||analysis.warning||analysis.answer||analysis.solution)&&<section className="card"><div className="section-label">원본 문제 정보</div>{analysis.original_problem&&<p className="pre-wrap"><MathText text={analysis.original_problem}/></p>}<ProblemDiagram diagram={analysis.original_diagram}/><div className="original-answer"><strong>원본 문제 · AI가 구한 정답</strong><p className="original-answer-value"><MathText text={analysis.answer||"정답을 제시하지 못했습니다."}/></p><p className="hint">AI의 답이 틀릴 수 있습니다. 원본 정답지와 비교한 뒤 유사문제를 사용하세요.</p><details><summary>원본 풀이 확인</summary><p className="pre-wrap"><MathText text={analysis.solution||"원본 풀이가 없습니다. AI에 원본 풀이를 먼저 요청하세요."}/></p></details></div><dl className="metadata">{[["과목",analysis.subject],["단원",analysis.unit],["문제 유형",analysis.problem_type],["핵심 개념",analysis.concept],["난이도",analysis.difficulty]].filter(([,v])=>v).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{analysis.warning&&<p className="notice">{analysis.warning}</p>}</section>}
              <section className="card results" ref={resultRef}><div className="section-heading"><div><div className="section-label">03 · 확인하고 고르기</div><h2>연습 문제 <span className="count-badge">{questions.length}</span></h2></div><button className="text-button" onClick={saveFile}>문제 파일 저장 ↓</button></div>
                <p className="hint">AI가 작성한 문제·정답·풀이와 도형을 확인한 뒤 선택하세요.</p>
                <button className="text-button" onClick={()=>{setSelected(questions.filter(q=>q.verification!=="failed").map(q=>q.id));setPreview(false);}}>전체 문제·정답을 확인하고 모두 선택</button>
                {questions.map((q,i)=>{
                  const draft=drafts[q.id]||q;
                  return <article className={`question-card ${selected.includes(q.id)?"selected":""} ${q.verification==="failed"?"failed-question":""}`} key={q.id}><div className="question-top"><strong>문제 {i+1}</strong><span className="badge">{labels[q.verification]}</span></div><p className="question-text"><MathText text={q.question}/></p>
                    <ProblemDiagram diagram={q.diagram}/>
                    <details><summary>정답 · 풀이</summary><p className="pre-wrap">정답: <MathText text={q.answer}/>{"\n\n"}<MathText text={q.solution}/></p></details>
                    <details className="question-editor"><summary>문제·정답·풀이 수정</summary>{([['question','문제'],['answer','정답'],['solution','풀이']] as const).map(([field,label])=><label className="edit-label" key={field}>{label}<textarea rows={field==="answer"?2:3} maxLength={6000} value={draft[field]} onChange={e=>setDrafts(prev=>({...prev,[q.id]:{...draft,[field]:e.target.value}}))}/></label>)}<button className="button secondary" onClick={()=>applyEdit(q)}>수정 반영</button>{drafts[q.id]&&<p className="hint">수정 반영 전에는 기존 내용이 출력됩니다.</p>}</details>
                    {q.verification==="failed"&&<p className="hint">{q.verification_note}</p>}
                    <label className="check-row select-row"><input type="checkbox" disabled={q.verification==="failed"} checked={selected.includes(q.id)} onChange={()=>toggle(q.id)}/>문제·정답을 확인하고 선택</label>
                  </article>;
                })}
                <div className="selection-footer"><span><strong>{picked.length}개</strong> 선택됨</span><button className="button dark" disabled={!picked.length} onClick={()=>{setPreview(true);setTimeout(()=>document.getElementById("worksheet-settings")?.scrollIntoView({behavior:"smooth"}),50);}}>선택 문제로 문제지 만들기 →</button></div>
              </section>
            </>}
          </div>
        </div>
        {preview&&!!picked.length&&<section id="worksheet-settings" className="card print-settings"><div className="section-label">04 · 출력 준비</div><h2>문제지가 준비되었습니다.</h2><div className="settings-grid"><label>학생 이름<input value={student} maxLength={40} onChange={e=>setStudent(e.target.value)} placeholder="이름 입력"/></label><label>날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>단원<input value={unit} maxLength={80} onChange={e=>setUnit(e.target.value)}/></label><label>풀이 공간<select value={spacing} onChange={e=>setSpacing(e.target.value)}><option value="compact">없음 · 빈 공간 줄이기</option><option value="normal">기본 · 풀이 공간 32mm</option><option value="wide">넓게 · 풀이 공간 72mm</option></select></label></div>
          <label className="check-row"><input type="checkbox" checked={compactPrint} onChange={e=>setCompactPrint(e.target.checked)}/>출력할 글·수식 간격 줄이기</label><p className="hint">긴 문제·해설은 다음 장으로 이어집니다. 위의 풀이 공간과 간격을 바꾸면 이미 불러온 문제도 바로 반영됩니다.</p><label className="check-row"><input type="checkbox" checked={answers} onChange={e=>setAnswers(e.target.checked)}/>끝에 정답 및 해설 추가</label><div className="print-actions"><button className="button secondary" onClick={()=>void print(false)}>문제지만 PDF</button><button className="button secondary" onClick={()=>void print(true)}>문제 + 정답 PDF</button><button className="button primary" onClick={()=>void print(answers)}>PDF 저장</button><button className="button dark" onClick={()=>void print(answers)}>인쇄</button></div><p className="hint">PDF 버튼도 브라우저 인쇄 창을 엽니다. 대상은 ‘PDF로 저장’, 용지는 A4, 배율 100%, 머리글·바닥글 끄기를 선택하세요. 긴 문제나 해설은 여러 장에 이어질 수 있습니다.</p></section>}
      </main><footer>다시풀기 <span>·</span> 나의 속도로, 한 문제씩.</footer>
    </div>
    {preview&&!!picked.length&&<div className={`print-document spacing-${spacing} ${compactPrint?"print-compact":""}`}>
      <section className="worksheet"><header className="worksheet-header"><p>한 번 더 익히는 나만의 연습</p><h1>유사문제 연습</h1><div className="worksheet-info"><span>학생 이름: {student||"________________"}</span><span>날짜: {date||"________________"}</span><span>단원: {unit||"________________"}</span></div></header>
        {picked.map((q,i)=><article className="print-question" key={q.id}><div className="print-number">{i+1}.</div><div><p className="question-text"><MathText text={printText(q.question,compactPrint)}/></p><ProblemDiagram diagram={q.diagram}/><div className="work-space"/></div></article>)}
      </section>
      {answers&&<section className="answer-sheet"><header className="worksheet-header"><p>유사문제 연습</p><h1>정답 및 해설</h1><div className="worksheet-info"><span>{student}</span><span>{unit}</span></div></header>{picked.map((q,i)=><article className="print-answer" key={q.id}><h2>{i+1}번 · 정답: <MathText text={q.answer}/></h2><p className="pre-wrap"><MathText text={printText(q.solution,compactPrint)}/></p></article>)}</section>}
    </div>}
  </>;
}
