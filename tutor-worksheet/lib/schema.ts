import { z } from "zod";
import { diagramSchema } from "./diagram-schema";

const info = z.string().trim().max(6000).default("");
const required = z.string().trim().min(1).max(6000);
export const analysisSchema = z.object({
  original_problem: info, subject: info, unit: info, problem_type: info,
  concept: info, difficulty: info, answer: info, solution: info,
  warning: z.string().max(2000).default(""),
  original_diagram:diagramSchema.optional(),
  original_diagram_required:z.boolean().default(false),
});
export const questionSchema = z.object({
  question: required,
  answer: z.union([required,z.number().finite().transform(String)]),
  solution: z.string().trim().max(6000).default("풀이가 없습니다. AI에 풀이를 요청하거나 직접 입력해 주세요."),
  diagram:diagramSchema.optional(),
  diagram_required:z.boolean().default(false),
});
export type Analysis = z.infer<typeof analysisSchema>;
export type Question = z.infer<typeof questionSchema> & {
  id:string; verification:"needs_review"|"failed"; verification_note:string;
};
export type Mode = "numbers"|"similar"|"applied";
export type SubjectMode="math"|"english";
export type EnglishMode="retarget"|"light";
export type EnglishQuestionType="retain"|"blank"|"grammar"|"vocabulary"|"mixed";
