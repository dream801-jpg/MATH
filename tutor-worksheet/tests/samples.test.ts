import {test} from "node:test";
import assert from "node:assert/strict";
import {sampleWorksheets} from "../lib/sample-worksheets";
import {importWorksheet} from "../lib/worksheet";

test("내장 예제 9종을 파일 없이 불러오며 수식·필수 도형을 유지한다",()=>{
  assert.equal(sampleWorksheets.length,9);
  for(const sample of sampleWorksheets){
    const imported=importWorksheet(JSON.stringify(sample.data));
    assert.ok(imported.questions.length>=3,sample.id);
    assert.deepEqual(imported.displayWarnings,[],sample.id);
    assert.ok(imported.questions.every(q=>q.verification==="needs_review"),sample.id);
  }
});
